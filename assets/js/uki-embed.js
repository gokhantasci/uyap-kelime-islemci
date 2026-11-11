/**
 * UYAP Kelime İşlemci (UKİ) - Herhangi Bir Siteden Belge Açma Kütüphanesi (Embed SDK)
 * Geliştirici: Gökhan TAŞÇI - Sakarya Yazı İşleri Müdürü (Sicil: 139329)
 * 
 * Bu kütüphane sayesinde herhangi bir web sitesi (Baro, Adliye, Hukuk Bürosu vb.)
 * tek satır kodla UDF veya PDF dosyalarını UYAP Web Editöründe açabilir.
 * 
 * Kullanım 1 (HTML Data Attribute):
 *     <a href="https://ornek.gov.tr/karar.udf" data-uki-open>Web Editörde Aç</a>
 * 
 * Kullanım 2 (JavaScript API):
 *     UkiEmbed.open('https://ornek.gov.tr/karar.udf');
 *     UkiEmbed.openModal('https://ornek.gov.tr/karar.udf');
 */

(function (window) {
    'use strict';

    // Editörün konuşlandığı ana URL (Varsayılan olarak udf.657.com.tr veya geçerli sunucu)
    const UKI_DEFAULT_HOST = (function () {
        if (window.location && window.location.origin) {
            // Eğer 657 alanındaysak doğrudan udf.657.com.tr kullan
            if (window.location.hostname.includes('657.com.tr')) {
                return 'https://udf.657.com.tr/';
            }
            // Eğer editörün kendi alanındaysak
            if (window.location.pathname.includes('index.html')) {
                return window.location.href.split('?')[0].split('#')[0];
            }
            return window.location.origin + window.location.pathname;
        }
        return 'https://udf.657.com.tr/';
    })();

    // Yalnızca http(s) adresleri kabul edilir (javascript:, data: vb. reddedilir)
    function isHttpUrl(u) {
        try {
            const p = new URL(String(u || ''), window.location.href);
            return p.protocol === 'http:' || p.protocol === 'https:';
        } catch (e) { return false; }
    }

    const UkiEmbed = {
        editorUrl: UKI_DEFAULT_HOST,

        /**
         * Verilen dosya URL'sini yeni sekmede UYAP Web Editöründe açar.
         * @param {string} fileUrl - Açılacak .udf veya .pdf dosyasının tam URL'si
         * @param {string} [title] - İsteğe bağlı belge başlığı
         */
        open: function (fileUrl, title) {
            if (!isHttpUrl(fileUrl)) return;
            const target = new URL(this.editorUrl, window.location.href);
            target.searchParams.set('linkac', fileUrl);
            if (title) target.searchParams.set('title', title);
            window.open(target.toString(), '_blank');
        },

        /**
         * Verilen dosya URL'sini mevcut sayfa üzerinde açılır şık bir modal (iframe) içinde açar.
         * @param {string} fileUrl - Açılacak dosya URL'si
         */
        openModal: function (fileUrl) {
            if (!isHttpUrl(fileUrl)) return;

            // Varsa eski modalı temizle
            const oldModal = document.getElementById('uki-embed-modal');
            if (oldModal) oldModal.remove();

            const backdrop = document.createElement('div');
            backdrop.id = 'uki-embed-modal';
            backdrop.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px);
                z-index: 999999; display: flex; align-items: center; justify-content: center;
                padding: 24px; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            `;

            const container = document.createElement('div');
            container.style.cssText = `
                width: 100%; max-width: 1200px; height: 92vh; background: #ffffff;
                border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                display: flex; flex-direction: column; overflow: hidden; border: 1px solid #cbd5e1;
            `;

            const header = document.createElement('div');
            header.style.cssText = `
                height: 44px; background: #1e40af; color: #ffffff; display: flex;
                align-items: center; justify-content: space-between; padding: 0 16px;
                font-size: 13px; font-weight: 600;
            `;
            header.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px; font-size: 11px;">UYAP Web</span>
                    <span class="uki-modal-title"></span>
                </div>
                <button id="uki-modal-close" style="background: none; border: none; color: #ffffff; font-size: 20px; cursor: pointer; line-height: 1;">&times;</button>
            `;

            // Dosya adı URL'den gelir: HTML olarak değil düz metin olarak yazılır
            header.querySelector('.uki-modal-title').textContent = fileUrl.split('/').pop().split('?')[0] || 'Döküman Görüntüleyici';

            const iframe = document.createElement('iframe');
            const target = new URL(this.editorUrl, window.location.href);
            target.searchParams.set('linkac', fileUrl);
            target.searchParams.set('embed', '1');
            iframe.src = target.toString();
            iframe.style.cssText = 'flex: 1; border: none; width: 100%; height: 100%;';

            container.appendChild(header);
            container.appendChild(iframe);
            backdrop.appendChild(container);
            document.body.appendChild(backdrop);

            header.querySelector('#uki-modal-close').addEventListener('click', () => backdrop.remove());
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) backdrop.remove();
            });
        },

        /**
         * Sayfadaki tüm [data-uki-open] veya [data-uki-editor] bağlantılarını otomatik bağlar.
         */
        autoBind: function () {
            document.querySelectorAll('[data-uki-open], [data-uki-editor]').forEach(el => {
                el.addEventListener('click', (e) => {
                    const href = el.getAttribute('href') || el.getAttribute('data-url');
                    if (href && !href.startsWith('#')) {
                        e.preventDefault();
                        if (el.getAttribute('data-mode') === 'modal') {
                            this.openModal(href);
                        } else {
                            this.open(href, el.getAttribute('data-title'));
                        }
                    }
                });
            });
        }
    };

    // Sayfa yüklendiğinde otomatik bağla
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UkiEmbed.autoBind());
    } else {
        UkiEmbed.autoBind();
    }

    window.UkiEmbed = UkiEmbed;

})(window);

