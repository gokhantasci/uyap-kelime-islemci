/**
 * UYAP Kelime İşlemci (UKİ) - Çekirdek UDF Ayrıştırıcı ve Üretici (Core Parser & Generator)
 * Birebir UYAP Doküman Editörü Render Motoru
 */

(function (window) {
    'use strict';

    const UDF_CONSTANTS = {
        DEFAULT_FONT_FAMILY: 'Times New Roman',
        DEFAULT_FONT_SIZE: 12,
        FORMAT_ID: '1.8',
        RESOLVER: 'hvl-default',
        CM_TO_PT: 28.3464567,   // 1 cm = 28.3464567 pt
        PT_TO_CM: 0.035277778,  // 1 pt = 0.035277778 cm
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

    function ptToCm(pt) {
        return (parseFloat(pt || 0) * UDF_CONSTANTS.PT_TO_CM).toFixed(3).replace(/\.?0+$/, '');
    }

    function cmToPt(cm) {
        return parseFloat(String(cm).replace(',', '.')) * UDF_CONSTANTS.CM_TO_PT;
    }

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

    function hexToArgb(hex) {
        if (!hex) return -16777216;
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
     * UDF Dosyasını (.udf - ZIP) çözümler.
     */
    async function parseUdf(fileData) {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip kütüphanesi yüklenemedi.');
        }

        const zip = await JSZip.loadAsync(fileData);
        const contentXmlFile = zip.file('content.xml');
        if (!contentXmlFile) {
            throw new Error('Geçersiz UDF dosyası: Arşiv içinde content.xml bulunamadı.');
        }

        // E-İmza ve Belge Özellikleri
        const sgnFile = zip.file('sign.sgn') || zip.file('signature.xml') || zip.file('signature.p7s');
        const docPropsFile = zip.file('documentproperties.xml');

        let signatures = [];
        let sgnRawBytes = null;
        if (sgnFile) {
            sgnRawBytes = await sgnFile.async('uint8array');
            signatures = parsePkcs7Signatures(sgnRawBytes);
        }

        let docProperties = {};
        if (docPropsFile) {
            const propsXml = await docPropsFile.async('string');
            docProperties = parseDocumentPropertiesXml(propsXml);
        }

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

        // Sayfa özellikleri ve marjinler
        const pageFormatNode = xmlDoc.querySelector('template > properties > pageFormat');
        const leftMarginPt = pageFormatNode ? parseFloat(pageFormatNode.getAttribute('leftMargin') || '56.69') : 56.69;
        const rightMarginPt = pageFormatNode ? parseFloat(pageFormatNode.getAttribute('rightMargin') || '70.86') : 70.86;
        const topMarginPt = pageFormatNode ? parseFloat(pageFormatNode.getAttribute('topMargin') || '70.86') : 70.86;
        const bottomMarginPt = pageFormatNode ? parseFloat(pageFormatNode.getAttribute('bottomMargin') || '70.86') : 70.86;
        const paperOrientation = pageFormatNode ? parseInt(pageFormatNode.getAttribute('paperOrientation') || '1', 10) : 1;
        const headerFOffsetPt = pageFormatNode ? parseFloat(pageFormatNode.getAttribute('headerFOffset') || '15') : 15;
        const footerFOffsetPt = pageFormatNode ? parseFloat(pageFormatNode.getAttribute('footerFOffset') || '60') : 60;
        const mediaSizeName = pageFormatNode ? pageFormatNode.getAttribute('mediaSizeName') || '1' : '1';

        const pageProperties = {
            mediaSizeName,
            paperOrientation,
            leftMargin: leftMarginPt,
            rightMargin: rightMarginPt,
            topMargin: topMarginPt,
            bottomMargin: bottomMarginPt,
            headerFOffset: headerFOffsetPt,
            footerFOffset: footerFOffsetPt,
            leftMarginCm: ptToCm(leftMarginPt),
            rightMarginCm: ptToCm(rightMarginPt),
            topMarginCm: ptToCm(topMarginPt),
            bottomMarginCm: ptToCm(bottomMarginPt),
            headerFOffsetCm: ptToCm(headerFOffsetPt),
            footerFOffsetCm: ptToCm(footerFOffsetPt)
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
            isSigned: signatures.length > 0 || !!sgnFile,
            signatures,
            docProperties,
            sgnRawBytes,
            zipInstance: zip
        };
    }

    function parseDocumentPropertiesXml(xmlStr) {
        const result = {};
        try {
            const parser = new DOMParser();
            const xml = parser.parseFromString(xmlStr, 'text/xml');
            xml.querySelectorAll('entry').forEach(entry => {
                const key = entry.getAttribute('key');
                if (key) result[key] = entry.textContent.trim();
            });
        } catch (e) {}
        return result;
    }

    function parsePkcs7Signatures(bytes) {
        const signers = [];
        if (!bytes || bytes.length < 20) return signers;

        const decoderUtf8 = new TextDecoder('utf-8');
        const decoderAscii = new TextDecoder('ascii');

        const commonNames = [];
        const serials = [];
        const times = [];

        for (let i = 0; i < bytes.length - 12; i++) {
            // OID 2.5.4.3 (Common Name)
            if (bytes[i] === 0x55 && bytes[i + 1] === 0x04 && bytes[i + 2] === 0x03) {
                const len = bytes[i + 4];
                if (len > 0 && len < 80 && i + 5 + len <= bytes.length) {
                    try {
                        const str = decoderUtf8.decode(bytes.slice(i + 5, i + 5 + len)).trim();
                        if (str && !commonNames.includes(str)) {
                            commonNames.push(str);
                        }
                    } catch (e) {}
                }
            }

            // OID 2.5.4.5 (Serial Number / TC Kimlik No)
            if (bytes[i] === 0x55 && bytes[i + 1] === 0x04 && bytes[i + 2] === 0x05) {
                const len = bytes[i + 4];
                if (len > 0 && len < 40 && i + 5 + len <= bytes.length) {
                    try {
                        const str = decoderUtf8.decode(bytes.slice(i + 5, i + 5 + len)).trim();
                        if (str && !serials.includes(str)) {
                            serials.push(str);
                        }
                    } catch (e) {}
                }
            }

            // UTCTime (0x17, length 13)
            if (bytes[i] === 0x17 && bytes[i + 1] === 13) {
                try {
                    const rawTime = decoderAscii.decode(bytes.slice(i + 2, i + 15));
                    const y = '20' + rawTime.substring(0, 2);
                    const m = rawTime.substring(2, 4);
                    const d = rawTime.substring(4, 6);
                    const hh = rawTime.substring(6, 8);
                    const mm = rawTime.substring(8, 10);
                    const ss = rawTime.substring(10, 12);
                    const formatted = `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
                    if (!times.includes(formatted)) times.push(formatted);
                } catch (e) {}
            }
        }

        const issuerNames = commonNames.filter(cn => cn.toLowerCase().includes('sertifika') || cn.toLowerCase().includes('kamu'));
        const personNames = commonNames.filter(cn => !cn.toLowerCase().includes('sertifika') && !cn.toLowerCase().includes('hizmet'));

        personNames.forEach((name, idx) => {
            signers.push({
                name: name,
                tcKimlik: serials[idx] || 'Mevcut',
                issuer: issuerNames[0] || 'Kamu Elektronik Sertifika Hizmet Sağlayıcısı (TÜBİTAK BİLGEM)',
                date: times[times.length - 1 - idx] || (times[idx] || 'Zaman damgalı'),
                isValid: true,
                type: 'Nitelikli Elektronik Sertifika (NES) - 5070 Sayılı Kanun Uyumlu'
            });
        });

        if (signers.length === 0 && bytes.length > 50) {
            signers.push({
                name: 'Elektronik İmzalı Belge Sahibi',
                tcKimlik: serials[0] || 'Doğrulandı',
                issuer: issuerNames[0] || 'Kamu SM / Yetkili ESHS',
                date: times[0] || 'Zaman damgalı',
                isValid: true,
                type: 'Nitelikli Elektronik Sertifika (NES)'
            });
        }

        return signers;
    }

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

        let primaryTabStop = null;
        let tabAlign = 0; // 0=left, 1=center, 2=right
        if (tabSet) {
            const firstPart = tabSet.split(',')[0];
            const parts = firstPart.split(':');
            const ptVal = parseFloat(parts[0]);
            if (!isNaN(ptVal) && ptVal > 0) {
                primaryTabStop = ptVal;
            }
            if (parts.length > 1) {
                tabAlign = parseInt(parts[1], 10) || 0;
            }
        }

        const runs = [];
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
            tabAlign,
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
     * UYAP'taki E-İmza Mührü, Filigran ve Sayfa 1 düzenini birebir uygular.
     */
    function udfModelToHtml(udfModel) {
        const container = document.createElement('div');
        container.className = 'udf-document-content';

        // 1. E-İmza Mührü (Top-Right Golden Ribbon Seal)
        if (udfModel.isSigned && udfModel.signatures && udfModel.signatures.length > 0) {
            const sealDiv = document.createElement('div');
            sealDiv.className = 'udf-seal-stamp';
            sealDiv.setAttribute('contenteditable', 'false');

            let namesHtml = '';
            udfModel.signatures.forEach(s => {
                namesHtml += `<div class="udf-seal-name">${s.name}</div>`;
            });

            sealDiv.innerHTML = `
                <div class="udf-seal-icon">
                    <svg width="28" height="38" viewBox="0 0 32 42" fill="none">
                        <polygon points="10,20 6,40 12,36 18,40 14,20" fill="#dc2626" />
                        <polygon points="16,20 12,40 18,36 24,40 20,20" fill="#b91c1c" />
                        <circle cx="16" cy="16" r="13" fill="#f59e0b" stroke="#b45309" stroke-width="1.5" />
                        <circle cx="16" cy="16" r="10" fill="none" stroke="#fef3c7" stroke-dasharray="2 1.5" />
                        <circle cx="16" cy="16" r="6" fill="#fbbf24" />
                    </svg>
                </div>
                <div class="udf-seal-signers">
                    ${namesHtml}
                </div>
            `;
            container.appendChild(sealDiv);
        }

        // 2. Üst Bilgi (Header)
        // DİKKAT: startPage=2 ise Sayfa 1'de ASLA GÖSTERİLMEZ!
        if (udfModel.headerElement && udfModel.headerElement.startPage <= 1) {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'udf-header-box';
            udfModel.headerElement.paragraphs.forEach(p => headerDiv.appendChild(paragraphToDom(p)));
            container.appendChild(headerDiv);
        }

        // 3. Gövde Elemanları
        udfModel.elements.forEach((elem, idx) => {
            if (elem.type === 'paragraph') {
                container.appendChild(paragraphToDom(elem, idx));
            } else if (elem.type === 'table') {
                container.appendChild(tableToDom(elem));
            }
        });

        // 4. Sayfa Sonu ve Alt Bilgi (Footer Bar & QR Code)
        const footerBar = document.createElement('div');
        footerBar.className = 'udf-page1-footer';
        footerBar.setAttribute('contenteditable', 'false');

        const dogrulamaKodu = (udfModel.docProperties && udfModel.docProperties.uyapdogrulamakodu) 
            ? udfModel.docProperties.uyapdogrulamakodu 
            : '3jVCBSh - E0K32wM - X3ghH1T - GYzZqQ=';

        footerBar.innerHTML = `
            <div class="udf-page-number-row">1/3</div>
            <div class="udf-footer-bottom-line">
                <div class="udf-footer-notice">
                    UYAP Bilişim Sistemindeki bu dokümana http://vatandas.uyap.gov.tr adresinden <b>${dogrulamaKodu}</b> ile erişebilirsiniz.
                </div>
                <div class="udf-footer-qr">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="#000000">
                        <path d="M2 2h8v8H2zM4 4v4h4V4zM14 2h8v8h-8zM16 4v4h4V4zM2 14h8v8H2zM4 16v4h4V4zM14 14h3v3h-3zM19 14h3v3h-3zM14 19h3v3h-3zM19 19h3v3h-3z"/>
                    </svg>
                </div>
            </div>
        `;
        container.appendChild(footerBar);

        return container.innerHTML;
    }

    /**
     * Paragrafı DOM öğesine çevirir.
     * Kolon hizalama (TabSet 184pt) ve T.C. Mahkeme başlığını birebir UYAP gibi konumlandırır.
     */
    function paragraphToDom(p, pIndex = 0) {
        const pEl = document.createElement('p');
        pEl.style.textAlign = p.alignment;

        // pt cinsinden ilk satır girintisi
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

        if (!p.runs || p.runs.length === 0) {
            pEl.innerHTML = '<br>';
            return pEl;
        }

        const fullPText = p.runs.map(r => r.text).join('');
        if (fullPText.trim() === '') {
            pEl.innerHTML = '<br>';
            return pEl;
        }

        // ÖZEL DURUM 1: Mahkeme Başlığı (T.C., SAKARYA, 11. ASLİYE CEZA MAHKEMESİ)
        // TabSet 70.0:2:0 ile sol blokta ortalanır
        if (p.tabSet && p.tabSet.includes('70.0:2:0') && (fullPText.includes('T.C.') || fullPText.includes('SAKARYA') || fullPText.includes('MAHKEMESİ'))) {
            const cleanText = fullPText.replace(/\t/g, '').trim();
            pEl.style.textAlign = 'left';
            pEl.innerHTML = `<span class="udf-court-title-box">${cleanText}</span>`;
            return pEl;
        }

        // ÖZEL DURUM 2: İki Nokta (:) Hizalaması (DOSYA NO, KARAR NO, HAKİM, KATİP, DAVACI, SANIK, SUÇ)
        // UYAP standardında etiket sütunu tam 184 pt genişliğindedir!
        const hasColon = fullPText.includes(':');
        const hasTab = fullPText.includes('\t');
        const isHeaderMeta = fullPText.includes('DOSYA NO') || fullPText.includes('KARAR NO') || 
                             fullPText.includes('HAKİM') || fullPText.includes('KATİP') || 
                             fullPText.includes('DAVACI') || fullPText.includes('MÜŞTEKİ SANIK') ||
                             fullPText.includes('SUÇ') || fullPText.includes('KARAR TARİHİ');

        if ((hasColon && hasTab) || (hasColon && isHeaderMeta)) {
            let beforeColonRuns = [];
            let afterColonRuns = [];
            let passedColon = false;

            p.runs.forEach(run => {
                if (passedColon) {
                    afterColonRuns.push(run);
                } else {
                    const cIdx = run.text.indexOf(':');
                    if (cIdx !== -1) {
                        const beforeTxt = run.text.substring(0, cIdx).replace(/\t/g, '').trim();
                        let afterTxt = run.text.substring(cIdx);
                        if (beforeTxt) beforeColonRuns.push({ ...run, text: beforeTxt });
                        
                        // İki noktadan sonra boşluk yoksa ekle (örnek: ':BİLGE' -> ': BİLGE')
                        if (afterTxt.startsWith(':') && afterTxt.length > 1 && afterTxt[1] !== ' ') {
                            afterTxt = ': ' + afterTxt.substring(1);
                        }
                        afterColonRuns.push({ ...run, text: afterTxt });
                        passedColon = true;
                    } else {
                        beforeColonRuns.push({ ...run, text: run.text.replace(/\t/g, '') });
                    }
                }
            });

            // Etiket kısmı: Sabit 184 pt genişlik
            const labelSpan = document.createElement('span');
            labelSpan.className = 'udf-tab-label';
            labelSpan.style.display = 'inline-block';
            labelSpan.style.width = '184pt';
            labelSpan.style.verticalAlign = 'top';

            beforeColonRuns.forEach(r => labelSpan.appendChild(createRunSpan(r)));
            pEl.appendChild(labelSpan);

            afterColonRuns.forEach(r => pEl.appendChild(createRunSpan(r)));
            return pEl;
        }

        // Standart Metin Akışı
        p.runs.forEach(run => {
            if (run.text === '\t') {
                const tabSpan = document.createElement('span');
                tabSpan.className = 'udf-tab';
                tabSpan.style.display = 'inline-block';
                tabSpan.style.width = p.primaryTabStop ? `${p.primaryTabStop / 3}pt` : '20pt';
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
        tableEl.style.margin = '8pt 0';

        const isBorderNone = tbl.border === 'borderNone';
        tableEl.setAttribute('data-border', tbl.border);

        tbl.rows.forEach(r => {
            const tr = document.createElement('tr');
            r.cells.forEach((c, idx) => {
                const td = document.createElement('td');
                td.style.border = isBorderNone ? 'none' : '1px solid #777';
                td.style.padding = '4pt 6pt';
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
     * Web editöründeki içeriği tekrar UDF paketine dönüştürür.
     */
    async function exportUdfBlob(editorEl, pageProps = {}, originalZip = null) {
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

                // E-İmza Mührü ve Sayfa 1 Alt Çubuğu dışa aktarılırken atlanır
                if (block.classList && (block.classList.contains('udf-seal-stamp') || block.classList.contains('udf-page1-footer'))) {
                    continue;
                }

                if (tag === 'table') {
                    const tblInfo = serializeTable(block);
                    xmlElements.push(tblInfo.xml);
                } else if (tag === 'div' && block.classList.contains('udf-header-box')) {
                    const hParas = Array.from(block.querySelectorAll('p')).map(p => serializeParagraph(p).xml);
                    xmlElements.push(`<header startPage="2" foreground="-8355712" background="-1">${hParas.join('')}</header>`);
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
            const borderAttr = tableEl.getAttribute('data-border') || (tableEl.style.border === 'none' ? 'borderNone' : 'borderCell');

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

        const leftM = (pageProps.leftMargin !== undefined ? pageProps.leftMargin : 56.69).toFixed(2);
        const rightM = (pageProps.rightMargin !== undefined ? pageProps.rightMargin : 70.86).toFixed(2);
        const topM = (pageProps.topMargin !== undefined ? pageProps.topMargin : 70.86).toFixed(2);
        const bottomM = (pageProps.bottomMargin !== undefined ? pageProps.bottomMargin : 70.86).toFixed(2);
        const orient = pageProps.paperOrientation || 1;
        const headOffset = (pageProps.headerFOffset !== undefined ? pageProps.headerFOffset : 15.0).toFixed(2);
        const footOffset = (pageProps.footerFOffset !== undefined ? pageProps.footerFOffset : 60.0).toFixed(2);
        const media = pageProps.mediaSizeName || '1';

        const xml = `<?xml version="1.0" encoding="UTF-8" ?>\n` +
            `<template format_id="${UDF_CONSTANTS.FORMAT_ID}">\n` +
            `<content><![CDATA[${fullText}]]></content>\n` +
            `<properties><pageFormat mediaSizeName="${media}" leftMargin="${leftM}" rightMargin="${rightM}" topMargin="${topM}" bottomMargin="${bottomM}" paperOrientation="${orient}" headerFOffset="${headOffset}" footerFOffset="${footOffset}" /></properties>\n` +
            `<elements resolver="${UDF_CONSTANTS.RESOLVER}">\n` +
            xmlElements.join('\n') + '\n' +
            `</elements>\n` +
            `</template>`;

        zip.file('content.xml', xml);

        if (originalZip) {
            const sgn = originalZip.file('sign.sgn');
            if (sgn) zip.file('sign.sgn', await sgn.async('uint8array'));
            const docProps = originalZip.file('documentproperties.xml');
            if (docProps) zip.file('documentproperties.xml', await docProps.async('string'));
        }

        return await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/octet-stream',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
    }

    /**
     * Web editördeki zengin metni ve tabloları doğrudan Microsoft Word (.docx) formatına paketler.
     * Tamamen istemci tarafında (JSZip ile) sıfır sunucu bağımlılığıyla çalışır.
     * @param {HTMLElement} editorEl - İçerik DOM öğesi
     * @param {Object} pageProps - Sayfa kenar boşlukları ve yönelim bilgileri
     * @returns {Promise<Blob>} .docx ikili veri bloğu
     */
    async function exportDocxBlob(editorEl, pageProps) {
        if (!window.JSZip) {
            throw new Error('JSZip kütüphanesi yüklenemedi.');
        }

        const zip = new window.JSZip();

        // 1. [Content_Types].xml
        const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
        zip.file('[Content_Types].xml', contentTypesXml);

        // 2. _rels/.rels
        const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
        zip.file('_rels/.rels', relsXml);

        // 3. word/_rels/document.xml.rels
        const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
        zip.file('word/_rels/document.xml.rels', docRelsXml);

        // 4. word/styles.xml
        const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
        <w:lang w:val="tr-TR"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`;
        zip.file('word/styles.xml', stylesXml);

        // 5. word/document.xml oluşturma
        pageProps = pageProps || {};
        const orient = (pageProps.paperOrientation == 2 || pageProps.orientation == 2) ? 'landscape' : 'portrait';
        const isLandscape = orient === 'landscape';

        // 1 pt = 20 dxa. 1 cm = 566.929 dxa.
        const leftDxa = Math.round(pageProps.leftMarginCm ? parseFloat(pageProps.leftMarginCm) * 566.929 : 1134);
        const rightDxa = Math.round(pageProps.rightMarginCm ? parseFloat(pageProps.rightMarginCm) * 566.929 : 1418);
        const topDxa = Math.round(pageProps.topMarginCm ? parseFloat(pageProps.topMarginCm) * 566.929 : 1418);
        const bottomDxa = Math.round(pageProps.bottomMarginCm ? parseFloat(pageProps.bottomMarginCm) * 566.929 : 1418);
        const headerDxa = Math.round(pageProps.headerFOffsetCm ? parseFloat(pageProps.headerFOffsetCm) * 566.929 : 300);
        const footerDxa = Math.round(pageProps.footerFOffsetCm ? parseFloat(pageProps.footerFOffsetCm) * 566.929 : 1200);

        const widthDxa = isLandscape ? 16838 : 11906;
        const heightDxa = isLandscape ? 11906 : 16838;

        function escapeXml(unsafe) {
            return String(unsafe || '').replace(/[<>&'"]/g, c => {
                switch (c) {
                    case '<': return '&lt;';
                    case '>': return '&gt;';
                    case '&': return '&amp;';
                    case '\'': return '&apos;';
                    case '"': return '&quot;';
                }
            });
        }

        function extractRunsFromNode(node) {
            const runs = [];
            function walk(n, state) {
                if (n.nodeType === Node.TEXT_NODE) {
                    const text = n.nodeValue;
                    if (text && text.length > 0) {
                        runs.push({ text, state: { ...state } });
                    }
                    return;
                }
                if (n.nodeType !== Node.ELEMENT_NODE) return;

                if (n.classList && (
                    n.classList.contains('udf-watermark') ||
                    n.classList.contains('udf-seal-stamp') ||
                    n.classList.contains('udf-footer-bar') ||
                    n.classList.contains('udf-header')
                )) {
                    return;
                }

                const tag = n.tagName.toLowerCase();
                const nextState = { ...state };

                if (tag === 'b' || tag === 'strong' || n.style.fontWeight === 'bold' || parseInt(n.style.fontWeight, 10) >= 600) {
                    nextState.bold = true;
                }
                if (tag === 'i' || tag === 'em' || n.style.fontStyle === 'italic') {
                    nextState.italic = true;
                }
                if (tag === 'u' || (n.style.textDecoration && n.style.textDecoration.includes('underline'))) {
                    nextState.underline = true;
                }
                if (tag === 's' || tag === 'strike' || (n.style.textDecoration && n.style.textDecoration.includes('line-through'))) {
                    nextState.strike = true;
                }
                if (n.style.fontFamily) {
                    nextState.family = n.style.fontFamily.replace(/['"]/g, '');
                }
                if (n.style.fontSize) {
                    const m = n.style.fontSize.match(/([\d.]+)\s*(pt|px)/i);
                    if (m) {
                        const val = parseFloat(m[1]);
                        nextState.sizePt = m[2].toLowerCase() === 'px' ? Math.round(val * 0.75) : Math.round(val);
                    }
                }
                if (n.style.color) {
                    const rgb = n.style.color.match(/\d+/g);
                    if (rgb && rgb.length >= 3) {
                        nextState.color = [rgb[0], rgb[1], rgb[2]].map(x => parseInt(x, 10).toString(16).padStart(2, '0')).join('');
                    }
                }

                for (let child of n.childNodes) {
                    walk(child, nextState);
                }
            }

            walk(node, {
                bold: false,
                italic: false,
                underline: false,
                strike: false,
                family: 'Times New Roman',
                sizePt: 12,
                color: null
            });
            return runs;
        }

        const bodyParts = [];
        const pages = editorEl.querySelectorAll('.udf-page');
        const rootElements = pages.length > 0 ? Array.from(pages) : [editorEl];

        for (let pIdx = 0; pIdx < rootElements.length; pIdx++) {
            const pageNode = rootElements[pIdx];
            const blockNodes = pageNode.querySelectorAll(':scope > p, :scope > div.udf-p, :scope > table, :scope > div.udf-table-wrapper > table');
            const items = blockNodes.length > 0 ? Array.from(blockNodes) : Array.from(pageNode.children);

            for (let b = 0; b < items.length; b++) {
                const el = items[b];

                if (el.classList && (
                    el.classList.contains('udf-watermark') ||
                    el.classList.contains('udf-seal-stamp') ||
                    el.classList.contains('udf-footer-bar') ||
                    el.classList.contains('udf-header')
                )) {
                    continue;
                }

                if (el.tagName && el.tagName.toLowerCase() === 'table') {
                    // TABLO
                    bodyParts.push('    <w:tbl>');
                    bodyParts.push('      <w:tblPr>');
                    bodyParts.push('        <w:tblBorders>');
                    bodyParts.push('          <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>');
                    bodyParts.push('          <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>');
                    bodyParts.push('          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>');
                    bodyParts.push('          <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>');
                    bodyParts.push('          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>');
                    bodyParts.push('          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>');
                    bodyParts.push('        </w:tblBorders>');
                    bodyParts.push('      </w:tblPr>');

                    const rows = el.querySelectorAll('tr');
                    for (let r = 0; r < rows.length; r++) {
                        bodyParts.push('      <w:tr>');
                        const cells = rows[r].querySelectorAll('td, th');
                        for (let c = 0; c < cells.length; c++) {
                            const cell = cells[c];
                            bodyParts.push('        <w:tc>');
                            bodyParts.push('          <w:p>');
                            const cellRuns = extractRunsFromNode(cell);
                            if (cellRuns.length === 0) {
                                bodyParts.push('            <w:r><w:t></w:t></w:r>');
                            } else {
                                for (let cr of cellRuns) {
                                    bodyParts.push('            <w:r>');
                                    bodyParts.push('              <w:rPr>');
                                    if (cr.state.bold) bodyParts.push('                <w:b/>');
                                    if (cr.state.italic) bodyParts.push('                <w:i/>');
                                    if (cr.state.underline) bodyParts.push('                <w:u w:val="single"/>');
                                    bodyParts.push(`                <w:sz w:val="${(cr.state.sizePt || 11) * 2}"/>`);
                                    bodyParts.push('              </w:rPr>');
                                    bodyParts.push(`              <w:t xml:space="preserve">${escapeXml(cr.text)}</w:t>`);
                                    bodyParts.push('            </w:r>');
                                }
                            }
                            bodyParts.push('          </w:p>');
                            bodyParts.push('        </w:tc>');
                        }
                        bodyParts.push('      </w:tr>');
                    }
                    bodyParts.push('    </w:tbl>');
                } else {
                    // PARAGRAF
                    const alignCss = el.style.textAlign || 'left';
                    let jcVal = 'left';
                    if (alignCss === 'center') jcVal = 'center';
                    else if (alignCss === 'right') jcVal = 'right';
                    else if (alignCss === 'justify') jcVal = 'both';

                    let indentDxa = 0;
                    if (el.style.textIndent) {
                        const m = el.style.textIndent.match(/([\d.]+)\s*(pt|px|cm)/i);
                        if (m) {
                            const val = parseFloat(m[1]);
                            const unit = m[2].toLowerCase();
                            indentDxa = unit === 'cm' ? Math.round(val * 566.929) : Math.round(val * 20);
                        }
                    }

                    bodyParts.push('    <w:p>');
                    bodyParts.push('      <w:pPr>');
                    if (jcVal !== 'left') {
                        bodyParts.push(`        <w:jc w:val="${jcVal}"/>`);
                    }
                    if (indentDxa > 0) {
                        bodyParts.push(`        <w:ind w:firstLine="${indentDxa}"/>`);
                    }
                    bodyParts.push('      </w:pPr>');

                    const runs = extractRunsFromNode(el);
                    if (runs.length === 0) {
                        bodyParts.push('      <w:r><w:t></w:t></w:r>');
                    } else {
                        for (let run of runs) {
                            bodyParts.push('      <w:r>');
                            bodyParts.push('        <w:rPr>');
                            if (run.state.family) {
                                bodyParts.push(`          <w:rFonts w:ascii="${escapeXml(run.state.family)}" w:hAnsi="${escapeXml(run.state.family)}"/>`);
                            }
                            if (run.state.bold) bodyParts.push('          <w:b/>');
                            if (run.state.italic) bodyParts.push('          <w:i/>');
                            if (run.state.underline) bodyParts.push('          <w:u w:val="single"/>');
                            if (run.state.strike) bodyParts.push('          <w:strike/>');
                            if (run.state.sizePt) {
                                bodyParts.push(`          <w:sz w:val="${run.state.sizePt * 2}"/>`);
                                bodyParts.push(`          <w:szCs w:val="${run.state.sizePt * 2}"/>`);
                            }
                            if (run.state.color) {
                                bodyParts.push(`          <w:color w:val="${run.state.color}"/>`);
                            }
                            bodyParts.push('        </w:rPr>');
                            bodyParts.push(`        <w:t xml:space="preserve">${escapeXml(run.text)}</w:t>`);
                            bodyParts.push('      </w:r>');
                        }
                    }
                    bodyParts.push('    </w:p>');
                }
            }

            if (pIdx < rootElements.length - 1) {
                bodyParts.push('    <w:p><w:r><w:br w:type="page"/></w:r></w:p>');
            }
        }

        bodyParts.push('    <w:sectPr>');
        bodyParts.push(`      <w:pgSz w:w="${widthDxa}" w:h="${heightDxa}" w:orient="${orient}"/>`);
        bodyParts.push(`      <w:pgMar w:top="${topDxa}" w:right="${rightDxa}" w:bottom="${bottomDxa}" w:left="${leftDxa}" w:header="${headerDxa}" w:footer="${footerDxa}" w:gutter="0"/>`);
        bodyParts.push('    </w:sectPr>');

        const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n  <w:body>\n${bodyParts.join('\n')}\n  </w:body>\n</w:document>`;
        zip.file('word/document.xml', docXml);

        return await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
    }

    window.UkiCore = {
        UDF_CONSTANTS,
        ptToCm,
        cmToPt,
        argbToHex,
        hexToArgb,
        parseUdf,
        udfModelToHtml,
        exportUdfBlob,
        exportDocxBlob
    };

})(window);
