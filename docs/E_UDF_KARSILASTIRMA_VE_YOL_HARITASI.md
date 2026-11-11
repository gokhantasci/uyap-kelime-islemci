# e-UDF Editörü (v3.1.0) Karşılaştırması ve Yol Haritası

Tarih: 2026-11-11 · Yöntem: editor.e-udf.com'da oturum açmadan tüm menü ve araç çubuğu düğmeleri tek tek tıklandı.

## 1. e-UDF'de gözlenenler

**Araç çubuğu (sırayla):** geri/ileri · yazı tipi (9 font) · boyut (8–36 pt) · kalın/italik/altı çizili · yazı rengi (RGB) · vurgu rengi (RGB) · biçimi temizle · harf durumu (Tümü Küçük / Tümü Büyük / Baş Harfler Büyük) · üst simge / alt simge · 4 hizalama · satır aralığı (1.00–3.00) · madde işareti (7 stil) · numaralandırma (1. / 1- / 1) / I. …) · girinti ± · görsel ekle · **Sayfa Numarası** (göster/gizle, sol/orta/sağ, kalın, italik, yazı tipi, boyut) · **Sayfa Ayarları** (üst/sol/sağ/alt cm, üst yazı, tüm sayfalarda/ilk sayfada göster) · yazım denetimi · genişlet: yakınlaştırma, tam ekran, **Sesli Oku**.

**Menüler:** Dosya (yeni, belge asistanı, cihazdan/Drive/e-UDF-Tools/yedekten aç, yeniden adlandır, son açılanlar, indir, yazdır) · İmzala (mobil imza, USB e-imza) · Diğer (paragraf biçimlendirme + sekme durakları, otomatik kaydet, yazım denetimi, zoom, cetvel gizle, tam ekran) · Yardım (duyurular, hata/öneri bildir, hakkımızda).

**Belge Asistanı:** sol yan panel, "Deneysel özellik". 3 hazır şablon (Mazeret Dilekçesi, Soruşturma Dosyasını Fiziken İnceleme, UYAP Dosya İnceleme Talebi). Form alanları gruplu (Belgeyi Düzenleyen / Dosya Bilgileri / Diğer Alanlar); belgede `{ad}`, `{dosyano}` gibi yer tutucular **turuncu vurguyla canlı** görünür, yazdıkça dolar, "Bitir" ile kapanır.

## 2. Bizde karşılığı (kod taramasıyla)

| e-UDF özelliği | Bizde | Yapılacak |
|---|---|---|
| Şablon sihirbazı | Var (modal, atlanabilir) | **Yan panel + canlı yer tutucu vurgusu**; alan grupları; kendi şablonunu kaydetme |
| Sayfa ayarları | Var | Sayfa no ayarları (konum, kalın, italik) |
| Sayfa numarası | Sayfalamada otomatik "1/3" | Ayar penceresi, sol/orta/sağ |
| Paragraf + sekme durağı | Pencere var, sekme motoru yeni | Pencerede durak düzenleme sınaması |
| Üst/alt simge, harf durumu, renk, vurgu | Doğrulanmadı (komut kodu yok) | Eklenecek |
| Madde işareti / numaralandırma stilleri | Yok (`insertUnorderedList` kodu yok) | Eklenecek |
| Görsel ekleme | Yok | Eklenecek (UDF'de `<image>` + base64 sınaması) |
| Yazım denetimi aç/kapat | Yok | `spellcheck` niteliği |
| **Sesli Oku** | Yok | Bölüm 3 |
| Otomatik kaydet, son açılanlar, yedekten aç | Yok | `localStorage` + IndexedDB |
| Yeniden adlandır, tam ekran | Kısmen | Tamamla |
| İmza (mobil / USB) | Yok | **Kapsam dışı** (sunucu/cihaz gerekir) |
| Google Drive açma | Yok | Kapsam dışı (OAuth gerekir) |

Bizde olup e-UDF'de olmayanlar (güçlü yanlar): gerçek sayfalama + sayfa önizleme, e-imza görüntüleme, antet/avukat antet hazırlayıcı, Word indirme, sanal "UDF'ye yazdır", gömme kütüphanesi (`?load=`), koyu tema, 20+ UYAP fontu.

## 3. Sesli Oku (Piper ve EMA Lightning)

Araştırma bulguları (ikincil kaynaklara dayanır, kullanmadan önce resmî model kartları okunmalı):

- **EMA Lightning:** Türkçe'ye özel, tek ses, ~8,6 M parametre, ~34 MB, Apache-2.0; `pip install ema-lightning`. Core ML dönüşümü var (Apple). **Tarayıcıda çalışan ONNX/WASM sürümü doğrulanmadı.**
- **Piper:** ONNX modelleri tarayıcıda `onnxruntime-web` + espeak fonemleştirici ile çalışabilir (`piper-tts-web` paketleri). Türkçe sesler var ancak biri (dfki) **CC BY-NC-SA** (ticari kullanım yasak), bir diğeri Hugging Face'te kayıt/izin ister. **Lisans seçilen sese göre ayrıca doğrulanmalı.**

Önerilen katmanlı tasarım (kullanıcı hangisini seçerse ona düşer, hepsi isteğe bağlı):
1. **Tarayıcı sesi** (`speechSynthesis`, tr-TR): sıfır indirme, hemen çalışır. Varsayılan.
2. **Piper (tarayıcıda)**: ilk kullanımda ~60 MB model indirilip IndexedDB'de önbelleğe alınır; çevrimdışı çalışır. Lisansı uygun Türkçe ses seçilecek.
3. **EMA Lightning (yerel yardımcı)**: `print_to_udf.py` gibi tek dosyalı Python programı `localhost`'ta dinler; web arayüzü metni gönderip WAV alır. Tarayıcı sürümü yayımlanırsa 2'ye taşınır.

Arayüz: oynat/duraklat/durdur, hız, ses seçimi, **seçili metni oku** (seçim yoksa imlecin olduğu paragraftan), okunan paragrafı vurgulama. Metin kaynağı: sayfa üst/alt bilgisi ve boşluk elemanları hariç gövde.

## 4. Öncelik sırası

1. UYAP masaüstünde UDF açma sınaması (kullanıcı) — her şeyin önünde.
2. Biçimlendirme eksikleri: üst/alt simge, renk, vurgu, harf durumu, listeler (e-UDF paritesi).
3. Belge Asistanı v2: yan panel, canlı yer tutucu, alan grupları; şablon kütüphanesi (UYAP Dosya İnceleme, Mazeret, Fiziken İnceleme + mevcut tahliye/işçi alacağı).
4. Sesli Oku katman 1, sonra 2–3.
5. Sayfa numarası ayarları, görsel ekleme, otomatik kaydet/son açılanlar, yazım denetimi.
