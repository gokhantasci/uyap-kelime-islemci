# UYAP Döküman Editörü Tam Özellik Matrisi ve Stratejik Yol Haritası

Bu belge; Adalet Bakanlığı resmî **UYAP Döküman Editörü** (`C:\Uyap\Uyap Kelime Islemci` - `editor_lib.jar`, `editor_utility.jar`, `editor_laf.jar`, `Uyap Doküman Editörü.exe`) paketlerinin ve kaynak kodlarının tersine mühendislikle incelenmesi sonucunda elde edilen **tüm özelliklerin eksiksiz dökümünü**, mevcut Web sürümümüzle olan **birebir karşılaştırmasını** ve **fazlandırılmış yol haritasını** içerir.

---

## 1. Masaüstü UYAP Editörü Özellik Ağacı (Exhaustive Feature Breakdown)

Aşağıdaki özellikler, UYAP masaüstü JAR arşivlerindeki sınıflar (`tr.com.havelsan.uyap.*`), arayüz menüleri, ikonlar (`resources/*.png`) ve XML şemaları çözümlenerek çıkarılmıştır:

### 1.1. Dosya (File) İşlemleri
| Özellik | Açıklama | Masaüstü İkon/Kaynak | Mevcut Web Durumu |
| :--- | :--- | :--- | :--- |
| **Yeni Belge** | Boş UYAP çalışma belgesi oluşturma (`Ctrl+N`) | `new.png`, `newBig.png` |  Tamamlandı |
| **UDF Belge Aç** | Diskten şifresiz veya imzalı `.udf` arşivini açma (`Ctrl+O`) | `open.png`, `openBig.png` |  Tamamlandı |
| **Yedeklerden Belge Aç** | Çökme kurtarma ve otomatik yedeklenen belgeleri açma | `openBackups.png` | ⏳ Faz 2 (IndexedDB yedekleme) |
| **UDF Kaydet** | Düzenlenen içeriği UDF 1.8 standart XML arşivi olarak indirme (`Ctrl+S`) | `save.png`, `saveBig.png` |  Tamamlandı |
| **Word (.docx) İndir** | Web editördeki kararı/metni doğrudan Microsoft Word belgesi olarak indirme | JSZip OpenXML |  Tamamlandı |
| **Farklı Kaydet** | Farklı dosya adıyla kaydetme | `saveAs.png`, `saveAsBig.png` |  Tamamlandı |
| **Sayfa Düzenleme (Page Setup)** | Dikey/Yatay yönelim, Sol (2cm), Sağ/Üst/Alt (2.5cm), Üst Yazı (0.529cm), Alt Yazı (2.117cm) | `pageSetup.png`, `horizontal.png`, `vertical.png` |  Tamamlandı (UYAP Birebir Diyalog) |
| **Yazdır / Print to PDF** | Tarayıcı yazdırma ve PDF çıktı üretimi (`Ctrl+P`) | `print.png`, `printBig.png` |  Tamamlandı |
| **Toplu Belge Yazdırma** | Birden çok UDF belgesini sırayla kuyruğa alma | `printBatch.png` | ⏳ Faz 2 |
| **İmzalı Belge Dışa Aktar** | Elektronik imzalı haliyle paketi dışa aktarma | `exportSignedDocBig.png` |  Tamamlandı |
| **E-Posta Eki Yap** | Belgeyi varsayılan e-posta istemcisine ek olarak verme | `attachtomail.png` | ⏳ Faz 2 (`mailto:` URI) |
| **Gizli Belge Şifreleme** | Belgeyi parola ile AES-256 kriptolayarak kaydetme | `secretDocument.png` | ⏳ Faz 3 (WebCrypto API) |
| **Belge Özellikleri** | Yazar, oluşturulma tarihi, şablon tipi meta bilgileri | `ini.png` |  Tamamlandı (`documentproperties.xml`) |

### 1.2. Düzen (Edit) & Arama İşlemleri
| Özellik | Açıklama | Masaüstü İkon/Kaynak | Mevcut Web Durumu |
| :--- | :--- | :--- | :--- |
| **Geri Al (Undo)** | Son işlemi geri alma (`Ctrl+Z`) | `undo.png`, `undoSmall.png` |  Tamamlandı |
| **Yinele (Redo)** | Geri alınan işlemi yineleme (`Ctrl+Y`) | `redo.png`, `redoSmall.png` |  Tamamlandı |
| **Kes / Kopyala / Yapıştır** | Standart sistem panosu entegrasyonu (`Ctrl+X`, `Ctrl+C`, `Ctrl+V`) | `cut.png`, `copy.png`, `paste.png` |  Tamamlandı |
| **Biçimi Temizle** | Seçili metindeki tüm özel stilleri varsayılana döndürme | `clean.png`, `clearFormat.png` |  Tamamlandı |
| **Tümünü Seç** | Tüm belge içeriğini seçme (`Ctrl+A`) | `selectAll.png` |  Tamamlandı |
| **Bul ve Değiştir** | Belge içi metin arama ve toplu değiştirme (`Ctrl+F`, `Ctrl+H`) | `find.png`, `replace.png`, `replaceText.png` |  Tamamlandı (UYAP Modalı) |
| **Kısayol Metinler (AutoText)** | Sık kullanılan resmî ibareleri kısayol koduyla otomatik tamamlama | `autoText.png`, `textShortCut.png` | ⏳ Faz 2 |

### 1.3. Görünüm (View) & Tema
| Özellik | Açıklama | Masaüstü İkon/Kaynak | Mevcut Web Durumu |
| :--- | :--- | :--- | :--- |
| **Sayfa Düzeni (Print Layout)** | Gerçek sayfa kenar boşlukları ve sayfa sınırları | `ude.png`, `ude2.png` |  Tamamlandı |
| **Yakınlaştırma (Zoom)** | %75, %90, %100, %125, %150 ölçekleme | `resize.png` |  Tamamlandı |
| **Görünmeyen Karakterleri Göster** | Boşlukları nokta (`·`), paragrafları (`¶`), sekmeleri (`→`) gösterme (`Ctrl+W`) | `whiteSpace.png` |  Tamamlandı |
| **Aydınlık / Karanlık Arayüz Teması** | Astryx tasarım sistemiyle modern Dark / Light Theme desteği | Astryx Design Tokens |  Tamamlandı (`data-theme="dark"`) |
| **Göz Yormayan Gece / Sayfa Koyu Modu** | Sayfa kağıdını koyu yapıp metni kontrastlı okuma (Baskıda her zaman beyaz) | Astryx Canvas |  Tamamlandı (`data-doc-theme="dark"`) |
| **Çoklu Sayfa Görünümü** | Yan yana 2 sayfa gösterme | `multiPage.png`, `multiPageBig.png` | ⏳ Faz 2 |
| **Sayfa Arka Plan Rengi** | Belge kağıt rengini özelleştirme | `pageColor.png`, `pageBGColor.png` |  Tamamlandı |

### 1.4. Biçimlendirme (Format) & Tipografi
| Özellik | Açıklama | Masaüstü İkon/Kaynak | Mevcut Web Durumu |
| :--- | :--- | :--- | :--- |
| **Yazı Tipi (Font Family)** | Times New Roman, Arial, Calibri, Tahoma, Verdana, Segoe UI, Georgia, Trebuchet MS, Courier New, Garamond, Cambria vb. | `font.png`, `fontBig.png` |  Tamamlandı (20+ Font Genişletildi) |
| **Yazı Boyutu (Font Size)** | 8 pt - 72 pt arası punto seçenekleri | `fontSizeIncr.png`, `fontSizeDecr2.png` |  Tamamlandı (`Ctrl+Yukarı/Aşağı`) |
| **Kalın (Bold)** | Metni kalın yapma (`Ctrl+K` UYAP veya `Ctrl+B`) | `bold.png` |  Tamamlandı |
| **İtalik (Italic)** | Metni eğik yapma (`Ctrl+T` UYAP veya `Ctrl+I`) | `italic.png` |  Tamamlandı |
| **Altı Çizili (Underline)** | Metnin altını çizme (`Shift+Ctrl+A` UYAP veya `Ctrl+U`) | `underline.png` |  Tamamlandı |
| **Üstü Çizili (Strikethrough)** | Metnin üstünü çizme | `strikeThrough.png` |  Tamamlandı |
| **Alt Simge / Üst Simge** | Formül ve dipnotlar için subscript / superscript | `subScript.png`, `superScript.png` | ⏳ Faz 2 |
| **Yazı Rengi & Vurgu Rengi** | Metin rengi ve metin arka plan fosforlu vurgusu | `textColor.png`, `editColorsBig.png` |  Tamamlandı |
| **Büyük/Küçük Harf Dönüştür** | TÜMÜ BÜYÜK, tümü küçük, Baş Harfleri Büyük, Harfleri Tersine Çevir | `toUpperCase.png`, `changeCaseLower.png`, `switchLetters.png` | ⏳ Faz 2 |
| **Paragraf Hizalama** | Sola (`Ctrl+L`), Ortala (`Ctrl+E`), Sağa (`Ctrl+R`), İki Yana Yasla (`Ctrl+J`) | `alignLeft.png`, `alignCenter.png`, `alignRight.png`, `alignJustify.png` |  Tamamlandı |
| **Girinti Yönetimi** | Girintiyi Artır, Girintiyi Azalt, İlk Satır Girintisi (`Shift+Ctrl+Q`) | `increaseIndent.png`, `decreaseIndent.png` |  Tamamlandı |
| **Satır Aralığı (Line Spacing)** | 1.0 (Tek), 1.15, 1.5, 2.0 (Çift) satır aralığı | `lineGap.png` |  Tamamlandı (Paragraf Ayarları Modalı) |
| **Madde İmleri & Numaralandırma** | Liste türleri (Nokta, Roma rakamı, Alfabetik, Çok düzeyli) | `bullet2.png`, `number.png`, `numberType1..8.png`, `mlListType1..5.png` | ⏳ Faz 2 |

### 1.5. Ekle (Insert) & Nesneler
| Özellik | Açıklama | Masaüstü İkon/Kaynak | Mevcut Web Durumu |
| :--- | :--- | :--- | :--- |
| **Üstbilgi & Altbilgi (Header/Footer)** | Sayfa üstü/altı kurumsal yazılar; Sayfa 1'de üstbilgiyi gizleme desteği (`startPage="2"`) | `insertHeader.png`, `insertFooter.png`, `editHeaderFooter.png` |  Tamamlandı |
| **Sayfa Numarası** | `1/3` formatında sağ altta sayfa numarası | `pageNumber.png`, `editPageNumber.png` |  Tamamlandı |
| **Doğrulama Kodu & Karekod (QR Kod)** | Sayfa altında `vatandas.uyap.gov.tr` doğrulama kodu ve QR kod mühür | `barcode.png`, `barcodeBig.png` |  Tamamlandı |
| **Sağ Üst Altın Mühür Rozeti** | İmzacıların listelendiği altın madalya ve kırmızı kurdeleli e-imza mühür | `certificate72.png`, `certificateSBG.png` |  Tamamlandı |
| **Sicil Numaralı Çapraz Filigran** | Sayfayı kaplayan 45 derece eğimli açık mavi sicil no tekrarı | `bgImage.png`, `watermark` |  Tamamlandı |
| **Sayfa Sonu (Page Break)** | Yeni sayfaya zorunlu geçiş (`Ctrl+Enter`) | `insertPageBreak.png` | ⏳ Faz 2 |
| **Özel Karakter & Simge Ekle** | Resmî simgeler: § (Paragraf), ©, ®, €, ₺, ™ | `addSymbolBig.png` | ⏳ Faz 2 |
| **Resim Ekleme & Düzenleme** | Belge içine resim gömme (Base64), yeniden boyutlandırma | `insertImage.png`, `resize.png`, `rotate-left.png` | ⏳ Faz 2 |
| **Köprü / Web Linki Ekle** | Tıklanabilir URL bağlantısı | `link.png`, `linkBig.png` |  Tamamlandı |
| **Zaman Damgası Ekle** | Belgeye anlık tarih/saat damgası ekleme | `timeStamp.png` | ⏳ Faz 2 |

### 1.6. Tablo (Table) İşlemleri
| Özellik | Açıklama | Masaüstü İkon/Kaynak | Mevcut Web Durumu |
| :--- | :--- | :--- | :--- |
| **Tablo Ekle** | İstenen satır ve sütun sayısında tablo ekleme | `table.png`, `tableBig.png` |  Tamamlandı |
| **Satır Ekle / Sil** | Üste satır ekle, alta satır ekle, geçerli satırı sil | `insertTableRowBefore.png`, `insertTableRowAfter.png`, `deleteRow.png` |  Tamamlandı |
| **Sütun Ekle / Sil** | Sola sütun ekle, sağa sütun ekle, geçerli sütunu sil | `insertColumnLeft.png`, `insertColumnRight.png`, `deleteColumn.png` |  Tamamlandı |
| **Hücreleri Birleştir (Merge Cells)** | Seçili hücreleri tek hücrede birleştirme (`colspan` / `rowspan`) | `combineTableCell.png` | ⏳ Faz 2 |
| **Hücreyi Böl (Split Cell)** | Birleştirilmiş hücreyi yeniden satır/sütunlara bölme | `divideTableCell.png` | ⏳ Faz 2 |
| **Tablo Kenarlıkları** | Kenarlıklı tablo (`borderCell`), görünmez kenarlıklı tablo (`borderNone`) | `tableEditBorder.png`, `table-border-24.png` |  Tamamlandı |
| **Tablo Özellikleri** | Satır yüksekliği, hücre dolgusu (padding), hizalama | `tableProperties.png`, `tableRowHeights.png` |  Tamamlandı |
| **Tabloyu Sil** | Tabloyu tamamen kaldırma | `removeTable.png` |  Tamamlandı |
| **Tablo Sonrasına Paragraf Ekle** | Tablodan sonra yeni boş paragrafa geçiş | `insertParagraphAfterTable.png` |  Tamamlandı |

### 1.7. İnceleme (Review), Değişiklikleri İzle & Açıklamalar
| Özellik | Açıklama | Masaüstü İkon/Kaynak | Mevcut Web Durumu |
| :--- | :--- | :--- | :--- |
| **Değişiklikleri İzle (Track Changes)** | Belgedeki ekleme (yeşil altı çizili) ve silmeleri (kırmızı üstü çizili) kaydetme | `watchChanges.png`, `watchChangesBig.png` | ⏳ Faz 2 |
| **Değişiklik Kabul / Ret** | Değişikliği kabul et, reddet, tümünü kabul et, tümünü reddet | `acceptChanges.png`, `rejectChanges.png`, `acceptAllChanges.png`, `rejectAllChanges.png` | ⏳ Faz 2 |
| **Değişiklikler Arasında Gezin** | Sonraki / önceki değişikliğe atlama | `nextChanges.png`, `previousChanges.png` | ⏳ Faz 2 |
| **Yorum / Açıklama Ekle** | Paragraf veya kelimeye yazar açıklaması ekleme | `commentAdd2.png`, `commentAdd2Small.png` | ⏳ Faz 2 |
| **Yorumları Yönet** | Yorum sil, önceki/sonraki yoruma git, yorumları göster/gizle | `commentRemove.png`, `commentNext.png`, `commentPrevious.png`, `commentShow.png` | ⏳ Faz 2 |

### 1.8. Dil & İmla Denetimi (Zemberek)
| Özellik | Açıklama | Masaüstü İkon/Kaynak | Mevcut Web Durumu |
| :--- | :--- | :--- | :--- |
| **Türkçe İmla Denetimi** | Masaüstünde Zemberek kütüphanesiyle morfolojik kelime doğrulaması | `spellCheck.png` | ⏳ Faz 3 (Wasm/Pure JS Zemberek motoru) |
| **Öneri Listesi** | Hatalı kelimeye sağ tıklandığında doğru alternatifleri sunma | Context Menu | ⏳ Faz 3 |
| **Özel Sözlüğe Ekle** | Hukuki terimleri ve özel isimleri sözlüğe ekleme | Context Menu | ⏳ Faz 3 |
| **Sözcük ve Karakter Sayımı** | Gerçek zamanlı sayfa, kelime ve karakter istatistikleri | Durum Çubuğu |  Tamamlandı |

### 1.9. Elektronik İmza & Sertifika Altyapısı
| Özellik | Açıklama | Masaüstü İkon/Kaynak | Mevcut Web Durumu |
| :--- | :--- | :--- | :--- |
| **PKCS#7 / CAdES Ayrıştırma** | `.udf` içindeki `sign.sgn` DER dosyasını saf JS ASN.1 ile okuma | `tr.com.havelsan.uyap.system.pki` |  Tamamlandı (Bağımlılıksız Saf JS ASN.1) |
| **İmza Detayları Görüntüleme** | İmzacının adı, unvanı, T.C. Kimlik / Seri No, İmza Zamanı, CA Makamı | `showSigners.png`, `certificate.png`, `certificates.png` |  Tamamlandı (UYAP Birebir Modal) |
| **Çoklu İmza Desteği** | Hâkim ve Kâtip gibi birden çok imzayı aynı belgede tanıma | `signature-badge` |  Tamamlandı |
| **Mobil İmza Entegrasyonu** | GSM operatörleri üzerinden mobil imzalama | `mobileSign.png`, `mobileSignBig.png` | ⏳ Faz 4 |
| **Yerel Akıllı Kart ile E-İmza** | TÜBİTAK Kamu SM, AKİS, E-Tuğra, TürkTrust kartlarıyla doğrudan tarayıcıdan imzalama | `smartcard-config.xml`, `esya-signature-config.xml` | ⏳ Faz 4 (WebPKI / Native Messaging Bridge) |

### 1.10. UYAP Özel Şablon ve Yargı Alanları
| Özellik | Açıklama | Masaüstü İkon/Kaynak | Mevcut Web Durumu |
| :--- | :--- | :--- | :--- |
| **Dinamik Yargı Alanları (`<field>`)** | Mahkeme Adı, Dosya No, Karar No, Hâkim, Kâtip, Davacı, Sanık vb. | `addField.png`, `addFieldGroup.png`, `removeFieldGroup.png` |  Tamamlandı (XML Parser + Model) |
| **Taraf ve Tanık Bilgisi Alanları** | Sanık, Müşteki, Tanık dinamik veri blokları | `hak_sanik.png`, `hak_musteki.png`, `hak_tanik.png`, `addWitness.png` | ⏳ Faz 2 |
| **Şablon Dönüştürme Sihirbazı** | Düz metni UYAP resmî şablonuna otomatik dönüştürme | `templateConvertBig.png`, `templateUnConvert.png` | ⏳ Faz 3 |
| **Yargıtay Karar Arama Entegrasyonu** | Yargıtay emsal kararlarını arama ve belgeye aktarma | `modules/yargitay/1.png`, `searchDecisions.png` | ⏳ Faz 3 |
| **Makro Desteği** | Tekrarlayan biçimlendirme ve metin komutlarını kaydetme/çalıştırma | `macroStartNew.png`, `macroRunCurrent.png`, `macroStop.png` | ⏳ Faz 4 |

---

## 2. Dışa Aktarma & Sanal Yazıcı (Print to UDF)

| Platform / Yetenek | Çözüm Mimarisi | Durum |
| :--- | :--- | :--- |
| **Windows Sistem Sanal Yazıcısı** | `UYAP'a Yazdır (Print to UDF)` - Her programdan (Chrome, Word, Excel, ERP vb.) `Ctrl+P` ile doğrudan UDF çıktısı |  Tamamlandı |
| **macOS PDF Services** | `~/Library/PDF Services/` - Mac üzerindeki tüm uygulamalarda `Cmd+P > PDF > UYAP'a Yazdır` |  Tamamlandı |
| **Linux CUPS Sanal Yazıcı** | `/usr/lib/cups/backend/print-to-udf` sanal backend |  Tamamlandı |
| **Microsoft Word (.docx, .doc)** | Word paragrafları, başlıklar, stiller ve tabloları doğrudan yerel UDF'e dönüştürme |  Tamamlandı |
| **Microsoft Excel & CSV (.xlsx, .csv)** | Hesap tablolarını otomatik `<table border="borderCell">` UYAP tablosuna dönüştürme |  Tamamlandı |
| **Web Sayfaları & HTML (.html, .htm)** | HTML etiketlerini ve mizanpajını UDF XML şemasına dönüştürme |  Tamamlandı |
| **Düz Metin & Kod (.txt, .md, .log, .json)** | Kod ve metin dosyalarını biçimli UYAP paragraflarına dönüştürme |  Tamamlandı |
| **Tescilli Diğer Yazılımlar (CAD, Muhasebe vb.)** | Windows Shell `PrintTo` fiili ile sanal yazıcı üzerinden otomatik dönüştürme |  Tamamlandı |
| **Grafik Arayüz & Sürükle-Bırak** | `python print_to_udf.py --gui` masaüstü arayüzü |  Tamamlandı |
| **Arka Plan Yazdırma İzleyicisi (Daemon)** | `python print_to_udf.py --daemon` ile Ctrl+P işlerini sessiz yakalama ve bildirim |  Tamamlandı |

---

## 3. Stratejik 4 Aşamalı Yol Haritası (4-Phase Strategic Roadmap)

```mermaid
flowchart TD
    subgraph Faz 1: Çekirdek Web ve Sanal Yazıcı [TAMAMLANDI]
        F1_1[UDF 1.8 Arşiv Parser/Exporter]
        F1_2[Astryx Tasarım Sistemi & UI Shell]
        F1_3[Sayfa 1 Üstbilgi/Mühür/Filigran Paritesi]
        F1_4[Sayfa Düzenleme Modalı - cm bazlı]
        F1_5[PKCS#7 Saf JS ASN.1 E-İmza Okuyucu]
        F1_6[Resmî UYAP Kısayolları - 657.com.tr]
        F1_7[Dark/Light Tema & Gece Okuma Modu]
        F1_8[20+ Genişletilmiş Font Desteği]
        F1_9[Cross-Platform print_to_udf.py]
    end

    subgraph Faz 2: Gelişmiş Düzenleme & İnceleme [AKTİF]
        F2_1[Hücre Birleştirme ve Bölme - Colspan/Rowspan]
        F2_2[Değişiklikleri İzle - Track Changes]
        F2_3[Inline Yorumlar ve Açıklama Baloncukları]
        F2_4[Alt Simge / Üst Simge ve Özel Simgeler]
        F2_5[Büyük/Küçük Harf Dönüştürücü]
        F2_6[Resim Ekleme, Döndürme ve Yeniden Boyutlandırma]
        F2_7[IndexedDB Otomatik Belge Kurtarma]
    end

    subgraph Faz 3: Türkçe Dil Motoru & Zemberek [PLANLANAN]
        F3_1[Zemberek WebAssembly / Pure JS Port]
        F3_2[Kelime Kök/Ek Morfolojik Analiz]
        F3_3[Kırmızı Dalgalı Çizgi ve Sağ Tık Önerileri]
        F3_4[Hukuk Terimleri Sözlüğü]
        F3_5[Şablon Dönüştürme Sihirbazı]
    end

    subgraph Faz 4: Donanımsal Akıllı Kart E-İmzalama [PLANLANAN]
        F4_1[WebPKI / Yerel Köprü WebSocket Servisi]
        F4_2[PKCS#11 TÜBİTAK Kamu SM & AKİS Entegrasyonu]
        F4_3[CAdES-BES & CAdES-T İmzalama Motoru]
        F4_4[Zaman Damgası Sunucusu Entegrasyonu]
    end

    Faz 1 --> Faz 2
    Faz 2 --> Faz 3
    Faz 3 --> Faz 4
```

### Faz Detayları ve Teslimatlar:

#### Faz 1: Çekirdek Web Editör ve Sanal Yazıcı (Tamamlandı)
- **Teslim Edilenler:**
  1. `index.html`, `assets/css/style.css`, `assets/js/uki-core.js`, `assets/js/uki-editor.js`, `assets/js/app.js`.
  2. UDF 1.8 tam XML DOM serileştirme ve ayrıştırma motoru.
  3. Gerekçeli karar görsel paritesi (Sayfa 1 üst bilgisiz, sağ üst çift imzacı altın mühür, sicil filigranı, 184 pt colon hizalama, alt bilgi barkod/karekod).
  4. Sayfa Düzenleme (Page Setup) cm bazlı kenar boşlukları ve kağıt yönelimi diyaloğu.
  5. Saf JavaScript ASN.1/PKCS#7 e-imza ayrıştırıcı (T.C. Kimlik / Seri No, CA, Tarih).
  6. Resmî 657.com.tr UYAP klavye kısayolları (`Ctrl+K`, `Ctrl+T`, `Shift+Ctrl+A`, `Ctrl+W`, `Alt+Q` vb.).
  7. Astryx Dark / Light Theme desteği ve Belge Gece Okuma Kağıt Modu.
  8. 20+ genişletilmiş font ve punto paleti.
  9. Windows / macOS / Linux `print_to_udf.py` dönüştürücü ve sanal yazıcı kurucusu.

#### Faz 2: Gelişmiş Tablo, İnceleme ve Düzenleme (Aktif Geliştirme)
- **Hedeflenen Yetenekler:**
  - Tablo hücre birleştirme (`combineTableCell.png`) ve hücre bölme (`divideTableCell.png`).
  - Değişiklik Takibi (`watchChanges.png`): Kim ne zaman ekledi/sildi renkli görselleştirme.
  - Açıklamalar / Notlar (`commentAdd2.png`): Kenar boşluğunda yorum baloncukları.
  - Büyük/Küçük harf akıllı dönüşümleri (`TÜMÜ BÜYÜK`, `tümü küçük`, `İlk Harfler Büyük`).
  - Alt Simge / Üst Simge desteği (`H₂O`, `m²`).
  - IndexedDB tabanlı arka planda her 30 saniyede bir otomatik kurtarma yedeği.

#### Faz 3: İstemci Taraflı Zemberek Türkçe Yazım Denetimi
- **Hedeflenen Yetenekler:**
  - Zemberek kütüphanesinin Rust -> WebAssembly veya Pure JavaScript portu ile sıfır sunucu bağımlılığıyla tarayıcıda çalışması.
  - Hatalı kelimelerin altına kırmızı dalgalı çizgi çizilmesi.
  - Hukuki terimler sözlüğü (`Müşteki`, `Müdafi`, `Bidayet`, `Tevellüt`, `İctinap`, vb.).
  - Tek tıkla kelime düzeltme öneri menüsü.

#### Faz 4: Donanımsal Akıllı Kart E-İmza İmzalama Köprüsü
- **Hedeflenen Yetenekler:**
  - Tarayıcı güvenliği gereği USB kart okuyucuya doğrudan erişilemediğinden, arka planda çalışan hafif tek dosyalık yerel yardımcı (`uki-signer` Go/Rust veya Python köprüsü).
  - WebPKI WebSocket protokolü üzerinden TÜBİTAK Kamu SM, AKİS, E-Tuğra, TürkTrust kartlarına PIN sorarak CAdES formatında `sign.sgn` üretme ve UDF'e gömme.
  - Mobil imza (Turkcell, Vodafone, TT) API entegrasyonu.

