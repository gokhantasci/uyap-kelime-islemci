const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM,VirtualConsole} = require('jsdom');
const JSZip = require('../assets/vendor/jszip.min.js');
function environment(html = '<div id="editor" class="a4-page"></div>') {
  const dom = new JSDOM('<!doctype html><html><head></head><body>'+html+'</body></html>', {url:'http://localhost:8080',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
  const w = dom.window; w.JSZip = JSZip; w.Blob = Blob; w.TextDecoder = TextDecoder; w.TextEncoder = TextEncoder;
  w.document.queryCommandState = () => false; w.document.queryCommandValue = () => '';
  w.document.execCommand = () => true;
  return {w,load(name){w.eval(fs.readFileSync('assets/js/'+name+'.js','utf8'));},close:()=>w.close()};
}
test('Örnek karar UDF üç sayfalı PDF ile aynı belge ölçülerini, sekmeleri ve üstbilgiyi taşır', async () => {
  const e=environment(); e.load('uki-core');
  const model=await e.w.UkiCore.parseUdf(fs.readFileSync('examples/örnek karar.udf'));
  assert.ok(Math.abs(model.pageProperties.leftMargin-56.692913)<.001);
  assert.equal(model.headerElement.startPage,2);
  assert.ok(model.elements.some(p => p.tabSet));
  const dom=e.w.document.createElement('div'); dom.innerHTML=e.w.UkiCore.udfModelToHtml(model);
  assert.ok(dom.querySelectorAll('.udf-tab').length>5);
  assert.equal(dom.querySelectorAll('.pb-header,.pb-footer').length,0);
  e.close();
});
test('UDF dışa aktarma: üstbilgi, altbilgi, sayfa numarası ve sekmeler yeniden açılır; eski imza taşınmaz',async()=>{
  const e=environment('<div id="editor"><p data-tabset="90:0:0" style="text-indent:28pt"><span style="font-weight:bold;color:#123456">Başlık</span><span class="udf-tab" data-tab="1"></span><span>Değer</span></p><div class="pb-spacer" contenteditable="false">GİZLİ KATMAN</div></div>');
  e.load('uki-core');
  const blob=await e.w.UkiCore.exportUdfBlob(e.w.document.getElementById('editor'), {headerInfo:{left:'Mahkeme',right:'2026/1',startPage:2},footerInfo:{showFooter:false,showPageNumber:false,webId:'A&B"',qrCode:''}});
  const bytes=Buffer.from(await blob.arrayBuffer());
  const zip=await JSZip.loadAsync(bytes), xml=await zip.file('content.xml').async('string');
  assert.ok(!xml.includes('GİZLİ KATMAN')); assert.ok(!zip.file('sign.sgn'));
  const model=await e.w.UkiCore.parseUdf(bytes);
  assert.equal(model.editorSettings.showPageNumber,false);
  assert.equal(model.webId,'A&B"');
  assert.equal(model.headerElement.startPage,2);
  assert.equal(model.elements[0].tabSet,'90:0:0');
  e.close();
});
test('Baskı görüntüsü CSSOM erişimi olmadan hesaplanan katman konumlarını korur ve filigranı çıkarır',()=>{
  const e=environment('<div id="editor" class="a4-page"><div class="a4-watermark-layer">139329</div><p style="font-size:12pt">Belge</p><div class="page-boundaries-layer" style="position:absolute;top:0"><div class="pb-header" style="position:absolute;top:1100px">Üstbilgi</div></div><div class="udf-seal-stamp">İmza</div></div>');
  e.load('uki-print-snapshot'); const snapshot=e.w.UkiPrintSnapshot.snapshot(e.w.document.getElementById('editor'));
  assert.equal(snapshot.querySelector('.pb-header').style.position,'absolute');
  assert.equal(snapshot.querySelector('.pb-header').style.top,'1100px');
  assert.ok(!snapshot.textContent.includes('139329')); assert.ok(!snapshot.textContent.includes('İmza'));
  assert.ok(snapshot.textContent.includes('Belge'));
  e.close();
});
test('Paragraf ortasında tablo ekleme, imlecin iki tarafındaki metni korur',()=>{
  const e=environment('<div id="editor"><p>Önce sonra</p></div>');e.load('uki-table');
  const d=e.w.document, ed=d.getElementById('editor'), p=ed.querySelector('p');
  const range=d.createRange();range.setStart(p.firstChild,5);range.collapse(true);e.w.getSelection().addRange(range);
  const table=e.w.UkiTable.parseTsvToTable('A\tB\n1\t2');
  e.w.UkiTable.insertTableAtSelection(table,ed,range);
  assert.equal(ed.children[1].tagName,'TABLE');
  assert.equal(ed.firstElementChild.textContent,'Önce ');assert.equal(ed.lastElementChild.textContent,'sonra');
  e.close();
});
test('TDK kuralları Türkçe kelime sınırlarını korur; belirsiz ekleri otomatik bölmez',()=>{
  const e=environment();e.load('uki-writing-rules');e.load('uki-spellcheck');
  assert.equal(e.w.UkiSpellCheck.isWordValid('yalnış'),false);
  assert.equal(e.w.UkiWritingRules.suggest('HERKEZ'),'herkes');
  const result=e.w.UkiWritingRules.inspect('Yanlız bir kaç kişi ,geldi. Evdeki kitap.');
  assert.ok(result.some(f=>f.replacement==='yalnız'));
  assert.ok(result.some(f=>f.replacement==='birkaç'));
  assert.ok(!result.some(f=>f.text.includes('Evdeki')));
  e.close();
});
test('OCR paragraf geometrisini kullanır ve metni HTML olarak çalıştırmaz',()=>{
  const e=environment();e.load('uki-ocr');
  const html=e.w.UkiOCR.structureOcrLayout({blocks:[{paragraphs:[{bbox:{x0:10,x1:100},lines:[{bbox:{x0:10,x1:100,y0:0,y1:20},words:[{text:'<script>',is_bold:true,bbox:{y0:0,y1:20}}]}]}]}]});
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('font-weight:bold'));
  assert.ok(html.includes('font-size:12.0pt'));
  e.close();
});
test('QR ve belge anahtarları bir belgeden diğerine sızmaz',()=>{
  const e=environment();e.load('uki-pages');
  e.w.UkiPages.configure({footerElement:{},editorSettings:{showPageNumber:false,showFooter:false}});
  assert.equal(e.w.UkiPages.getConfig().showPageNumber,false);
  e.w.UkiPages.reset();e.w.UkiPages.configure({footerElement:{}});
  assert.equal(e.w.UkiPages.getConfig().showPageNumber,true);
  assert.equal(e.w.UkiPages.getConfig().showFooter,true);
  e.close();
});
test('DOCX sekmeleri sabit konum yerine paragraf ayarından gelir ve yeniden açılır',async()=>{
  const e=environment('<div id="editor"><p data-tabset="110:0:0,240:1:0" style="text-indent:20pt;margin-left:10pt"><span style="font-family:Arial;font-size:11pt">Alan</span><span class="udf-tab" data-tab="1"></span><span>Değer</span></p></div>');
  e.load('uki-core');
  const blob=await e.w.UkiCore.exportDocxBlob(e.w.document.getElementById('editor'),{leftMarginCm:'2',rightMarginCm:'2.5',topMarginCm:'2.5',bottomMarginCm:'2.5'},{});
  const data=Buffer.from(await blob.arrayBuffer()), zip=await JSZip.loadAsync(data);
  const xml=await zip.file('word/document.xml').async('string');
  assert.ok(xml.includes('w:pos="2200"'));assert.ok(xml.includes('w:pos="4800"'));
  assert.ok(xml.includes('<w:tab/>')); assert.ok(!xml.includes('w:pos="3685"'));
  const model=await e.w.UkiCore.parseDocx(data);
  assert.equal(model.elements[0].tabSet,'110:0:0,240:1:0');
  assert.equal(model.elements[0].alignment,'left');
  assert.ok(model.elements.length);assert.ok(model.elements.some(p=>p.runs.some(r=>r.text.includes('Değer'))));
  e.close();
});
test('ODT paketi metni, vurgu stillerini ve tabloyu XML olarak saklar',async()=>{
  const e=environment('<div id="editor"><p><b>Başlık</b></p><table><tr><td><p>Hücre</p></td></tr></table></div>');e.load('uki-odt');
  const blob=await e.w.UkiODT.exportBlob(e.w.document.getElementById('editor'));
  const zip=await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
  assert.equal(await zip.file('mimetype').async('string'),'application/vnd.oasis.opendocument.text');
  const xml=await zip.file('content.xml').async('string');
  assert.ok(xml.includes('Başlık'));assert.ok(xml.includes('<table:table>'));assert.ok(xml.includes('fo:font-weight="bold"'));
  const parsed=new e.w.DOMParser().parseFromString(xml,'application/xml');assert.equal(parsed.querySelector('parsererror'),null);
  e.close();
});
test('UDF 1:1 tipografi ölçeklemesi: 12pt -> 11.76pt ve UDF dışa aktarırken 12pt geri kazanılır', async () => {
  const e=environment(); e.load('uki-core');
  const model=await e.w.UkiCore.parseUdf(fs.readFileSync('examples/örnek karar.udf'));
  const html=e.w.UkiCore.udfModelToHtml(model);
  const div=e.w.document.createElement('div'); div.innerHTML=html;
  const pWith12 = div.querySelector('[data-size="12"]');
  assert.ok(pWith12, 'data-size="12" span bulunmalı');
  assert.equal(pWith12.style.fontSize, '11.76pt');
  
  // Dışa aktarım testi: data-size="12" UDF XML'e size="12" olarak döner
  const exportedBlob=await e.w.UkiCore.exportUdfBlob(div, {headerInfo:{}, footerInfo:{}});
  const bytes=Buffer.from(await exportedBlob.arrayBuffer());
  const exportedModel=await e.w.UkiCore.parseUdf(bytes);
  assert.ok(exportedModel.elements.some(p => p.runs.some(r => r.size === 12)), 'UDF dışa aktarımında size=12 korunmalı');
  e.close();
});
