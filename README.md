# UYAP Web Kelime İşlemci (UDF Web Editor)

Adalet Bakanlığı UYAP sistemi tarafından kullanılan `.udf` (UYAP Doküman Formatı) dosyalarını tarayıcı üzerinden doğrudan açmaya, düzenlemeye ve tekrar standart UDF olarak kaydetmeye yarayan açık kaynaklı web uygulaması ve evrensel dönüştürücü ekosistemi.

Herhangi bir Java kurulumu gerektirmez, tamamen istemci tarafında (tarayıcınızda) çalışır, GitHub Pages üzerinden ücretsiz olarak yayınlanabilir, tek komutla PowerShell veya Docker ile kurulup çalıştırılabilir.

---

## ⚡ Hızlı Başlangıç: Tek Komutla Kurulum ve Çalıştırma

### 1. Windows PowerShell ile Tek Komutla Kurulum

Aşağıdaki komutla tüm sistemi (Masaüstü kısayolları, Dosya Gezgini sağ tık menüleri, terminal `udf` komutları ve sanal yazıcıyı) saniyeler içinde otomatik kurabilirsiniz:

```powershell
# Yerel depodan çalıştırma:
powershell -ExecutionPolicy Bypass -File .\install.ps1

# Veya tek satırda doğrudan internet üzerinden kurulum:
irm https://raw.githubusercontent.com/uyap-editor/uyap-kelime-islemci/master/install.ps1 | iex
```

**Kurulum neleri kapsar?**
* **Masaüstü & Başlat Menüsü:** Tek tıkla açılan "UYAP Kelime İşlemci" web editörü kısayolu.
* **Sağ Tık Menü Entegrasyonu:** Windows Gezgini'nde herhangi bir `.pdf`, `.docx`, `.md`, `.txt`, `.png`, `.jpg` dosyasına sağ tıklayıp **"UDF'e Dönüştür (Print to UDF)"** seçebilirsiniz.
* **.UDF Dosya Entegrasyonu:** `.udf` dosyalarına sağ tıklayıp **"UYAP Editöründe Aç"** seçeneği.
* **Windows 'Gönder (SendTo)' Menüsü:** Dosyaları doğrudan sanal yazıcıya gönderebilme.
* **Terminalden Evrensel `udf` Komutu:** PowerShell, CMD ve Windows Terminal'de herhangi bir klasörden doğrudan `udf dosya.pdf` çalıştırabilme.
* **Sanal Yazıcı (Print to UDF):** Yönetici olarak çalıştırıldığında sistem yazıcılarına *"UYAP'a Yazdır (Print to UDF)"* aygıtını ekler.
* **Temiz Kaldırma:** Dilediğiniz zaman `.\uninstall.ps1` veya `.\install.ps1 -Uninstall` ile tüm sistem kayıtlarını tek hamlede geri alabilirsiniz.

---

### 2. Docker ile Tek Komutla Mikroservis & Web Editörü

Hem modern web editörünü hem de arka plan dönüştürme API'sini Docker ile tek komutta ayağa kaldırabilirsiniz:

```bash
# Docker Compose ile tek komutla başlatma:
docker compose up -d

# Veya Docker CLI ile doğrudan çalıştırma:
docker run -d --name uyap-editor -p 8080:8080 uyap-kelime-islemci:latest
```

Artık tarayıcınızdan:
* **Web Editörü:** `http://localhost:8080`
* **Sağlık Denetimi (Healthcheck):** `http://localhost:8080/api/health`
* **Headless REST API Uç Noktası:** `http://localhost:8080/api/convert`

#### cURL ile REST API Dönüştürme Örnekleri:
```bash
# PDF dosyasını UDF'e dönüştür ve indir:
curl -X POST "http://localhost:8080/api/convert?filename=karar.pdf" \
     --data-binary "@karar.pdf" \
     -o "karar.udf"

# UDF dosyasını Markdown (.md) formatına dönüştür:
curl -X POST "http://localhost:8080/api/convert?filename=karar.udf&format=md" \
     --data-binary "@karar.udf" \
     -o "karar.md"
```

---

## 🌟 Temel Özellikler

- **Kurulumsuz & Sıfır Bağımlılık:** Java JRE veya yerel yazılım kurmaya gerek yoktur. Chrome, Firefox, Edge ve Safari gibi modern tarayıcılarda çalışır.
- **🤖 Tarayıcı İçi Yapay Zeka & WebGPU Hukuk Asistanı (`Alt+A`):** Tarayıcıda yerleşik yapay zeka (Chrome Prompt API / Gemini Nano) veya WebGPU donanım hızlandırması ile açılan belgeyi otomatik okur; *"Bu belge ne hakkında, davanın konusu nedir, mahkeme ne karar verdi, kanun yolu ve istinaf süresi ne kadar?"* sorularını yanıtlar, belgeye ilişkin serbest sorular sormanıza olanak tanır (%100 yerel ve gizli).
- **%100 Yerel ve Gizlilik Güvencesi:** Dosyalarınız hiçbir sunucuya yüklenmez veya aktarılmaz; tüm açma, biçimlendirme, e-imza denetimi ve UDF/Word oluşturma işlemleri doğrudan tarayıcınızın kendi belleğinde yerel olarak gerçekleşir.
- **Doğrudan Bağlantı ile UDF Açma (`linkac=URL.udf`):** Herhangi bir web sitesinden, portaldan veya `657.com.tr`'den `webeditor.657.com.tr/linkac=URL.udf` veya `?linkac=URL` bağlantısıyla dokümanlar doğrudan editörde açılabilir.
- **657astro Sayaç ve İstatistik Takibi:** Açılan evrak sayısı, toplam okunan kelime, karakter, satır ve indirilen döküman istatistikleri tutulur; anonim kullanım darbesi iletilir.
- **Sürükle & Bırak Desteği:** Masaüstünüzdeki `.udf` dosyasını tarayıcı penceresine sürükleyip bırakarak anında görüntüleyebilirsiniz.
- **Zengin Metin Editörü:**
  - Yazı tipi (Times New Roman, Arial, Calibri vb.) ve punto boyutları
  - Kalın, İtalik, Altı Çizili, Üstü Çizili ve metin renkleri
  - Paragraf hizalama (Sola, Ortala, Sağa, İki Yana Yasla) ve girinti ayarları
  - Tablo ekleme, hücre düzenleme ve sayfa sonu desteği
- **UDF Formatında İndirme:** Düzenlenen içeriği standart UYAP XML şemasıyla paketleyip doğrudan `.udf` dosyası olarak kaydeder.
- **Word (.docx) Olarak İndirme:** Editördeki herhangi bir kararı veya metni, tabloları ve stilleri bozulmadan doğrudan Microsoft Word (.docx) olarak indirebilirsiniz.
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
├── install.ps1                  # Tek komutla Windows PowerShell kurulum sihirbazı
├── uninstall.ps1                # Temiz sistem kaldırma betiği
├── Dockerfile                   # Python 3.11 Slim mikroservis ve web konteyner tanımı
├── docker-compose.yml           # Tek komutla Docker Compose orkestrasyonu
├── assets/
│   ├── css/
│   │   └── style.css            # A4 sayfa düzeni, araç çubuğu, modallar, koyu tema ve mizanpaj
│   ├── js/
│   │   ├── uki-core.js          # UDF (ZIP/XML) ayrıştırma, docx & markdown dönüştürme çekirdeği
│   │   ├── uki-table.js         # Excel / Word zengin tablo yapıştırma ve tablo motoru
│   │   ├── uki-stats.js         # 657astro sayaç entegrasyonu ve kullanım istatistiği
│   │   ├── uki-editor.js        # WYSIWYG düzenleme, paragraf ve metin motoru
│   │   ├── uki-embed.js         # Dış sitelerden linkac=URL ile doğrudan döküman açıcı SDK
│   │   ├── uki-pages.js         # A4 sayfa bölücü ve sayfalama motoru
│   │   ├── uki-seal.js          # Yüzen bağımsız elektronik imza mührü
│   │   ├── uki-ai.js            # Tarayıcı içi yapay zeka & WebGPU belge inceleme ve Q&A asistanı
│   │   └── app.js               # Arayüz kontrolleri, dosya yönetimi ve eylemler
│   └── vendor/
│       └── jszip.min.js         # Çevrimdışı ZIP okuma ve yazma kütüphanesi
├── print_to_udf.py              # Evrensel sistem sanal yazıcısı, REST API ve UDF çevirici
└── README.md
```

---

## 👨‍💻 Geliştirici

**Gökhan TAŞÇI**  
Sakarya Yazı İşleri Müdürü (Sicil No: 139329)  
Web: [657.com.tr](https://657.com.tr) · [webeditor.657.com.tr](https://webeditor.657.com.tr)

---

## ⚖️ Lisans

Bu proje MIT Lisansı altında sunulmaktadır.

