const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');

function load(htmlBody) {
    const html = fs.readFileSync('index.html', 'utf8');
    const dom = new JSDOM(html, { url: 'http://localhost:8080', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
    const w = dom.window;
    w.fetch = async () => { throw new Error('offline'); };
    w.eval(fs.readFileSync('assets/js/uki-outline.js', 'utf8'));
    w.document.getElementById('editor').innerHTML = htmlBody;
    return w;
}
const p = (t) => `<p>${t}</p>`;
const labels = (w) => JSON.parse(JSON.stringify(w.UkiOutline.scan().map(h => h.key)));

test('Ceza gerekçeli kararı: iddia, savunma, beyan, deliller, nitelendirme, hüküm bölümleri', () => {
    const w = load([
        'T.C.', 'SAKARYA 11. ASLİYE CEZA MAHKEMESİ', 'GEREKÇELİ KARAR', 'T Ü R K   M İ L L E T İ   A D I N A',
        'SANIK : AHMET YILMAZ', 'SUÇ : Hakaret', 'İDDİA:', 'Sakarya Cumhuriyet Başsavcılığının iddianamesi ile ...',
        'SAVUNMA:', 'Sanık savunmasında ...', 'KATILAN BEYANI', 'TANIK BEYANLARI', 'DELİLLER:', 'DELİLLERİN DEĞERLENDİRİLMESİ',
        'HUKUKİ NİTELENDİRME', 'CEZA TAYİNİ', 'H Ü K Ü M:', '1-Sanığın BERAATİNE,', 'Dair; karar tebliğinden itibaren iki hafta içinde ...'
    ].map(p).join(''));
    const k = labels(w);
    for (const want of ['turk_milleti', 'taraf', 'konu', 'iddia', 'savunma', 'beyan', 'delil', 'nitelendirme', 'ceza_tayini', 'hukum', 'kanun_yolu']) {
        assert.ok(k.includes(want), want + ' bulunamadı: ' + k.join(','));
    }
    assert.equal(k.filter(x => x === 'taraf').length, 1, 'ardışık taraf satırları tek öğe olmalı');
});

test('İdari yargı kararı (Danıştay Karar Yazım Rehberi başlıkları)', () => {
    const w = load([
        'ANKARA 3. İDARE MAHKEMESİ', 'DAVANIN TARAFLARI :', 'DAVANIN KONUSU :', 'DAVACININ İDDİALARI :', 'DAVALININ SAVUNMASI :',
        'DANIŞTAY TETKİK HAKİMİNİN DÜŞÜNCESİ :', 'DANIŞTAY SAVCISININ DÜŞÜNCESİ :', 'MADDİ OLAY VE HUKUKİ SÜREÇ :', 'İLGİLİ MEVZUAT :',
        'İNCELEME VE GEREKÇE :', 'HUKUKİ DEĞERLENDİRME :', 'KARAR SONUCU :', 'YARGILAMA GİDERLERİ :', 'HEYET BAŞKAN VE ÜYELERİNİN ADLARI :'
    ].map(p).join(''));
    const k = labels(w);
    for (const want of ['taraf', 'konu', 'iddia', 'savunma', 'mutalaa', 'olay', 'mevzuat', 'gerekce', 'nitelendirme', 'hukum', 'gider', 'heyet']) {
        assert.ok(k.includes(want), want + ' bulunamadı: ' + k.join(','));
    }
    assert.equal(k.filter(x => x === 'mutalaa').length, 2);
});

test('Hukuk kararı ve dilekçeler', () => {
    const w = load([
        'DAVA DİLEKÇESİ', 'AÇIKLAMALAR:', 'HUKUKİ SEBEPLER:', 'HUKUKİ DELİLLER:', 'SONUÇ VE İSTEM:',
        'CEVAP DİLEKÇESİ', 'BİLİRKİŞİ RAPORU', 'ESAS HAKKINDAKİ MÜTALAA'
    ].map(p).join(''));
    const k = labels(w);
    for (const want of ['dilekce', 'aciklama', 'hukuki_sebep', 'delil', 'sonuc_istem', 'bilirkisi', 'mutalaa']) {
        assert.ok(k.includes(want), want + ' bulunamadı: ' + k.join(','));
    }
    assert.equal(k.filter(x => x === 'dilekce').length, 2);
});

test('Sıradan cümleler başlık sayılmaz; "DAVACI : K.H." yalnızca taraf olur', () => {
    const w = load([
        p('Bu davada davacı vekili iddia olarak sözleşmenin feshini ileri sürmüştür ve savunma almıştır.'),
        p('Mahkememizce delillerin toplanmasına karar verilmiştir.'),
        p('DAVACI : K.H.')
    ].join(''));
    assert.deepEqual(labels(w), ['taraf']);
});

test('Kullanıcının H1-H3 başlıkları korunur', () => {
    const w = load('<h1>Benim Başlığım</h1><h2>Alt başlık</h2><p>İDDİA:</p>');
    const list = JSON.parse(JSON.stringify(w.UkiOutline.scan()));
    assert.deepEqual(list.map(h => h.level), [1, 2, 1]);
    assert.equal(list[0].text, 'Benim Başlığım');
});
