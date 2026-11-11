/**
 * UYAP Kelime İşlemci (UKİ) - 1 Satırda Sitene Gömme Kütüphanesi (Embed SDK)
 * Kullanım:
 * <script src="https://udf.657.com.tr/embed.js" data-mode="editor" data-src="..."></script>
 * veya
 * window.UkiEmbed.create({ container: '#my-div', mode: 'editor', src: '...' });
 */
(function(window, document) {
    'use strict';

    const BASE_HOST = 'https://udf.657.com.tr';

    const UkiEmbed = {
        create(options = {}) {
            const container = typeof options.container === 'string' ? document.querySelector(options.container) : options.container;
            if (!container) return null;

            const mode = options.mode || 'editor';
            const src = options.src || '';
            const theme = options.theme || 'light';
            const width = options.width || '100%';
            const height = options.height || '700px';

            const iframe = document.createElement('iframe');
            const query = new URLSearchParams();
            query.set('mode', mode);
            if (src) query.set('src', src);
            if (theme) query.set('theme', theme);

            iframe.src = BASE_HOST + '/embed.html?' + query.toString();
            iframe.style.width = width;
            iframe.style.height = height;
            iframe.style.border = '1px solid #cbd5e1';
            iframe.style.borderRadius = '8px';
            iframe.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.setAttribute('loading', 'lazy');

            container.appendChild(iframe);
            return iframe;
        },

        autoInit() {
            const scripts = document.querySelectorAll('script[src*="embed.js"]');
            scripts.forEach(s => {
                if (s.getAttribute('data-loaded')) return;
                s.setAttribute('data-loaded', 'true');

                const mode = s.getAttribute('data-mode') || 'editor';
                const src = s.getAttribute('data-src') || '';
                const theme = s.getAttribute('data-theme') || 'light';
                const width = s.getAttribute('data-width') || '100%';
                const height = s.getAttribute('data-height') || '700px';

                const targetId = s.getAttribute('data-target');
                let targetEl = targetId ? document.querySelector(targetId) : null;

                if (!targetEl) {
                    targetEl = document.createElement('div');
                    targetEl.className = 'uki-embed-wrapper';
                    s.parentNode.insertBefore(targetEl, s.nextSibling);
                }

                UkiEmbed.create({
                    container: targetEl,
                    mode,
                    src,
                    theme,
                    width,
                    height
                });
            });
        }
    };

    window.UkiEmbed = UkiEmbed;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', UkiEmbed.autoInit);
    } else {
        UkiEmbed.autoInit();
    }
})(window, document);

