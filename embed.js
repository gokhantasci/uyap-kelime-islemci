/**
 * UYAP Kelime İşlemci (UKİ) - 1 Satırda Sitene Gömme Kütüphanesi (Embed SDK)
 * Kullanım:
 * <script src="https://udf.657.com.tr/embed.js" data-mode="editor" data-src="..."></script>
 * veya
 * window.UkiEmbed.create({ container: '#my-div', mode: 'editor', src: '...' });
 */
(function(window, document) {
    'use strict';

    function resolveBaseHost() {
        let script = document.currentScript;
        if (!script) {
            const scripts = document.querySelectorAll('script[src*="embed.js"]');
            if (scripts.length > 0) script = scripts[scripts.length - 1];
        }
        if (script && script.src) {
            try {
                const u = new URL(script.src, window.location.href);
                return u.origin;
            } catch (e) {}
        }
        return 'https://udf.657.com.tr';
    }

    const UkiEmbed = {
        create(options = {}) {
            let container = typeof options.container === 'string' ? document.querySelector(options.container) : options.container;
            
            // Eğer container bulunamazsa veya belirtilmemişse body'e ekle
            if (!container) {
                container = document.createElement('div');
                container.className = 'uki-embed-wrapper';
                if (document.body) {
                    document.body.appendChild(container);
                } else {
                    document.addEventListener('DOMContentLoaded', () => {
                        document.body.appendChild(container);
                    });
                }
            }

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

            const baseHost = resolveBaseHost();
            iframe.src = baseHost + '/embed.html?' + query.toString();
            iframe.style.width = width;
            iframe.style.maxWidth = '100%';
            iframe.style.height = height;
            iframe.style.border = '1px solid #cbd5e1';
            iframe.style.borderRadius = '8px';
            iframe.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
            iframe.style.display = 'block';
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
                    targetEl.style.width = width;
                    targetEl.style.maxWidth = '100%';
                    targetEl.style.marginBottom = '24px';

                    // <head> içine iframe eklenmesini engelle
                    const parent = s.parentNode;
                    const inHead = !parent || parent.tagName === 'HEAD' || (s.closest && s.closest('head'));

                    if (inHead) {
                        if (document.body) {
                            document.body.appendChild(targetEl);
                        } else {
                            document.addEventListener('DOMContentLoaded', () => {
                                document.body.appendChild(targetEl);
                            });
                        }
                    } else {
                        parent.insertBefore(targetEl, s.nextSibling);
                    }
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
