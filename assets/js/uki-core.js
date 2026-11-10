/**
 * UYAP Kelime İşlemci (UKİ) - Çekirdek UDF Ayrıştırıcı ve Üretici (Core Parser & Generator)
 * Açık Kaynak Web Sürümü - Geliştirilmiş ve Birebir UYAP/PDF Uyumlu Sürüm
 */

(function (window) {
    'use strict';

    const UDF_CONSTANTS = {
        DEFAULT_FONT_FAMILY: 'Times New Roman',
        DEFAULT_FONT_SIZE: 12,
        FORMAT_ID: '1.8',
        RESOLVER: 'hvl-default',
        ALIGNMENTS: {
            '0': 'left',
            '1': 'center',
            '2': 'right',
            '3': 'justify'
        },
        ALIGNMENTS_REV: {
            'left': '0',
            'center': '1',
            'right': '2',
            'justify': '3'
        }
    };

    /**
     * Java 32-bit işaretli ARGB tamsayısını CSS HEX renk koduna dönüştürür.
     */
    function argbToHex(val) {
        if (val === undefined || val === null || val === '') return null;
        const n = parseInt(val, 10);
        if (isNaN(n)) return null;
        const unsigned = n >>> 0;
        const r = (unsigned >> 16) & 0xff;
        const g = (unsigned >> 8) & 0xff;
        const b = unsigned & 0xff;
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    /**
     * CSS Hex rengini Java 32-bit işaretli ARGB tamsayısına dönüştürür.
     */
    function hexToArgb(hex) {
        if (!hex) return -16777216; // Standart siyah
        hex = hex.replace('#', '').trim();
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        if (hex.length !== 6) return -16777216;
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        const a = 255;
        const unsigned = ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
        return (unsigned | 0);
    }

    /**
     * UDF Dosyasını (.udf - ZIP) çözümler ve nesne modeline aktarır.
     * @param {ArrayBuffer|Uint8Array} fileData
     * @returns {Promise<Object>}
     */
    async function parseUdf(fileData) {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip kütüphanesi yüklenemedi. Lütfen internet bağlantınızı veya yerel scripti kontrol edin.');
        }

        const zip = await JSZip.loadAsync(fileData);
        const contentXmlFile = zip.file('content.xml');
        if (!contentXmlFile) {
            throw new Error('Geçersiz UDF dosyası: Arşiv içinde content.xml bulunamadı.');
        }

        const signFile = zip.file('sign.sgn') || zip.file('signature.xml') || zip.file('signature.p7s');
        const isSigned = !!signFile;

        const xmlText = await contentXmlFile.async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            throw new Error('XML Ayrıştırma Hatası: ' + parseError.textContent);
        }

        // CDATA ham metin havuzu
        const contentNode = xmlDoc.querySelector('template > content');
        const rawContent = contentNode ? (contentNode.textContent || '') : '';

        // Sayfa özellikleri ve marjinler (pt cinsinden)
        const pageFormatNode = xmlDoc.querySelector('template > properties > pageFormat');
        const pageProperties = {
            mediaSizeName: pageFormatNode ? pageFormatNode.getAttribute('mediaSizeName') || '1' : '1',
            leftMargin: pageFormatNode ? parseFloat(pageFormatNode.getAttribute('leftMargin') || '56.69') : 56.69,
            rightMargin: pageFormatNode ? parseFloat(pageFormatNode.getAttribute('rightMargin') || '70.86') : 70.86,
            topMargin: pageFormatNode ? parseFloat(pageFormatNode.getAttribute('topMargin') || '70.86') : 70.86,
            bottomMargin: pageFormatNode ? parseFloat(pageFormatNode.getAttribute('bottomMargin') || '70.86') : 70.86,
            paperOrientation: pageFormatNode ? parseInt(pageFormatNode.getAttribute('paperOrientation') || '1', 10) : 1,
            headerFOffset: pageFormatNode ? parseFloat(pageFormatNode.getAttribute('headerFOffset') || '15') : 15,
            footerFOffset: pageFormatNode ? parseFloat(pageFormatNode.getAttribute('footerFOffset') || '60') : 60
        };

        // Öğeler (Elements)
        const elementsNode = xmlDoc.querySelector('template > elements');
        const elements = [];
        let headerElement = null;
        let footerElement = null;

        if (elementsNode) {
            for (let i = 0; i < elementsNode.children.length; i++) {
                const child = elementsNode.children[i];
                const tagName = child.tagName.toLowerCase();

                if (tagName === 'paragraph') {
                    elements.push(parseParagraphNode(child, rawContent));
                } else if (tagName === 'table') {
                    elements.push(parseTableNode(child, rawContent));
                } else if (tagName === 'header') {
                    headerElement = parseHeaderFooterNode(child, rawContent, 'header');
                } else if (tagName === 'footer') {
                    footerElement = parseHeaderFooterNode(child, rawContent, 'footer');
                }
            }
        }

        return {
            rawContent,
            pageProperties,
            elements,
            headerElement,
            footerElement,
            isSigned,
            zipInstance: zip
        };
    }

    /**
     * Paragraf düğümünü ayrıştırır. UYAP'taki content, field, space, tab çocuklarını eksiksiz okur.
     */
    function parseParagraphNode(pNode, rawContent) {
        const alignmentCode = pNode.getAttribute('Alignment') || '0';
        const alignment = UDF_CONSTANTS.ALIGNMENTS[alignmentCode] || 'left';
        const leftIndent = parseFloat(pNode.getAttribute('LeftIndent') || '0');
        const rightIndent = parseFloat(pNode.getAttribute('RightIndent') || '0');
        const firstLineIndent = parseFloat(pNode.getAttribute('FirstLineIndent') || '0');
        const spaceAbove = parseFloat(pNode.getAttribute('SpaceAbove') || '0');
        const spaceBelow = parseFloat(pNode.getAttribute('SpaceBelow') || '0');
        const lineSpacing = parseFloat(pNode.getAttribute('LineSpacing') || '0');
        const tabSet = pNode.getAttribute('TabSet') || '';

        // İlk tab durağını hesapla (örn: '184.0:0:0' -> 184pt)
        let primaryTabStop = null;
        if (tabSet) {
            const firstPart = tabSet.split(',')[0];
            const parts = firstPart.split(':');
            const ptVal = parseFloat(parts[0]);
            if (!isNaN(ptVal) && ptVal > 0) {
                primaryTabStop = ptVal;
            }
        }

        const runs = [];
        // Tüm çocuk öğeleri (content, field, space, tab) sırayla tara
        for (let i = 0; i < pNode.children.length; i++) {
            const child = pNode.children[i];
            const childTag = child.tagName.toLowerCase();

            const startOffsetStr = child.getAttribute('startOffset');
            const lengthStr = child.getAttribute('length');
            let text = '';

            if (startOffsetStr !== null && lengthStr !== null) {
                const startOffset = parseInt(startOffsetStr, 10);
                const length = parseInt(lengthStr, 10);
                if (length > 0 && startOffset >= 0 && startOffset + length <= rawContent.length) {
                    text = rawContent.substring(startOffset, startOffset + length);
                }
            } else if (childTag === 'tab') {
                text = '\t';
            } else if (childTag === 'space') {
                text = ' ';
            }

            const bold = child.getAttribute('bold') === 'true';
            const italic = child.getAttribute('italic') === 'true';
            const underline = child.getAttribute('underline') === 'true';
            const strikethrough = child.getAttribute('strikethrough') === 'true';
            const size = parseInt(child.getAttribute('size') || '12', 10);
            const family = child.getAttribute('family') || UDF_CONSTANTS.DEFAULT_FONT_FAMILY;
            const foreground = argbToHex(child.getAttribute('foreground'));
            const background = argbToHex(child.getAttribute('background'));

            runs.push({
                type: childTag,
                text,
                bold,
                italic,
                underline,
                strikethrough,
                size,
                family,
                foreground,
                background
            });
        }

        return {
            type: 'paragraph',
            alignment,
            leftIndent,
            rightIndent,
            firstLineIndent,
            spaceAbove,
            spaceBelow,
            lineSpacing,
            tabSet,
            primaryTabStop,
            runs
        };
    }

    function parseTableNode(tNode, rawContent) {
        const tableName = tNode.getAttribute('tableName') || 'Tablo';
        const columnCount = parseInt(tNode.getAttribute('columnCount') || '1', 10);
        const columnSpans = (tNode.getAttribute('columnSpans') || '').split(',').map(s => parseFloat(s) || 100);
        const border = tNode.getAttribute('border') || 'borderCell';

        const rows = [];
        const rowNodes = tNode.querySelectorAll(':scope > row');

        for (let r = 0; r < rowNodes.length; r++) {
            const rNode = rowNodes[r];
            const cells = [];
            const cellNodes = rNode.querySelectorAll(':scope > cell');

            for (let c = 0; c < cellNodes.length; c++) {
                const cellNode = cellNodes[c];
                const paragraphs = [];
                const pNodes = cellNode.querySelectorAll(':scope > paragraph');

                for (let p = 0; p < pNodes.length; p++) {
                    paragraphs.push(parseParagraphNode(pNodes[p], rawContent));
                }

                cells.push({
                    type: 'cell',
                    paragraphs
                });
            }

            rows.push({
                type: 'row',
                cells
            });
        }

        return {
            type: 'table',
            tableName,
            columnCount,
            columnSpans,
            border,
            rows
        };
    }

    function parseHeaderFooterNode(node, rawContent, type) {
        const startPage = parseInt(node.getAttribute('startPage') || '1', 10);
        const paragraphs = [];
        const pNodes = node.querySelectorAll(':scope > paragraph');
        for (let p = 0; p < pNodes.length; p++) {
            paragraphs.push(parseParagraphNode(pNodes[p], rawContent));
        }

        return {
            type,
            startPage,
            pageNumberSep: node.getAttribute('pageNumber-seperator') || '/',
            paragraphs
        };
    }

    /**
     * Ayrıştırılmış UDF veri modelini DOM/HTML formatına dönüştürür.
     */
    function udfModelToHtml(udfModel) {
        const container = document.createElement('div');
        container.className = 'udf-document-content';

        // Sayfa marjinlerini sakla
        if (udfModel.pageProperties) {
            container.dataset.marginLeft = `${udfModel.pageProperties.leftMargin}pt`;
            container.dataset.marginRight = `${udfModel.pageProperties.rightMargin}pt`;
            container.dataset.marginTop = `${udfModel.pageProperties.topMargin}pt`;
            container.dataset.marginBottom = `${udfModel.pageProperties.bottomMargin}pt`;
        }

        // Üst bilgi varsa (Header)
        if (udfModel.headerElement && udfModel.headerElement.paragraphs.length > 0) {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'udf-header-box';
            headerDiv.style.borderBottom = '1px solid #ddd';
            headerDiv.style.paddingBottom = '4px';
            headerDiv.style.marginBottom = '12px';
            headerDiv.style.fontSize = '9pt';
            headerDiv.style.color = '#555';
            udfModel.headerElement.paragraphs.forEach(p => headerDiv.appendChild(paragraphToDom(p)));
            container.appendChild(headerDiv);
        }

        // Ana Gövde Elemanları
        udfModel.elements.forEach(elem => {
            if (elem.type === 'paragraph') {
                container.appendChild(paragraphToDom(elem));
            } else if (elem.type === 'table') {
                container.appendChild(tableToDom(elem));
            }
        });

        // Alt bilgi varsa (Footer)
        if (udfModel.footerElement && udfModel.footerElement.paragraphs.length > 0) {
            const footerDiv = document.createElement('div');
            footerDiv.className = 'udf-footer-box';
            footerDiv.style.borderTop = '1px solid #ddd';
            footerDiv.style.paddingTop = '4px';
            footerDiv.style.marginTop = '20px';
            footerDiv.style.fontSize = '9pt';
            footerDiv.style.color = '#555';
            udfModel.footerElement.paragraphs.forEach(p => footerDiv.appendChild(paragraphToDom(p)));
            container.appendChild(footerDiv);
        }

        return container.innerHTML;
    }

    /**
     * Paragrafı DOM öğesine çevirir. Tab duraklarını ve girintileri hassas hizalar.
     */
    function paragraphToDom(p) {
        const pEl = document.createElement('p');
        pEl.style.textAlign = p.alignment;

        // Girintiler - pt cinsinden tam eşleşme
        if (p.firstLineIndent > 0) {
            pEl.style.textIndent = `${p.firstLineIndent}pt`;
        }
        if (p.leftIndent > 0) {
            pEl.style.marginLeft = `${p.leftIndent}pt`;
        }
        if (p.rightIndent > 0) {
            pEl.style.marginRight = `${p.rightIndent}pt`;
        }
        if (p.spaceAbove > 0) {
            pEl.style.marginTop = `${p.spaceAbove}pt`;
        }
        if (p.spaceBelow > 0) {
            pEl.style.marginBottom = `${p.spaceBelow}pt`;
        }

        // Boş paragraf kontrolü
        if (!p.runs || p.runs.length === 0) {
            pEl.innerHTML = '<br>';
            return pEl;
        }

        // Toplam metin kontrolü
        const fullPText = p.runs.map(r => r.text).join('');
        if (fullPText.trim() === '') {
            pEl.innerHTML = '<br>';
            return pEl;
        }

        // Tab durağı kontrolü: Eğer satırda \t varsa ve sonrasında ':' geliyorsa
        // kolon hizalaması için etiket kısmını sabit genişliğe sabitle
        const hasTab = fullPText.includes('\t');
        const colonIdx = fullPText.indexOf(':');

        if (hasTab && colonIdx !== -1 && (p.primaryTabStop || 140) >= 70) {
            // Tab durağı genişliği (varsayılan 140pt - 184pt)
            const tabWidthPt = p.primaryTabStop ? Math.min(184, Math.max(120, p.primaryTabStop)) : 140;

            let beforeColonRuns = [];
            let afterColonRuns = [];
            let passedColon = false;

            p.runs.forEach(run => {
                if (passedColon) {
                    afterColonRuns.push(run);
                } else {
                    const cIdx = run.text.indexOf(':');
                    if (cIdx !== -1) {
                        const beforeTxt = run.text.substring(0, cIdx);
                        const afterTxt = run.text.substring(cIdx);
                        if (beforeTxt) beforeColonRuns.push({ ...run, text: beforeTxt.replace(/\t/g, '') });
                        afterColonRuns.push({ ...run, text: afterTxt });
                        passedColon = true;
                    } else {
                        beforeColonRuns.push({ ...run, text: run.text.replace(/\t/g, '') });
                    }
                }
            });

            // Kolon etiket kapsayıcısı
            const labelSpan = document.createElement('span');
            labelSpan.className = 'udf-tab-label';
            labelSpan.style.display = 'inline-block';
            labelSpan.style.minWidth = `${tabWidthPt}pt`;
            labelSpan.style.verticalAlign = 'top';

            beforeColonRuns.forEach(r => labelSpan.appendChild(createRunSpan(r)));
            pEl.appendChild(labelSpan);

            afterColonRuns.forEach(r => pEl.appendChild(createRunSpan(r)));
            return pEl;
        }

        // Standart akış
        p.runs.forEach(run => {
            if (run.text === '\t') {
                const tabSpan = document.createElement('span');
                tabSpan.className = 'udf-tab';
                tabSpan.style.display = 'inline-block';
                tabSpan.style.width = p.primaryTabStop ? `${p.primaryTabStop / 2}pt` : '28pt';
                pEl.appendChild(tabSpan);
            } else {
                pEl.appendChild(createRunSpan(run));
            }
        });

        return pEl;
    }

    function createRunSpan(run) {
        const span = document.createElement('span');
        span.textContent = run.text;

        if (run.bold) span.style.fontWeight = 'bold';
        if (run.italic) span.style.fontStyle = 'italic';
        if (run.underline) span.style.textDecoration = 'underline';
        if (run.strikethrough) span.style.textDecoration = (span.style.textDecoration ? span.style.textDecoration + ' ' : '') + 'line-through';
        if (run.size) span.style.fontSize = `${run.size}pt`;
        if (run.family) span.style.fontFamily = `"${run.family}", Times New Roman, serif`;
        if (run.foreground) span.style.color = run.foreground;
        if (run.background) span.style.backgroundColor = run.background;

        return span;
    }

    function tableToDom(tbl) {
        const tableEl = document.createElement('table');
        tableEl.className = 'udf-table';
        tableEl.setAttribute('data-table-name', tbl.tableName);
        tableEl.style.width = '100%';
        tableEl.style.borderCollapse = 'collapse';
        tableEl.style.margin = '8px 0';

        const isBorderNone = tbl.border === 'borderNone';

        tbl.rows.forEach(r => {
            const tr = document.createElement('tr');
            r.cells.forEach((c, idx) => {
                const td = document.createElement('td');
                if (isBorderNone) {
                    td.style.border = 'none';
                } else {
                    td.style.border = '1px solid #777';
                }
                td.style.padding = '4px 6px';
                td.style.verticalAlign = 'top';

                if (tbl.columnSpans && tbl.columnSpans[idx]) {
                    td.style.width = `${tbl.columnSpans[idx]}px`;
                }

                if (c.paragraphs && c.paragraphs.length > 0) {
                    c.paragraphs.forEach(p => td.appendChild(paragraphToDom(p)));
                } else {
                    td.innerHTML = '<p><br></p>';
                }
                tr.appendChild(td);
            });
            tableEl.appendChild(tr);
        });

        return tableEl;
    }

    /**
     * Web editöründeki HTML içeriğini ve stilleri resmi UDF (.udf) formatında ZIP paketine dönüştürür.
     */
    async function exportUdfBlob(editorEl, options = {}) {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip kütüphanesi bulunamadı.');
        }

        const zip = new JSZip();
        let fullText = '';
        let currentOffset = 0;

        const xmlElements = [];
        const blocks = Array.from(editorEl.childNodes);

        for (const block of blocks) {
            if (block.nodeType === Node.ELEMENT_NODE) {
                const tag = block.tagName.toLowerCase();

                if (tag === 'table') {
                    const tblInfo = serializeTable(block);
                    xmlElements.push(tblInfo.xml);
                } else if (tag === 'div' && block.classList.contains('udf-header-box')) {
                    // Header bloğu
                    const hParas = Array.from(block.querySelectorAll('p')).map(p => serializeParagraph(p).xml);
                    xmlElements.push(`<header startPage="2" foreground="-8355712" background="-1">${hParas.join('')}</header>`);
                } else if (tag === 'div' && block.classList.contains('udf-footer-box')) {
                    // Footer bloğu
                    const fParas = Array.from(block.querySelectorAll('p')).map(p => serializeParagraph(p).xml);
                    xmlElements.push(`<footer foreground="-8355712" background="-1">${fParas.join('')}</footer>`);
                } else {
                    const pInfo = serializeParagraph(block);
                    xmlElements.push(pInfo.xml);
                }
            } else if (block.nodeType === Node.TEXT_NODE && block.textContent.trim()) {
                const pInfo = serializeParagraphText(block.textContent);
                xmlElements.push(pInfo.xml);
            }
        }

        function serializeParagraph(pEl) {
            const align = pEl.style.textAlign || 'left';
            const alignCode = UDF_CONSTANTS.ALIGNMENTS_REV[align] || '0';

            let firstLineIndentAttr = '';
            if (pEl.style.textIndent) {
                const pt = parseFloat(pEl.style.textIndent);
                if (!isNaN(pt) && pt > 0) {
                    firstLineIndentAttr = ` FirstLineIndent="${pt}"`;
                }
            }

            const contentsXml = [];
            const textNodes = getTextLeaves(pEl);

            if (textNodes.length === 0) {
                fullText += '\n';
                contentsXml.push(`<content startOffset="${currentOffset}" length="1" />`);
                currentOffset += 1;
            } else {
                for (const item of textNodes) {
                    const text = item.text;
                    const len = text.length;
                    const start = currentOffset;
                    fullText += text;
                    currentOffset += len;

                    const attrs = [];
                    attrs.push(`startOffset="${start}"`);
                    attrs.push(`length="${len}"`);

                    if (item.bold) attrs.push('bold="true"');
                    if (item.italic) attrs.push('italic="true"');
                    if (item.underline) attrs.push('underline="true"');
                    if (item.strikethrough) attrs.push('strikethrough="true"');
                    attrs.push(`size="${item.size || 12}"`);
                    attrs.push(`family="${item.family || 'Times New Roman'}"`);
                    attrs.push(`foreground="${item.foreground || -16777216}"`);

                    contentsXml.push(`<content ${attrs.join(' ')} />`);
                }
                fullText += '\n';
                contentsXml.push(`<content startOffset="${currentOffset}" length="1" />`);
                currentOffset += 1;
            }

            return {
                xml: `<paragraph Alignment="${alignCode}"${firstLineIndentAttr}>${contentsXml.join('')}</paragraph>`
            };
        }

        function serializeParagraphText(text) {
            const start = currentOffset;
            fullText += text + '\n';
            const len = text.length;
            currentOffset += len + 1;

            return {
                xml: `<paragraph Alignment="0"><content startOffset="${start}" length="${len}" size="12" family="Times New Roman" foreground="-16777216" /><content startOffset="${start + len}" length="1" /></paragraph>`
            };
        }

        function serializeTable(tableEl) {
            const rows = tableEl.querySelectorAll('tr');
            const rowXmls = [];
            let maxCols = 0;
            const isBorderNone = tableEl.style.border === 'none' || tableEl.getAttribute('border') === 'none';
            const borderAttr = isBorderNone ? 'borderNone' : 'borderCell';

            for (let rIdx = 0; rIdx < rows.length; rIdx++) {
                const tr = rows[rIdx];
                const cells = tr.querySelectorAll('td, th');
                if (cells.length > maxCols) maxCols = cells.length;

                const cellXmls = [];
                for (let cIdx = 0; cIdx < cells.length; cIdx++) {
                    const td = cells[cIdx];
                    const pNodes = td.querySelectorAll('p');
                    const pXmls = [];

                    if (pNodes.length === 0) {
                        const cellP = serializeParagraph(td);
                        pXmls.push(cellP.xml);
                    } else {
                        pNodes.forEach(p => {
                            pXmls.push(serializeParagraph(p).xml);
                        });
                    }

                    cellXmls.push(`<cell>${pXmls.join('')}</cell>`);
                }
                rowXmls.push(`<row rowName="row${rIdx + 1}" rowType="dataRow">${cellXmls.join('')}</row>`);
            }

            const colSpans = Array(maxCols).fill('100').join(',');
            return {
                xml: `<table tableName="Sabit" columnCount="${maxCols}" columnSpans="${colSpans}" border="${borderAttr}">${rowXmls.join('')}</table>`
            };
        }

        function getTextLeaves(node, inherited = {}) {
            const leaves = [];
            let style = { ...inherited };

            if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName.toLowerCase();
                if (tag === 'b' || tag === 'strong' || node.style.fontWeight === 'bold') style.bold = true;
                if (tag === 'i' || tag === 'em' || node.style.fontStyle === 'italic') style.italic = true;
                if (tag === 'u' || (node.style.textDecoration && node.style.textDecoration.includes('underline'))) style.underline = true;
                if (tag === 's' || (node.style.textDecoration && node.style.textDecoration.includes('line-through'))) style.strikethrough = true;

                if (node.style.fontSize) {
                    const pt = parseInt(node.style.fontSize, 10);
                    if (!isNaN(pt)) style.size = pt;
                }
                if (node.style.fontFamily) {
                    style.family = node.style.fontFamily.replace(/["']/g, '').split(',')[0].trim();
                }
                if (node.style.color) {
                    style.foreground = hexToArgb(rgbToHex(node.style.color));
                }

                if (tag === 'br') {
                    leaves.push({ text: '\n', ...style });
                    return leaves;
                }

                for (let i = 0; i < node.childNodes.length; i++) {
                    leaves.push(...getTextLeaves(node.childNodes[i], style));
                }
            } else if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent.length > 0) {
                    leaves.push({
                        text: node.textContent,
                        ...style
                    });
                }
            }
            return leaves;
        }

        function rgbToHex(rgbStr) {
            if (!rgbStr) return '#000000';
            if (rgbStr.startsWith('#')) return rgbStr;
            const match = rgbStr.match(/\d+/g);
            if (!match || match.length < 3) return '#000000';
            const r = parseInt(match[0], 10);
            const g = parseInt(match[1], 10);
            const b = parseInt(match[2], 10);
            return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        }

        const xml = `<?xml version="1.0" encoding="UTF-8" ?>\n` +
            `<template format_id="${UDF_CONSTANTS.FORMAT_ID}">\n` +
            `<content><![CDATA[${fullText}]]></content>\n` +
            `<properties><pageFormat mediaSizeName="1" leftMargin="56.69" rightMargin="70.86" topMargin="70.86" bottomMargin="70.86" paperOrientation="1" headerFOffset="15.0" footerFOffset="60.0" /></properties>\n` +
            `<elements resolver="${UDF_CONSTANTS.RESOLVER}">\n` +
            xmlElements.join('\n') + '\n' +
            `</elements>\n` +
            `</template>`;

        zip.file('content.xml', xml);
        return await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/octet-stream',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
    }

    window.UkiCore = {
        UDF_CONSTANTS,
        argbToHex,
        hexToArgb,
        parseUdf,
        udfModelToHtml,
        exportUdfBlob
    };

})(window);
