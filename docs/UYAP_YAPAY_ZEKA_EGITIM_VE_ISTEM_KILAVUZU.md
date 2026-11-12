# UYAP & Türk Yargı Belgeleri İçin Yapay Zeka Model Eğitim ve İstem Kılavuzu

Bu belge, UYAP Kelime İşlemci (UKİ) yapay zeka asistanının ve harici yerel modellerin (Ollama, WebLLM, Chrome Nano, Llama 3.2, Qwen 2.5, Gemma 2) Türk Hukuku evraklarını **hatasız, halüsinasyonsuz ve hukuki terimlere tam sadakatle** analiz etmesi için hazırlanmış eğitim ve prompt mühendisliği kılavuzudur.

---

## 1. Temel Hukuki Yanılgılar ve Çözümleri

Küçük parametreli yerel modellerin (0.6B - 3B) UYAP kararlarında en çok düştüğü yanılgılar şunlardır:

### ⚠️ Yanılgı 1: İddianame Sevk Talebi ile Hüküm Fıkrasını Karıştırmak
- **Hatalı Analiz Örneği**: *"Mahkeme sanıkların cezalandırılmasına karar vermiştir."*
- **Gerçek Durum**: Belgede *"Sanığın TCK 106/1 uyarınca cezalandırılması talebiyle kamu davası açılmış ise de ... delil yetersizliğinden BERAATİNE"* yazmaktadır.
- **Yapay Zeka Kuralı**:
  > **ALTIN KURAL**: Metin içindeki savcılık iddianamesi veya davacı talebi ne olursa olsun, nihai netice **yalnızca ve yalnızca `H Ü K Ü M` veya `GEREĞİ DÜŞÜNÜLDÜ` başlığının altındaki fıkraya** bakılarak söylenir. Hüküm fıkrasında `BERAAT` veya `CEZA VERİLMESİNE YER OLMADIĞINA` yazıyorsa sanık cezalandırılmamıştır!

### ⚠️ Yanılgı 2: Ceza Mahkemesinde HMK (Hukuk Muhakemeleri Kanunu) Zannetmek
- **Hatalı Analiz Örneği**: *"Asliye Ceza Mahkemesi kararında kanun yolu: HMK m. 345 uyarınca 2 haftadır."*
- **Gerçek Durum**: Ceza Mahkemeleri **5271 sayılı CMK (Ceza Muhakemesi Kanunu)** kapsamında yargılama yapar.
- **Yapay Zeka Kuralı**:
  - `Ağır Ceza`, `Asliye Ceza`, `Sulh Ceza`: **CMK m. 272-273** (İstinaf - 2 hafta / 7 gün).
  - `Asliye Hukuk`, `Sulh Hukuk`, `İş`, `Aile`, `Ticaret`: **HMK m. 341-345** (İstinaf - 2 hafta).
  - `İdare` ve `Vergi` Mahkemeleri: **İYUK m. 45** (İstinaf - 30 gün).

### ⚠️ Yanılgı 3: Esas ve Karar Numarası Ayrımı
- UYAP kararlarında formatlar değişkenlik gösterir:
  - `DOSYA NO : 2025/416 Esas`
  - `ESAS NO : 2025/416`
  - `2025/416 E.`
  Modeller yalnızca `ESAS NO` aramamalı, `DOSYA NO: [Yıl]/[Sıra] Esas` formatını da tanımalıdır.

---

## 2. Hüküm Türleri ve Tanımları Sözlüğü

| Karar Türü | İlgili Kanun | Hukuki Sonuç | Yapay Zekanın Yazması Gereken |
|---|---|---|---|
| **BERAAT** | CMK 223/2 | Sanık suçsuz bulunmuştur veya delil yetersizdir. Aklanmıştır. | "Sanığın aklanmasına / BERAATİNE karar verilmiştir. Ceza verilmemiştir." |
| **CEZA VERİLMESİNE YER OLMADIĞI** | CMK 223/4, TCK 129 | Ceza verilmesini gerektirmeyen hal vardır (örneğin karşılıklı hakaret). | "Kusur veya cezasızlık hali nedeniyle CEZA VERİLMESİNE YER OLMADIĞINA karar verilmiştir." |
| **HAGB** | CMK 231/5 | Hükmün Açıklanmasının Geri Bırakılması. 5 yıl denetim. Sabıkaya işlemez. | "Hükmün açıklanması 5 yıl süreyle geri bırakılmıştır." |
| **MAHKUMİYET** | CMK 223/5 | Hapis veya adli para cezası verilmiştir. | "Sanığın hapis / adli para cezası ile cezalandırılmasına karar verilmiştir." |
| **DÜŞME** | CMK 223/8 | Şikayetten vazgeçme, zamanaşımı veya ölüm. | "Davanın düşürülmesine karar verilmiştir." |
| **DAVANIN KABULÜ** | HMK 297 | Davacının talepleri haklı bulunmuştur. | "Davanın kabulüne karar verilmiştir." |
| **DAVANIN REDDİ** | HMK 297 | Davacının talepleri haksız bulunmuştur. | "Davanın reddine karar verilmiştir." |

---

## 3. Ollama Modelfile Eğitimi (Ollama İçin Özel Sistem Promptu)

Yerel makinenizde Ollama ile UYAP modelleri çalıştırmak için aşağıdaki `Modelfile` dosyasını kullanabilirsiniz:

```dockerfile
FROM qwen2.5:7b-instruct
# veya FROM llama3.2:3b

PARAMETER temperature 0.1
PARAMETER top_p 0.85
PARAMETER num_ctx 8192

SYSTEM """
Sen Türk Hukuku ve UYAP resmi adli evrakları konusunda uzmanlaşmış bir Yargı Analistisin.
Sana verilen UYAP mahkeme kararlarını, tensip zabıtlarını veya dilekçeleri analiz ederken:
1. İddianamedeki talepler ile Mahkemenin HÜKÜM fıkrasını asla birbirine karıştırma. 'Cezalandırılması talebiyle kamu davası açılmış ise de ... delil yetersizliğinden BERAATİNE' kararı BERAATTİR. Sanığın cezalandırıldığını asla iddia etme!
2. Ceza mahkemelerinde kanun yolu CMK'dır (CMK m. 272-273). Asla HMK uygulama. Hukuk mahkemelerinde HMK'dır.
3. Hüküm fıkrasındaki BERAAT, CEZA VERİLMESİNE YER OLMADIĞI, HAGB ve MAHKUMİYET ayrımlarını kesin hukuki terimlerle belirt.
4. Yalnızca metinde geçen gerçek vakıaları özetle; belgede olmayan hususları tahmin etme.
"""
```

---

## 4. JSON Formatında Eğitim Verisi

Projede [assets/data/uyap-ai-training-data.json](file:///d:/UYAP%20Kelime%20İşlemci/assets/data/uyap-ai-training-data.json) dosyasında yerel ve bulut yapay zeka modelleri için yapılandırılmış few-shot eğitim örnekleri ve kural tablosu bulunmaktadır.

