/**
 * UYAP Kelime İşlemci (UKİ) - Adli Tipografi & Gereksiz Boşluk Temizleyici (UkiLinter)
 * Geliştirici: Gökhan TAŞÇI (Sakarya Yazı İşleri Müdürü - Sicil: 139329)
 * 
 * Microsoft Word (Belge Denetçisi) & Grammarly Paritesi:
 * - Adliye evraklarında kopyala-yapıştır sonucu oluşan mükerrer çift boşlukları ("  ") temizler.
 * - Noktalama işaretlerinden önce yanlışlıkla konan boşlukları düzeltir ("karar , gereğince ." -> "karar, gereğince.").
 * - Satır sonu görünmez boşluklarını ve art arda 3'ten fazla gelen boş paragrafları tekilleştirir.
 * - Geri Al (Ctrl+Z) uyumludur.
 */

(function (window, document) {
    'use strict';

    const UkiLinter = {
        cleanTypography() {
            const editor = document.getElementById('editor');
            if (!editor) return { doubleSpacesFixed: 0, punctuationFixed: 0 };

            if (window.UkiHistory && typeof window.UkiHistory.pushState === 'function') {
                window.UkiHistory.pushState();
            }

            let doubleSpacesFixed = 0;
            let punctuationFixed = 0;

            const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                    if (node.parentElement && node.parentElement.closest('.pb-spacer, #watermark-layer, .udf-signature-block')) {
                        return NodeFilter.FILTER_SKIP;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            });

            let node;
            const nodesToProcess = [];
            while ((node = walker.nextNode())) {
                nodesToProcess.push(node);
            }

            nodesToProcess.forEach(textNode => {
                let val = textNode.nodeValue;
                if (!val) return;

                // 1. Çift ve çoklu boşlukları tek boşluğa indir
                const spaceMatches = val.match(/[^\S\r\n]{2,}/g);
                if (spaceMatches) {
                    doubleSpacesFixed += spaceMatches.length;
                    val = val.replace(/[^\S\r\n]{2,}/g, ' ');
                }

                // 2. Noktalama öncesi boşlukları temizle: "kelime ," -> "kelime,"
                const puncMatches = val.match(/\s+([,.:;!?])/g);
                if (puncMatches) {
                    punctuationFixed += puncMatches.length;
                    val = val.replace(/\s+([,.:;!?])/g, '$1');
                }

                // 3. Parantez içi boşluklar: "( kelime )" -> "(kelime)"
                val = val.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');

                if (val !== textNode.nodeValue) {
                    textNode.nodeValue = val;
                }
            });

            // 4. Art arda gelen 3'ten fazla boş paragrafı temizle
            const pElements = editor.querySelectorAll('p, div');
            let emptyStreak = 0;
            pElements.forEach(p => {
                const text = (p.innerText || p.textContent || '').trim();
                const hasImg = p.querySelector('img, table, hr');
                if (!text && !hasImg) {
                    emptyStreak++;
                    if (emptyStreak > 2) {
                        p.remove();
                    }
                } else {
                    emptyStreak = 0;
                }
            });

            if (window.UkiPages && typeof window.UkiPages.repaginate === 'function') {
                window.UkiPages.repaginate();
            }

            const total = doubleSpacesFixed + punctuationFixed;
            if (typeof window.showToast === 'function') {
                if (total > 0) {
                    window.showToast(`Tipografi Denetimi: ${doubleSpacesFixed} çift boşluk ve ${punctuationFixed} noktalama hatası düzeltildi!`, 'success');
                } else {
                    window.showToast('Belge tipografisi kusursuz: Gereksiz boşluk veya noktalama hatası bulunamadı.', 'info');
                }
            }

            return { doubleSpacesFixed, punctuationFixed };
        }
    };

    window.UkiLinter = UkiLinter;

})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : {});
