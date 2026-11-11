/**
 * UkiTable - Excel ve Word Tablo Yapıştırma & İşleme Modülü (UKİ Table Engine)
 * Microsoft Excel, Microsoft Word, Google E-Tablolar ve web tablolarından kopyalanan
 * verileri temizler ve UYAP Kelime İşlemci (.udf) uyumlu yerel tabloya dönüştürür.
 */
(function(window) {
    'use strict';

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * RGB / HEX / Renk temizleyici (Beyaz veya şeffaf olmayan renkleri korur)
     */
    function sanitizeBgColor(color) {
        if (!color) return null;
        const c = color.trim().toLowerCase();
        if (c === 'transparent' || c === 'inherit' || c === 'initial' || c === 'none') return null;
        if (c === '#fff' || c === '#ffffff' || c === 'white') return null;
        if (c === 'rgb(255, 255, 255)' || c === 'rgba(255, 255, 255, 1)' || c === 'rgba(0, 0, 0, 0)') return null;
        return color;
    }

    /**
     * Hücre içerisindeki MSO ve gereksiz etiketleri temizleyip temel UYAP biçimlerini korur
     */
    // Yapıştırılan HTML güvenilmezdir: hizalama ve renk değerleri HTML'e yazılmadan önce beyaz listeyle doğrulanır
    function safeAlign(v, fallback) {
        const a = String(v || '').trim().toLowerCase();
        return ['left', 'right', 'center', 'justify'].indexOf(a) >= 0 ? a : (fallback || 'left');
    }
    function safeColor(v) {
        const c = String(v || '').trim();
        return /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*(,\s*\d{1,3}\s*){2}(,\s*[\d.]+\s*)?\)|[a-z]{3,20})$/i.test(c) ? c : '';
    }

    function cleanCellNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return escapeHtml(node.nodeValue);
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }

        const tag = node.tagName.toLowerCase();

        // MSO / XML / Script / Style / Meta / Link çöplerini temizle
        if (['script', 'style', 'meta', 'link', 'xml', 'o:p', 'w:worddocument'].includes(tag) || tag.startsWith('mso:')) {
            return '';
        }

        if (tag === 'br') {
            return '<br>';
        }

        // Alt düğümleri topla
        let innerHtml = '';
        node.childNodes.forEach(child => {
            innerHtml += cleanCellNode(child);
        });

        // Temel UYAP biçimlendirmelerini koru
        const isBold = tag === 'b' || tag === 'strong' || node.style.fontWeight === 'bold' || parseInt(node.style.fontWeight, 10) >= 600;
        const isItalic = tag === 'i' || tag === 'em' || node.style.fontStyle === 'italic';
        const isUnderline = tag === 'u' || (node.style.textDecoration && node.style.textDecoration.includes('underline'));
        const isStrike = tag === 's' || tag === 'strike' || tag === 'del' || (node.style.textDecoration && node.style.textDecoration.includes('line-through'));

        let wrapped = innerHtml;
        if (isBold) wrapped = `<b>${wrapped}</b>`;
        if (isItalic) wrapped = `<i>${wrapped}</i>`;
        if (isUnderline) wrapped = `<u>${wrapped}</u>`;
        if (isStrike) wrapped = `<s>${wrapped}</s>`;

        // Renk varsa koru (siyah harici)
        const textColor = node.style.color;
        const okColor = safeColor(textColor);
        if (okColor && okColor !== 'rgb(0, 0, 0)' && okColor !== '#000' && okColor !== '#000000' && okColor !== 'black') {
            wrapped = `<span style="color: ${okColor};">${wrapped}</span>`;
        }

        return wrapped;
    }

    /**
     * Hücre içeriğini paragraflara böler
     */
    function extractCellParagraphs(td, alignRaw) {
        const align = safeAlign(alignRaw, 'left');
        const paragraphs = [];
        const pNodes = td.querySelectorAll(':scope > p, :scope > div');

        if (pNodes.length > 0) {
            pNodes.forEach(p => {
                let pHtml = '';
                p.childNodes.forEach(c => {
                    pHtml += cleanCellNode(c);
                });
                pHtml = pHtml.trim();
                const pAlign = safeAlign(p.style.textAlign, align);
                paragraphs.push(`<p style="margin: 0; line-height: 1.15; font-family: 'Times New Roman', serif; font-size: 11pt; text-align: ${pAlign};">${pHtml || '<br>'}</p>`);
            });
        } else {
            let html = '';
            td.childNodes.forEach(c => {
                html += cleanCellNode(c);
            });
            html = html.trim();

            if (html.includes('<br><br>')) {
                const parts = html.split(/<br\s*\/?>\s*<br\s*\/?>/i);
                parts.forEach(part => {
                    const cleanPart = part.trim();
                    paragraphs.push(`<p style="margin: 0; line-height: 1.15; font-family: 'Times New Roman', serif; font-size: 11pt; text-align: ${align};">${cleanPart || '<br>'}</p>`);
                });
            } else {
                paragraphs.push(`<p style="margin: 0; line-height: 1.15; font-family: 'Times New Roman', serif; font-size: 11pt; text-align: ${align};">${html || '<br>'}</p>`);
            }
        }

        return paragraphs.length > 0 ? paragraphs.join('') : `<p style="margin: 0; line-height: 1.15; font-family: 'Times New Roman', serif; font-size: 11pt; text-align: ${align};"><br></p>`;
    }

    const UkiTable = {
        /**
         * Pano (Clipboard) verisini inceler. Excel, Word veya TSV tablosu varsa Uki tablosu üretir.
         * @param {DataTransfer} clipboardData 
         * @returns {HTMLElement|null}
         */
        parseClipboard: function(clipboardData) {
            if (!clipboardData) return null;

            // 1. Önce HTML verisi kontrol et (Excel, Word, Google Sheets doğrudan <table> üretir)
            const htmlData = clipboardData.getData('text/html');
            if (htmlData && htmlData.includes('<table')) {
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlData, 'text/html');
                    const tables = doc.querySelectorAll('table');
                    if (tables.length > 0) {
                        // En dıştaki ilk tabloyu al
                        return this.convertHtmlTable(tables[0]);
                    }
                } catch (err) {
                    console.warn('[UkiTable] HTML tablo ayrıştırma hatası:', err);
                }
            }

            // 2. HTML tablo yoksa text/plain içerisindeki TSV (Tab-Separated Values) formatını kontrol et
            const plainText = clipboardData.getData('text/plain');
            if (plainText && plainText.includes('\t')) {
                const table = this.parseTsvToTable(plainText);
                if (table) return table;
            }

            return null;
        },

        /**
         * Excel veya Word'den gelen ham HTML <table> elemanını UYAP standardına dönüştürür.
         */
        convertHtmlTable: function(origTable) {
            const trElements = Array.from(origTable.querySelectorAll('tr'));
            if (trElements.length === 0) return null;

            // Satır ve sütun hesaplaması
            let maxCols = 0;
            const rowData = [];

            trElements.forEach(tr => {
                const cells = Array.from(tr.querySelectorAll(':scope > td, :scope > th'));
                if (cells.length === 0) return;

                let rowColCount = 0;
                const cellDefs = [];

                cells.forEach(cell => {
                    const colspan = parseInt(cell.getAttribute('colspan'), 10) || 1;
                    const rowspan = parseInt(cell.getAttribute('rowspan'), 10) || 1;
                    rowColCount += colspan;

                    const isHeader = cell.tagName.toLowerCase() === 'th';
                    const align = safeAlign(cell.style.textAlign || cell.getAttribute('align'), isHeader ? 'center' : 'left');
                    const bgColor = sanitizeBgColor(cell.style.backgroundColor || cell.getAttribute('bgcolor') || (isHeader ? '#f1f5f9' : ''));

                    cellDefs.push({
                        colspan,
                        rowspan,
                        align,
                        bgColor,
                        isHeader,
                        contentHtml: extractCellParagraphs(cell, align)
                    });
                });

                if (rowColCount > maxCols) maxCols = rowColCount;
                rowData.push(cellDefs);
            });

            if (maxCols === 0 || rowData.length === 0) return null;

            // UYAP Standardı Table DOM Elemanı Oluştur
            const tableEl = document.createElement('table');
            tableEl.className = 'udf-table';
            tableEl.setAttribute('data-border', 'borderCell');
            tableEl.setAttribute('data-table-name', 'Sabit');
            tableEl.style.width = '100%';
            tableEl.style.borderCollapse = 'collapse';
            tableEl.style.margin = '8pt 0';
            tableEl.style.tableLayout = 'fixed';

            const tbody = document.createElement('tbody');
            const colWidthPct = (100 / maxCols).toFixed(2);

            rowData.forEach(cells => {
                const tr = document.createElement('tr');
                cells.forEach(c => {
                    const td = document.createElement('td');
                    td.style.border = '1px solid #777';
                    td.style.padding = '4pt 6pt';
                    td.style.verticalAlign = 'top';

                    const effectiveWidthPct = (colWidthPct * c.colspan).toFixed(2);
                    td.style.width = `${effectiveWidthPct}%`;

                    if (c.colspan > 1) td.setAttribute('colspan', c.colspan);
                    if (c.rowspan > 1) td.setAttribute('rowspan', c.rowspan);
                    if (c.bgColor) td.style.backgroundColor = c.bgColor;

                    td.innerHTML = c.contentHtml;
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });

            tableEl.appendChild(tbody);
            return tableEl;
        },

        /**
         * Sekme ile ayrılmış düz metni (TSV / Excel kopyası) UYAP tablosuna dönüştürür.
         */
        parseTsvToTable: function(text) {
            const rawLines = text.split(/\r?\n/).filter(line => line.length > 0);
            if (rawLines.length === 0) return null;

            const grid = rawLines.map(line => line.split('\t'));
            const maxCols = Math.max(...grid.map(row => row.length));

            // En az 2 sütun ve en az 1 satır olmalı
            if (maxCols < 2) return null;

            const tableEl = document.createElement('table');
            tableEl.className = 'udf-table';
            tableEl.setAttribute('data-border', 'borderCell');
            tableEl.setAttribute('data-table-name', 'Sabit');
            tableEl.style.width = '100%';
            tableEl.style.borderCollapse = 'collapse';
            tableEl.style.margin = '8pt 0';
            tableEl.style.tableLayout = 'fixed';

            const tbody = document.createElement('tbody');
            const colWidthPct = (100 / maxCols).toFixed(2);

            grid.forEach(row => {
                const tr = document.createElement('tr');
                for (let c = 0; c < maxCols; c++) {
                    const val = (row[c] || '').trim();
                    const td = document.createElement('td');
                    td.style.border = '1px solid #777';
                    td.style.padding = '4pt 6pt';
                    td.style.verticalAlign = 'top';
                    td.style.width = `${colWidthPct}%`;

                    const cleanVal = escapeHtml(val);
                    td.innerHTML = `<p style="margin: 0; line-height: 1.15; font-family: 'Times New Roman', serif; font-size: 11pt;">${cleanVal || '<br>'}</p>`;
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            });

            tableEl.appendChild(tbody);
            return tableEl;
        },

        /**
         * Hazırlanan tabloyu imlecin bulunduğu konuma düzgün şekilde yerleştirir.
         * Paragrafın içindeyse paragrafı böler; boş paragrafsa yerine geçer.
         */
        insertTableAtSelection: function(tableEl, editorEl, explicitRange = null) {
            const sel = window.getSelection();

            // Takip eden boş paragraf (kullanıcının tablodan sonra yazmaya devam edebilmesi için)
            const pAfter = document.createElement('p');
            pAfter.style.margin = '0';
            pAfter.style.lineHeight = '1.15';
            pAfter.style.fontFamily = "'Times New Roman', serif";
            pAfter.style.fontSize = '12pt';
            pAfter.innerHTML = '<br>';

            let range = explicitRange;
            if (!range && sel && sel.rangeCount > 0 && editorEl.contains(sel.anchorNode)) {
                range = sel.getRangeAt(0);
            }

            if (!range || !editorEl.contains(range.startContainer)) {
                editorEl.appendChild(tableEl);
                editorEl.appendChild(pAfter);
                try {
                    const firstTd = tableEl.querySelector('td p') || tableEl.querySelector('td');
                    if (firstTd) {
                        const r = document.createRange();
                        r.selectNodeContents(firstTd);
                        r.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(r);
                    }
                } catch (_) {}
                return;
            }

            range.deleteContents();

            // Seçimin bulunduğu en üst seviye blok öğeyi (p, div, table) bul
            let node = range.startContainer;
            while (node && node.parentNode && node.parentNode !== editorEl && !node.parentNode.classList?.contains('a4-page')) {
                node = node.parentNode;
            }

            const parent = (node && node.parentNode) ? node.parentNode : editorEl;

            if (node && node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'p') {
                const isBlank = !node.textContent.trim() && !node.querySelector('img, table');
                if (isBlank) {
                    // Boş paragraf ise doğrudan yerine koy
                    parent.insertBefore(tableEl, node);
                    parent.insertBefore(pAfter, node);
                    node.remove();
                } else {
                    // Paragraf dolu ise imleçten sonrasını ayır
                    const afterRange = range.cloneRange();
                    afterRange.setEndAfter(node);
                    const afterFrag = afterRange.extractContents();

                    if (afterFrag.childNodes.length > 0 && afterFrag.textContent.trim()) {
                        pAfter.innerHTML = '';
                        pAfter.appendChild(afterFrag);
                    }

                    if (node.nextSibling) {
                        parent.insertBefore(tableEl, node.nextSibling);
                        parent.insertBefore(pAfter, tableEl.nextSibling);
                    } else {
                        parent.appendChild(tableEl);
                        parent.appendChild(pAfter);
                    }
                }
            } else if (node && node.parentNode === parent) {
                if (node.nextSibling) {
                    parent.insertBefore(tableEl, node.nextSibling);
                    parent.insertBefore(pAfter, tableEl.nextSibling);
                } else {
                    parent.appendChild(tableEl);
                    parent.appendChild(pAfter);
                }
            } else {
                range.insertNode(pAfter);
                range.insertNode(tableEl);
            }

            editorEl.dispatchEvent(new Event('input', {bubbles:true}));
            // İmleci tablonun ilk hücresine taşı
            try {
                const firstTd = tableEl.querySelector('td p') || tableEl.querySelector('td');
                if (firstTd) {
                    const newRange = document.createRange();
                    newRange.selectNodeContents(firstTd);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                }
            } catch (err) {}
        }
    };

    window.UkiTable = UkiTable;

})(window);
