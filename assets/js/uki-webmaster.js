/**
 * UYAP Kelime İşlemci (UKİ) - SEO & Analitik Yöneticisi
 * Google Analytics (GA4), Search Console (GSC), Google Tag Manager (GTM) ve Yandex Webmaster desteği.
 * Değerler assets/js/site-config.js veya arayüzdeki modal üzerinden girilen localStorage ayarlarından okunur.
 */
(function (window, document) {
    'use strict';

    function getSetting(key, defVal) {
        try {
            const ls = localStorage.getItem('uki-wm-' + key);
            if (ls !== null && ls !== '') return ls;
        } catch (e) {}
        const cfg = window.UKI_SITE_CONFIG || {};
        return (cfg[key] !== undefined && cfg[key] !== null) ? cfg[key] : (defVal || '');
    }

    function setMeta(name, content) {
        const value = String(content || '').trim();
        if (!value) return;
        let meta = document.querySelector('meta[name="' + name + '"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = name;
            document.head.appendChild(meta);
        }
        meta.content = value;
    }

    const gsc = getSetting('gscVerification', '');
    const yandex = getSetting('yandexVerification', '');
    const bing = getSetting('bingVerification', '');
    const gtmId = getSetting('gtmId', '').toUpperCase().trim();
    const ga4Id = getSetting('ga4Id', '').toUpperCase().trim();
    const siteUrl = getSetting('siteUrl', 'https://udf.657.com.tr/').trim();

    if (gsc) setMeta('google-site-verification', gsc);
    if (yandex) setMeta('yandex-verification', yandex);
    if (bing) setMeta('msvalidate.01', bing);

    if (siteUrl && !document.querySelector('link[rel="canonical"]')) {
        const link = document.createElement('link');
        link.rel = 'canonical';
        link.href = siteUrl;
        document.head.appendChild(link);
    }

    // Yerel oturumlar ve belge parametresi taşıyan bağlantılar Google'a bildirilmez.
    const publicHost = window.location.hostname === 'udf.657.com.tr' || window.location.hostname.endsWith('github.io');
    const documentLink = /(?:linkac|load|url)=/i.test(window.location.search + window.location.pathname);

    if (publicHost && !documentLink) {
        window.dataLayer = window.dataLayer || [];

        if (/^GTM-[A-Z0-9]+$/.test(gtmId)) {
            window.dataLayer.push({
                'gtm.start': Date.now(),
                event: 'gtm.js',
                page_location: siteUrl || 'https://udf.657.com.tr/',
                page_title: 'UYAP Web Editörü'
            });
            const s = document.createElement('script');
            s.async = true;
            s.src = 'https://www.googletagmanager.com/gtm.js?id=' + gtmId;
            document.head.appendChild(s);
        } else if (/^G-[A-Z0-9]+$/.test(ga4Id)) {
            window.gtag = function () { window.dataLayer.push(arguments); };
            window.gtag('js', new Date());
            window.gtag('config', ga4Id, {
                anonymize_ip: true,
                page_location: siteUrl || 'https://udf.657.com.tr/',
                page_title: 'UYAP Web Editörü'
            });
            const s = document.createElement('script');
            s.async = true;
            s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ga4Id;
            document.head.appendChild(s);
        }
    }

    // Modal Arayüzü Fonksiyonları
    window.openWebmasterModal = function () {
        const modal = document.getElementById('modal-webmaster-setup');
        if (!modal) return;
        const gscIn = document.getElementById('input-wm-gsc');
        const yandexIn = document.getElementById('input-wm-yandex');
        const gtmIn = document.getElementById('input-wm-gtm');
        const ga4In = document.getElementById('input-wm-ga4');

        if (gscIn) gscIn.value = getSetting('gscVerification', '');
        if (yandexIn) yandexIn.value = getSetting('yandexVerification', '');
        if (gtmIn) gtmIn.value = getSetting('gtmId', '');
        if (ga4In) ga4In.value = getSetting('ga4Id', '');

        modal.style.display = 'flex';
    };

    window.saveWebmasterSettings = function () {
        const gscIn = document.getElementById('input-wm-gsc');
        const yandexIn = document.getElementById('input-wm-yandex');
        const gtmIn = document.getElementById('input-wm-gtm');
        const ga4In = document.getElementById('input-wm-ga4');

        if (gscIn) localStorage.setItem('uki-wm-gscVerification', gscIn.value.trim());
        if (yandexIn) localStorage.setItem('uki-wm-yandexVerification', yandexIn.value.trim());
        if (gtmIn) localStorage.setItem('uki-wm-gtmId', gtmIn.value.trim());
        if (ga4In) localStorage.setItem('uki-wm-ga4Id', ga4In.value.trim());

        const modal = document.getElementById('modal-webmaster-setup');
        if (modal) modal.style.display = 'none';

        if (typeof window.showToast === 'function') {
            window.showToast('Webmaster & Analitik ayarları kaydedildi (Yenilemede aktifleşir).', 'success');
        }
    };
})(window, document);
