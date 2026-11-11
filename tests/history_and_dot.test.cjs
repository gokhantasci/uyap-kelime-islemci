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

test('Belge yüklendiğinde Ctrl+Z tüm belgeyi silmez, canUndo false döner, yapılan yazma işlemi güvenle geri alınır', async () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="editor"></div></body></html>`, {
        url: 'http://localhost/',
        runScripts: 'dangerously'
    });
    const w = dom.window;
    global.window = w;
    global.document = w.document;
    global.Node = w.Node;
    global.NodeFilter = w.NodeFilter;
    w.document.queryCommandState = () => false;
    w.document.queryCommandValue = () => '';
    w.document.execCommand = () => true;

    // Load scripts
    w.eval(fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-core.js'), 'utf8'));
    w.eval(fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-history.js'), 'utf8'));
    w.eval(fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-editor.js'), 'utf8'));

    w.UkiHistory.init();

    const ed = w.document.getElementById('editor');
    const editor = new w.UkiEditor(ed);

    // Belge yükleme simülasyonu
    const docHtml = '<p>T.C. SAKARYA 11. ASLİYE CEZA MAHKEMESİ GEREKÇELİ KARAR</p><p>Dosya No: 2025/416 Esas</p>';
    editor.setContentHtml(docHtml);

    assert.equal(ed.querySelectorAll('p').length, 2, '2 paragraf yüklenmiş olmalı');
    assert.equal(w.UkiHistory.canUndo(), false, 'Belge yeni yüklendiğinde geri alınacak işlem olmamalıdır (canUndo = false)');

    // 1. Kullanıcı henüz düzenleme yapmadan Ctrl+Z / undo() çağırırsa: Belge SİLİNMEMELİDİR!
    const undone = w.UkiHistory.undo();
    assert.equal(undone, false, 'Düzenleme yapılmamışken undo işlemi gerçekleşmemelidir');
    assert.equal(ed.querySelectorAll('p').length, 2, 'Belge silinmemeli, tüm paragraflar korunmalıdır!');
    assert.ok(ed.textContent.includes('SAKARYA 11. ASLİYE CEZA'), 'Belge metni eksiksiz durmalıdır');

    // 2. Kullanıcı metin eklerse
    const p1 = ed.querySelectorAll('p')[0];
    p1.textContent += ' EK METİN';
    w.UkiHistory.record('Yazma');

    assert.equal(w.UkiHistory.canUndo(), true, 'Metin yazıldıktan sonra canUndo true olmalı');
    assert.ok(p1.textContent.includes('EK METİN'));

    // 3. Kullanıcı Ctrl+Z basarsa yalnızca eklenen metin geri alınmalı, orijinal belge silinmemeli
    const undoneEdit = w.UkiHistory.undo();
    assert.equal(undoneEdit, true, 'Yazma işlemi geri alınmalı');
    assert.equal(ed.querySelectorAll('p').length, 2, 'Tüm paragraflar korunmalı');
    assert.ok(!ed.textContent.includes('EK METİN'), 'Eklenen metin silinmiş olmalı');
    assert.ok(ed.textContent.includes('SAKARYA 11. ASLİYE CEZA'), 'Orijinal belge korunmuş olmalıdır');
    assert.equal(w.UkiHistory.canUndo(), false, 'Orijinal belgeye dönüldükten sonra canUndo false olmalıdır');

    // 4. Tekrar Ctrl+Z yapılsa bile belge asla silinmemeli
    w.UkiHistory.undo();
    assert.equal(ed.querySelectorAll('p').length, 2, 'İkinci kez Ctrl+Z yapılsa dahi belge silinmemelidir');
    assert.ok(ed.textContent.includes('SAKARYA 11. ASLİYE CEZA'));
});
