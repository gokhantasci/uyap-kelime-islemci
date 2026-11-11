/** OpenDocument Text: tarayıcı içinde ZIP/XML çıktısı. */
(function(window, document) {
    'use strict';
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    async function exportBlob(editor) {
        const zip = new window.JSZip(), styles = [];
        const namespaces = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"';
        function content(n) {
            if (n.nodeType === 3) return esc(n.nodeValue.replace(/\u200B/g,''));
            if (n.nodeType !== 1 || n.matches('[contenteditable="false"],.pb-spacer,.a4-watermark-layer,.page-boundaries-layer')) return '';
            if (n.classList.contains('udf-tab')) return '<text:tab/>';
            if (n.tagName === 'BR') return '<text:line-break/>';
            const inner = Array.from(n.childNodes).map(content).join('');
            if (n.tagName === 'TABLE') return '<table:table>'+Array.from(n.rows).filter(r=>!r.classList.contains('pb-spacer')).map(r=>'<table:table-row>'+Array.from(r.cells).map(c=>'<table:table-cell office:value-type="string">'+(c.querySelector('p')?Array.from(c.children).map(content).join(''):'<text:p>'+Array.from(c.childNodes).map(content).join('')+'</text:p>')+'</table:table-cell>').join('')+'</table:table-row>').join('')+'</table:table>';
            const paragraph = /^(P|H[1-6]|LI|DIV)$/.test(n.tagName);
            const name = 'S'+styles.length;
            if (paragraph) {
                const props = 'fo:text-align="'+(n.style.textAlign==='justify'?'justify':esc(n.style.textAlign||'start'))+'" fo:margin-top="'+esc(n.style.paddingTop||n.style.marginTop||'0pt')+'" fo:margin-bottom="'+esc(n.style.paddingBottom||n.style.marginBottom||'0pt')+'" fo:margin-left="'+esc(n.style.marginLeft||'0pt')+'" fo:text-indent="'+esc(n.style.textIndent||'0pt')+'"';
                styles.push('<style:style style:name="'+name+'" style:family="paragraph"><style:paragraph-properties '+props+'/></style:style>');
                return '<text:p text:style-name="'+name+'">'+inner+'</text:p>';
            }
            const attrs = [];
            if (/^(B|STRONG)$/.test(n.tagName) || n.style.fontWeight === 'bold') attrs.push('fo:font-weight="bold"');
            if (/^(I|EM)$/.test(n.tagName) || n.style.fontStyle === 'italic') attrs.push('fo:font-style="italic"');
            if (n.style.fontSize) attrs.push('fo:font-size="'+esc(n.style.fontSize)+'"');
            if (n.style.color) attrs.push('fo:color="'+esc(n.style.color.startsWith('#')?n.style.color:rgbHex(n.style.color))+'"');
            if (n.style.fontFamily) attrs.push('fo:font-family="'+esc(n.style.fontFamily.split(',')[0].replace(/["']/g,''))+'"');
            if (!attrs.length) return inner;
            styles.push('<style:style style:name="'+name+'" style:family="text"><style:text-properties '+attrs.join(' ')+'/></style:style>');
            return '<text:span text:style-name="'+name+'">'+inner+'</text:span>';
        }
        function rgbHex(rgb) { const a=rgb.match(/\d+/g);return a?'#'+a.slice(0,3).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):'#000000'; }
        const body = Array.from(editor.childNodes).map(content).join('');
        zip.file('mimetype','application/vnd.oasis.opendocument.text',{compression:'STORE'});
        zip.file('content.xml','<?xml version="1.0" encoding="UTF-8"?><office:document-content '+namespaces+' office:version="1.2"><office:automatic-styles>'+styles.join('')+'</office:automatic-styles><office:body><office:text>'+body+'</office:text></office:body></office:document-content>');
        zip.file('META-INF/manifest.xml','<?xml version="1.0"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>');
        return zip.generateAsync({type:'blob',mimeType:'application/vnd.oasis.opendocument.text'});
    }
    async function download() {
        try {
            const blob=await exportBlob(document.getElementById('editor'));
            const a=document.createElement('a'),url=URL.createObjectURL(blob);
            a.href=url;a.download=(document.getElementById('doc-title').value||'belge').replace(/\.[^.]+$/,'')+'.odt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
            if (window.UkiStats) window.UkiStats.recordDocumentDownloaded('odt');
        } catch(err) { if(window.showToast)window.showToast('ODT oluşturulamadı: '+err.message,'error'); }
    }
    window.UkiODT={exportBlob,download};
})(window,document);
