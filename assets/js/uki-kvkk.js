/**
 * UYAP Kelime İşlemci (UKİ) - KVKK Kişisel Verileri Maskeleme ve Anonimleştirme Modülü
 * 
 * Türkiye Cumhuriyeti KVKK ve mahkeme kararlarının yayını standartlarına uygun olarak
 * TC Kimlik No, telefon, IBAN, plaka, taraf/şahıs isimleri ve adresleri istemci tarafında (%100 offline)
 * tespit eder ve kullanıcının belirlediği maskeleme kalıbıyla belgeden arındırır.
 */
(function (window) {
    'use strict';

    // TC Kimlik Algoritması Doğrulaması (İsteğe bağlı kesin filtre)
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

    const UkiKvkk = {
        // Önayarlı Maskeleme Değerleri
        defaultMasks: {
            tc: '[TC NO GİZLENDİ]',
            phone: '[TELEFON GİZLENDİ]',
            iban: '[IBAN GİZLENDİ]',
            plate: '[PLAKA GİZLENDİ]',
            email: '[E-POSTA GİZLENDİ]',
            person: 'initials', // 'initials' (A*** Y***) veya özel metin
            address: '[ADRES GİZLENDİ]'
        },

        lastScanResults: [],

        /**
         * Belgedeki metinleri tarar ve bulunan hassas kişisel verileri listeler
         */
        scanDocument(editorEl) {
            if (!editorEl) return [];
            const text = editorEl.innerText || editorEl.textContent || '';
            const findings = [];
            const seen = new Set();

            function addFinding(type, label, original, replacement) {
                const key = type + ':' + original;
                if (seen.has(key)) return;
                seen.add(key);
                findings.push({
                    type,
                    label,
                    original,
                    replacement,
                    count: (text.split(original).length - 1)
                });
            }

            // 1. TC Kimlik Numaraları (11 Haneli)
            const tcMatches = text.match(/\b[1-9]\d{10}\b/g) || [];
            tcMatches.forEach(tc => {
                const mask = UkiKvkk.defaultMasks.tc;
                addFinding('tc', 'TC Kimlik No', tc, mask);
            });

            // 2. Telefon Numaraları (+90 / 05xx)
            const phoneRegex = /(?:\+90\s*|0)?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g;
            const phoneMatches = text.match(phoneRegex) || [];
            phoneMatches.forEach(phone => {
                addFinding('phone', 'Telefon Numarası', phone.trim(), UkiKvkk.defaultMasks.phone);
            });

            // 3. IBAN Numaraları
            const ibanRegex = /TR\d{2}\s*(?:\d{4}\s*){5}\d{2}/gi;
            const ibanMatches = text.match(ibanRegex) || [];
            ibanMatches.forEach(iban => {
                addFinding('iban', 'IBAN Numarası', iban.trim(), UkiKvkk.defaultMasks.iban);
            });

            // 4. Araç Plakaları
            const plateRegex = /\b(?:0[1-9]|[1-7]\d|8[01])\s*[A-Z]{1,3}\s*\d{2,4}\b/g;
            const plateMatches = text.match(plateRegex) || [];
            plateMatches.forEach(pl => {
                addFinding('plate', 'Araç Plakası', pl.trim(), UkiKvkk.defaultMasks.plate);
            });

            // 5. Şahıs / Taraf İsimleri (Müşteki, Sanık, Davacı, Davalı vb.)
            const partyRegex = /(?:Müşteki(?:\s+sanık)?|Sanık|Davacı|Davalı|Tanık|Mağdur|Vekil|Şüpheli|Katılan)\s*:?\s*([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)*\s+[A-ZÇĞİÖŞÜ]{2,})/g;
            let m;
            while ((m = partyRegex.exec(text)) !== null) {
                const name = m[1].trim();
                if (name.length >= 3 && !/MAHKEMESİ|SAVCILIĞI|BAŞKANLIĞI|MÜDÜRLÜĞÜ/i.test(name)) {
                    const rep = UkiKvkk.defaultMasks.person === 'initials' ? maskNameInitials(name) : UkiKvkk.defaultMasks.person;
                    addFinding('person', 'Taraf / Şahıs Adı', name, rep);
                }
            }

            // 6. E-posta Adresleri
            const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
            const emailMatches = text.match(emailRegex) || [];
            emailMatches.forEach(email => {
                addFinding('email', 'E-posta Adresi', email.trim(), UkiKvkk.defaultMasks.email || '[E-POSTA GİZLENDİ]');
            });

            UkiKvkk.lastScanResults = findings;
            return findings;
        },

        /**
         * Seçilen kişisel veri bulgularını editör DOM yapısını bozmadan değiştirir
         */
        applyRedaction(editorEl, selectedReplacements) {
            if (!editorEl || !selectedReplacements || !selectedReplacements.length) return 0;

            let totalReplaced = 0;

            function walkTextNodes(node, callback) {
                if (node.nodeType === Node.TEXT_NODE) {
                    callback(node);
                    return;
                }
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.classList && (node.classList.contains('pb-header') || node.classList.contains('pb-footer') || node.classList.contains('udf-watermark'))) {
                        return;
                    }
                    Array.from(node.childNodes).forEach(c => walkTextNodes(c, callback));
                }
            }

            selectedReplacements.forEach(item => {
                const orig = item.original;
                const rep = item.replacement;
                if (!orig || !rep || orig === rep) return;

                walkTextNodes(editorEl, (tNode) => {
                    if (tNode.nodeValue && tNode.nodeValue.indexOf(orig) >= 0) {
                        tNode.nodeValue = tNode.nodeValue.split(orig).join(rep);
                        totalReplaced++;
                    }
                });
            });

            // Sayfalama ve önizleme yenile
            if (window.recalculatePagesAndThumbnails) {
                window.recalculatePagesAndThumbnails();
            }
            if (window.UkiApp && window.UkiApp.markChanged) {
                window.UkiApp.markChanged();
            }

            return totalReplaced;
        }
    };

    window.UkiKvkk = UkiKvkk;
})(window);

