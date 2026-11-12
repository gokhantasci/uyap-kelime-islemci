/**
 * UYAP Kelime İşlemci (UKİ) - KVKK Kişisel Verileri Maskeleme ve Anonimleştirme Modülü
 * 
 * Türkiye Cumhuriyeti KVKK ve mahkeme kararlarının yayını standartlarına uygun olarak
 * TC Kimlik No, telefon, IBAN, plaka, taraf/şahıs isimleri, anne/baba adları, doğum tarihi ve yerleri,
 * ikametgah/tebligat adresleri ve sicil numaralarını istemci tarafında (%100 offline) tespit eder
 * ve kullanıcının belirlediği maskeleme kalıbıyla DOM biçimlendirmesini bozmadan belgeden arındırır.
 * 
 * Yerleşik yapay zeka (Chrome Prompt API / Gemini Nano, WebGPU, Ollama, API) ile derin anlamsal
 * analiz ve akıllı arındırma desteği sağlar.
 */
(function (window) {
    'use strict';

    // TC Kimlik Algoritması Doğrulaması (Mod10 Algoritması)
    function isValidTcKimlik(tc) {
        if (!/^[1-9]\d{10}$/.test(tc)) return false;
        const digits = tc.split('').map(Number);
        const d10 = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7 - (digits[1] + digits[3] + digits[5] + digits[7])) % 10;
        const d11 = digits.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
        return d10 === digits[9] && d11 === digits[10];
    }

    // İsim maskeleme (Ahmet YILMAZ -> A*** Y***)
    function maskNameInitials(fullName) {
        const parts = String(fullName || '').trim().split(/\s+/);
        return parts.map(p => {
            if (!p) return '';
            return p[0].toLocaleUpperCase('tr-TR') + '***';
        }).join(' ');
    }

    // Editörden blok sınırlarını koruyarak metin çıkarma
    function getEditorText(editorEl) {
        if (!editorEl) return '';
        function walk(node) {
            if (!node) return '';
            if (node.nodeType === Node.TEXT_NODE) {
                return node.nodeValue;
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName.toLowerCase();
                if (node.classList && (node.classList.contains('pb-header') || node.classList.contains('pb-footer') || node.classList.contains('udf-watermark'))) {
                    return '';
                }
                if (tag === 'br') return '\n';
                let str = '';
                for (let child of node.childNodes) {
                    str += walk(child);
                }
                if (['p', 'div', 'tr', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
                    return '\n' + str + '\n';
                }
                return str;
            }
            return '';
        }
        return walk(editorEl).replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ').replace(/\n{3,}/g, '\n\n');
    }

    // DOM içinde birden fazla span/düğüme bölünmüş metinleri biçimlendirmeyi bozmadan güvenle değiştirir
    function replaceTextInElement(element, orig, rep) {
        if (!element || !orig || rep === undefined || rep === null || orig === rep) return 0;
        let replaceCount = 0;

        function getTextNodes(node) {
            const textNodes = [];
            function walk(n) {
                if (n.nodeType === Node.TEXT_NODE) {
                    textNodes.push(n);
                } else if (n.nodeType === Node.ELEMENT_NODE) {
                    if (n.classList && (n.classList.contains('pb-header') || n.classList.contains('pb-footer') || n.classList.contains('udf-watermark'))) {
                        return;
                    }
                    for (let child of n.childNodes) {
                        walk(child);
                    }
                }
            }
            walk(node);
            return textNodes;
        }

        let searchStart = 0;
        while (true) {
            const textNodes = getTextNodes(element);
            if (!textNodes.length) break;

            let fullText = '';
            const nodeRanges = [];

            for (let tn of textNodes) {
                const val = tn.nodeValue || '';
                const start = fullText.length;
                const end = start + val.length;
                nodeRanges.push({ node: tn, start, end });
                fullText += val;
            }

            const matchIdx = fullText.indexOf(orig, searchStart);
            if (matchIdx === -1) break;

            const matchStart = matchIdx;
            const matchEnd = matchIdx + orig.length;
            replaceCount++;

            const overlapping = [];
            for (let nr of nodeRanges) {
                if (nr.end > matchStart && nr.start < matchEnd) {
                    overlapping.push(nr);
                }
            }

            if (overlapping.length === 1) {
                const nr = overlapping[0];
                const localStart = matchStart - nr.start;
                const localEnd = matchEnd - nr.start;
                const curVal = nr.node.nodeValue;
                nr.node.nodeValue = curVal.slice(0, localStart) + rep + curVal.slice(localEnd);
            } else if (overlapping.length > 1) {
                const first = overlapping[0];
                const last = overlapping[overlapping.length - 1];

                const firstLocalStart = matchStart - first.start;
                const lastLocalEnd = matchEnd - last.start;

                const firstPrefix = first.node.nodeValue.slice(0, firstLocalStart);
                const lastSuffix = last.node.nodeValue.slice(lastLocalEnd);

                first.node.nodeValue = firstPrefix + rep;

                for (let i = 1; i < overlapping.length - 1; i++) {
                    overlapping[i].node.nodeValue = '';
                }

                last.node.nodeValue = lastSuffix;
            }

            // Arama başlangıcını ilerlet
            searchStart = matchStart + rep.length;
        }

        return replaceCount;
    }

    const UkiKvkk = {
        // Önayarlı Maskeleme Değerleri
        defaultMasks: {
            tc: '[TC NO GİZLENDİ]',
            phone: '[TELEFON GİZLENDİ]',
            iban: '[IBAN GİZLENDİ]',
            plate: '[PLAKA GİZLENDİ]',
            email: '[E-POSTA GİZLENDİ]',
            person: 'initials', // 'initials' (A*** Y***) veya özel metin
            address: '[ADRES GİZLENDİ]',
            parent: 'initials', // initials (A*** ve B*** kızı) veya [ANNE/BABA BİLGİSİ GİZLENDİ]
            birth: '[DOĞUM BİLGİSİ GİZLENDİ]',
            sicil: '[SİCİL GİZLENDİ]'
        },

        lastScanResults: [],

        /**
         * Belgedeki metinleri tarar ve bulunan hassas kişisel verileri listeler
         */
        scanDocument(editorEl, customMasks) {
            if (!editorEl) return [];
            const text = getEditorText(editorEl);
            const masks = Object.assign({}, UkiKvkk.defaultMasks, customMasks || {});
            const findings = [];
            const seen = new Set();

            function addFinding(type, label, original, replacement, source = 'rule') {
                const cleanOrig = String(original || '').trim();
                if (!cleanOrig || cleanOrig.length < 2) return;
                const key = type + ':' + cleanOrig.toLocaleLowerCase('tr-TR');
                if (seen.has(key)) return;
                seen.add(key);

                // Belge içindeki gerçek tekrarlanma adedini hesapla
                let count = 0;
                let pos = text.indexOf(cleanOrig);
                while (pos !== -1) {
                    count++;
                    pos = text.indexOf(cleanOrig, pos + cleanOrig.length);
                }

                findings.push({
                    type,
                    label,
                    original: cleanOrig,
                    replacement: replacement || '***',
                    count: Math.max(count, 1),
                    source
                });
            }

            // 1. TC Kimlik Numaraları (11 Haneli ve Algoritmik Denetimli / Ön ekli)
            const tcCandidates = text.match(/(?:TC(?:\s*Kimlik)?(?:\s*No)?\s*[:.\s]*)?([1-9]\d{10})(?!\d)/gi) || [];
            tcCandidates.forEach(cand => {
                const digits = cand.replace(/\D/g, '');
                if (digits.length === 11) {
                    if (isValidTcKimlik(digits) || /TC/i.test(cand)) {
                        addFinding('tc', 'TC Kimlik No', digits, masks.tc);
                    }
                }
            });

            // 1.1 Boşluklu/noktalı yazılmış TC Kimlik No kalıpları (örn. 123 456 789 01)
            const formattedTc = text.match(/\b[1-9]\d{2}[\s.-]\d{3}[\s.-]\d{2}[\s.-]\d{2}\b/g) || [];
            formattedTc.forEach(rawTc => {
                const digits = rawTc.replace(/\D/g, '');
                if (digits.length === 11 && isValidTcKimlik(digits)) {
                    addFinding('tc', 'TC Kimlik No', rawTc.trim(), masks.tc);
                }
            });

            // 2. Telefon Numaraları (+90 / 05xx ve Sabit Hatlar)
            const phoneRegex = /(?:\+90\s*|0)?\s*5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g;
            const phoneMatches = text.match(phoneRegex) || [];
            phoneMatches.forEach(phone => {
                addFinding('phone', 'Telefon Numarası', phone.trim(), masks.phone);
            });

            const fixedPhoneRegex = /(?:\+90\s*|0)?\s*[2-4]\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g;
            const fixedPhoneMatches = text.match(fixedPhoneRegex) || [];
            fixedPhoneMatches.forEach(phone => {
                addFinding('phone', 'Telefon Numarası', phone.trim(), masks.phone);
            });

            // 3. IBAN Numaraları
            const ibanRegex = /TR\s*\d{2}(?:\s*\d{4}){5}\s*\d{2}/gi;
            const ibanMatches = text.match(ibanRegex) || [];
            ibanMatches.forEach(iban => {
                addFinding('iban', 'IBAN Numarası', iban.trim(), masks.iban);
            });

            // 4. Araç Plakaları
            const plateRegex = /\b(?:0[1-9]|[1-7]\d|8[01])\s*[A-ZÇĞİÖŞÜ]{1,3}\s*\d{2,4}\b/g;
            const plateMatches = text.match(plateRegex) || [];
            plateMatches.forEach(pl => {
                addFinding('plate', 'Araç Plakası', pl.trim(), masks.plate);
            });

            // 5. E-posta Adresleri
            const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
            const emailMatches = text.match(emailRegex) || [];
            emailMatches.forEach(email => {
                addFinding('email', 'E-posta Adresi', email.trim(), masks.email || '[E-POSTA GİZLENDİ]');
            });

            // 6. Taraf ve Mahkeme Heyeti İsimleri (Tüm Yargı Rolleri & Büyük/Küçük Harf)
            const partyRoles = '(?:MÜŞTEKİ(?:\\s*[-/]?\\s*SANIK)?|SANIK|DAVACI|DAVALI|TANIK|MAĞDUR|VEK[İI]L[İI]?|MÜDAF[İI][İI]?|ŞÜPHEL[İI]|KATILAN|MÜDAH[İI]L|HAK[İI]M|H[AÂ]K[İI]M|K[AÂ]T[İI]P|CUMHUR[İI]YET\\s+SAVCISI|C\\.\\s*SAVCISI|B[İI]L[İI]RK[İI]Ş[İI]|MÜBAŞ[İI]R|BORÇLU|ALACAKLI|SUÇA\\s+SÜRÜKLENEN\\s+ÇOCUK|SSÇ|İHBAR\\s+EDEN|ŞİKAYETÇİ|VAS[İI]|KAYYIM)';
            const partyRegex = new RegExp(partyRoles + '\\s*[:\\t-]\\s*([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+){1,3})', 'gi');
            let m;
            while ((m = partyRegex.exec(text)) !== null) {
                let name = m[1].trim();
                name = name.replace(/\s+\d{4,7}$/, '').trim(); // Sicil no eklentisini temizle
                if (name.length >= 3 && !/MAHKEME|SAVCILIK|BAŞKANLIK|MÜDÜRLÜK|BAKANLIK|MİLLETİ|BARO|DAİRE|HUKUKU|K\.H\.|T\.C\.|TÜRKİYE/i.test(name)) {
                    const rep = masks.person === 'initials' ? maskNameInitials(name) : masks.person;
                    addFinding('person', 'Taraf / Mahkeme Heyeti', name, rep);
                }
            }

            // 6.1 Gerekçe ve Metin İçi Taraf İsimleri (örn. "Müşteki Sanık BİLGE DALGIÇ adına...")
            const narrativeRegex = /(?:Müşteki\s+Sanık|Sanık|Müşteki|Davacı|Davalı|Katılan|Mağdur|Tanık)\s+([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğıöşü]+){1,2})/g;
            while ((m = narrativeRegex.exec(text)) !== null) {
                let name = m[1].trim();
                if (name.length >= 3 && !/MAHKEME|SAVCILIK|BAŞKANLIK|MÜDÜRLÜK|BAKANLIK|MİLLETİ|BARO|DAİRE|HUKUKU|K\.H\.|T\.C\./i.test(name)) {
                    if (!/^(?:adına|hakkında|tarafından|ile|ve)\b/i.test(name)) {
                        const rep = masks.person === 'initials' ? maskNameInitials(name) : masks.person;
                        addFinding('person', 'Taraf / Şahıs Adı', name, rep);
                    }
                }
            }

            // 7. Anne ve Baba Adı (Soybağı / Ebeveyn Bilgileri)
            const parentRegex = /([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)?)\s+(?:ve|ile)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)?)\s+(kızı|oğlu|çocuğu|evladı)/gi;
            while ((m = parentRegex.exec(text)) !== null) {
                const fullParentPhrase = m[0].trim();
                const father = m[1].trim();
                const mother = m[2].trim();
                const rel = m[3].trim();
                let rep = masks.parent === 'initials' 
                    ? (maskNameInitials(father) + ' ve ' + maskNameInitials(mother) + ' ' + rel)
                    : (masks.parent || '[ANNE/BABA BİLGİSİ GİZLENDİ]');
                addFinding('parent', 'Anne / Baba Adı (Soybağı)', fullParentPhrase, rep);
            }

            // 8. Doğum Tarihi ve Doğum Yeri
            const birthRegex = /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+\s+doğumlu)\b/gi;
            while ((m = birthRegex.exec(text)) !== null) {
                addFinding('birth', 'Doğum Tarihi / Yeri', m[1].trim(), masks.birth || '[DOĞUM BİLGİSİ GİZLENDİ]');
            }

            // 9. Yerleşim Yeri / İkametgah ve Tebligat Adresleri
            const addrRegex = /([A-ZÇĞİÖŞÜ][a-zA-ZçğıöşüÇĞİÖŞÜ0-9\s()/-]{1,35}?(?:Mah\.|Mahallesi|Cad\.|Caddesi|Sok\.|Sokağı|Sk\.|Bulvarı|Blv\.)[\s\S]+?(?:adresinde\s+(?:oturur|ikamet\s+eder|bulunur)|[A-ZÇĞİÖŞÜa-zçğıöşü]+\s*\/\s*[A-ZÇĞİÖŞÜ]+(?:\s+adresinde\s+(?:oturur|ikamet\s+eder|bulunur))?))/gi;
            while ((m = addrRegex.exec(text)) !== null) {
                let addr = m[1].trim();
                if (addr.length >= 10) {
                    addFinding('address', 'Yerleşim Yeri / Adres', addr, masks.address || '[ADRES GİZLENDİ]');
                }
            }

            // 10. Hâkim / Kâtip / Savcı Sicil Numaraları
            const sicilRegex = /(?:HAK[İI]M|K[AÂ]T[İI]P|SAVCI)\s*:[^\n\r\d]*\d{0,3}[^\n\r\d]+([1-9]\d{4,6})\b/gi;
            while ((m = sicilRegex.exec(text)) !== null) {
                addFinding('sicil', 'Sicil Numarası', m[1].trim(), masks.sicil || '[SİCİL GİZLENDİ]');
            }

            UkiKvkk.lastScanResults = findings;
            return findings;
        },

        /**
         * İsteğe bağlı olarak Yapay Zeka (Gemini Nano / Ollama / WebGPU) ile derin tarama yapar
         */
        async scanWithAI(editorEl, customMasks) {
            if (!editorEl) return [];
            
            // Öncelikle güçlü kural ve şablon tabanlı yerel taramayı çalıştır
            const ruleFindings = UkiKvkk.scanDocument(editorEl, customMasks);
            
            // Eğer UkiAI modülü ve aktif modeli varsa yapay zeka ile tara
            if (window.UkiAI && typeof window.UkiAI.scanKvkkWithAI === 'function') {
                const text = getEditorText(editorEl);
                try {
                    const aiList = await window.UkiAI.scanKvkkWithAI(text);
                    if (Array.isArray(aiList) && aiList.length > 0) {
                        const seen = new Set(ruleFindings.map(f => (f.type + ':' + f.original.toLocaleLowerCase('tr-TR'))));
                        aiList.forEach(aiItem => {
                            if (!aiItem || !aiItem.original) return;
                            const key = (aiItem.type || 'person') + ':' + String(aiItem.original).trim().toLocaleLowerCase('tr-TR');
                            if (!seen.has(key)) {
                                seen.add(key);
                                ruleFindings.push({
                                    type: aiItem.type || 'person',
                                    label: aiItem.label || 'Kişisel Veri (AI)',
                                    original: String(aiItem.original).trim(),
                                    replacement: aiItem.replacement || '***',
                                    count: (text.split(aiItem.original).length - 1) || 1,
                                    source: 'ai'
                                });
                            }
                        });
                    }
                } catch (e) {
                    console.warn('[UkiKvkk] AI tarama sırasında hata:', e);
                }
            }

            UkiKvkk.lastScanResults = ruleFindings;
            return ruleFindings;
        },

        /**
         * Seçilen kişisel veri bulgularını editör DOM yapısını ve sayfa düzenini bozmadan değiştirir
         */
        applyRedaction(editorEl, selectedReplacements) {
            if (!editorEl || !selectedReplacements || !selectedReplacements.length) return 0;

            // Uzun ifadeler önce değiştirilsin ki alt dizgiler tam eşleşmeleri bozmasın
            const sorted = [...selectedReplacements].sort((a, b) => (b.original || '').length - (a.original || '').length);

            let totalReplaced = 0;
            const blocks = Array.from(editorEl.querySelectorAll('p, div, td, th, li, h1, h2, h3, h4, h5, h6'));
            if (!blocks.length) blocks.push(editorEl);

            sorted.forEach(item => {
                const orig = item.original;
                const rep = item.replacement;
                if (!orig || rep === undefined || rep === null || orig === rep) return;

                blocks.forEach(block => {
                    totalReplaced += replaceTextInElement(block, orig, rep);
                });
            });

            // Doğrudan editorEl kök seviyesinde kalmış olabilecek serbest düğümler için son geçiş
            sorted.forEach(item => {
                totalReplaced += replaceTextInElement(editorEl, item.original, item.replacement);
            });

            // Sayfalama ve önizleme yenile
            if (typeof window.recalculatePagesAndThumbnails === 'function') {
                window.recalculatePagesAndThumbnails();
            }
            if (window.UkiApp && typeof window.UkiApp.markChanged === 'function') {
                window.UkiApp.markChanged();
            }

            return totalReplaced;
        }
    };

    window.UkiKvkk = UkiKvkk;
})(typeof window !== 'undefined' ? window : globalThis);
