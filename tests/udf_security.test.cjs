const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const JSZip = require('../assets/vendor/jszip.min.js');

function env() {
    const dom = new JSDOM('<!doctype html><html><body><div id="editor" class="a4-page"></div></body></html>', {
        url: 'http://localhost:8080', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole()
    });
    const w = dom.window;
    w.JSZip = JSZip; w.Blob = Blob; w.TextDecoder = TextDecoder; w.TextEncoder = TextEncoder;
    w.eval(fs.readFileSync(path.resolve(__dirname, '../assets/js/uki-core.js'), 'utf8'));
    return w;
}

test('Barkod verisi SVG\'ye HTML olarak değil metin olarak yazılır (XSS)', () => {
    const w = env();
    const payload = '</text><img src=x onerror=alert(1)>';
    const holder = w.document.createElement('div');
    holder.innerHTML = w.UkiCore.generateBarcodeSvg(payload);
    assert.equal(holder.querySelector('img'), null, 'enjekte edilen <img> oluşmamalı');
    assert.ok(holder.querySelector('text').textContent.includes('onerror=alert(1)'), 'veri düz metin olarak kalmalı');
});

async function exportXml(w, html) {
    const ed = w.document.getElementById('editor');
    ed.innerHTML = html;
    const blob = await w.UkiCore.exportUdfBlob(ed, {});
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    return zip.file('content.xml').async('string');
}

test('Dışa aktarımda alan öznitelikleri kaçışlanır (öznitelik enjeksiyonu yok)', async () => {
    const w = env();
    const xml = await exportXml(w, `<p><span data-tag="field" data-field-name='x" length="99" y="'>Metin</span></p>`);
    const run = xml.match(/<field[^>]*\/>/);
    assert.ok(run, 'alan parçası bulunmalı');
    assert.ok(!/fieldName="x" length="99"/.test(run[0]), 'öznitelik kırılmamalı: ' + run[0]);
    assert.ok(/fieldName="x&quot; length=&quot;99&quot; y=&quot;"/.test(run[0]), 'değer kaçışlanmış olmalı: ' + run[0]);
    assert.ok(/ length="5"/.test(run[0]), 'uzunluk saldırgan değerinden etkilenmemeli: ' + run[0]);
});

test('Paragraf sonu satır sonu, son metin parçasının uzunluğuna eklenir', async () => {
    const w = env();
    const xml = await exportXml(w, '<p><span style="font-weight:bold">Metin</span></p>');
    const run = xml.match(/<content[^>]*bold="true"[^>]*\/>/);
    assert.ok(run, 'kalın parça bulunmalı');
    assert.ok(/ length="6"/.test(run[0]), 'Metin(5) + satır sonu(1) = 6: ' + run[0]);
});
