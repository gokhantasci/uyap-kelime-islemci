const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function initDom() {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor" contenteditable="true"><p>Test</p></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.Node = dom.window.Node;
    global.DOMParser = dom.window.DOMParser;
    global.XMLSerializer = dom.window.XMLSerializer;
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

