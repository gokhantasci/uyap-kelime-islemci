const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');

function loadAnalyzer() {
    const html = fs.readFileSync('index.html', 'utf8');
    const dom = new JSDOM(html, { url: 'http://localhost:8080', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
    const w = dom.window;
    w.fetch = async () => { throw new Error('offline'); };
    w.eval(fs.readFileSync('assets/js/uki-ai.js', 'utf8'));
    return { facts: (t) => w.UkiAI.extractLegalFacts(t), w };
}

const A0 = loadAnalyzer();
const plain = (x) => JSON.parse(JSON.stringify(x));
const A = { facts: (t) => plain(A0.facts(t)) };

const CEZA_BERAAT = `T.C.
SAKARYA
11. ASLİYE CEZA MAHKEMESİ
BASİT YARGILAMA USULÜ
BERAAT - C.V.Y.O
DOSYA NO : 2025/416 Esas
KARAR NO : 2025/885
GEREKÇELİ KARAR
MÜŞTEKİ SANIK : BİLGE DALGIÇ, İbrahim Halil ve Güldoğan kızı
MÜŞTEKİ SANIK : ÇAĞATAY DALGIÇ, İsa ve Sultane oğlu
SUÇ : Hakaret, Basit Tehdit
KARAR TARİHİ : 08/12/2025
Yukarıda açık kimliği yazılı sanık hakkında mahkememizde Basit Yargılama Usulü uygulanmak suretiyle yapılan yargılama sonunda hüküm kurulmuştur.
H Ü K Ü M: Gerekçesi yukarıda açıklandığı üzere;
1-Her ne kadar sanığın tehdit suçunu işlediği iddiası ile cezalandırılması talebi ile kamu davası açılmış ise de delil bulunmaması nedeniyle CMK 223/2-e gereğince sanığın BERAATİNE,
2-Müşteki sanıkların hakaret suçunu işlediği iddiası ile kamu davası açılmış ise de eylemlerin karşılıklı olduğu anlaşıldığından TCK 129/1 gereğince CEZA VERİLMESİNE YER OLMADIĞINA,
3-Yargılama giderinin sanıktan tahsiline,
Dair; basit yargılama usulüne göre kurulan iş bu hükme karşı, gerekçeli kararın tebliğinden itibaren İKİ HAFTA içinde CMK 252/1 maddesi uyarınca mahkememize İTİRAZ yolunun açık olduğu, karar kesinleşecektir.
Katip 270851
Hakim 190039`;

const CEZA_HAGB = `T.C.
ANKARA
5. ASLİYE CEZA MAHKEMESİ
ESAS NO : 2024/77
KARAR NO : 2025/12
SANIK : AHMET YILMAZ
SUÇ : Kasten Yaralama
H Ü K Ü M:
1-Sanığın TCK 86/2 maddesi gereğince 5 AY HAPİS CEZASI İLE CEZALANDIRILMASINA,
2-Sanığa verilen cezanın CMK 231/5 uyarınca HÜKMÜN AÇIKLANMASININ GERİ BIRAKILMASINA, 5 yıl denetim süresi belirlenmesine,
Dair; karara karşı tebliğden itibaren YEDİ GÜN içinde Ankara Bölge Adliye Mahkemesi'ne gitmek üzere mahkememize itiraz yolu açıktır.`;

const CEZA_MAHKUMIYET = `T.C.
İZMİR
3. AĞIR CEZA MAHKEMESİ
ESAS NO : 2023/10
KARAR NO : 2024/55
SANIK : MEHMET DEMİR
SUÇ : Hırsızlık
H Ü K Ü M:
1-Sanığın TCK 142/1-b gereğince 3 YIL HAPİS CEZASI İLE CEZALANDIRILMASINA,
Dair; karar tebliğinden itibaren İKİ HAFTA içinde Bölge Adliye Mahkemesine İSTİNAF yolu açıktır.`;

const HUKUK_KABUL = `T.C.
İSTANBUL
4. ASLİYE HUKUK MAHKEMESİ
ESAS NO : 2024/112
KARAR NO : 2024/380
DAVACI : ALİ VELİ
DAVALI : AYŞE FATMA
DAVA KONUSU : İtirazın iptali
H Ü K Ü M:
1-Davanın KABULÜNE,
2-5.000,00 TL vekalet ücretinin davalıdan alınarak davacıya verilmesine,
Dair; kararın tebliğinden itibaren İKİ HAFTA içinde İstanbul Bölge Adliye Mahkemesi'ne İSTİNAF yolu açıktır.`;

const HUKUK_YANLIS_SURE = `T.C.
BURSA
2. ASLİYE HUKUK MAHKEMESİ
ESAS NO : 2024/9
KARAR NO : 2024/21
DAVACI : A
DAVALI : B
H Ü K Ü M:
1-Davanın REDDİNE,
Dair; kararın tebliğinden itibaren ON GÜN içinde Bölge Adliye Mahkemesi'ne İSTİNAF yolu açıktır.`;

const IDARE = `T.C.
ANKARA
3. İDARE MAHKEMESİ
ESAS NO : 2023/500
KARAR NO : 2024/100
DAVACI : XYZ A.Ş.
DAVALI : Maliye Bakanlığı
H Ü K Ü M:
1-Dava konusu işlemin İPTALİNE,
Dair; tebliğden itibaren 30 GÜN içinde Bölge İdare Mahkemesi'ne İSTİNAF yolu açıktır.`;

const GOREVSIZ = `T.C.
KOCAELİ
1. SULH HUKUK MAHKEMESİ
ESAS NO : 2024/300
KARAR NO : 2024/310
DAVACI : A
DAVALI : B
H Ü K Ü M:
1-Mahkememizin GÖREVSİZLİĞİNE,
2-Kesinleşmesinden sonra iki hafta içinde başvuru halinde dosyanın görevli Asliye Hukuk Mahkemesine gönderilmesine,`;

test('Hüküm bloğu yalnızca "H Ü K Ü M" başlığından başlar ve maddelere ayrılır', () => {
    const f = A.facts(CEZA_BERAAT);
    assert.ok(/^H\s*Ü\s*K\s*Ü\s*M/.test(f.verdict.trim()), 'hüküm "hüküm kurulmuştur" ibaresinden değil başlıktan başlamalı: ' + f.verdict.slice(0, 40));
    assert.equal(f.verdictItems.length, 3);
    assert.deepEqual(f.verdictItems.map(i => i.type), ['BERAAT', 'CEZA_VERILMEMESI', 'GIDER']);
    assert.equal(f.decisionNo, '2025/885');
    assert.equal(f.basisNo.replace(/\s*Esas$/i, ''), '2025/416');
});

test('Beraat kararında "cezalandırılması talebi" ifadesi mahkumiyet sanılmaz', () => {
    const f = A.facts(CEZA_BERAAT);
    assert.ok(!f.verdictTypes.includes('MAHKUMIYET'));
    assert.ok(f.verdictSummary.includes('BERAAT'));
    assert.ok(f.verdictSummary.includes('Cezalandırma yoktur'));
});

test('Kanun yolu belgede yazan süre ve merciden alınır (basit yargılamada 7 gün varsayılmaz)', () => {
    const f = A.facts(CEZA_BERAAT);
    assert.equal(f.remedy.kind, 'İTİRAZ');
    assert.equal(f.remedy.period, '2 hafta');
    assert.equal(f.remedy.statedInDocument, true);
    assert.ok(!/7 gün/.test(f.legalRemedy), f.legalRemedy);
    assert.ok(/CMK/.test(f.legalRemedy));
    assert.deepEqual(f.warnings, []);
});

test('HAGB + hapis cezası birlikte doğru sınıflanır ve mahkumiyet olarak da bildirilir', () => {
    const f = A.facts(CEZA_HAGB);
    assert.ok(f.verdictTypes.includes('HAGB'));
    assert.ok(f.verdictTypes.includes('MAHKUMIYET'));
    assert.ok(/HAGB|Geri Bırak/i.test(f.verdictSummary));
    assert.equal(f.remedy.kind, 'İTİRAZ');
    assert.equal(f.remedy.period, '7 gün');
});

test('Ağır ceza mahkumiyeti: istinaf 2 hafta, ceza miktarı özetlenir', () => {
    const f = A.facts(CEZA_MAHKUMIYET);
    assert.deepEqual(f.verdictTypes, ['MAHKUMIYET']);
    assert.ok(/3 yıl hapis/i.test(f.verdictSummary), f.verdictSummary);
    assert.equal(f.remedy.kind, 'İSTİNAF');
    assert.equal(f.remedy.period, '2 hafta');
    assert.deepEqual(f.warnings, []);
});

test('Hukuk kabul kararı: kabul + vekalet ücreti, HMK istinaf 2 hafta', () => {
    const f = A.facts(HUKUK_KABUL);
    assert.ok(f.verdictTypes.includes('KABUL'));
    assert.ok(!f.verdictTypes.includes('MAHKUMIYET'));
    assert.ok(f.verdictItems.some(i => i.type === 'GIDER'));
    assert.equal(f.remedy.period, '2 hafta');
    assert.ok(/HMK/.test(f.legalRemedy));
    assert.ok(!/CMK/.test(f.legalRemedy));
    assert.deepEqual(f.warnings, []);
});

test('Belgedeki süre kanuni süreyle çelişirse uyarı üretilir', () => {
    const f = A.facts(HUKUK_YANLIS_SURE);
    assert.ok(f.verdictTypes.includes('RED'));
    assert.equal(f.warnings.length, 1);
    assert.ok(/10 gün|2 hafta/.test(f.warnings[0]));
});

test('İdare mahkemesi: iptal + 30 gün istinaf, İYUK', () => {
    const f = A.facts(IDARE);
    assert.ok(f.verdictTypes.includes('IPTAL'));
    assert.equal(f.remedy.period, '30 gün');
    assert.ok(/İYUK/.test(f.legalRemedy));
    assert.deepEqual(f.warnings, []);
});

test('Görevsizlik kararı sınıflanır ve mahkumiyet sanılmaz', () => {
    const f = A.facts(GOREVSIZ);
    assert.ok(f.verdictTypes.includes('GOREVSIZLIK'));
    assert.ok(!f.verdictTypes.includes('MAHKUMIYET'));
});

test('Eğitim verisindeki örnekler analizci çıktısıyla uyumlu', () => {
    const data = JSON.parse(fs.readFileSync('assets/data/uyap-ai-training-data.json', 'utf8'));
    for (const ex of data.training_examples) {
        const f = A.facts(ex.input_text);
        const want = ex.ideal_output;
        if (want.decision_no) assert.equal(f.decisionNo, want.decision_no, ex.id + ' karar no');
        if (want.basis_no) assert.equal(f.basisNo.replace(/\s*Esas$/i, ''), want.basis_no.replace(/\s*Esas$/i, ''), ex.id + ' esas no');
        if (want.expected_verdict_types) assert.deepEqual([...new Set(f.verdictTypes)].sort(), [...want.expected_verdict_types].sort(), ex.id + ' hüküm türleri');
        if (want.expected_remedy_period) assert.equal(f.remedy.period, want.expected_remedy_period, ex.id + ' süre');
    }
    assert.ok(data.training_examples.length >= 8, 'eğitim seti en az 8 örnek içermeli');
});
