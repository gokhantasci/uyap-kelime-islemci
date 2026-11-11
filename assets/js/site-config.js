/**
 * Site ayar dosyası — SEO / analitik / doğrulama kimlikleri BURADAN doldurulur.
 * Boş bırakılan değer hiçbir dış istek yapmaz ve sayfaya etiket eklenmez.
 *
 *   gtmId              : Google Tag Manager konteyner kimliği (örn. "GTM-XXXXXXX")
 *   ga4Id              : Google Analytics 4 ölçüm kimliği (örn. "G-XXXXXXXXXX"); gtmId doluysa kullanılmaz
 *   gscVerification    : Google Search Console doğrulama kodu (meta içeriği)
 *   yandexVerification : Yandex Webmaster doğrulama kodu
 *   bingVerification   : Bing Webmaster doğrulama kodu
 *   siteUrl            : Yayın adresi (kanonik bağlantı için; boşsa eklenmez)
 *   usagePingUrl       : Anonim kullanım sayacı adresi (boş = kapalı)
 */
window.UKI_SITE_CONFIG = {
    gtmId: "GTM-KPCCB5FP",
    ga4Id: "G-SBMKDHD5TF",
    gscVerification: "xwowJ-54FGSaD3bM95W5R7NaRCoGV9H-cdrW61tqXRw",
    yandexVerification: "8caed5072a495310",
    bingVerification: '',
    siteUrl: 'https://udf.657.com.tr/',
    dictionaryApiUrl: '', // GitHub Pages: doğrudan TDK; Docker: '/api/sozluk?kelime='
    usageDetailsUrl: 'https://657.com.tr/_657-servis/api/udf-kullanim',
    // Anonim kullanım sayacı (yalnızca araç anahtarı + rastgele kimlik gönderir, belge içeriği/adı asla).
    // Boş = kapalı, dışarıya istek yapılmaz.
    usagePingUrl: 'https://657.com.tr/_657-servis/api/hesaplama'
};
