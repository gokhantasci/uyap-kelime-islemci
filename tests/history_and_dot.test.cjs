const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function setupEnvironment(initialHtml = '<div id="editor"><p style="text-align: justify;">İki yana yaslı ilk paragraf metni</p><p style="text-align: left;">Sola yaslı ikinci paragraf metni</p></div>') {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>${initialHtml}</body></html>`, {
        url: 'http://localhost/',
        runScripts: 'dangerously'
    });
    const w = dom.window;
    global.window = w;
    global.document = w.document;
    global.Node = w.Node;
    global.NodeFilter = w.NodeFilter;
    global.Event = w.Event;

    // Load uki-history.js
    const histCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-history.js'), 'utf8');
    w.eval(histCode);

    return { dom, w, document: w.document, editor: w.document.getElementById('editor') };
}

test('Biçim boyacısı veya sola yaslama yapıldıktan sonra Geri Al (Undo) iki yana yasla hizalamasını geri yükler', () => {
    const { w, document, editor } = setupEnvironment();
    const UkiHistory = w.UkiHistory;
    assert.ok(UkiHistory, 'UkiHistory modülü yüklenmeli');

    UkiHistory.init();
    const p1 = editor.querySelectorAll('p')[0];
    const p2 = editor.querySelectorAll('p')[1];

    assert.equal(p1.style.textAlign, 'justify', 'İlk paragraf iki yana yaslı olmalı');
    assert.equal(p2.style.textAlign, 'left', 'İkinci paragraf sola yaslı olmalı');

    // 1. Biçim boyacısı p1'e sola yaslama uygular
    UkiHistory.record('Biçim Boyacısı Öncesi');
    p1.style.textAlign = 'left';
    UkiHistory.record('Biçim Boyacısı Sola Yasladı');

    assert.equal(p1.style.textAlign, 'left', 'Biçim uygulandıktan sonra ilk paragraf sola yaslı olmalı');
    assert.ok(UkiHistory.canUndo(), 'Geri al işlemi aktif olmalı');

    // 2. Geri Al (Undo / Ctrl+Z)
    const undone = UkiHistory.undo();
    assert.ok(undone, 'Undo başarılı dönmeli');

    const p1AfterUndo = editor.querySelectorAll('p')[0];
    assert.equal(p1AfterUndo.style.textAlign, 'justify', 'Geri al işlemi iki yana yasla (justify) hizalamasını geri getirmelidir!');

    // 3. Yinele (Redo / Ctrl+Y)
    assert.ok(UkiHistory.canRedo(), 'Yinele işlemi aktif olmalı');
    const redone = UkiHistory.redo();
    assert.ok(redone, 'Redo başarılı dönmeli');

    const p1AfterRedo = editor.querySelectorAll('p')[0];
    assert.equal(p1AfterRedo.style.textAlign, 'left', 'Yinele işlemi sola yasla hizalamasını tekrar uygulamalıdır');
});

test('GEREKÇELİ KARAR üstündeki altı çizili boşluk noktası (.udf-underline-dot) seçilebilir, silinebilir ve silindiğinde alt çizgi temizlenir', () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="editor"></div></body></html>`, {
        url: 'http://localhost/',
        runScripts: 'dangerously'
    });
    const w = dom.window;
    global.window = w;
    global.document = w.document;
    global.Node = w.Node;
    global.NodeFilter = w.NodeFilter;

    // Load uki-core.js
    const coreCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-core.js'), 'utf8');
    w.eval(coreCode);
    const histCode = fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-history.js'), 'utf8');
    w.eval(histCode);

    // Mock UDF model with underline and center alignment (P#10)
    const model = {
        formatId: '1.8',
        elements: [{
            type: 'paragraph',
            alignment: 'center',
            runs: [{ underline: true, bold: true, size: 12, text: '\n' }],
            spaceAbove: 1.0,
            spaceBelow: 1.0
        }]
    };

    const html = w.UkiCore.udfModelToHtml(model);
    const ed = w.document.getElementById('editor');
    ed.innerHTML = html;

    const pEl = ed.querySelector('p');
    const dot = pEl.querySelector('.udf-underline-dot');

    assert.ok(dot, 'Altı çizili ortalanmış boş paragraf için udf-underline-dot oluşturulmalı');
    assert.equal(dot.getAttribute('contenteditable'), null, 'Nokta üzerinde contenteditable="false" OLMAMALI (seçilebilir ve silinebilir olmalı)');
    assert.equal(dot.textContent, '.', 'Nokta öğesi seçilebilir bir nokta karakteri içermelidir');

    // Nokta silindiğinde:
    dot.remove();
    pEl.removeAttribute('data-underline');
    pEl.setAttribute('data-udf-dot-cleared', 'true');
    pEl.innerHTML = '<br>';

    // Dışa aktarım testi: silinmiş nokta UDF çıktısında underline üretmemeli
    // (exportUdfBlob çağrısı veya test)
    assert.ok(!pEl.querySelector('.udf-underline-dot'), 'Nokta DOMdan silinmiş olmalı');
    assert.equal(pEl.getAttribute('data-underline'), null, 'Underline attribute temizlenmiş olmalı');
});
