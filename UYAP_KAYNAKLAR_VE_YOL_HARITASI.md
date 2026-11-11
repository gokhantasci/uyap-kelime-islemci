# UYAP Kelime İşlemci - Tersine Mühendislik, Kaynaklar ve Web Sürümü Yol Haritası

Bu belge, UYAP Kelime İşlemci uygulamasının incelenmesi, UDF (.udf) dosya formatı analizi, tersine mühendislik adımları ve GitHub üzerinde yayınlanacak Web sürümü için tüm teknik ayrıntıları ve yol haritasını içerir.

---

## 1. Orijinal Masaüstü Uygulaması Mimarisi

* **Konum:** `C:\Uyap\Uyap Kelime Islemci`
* **Mimari:** Java Runtime (Java 8 - 1.8.0 / Java 11) üzerinde çalışan Java Swing masaüstü uygulaması.
* **Başlatıcılar:** `Uyap Doküman Editörü.exe`, `Uyap Sablon Editörü.exe` (WinRun4J tabanlı 32/64 bit wrapper).
* **Ana Sınıf:** `tr.com.havelsan.uyap.system.editor.common.WPAppManager`
* **Başlatma Parametresi:** `"getNewWPInstance" "EDITOR_TYPE_DOCUMENT"`
* **Bellek Yapılandırması:** `-Xms512M -Xmx4096M -Dsun.java2d.dpiaware=false -Dsun.java2d.uiScale=1`

### Temel Kütüphaneler (JAR Dosyaları)
1. **`editor_lib.jar` (3.70 MB):** Temel kelime işlemci mantığı (`tr.com.havelsan.uyap.system.editor.*`), UI pencereleri ve UDF dosya yöneticisi.
2. **`editor_lib2.jar` (23.70 MB):** TÜBİTAK UEKAE e-imza bileşenleri (`tr.gov.tubitak.uekae`), güvenlik ve XML şemaları.
3. **`editor_laf.jar` (0.22 MB):** Look & Feel (Arayüz teması, ikonlar ve bileşen görünümleri).
4. **`editor_utility.jar` (20.48 MB):** Yardımcı araçlar, dönüştürücüler, font eşleme ve yardımcı sınıflar.
5. **`jai_hvl.jar` (8.25 MB):** Havelsan Java Advanced Imaging eklentisi.
6. **`jdom.jar` (0.12 MB):** XML ayrıştırıcı.
7. **`updater.jar` (0.32 MB):** Otomatik güncelleme istemcisi.

---

## 2. UDF (UYAP Doküman Formatı) Analizi

UDF (`.udf`) dosyaları arka planda standart bir **ZIP Arşivi** konteyneridir:

### Konteyner İçeriği:
1. **`content.xml` (Zorunlu):** Belge metni, şablon özellikleri, biçimlendirme stilleri ve tablo yapısı.
2. **`sign.sgn` (E-İmzalı ise opsiyonel):** TÜBİTAK / Kamusert e-imza PKCS#7 / CAdES imza verisi.
3. **Medya Dosyaları (Opsiyonel):** Belge içine gömülen `.jpg`, `.png` görseller.

### `content.xml` Şeması ve Çalışma Mantığı:
```xml
<?xml version="1.0" encoding="UTF-8" ?>
<template format_id="1.8">
  <!-- 1. DÜZ METİN HAVUZU -->
  <content><![CDATA[Tüm belgenin salt metni burada tek bir blok olarak saklanır...]]></content>
  
  <!-- 2. SAYFA VE MARJİN ÖZELLİKLERİ -->
  <properties>
    <pageFormat mediaSizeName="1" leftMargin="42.525" rightMargin="42.525" 
                topMargin="42.525" bottomMargin="42.525" paperOrientation="1" 
                headerFOffset="20.0" footerFOffset="20.0" />
  </properties>
  
  <!-- 3. BİÇİMLENDİRME VE YAPI (OFFSET TABANLI MAPPING) -->
  <elements resolver="hvl-default">
    <header>...</header>
    <paragraph Alignment="0" LeftIndent="0" RightIndent="0">
      <!-- startOffset ve length ile CDATA metnindeki karakter aralığına stil uygulanır -->
      <content startOffset="0" length="15" bold="true" italic="false" 
               size="12" family="Times New Roman" foreground="-16777216" />
    </paragraph>
    <table tableName="Sabit" columnCount="3" columnSpans="100,100,100" border="borderCell">
      <row rowName="row1" rowType="dataRow">
        <cell><paragraph><content startOffset="15" length="5" /></paragraph></cell>
      </row>
    </table>
    <footer>...</footer>
  </elements>
</template>
```

#### Önemli Özellikler:
* **Hizalama (`Alignment`):** `0` = Sola Yasla, `1` = Ortala, `2` = Sağa Yasla, `3` = İki Yana Yasla.
* **Renk Kodlaması (`foreground`):** 32-bit işaretli tamsayı (ARGB). Örn: `-16777216` = `#000000` (Siyah).
* **Sayfa Yönü (`paperOrientation`):** `1` = Dikey (Portrait), `2` = Yatay (Landscape).

---

## 3. Yapılanlar (Özet)

1. [x] Orijinal `C:\Uyap\Uyap Kelime Islemci` kurulumu, `.ini` yapılandırması ve JAR bağımlılıkları incelendi.
2. [x] `morluto/rea` (Reverse Engineer Anything) reposu klonlandı ve mimari kabiliyetleri analiz edildi.
3. [x] Sistemde kurulu Java 8 çalışma ortamı tespit edildi.
4. [x] Bağımsız Java dekompilasyon aracı `cfr.jar` (v0.152) indirilip `d:\UYAP Kelime İşlemci\tools\` içerisine hazırlandı.
5. [x] Gerçek `.udf` dosyaları (`test metni.udf`, `ornek-metin.udf`, mahkeme bilirkişi raporları) incelendi; ZIP ve XML offset-based yapısı doğrulandı.

---

## 4. Yapılacaklar (Web Sürümü & İlerleme Planı)

### Aşama 1: Web UYAP Editörü (GitHub / Client-side SPA)
* [ ] **Bağımsız Web Editörü Çekirdeği:** Herhangi bir backend/sunucu veya Java ihtiyacı duymadan, doğrudan modern tarayıcılarda (Chrome, Edge, Firefox, Safari) çalışan uygulama.
* [ ] **Dosya Yükleme & Sürükle-Bırak:** Bilgisayardan `.udf` dosyalarını seçme veya editöre sürükleyip bırakma.
* [ ] **UDF Okuyucu (Parser):** `JSZip` ile zip'i açma, `content.xml` ayrıştırma, CDATA metni ile offset tabanlı stilleri birleştirip DOM'a aktarma.
* [ ] **Arayüz & Zengin Editör (WYSIWYG):**
  - UYAP klasik arayüz tasarımına ve modern minimalist temaya sahip üst menü / araç çubuğu.
  - Kalın, İtalik, Altı Çizili, Üstü Çizili, Renk, Font Boyutu, Font Ailesi (Times New Roman, Arial vb.).
  - Hizalama: Sol, Orta, Sağ, İki Yana Yaslama.
  - Tablo desteği: Tablo satır/sütun ekleme, silme, hücre düzenleme.
  - Sayfa Marjinleri ve Sayfa Düzeni (A4 simülasyonu).
* [ ] **UDF Olarak Kaydetme & İndirme:** Web editöründeki içeriği tekrar UDF standart XML formatına dönüştürüp `.udf` uzantısıyla paketleme.
* [ ] **PDF / Yazdır Desteği:** Belgeyi doğrudan tarayıcı üzerinden PDF olarak kaydetme.
* [ ] **E-İmza Göstergesi:** Belgede e-imza varsa doğrulama rozeti ve imza bilgisi gösterimi.

### Aşama 2: GitHub Dağıtımı & GitHub Pages
* [ ] Proje kaynak kodlarını GitHub'a uygun dizin yapısında hazırlama (`/web` veya kök dizin).
* [ ] GitHub Pages dağıtım yapılandırması (`.github/workflows/deploy.yml` veya doğrudan `gh-pages` dalı).
* [ ] Kullanım kılavuzu, ekran görüntüleri ve `README.md` hazırlanması.



---

## DURUM GÜNCELLEMESİ — 2026-11-11 (doğrulanmış)

Bu bölüm, önceki oturumlardaki "yapıldı" iddialarının tarayıcıda sınanmasının sonucudur.
Kaynaklar: bu dosya, `UYAP_TAM_OZELLIK_MATRISI_VE_YOL_HARITASI.md`, `docs/E_UDF_EDITOR_TEST_NOTLARI.md`.

### Doğrulanıp düzeltilenler
| Konu | Bulgu | Durum |
|---|---|---|
| UDF kaydetme (UYAP'ta açılmama) | `documentproperties.xml` özel bir kök etiketle yazılıyordu; UYAP Java `properties` DTD biçimi bekler. Paragraflarda `resolver="hvl-default"` yoktu. Değişen belgeye eski `sign.sgn` ekleniyordu. | Düzeltildi (JS + `print_to_udf.py`). **Masaüstü UYAP'ta elle açma sınaması hâlâ gerekli.** |
| `print_to_udf.py` ofsetleri | Run uzunlukları 1 yazılıyor, satır sonu içeriği ve tablo ofsetleri hatalıydı | Üretici baştan yazıldı, ofsetler yeniden hesaplanıyor |
| Sayfalama / sayfa önizleme / sayfaya git | HTML vardı, motor yoktu (tek uzun sayfa) | `assets/js/uki-pages.js`: gerçek A4 sayfalama, üst bilgi (2. sayfadan), sayfa no, doğrulama satırı, küçük önizlemeler |
| Örnek kararın görünümü | Belgeye özel hileler (sabit 180pt sütun vb.) | Genel `TabSet`/`Hanging`/girinti işleyicisi; örnek karar 3 sayfa (PDF ile aynı) |
| Avukat anteti | `escapeHtml` tanımsızdı, pencere hata veriyordu | Düzeltildi; profil `localStorage`'da |
| Bul ve Değiştir | CSS yoktu (ham HTML görünümü); `` Türkçe harflerde bozuktu; "Tümünü değiştir" `g` bayrağı hatası | Yan panel tasarımı, Türkçe duyarlı arama |
| Boş paragraf çıktısı | Boş `<br>` satırı iki satır sonu üretiyordu | Düzeltildi |

### Kalanlar (öncelik sırasıyla)
1. Gerçek UYAP Doküman Editörü ile açma testi (kullanıcı) — başarısızsa `content.xml` farkı bu dosyadaki `Bilinen format notları` ile karşılaştırılacak.
2. Paragraf özellikleri penceresi (girinti/sekme durağı) — e-udf.com'daki gibi.
3. Sesli Oku, yazım denetimi aç/kapat, otomatik kaydet + son açılanlar.
4. Üstbilgi/altbilgi düzenleme arayüzü, sayfa sonu ekleme.
5. İmzalı belge düzenlenirse imza düşer uyarısı; imza ayrıntı penceresi.
6. Tablo hücre genişlikleri (`columnSpans`) ve birleştirme.

### Bilinen format notları (gerçek örnekten)
- Hizalama: 0 sol, 1 ortala, 2 sağ, 3 iki yana. TabSet: `konum:hizalama:dolgu` (hizalama 0 sol / 1 sağ / 2 ortalı).
- `Hanging` asılı girinti, `FirstLineIndent` ilk satır; `SpaceAbove/Below` 1pt; tek satır aralığı.
- `<header startPage="2">` yalnızca 2. sayfadan itibaren; altbilgideki doğrulama kodu `<webID id="...">` içindedir.
- `documentproperties.xml`: `<properties><entry key="uyapdogrulamakodu">…</entry><entry key="uyapsicil">…</entry></properties>`.


### Birebir görünüm kalibrasyonu (2026-11-11, örnek karar PDF'i ile ölçüldü)
`tools/cmp_lines.js` + `examples/ref_lines.json`: PDF'teki 104 satırın başı/sonu ve sayfası web editörle karşılaştırılır (tarayıcı konsolunda `eval` ile çalıştırılır). Sonuç: 104 satırın **102'si birebir aynı satır sonu ve sayfa**, 3 sayfa, sayfa 1 "…hitaben \" aç" ile biter (gerçek editör gibi).
Bulunan nedenler: (1) satır yüksekliği Java'da 1,1667×punto (14 pt) idi, 1,35 kullanılıyordu; (2) paragraf üst/alt boşluğu (1+1 pt) birleşmemeli (padding); (3) sekme kutusu satırı uzatıyordu (inline padding kullanılıyor); (4) alt bilgi varsa metin alt marjdan değil `footerFOffset + alt bilgi` yüksekliğinden önce biter; (5) Java glif genişlikleri tarayıcıdan hafif geniş: kerning/ligatür kapalı + 0,05 px harf aralığı; (6) paragraf sonu padding'i sığmayınca son satır yanlışlıkla bir sonraki sayfaya itiliyordu.
Kalan fark: imza bloğunda (Katip/Hakim) satır düzeni.
