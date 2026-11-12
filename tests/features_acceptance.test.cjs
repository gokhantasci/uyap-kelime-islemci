const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function initDom() {
    const store = {};
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="workspace-container" class="workspace-container"><div id="page-wrapper" class="page-wrapper"><div id="editor" contenteditable="true"><p>Test</p></div></div></div></body></html>', {
        url: 'http://localhost:8080/'
    });
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    global.Node = dom.window.Node;
    global.DOMParser = dom.window.DOMParser;
    global.XMLSerializer = dom.window.XMLSerializer;
    global.Image = dom.window.Image;
    global.getComputedStyle = dom.window.getComputedStyle ? dom.window.getComputedStyle.bind(dom.window) : () => ({});
    const memoryStorage = {
        getItem: (k) => store[k] !== undefined ? store[k] : null,
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); }
    };
    try {
        if (!dom.window.localStorage || typeof dom.window.localStorage.getItem !== 'function') {
            dom.window.localStorage = memoryStorage;
        }
    } catch (e) {
        dom.window.localStorage = memoryStorage;
    }
    global.localStorage = dom.window.localStorage;
    const jszip = require('../assets/vendor/jszip.min.js');
    global.JSZip = jszip;
    dom.window.JSZip = jszip;
    return dom;
}

test('UDF Roundtrip: örnek karar.udf dışa aktarımı üstbilgi sekmeleri, altbilgi ve webID değerini korur', async () => {
    const dom = initDom();
    const ukiCoreCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-core.js'), 'utf8');
    eval(ukiCoreCode);

    const buf = fs.readFileSync(path.resolve(__dirname, '../examples/örnek karar.udf'));
    const model = await dom.window.UkiCore.parseUdf(buf);

    assert.ok(model.webId, 'webId ayrıştırılmalı');
    assert.ok(model.headerElement, 'headerElement ayrıştırılmalı');
    assert.ok(model.footerElement, 'footerElement ayrıştırılmalı');

    const html = dom.window.UkiCore.udfModelToHtml(model);
    const editorEl = dom.window.document.getElementById('editor');
    editorEl.innerHTML = html;

    const pageProps = Object.assign({}, model.pageProperties, {
        headerInfo: {
            left: 'T.C. SAKARYA 11. ASLİYE CEZA MAHKEMESİ',
            right: 'Dosya-Karar No: 2025/416 Esas - 2025/885',
            startPage: 2
        },
        footerInfo: {
            showPageNumber: true,
            webId: model.webId
        },
        webId: model.webId
    });

    const exportedBlob = await dom.window.UkiCore.exportUdfBlob(editorEl, pageProps);
    const exportedBuf = Buffer.from(await exportedBlob.arrayBuffer());
    const reloaded = await dom.window.UkiCore.parseUdf(exportedBuf);

    assert.equal(reloaded.webId, model.webId, 'Yeniden açılan UDF aynı webID değerini taşımalı');
    assert.ok(reloaded.headerElement, 'Yeniden açılan UDF üst bilgi taşımalı');
    assert.ok(reloaded.footerElement, 'Yeniden açılan UDF alt bilgi taşımalı');
    assert.ok(reloaded.headerInfo, 'Yeniden açılan UDF headerInfo taşımalı');
    assert.equal(reloaded.headerInfo.startPage, 2, 'Üst bilgi startPage=2 olmalı');
    assert.ok(reloaded.headerInfo.left.includes('SAKARYA'), 'Üst bilgi sol metin korunmalı');
    assert.ok(reloaded.headerInfo.right.includes('Dosya-Karar'), 'Üst bilgi sağ metin korunmalı');
});

test('DOCX Dışa Aktarma: OpenXML pPr ve sectPr etiket sıralaması Microsoft Word şemasına uygundur', async () => {
    const dom = initDom();
    const ukiCoreCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-core.js'), 'utf8');
    eval(ukiCoreCode);

    const editorEl = dom.window.document.getElementById('editor');
    editorEl.innerHTML = '<p data-tabset="70.0:2:0">Paragraf 1</p><p>Paragraf 2\tSekme</p>';

    const docxBlob = await dom.window.UkiCore.exportDocxBlob(editorEl, {}, {
        headerInfo: { left: 'Başlık', right: 'Dosya No' },
        webId: 'ABC-123'
    });
    const docxBuf = Buffer.from(await docxBlob.arrayBuffer());
    const zip = await dom.window.JSZip.loadAsync(docxBuf);

    const docXml = await zip.file('word/document.xml').async('text');
    const hdrXml = await zip.file('word/header1.xml').async('text');
    const ftrXml = await zip.file('word/footer1.xml').async('text');

    assert.ok(docXml.indexOf('<w:sectPr>') > 0, 'w:sectPr bulunmalı');
    assert.ok(docXml.indexOf('<w:pgSz') < docXml.indexOf('<w:titlePg/>'), 'pgSz titlePg etiketinden önce gelmeli');
    assert.ok(docXml.indexOf('<w:pgMar') < docXml.indexOf('<w:titlePg/>'), 'pgMar titlePg etiketinden önce gelmeli');
    assert.ok(docXml.indexOf('<w:tabs>') < docXml.indexOf('<w:spacing'), 'tabs spacing etiketinden önce gelmeli');
    assert.ok(hdrXml.indexOf('<w:tabs>') < hdrXml.indexOf('<w:spacing'), 'header tabs spacing öncesinde yer almalı');
    assert.ok(ftrXml.indexOf('<w:fldSimple w:instr="PAGE">') >= 0, 'footer fldSimple run içermeli');
});

test('KVKK Maskeleme: TC Kimlik No, telefon, IBAN ve isimleri algılar ve maskeler', () => {
    const dom = initDom();
    const kvkkCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-kvkk.js'), 'utf8');
    eval(kvkkCode);

    const editorEl = dom.window.document.getElementById('editor');
    editorEl.innerHTML = '<p>Müşteki: Ahmet YILMAZ, TC: 12345678901, Tel: 0532 111 22 33, IBAN: TR33 0006 1005 1978 6457 8410 25.</p>';

    const findings = dom.window.UkiKvkk.scanDocument(editorEl);
    assert.ok(findings.length >= 3, 'En az 3 hassas veri tespit edilmeli');

    const tcItem = findings.find(f => f.type === 'tc');
    assert.ok(tcItem, 'TC Kimlik No bulunmalı');
    assert.equal(tcItem.original, '12345678901');

    const phoneItem = findings.find(f => f.type === 'phone');
    assert.ok(phoneItem, 'Telefon bulunmalı');

    const ibanItem = findings.find(f => f.type === 'iban');
    assert.ok(ibanItem, 'IBAN bulunmalı');

    const replacedCount = dom.window.UkiKvkk.applyRedaction(editorEl, findings);
    assert.ok(replacedCount >= 3, 'Kişisel veriler maskelenmeli');
    assert.ok(editorEl.textContent.indexOf('12345678901') === -1, 'TC metinden silinmiş olmalı');
});

test('Şablon Motoru: Değişkenleri tespit eder ve doldurma linki üretir', () => {
    const dom = initDom();
    const tplCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-templates.js'), 'utf8');
    eval(tplCode);

    const tplContent = '<p>T.C. {{MAHKEME}} HAKİMLİĞİNE, Davacı: {{DAVACI}}.</p>';
    const vars = dom.window.UkiTemplates.extractVariables(tplContent);
    assert.deepEqual(vars, ['MAHKEME', 'DAVACI']);

    const filled = dom.window.UkiTemplates.fillTemplate(tplContent, {
        MAHKEME: 'ANKARA 1. ASLİYE CEZA',
        DAVACI: 'MEHMET DEMİR'
    });
    assert.equal(filled, '<p>T.C. ANKARA 1. ASLİYE CEZA HAKİMLİĞİNE, Davacı: MEHMET DEMİR.</p>');
});

test('Yazma Hızı (WPM): Türkçe DKB ve Olimpiyat vuruş hesabı doğru çalışır', () => {
    const dom = initDom();
    const typingCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-typing.js'), 'utf8');
    eval(typingCode);

    dom.window.UkiTyping.init(dom.window.document.getElementById('editor'));
    // 25 karakter = 5 kelime (Olimpiyat standardı)
    'Merhaba dünya test kelime '.split('').forEach(ch => {
        dom.window.UkiTyping.recordKeystroke(ch);
    });

    const stats = dom.window.UkiTyping.getStats();
    assert.equal(stats.totalChars, 26);
    assert.equal(stats.totalWords, 4);
    assert.ok(stats.olympicWpm >= 0, 'Olimpiyat WPM hesaplanmalı');
});

test('Kullanıcı Özel Maskeleme (KVKK): Kullanıcı her verinin yerine konacak metni kendisi belirleyebilir', () => {
    const dom = initDom();
    const kvkkCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-kvkk.js'), 'utf8');
    eval(kvkkCode);

    const editorEl = dom.window.document.getElementById('editor');
    editorEl.innerHTML = '<p>Sanık Ali KAYA, TC: 98765432101, Araç: 34 ABC 789, E-posta: avukat@test.com</p>';

    const findings = dom.window.UkiKvkk.scanDocument(editorEl);
    assert.ok(findings.some(f => f.type === 'tc'));
    assert.ok(findings.some(f => f.type === 'plate'));
    assert.ok(findings.some(f => f.type === 'email'));

    // Kullanıcının her bulgu için özel belirlediği maskeler
    const userCustomSelections = [
        { original: '98765432101', replacement: '[ÖZEL-TCKN-987]' },
        { original: '34 ABC 789', replacement: '[34-PLAKA-MASKE]' },
        { original: 'avukat@test.com', replacement: '[GİZLİ-EPOSTA]' }
    ];

    const replaced = dom.window.UkiKvkk.applyRedaction(editorEl, userCustomSelections);
    assert.equal(replaced, 3);
    assert.ok(editorEl.textContent.includes('[ÖZEL-TCKN-987]'));
    assert.ok(editorEl.textContent.includes('[34-PLAKA-MASKE]'));
    assert.ok(editorEl.textContent.includes('[GİZLİ-EPOSTA]'));
    assert.ok(!editorEl.textContent.includes('98765432101'));
});

test('Sayfa Numarası Genişletilmiş Stiller, Hizalama ve Ön Metin (Prefix)', () => {
    const dom = initDom();
    const pagesCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-pages.js'), 'utf8');
    eval(pagesCode);

    // 1. Romen rakamı ve 'Sayfa ' önek testi
    dom.window.UkiPages.setPageNumber({
        showPageNumber: true,
        pageNumberFormat: 'roman',
        pageNumberAlign: 'center',
        pageNumberForeStr: 'Sayfa ',
        showPageNumberOnFirstPage: true
    });

    const cfg = dom.window.UkiPages.getConfig();
    assert.equal(cfg.pageNumberFormat, 'roman');
    assert.equal(cfg.pageNumberAlign, 'center');
    assert.equal(cfg.pageNumberForeStr, 'Sayfa ');

    // 2. Noktalı sıra no ve sol hizalama testi
    dom.window.UkiPages.setPageNumber({
        showPageNumber: true,
        pageNumberFormat: 'dot',
        pageNumberAlign: 'left',
        pageNumberForeStr: 'Ek: '
    });

    const cfg2 = dom.window.UkiPages.getConfig();
    assert.equal(cfg2.pageNumberFormat, 'dot');
    assert.equal(cfg2.pageNumberAlign, 'left');
    assert.equal(cfg2.pageNumberForeStr, 'Ek: ');
});

test('Şablon Kütüphanesi ve Bağlantı Çözümleme: Sisteme entegrasyon ve paylaşım', () => {
    const dom = initDom();
    const tplCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-templates.js'), 'utf8');
    eval(tplCode);

    const rawTpl = '<p>Sayın {{HAKIMLIK}}, Müvekkil {{DAVACI}} adına {{TUTAR}} TL alacak talebi.</p>';
    const link = dom.window.UkiTemplates.createShareableLink('İcra Takip Şablonu', rawTpl);
    assert.ok(link.includes('#template='), 'Bağlantı #template= içermeli');

    // Hash simülasyonu
    dom.window.location.hash = link.substring(link.indexOf('#template='));
    const parsed = dom.window.UkiTemplates.parseHashTemplate();
    assert.ok(parsed, 'Paylaşılan şablon hash üzerinden çözümlenmeli');
    assert.equal(parsed.title, 'İcra Takip Şablonu');
    assert.deepEqual(parsed.variables, ['HAKIMLIK', 'DAVACI', 'TUTAR']);

    // Kütüphaneye kaydetme ve entegrasyon testi
    const savedOk = dom.window.UkiTemplates.saveToLibrary(parsed);
    assert.equal(savedOk, true);

    const library = dom.window.UkiTemplates.getLibrary();
    assert.ok(library.some(t => t.title === 'İcra Takip Şablonu'));

    // Kütüphaneden silme testi
    dom.window.UkiTemplates.removeFromLibrary('İcra Takip Şablonu');
    const libraryAfter = dom.window.UkiTemplates.getLibrary();
    assert.ok(!libraryAfter.some(t => t.title === 'İcra Takip Şablonu'));
});

test('Embed SDK ve WordPress Eklentisi: Tek komutla gömme ve eklenti dosyaları eksiksizdir', () => {
    assert.ok(fs.existsSync(path.resolve(__dirname, '../embed.html')), 'embed.html mevcut olmalı');
    assert.ok(fs.existsSync(path.resolve(__dirname, '../embed.js')), 'embed.js mevcut olmalı');
    
    const wpPluginPath = path.resolve(__dirname, '../wordpress-plugin/uyap-kelime-islemci/uyap-kelime-islemci.php');
    assert.ok(fs.existsSync(wpPluginPath), 'WordPress eklentisi uyap-kelime-islemci.php mevcut olmalı');

    const wpPhpContent = fs.readFileSync(wpPluginPath, 'utf8');
    assert.ok(wpPhpContent.includes('add_shortcode(\'uyap_editor\''), '[uyap_editor] kısa kodu tanımlanmalı');
    assert.ok(wpPhpContent.includes('add_shortcode(\'uyap_viewer\''), '[uyap_viewer] kısa kodu tanımlanmalı');
});

test('Üst Yazı ve Alt Yazıya Çift Tıklama (Inline Edit): Yerinde düzenleme ve kaydetme', () => {
    const dom = initDom();
    const pagesCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-pages.js'), 'utf8');
    eval(pagesCode);

    const editorEl = dom.window.document.getElementById('editor');
    dom.window.UkiPages.init(editorEl);

    // 1. Üst Yazı çift tıklama & inline düzenleme
    dom.window.UkiPages.setHeader({
        left: 'T.C. ANKARA 1. ASLİYE CEZA MAHKEMESİ',
        right: 'Dosya-Karar No: 2026/10',
        startPage: 1
    });

    const headerEl = dom.window.document.querySelector('.pb-header');
    assert.ok(headerEl, 'Üst yazı öğesi oluşturulmalı');
    assert.equal(headerEl.title, 'Üst Yazı (Düzenlemek için çift tıklayın)');

    // Çift tıklama simülasyonu
    headerEl.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true }));

    assert.ok(headerEl.classList.contains('pb-header-editing'), 'Düzenleme sınıfı eklenmeli');
    assert.ok(headerEl.querySelector('.pb-inline-toolbar'), 'Inline araç çubuğu eklenmeli');

    const leftEl = headerEl.querySelector('.pb-header-left');
    const rightEl = headerEl.querySelector('.pb-header-right');
    assert.equal(leftEl.getAttribute('contenteditable'), 'true');
    assert.equal(rightEl.getAttribute('contenteditable'), 'true');

    // Metin değiştirme ve kaydetme
    leftEl.textContent = 'T.C. İSTANBUL 5. ASLİYE CEZA MAHKEMESİ';
    rightEl.textContent = 'Dosya-Karar No: 2026/999';

    const saveBtn = headerEl.querySelector('.btn-save-inline');
    assert.ok(saveBtn, 'Kaydet butonu bulunmalı');
    saveBtn.click();

    const updatedH = dom.window.UkiPages.getHeader();
    assert.equal(updatedH.left, 'T.C. İSTANBUL 5. ASLİYE CEZA MAHKEMESİ');
    assert.equal(updatedH.right, 'Dosya-Karar No: 2026/999');

    // 2. Alt Yazı çift tıklama & inline düzenleme
    const fDiv = dom.window.document.createElement('div');
    fDiv.className = 'pb-footer pb-footer-text';
    fDiv.textContent = 'Eski Alt Yazı';
    dom.window.document.body.appendChild(fDiv);

    dom.window.UkiPages.startFooterTextInlineEdit(fDiv);
    assert.ok(fDiv.classList.contains('pb-footer-editing'));
    assert.equal(fDiv.getAttribute('contenteditable'), 'true');

    const footerSaveBtn = fDiv.querySelector('.btn-save-inline');
    assert.ok(footerSaveBtn, 'Alt yazı kaydet butonu bulunmalı');
    
    // Metin değiştirme simülasyonu
    fDiv.childNodes[0].nodeValue = 'Yeni Güncellenen Dipnot Alt Yazısı';
    footerSaveBtn.click();

    const cfg = dom.window.UkiPages.getConfig();
    assert.ok(cfg.footerParas[0].runs[0].text.includes('Yeni Güncellenen Dipnot'));
});

test('udf.657.com.tr Varsayılan Görünüm: İlk açılışta ve varsayılan olarak light (Aydınlık) tema uygulanır', () => {
    // 1. index.html başlangıç data-theme özelliği
    const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    assert.ok(indexHtml.includes('<html lang="tr" data-theme="light">'), 'index.html varsayılan olarak data-theme="light" taşımalı');

    // 2. app.js tema başlatma simülasyonu
    const dom = initDom();
    const doc = dom.window.document;
    const localStorage = dom.window.localStorage;

    // Simüle edilen tema mantığı (app.js ile birebir)
    function testThemeInit(searchQuery = '') {
        const urlParams = new dom.window.URLSearchParams(searchQuery);
        const urlTheme = urlParams.get('theme');
        let initialTheme = 'light';
        if (urlTheme === 'light' || urlTheme === 'dark') {
            initialTheme = urlTheme;
        } else {
            const storedTheme = localStorage.getItem('uki-theme');
            const isExplicit = localStorage.getItem('uki-theme-explicit') === 'true';
            if (storedTheme === 'dark' && isExplicit) {
                initialTheme = 'dark';
            } else {
                initialTheme = 'light';
            }
        }
        doc.documentElement.setAttribute('data-theme', initialTheme);
        localStorage.setItem('uki-theme', initialTheme);
        return initialTheme;
    }

    // A) İlk ziyaret: Hiçbir ayar yokken varsayılan light olmalı
    localStorage.clear();
    const t1 = testThemeInit('');
    assert.equal(t1, 'light', 'Varsayılan tema light olmalı');
    assert.equal(doc.documentElement.getAttribute('data-theme'), 'light');

    // B) Eski otomatik dark kaydedilmiş olsa bile (explicit bayrağı yoksa) light olmalı
    localStorage.setItem('uki-theme', 'dark');
    const t2 = testThemeInit('');
    assert.equal(t2, 'light', 'Eski örtük dark seçimi ezilmeli ve light açılmalı');

    // C) Kullanıcı açıkça koyu temayı seçtiğinde (explicit=true) dark olmalı
    localStorage.setItem('uki-theme', 'dark');
    localStorage.setItem('uki-theme-explicit', 'true');
    const t3 = testThemeInit('');
    assert.equal(t3, 'dark', 'Açıkça seçilen koyu tema korunmalı');

    // D) URL parametresi (?theme=light) gelirse dark tercihi olsa dahi light uygulanmalı
    const t4 = testThemeInit('?theme=light');
    assert.equal(t4, 'light', '?theme=light parametresi uygulanmalı');
});

test('Resim Ekle/Düzenle (UkiImage) ve Grafik Şerit Paritesi: Görsel ekleme, boyutlandırma, UDF roundtrip, sembol ve barkod', async () => {
    const dom = initDom();
    const doc = dom.window.document;
    const coreCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-core.js'), 'utf8');
    eval(coreCode);
    const imgCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-image.js'), 'utf8');
    eval(imgCode);

    const editorEl = doc.getElementById('editor');
    assert.ok(editorEl, 'Editör öğesi mevcut olmalı');

    // 1. Resim Ekleme (insertImage)
    const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const insertedImg = dom.window.UkiImage.insertImage(testDataUrl);
    assert.ok(insertedImg, 'Resim öğesi oluşturulmalı');
    assert.ok(insertedImg.classList.contains('udf-img'), 'Resim .udf-img sınıfına sahip olmalı');
    assert.equal(insertedImg.getAttribute('contenteditable'), 'false');
    assert.ok(editorEl.contains(insertedImg), 'Resim editör içine yerleştirilmeli');

    // 2. Resim Seçme (selectImage) ve Kulp/Araç Çubuğu Kontrolü
    const pageWrapper = doc.getElementById('page-wrapper');
    pageWrapper.getBoundingClientRect = () => ({ top: 40, left: 300, width: 794, height: 1122 });
    insertedImg.getBoundingClientRect = () => ({ top: 120, left: 390, width: 240, height: 180 });

    dom.window.UkiImage.selectImage(insertedImg);
    assert.ok(insertedImg.classList.contains('udf-img-selected'), 'Seçilen resim .udf-img-selected almalı');
    const overlay = doc.querySelector('.uki-img-overlay');
    assert.ok(overlay, 'Overlay katmanı oluşturulmalı');
    assert.ok(pageWrapper.contains(overlay), 'Overlay katmanı page-wrapper içine konumlanmalı');
    assert.equal(pageWrapper.style.position, 'relative', 'page-wrapper position: relative olmalı');
    assert.equal(overlay.style.top, '80px', 'Overlay top resim ile birebir eşleşmeli (120 - 40)');
    assert.equal(overlay.style.left, '90px', 'Overlay left resim ile birebir eşleşmeli (390 - 300)');
    const handles = overlay.querySelectorAll('.img-handle');
    assert.equal(handles.length, 8, '8 adet boyutlandırma kulpu bulunmalı (nw, n, ne, e, se, s, sw, w)');

    // 3. Resim Boyut ve Stil Özellikleri
    insertedImg.style.width = '240px';
    insertedImg.style.height = '180px';
    insertedImg.style.float = 'left';
    insertedImg.style.border = '2px solid rgb(0, 0, 0)';
    insertedImg.style.filter = 'grayscale(100%)';

    assert.equal(insertedImg.style.width, '240px');
    assert.equal(insertedImg.style.float, 'left');

    // 4. UDF Dışa Aktarım (exportUdfBlob) ve Yeniden Açma (Roundtrip)
    const udfBlob = await dom.window.UkiCore.exportUdfBlob(editorEl, {});
    assert.ok(udfBlob, 'UDF bloğu başarıyla üretilmeli');
    const buf = await udfBlob.arrayBuffer();
    const parsedModel = await dom.window.UkiCore.parseUdf(buf);
    
    // Modelde image öğesi bulunmalı
    let foundImageRun = false;
    for (const el of parsedModel.elements || []) {
        if (el.type === 'paragraph') {
            for (const r of el.runs || []) {
                if (r.type === 'image' || r.imageData) {
                    foundImageRun = true;
                    assert.ok(r.imageData.length > 10, 'Görsel base64 verisi korunmalı');
                    assert.equal(r.imgWidth, '240', 'Görsel genişliği korunmalı');
                    assert.equal(r.imgHeight, '180', 'Görsel yüksekliği korunmalı');
                }
            }
        }
    }
    assert.ok(foundImageRun, 'UDF XML içinde <image> etiketi başarıyla oluşturulmalı ve ayrıştırılmalı');

    // 5. Sembol Ekleme (insertSymbol)
    dom.window.UkiImage.insertSymbol('§');
    assert.ok(editorEl.innerHTML.includes('§'), 'Kanun maddesi sembolü (§) eklenmeli');

    // 6. Barkod Ekleme (insertBarcode)
    dom.window.UkiImage.insertBarcode('12345678911');
    const barcodeEl = editorEl.querySelector('.udf-barcode');
    assert.ok(barcodeEl, 'Barkod öğesi oluşturulmalı');
    assert.equal(barcodeEl.getAttribute('data-barcode'), '12345678911');

    // 7. Resim Silme (deleteSelectedImage)
    dom.window.UkiImage.selectImage(insertedImg);
    dom.window.UkiImage.deleteSelectedImage();
    assert.ok(!editorEl.contains(insertedImg), 'Resim belgeden silinmeli');
});

test('KVKK & Yapay Zeka: Gerçek UDF belgesinde (örnek karar.udf) çoklu span taraf isimleri, adres, anne/baba adı ve TC maskeleme', async () => {
    const dom = initDom();
    const ukiCoreCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-core.js'), 'utf8');
    eval(ukiCoreCode);
    const ukiKvkkCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-kvkk.js'), 'utf8');
    eval(ukiKvkkCode);

    // Mock AI entegrasyonu
    dom.window.UkiAI = {
        scanKvkkWithAI: async (text) => {
            return [
                { type: 'person', label: 'Taraf / Şahıs Adı', original: 'BİLGE', replacement: 'B***', source: 'ai' },
                { type: 'person', label: 'Taraf / Şahıs Adı', original: 'ÇAĞATAY', replacement: 'Ç***', source: 'ai' }
            ];
        }
    };

    const buf = fs.readFileSync(path.resolve(__dirname, '../examples/örnek karar.udf'));
    const model = await dom.window.UkiCore.parseUdf(buf);
    const html = dom.window.UkiCore.udfModelToHtml(model);
    const editorEl = dom.window.document.getElementById('editor');
    editorEl.innerHTML = html;

    // 1. Kural tabanlı tarama
    const findings = dom.window.UkiKvkk.scanDocument(editorEl);
    assert.ok(findings.length >= 8, 'Gerçek UDF belgesinden en az 8 hassas veri türü tespit edilmeli');

    // TC kontrolü
    const tcs = findings.filter(f => f.type === 'tc');
    assert.ok(tcs.some(f => f.original === '29155760072'), '29155760072 TC tespit edilmeli');
    assert.ok(tcs.some(f => f.original === '28589334248'), '28589334248 TC tespit edilmeli');

    // Taraf isimleri kontrolü
    const persons = findings.filter(f => f.type === 'person');
    assert.ok(persons.some(f => f.original === 'BİLGE DALGIÇ'), 'BİLGE DALGIÇ tespit edilmeli');
    assert.ok(persons.some(f => f.original === 'ÇAĞATAY DALGIÇ'), 'ÇAĞATAY DALGIÇ tespit edilmeli');

    // Mahkeme heyeti isimleri
    assert.ok(persons.some(f => f.original === 'Ayşe KAYA SAYDAM'), 'Ayşe KAYA SAYDAM tespit edilmeli');
    assert.ok(persons.some(f => f.original === 'Ayşenur ÇİÇEK'), 'Ayşenur ÇİÇEK tespit edilmeli');

    // Anne/baba ve doğum bilgileri
    const parents = findings.filter(f => f.type === 'parent');
    assert.ok(parents.length >= 2, 'Anne/baba soybağı tespit edilmeli');

    const births = findings.filter(f => f.type === 'birth');
    assert.ok(births.length >= 2, 'Doğum bilgileri tespit edilmeli');

    // Adres tespiti
    const addresses = findings.filter(f => f.type === 'address');
    assert.ok(addresses.length >= 2, 'İkametgah adresleri tespit edilmeli');

    // 2. Yapay Zeka ile tarama (scanWithAI)
    const aiFindings = await dom.window.UkiKvkk.scanWithAI(editorEl);
    assert.ok(aiFindings.some(f => f.source === 'ai'), 'Yapay zeka bulguları kaynak etiketiyle listelenmeli');

    // 3. Çoklu span üzerinden maskeleme (applyRedaction)
    const replacedCount = dom.window.UkiKvkk.applyRedaction(editorEl, findings);
    assert.ok(replacedCount >= 10, 'En az 10 hassas veri DOM içinde başarıyla maskelenmeli');

    const textAfter = editorEl.textContent;
    assert.ok(!textAfter.includes('29155760072'), 'TC kimlik silinmiş olmalı');
    assert.ok(!textAfter.includes('28589334248'), 'TC kimlik silinmiş olmalı');
    assert.ok(!textAfter.includes('BİLGE DALGIÇ'), 'BİLGE DALGIÇ silinmiş olmalı');
    assert.ok(!textAfter.includes('ÇAĞATAY DALGIÇ'), 'ÇAĞATAY DALGIÇ silinmiş olmalı');
    assert.ok(!textAfter.includes('Ayşe KAYA SAYDAM'), 'Ayşe KAYA SAYDAM silinmiş olmalı');
    assert.ok(!textAfter.includes('Ayşenur ÇİÇEK'), 'Ayşenur ÇİÇEK silinmiş olmalı');
    assert.ok(textAfter.includes('B*** D***'), 'B*** D*** maskesi yerleşmiş olmalı');
    assert.ok(textAfter.includes('[TC NO GİZLENDİ]'), '[TC NO GİZLENDİ] maskesi yerleşmiş olmalı');
});

test('Dil & Ses Araçları (UKİ): Astryx başlığı temizlenmiştir, Piper TTS ve Ema Lightning motorları Türkçe ses profilleriyle çalışır', async () => {
    const dom = initDom();

    // Mock SpeechSynthesis API
    const spokenUtterances = [];
    const mockVoices = [
        { voiceURI: 'en-david', name: 'Microsoft David Desktop', lang: 'en-US', default: true },
        { voiceURI: 'tr-ahmet', name: 'Microsoft Ahmet Online (Natural)', lang: 'tr-TR', default: false },
        { voiceURI: 'tr-emel', name: 'Microsoft Emel Online (Natural)', lang: 'tr-TR', default: false },
        { voiceURI: 'tr-google', name: 'Google Türkçe', lang: 'tr-TR', default: false }
    ];

    dom.window.speechSynthesis = {
        speaking: false,
        paused: false,
        getVoices: () => mockVoices,
        speak: (u) => {
            spokenUtterances.push(u);
            if (u.onend) setTimeout(u.onend, 10);
        },
        cancel: () => {},
        pause: () => {},
        resume: () => {},
        addEventListener: () => {}
    };

    dom.window.SpeechSynthesisUtterance = function(text) {
        this.text = text;
        this.lang = 'tr-TR';
        this.voice = null;
        this.rate = 1;
        this.pitch = 1;
        this.onend = null;
        this.onerror = null;
    };
    global.SpeechSynthesisUtterance = dom.window.SpeechSynthesisUtterance;
    dom.window.fetch = async () => { throw new Error('Local server offline'); };
    global.fetch = dom.window.fetch;

    dom.window.UkiApp = {
        text: () => 'T.C. Sakarya Asliye Ceza Mahkemesi Gerekçeli Kararı. Sanığın beraatine karar verildi.'
    };

    const langToolsCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-language-tools.js'), 'utf8');
    dom.window.eval(langToolsCode);

    // 1. Paneli aç ve başlıkta Astryx ibaresinin olmadığını doğrula
    dom.window.UkiLanguageTools.open();
    const dockHeader = dom.window.document.querySelector('.lang-dock-header h4');
    assert.ok(dockHeader, 'Dil ve ses paneli başlığı mevcut olmalı');
    assert.ok(!dockHeader.textContent.includes('Astryx'), 'Başlıkta dahili kod adı "Astryx" bulunmamalı');
    assert.ok(dockHeader.textContent.includes('Dil & Ses Araçları'), 'Başlık Dil & Ses Araçları olmalı');

    // 2. Piper TTS için doğal erkek (Ahmet / Bariton) ses profili çözümlenmeli
    const piperVoice = dom.window.UkiLanguageTools.resolveEngineVoice('piper', 'auto');
    assert.ok(piperVoice, 'Piper için ses çözümlenmeli');
    assert.equal(piperVoice.name, 'Microsoft Ahmet Online (Natural)', 'Piper için doğal erkek Türkçe sesi seçilmeli');

    // 3. Ema Lightning için hızlı ve çevik kadın (Emel / Lightning) ses profili çözümlenmeli
    const emaVoice = dom.window.UkiLanguageTools.resolveEngineVoice('ema', 'auto');
    assert.ok(emaVoice, 'Ema için ses çözümlenmeli');
    assert.equal(emaVoice.name, 'Microsoft Emel Online (Natural)', 'Ema için hızlı kadın Türkçe sesi seçilmeli');

    // 4. Piper TTS ile okuma testi
    const engineSelect = dom.window.document.getElementById('speech-engine');
    engineSelect.value = 'piper';
    dom.window.UkiLanguageTools.updateVoiceDropdown();

    dom.window.UkiLanguageTools.read();
    await new Promise(r => setTimeout(r, 80));

    assert.ok(spokenUtterances.length > 0, 'Piper motoru SpeechSynthesis Utterance üretmeli');
    const lastPiperUtterance = spokenUtterances[spokenUtterances.length - 1];
    assert.ok(lastPiperUtterance.voice, 'Utterance ses nesnesi boş kalmamalı');
    assert.equal(lastPiperUtterance.voice.name, 'Microsoft Ahmet Online (Natural)');
    assert.equal(lastPiperUtterance.pitch, 0.95, 'Piper için doğal bariton perde (0.95) atanmalı');

    // 5. Ema Lightning ile okuma testi
    dom.window.UkiLanguageTools.stop();
    spokenUtterances.length = 0;

    engineSelect.value = 'ema';
    dom.window.UkiLanguageTools.updateVoiceDropdown();

    dom.window.UkiLanguageTools.read();
    await new Promise(r => setTimeout(r, 120));

    assert.ok(spokenUtterances.length > 0, 'Ema motoru SpeechSynthesis Utterance üretmeli');
    const lastEmaUtterance = spokenUtterances[spokenUtterances.length - 1];
    assert.ok(lastEmaUtterance.voice, 'Ema için ses nesnesi boş kalmamalı');
    assert.equal(lastEmaUtterance.voice.name, 'Microsoft Emel Online (Natural)');
    assert.equal(lastEmaUtterance.pitch, 1.08, 'Ema için hızlı ve enerjik perde (1.08) atanmalı');

    // 6. Durdurma kontrolü
    dom.window.UkiLanguageTools.stop();
    const statusEl = dom.window.document.getElementById('speech-status');
    assert.equal(statusEl.textContent, 'Okuma durduruldu.');
});



