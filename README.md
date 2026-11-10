# UYAP Web Kelime İşlemci (UDF Web Editor)

Adalet Bakanlığı UYAP sistemi tarafından kullanılan `.udf` (UYAP Doküman Formatı) dosyalarını tarayıcı üzerinden doğrudan açmaya, düzenlemeye ve tekrar standart UDF olarak kaydetmeye yarayan açık kaynaklı web uygulaması.

Herhangi bir Java kurulumu gerektirmez, tamamen istemci tarafında (tarayıcınızda) çalışır ve GitHub Pages üzerinden ücretsiz olarak yayınlanabilir.

---

## 🌟 Temel Özellikler

- **Kurulumsuz & Sıfır Bağımlılık:** Java JRE veya yerel yazılım kurmaya gerek yoktur. Chrome, Firefox, Edge ve Safari gibi modern tarayıcılarda çalışır.
- **%100 Yerel ve Güvenli:** Dosyalarınız hiçbir sunucuya yüklenmez; tüm açma, biçimlendirme ve UDF oluşturma işlemleri tarayıcınızın belleğinde gerçekleşir.
- **Sürükle & Bırak Desteği:** Masaüstünüzdeki `.udf` dosyasını tarayıcı penceresine sürükleyip bırakarak anında görüntüleyebilirsiniz.
- **Zengin Metin Editörü:**
  - Yazı tipi (Times New Roman, Arial, Calibri vb.) ve punto boyutları
  - Kalın, İtalik, Altı Çizili, Üstü Çizili ve metin renkleri
  - Paragraf hizalama (Sola, Ortala, Sağa, İki Yana Yasla) ve girinti ayarları
  - Tablo ekleme, hücre düzenleme ve sayfa sonu desteği
- **UDF Formatında İndirme:** Düzenlenen içeriği standart UYAP XML şemasıyla paketleyip doğrudan `.udf` dosyası olarak kaydeder.
- **Yazdır & PDF Desteği:** A4 sayfa düzeni koruyarak doğrudan PDF veya fiziksel yazıcı çıktısı alabilirsiniz.
- **Sanal "Print to UDF" Yazıcısı:** Windows, macOS ve Linux'ta herhangi bir uygulamadan (Word, Chrome vb.) doğrudan UDF olarak çıktı almanızı sağlayan tek dosya sanal yazıcı aracı (`print_to_udf.py`).

---

## 🖨️ "UYAP'a Yazdır" - Evrensel Sistem Sanal Yazıcısı ve Dosya Çevirici

Bu araç yalnızca bir PDF çevirici değildir; **bilgisayarınızdaki herhangi bir programdan yazdırılabilir olan HER ŞEYİ doğrudan UDF formatına dönüştürür**.

### 1. Herhangi Bir Programdan Yazdırma (Ctrl+P / Cmd+P)
Sisteme tek komutla gerçek bir sanal yazıcı eklenir:
```bash
python print_to_udf.py --install
```
Kurulum tamamlandıktan sonra:
* **Google Chrome / Microsoft Edge:** Herhangi bir web sayfasında, e-Devlet belgesinde veya e-Postada `Ctrl + P` yapıp yazıcı olarak **"UYAP'a Yazdır (Print to UDF)"** seçin -> Otomatik olarak masaüstünüze `.udf` dosyası oluşturulur.
* **Microsoft Word / LibreOffice:** Düzenlediğiniz belgeyi `Ctrl + P` ile doğrudan UDF olarak yazdırın.
* **Microsoft Excel / Muhasebe / ERP:** Tablolar ve faturalar doğrudan UYAP Tablosu (`<table border="borderCell">`) olarak UDF'e aktarılır.
* **Notepad / Metin Editörü:** Tüm metinler UYAP paragrafları olarak mizanpajı korunarak basılır.

### 2. Doğrudan Dosya Dönüştürme Desteği
Herhangi bir dosyayı doğrudan komut satırından veya grafik arayüzden UDF'e çevirebilirsiniz:
```bash
# Herhangi bir dosyayı doğrudan UDF'e dönüştürme:
python print_to_udf.py dilekce.docx          # Word -> UDF
python print_to_udf.py hesap_tablosu.xlsx     # Excel -> UDF Tablo
python print_to_udf.py karar.pdf             # PDF -> UDF
python print_to_udf.py mevzuat.html          # HTML -> UDF
python print_to_udf.py notlar.txt            # Metin -> UDF

# Grafik Kullanıcı Arayüzünü (GUI) Açma:
python print_to_udf.py --gui

# Arka Plan Yazdırma Servisini Başlatma (Ctrl+P ile gelen işleri yakalar):
python print_to_udf.py --daemon
```

### 3. İşletim Sistemi Entegrasyonları
* **Windows:** 
  * Windows Yazıcılar listesine `"UYAP'a Yazdır (Print to UDF)"` sistem yazıcısı eklenir.
  * Dosya Gezgini'nde herhangi bir dosyaya sağ tık -> **Gönder (Send To) > UYAP'a Yazdır** ile tek tıkla UDF üretilir.
  * Windows Başlangıcına eklenen arka plan izleyicisi sayesinde bilgisayar açıldığında yazdırma işleri sessizce yakalanır.
* **macOS:** 
  * `~/Library/PDF Services/` entegrasyonu ile Mac üzerindeki TÜM uygulamaların `Cmd + P` yazdırma penceresinde sol alttaki **PDF > UYAP'a Yazdır** menüsünde görünür.
* **Linux (CUPS):** 
  * CUPS sanal yazıcı backend'i olarak sisteme eklenir ve sistem genelindeki yazdırma diyaloglarında standart yazıcı olarak listelenir.

---

## 🚀 Yerel Olarak Çalıştırma

Proje tamamen statik dosyalardan oluşur:

1. Bu depoyu indirin veya klonlayın.
2. `index.html` dosyasını çift tıklayarak tarayıcınızda açın.
3. Veya yerel bir HTTP sunucusu başlatın:
   ```bash
   python -m http.server 8000
   ```
   Ardından tarayıcınızda `http://localhost:8000` adresine gidin.

---

## 🌐 GitHub Pages ile Yayınlama

Projeyi kendi GitHub hesabınızda yayınlamak için:

1. GitHub'da yeni bir genel (public) depo oluşturun.
2. Kodları depoya yükleyin:
   ```bash
   git init
   git add .
   git commit -m "İlk sürüm: UYAP Web Editörü"
   git branch -M main
   git remote add origin https://github.com/KULLANICI_ADINIZ/REPO_ADINIZ.git
   git push -u origin main
   ```
3. Deponuzun **Settings > Pages** sekmesine gidin.
4. **Build and deployment > Source** seçeneğini **GitHub Actions** veya `main` dalı olarak seçin.
5. Birkaç saniye içinde `https://KULLANICI_ADINIZ.github.io/REPO_ADINIZ/` adresinden yayınlanacaktır.

---

## 📂 Proje Yapısı

```
├── index.html                   # Ana web arayüzü ve editör sayfası
├── assets/
│   ├── css/
│   │   └── style.css            # A4 sayfa düzeni, araç çubuğu ve yazdırma stilleri
│   ├── js/
│   │   ├── uki-core.js          # UDF (ZIP/XML) ayrıştırma ve üretme çekirdeği
│   │   ├── uki-editor.js        # WYSIWYG düzenleme ve biçimlendirme motoru
│   │   └── app.js               # Arayüz kontrolleri, dosya yönetimi ve eylemler
│   └── vendor/
│       └── jszip.min.js         # Çevrimdışı ZIP okuma ve yazma kütüphanesi
├── .github/
│   └── workflows/
│       └── deploy.yml           # Otomatik GitHub Pages dağıtım iş akışı
├── UYAP_KAYNAKLAR_VE_YOL_HARITASI.md # Teknik analiz ve format inceleme dokümantasyonu
└── README.md
```

---

## ⚖️ Lisans

Bu proje MIT Lisansı altında sunulmaktadır.

