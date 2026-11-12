/**
 * UYAP Kelime İşlemci (UKİ) - Akıllı Hukuki Metin Genişletici & Kalıplar (UkiExpander)
 * Geliştirici: Gökhan TAŞÇI (Sakarya Yazı İşleri Müdürü - Sicil: 139329)
 * 
 * TextExpander, Raycast & Word AutoCorrect Paritesi:
 * - Kısayol kelime yazılıp Boşluk, Tab veya noktalı virgül (;) tuşlandığında uzun hukuki kalıba genişletir.
 * - Örnek: 'vekalet;' veya '\vekalet ' -> 'Dosyada mevcut vekaletname uyarınca davacı vekili...'
 * - Kullanıcı özel kısayol tanımlayabilir, silebilir ve yerel depolamada saklayabilir.
 */

(function (window, document) {
    'use strict';

    const LS_KEY = 'uki_custom_text_expansions_v1';

    const DEFAULT_SNIPPETS = {
        '\\vekalet': 'Dosyada mevcut vekaletname uyarınca davacı vekili olarak yetkili bulunmaktayız.',
        'vekalet;': 'Dosyada mevcut vekaletname uyarınca davacı vekili olarak yetkili bulunmaktayız.',
        '\\arz': 'Gereğini saygılarımla bilvekale arz ve talep ederim.',
        'arz;': 'Gereğini saygılarımla bilvekale arz ve talep ederim.',
        '\\sure': 'Bilirkişi raporuna karşı beyan ve itirazlarımızı sunmak üzere tarafımıza iki haftalık ek süre verilmesini talep ederiz.',
        'sure;': 'Bilirkişi raporuna karşı beyan ve itirazlarımızı sunmak üzere tarafımıza iki haftalık ek süre verilmesini talep ederiz.',
        '\\tebligat': 'Tebligata yarar adresimiz UYAP sisteminde kayıtlı olup, tebligatların bu adrese yapılmasını talep ederiz.',
        'tebligat;': 'Tebligata yarar adresimiz UYAP sisteminde kayıtlı olup, tebligatların bu adrese yapılmasını talep ederiz.',
        '\\karar': 'GEREĞİ DÜŞÜNÜLDÜ:\nYapılan yargılama, toplanan deliller ve tüm dosya kapsamı birlikte değerlendirildiğinde;',
        'karar;': 'GEREĞİ DÜŞÜNÜLDÜ:\nYapılan yargılama, toplanan deliller ve tüm dosya kapsamı birlikte değerlendirildiğinde;',
        '\\delil': 'HMK 121 ve 140. maddeleri uyarınca delillerimizi hasren ve bilvesile mahkemenize sunuyoruz.',
        'delil;': 'HMK 121 ve 140. maddeleri uyarınca delillerimizi hasren ve bilvesile mahkemenize sunuyoruz.',
        '\\ibra': 'Taraflar karşılıklı olarak birbirlerini geçmişe ve geleceğe yönelik gayrikabili rücu ibra etmişlerdir.',
        'ibra;': 'Taraflar karşılıklı olarak birbirlerini geçmişe ve geleceğe yönelik gayrikabili rücu ibra etmişlerdir.',
        '\\tarih': () => new Date().toLocaleDateString('tr-TR'),
        'tarih;': () => new Date().toLocaleDateString('tr-TR')
    };

    function getCustomSnippets() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function saveCustomSnippets(obj) {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(obj));
        } catch (e) {}
    }

    const UkiExpander = {
        init() {
            const editor = document.getElementById('editor');
            if (editor) {
                editor.addEventListener('keydown', (e) => {
                    if (e.key === ' ' || e.key === 'Tab' || e.key === ';') {
                        UkiExpander.checkAndExpand(e);
                    }
                });
            }
        },

        checkAndExpand(e) {
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;

            const range = sel.getRangeAt(0);
            if (!range.collapsed) return;

            const node = range.startContainer;
            if (node.nodeType !== Node.TEXT_NODE) return;

            const textBefore = node.nodeValue.substring(0, range.startOffset);
            // Son kelimeyi al
            const match = textBefore.match(/([^\s]+)$/);
            if (!match) return;

            let shortcut = match[1];
            if (e.key === ';') {
                shortcut += ';';
            }

            const custom = getCustomSnippets();
            let expansion = custom[shortcut] || DEFAULT_SNIPPETS[shortcut];

            if (expansion) {
                e.preventDefault();
                if (typeof expansion === 'function') {
                    expansion = expansion();
                }

                // Kısayolu metinden çıkar ve yerine kalıbı yerleştir
                const startPos = range.startOffset - match[1].length;
                node.nodeValue = node.nodeValue.substring(0, startPos) + node.nodeValue.substring(range.startOffset);

                // İmleci düzelt
                range.setStart(node, startPos);
                range.setEnd(node, startPos);

                document.execCommand('insertText', false, expansion + (e.key === ' ' ? ' ' : ' '));

                if (typeof window.showToast === 'function') {
                    window.showToast(`Kalıp genişletildi: "${shortcut}"`, 'info');
                }
            }
        },

        getAllSnippets() {
            const custom = getCustomSnippets();
            const all = {};
            for (const k in DEFAULT_SNIPPETS) {
                all[k] = typeof DEFAULT_SNIPPETS[k] === 'function' ? 'Güncel Tarih (GG.AA.YYYY)' : DEFAULT_SNIPPETS[k];
            }
            for (const k in custom) {
                all[k] = custom[k];
            }
            return all;
        },

        addSnippet(shortcut, expansion) {
            if (!shortcut || !expansion) return;
            const custom = getCustomSnippets();
            custom[shortcut] = expansion;
            saveCustomSnippets(custom);
        },

        removeSnippet(shortcut) {
            const custom = getCustomSnippets();
            delete custom[shortcut];
            saveCustomSnippets(custom);
        }
    };

    window.UkiExpander = UkiExpander;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UkiExpander.init());
    } else {
        UkiExpander.init();
    }

})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : {});

