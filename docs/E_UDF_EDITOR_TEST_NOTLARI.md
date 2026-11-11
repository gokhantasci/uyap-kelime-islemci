# editor.e-udf.com (v3.1.0) – Ücretsiz Fonksiyon Test Notları

Test tarihi: 2026-11-11 · Oturum açmadan, boş belge ile denendi.

## Menü yapısı (gözlenen)
| Menü | Öğeler |
|---|---|
| Üst şerit | Kaydet, Yazdır, Geri al / İleri al |
| Dosya | Yeni belge, Belge asistanı ile yeni belge, Belge Aç (Cihazdan / Google Drive / e-UDF-Tools / Yedeklerden), Yeniden adlandır, Son Açılanlar, Belgeyi indir, Yazdır |
| İmzala | Mobil İmza, e-İmza (USB Token) |
| Diğer | **Paragraf biçimlendirmesi**, Otomatik kaydetme, Yazım denetimi aç/kapat, Zoom, Cetveli gizle, Tam ekran |
| Yardım | Duyurular, Hata & Öneri Bildir, Hakkımızda |
| Araç çubuğu | Yazı tipi/boyut, B/I/U, yazı rengi, biçim boyacısı, biçim temizle, BÜYÜK/küçük, üst/alt simge, 4 hizalama, satır aralığı, madde/numara listesi, girinti ±, görsel ekle, sayfa numarası/üstbilgi, sayfa sonu, yazım denetimi, tam ekran, **Sesli Oku** |
| Başlangıç | Açılışta "Duyurular" penceresi ("tekrar gösterme" kutusu) + belge açma seçici |

## Paragraf Özellikleri penceresi
Sol girinti, Paragraf (ilk satır), Satır başı, Satır sonu (cm); hizalama (4); **sekme durakları** ekle/sıfırla; "Hazır paragraf ayarları"; Sıfırla / Kaydet.

## Bizde olması gerekenler (çıkarımlar)
1. Açılış duyurusu + "bir daha gösterme" → **var** (sürüm duyurusu belgesi).
2. Paragraf özellikleri penceresi (sekme durakları dahil) → eksik/yetersiz, eklenecek.
3. Sesli Oku (Web Speech API `speechSynthesis`, tr-TR) → eklenecek.
4. Yazım denetimi aç/kapat (`spellcheck` niteliği) → eklenecek.
5. Otomatik kaydet (localStorage) + "Yedeklerden aç" → eklenecek.
6. Son açılanlar listesi → eklenecek.
7. Sayfa numarası / sayfa sonu araçları → sayfalama ile birlikte.
8. Cetvel gizle/göster, tam ekran → eklenecek.
9. Google Drive / mobil imza / USB token: sunucu veya cihaz gerektirir, kapsam dışı.
