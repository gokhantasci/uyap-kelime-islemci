/**
 * UYAP Kelime İşlemci (UKİ) - Harf Denetimi Modülü (UkiSpellCheck)
 * ---------------------------------------------------------------
 * Masaüstü UYAP Doküman Editörü Harf Denetimi Grubu Birebir Paritesi:
 * 1. Tümünü Denetle (F7): Tüm belgeyi baştan sona denetler, öneriler ve değiştirme diyalogu sunar.
 * 2. Otomatik Büyük Harf: Cümle başlarında, nokta/ünlem/soru işareti sonrasında ilk harfi otomatik büyütür.
 * 3. Baş Harfler Büyük: Seçili metni veya unvan/başlık kelimelerinin baş harflerini büyük yapar.
 * 4. Kelime Denetimi: Gerçek zamanlı tarayıcı ve sözlük tabanlı kırmızı dalgalı yazım denetimi.
 */

(function (window, document) {
    'use strict';

    const LS_KEY_AUTO_CAPS = 'uki-spell-auto-caps';
    const LS_KEY_TITLE_CAPS = 'uki-spell-title-caps';
    const LS_KEY_LIVE_SPELL = 'uki-spell-live-check';
    const LS_KEY_CUSTOM_DICT = 'uki-spell-custom-dict';

    // Türkçe karakter dönüşümleri
    function toUpperTr(str) {
        return (str || '').toLocaleUpperCase('tr-TR');
    }
    function toLowerTr(str) {
        return (str || '').toLocaleLowerCase('tr-TR');
    }
    function toTitleCaseTr(str) {
        if (!str) return '';
        return str.replace(/([abcçdefgğhıijklmnoöprsştuüvyzABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ]+)/g, (w) => {
            return toUpperTr(w.charAt(0)) + toLowerTr(w.slice(1));
        });
    }

    // Temel Türkçe ve Hukuk Kelimeleri Kütüphanesi (Hızlı yerel denetim için)
    const CORE_TURKISH_WORDS = new Set([
        've', 'veya', 'ile', 'için', 'bir', 'bu', 'şu', 'o', 'ise', 'de', 'da', 'ki', 'ancak', 'lakin', 'fakat',
        'çünkü', 'daha', 'en', 'çok', 'az', 'kadar', 'gibi', 'sonra', 'önce', 'dolayı', 'ötürü', 'rağmen',
        'karar', 'dava', 'davacı', 'davalı', 'sanık', 'müşteki', 'mahkeme', 'mahkemesi', 'hakim', 'hâkim',
        'katip', 'kâtip', 'savcı', 'savcılığı', 'vekil', 'vekili', 'avukat', 'tutanak', 'dilekçe', ' tensip',
        'gerekçeli', 'hüküm', 'ceza', 'hukuk', 'asliye', 'ağır', 'sulh', 'icra', 'yargıtay', 'danıştay',
        'istinaf', 'temyiz', 'itiraz', 'iddianame', 'savunma', 'şüpheli', 'tanık', 'bilirkişi', 'keşif',
        'duruşma', 'celse', 'dosya', 'esas', 'sayılı', 'tarihli', 'günlü', 'kanun', 'madde', 'fıkra', 'bendi',
        'gereğince', 'uyarınca', 'istinaden', 'binaen', 'tazminat', 'alacak', 'tahliye', 'tahsil', 'infaz',
        'talep', 'beyan', 'itiraz', 'tespit', 'tahkikat', 'tahkikatın', 'delil', 'kanıt', 'ispat', 'yemin',
        'müvekkil', 'müddei', 'aleyhe', 'lehe', 'sübut', 'kesinleşme', 'derdest', 'ihtiyati', 'tedbir',
        'haciz', 'rehin', 'ipotek', 'mülkiyet', 'tapu', 'tescil', 'terkin', 'şerh', 'kamu', 'davası',
        'açılmış', 'olmakla', 'anlaşılmış', 'görülmüştür', 'açıklanan', 'nedenlerle', 'gereği', 'düşünüldü',
        'türk', 'milleti', 'adına', 'birlik', 'adli', 'yargı', 'adliye', 'bölge', 'cumhuriyet', 'başsavcılığı',
        'tahliye', 'tahkik', 'tebliğ', 'tebellüğ', 'tebligat', 'müzekkere', 'tensip', 'zaptı', 'layiha',
        'vekaletname', 'yetki', 'görev', 'yetkisizlik', 'görevsizlik', 'zamanaşımı', 'hakdüşürücü',
        'feragat', 'kabul', 'sulh', 'ıslah', 'müdahil', 'katılan', 'mağdur', 'suçtan', 'zarar', 'gören',
        'usul', 'esas', 'muhakeme', 'kanunu', 'maddesi', 'hükmü', 'şartı', 'borçlar', 'ticaret', 'medeni'
    ]);

    let customDictionary = new Set();
    function loadCustomDictionary() {
        try {
            const raw = localStorage.getItem(LS_KEY_CUSTOM_DICT);
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) arr.forEach(w => customDictionary.add(toLowerTr(w)));
            }
        } catch (_) {}
    }
    function saveCustomDictionary() {
        try {
            localStorage.setItem(LS_KEY_CUSTOM_DICT, JSON.stringify(Array.from(customDictionary)));
        } catch (_) {}
    }

    // Levenshtein Mesafesi (Öneri algoritması için)
    function levenshtein(a, b) {
        if (!a || !b) return (a || b).length;
        const m = a.length, n = b.length;
        const dp = [];
        for (let i = 0; i <= m; i++) {
            dp[i] = [i];
            for (let j = 1; j <= n; j++) {
                if (i === 0) dp[i][j] = j;
                else {
                    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                    dp[i][j] = Math.min(
                        dp[i - 1][j] + 1,
                        dp[i][j - 1] + 1,
                        dp[i - 1][j - 1] + cost
                    );
                }
            }
        }
        return dp[m][n];
    }

    // Harf Denetimi Denetleyici Durumu
    let isFullCheckActive = false;
    let spellTokens = [];
    let currentTokenIndex = -1;
    let ignoredWords = new Set();

    class UkiSpellCheckController {
        constructor() {
            this.editorEl = null;
            this.chkAutoCaps = null;
            this.chkTitleCaps = null;
            this.chkSpellcheck = null;
            this.btnSpellcheckAll = null;
            this.modalEl = null;
            this.suspectWordEl = null;
            this.contextPreviewEl = null;
            this.suggestionsListEl = null;
            this.progressTextEl = null;
        }

        init() {
            this.editorEl = document.getElementById('editor');
            this.chkAutoCaps = document.getElementById('chk-auto-caps');
            this.chkTitleCaps = document.getElementById('chk-title-caps');
            this.chkSpellcheck = document.getElementById('chk-spellcheck');
            this.btnSpellcheckAll = document.getElementById('btn-spellcheck-all');
            this.modalEl = document.getElementById('modal-spellcheck-dialog');

            if (!this.editorEl) return;

            loadCustomDictionary();

            // 1. Durumları Geri Yükle
            const autoCapsStored = localStorage.getItem(LS_KEY_AUTO_CAPS);
            const titleCapsStored = localStorage.getItem(LS_KEY_TITLE_CAPS);
            const liveSpellStored = localStorage.getItem(LS_KEY_LIVE_SPELL);

            if (this.chkAutoCaps) this.chkAutoCaps.checked = autoCapsStored === null ? true : autoCapsStored === '1';
            if (this.chkTitleCaps) this.chkTitleCaps.checked = titleCapsStored === null ? false : titleCapsStored === '1';
            if (this.chkSpellcheck) this.chkSpellcheck.checked = liveSpellStored === null ? true : liveSpellStored === '1';

            this.syncLiveSpellcheck();

            // 2. Olay Dinleyicileri
            if (this.chkSpellcheck) {
                this.chkSpellcheck.addEventListener('change', () => {
                    localStorage.setItem(LS_KEY_LIVE_SPELL, this.chkSpellcheck.checked ? '1' : '0');
                    this.syncLiveSpellcheck();
                });
            }

            if (this.chkAutoCaps) {
                this.chkAutoCaps.addEventListener('change', () => {
                    localStorage.setItem(LS_KEY_AUTO_CAPS, this.chkAutoCaps.checked ? '1' : '0');
                });
            }

            if (this.chkTitleCaps) {
                this.chkTitleCaps.addEventListener('change', () => {
                    localStorage.setItem(LS_KEY_TITLE_CAPS, this.chkTitleCaps.checked ? '1' : '0');
                    // Kullanıcı tıkladığında seçili metin varsa doğrudan Baş Harfleri Büyük yap
                    const sel = window.getSelection();
                    if (sel && !sel.isCollapsed && sel.toString().trim()) {
                        this.transformSelectionToTitleCase();
                    }
                });
            }

            if (this.btnSpellcheckAll) {
                this.btnSpellcheckAll.addEventListener('click', () => this.startFullSpellCheck());
            }

            // 3. Otomatik Büyük Harf (beforeinput & keydown)
            this.bindAutoCapitalization();

            // 4. Harf Denetimi Diyalog Butonları
            this.bindDialogControls();

            // 5. Global F7 Kısayolu (UYAP & Word Standardı)
            window.addEventListener('keydown', (e) => {
                if (e.key === 'F7' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    e.preventDefault();
                    this.startFullSpellCheck();
                }
            });
        }

        syncLiveSpellcheck() {
            if (!this.editorEl) return;
            const active = this.chkSpellcheck ? this.chkSpellcheck.checked : true;
            this.editorEl.setAttribute('spellcheck', active ? 'true' : 'false');
            this.editorEl.setAttribute('lang', 'tr');
        }

        // Cümle başlarında ve noktalama sonrasında otomatik büyük harf
        bindAutoCapitalization() {
            this.editorEl.addEventListener('beforeinput', (e) => {
                if (!this.chkAutoCaps || !this.chkAutoCaps.checked) return;
                if (e.inputType !== 'insertText' || !e.data || e.data.length !== 1) return;

                const char = e.data;
                // Yalnızca küçük harf girildiyse denetle
                if (!/^[abcçdefgğhıijklmnoöprsştuüvyz]$/.test(char)) return;

                const sel = window.getSelection();
                if (!sel || !sel.rangeCount || !sel.isCollapsed) return;

                const range = sel.getRangeAt(0);
                const node = range.startContainer;

                let shouldCapitalize = false;

                if (node.nodeType === Node.TEXT_NODE) {
                    const textBefore = node.nodeValue.substring(0, range.startOffset);
                    // 1. Paragrafın başı veya sadece boşluklardan sonra:
                    if (/^\s*$/.test(textBefore)) {
                        shouldCapitalize = true;
                    }
                    // 2. Nokta, soru işareti, ünlem veya iki nokta üst üste ve ardından bir/birden fazla boşluk:
                    else if (/[.!?:]\s+$/.test(textBefore)) {
                        shouldCapitalize = true;
                    }
                    // 3. Tırnak veya parantez açılıp hemen ardından cümle başı:
                    else if (/["'“‘(]\s*$/.test(textBefore)) {
                        // Tırnak öncesi nokta ise de büyük harf
                        shouldCapitalize = true;
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    // Boş paragraf içinde (örn <p><br></p>)
                    const text = node.textContent;
                    if (!text || /^\s*$/.test(text) || /[.!?:]\s+$/.test(text)) {
                        shouldCapitalize = true;
                    }
                }

                if (shouldCapitalize) {
                    e.preventDefault();
                    const upperChar = toUpperTr(char);
                    document.execCommand('insertText', false, upperChar);
                }
            });
        }

        // Seçili metni Baş Harfleri Büyük (Title Case) yapma
        transformSelectionToTitleCase() {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || !sel.rangeCount) return;

            const selectedText = sel.toString();
            if (!selectedText.trim()) return;

            const titled = toTitleCaseTr(selectedText);
            document.execCommand('insertText', false, titled);
            if (typeof window.showToast === 'function') {
                window.showToast('Seçili metin baş harfleri büyük yapıldı.', 'info');
            }
        }

        // ---------------------------------------------------------------------
        // TÜMÜNÜ DENETLE (FULL DOCUMENT SPELL CHECK DIALOG)
        // ---------------------------------------------------------------------
        async startFullSpellCheck() {
            if (!this.editorEl) return;
            ignoredWords.clear();
            spellTokens = this.collectWordTokens();

            if (!spellTokens.length) {
                if (typeof window.showToast === 'function') {
                    window.showToast('Belgede denetlenecek metin bulunamadı.', 'info');
                }
                return;
            }

            this.checkedWords = null;
            if (window.UkiWritingRules && window.Worker) {
                try {
                    if (this.btnSpellcheckAll) this.btnSpellcheckAll.disabled = true;
                    if (window.showToast) window.showToast('Yerel Türkçe sözlük hazırlanıyor…', 'info');
                    this.checkedWords = await window.UkiWritingRules.checkWords(Array.from(new Set(spellTokens.map(t => t.rawWord))));
                } catch (err) {
                    if (window.showToast) window.showToast(err.message + ' Tarayıcı denetimi ve yerel kurallar kullanılacak.', 'warning');
                } finally { if (this.btnSpellcheckAll) this.btnSpellcheckAll.disabled = false; }
            }
            currentTokenIndex = -1;
            isFullCheckActive = true;
            this.findNextMisspelling();
        }

        collectWordTokens() {
            const tokens = [];
            const walker = document.createTreeWalker(this.editorEl, NodeFilter.SHOW_TEXT, {
                acceptNode: (n) => {
                    if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                    if (n.parentElement.closest('[contenteditable="false"]')) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            });

            const wordRegex = /[abcçdefgğhıijklmnoöprsştuüvyzABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ]+/g;
            let textNode;
            while ((textNode = walker.nextNode())) {
                const text = textNode.nodeValue;
                let match;
                while ((match = wordRegex.exec(text)) !== null) {
                    const raw = match[0];
                    if (raw.length > 1) { // Tek harfli bağlaç vb. hariç
                        tokens.push({
                            textNode,
                            rawWord: raw,
                            startOffset: match.index,
                            endOffset: match.index + raw.length,
                            fullSentence: text
                        });
                    }
                }
            }
            return tokens;
        }

        isWordValid(word) {
            const lower = toLowerTr(word);
            if (window.UkiWritingRules && window.UkiWritingRules.suggest(word) && !ignoredWords.has(lower) && !customDictionary.has(lower)) return false;
            if (ignoredWords.has(lower) || customDictionary.has(lower) || CORE_TURKISH_WORDS.has(lower)) {
                return true;
            }
            // Sayı, tarih, kısaltma kontrolü (örn. TCK, CMK, A4, No)
            if (/^[A-ZÇĞİÖŞÜ0-9.]+$/.test(word) && word.length <= 5) return true;

            // Hukuk sözlüğünde var mı?
            if (window.UkiDictionary && window.UkiDictionary.lookup) {
                const found = window.UkiDictionary.lookup(lower);
                if (found) return true;
            }

            if (this.checkedWords && Object.prototype.hasOwnProperty.call(this.checkedWords, word)) return this.checkedWords[word];
            // Basit Türkçe fonetik & hece kuralı kontrolü
            // Sesli harf içermeyen kelimeler şüphelidir (kısaltmalar hariç)
            const vowels = /[aeıioöuüAEIİOÖUÜ]/;
            if (!vowels.test(word)) return false;

            // Arka arkaya 3 aynı sessiz harf veya Türkçe'de olmayan harf dizilimleri
            if (/([bcçdfgğhjklmnprsştvyzBCÇDFGĞHJKLMNPRSŞTVYZ])\1{2,}/.test(word)) return false;

            return true;
        }

        generateSuggestions(word) {
            const lower = toLowerTr(word);
            const candidates = new Set();
            const exact = window.UkiWritingRules && window.UkiWritingRules.suggest(word);
            if (exact) candidates.add(exact);

            // 1. Yaygın Türkçe harf karmaşaları (s<->ş, c<->ç, g<->ğ, i<->ı, o<->ö, u<->ü)
            const charMaps = [
                [/s/g, 'ş'], [/ş/g, 's'], [/c/g, 'ç'], [/ç/g, 'c'],
                [/g/g, 'ğ'], [/ğ/g, 'g'], [/i/g, 'ı'], [/ı/g, 'i'],
                [/o/g, 'ö'], [/ö/g, 'o'], [/u/g, 'ü'], [/ü/g, 'u']
            ];
            charMaps.forEach(([pattern, repl]) => {
                const alt = lower.replace(pattern, repl);
                if (CORE_TURKISH_WORDS.has(alt) || (window.UkiDictionary && window.UkiDictionary.lookup(alt))) {
                    candidates.add(alt);
                }
            });

            // 2. Çift harf / yazım hataları
            const deDupe = lower.replace(/(.)\1+/g, '$1');
            if (CORE_TURKISH_WORDS.has(deDupe)) candidates.add(deDupe);

            // 3. Bilinen kelimelerden Levenshtein mesafesi <= 2 olanlar
            CORE_TURKISH_WORDS.forEach(dictWord => {
                if (Math.abs(dictWord.length - lower.length) <= 2) {
                    if (levenshtein(lower, dictWord) <= 2) {
                        candidates.add(dictWord);
                    }
                }
            });

            // İlk harfin büyük/küçük formatını orijinal kelimeye uyarla
            const isInitialCapital = /^[A-ZÇĞİÖŞÜ]/.test(word);
            const list = Array.from(candidates).slice(0, 6).map(cand => {
                return isInitialCapital ? (toUpperTr(cand.charAt(0)) + cand.slice(1)) : cand;
            });

            if (!list.length) {
                // Hiçbiri yoksa ilk harfi büyük halini veya harf ayrışımını öner
                list.push(toUpperTr(word.charAt(0)) + toLowerTr(word.slice(1)));
            }
            return list;
        }

        findNextMisspelling() {
            while (++currentTokenIndex < spellTokens.length) {
                const token = spellTokens[currentTokenIndex];
                if (!this.isWordValid(token.rawWord)) {
                    this.showSpellDialogForToken(token);
                    return;
                }
            }

            // Bitti
            isFullCheckActive = false;
            this.closeSpellDialog();
            if (typeof window.showToast === 'function') {
                window.showToast('Harf denetimi tamamlandı. İncelenecek başka kelime bulunamadı.', 'success');
            }
        }

        showSpellDialogForToken(token) {
            this.suspectWordEl = document.getElementById('spell-suspect-word');
            this.contextPreviewEl = document.getElementById('spell-context-preview');
            this.suggestionsListEl = document.getElementById('spell-suggestions-list');
            this.progressTextEl = document.getElementById('spell-progress-text');

            if (this.suspectWordEl) this.suspectWordEl.textContent = token.rawWord;

            if (this.checkedWords && window.UkiWritingRules) {
                window.UkiWritingRules.suggestWord(token.rawWord).then(list => {
                    if (!isFullCheckActive || spellTokens[currentTokenIndex] !== token || !this.suggestionsListEl) return;
                    const merged = Array.from(new Set([...this.generateSuggestions(token.rawWord), ...list])).slice(0,10);
                    this.suggestionsListEl.replaceChildren();
                    merged.forEach((text, i) => { const opt = document.createElement('option'); opt.textContent = text; opt.value = text; opt.selected = i === 0; this.suggestionsListEl.append(opt); });
                }).catch(() => {});
            }

            if (this.contextPreviewEl) {
                const sent = token.fullSentence;
                const before = sent.substring(Math.max(0, token.startOffset - 35), token.startOffset);
                const after = sent.substring(token.endOffset, Math.min(sent.length, token.endOffset + 35));
                this.contextPreviewEl.replaceChildren(document.createTextNode('…'+before));
                const strong = document.createElement('strong'); strong.textContent = token.rawWord;
                this.contextPreviewEl.append(strong, document.createTextNode(after+'…'));
            }

            if (this.suggestionsListEl) {
                this.suggestionsListEl.innerHTML = '';
                const suggs = this.generateSuggestions(token.rawWord);
                suggs.forEach((s, idx) => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s;
                    if (idx === 0) opt.selected = true;
                    this.suggestionsListEl.appendChild(opt);
                });
            }

            if (this.progressTextEl) {
                this.progressTextEl.textContent = `Kelime: ${currentTokenIndex + 1} / ${spellTokens.length}`;
            }

            // İlgili kelimeyi editörde görünür yap ve seç
            this.highlightTokenInEditor(token);

            if (typeof window.openModal === 'function') {
                window.openModal(this.modalEl);
            } else if (this.modalEl) {
                this.modalEl.style.display = 'flex';
            }
        }

        highlightTokenInEditor(token) {
            try {
                const range = document.createRange();
                range.setStart(token.textNode, token.startOffset);
                range.setEnd(token.textNode, token.endOffset);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);

                const el = token.textNode.parentElement;
                if (el && el.scrollIntoView) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } catch (_) {}
        }

        bindDialogControls() {
            const btnIgnore = document.getElementById('btn-spell-ignore');
            const btnIgnoreAll = document.getElementById('btn-spell-ignore-all');
            const btnReplace = document.getElementById('btn-spell-replace');
            const btnReplaceAll = document.getElementById('btn-spell-replace-all');
            const btnAddDict = document.getElementById('btn-spell-add-dict');

            if (btnIgnore) {
                btnIgnore.addEventListener('click', () => {
                    this.findNextMisspelling();
                });
            }

            if (btnIgnoreAll) {
                btnIgnoreAll.addEventListener('click', () => {
                    if (currentTokenIndex >= 0 && spellTokens[currentTokenIndex]) {
                        ignoredWords.add(toLowerTr(spellTokens[currentTokenIndex].rawWord));
                    }
                    this.findNextMisspelling();
                });
            }

            if (btnReplace) {
                btnReplace.addEventListener('click', () => {
                    this.replaceCurrentWord(false);
                });
            }

            if (btnReplaceAll) {
                btnReplaceAll.addEventListener('click', () => {
                    this.replaceCurrentWord(true);
                });
            }

            if (btnAddDict) {
                btnAddDict.addEventListener('click', () => {
                    if (currentTokenIndex >= 0 && spellTokens[currentTokenIndex]) {
                        const word = toLowerTr(spellTokens[currentTokenIndex].rawWord);
                        customDictionary.add(word);
                        saveCustomDictionary();
                        if (typeof window.showToast === 'function') {
                            window.showToast(`"${word}" sözlüğe eklendi.`, 'success');
                        }
                    }
                    this.findNextMisspelling();
                });
            }
        }

        replaceCurrentWord(replaceAll = false) {
            if (currentTokenIndex < 0 || !spellTokens[currentTokenIndex]) return;
            const token = spellTokens[currentTokenIndex];
            const replacement = this.suggestionsListEl ? this.suggestionsListEl.value : '';
            if (!replacement) {
                this.findNextMisspelling();
                return;
            }

            const targetWord = token.rawWord;

            if (replaceAll) {
                // Editördeki tüm eşleşen kelimeleri değiştir
                const regex = new RegExp('(?<![\\p{L}])'+targetWord+'(?![\\p{L}])', 'gu');
                const walker = document.createTreeWalker(this.editorEl, NodeFilter.SHOW_TEXT);
                let n;
                while ((n = walker.nextNode())) {
                    regex.lastIndex = 0;
                    if (n.parentElement.closest('[contenteditable="false"]')) continue;
                    if (regex.test(n.nodeValue)) {
                        n.nodeValue = n.nodeValue.replace(regex, replacement);
                    }
                }
                ignoredWords.add(toLowerTr(targetWord));
            } else {
                // Tekil değiştirme
                try {
                    const text = token.textNode.nodeValue;
                    const newText = text.substring(0, token.startOffset) + replacement + text.substring(token.endOffset);
                    token.textNode.nodeValue = newText;
                } catch (_) {}
            }

            if (typeof window.recalculatePagesAndThumbnails === 'function') {
                window.recalculatePagesAndThumbnails();
            }

            this.editorEl.dispatchEvent(new Event('input', {bubbles:true}));
            const nextOffset = token.startOffset + replacement.length;
            spellTokens = this.collectWordTokens();
            currentTokenIndex = spellTokens.findIndex(t => t.textNode === token.textNode && t.startOffset >= nextOffset) - 1;
            if (currentTokenIndex < -1) currentTokenIndex = spellTokens.length - 1;
            this.findNextMisspelling();
        }

        closeSpellDialog() {
            if (typeof window.closeModal === 'function') {
                window.closeModal(this.modalEl);
            } else if (this.modalEl) {
                this.modalEl.style.display = 'none';
            }
        }
    }

    // Dışa aktarma ve başlatma
    const controller = new UkiSpellCheckController();
    window.UkiSpellCheck = {
        init: () => controller.init(),
        startFullSpellCheck: () => controller.startFullSpellCheck(),
        isWordValid: word => controller.isWordValid(word),
        generateSuggestions: word => controller.generateSuggestions(word),
        toTitleCase: toTitleCaseTr
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => controller.init());
    } else {
        controller.init();
    }

})(window, document);

