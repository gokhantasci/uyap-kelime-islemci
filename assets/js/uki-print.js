/**
 * UYAP Kelime İşlemci (UKİ) - Yazdırma
 *
 * Ekrandaki sayfalama (uki-pages.js) birebir yazdırılır: her sayfa, editörün kendi görünümünden kırpılan sabit
 * boyutlu bir "kâğıt" olur. Böylece üst bilgi, sayfa numarası, doğrulama satırı, QR kod, filigran ve antet ile
 * satır/sayfa sonları ekrandakiyle aynıdır. Tarayıcının kendi sayfalaması kullanılmaz.
 *
 * window.print() bu modülle değiştirilir (Ctrl+P, Dosya > Yazdır, araç çubuğu aynı yolu kullanır).
 */
(function (window, document) {
    'use strict';

    const nativePrint = window.print.bind(window);
    let busy = false;

    // Sayfanın ekran stillerinden "yazdırma" ortam kurallarını çıkarıp kopyalar (ekran düzeni aynen taşınır)
    function collectScreenCss() {
        let css = '';
        Array.from(document.styleSheets).forEach((sheet) => {
            let rules;
            try { rules = sheet.cssRules; } catch (e) { return; } // başka kaynaklı stil: atla
            Array.from(rules).forEach((rule) => {
                if (rule.type === CSSRule.MEDIA_RULE && /print/i.test(rule.media.mediaText) && !/screen/i.test(rule.media.mediaText)) return;
                css += rule.cssText + '\n';
            });
        });
        return css;
    }

    function build() {
        const ed = document.getElementById('editor');
        if (!ed) return null;
        if (window.UkiPages && window.UkiPages.repaginate) window.UkiPages.repaginate();
        const g = window.UkiPages ? window.UkiPages.geometry() : null;
        const n = window.UkiPages ? window.UkiPages.pageCount : 1;
        if (!g) return null;

        const isLandscape = ed.classList.contains('orientation-landscape');
        const pageOrientation = isLandscape ? 'landscape' : 'portrait';

        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        // visibility:hidden Chromium tabanlı tarayıcılarda yazdırma renderını engelleyebileceği için güvenli gizleme
        iframe.style.cssText = 'position:fixed;right:100%;bottom:100%;width:0;height:0;border:0;opacity:0;pointer-events:none;';
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument;

        const html = doc.documentElement;
        html.setAttribute('lang', 'tr');

        const style = doc.createElement('style');
        style.textContent = `
            @page {
                size: ${g.W * .75}pt ${g.H * .75}pt;
                margin: 0;
            }
            html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                width: 100% !important;
                height: auto !important;
            }
            body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .uki-print-page {
                position: relative !important;
                width: ${g.W}px !important;
                height: ${g.H}px !important;
                max-width: ${g.W}px !important;
                max-height: ${g.H}px !important;
                overflow: hidden !important;
                page-break-after: always !important;
                break-after: page !important;
                background: #ffffff !important;
                margin: 0 auto !important;
                box-sizing: border-box !important;
            }
            .uki-print-page:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
            }
            .uki-print-page .a4-page {
                position: absolute !important;
                left: 0 !important;
                top: 0;
                margin: 0 !important;
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                width: ${g.W}px !important;
                min-height: 0 !important;
                height: auto !important;
                background-color: #ffffff !important;
                background-image: none !important;
            }
            .uki-print-page .pb-gap,
            .uki-print-page #watermark-layer,
            .uki-print-page .a4-watermark-layer,
            .uki-print-page .udf-watermark,
            .uki-print-page .watermark-text,
            .uki-print-page [id*="watermark"],
            .uki-print-page [class*="watermark"],
            .uki-print-page .e-sign-seal-badge,
            .uki-print-page .udf-seal-stamp,
            .uki-print-page .floating-seal-widget {
                display: none !important;
                visibility: hidden !important;
                background-image: none !important;
                opacity: 0 !important;
            }
            .uki-print-page .pb-qr {
                position: absolute !important;
                width: 67px !important;
                height: 67px !important;
                max-width: 67px !important;
                max-height: 67px !important;
                z-index: 10 !important;
                overflow: hidden !important;
            }
            .uki-print-page .pb-qr svg {
                width: 67px !important;
                height: 67px !important;
                max-width: 67px !important;
                max-height: 67px !important;
                display: block !important;
            }
        `;
        doc.head.appendChild(style);

        const frozen = window.UkiPrintSnapshot.snapshot(ed);
        for (let k = 0; k < n; k++) {
            const sheet = doc.createElement('div');
            sheet.className = 'uki-print-page';
            const clone = frozen.cloneNode(true);
            clone.removeAttribute('id');
            clone.removeAttribute('contenteditable');
            clone.removeAttribute('spellcheck');
            clone.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
            clone.querySelectorAll('[contenteditable]').forEach((e) => e.removeAttribute('contenteditable'));
            clone.style.top = '-' + (k * g.S) + 'px';
            clone.style.minHeight = '0';
            sheet.appendChild(clone);
            doc.body.appendChild(sheet);
        }
        return iframe;
    }

    function print() {
        if (busy) return;
        busy = true;
        let iframe = null;
        try {
            iframe = build();
        } catch (e) {
            console.error('Yazdırma hazırlığı başarısız, tarayıcı yazdırması kullanılıyor:', e);
        }
        if (!iframe) { busy = false; nativePrint(); return; }

        const cleanup = () => {
            setTimeout(() => {
                if (iframe && iframe.parentNode) iframe.remove();
                busy = false;
            }, 1000);
        };
        const w = iframe.contentWindow;
        w.addEventListener('afterprint', cleanup);
        // Görsellerin (antet, imza simgeleri) yüklenmesini bekle
        const imgs = Array.from(iframe.contentDocument.images);
        const ready = Promise.all(imgs.map((im) => (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; }))));
        ready.then(() => {
            // İframe stillerinin ve font düzeninin tam olarak yerleşmesi için kısa gecikme
            setTimeout(() => {
                try {
                    w.focus();
                    w.print();
                } catch (pe) {
                    console.error('Yazdırma penceresi açılamadı, yerel yazdırmaya dönülüyor:', pe);
                    nativePrint();
                }
                setTimeout(cleanup, 60000);
            }, 120);
        });
    }

    window.UkiPrint = { print, build };
    window.print = print;
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
            e.preventDefault();
            e.stopImmediatePropagation();
            print();
        }
    }, true);
})(window, document);
