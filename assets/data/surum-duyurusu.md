# SÜRÜM YENİLİKLERİ VE GELİŞTİRME GEÇMİŞİ

GELİŞTİRİCİ	: Gökhan TAŞÇI
GÖREVİ	: Sakarya Yazı İşleri Müdürü (Sicil No: 139329)
SÜRÜM	: v2.7.0 – 12 Kasım 2026
DAĞITIM	: Tek sayfalık, sunucusuz web uygulaması (GitHub Pages & udf.657.com.tr)

## BU SÜRÜMDE YENİ OLANLAR (v2.7.0)
1. **Masaüstü UYAP ile ölçülmüş yazdırma/PDF paritesi**: Örnek karar, masaüstü UYAP Doküman Editörü'nün PDF çıktısıyla satır satır karşılaştırıldı; etiket/değer sütunu, üst kenar, doğrulama satırı, sayfa numarası, üst bilgi, tablo boşlukları ve imza bloğu hizalandı (3 sayfada satır kırılma farkı yok).
2. **UDF dosya uyumu**: Paragraf sonu satır sonu karakteri biçimi taşır, resim boyutları UDF'de pt olarak yazılıp okunur (resmî editörde doğrulandı), barkod ölçüsü ve boş satır arka planı masaüstüyle aynı, başlık yazı stili dosyadan korunur.
3. **Hukuki bölüm gezgini (Belge Taslağı)**: İddia, Savunma, Beyanlar, Deliller, Gerekçe, Hukuki Nitelendirme, Hüküm, Kanun Yolu, Mütalaa, bilirkişi raporu ve dava/cevap/istinaf dilekçesi bölümlerini adli ve idari yargı kararlarında otomatik listeler (idari başlıklar Danıştay Karar Yazım Rehberi'nden).
4. **Hukuk Asistanı analizcisi**: Hüküm fıkraları madde madde sınıflanır (beraat, ceza verilmesine yer olmadığına, HAGB, mahkumiyet, kabul/ret/iptal, görevsizlik, gider); kanun yolu belgenin kendi fıkrasından okunur ve kanundaki süreyle çelişirse uyarı verilir; eğitim örnekleri 8'e çıktı.
5. **E-imzalı belge salt okunur açılır**: Resmî editördeki gibi uyarı bandı ve "Düzenlemeyi Etkinleştir" düğmesi; düzenleme imzaları kaldırır.
6. **E-İmza ile imzalama**: Bilgisayarınızdaki Adalet E-İmza uygulamasına yerel olarak bağlanır (sertifika seçimi, PIN); belge ve PIN hiçbir sunucuya gönderilmez. Uygulama yoksa indirme bağlantısı ve kurulum yönergesi gösterilir.
7. **Piper TTS tarayıcıda**: Sesli okuma, 657.com.tr'deki Fahrettin ses modeliyle tarayıcıda çalışır (ilk kullanımda ~63 MB, sonra önbellekten). WebGPU yapay zeka modeli de 657.com.tr'den indirilir.
8. **Canlı hukuk sözlüğü**: 657.com.tr sözlük verisi canlı çekilir, 12 saat önbelleğe alınır; çevrimdışıyken paketli kopya kullanılır.
9. **Pencereler taşınabilir**: Tüm pencereler başlığından sürüklenir, son konum tarayıcıda hatırlanır. Renk paleti 25+ renk, özel renk ve son kullanılanlarla geliştirildi; sayfa ve tuval rengi artık belgeye uygulanır.
10. **Sadeleşen arayüz**: Düzenle ve Biçim menüleri eklendi (resmî sıra), ikincil eylemler "Daha Fazla" altında, menülerde kaydırma çubuğu yok, araç çubuğu taşmaları giderildi.
11. **Hata düzeltmeleri**: Karşılaştır ve Sürüm Geçmişi pencereleri açılıyor; resim seçim kutusu belge sonuna kaymıyor; OCR gerçek hata mesajını gösterir ve küçültülmüş görselle yeniden dener; barkod ve UDF öznitelikleri güvenli kaçışlanır.

## ÖNCEKİ SÜRÜM (v2.6.0)
• Belge karşılaştırma (UkiDiff), sürüm geçmişi (UkiVersions), slash menüsü, Zen modu, belge başlık gezgini, metin genişletici, adli dil denetimi, KVKK maskeleme ve resmî UYAP e-imza detayları.

## ÖNCEKİ ÇALIŞMALAR
• Gerçek sayfalama (A4), sekme (TabSet) durakları, UDF 1.8 kaydetme/okuma, Word (.docx) ve ODT desteği.
• Karanlık/aydınlık tema, 20'den fazla UYAP yazı tipi, resmî UYAP kısayolları.
• uki-embed.js: web sitelerinde hafif UDF editörü ve görüntüleyicisi olarak tek satır script ile yerleştirme.

## BİLİNEN SINIRLAR
• E-imza ile imzalama için bilgisayarda Adalet E-İmza uygulaması çalışıyor olmalıdır; imzalama istemcisi gerçek kartla bu sürümde test edilmedi. Mobil imza desteklenmez.
• Ema Lightning ses motoru için tarayıcıda çalışan bir sürüm henüz yayınlanmadı.
• Belge içeriği değiştirildiğinde kriptografik e-imza bütünlüğü bozulacağı için imzalı belgeler önce salt okunur açılır.

Gökhan TAŞÇI
Sakarya Yazı İşleri Müdürü – 139329
