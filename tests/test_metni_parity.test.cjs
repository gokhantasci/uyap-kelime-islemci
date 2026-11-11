const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const JSZip = require('../assets/vendor/jszip.min.js');

function createEnv(initialHtml = '<div id="editor" class="a4-page"></div>') {
    const dom = new JSDOM(`<!doctype html><html><head></head><body>${initialHtml}</body></html>`, {
        url: 'http://localhost:8080',
        runScripts: 'outside-only',
        pretendToBeVisual: true,
        virtualConsole: new VirtualConsole()
    });
    const w = dom.window;
    w.JSZip = JSZip;
    w.Blob = Blob;
    w.TextDecoder = TextDecoder;
    w.TextEncoder = TextEncoder;
    w.document.queryCommandState = () => false;
    w.document.queryCommandValue = () => '';
    w.document.execCommand = () => true;

    return {
        w,
        load(name) {
            w.eval(fs.readFileSync(path.resolve(__dirname, '../assets/js/' + name + '.js'), 'utf8'));
        },
        close: () => w.close()
    };
}

test('test metni.udf: Liste işaretleri (●, 1., 1), 2)), barkod ve girintiler 1:1 render edilir', async () => {
    const env = createEnv();
    env.load('uki-core');
    const bytes = fs.readFileSync(path.resolve(__dirname, '../examples/test metni.udf'));
    const model = await env.w.UkiCore.parseUdf(bytes);

    assert.equal(model.pageProperties.leftMarginCm, '1.5');
    assert.equal(model.pageProperties.rightMarginCm, '1.5');

    const html = env.w.UkiCore.udfModelToHtml(model);
    const ed = env.w.document.getElementById('editor');
    ed.innerHTML = html;

    const ps = Array.from(ed.querySelectorAll('p'));

    // 1. Madde işaretli NOKTA: ● NOKTA
    const pNokta = ps.find(p => p.textContent.includes('NOKTA'));
    assert.ok(pNokta, 'NOKTA paragrafı bulunmalı');
    assert.ok(pNokta.textContent.includes('●'), 'Madde işareti (●) bulunmalı');
    assert.equal(pNokta.getAttribute('data-bulleted'), 'true');
    assert.equal(pNokta.getAttribute('data-bullettype'), 'BULLET_TYPE_ELLIPSE');

    // 2. Numaralandırılmış liste: 1. BİR
    const pBir = ps.find(p => p.getAttribute('data-numbered') === 'true' && p.textContent.includes('BİR'));
    assert.ok(pBir, 'BİR paragrafı bulunmalı');
    assert.ok(pBir.textContent.includes('1.'), 'Numara (1.) bulunmalı');
    assert.equal(pBir.getAttribute('data-numbered'), 'true');

    // 3. Parantezli liste: 1) İÇE DOĞRU ve 2) A
    const pIce = ps.find(p => p.textContent.includes('İÇE DOĞRU'));
    const pA = ps.find(p => p.textContent.includes('A') && p.getAttribute('data-numbered') === 'true');
    assert.ok(pIce, 'İÇE DOĞRU paragrafı bulunmalı');
    assert.ok(pA, 'A paragrafı bulunmalı');
    assert.ok(pIce.textContent.includes('1)'), 'Parantezli numara (1)) bulunmalı');
    assert.ok(pA.textContent.includes('2)'), 'Parantezli numara (2)) bulunmalı');

    // 4. Girinti: GİRİNTİ ARTTIR (36pt) vs GİRİNTİ AZALT (0pt)
    const pArttir = ps.find(p => p.textContent.includes('GİRİNTİ ARTTIR'));
    const pAzalt = ps.find(p => p.textContent.includes('GİRİNTİ AZALT'));
    assert.ok(pArttir, 'GİRİNTİ ARTTIR bulunmalı');
    assert.ok(pAzalt, 'GİRİNTİ AZALT bulunmalı');
    assert.equal(parseFloat(pArttir.getAttribute('data-li')), 36);
    assert.equal(parseFloat(pAzalt.getAttribute('data-li') || '0'), 0);

    // 5. Barkod: SVG ve veri dizesi
    const bcode = ed.querySelector('.udf-barcode');
    assert.ok(bcode, 'Barkod öğesi (.udf-barcode) bulunmalı');
    assert.equal(bcode.getAttribute('data-barcode'), '12345678911');
    assert.ok(bcode.querySelector('svg'), 'Barkod SVG içermeli');
    assert.ok(bcode.textContent.includes('12345678911'), 'Barkod verisi metin olarak yazılmalı');

    // 6. Arka plan rengi (P#9 ve P#10)
    const coloredP = ps.find(p => p.style.backgroundColor && p.style.backgroundColor.includes('255, 160'));
    assert.ok(coloredP, 'Turuncu arka planlı boş paragraf bulunmalı');

    env.close();
});

test('test metni.udf: Altbilgi özel sayfa numarası (a1) ve alt yazı render edilir', async () => {
    const env = createEnv('<div id="editor" class="a4-page"><div class="page-boundaries-layer"></div></div>');
    env.load('uki-core');
    env.load('uki-pages');

    const bytes = fs.readFileSync(path.resolve(__dirname, '../examples/test metni.udf'));
    const model = await env.w.UkiCore.parseUdf(bytes);

    const ed = env.w.document.getElementById('editor');
    const layer = ed.querySelector('.page-boundaries-layer');
    env.w.UkiPages.init(ed, layer);
    env.w.UkiPages.configure(model);

    assert.equal(model.footerElement.pageNumberForeStr, 'a');
    assert.equal(model.footerElement.pageNumberStartNum, 1);
    assert.ok(model.footerElement.paragraphs.some(p => p.runs.some(r => r.text.includes('Alt yazı'))));

    env.close();
});

test('örnek karar.udf: Roundtrip export Hanging=190.0, RepeatingLabel ve edf stillerini kayıpsız korur', async () => {
    const env = createEnv();
    env.load('uki-core');

    const bytes = fs.readFileSync(path.resolve(__dirname, '../examples/örnek karar.udf'));
    const origZip = await JSZip.loadAsync(bytes);
    const origXml = await origZip.file('content.xml').async('string');
    const model = await env.w.UkiCore.parseUdf(bytes);

    const html = env.w.UkiCore.udfModelToHtml(model);
    const ed = env.w.document.getElementById('editor');
    ed.innerHTML = html;

    const exportedBlob = await env.w.UkiCore.exportUdfBlob(ed, model);
    const expBytes = Buffer.from(await exportedBlob.arrayBuffer());
    const expZip = await JSZip.loadAsync(expBytes);
    const expXml = await expZip.file('content.xml').async('string');

    // 1. Hanging="190.0" korunmalı; 186.12 asla UDF XML'ine yazılmamalı
    assert.ok(expXml.includes('Hanging="190.0"'), 'Hanging="190.0" XML exportunda korunmalı');
    assert.ok(!expXml.includes('Hanging="186.12"'), 'Hanging="186.12" XML exportunda yer almamalı');

    // 2. RepeatingLabel ve GroupName korunmalı
    assert.ok(expXml.includes('RepeatingLabel="true"'), 'RepeatingLabel="true" korunmalı');
    assert.ok(expXml.includes('GroupName="tarafPGrp"'), 'GroupName="tarafPGrp" korunmalı');

    // 3. 30 adet stil tanımı korunmalı
    const origStylesCount = (origXml.match(/<style\s/g) || []).length;
    const expStylesCount = (expXml.match(/<style\s/g) || []).length;
    assert.equal(expStylesCount, origStylesCount, '30 stil tanımı korunmalı');

    // 4. BERAAT - C.V.Y.O FirstLineIndent ve cetvel hizası
    const pBeraat = Array.from(ed.querySelectorAll('p')).find(p => p.textContent.includes('BERAAT - C.V.Y.O'));
    assert.ok(pBeraat, 'BERAAT - C.V.Y.O paragrafı bulunmalı');
    assert.equal(pBeraat.getAttribute('data-fli'), '345.23813', 'FirstLineIndent ham değeri korunmalı');
    // DOM'da 0.98 ölçekli: 345.23813 * 0.98 = 338.33pt
    assert.equal(pBeraat.style.textIndent, '338.33pt', 'BERAAT - C.V.Y.O metin girintisi 0.98 ölçekli 338.33pt olmalı');

    env.close();
});
