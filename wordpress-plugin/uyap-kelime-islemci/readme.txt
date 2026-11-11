=== UYAP Kelime İşlemci (Web UDF) ===
Contributors: gokhantasci
Tags: uyap, udf, editor, viewer, legal, law, turkish
Requires at least: 5.0
Tested up to: 6.7
Stable tag: 2.6.0
License: MIT
License URI: https://opensource.org/licenses/MIT

WordPress sitenize tek satırla UYAP UDF doküman görüntüleyici ve düzenleyici ekler.

== Description ==

UYAP Kelime İşlemci (UKİ), Türkiye Cumhuriyeti Adalet Bakanlığı UYAP sisteminde kullanılan `.udf` (UDF - Uyap Document Format) ve `.docx` belgelerini doğrudan web tarayıcısında açma, düzenleme, yazdırma ve UDF olarak kaydetme imkanı sağlayan istemci taraflı gelişmiş bir kelime işlemcidir.

Hiçbir belge harici sunucuya iletilmez; tüm çözümleme ve dışa aktarma işlemleri kullanıcının tarayıcısında %100 çevrimdışı ve güvenli gerçekleşir.

== Shortcodes ==

* `[uyap_editor]` - Standart UYAP düzenleyiciyi sayfaya yerleştirir.
* `[uyap_viewer src="URL"]` - Belirtilen UDF belgesini salt okunur görüntüler.

== Installation ==

1. `uyap-kelime-islemci` klasörünü `/wp-content/plugins/` dizinine yükleyin.
2. WordPress yönetim panelinde 'Eklentiler' menüsünden eklentiyi etkinleştirin.
3. Yazı veya sayfanıza `[uyap_editor]` veya `[uyap_viewer src="..."]` kısa kodunu ekleyin.

