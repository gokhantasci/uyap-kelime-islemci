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
                size: 210mm 297mm;
                margin: 0;
            }
            html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                width: 210mm !important;
                height: auto !important;
            }
            body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .uki-print-page {
                position: relative !important;
                width: 210mm !important;
                height: 297mm !important;
                max-width: 210mm !important;
                max-height: 297mm !important;
                overflow: hidden !important;
                contain: strict !important;
                background: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box !important;
            }
            .uki-print-page + .uki-print-page {
                break-before: page !important;
                page-break-before: always !important;
            }
            .uki-print-page .a4-page {
                position: absolute !important;
                left: 0 !important;
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
            .uki-print-page .pb-header {
                font: 400 9.84pt 'Times New Roman', serif !important;
                color: #808080 !important;
                white-space: nowrap !important;
                border-bottom: none !important;
            }
            .uki-print-page .pb-header-left {
                white-space: nowrap !important;
                font-size: 9.84pt !important;
                font-weight: 700 !important;
            }
            .uki-print-page .pb-header-right {
                white-space: nowrap !important;
                font-size: 9.84pt !important;
                font-weight: 400 !important;
            }
            .uki-print-page .pb-header-right b {
                font-weight: 700 !important;
            }
            .uki-print-page .pb-header-right span {
                font-weight: 400 !important;
            }
            .uki-print-page .pb-qr,
            .pb-qr {
                position: absolute !important;
                width: 50.04pt !important;
                height: 50.04pt !important;
                max-width: 50.04pt !important;
                max-height: 50.04pt !important;
                right: 9.00pt !important;
                z-index: 10 !important;
                overflow: hidden !important;
            }
            .uki-print-page .pb-qr svg,
            .pb-qr svg {
                width: 50.04pt !important;
                height: 50.04pt !important;
                max-width: 50.04pt !important;
                max-height: 50.04pt !important;
                display: block !important;
            }
            .uki-print-page .pb-footer.pb-footer-text,
            .uki-print-page .pb-footer-text {
                position: absolute !important;
                font-family: 'Times New Roman', serif !important;
                font-size: 11pt !important;
                color: #333333 !important;
            }
            .uki-print-page .pb-footer.pb-notice,
            .uki-print-page .pb-notice {
                position: absolute !important;
                border-top: 0.96pt solid #000000 !important;
                padding-top: 2.8pt !important;
                font-family: 'Times New Roman', serif !important;
                font-size: 6.84pt !important;
                line-height: 1.1 !important;
                white-space: nowrap !important;
                color: #000000 !important;
                text-align: left !important;
                letter-spacing: normal !important;
            }
            .uki-print-page .pb-notice b,
            .uki-print-page .pb-notice .pb-copy-code {
                font-family: Consolas, 'Courier New', monospace !important;
                font-size: 9.84pt !important;
                font-weight: 400 !important;
                letter-spacing: normal !important;
            }
            .uki-print-page .pb-footer.pb-pagenum {
                font-family: Arial, sans-serif !important;
                font-size: 10.8pt !important;
                color: #000000 !important;
                text-align: right !important;
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
            // Ekrandaki e-imza rozeti arayüz öğesidir; masaüstü UYAP çıktısında yer almaz
            clone.querySelectorAll('.ude-page-seal-ribbon, .e-sign-seal-badge, .udf-seal-stamp').forEach((e) => e.remove());
            clone.style.setProperty('top', '-' + (k * g.S) + 'px', 'important');
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
