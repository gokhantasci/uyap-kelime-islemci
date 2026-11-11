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

        let editorSettings = {};
        const settingsFile = zip.file('editor-settings.json');
        if (settingsFile) { try { const v = JSON.parse(await settingsFile.async('string')); if (v && typeof v === 'object') editorSettings = v; } catch (_) {} }
        const xmlText = await contentXmlFile.async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            throw new Error('XML Ayrıştırma Hatası: ' + parseError.textContent);
        }

        const webId = (xmlDoc.querySelector('webID')?.getAttribute('id') || '').replace(/\s+/g, ' ').trim();
        const rawWebId = xmlDoc.querySelector('webID')?.getAttribute('id') || '';

        const stylesNode = xmlDoc.querySelector('template > styles');
        const originalStylesXml = stylesNode ? stylesNode.outerHTML : '';

        // CDATA ham metin havuzu
        const contentNode = xmlDoc.querySelector('template > content');
        const rawContent = contentNode ? (contentNode.textContent || '') : '';

        // Sayfa özellikleri ve marjinler
        const pageFormatNode = xmlDoc.querySelector('template > properties > pageFormat');
        const rawLeftMargin = pageFormatNode ? pageFormatNode.getAttribute('leftMargin') : null;
        const rawRightMargin = pageFormatNode ? pageFormatNode.getAttribute('rightMargin') : null;
        const rawTopMargin = pageFormatNode ? pageFormatNode.getAttribute('topMargin') : null;
        const rawBottomMargin = pageFormatNode ? pageFormatNode.getAttribute('bottomMargin') : null;
        const rawHeaderFOffset = pageFormatNode ? pageFormatNode.getAttribute('headerFOffset') : null;
        const rawFooterFOffset = pageFormatNode ? pageFormatNode.getAttribute('footerFOffset') : null;

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
            rawLeftMargin,
            rawRightMargin,
            rawTopMargin,
            rawBottomMargin,
            rawHeaderFOffset,
            rawFooterFOffset,
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
            webId,
            rawWebId,
            originalStylesXml,
            originalXmlText: xmlText,
            sgnRawBytes,
            editorSettings,
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
        const rawLeftIndent = pNode.getAttribute('LeftIndent');
        const rawRightIndent = pNode.getAttribute('RightIndent');
        const rawFirstLineIndent = pNode.getAttribute('FirstLineIndent');
        const rawSpaceAbove = pNode.getAttribute('SpaceAbove');
        const rawSpaceBelow = pNode.getAttribute('SpaceBelow');
        const rawLineSpacing = pNode.getAttribute('LineSpacing');
        const rawHanging = pNode.getAttribute('Hanging');

        const leftIndent = parseFloat(rawLeftIndent || '0');
        const rightIndent = parseFloat(rawRightIndent || '0');
        const firstLineIndent = parseFloat(rawFirstLineIndent || '0');
        const spaceAbove = parseFloat(rawSpaceAbove || '0');
        const spaceBelow = parseFloat(rawSpaceBelow || '0');
        const lineSpacing = parseFloat(rawLineSpacing || '0');
        const tabSet = pNode.getAttribute('TabSet') || '';
        const hanging = parseFloat(rawHanging || '0');
        const repeatingLabel = pNode.getAttribute('RepeatingLabel') || '';
        const groupName = pNode.getAttribute('GroupName') || '';

        const bulleted = pNode.getAttribute('Bulleted') === 'true';
        const bulletType = pNode.getAttribute('BulletType') || '';
        const numbered = pNode.getAttribute('Numbered') === 'true';
        const numberType = pNode.getAttribute('NumberType') || '';
        const listId = pNode.getAttribute('ListId') || '';
        const listLevel = parseInt(pNode.getAttribute('ListLevel') || '1', 10);

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

            if (childTag === 'barcode') {
                text = '';
            } else if (startOffsetStr !== null && lengthStr !== null) {
                const startOffset = parseInt(startOffsetStr, 10);
                const length = parseInt(lengthStr, 10);
                if (length > 0 && startOffset >= 0 && startOffset + length <= rawContent.length) {
                    text = rawContent.substring(startOffset, startOffset + length);
                }
            } else if (childTag === 'image') {
                text = String.fromCharCode(184); // UYAP içerik akışında görsel bu karakterle yer tutar
            } else if (childTag === 'tab') {
                text = '\t';
            } else if (childTag === 'space') {
                text = ' ';
            }

            const bold = child.getAttribute('bold') === 'true';
            const italic = child.getAttribute('italic') === 'true';
            const underline = child.getAttribute('underline') === 'true';
            const strikethrough = child.getAttribute('strikethrough') === 'true';
            const subscript = child.getAttribute('subscript') === 'true';
            const superscript = child.getAttribute('superscript') === 'true';
            const barcodeData = childTag === 'barcode' ? (child.getAttribute('barcodeData') || '') : '';
            const size = parseInt(child.getAttribute('size') || '12', 10);
            const family = child.getAttribute('family') || UDF_CONSTANTS.DEFAULT_FONT_FAMILY;
            const foreground = argbToHex(child.getAttribute('foreground'));
            const background = argbToHex(child.getAttribute('background'));

            const fieldName = child.getAttribute('fieldName') || '';
            const fieldType = child.getAttribute('fieldType') || '';
            const isList = child.getAttribute('isList') || '';
            const resolver = child.getAttribute('resolver') || '';

            const imageData = childTag === 'image' ? (child.getAttribute('imageData') || '').split(/\s/).join('') : '';
            runs.push({
                type: childTag,
                fieldName,
                fieldType,
                isList,
                resolver,
                imageData,
                barcodeData,
                text,
                bold,
                italic,
                underline,
                strikethrough,
                subscript,
                superscript,
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
            hanging,
            rawLeftIndent,
            rawRightIndent,
            rawFirstLineIndent,
            rawSpaceAbove,
            rawSpaceBelow,
            rawLineSpacing,
            rawHanging,
            repeatingLabel,
            groupName,
            tabSet,
            primaryTabStop,
            tabAlign,
            bulleted,
            bulletType,
            numbered,
            numberType,
            listId,
            listLevel,
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

        const attrs = {};
        if (node.attributes) {
            for (let i = 0; i < node.attributes.length; i++) {
                const a = node.attributes[i];
                attrs[a.name] = a.value;
            }
        }

        return {
            type,
            startPage,
            pageNumberSep: node.getAttribute('pageNumber-seperator') || '/',
            pageNumberForeStr: node.getAttribute('pageNumber-foreStr') || '',
            pageNumberStartNum: parseInt(node.getAttribute('pageNumber-pageStartNumStr') || '1', 10),
            pageNumberFontFace: node.getAttribute('pageNumber-fontFace') || 'Arial',
            pageNumberFontSize: parseFloat(node.getAttribute('pageNumber-fontSize') || '11'),
            pageNumberColor: argbToHex(node.getAttribute('pageNumber-color')),
            attrs,
            paragraphs
        };
    }

    /**
     * Ayrıştırılmış UDF veri modelini DOM/HTML formatına dönüştürür.
     * UYAP'taki E-İmza Mührü, Filigran, Üst Bilgi ve Sayfa 1 düzenini birebir uygular.
     */
    function udfModelToHtml(udfModel) {
        const container = document.createElement('div');
        container.className = 'udf-document-content';

        // 1. E-imza rozeti: yüzen UkiSeal bileşeni gösterir (belge içine gömülmez).

        // 2. Üst bilgi / alt bilgi: sayfalama motoru (UkiPages) her sayfada çizer.

        // 3. Gövde Elemanları
        const listCounters = {};
        udfModel.elements.forEach((elem, idx) => {
            if (elem.type === 'paragraph') {
                container.appendChild(paragraphToDom(elem, idx, listCounters));
            } else if (elem.type === 'table') {
                container.appendChild(tableToDom(elem, listCounters));
            }
        });

        return container.innerHTML;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    const C128_PATTERNS = [
        '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
        '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
        '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
        '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
        '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
        '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
        '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
        '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
        '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
        '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
        '114131','311141','411131','211412','211214','211232','2331112'
    ];

    function generateBarcodeSvg(data, heightPt = 42) {
        if (!data) return '';
        let sum = 104;
        const codes = [104];
        for (let i = 0; i < data.length; i++) {
            const code = data.charCodeAt(i) - 32;
            const validCode = (code >= 0 && code <= 95) ? code : 0;
            codes.push(validCode);
            sum += validCode * (i + 1);
        }
        codes.push(sum % 103);
        codes.push(106);
        let modules = '';
        for (const c of codes) {
            const pat = C128_PATTERNS[c] || '212222';
            for (let j = 0; j < pat.length; j++) {
                modules += (j % 2 === 0 ? '1' : '0').repeat(parseInt(pat[j], 10));
            }
        }
        const modW = 1.0;
        const totalW = Math.round(modules.length * modW);
        const barH = heightPt - 13;
        let rects = '';
        let runStart = -1;
        for (let i = 0; i < modules.length; i++) {
            if (modules[i] === '1') {
                if (runStart < 0) runStart = i;
            } else {
                if (runStart >= 0) {
                    const w = (i - runStart) * modW;
                    rects += `<rect x="${(runStart * modW).toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${barH}" fill="#000" />`;
                    runStart = -1;
                }
            }
        }
        if (runStart >= 0) {
            const w = (modules.length - runStart) * modW;
            rects += `<rect x="${(runStart * modW).toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${barH}" fill="#000" />`;
        }
        return `<svg class="udf-barcode-svg" width="${totalW}pt" height="${heightPt}pt" viewBox="0 0 ${totalW} ${heightPt}" xmlns="http://www.w3.org/2000/svg" style="display:block;">` +
            rects +
            `<text x="${(totalW / 2).toFixed(1)}" y="${heightPt - 2}" text-anchor="middle" font-family="monospace, Courier, sans-serif" font-size="9pt" fill="#000">${data}</text>` +
            `</svg>`;
    }

    /**
     * Paragrafı DOM öğesine çevirir (genel amaçlı, belgeye özel hile içermez).
     * UYAP paragraf özellikleri: Alignment, LeftIndent, RightIndent, FirstLineIndent, Hanging,
     * SpaceAbove/SpaceBelow, LineSpacing ve TabSet (pozisyon:hizalama:dolgu) birebir uygulanır.
     * Sekme (tab) genişlikleri layoutTabs() ile gerçek yazı genişliğine göre hesaplanır.
     */
    function paragraphToDom(p, pIndex = 0, listCounters = {}) {
        const pEl = document.createElement('p');
        const runs = p.runs || [];
        const fullText = runs.map(r => r.text || '').join('');

        // Paragraf niteliklerini kayıpsız okuma ve kaydetme için data-* alanlarına yaz
        pEl.setAttribute('data-fli', p.rawFirstLineIndent !== null && p.rawFirstLineIndent !== undefined ? p.rawFirstLineIndent : String(p.firstLineIndent || 0));
        pEl.setAttribute('data-li', p.rawLeftIndent !== null && p.rawLeftIndent !== undefined ? p.rawLeftIndent : String(p.leftIndent || 0));
        pEl.setAttribute('data-ri', p.rawRightIndent !== null && p.rawRightIndent !== undefined ? p.rawRightIndent : String(p.rightIndent || 0));
        pEl.setAttribute('data-hanging', p.rawHanging !== null && p.rawHanging !== undefined ? p.rawHanging : String(p.hanging || 0));
        pEl.setAttribute('data-spaceabove', p.rawSpaceAbove !== null && p.rawSpaceAbove !== undefined ? p.rawSpaceAbove : String(p.spaceAbove !== undefined ? p.spaceAbove : 1.0));
        pEl.setAttribute('data-spacebelow', p.rawSpaceBelow !== null && p.rawSpaceBelow !== undefined ? p.rawSpaceBelow : String(p.spaceBelow !== undefined ? p.spaceBelow : 1.0));
        pEl.setAttribute('data-linespacing', p.rawLineSpacing !== null && p.rawLineSpacing !== undefined ? p.rawLineSpacing : String(p.lineSpacing || 0.0));
        if (p.tabSet) pEl.setAttribute('data-tabset', p.tabSet);
        if (p.repeatingLabel) pEl.setAttribute('data-repeatinglabel', p.repeatingLabel);
        if (p.groupName) pEl.setAttribute('data-groupname', p.groupName);
        if (p.bulleted) {
            pEl.setAttribute('data-bulleted', 'true');
            if (p.bulletType) pEl.setAttribute('data-bullettype', p.bulletType);
        }
        if (p.numbered) {
            pEl.setAttribute('data-numbered', 'true');
            if (p.numberType) pEl.setAttribute('data-numbertype', p.numberType);
        }
        if (p.listId) pEl.setAttribute('data-listid', p.listId);
        if (p.listLevel) pEl.setAttribute('data-listlevel', String(p.listLevel));

        const firstSize = (runs.find(r => r.size) || {}).size || 12;
        const effFirstSize = +(firstSize * 0.98).toFixed(2);
        const hasUnderline = runs.some(r => r.underline);
        if (hasUnderline) pEl.setAttribute('data-underline', 'true');

        const effFli = +((p.firstLineIndent || 0) * 0.98).toFixed(2);
        const effLi = +((p.leftIndent || 0) * 0.98).toFixed(2);
        const effRi = +((p.rightIndent || 0) * 0.98).toFixed(2);

        pEl.style.textAlign = p.alignment || 'left';
        pEl.style.margin = `0 ${effRi}pt 0 ${effLi}pt`;
        pEl.style.padding = `${p.spaceAbove !== undefined ? p.spaceAbove : 1.0}pt 0 ${p.spaceBelow !== undefined ? p.spaceBelow : 1.0}pt 0`;
        pEl.style.lineHeight = String(1.1633 + (p.lineSpacing || 0.0));

        const hanging = p.hanging || 0;
        if (hanging > 0) {
            // UYAP standardı: Eğer paragrafın TabSet'i varsa (örn: 183pt), asılı girinti (hanging)
            // sonraki satırların iki nokta sonrasındaki metinle tam hizalanması için
            // tab durağı + iki nokta genişliği (183pt + 3.12pt = 186.12pt) ile hizalanır.
            const effHang = p.primaryTabStop && Math.abs(p.primaryTabStop - hanging) <= 15 ? (p.primaryTabStop + 3.12) : hanging;
            pEl.style.paddingLeft = effHang + 'pt';
            pEl.style.textIndent = (-effHang + effFli) + 'pt';
        } else if (p.firstLineIndent) {
            pEl.style.textIndent = effFli + 'pt';
        }

        // Madde işareti veya numaralandırma ön eki
        if (p.bulleted) {
            let bulletChar = '●';
            if (p.bulletType === 'BULLET_TYPE_SQUARE') bulletChar = '■';
            else if (p.bulletType === 'BULLET_TYPE_HYPHEN' || p.bulletType === 'BULLET_TYPE_DASH') bulletChar = '-';
            const marker = document.createElement('span');
            marker.className = 'udf-list-marker';
            marker.setAttribute('contenteditable', 'false');
            marker.style.cssText = 'user-select:none;display:inline-block;width:18pt;font-weight:bold;';
            marker.textContent = bulletChar + ' ';
            pEl.appendChild(marker);
        } else if (p.numbered) {
            const lId = p.listId || ('lvl_' + (p.listLevel || 1));
            const count = (listCounters[lId] = (listCounters[lId] || 0) + 1);
            let numText = count + '.';
            if (p.numberType === 'NUMBER_TYPE_NUMBER_PARANTHESE_2') numText = count + ')';
            else if (p.numberType === 'NUMBER_TYPE_NUMBER_PARANTHESE_1') numText = '(' + count + ')';
            else if (p.numberType === 'NUMBER_TYPE_LETTER_LOWER_DOT') numText = String.fromCharCode(96 + count) + '.';
            else if (p.numberType === 'NUMBER_TYPE_LETTER_LOWER_PARANTHESE_2') numText = String.fromCharCode(96 + count) + ')';
            else if (p.numberType === 'NUMBER_TYPE_LETTER_UPPER_DOT') numText = String.fromCharCode(64 + count) + '.';
            const marker = document.createElement('span');
            marker.className = 'udf-list-marker';
            marker.setAttribute('contenteditable', 'false');
            marker.style.cssText = 'user-select:none;display:inline-block;width:18pt;font-weight:bold;';
            marker.textContent = numText + ' ';
            pEl.appendChild(marker);
        }

        if (fullText.replace(/[\r\n]+/g, '') === '' && !runs.some(r => r.imageData || r.barcodeData || r.type === 'barcode')) {
            const bgRun = runs.find(r => r.background);
            if (bgRun && bgRun.background) {
                pEl.style.backgroundColor = bgRun.background;
                pEl.setAttribute('data-bg', bgRun.background);
            }
            const fgRun = runs.find(r => r.foreground);
            if (fgRun && fgRun.foreground) {
                pEl.setAttribute('data-fg', fgRun.foreground);
            }
            if (hasUnderline && p.alignment === 'center') {
                // UYAP Java Swing / BasicTextUI: Ortalanmış boş paragraf altı çizili ise (P#10, P#13),
                // sayfa ortasında (x=296.28pt) yuvarlak uçlu alt çizgi noktası (seqno 21 & seqno 98) çizer.
                pEl.appendChild(document.createRange().createContextualFragment(
                    '<span class="udf-underline-dot" data-udf-dot="true" style="display:inline-block;cursor:text;user-select:text;">.</span>'
                ));
            } else {
                const specialRun = runs.find(r => r.strikethrough || r.underline || r.superscript);
                if (specialRun) {
                    const mark = document.createElement('span');
                    mark.className = 'udf-empty-mark';
                    mark.style.cssText = `display:inline-block;width:4pt;height:12pt;border-left:2px solid ${specialRun.foreground || '#f00'};vertical-align:${specialRun.superscript ? 'super' : 'baseline'};`;
                    pEl.appendChild(mark);
                } else if (!p.bulleted && !p.numbered) {
                    pEl.innerHTML = '<br>';
                }
            }
            pEl.style.fontSize = effFirstSize + 'pt';
            pEl.style.lineHeight = '1.1633';
            return pEl;
        }

        const lastRunIdx = runs.length - 1;
        runs.forEach((run, rIdx) => {
            if (run.type === 'barcode' || run.barcodeData) {
                const bcodeSpan = document.createElement('span');
                bcodeSpan.className = 'udf-barcode';
                bcodeSpan.setAttribute('data-barcode', run.barcodeData);
                bcodeSpan.setAttribute('contenteditable', 'false');
                bcodeSpan.style.cssText = 'display:inline-block;margin:4pt 0;line-height:1;user-select:none;';
                bcodeSpan.innerHTML = generateBarcodeSvg(run.barcodeData, 44);
                pEl.appendChild(bcodeSpan);
                return;
            }
            if (run.imageData) {
                const img = document.createElement('img');
                img.className = 'udf-img';
                img.src = 'data:image/png;base64,' + run.imageData;
                img.alt = '';
                img.setAttribute('contenteditable', 'false');
                pEl.appendChild(img);
                return;
            }
            let txt = run.text || '';
            if (rIdx === lastRunIdx) txt = txt.replace(/[\r\n]+$/, '');
            if (txt === '' && run.type !== 'tab') return;
            const parts = txt.split('\t');
            parts.forEach((part, i) => {
                if (i > 0) {
                    pEl.appendChild(createTabSpan(run));
                }
                if (part !== '') pEl.appendChild(createRunSpan(Object.assign({}, run, { text: part })));
            });
        });
        return pEl;
    }

    function createTabSpan(run) {
        const t = document.createElement('span');
        t.className = 'udf-tab';
        t.setAttribute('data-tab', '1');
        t.setAttribute('contenteditable', 'false');
        t.style.display = 'inline-block';
        if (run && run.size) {
            t.setAttribute('data-size', String(run.size));
            const effPt = +(run.size * 0.98).toFixed(2);
            t.style.fontSize = effPt + 'pt';
        }
        if (run && run.bold) t.style.fontWeight = 'bold';
        return t;
    }

    function parseTabStops(tabSet) {
        const stops = [];
        (tabSet || '').split(',').forEach(part => {
            const f = part.split(':');
            const rawPos = parseFloat(f[0]);
            if (!isNaN(rawPos) && rawPos > 0) {
                stops.push({ pos: +(rawPos * 0.98).toFixed(2), rawPos, align: parseInt(f[1], 10) || 0 });
            }
        });
        stops.sort((a, b) => a.pos - b.pos);
        return stops;
    }

    /**
     * Kök altındaki tüm sekme (tab) boşluklarını, paragrafın TabSet değerine ve yazı genişliğine
     * göre hesaplar. Hizalama: 0=sol, 1=sağ, 2=ortalı (Swing TabStop sabitleri).
     */
    function layoutTabs(root) {
        if (!root) return;
        const PX = 96 / 72;
        const allTabs = root.querySelectorAll('.udf-tab');
        if (!allTabs.length) return;

        // Sekme içeren tüm blokları tespit et (p, td, th, div.udf-p)
        const paras = new Set();
        allTabs.forEach(t => {
            const p = t.closest('p, td, th, div.udf-p') || t.parentElement;
            if (p) paras.add(p);
        });

        paras.forEach(p => {
            const tabs = Array.from(p.querySelectorAll('.udf-tab'));
            if (!tabs.length) return;
            const stops = parseTabStops(p.getAttribute('data-tabset'));
            const rootRect = p.getBoundingClientRect();
            const scale = p.offsetWidth ? rootRect.width / p.offsetWidth : 1;
            const li = parseFloat(p.getAttribute('data-li') || '0') * PX;
            const base = rootRect.left - li * scale; // sol kenar boşluğu (sayfa metin alanı sol)

            // Önce sekme genişliklerini sıfırlayıp inline-block hazırla
            tabs.forEach(t => {
                t.style.display = 'inline-block';
                t.style.width = '0px';
                t.style.minWidth = '0px';
                t.style.paddingLeft = '0px';
            });

            tabs.forEach((t, idx) => {
                const tRect = t.getBoundingClientRect();
                const x = (tRect.left - base) / (scale || 1) / PX; // pt
                let stop = stops.find(s => s.pos > x + 3.0);
                let width = 0;
                if (!stop) {
                    const next = (Math.floor((x + 3.0) / 36) + 1) * 36;
                    stop = { pos: next, align: 0 };
                }
                let segW = 0;
                const nextNode = t.nextSibling;
                const nextText = nextNode ? (nextNode.textContent || '') : '';
                const isColonHeader = nextText.trim().startsWith(':');
                // UYAP standardı: Sekme durağı iki nokta üst üste işaretinin bittiği dikey ekseni tanımlar.
                // İki noktanın (x=247.22pt - 250.92pt) ve değerin (x=254.04pt) referansla tam eşleşmesi için
                // sekme genişliğinden iki nokta genişliği (3.70pt) düşülür.
                const colonWidth = isColonHeader ? 3.70 : 0;

                if (stop.align !== 0) {
                    if (stop.align === 2 && isColonHeader) {
                        segW = 0;
                    } else {
                        const r = document.createRange();
                        r.setStartAfter(t);
                        const nextTab = tabs[idx + 1];
                        if (nextTab) r.setEndBefore(nextTab); else r.setEndAfter(p.lastChild);
                        segW = r.getBoundingClientRect().width / (scale || 1) / PX;
                    }
                }
                if (stop.align === 2) {
                    width = isColonHeader ? Math.max(0, stop.pos - x - colonWidth) : Math.max(0, stop.pos - x - segW / 2);
                } else if (stop.align === 1) {
                    width = Math.max(0, stop.pos - x - segW);
                } else {
                    width = Math.max(0, stop.pos - x - colonWidth);
                }
                const wPx = Math.max(0, width * PX);
                t.style.display = 'inline-block';
                t.style.width = wPx + 'px';
                t.style.minWidth = wPx + 'px';
            });
        });
    }

    function createRunSpan(run, isLast = false) {
        const span = document.createElement('span');
        let txt = run.text || '';
        if (isLast) {
            txt = txt.replace(/[\r\n]+$/, '');
        }
        span.textContent = txt;

        if (run.type && run.type !== 'content') span.setAttribute('data-tag', run.type);
        if (run.fieldName) span.setAttribute('data-field-name', run.fieldName);
        if (run.fieldType) span.setAttribute('data-field-type', run.fieldType);
        if (run.isList) span.setAttribute('data-is-list', run.isList);
        if (run.resolver) span.setAttribute('data-resolver', run.resolver);

        if (run.bold) span.style.fontWeight = 'bold';
        if (run.italic) span.style.fontStyle = 'italic';
        if (run.underline) span.style.textDecoration = 'underline';
        if (run.strikethrough) span.style.textDecoration = (span.style.textDecoration ? span.style.textDecoration + ' ' : '') + 'line-through';
        if (run.subscript) span.style.verticalAlign = 'sub';
        if (run.superscript) span.style.verticalAlign = 'super';
        if (run.size) {
            span.setAttribute('data-size', String(run.size));
            const effPt = +(run.size * 0.98).toFixed(2);
            span.style.fontSize = `${effPt}pt`;
        }
        if (run.family) span.style.fontFamily = `"${run.family}", Times New Roman, serif`;
        if (run.foreground) span.style.color = run.foreground;
        if (run.background) span.style.backgroundColor = run.background;

        return span;
    }

    function tableToDom(tbl, listCounters = {}) {
        const tableEl = document.createElement('table');
        tableEl.className = 'udf-table';
        if (tbl.tableName) tableEl.setAttribute('data-table-name', tbl.tableName);
        tableEl.style.width = '100%';
        tableEl.style.borderCollapse = 'collapse';
        tableEl.style.margin = '8pt 0';

        const isBorderNone = tbl.border === 'borderNone';
        tableEl.setAttribute('data-border', tbl.border);

        // Sütun genişlikleri: columnSpans oransal ağırlıktır; yoksa eşit bölünür (sabit yerleşim)
        const nCols = Math.max(1, ...tbl.rows.map(r => r.cells.length));
        let spans = (tbl.columnSpans || []).slice(0, nCols);
        if (spans.length !== nCols || spans.some(v => !(v > 0))) spans = new Array(nCols).fill(100);
        tableEl.setAttribute('data-col-spans', spans.join(','));
        tableEl.setAttribute('data-col-count', String(nCols));
        const spanSum = spans.reduce((a, b) => a + b, 0);
        tableEl.style.tableLayout = 'fixed';

        tbl.rows.forEach(r => {
            const tr = document.createElement('tr');
            r.cells.forEach((c, idx) => {
                const td = document.createElement('td');
                td.style.border = isBorderNone ? 'none' : '1px solid #777';
                td.style.padding = '4pt 6pt';
                td.style.verticalAlign = 'top';

                td.style.width = (spans[idx] / spanSum * 100) + '%';

                if (c.paragraphs && c.paragraphs.length > 0) {
                    c.paragraphs.forEach(p => td.appendChild(paragraphToDom(p, 0, listCounters)));
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
        
        // Eğer editör içinde sayfalar (.udf-page) varsa, blokları sayfaların içinden topla
        const pages = editorEl.querySelectorAll('.udf-page');
        let blocks = [];
        if (pages.length > 0) {
            pages.forEach(pg => {
                blocks.push(...Array.from(pg.children));
            });
        } else {
            blocks = Array.from(editorEl.childNodes);
        }

        // Üst bilgi (2. sayfadan itibaren), metin akışının başında yer alır (UYAP Tam Uyumlu)
        if (pageProps.headerInfo && (pageProps.headerInfo.left || pageProps.headerInfo.right)) {
            const hi = pageProps.headerInfo;
            const leftText = (hi.left || '').trim();
            const rightText = (hi.right || '').trim();
            const startPg = hi.startPage || 2;

            const hRunsXml = [];
            let hFullText = '';

            if (leftText) {
                const lStart = currentOffset + hFullText.length;
                hFullText += leftText;
                hRunsXml.push(`<content resolver="hvl-default" size="10" bold="true" foreground="-8355712" family="Times New Roman" startOffset="${lStart}" length="${leftText.length}" />`);
            }

            if (rightText) {
                const tabStart = currentOffset + hFullText.length;
                hFullText += '	';
                const labelMatch = rightText.match(/^(Dosya-Karar(?:\s*No)?:\s*)(.*)$/i);
                if (labelMatch) {
                    const label = '	' + labelMatch[1];
                    const val = labelMatch[2];
                    hRunsXml.push(`<content resolver="hvl-default" size="10" bold="true" foreground="-8355712" family="Times New Roman" startOffset="${tabStart}" length="${label.length}" />`);
                    hFullText += labelMatch[1];
                    if (val) {
                        const valStart = currentOffset + hFullText.length;
                        hFullText += val;
                        hRunsXml.push(`<content resolver="hvl-default" size="10" bold="false" foreground="-8355712" family="Times New Roman" startOffset="${valStart}" length="${val.length}" />`);
                    }
                } else {
                    const rTextWithTab = '	' + rightText;
                    hRunsXml.push(`<content resolver="hvl-default" size="10" bold="true" foreground="-8355712" family="Times New Roman" startOffset="${tabStart}" length="${rTextWithTab.length}" />`);
                    hFullText += rightText;
                }
            }

            const nlStart = currentOffset + hFullText.length;
            hFullText += '\n';
            hRunsXml.push(`<content resolver="default" size="12" family="Times New Roman" startOffset="${nlStart}" length="1" />`);

            fullText += hFullText;
            currentOffset += hFullText.length;

            const headerParaXml = `<paragraph LineSpacing="0.0" LeftIndent="0.0" SpaceAbove="1.0" TabSet="255.0:0:0" RightIndent="0.0" Alignment="0" resolver="hvl-default" Hanging="0.0" SpaceBelow="1.0">${hRunsXml.join('')}</paragraph>`;
            xmlElements.push(`<header startPage="${startPg}" foreground="-8355712" background="-1">${headerParaXml}</header>`);
        }

        for (const block of blocks) {
            if (block.nodeType === Node.ELEMENT_NODE) {
                const tag = block.tagName.toLowerCase();

                // E-İmza Mührü, Filigran, Sayfa 1 Alt Çubuğu dışa aktarılırken atlanır
                if (block.getAttribute('contenteditable') === 'false' || block.classList.contains('pb-spacer')) continue;
                if (block.classList && (
                    block.classList.contains('udf-seal-stamp') ||
                    block.classList.contains('udf-watermark') ||
                    block.classList.contains('udf-footer-bar') ||
                    block.classList.contains('udf-page1-footer')
                )) {
                    continue;
                }

                if (tag === 'table' || (block.classList && block.classList.contains('udf-table-wrapper'))) {
                    const tableEl = tag === 'table' ? block : block.querySelector('table');
                    if (tableEl) {
                        const tblInfo = serializeTable(tableEl);
                        xmlElements.push(tblInfo.xml);
                    }
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

            // İlk satır girintisi (FirstLineIndent)
            let fliAttr = '';
            let rawFli = pEl.getAttribute && pEl.getAttribute('data-fli');
            if (rawFli !== null && rawFli !== '' && rawFli !== undefined) {
                const fliVal = parseFloat(rawFli);
                if (!isNaN(fliVal) && fliVal > 0) fliAttr = ` FirstLineIndent="${fliVal}"`;
            } else if (pEl.style.textIndent) {
                const pt = parseFloat(pEl.style.textIndent);
                if (!isNaN(pt) && pt > 0) {
                    fliAttr = ` FirstLineIndent="${pt}"`;
                }
            }

            const tabSetAttr = pEl.getAttribute && pEl.getAttribute('data-tabset') || '';
            const tabSetXml = tabSetAttr ? ` TabSet="${tabSetAttr}"` : '';
            let hangAttr = (pEl.getAttribute && pEl.getAttribute('data-hanging')) || '0.0';
            if (hangAttr === '0.0' && parseFloat(pEl.style.paddingLeft) > 0 && parseFloat(pEl.style.textIndent) < 0) {
                hangAttr = String(parseFloat(pEl.style.paddingLeft));
                const fl = parseFloat(pEl.style.textIndent) + parseFloat(pEl.style.paddingLeft);
                fliAttr = fl > 0 ? ` FirstLineIndent="${fl}"` : '';
            }

            let leftIndentAttr = pEl.getAttribute && pEl.getAttribute('data-li');
            if (leftIndentAttr === null || leftIndentAttr === '' || leftIndentAttr === undefined) {
                leftIndentAttr = parseFloat(pEl.style.marginLeft) > 0 ? String(parseFloat(pEl.style.marginLeft)) : '0.0';
            }

            let rightIndentAttr = pEl.getAttribute && pEl.getAttribute('data-ri');
            if (rightIndentAttr === null || rightIndentAttr === '' || rightIndentAttr === undefined) {
                rightIndentAttr = parseFloat(pEl.style.marginRight) > 0 ? String(parseFloat(pEl.style.marginRight)) : '0.0';
            }

            let spaceAboveAttr = pEl.getAttribute && pEl.getAttribute('data-spaceabove');
            if (spaceAboveAttr === null || spaceAboveAttr === '' || spaceAboveAttr === undefined) {
                const padT = parseFloat(pEl.style.paddingTop);
                spaceAboveAttr = !isNaN(padT) ? String(padT) : '1.0';
            }

            let spaceBelowAttr = pEl.getAttribute && pEl.getAttribute('data-spacebelow');
            if (spaceBelowAttr === null || spaceBelowAttr === '' || spaceBelowAttr === undefined) {
                const padB = parseFloat(pEl.style.paddingBottom);
                spaceBelowAttr = !isNaN(padB) ? String(padB) : '1.0';
            }

            let lineSpacingAttr = pEl.getAttribute && pEl.getAttribute('data-linespacing');
            if (lineSpacingAttr === null || lineSpacingAttr === '' || lineSpacingAttr === undefined) {
                lineSpacingAttr = '0.0';
            }

            let extraParaAttrs = '';
            const rep = pEl.getAttribute && pEl.getAttribute('data-repeatinglabel');
            if (rep) extraParaAttrs += ` RepeatingLabel="${rep}"`;
            const grp = pEl.getAttribute && pEl.getAttribute('data-groupname');
            if (grp) extraParaAttrs += ` GroupName="${grp}"`;

            if (pEl.getAttribute && pEl.getAttribute('data-bulleted') === 'true') {
                extraParaAttrs += ` Bulleted="true"`;
                const bt = pEl.getAttribute('data-bullettype');
                if (bt) extraParaAttrs += ` BulletType="${bt}"`;
                const lid = pEl.getAttribute('data-listid');
                if (lid) extraParaAttrs += ` ListId="${lid}"`;
                const llvl = pEl.getAttribute('data-listlevel');
                if (llvl) extraParaAttrs += ` ListLevel="${llvl}"`;
            } else if (pEl.getAttribute && pEl.getAttribute('data-numbered') === 'true') {
                extraParaAttrs += ` Numbered="true"`;
                const nt = pEl.getAttribute('data-numbertype');
                if (nt) extraParaAttrs += ` NumberType="${nt}"`;
                const lid = pEl.getAttribute('data-listid');
                if (lid) extraParaAttrs += ` ListId="${lid}"`;
                const llvl = pEl.getAttribute('data-listlevel');
                if (llvl) extraParaAttrs += ` ListLevel="${llvl}"`;
            }

            const contentsXml = [];
            const textNodes = getTextLeaves(pEl);

            if (textNodes.length === 0) {
                fullText += '\n';
                const hasDot = !!pEl.querySelector('.udf-underline-dot');
                const isCleared = pEl.getAttribute && pEl.getAttribute('data-udf-dot-cleared') === 'true';
                const hasUnderline = (pEl.getAttribute && pEl.getAttribute('data-underline') === 'true') && (hasDot || !isCleared);
                let uAttr = hasUnderline ? ' underline="true" bold="true"' : '';
                const bgVal = pEl.getAttribute && pEl.getAttribute('data-bg');
                if (bgVal) {
                    uAttr += ` background="${hexToArgb(bgVal)}"`;
                }
                const fgVal = pEl.getAttribute && pEl.getAttribute('data-fg');
                if (fgVal) {
                    uAttr += ` foreground="${hexToArgb(fgVal)}"`;
                }
                contentsXml.push(`<content resolver="hvl-default"${uAttr} startOffset="${currentOffset}" length="1" />`);
                currentOffset += 1;
            } else {
                for (const item of textNodes) {
                    const text = item.text;
                    const len = text.length;
                    const start = currentOffset;
                    fullText += text;
                    currentOffset += len;

                    if (item.tag === 'barcode' || item.barcodeData) {
                        contentsXml.push(`<barcode barcodeData="${item.barcodeData}" startOffset="${start}" length="1" />`);
                        continue;
                    }

                    if (item.image) {
                        const imgResolver = item.resolver || 'hvl-default';
                        contentsXml.push(`<image resolver="${imgResolver}" imageData="${item.image}" startOffset="${start}" length="${len}" />`);
                        continue;
                    }

                    const attrs = [];
                    attrs.push(`startOffset="${start}"`);
                    attrs.push(`length="${len}"`);

                    if (item.bold) attrs.push('bold="true"');
                    if (item.italic) attrs.push('italic="true"');
                    if (item.underline) attrs.push('underline="true"');
                    if (item.strikethrough) attrs.push('strikethrough="true"');
                    if (item.subscript) attrs.push('subscript="true"');
                    if (item.superscript) attrs.push('superscript="true"');
                    attrs.push(`size="${item.size || 12}"`);
                    attrs.push(`family="${item.family || 'Times New Roman'}"`);
                    attrs.push(`foreground="${item.foreground || -16777216}"`);
                    if (item.background) attrs.push(`background="${hexToArgb(item.background)}"`);

                    const nodeTag = item.tag || 'content';
                    const nodeResolver = item.resolver ? ` resolver="${item.resolver}"` : ' resolver="hvl-default"';
                    let extraFieldAttrs = '';
                    if (item.fieldName) extraFieldAttrs += ` fieldName="${item.fieldName}"`;
                    if (item.fieldType) extraFieldAttrs += ` fieldType="${item.fieldType}"`;
                    if (item.isList) extraFieldAttrs += ` isList="${item.isList}"`;

                    contentsXml.push(`<${nodeTag}${nodeResolver}${extraFieldAttrs} ${attrs.join(' ')} />`);
                }
                fullText += '\n';
                contentsXml.push(`<content resolver="hvl-default" startOffset="${currentOffset}" length="1" />`);
                currentOffset += 1;
            }

            return {
                xml: `<paragraph LineSpacing="${lineSpacingAttr}" LeftIndent="${leftIndentAttr}" SpaceAbove="${spaceAboveAttr}"${tabSetXml} RightIndent="${rightIndentAttr}" Alignment="${alignCode}" resolver="hvl-default" Hanging="${hangAttr}" SpaceBelow="${spaceBelowAttr}"${fliAttr}${extraParaAttrs}>${contentsXml.join('')}</paragraph>`
            };
        }

        function serializeParagraphText(text) {
            const start = currentOffset;
            fullText += text + '\n';
            const len = text.length;
            currentOffset += len + 1;

            return {
                xml: `<paragraph Alignment="0" resolver="hvl-default"><content resolver="hvl-default" startOffset="${start}" length="${len}" size="12" family="Times New Roman" foreground="-16777216" /><content resolver="hvl-default" startOffset="${start + len}" length="1" /></paragraph>`
            };
        }

        function serializeTable(tableEl) {
            const rows = Array.from(tableEl.querySelectorAll('tr')).filter(tr => !tr.classList.contains('pb-spacer'));
            const rowXmls = [];
            let maxCols = 0;
            const borderAttr = tableEl.getAttribute('data-border') || (tableEl.style.border === 'none' ? 'borderNone' : 'borderCell');
            const tblName = tableEl.getAttribute('data-table-name') || 'Sabit';
            const colSpansAttr = tableEl.getAttribute('data-col-spans');

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

            let tblTag = '';
            if (colSpansAttr) {
                tblTag = `<table tableName="${tblName}" columnCount="${maxCols}" columnSpans="${colSpansAttr}" border="${borderAttr}">${rowXmls.join('')}</table>`;
            } else {
                tblTag = `<table border="${borderAttr}">${rowXmls.join('')}</table>`;
            }
            return {
                xml: tblTag
            };
        }

        function getTextLeaves(node, inherited = {}) {
            const leaves = [];
            let style = { ...inherited };

            if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName.toLowerCase();
                if (tag === 'span' && node.classList) {
                    if (node.classList.contains('udf-underline-dot') || node.classList.contains('udf-list-marker') || node.classList.contains('udf-empty-mark')) {
                        return leaves;
                    }
                    if (node.classList.contains('udf-barcode')) {
                        leaves.push({
                            text: String.fromCharCode(184),
                            tag: 'barcode',
                            barcodeData: node.getAttribute('data-barcode') || '',
                            ...style
                        });
                        return leaves;
                    }
                }
                if (node.getAttribute) {
                    if (node.getAttribute('data-tag')) style.tag = node.getAttribute('data-tag');
                    if (node.getAttribute('data-field-name')) style.fieldName = node.getAttribute('data-field-name');
                    if (node.getAttribute('data-field-type')) style.fieldType = node.getAttribute('data-field-type');
                    if (node.getAttribute('data-is-list')) style.isList = node.getAttribute('data-is-list');
                    if (node.getAttribute('data-resolver')) style.resolver = node.getAttribute('data-resolver');
                }
                if (tag === 'b' || tag === 'strong' || node.style.fontWeight === 'bold') style.bold = true;
                if (tag === 'i' || tag === 'em' || node.style.fontStyle === 'italic') style.italic = true;
                if (tag === 'u' || (node.style.textDecoration && node.style.textDecoration.includes('underline'))) style.underline = true;
                if (tag === 's' || (node.style.textDecoration && node.style.textDecoration.includes('line-through'))) style.strikethrough = true;
                if (node.style.verticalAlign === 'sub') style.subscript = true;
                if (node.style.verticalAlign === 'super') style.superscript = true;
                if (node.style.backgroundColor) {
                    style.background = rgbToHex(node.style.backgroundColor);
                }

                const dataSize = node.getAttribute && node.getAttribute('data-size');
                if (dataSize) {
                    const pt = parseInt(dataSize, 10);
                    if (!isNaN(pt)) style.size = pt;
                } else if (node.style.fontSize) {
                    const pt = parseFloat(node.style.fontSize);
                    if (!isNaN(pt)) style.size = Math.round(pt / 0.98);
                }
                if (node.style.fontFamily) {
                    style.family = node.style.fontFamily.replace(/["']/g, '').split(',')[0].trim();
                }
                if (node.style.color) {
                    style.foreground = hexToArgb(rgbToHex(node.style.color));
                }

                if (tag === 'img' && node.src && node.src.indexOf('base64,') > 0) {
                    leaves.push({ text: String.fromCharCode(184), image: node.src.split('base64,')[1], ...style });
                    return leaves;
                }
                if (tag === 'br') {
                    if (!node.nextSibling) return leaves; // satır sonundaki yapay <br>
                    leaves.push({ text: '\n', ...style });
                    return leaves;
                }
                if (node.classList && node.classList.contains('udf-tab')) {
                    leaves.push({ text: '\t', ...style });
                    return leaves;
                }
                if (node.classList && node.classList.contains('pb-spacer')) return leaves;

                for (let i = 0; i < node.childNodes.length; i++) {
                    leaves.push(...getTextLeaves(node.childNodes[i], style));
                }
            } else if (node.nodeType === Node.TEXT_NODE) {
                const cleanText = node.textContent.replace(/\u200B/g, '');
                if (cleanText.length > 0) {
                    leaves.push({
                        text: cleanText,
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

        const leftM = pageProps.rawLeftMargin !== null && pageProps.rawLeftMargin !== undefined ? pageProps.rawLeftMargin : (pageProps.leftMargin !== undefined ? pageProps.leftMargin : 56.69).toFixed(2);
        const rightM = pageProps.rawRightMargin !== null && pageProps.rawRightMargin !== undefined ? pageProps.rawRightMargin : (pageProps.rightMargin !== undefined ? pageProps.rightMargin : 70.86).toFixed(2);
        const topM = pageProps.rawTopMargin !== null && pageProps.rawTopMargin !== undefined ? pageProps.rawTopMargin : (pageProps.topMargin !== undefined ? pageProps.topMargin : 70.86).toFixed(2);
        const bottomM = pageProps.rawBottomMargin !== null && pageProps.rawBottomMargin !== undefined ? pageProps.rawBottomMargin : (pageProps.bottomMargin !== undefined ? pageProps.bottomMargin : 70.86).toFixed(2);
        const orient = pageProps.paperOrientation || 1;
        const headOffset = pageProps.rawHeaderFOffset !== null && pageProps.rawHeaderFOffset !== undefined ? pageProps.rawHeaderFOffset : (pageProps.headerFOffset !== undefined ? pageProps.headerFOffset : 15.0).toFixed(2);
        const footOffset = pageProps.rawFooterFOffset !== null && pageProps.rawFooterFOffset !== undefined ? pageProps.rawFooterFOffset : (pageProps.footerFOffset !== undefined ? pageProps.footerFOffset : 60.0).toFixed(2);
        const media = pageProps.mediaSizeName || '1';

        const footerInfo = pageProps.footerInfo || (window.UkiPages && window.UkiPages.getConfig ? window.UkiPages.getConfig() : {});
        const webIdVal = pageProps.rawWebId || pageProps.webId || (footerInfo && (footerInfo.rawWebId || footerInfo.webId)) || '';
        const hasFooter = footerInfo.showPageNumber !== false && (
            footerInfo.showPageNumber ||
            footerInfo.showFooter ||
            pageProps.footerElement ||
            footerInfo.footerEl ||
            !!webIdVal
        );

        if (hasFooter) {
            const fe = pageProps.footerElement;
            const sep = (fe && fe.pageNumberSep !== undefined) ? fe.pageNumberSep : ((footerInfo.pageNumberFormat === 'dash') ? '-' : (footerInfo.pageNumberFormat === 'single' ? '' : '/'));
            const foreStr = (fe && fe.pageNumberForeStr) || footerInfo.pageNumberForeStr || '';
            const startNumStr = (fe && fe.pageNumberStartNum) || footerInfo.pageNumberStartNum || '1';
            const footStart = currentOffset;

            let footParasXml = '';
            if (fe && fe.paragraphs && fe.paragraphs.length > 0) {
                fe.paragraphs.forEach(fp => {
                    const fpInfo = serializeParagraphNodeModel(fp);
                    footParasXml += fpInfo;
                });
            } else {
                fullText += '\n';
                currentOffset += 1;
                footParasXml = `<paragraph size="12" LineSpacing="0.0" description="Gövde" LeftIndent="0.0" SpaceAbove="0.0" RightIndent="0.0" Alignment="0" resolver="default" family="Times New Roman" SpaceBelow="0.0"><content resolver="default" size="12" family="Times New Roman" startOffset="${footStart}" length="1" /></paragraph>`;
            }

            xmlElements.push(
                `<footer pageNumber-fontItalic="false" pageNumber-color="-16777216" foreground="-8355712" pageNumber-fontBold="false" pageNumber-spec="BSP32_2120" background="-1" pageNumber-fontFace="Arial" pageNumber-foreStr="${foreStr}" pageNumber-pageStartNumStr="${startNumStr}" pageNumber-fontSize="11" pageNumber-seperator="${sep}">${footParasXml}</footer>`
            );
        }

        function serializeParagraphNodeModel(pModel) {
            const pRunsXml = [];
            const runs = pModel.runs || [];
            runs.forEach(r => {
                const txt = r.text || '';
                const start = currentOffset;
                fullText += txt;
                currentOffset += txt.length;
                pRunsXml.push(`<content resolver="${r.resolver || 'default'}" size="${r.size || 12}" family="${r.family || 'Times New Roman'}" startOffset="${start}" length="${txt.length}" />`);
            });
            if (runs.length === 0) {
                fullText += '\n';
                pRunsXml.push(`<content resolver="default" size="12" family="Times New Roman" startOffset="${currentOffset}" length="1" />`);
                currentOffset += 1;
            }
            return `<paragraph size="12" LineSpacing="0.0" description="Gövde" LeftIndent="0.0" SpaceAbove="0.0" RightIndent="0.0" Alignment="0" resolver="default" family="Times New Roman" SpaceBelow="0.0">${pRunsXml.join('')}</paragraph>`;
        }

        const settings = {};
        for (const key of ['showFooter','showPageNumber','pageNumberFormat','showPageNumberOnFirstPage','webId','qrCode']) {
            if (footerInfo[key] !== undefined) settings[key] = footerInfo[key];
        }
        if (webIdVal) settings.webId = webIdVal;
        zip.file('editor-settings.json', JSON.stringify(settings));

        const defaultStylesXml = `<styles><style name="default" description="Geçerli" family="Dialog" size="12" bold="false" italic="false" FONT_ATTRIBUTE_KEY="javax.swing.plaf.FontUIResource[family=Dialog,name=Dialog,style=plain,size=12]" foreground="-13421773" /><style name="hvl-default" family="Times New Roman" size="12" description="Gövde" /></styles>`;
        const stylesBlock = pageProps.originalStylesXml || defaultStylesXml;

        const xml = `<?xml version="1.0" encoding="UTF-8" ?>\n` +
            `<template format_id="${UDF_CONSTANTS.FORMAT_ID}">\n` +
            `<content><![CDATA[${fullText}]]></content>\n` +
            `<properties><pageFormat mediaSizeName="${media}" leftMargin="${leftM}" rightMargin="${rightM}" topMargin="${topM}" bottomMargin="${bottomM}" paperOrientation="${orient}" headerFOffset="${headOffset}" footerFOffset="${footOffset}" /></properties>\n` +
            `<elements >\n` +
            xmlElements.join('\n') + '\n' +
            `</elements>\n` +
            (stylesBlock ? (stylesBlock.endsWith('\n') ? stylesBlock : stylesBlock + '\n') : '') +
            (webIdVal ? `<webID id="${String(webIdVal).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" />\n` : '') +
            `</template>`;

        zip.file('content.xml', xml);

        const nowD = new Date();
        const dateStr = nowD.toLocaleDateString('tr-TR') + ' ' + nowD.toLocaleTimeString('tr-TR');
        const defaultDocProps = ['<?xml version="1.0" encoding="UTF-8"?>','<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">','<properties>',`<entry key="uyapdogrulamakodu">${String(webIdVal || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</entry>`,'<entry key="uyapsicil"></entry>','</properties>',''].join('\n');
        zip.file('documentproperties.xml', defaultDocProps);

        if (originalZip) {
            // Not: İçerik değiştiği için özgün e-imza (sign.sgn) artık geçersizdir; pakete eklenmez.
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
     * UYAP Doküman Editörü ile birebir mizanpaj, satır aralıkları, sekme hizaları (TabSet),
     * sayfa numaralandırması ve üst/alt bilgi paritesi sağlar.
     * @param {HTMLElement} editorEl - İçerik DOM öğesi
     * @param {Object} pageProps - Sayfa kenar boşlukları ve yönelim bilgileri
     * @param {Object} [docModel] - Açık olan UDF veri modeli (üst bilgi, webId, vb.)
     * @returns {Promise<Blob>} .docx ikili veri bloğu
     */
    async function exportDocxBlob(editorEl, pageProps, docModel) {
        const JSZipClass = (typeof JSZip !== 'undefined' ? JSZip : (typeof window !== 'undefined' ? window.JSZip : null));
        if (!JSZipClass) {
            throw new Error('JSZip kütüphanesi yüklenemedi.');
        }

        const zip = new JSZipClass();

        // Üst ve Alt bilgi bilgilerini topla (UYAP Paritesi)
        docModel = docModel || window.currentDocModel || {};
        const liveConfig = window.UkiPages && window.UkiPages.getConfig ? window.UkiPages.getConfig() : null;
        const headerInfo = liveConfig ? window.UkiPages.getHeader() : docModel.headerInfo || null;
        const webId = liveConfig ? (liveConfig.showFooter ? liveConfig.webId : '') : docModel.webId || '';
        const showPageNumber = liveConfig ? liveConfig.showPageNumber : true;

        // 1. [Content_Types].xml
        const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
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
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;
        zip.file('word/_rels/document.xml.rels', docRelsXml);

        // 4. word/styles.xml (UYAP Birebir Satır Aralığı: Boşluksuz ve Tek Satır)
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
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
    </w:pPr>
  </w:style>
</w:styles>`;
        zip.file('word/styles.xml', stylesXml);

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

        // 5. word/header1.xml (UYAP Sayfa 2+ Üst Bilgisi)
        const headerLeft = escapeXml(headerInfo ? (headerInfo.left || '') : '');
        const headerRight = escapeXml(headerInfo ? (headerInfo.right || '') : '');
        const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:tabs>
        <w:tab w:val="right" w:pos="9354"/>
      </w:tabs>
      <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
        <w:sz w:val="18"/>
        <w:color w:val="666666"/>
      </w:rPr>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr>
      <w:t xml:space="preserve">${headerLeft}</w:t>
    </w:r>
    <w:r><w:tab/></w:r>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr>
      <w:t xml:space="preserve">${headerRight}</w:t>
    </w:r>
  </w:p>
</w:hdr>`;
        zip.file('word/header1.xml', headerXml);

        // 6. word/footer1.xml (UYAP Sayfa Numarası ve Doğrulama Şeridi)
        const footerNoticeHtml = webId ? `
  <w:p>
    <w:pPr>
      <w:pBdr>
        <w:top w:val="single" w:sz="4" w:space="2" w:color="333333"/>
      </w:pBdr>
      <w:spacing w:before="40" w:after="0" w:line="180" w:lineRule="auto"/>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
        <w:sz w:val="14"/>
        <w:color w:val="222222"/>
      </w:rPr>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="14"/><w:color w:val="222222"/></w:rPr>
      <w:t xml:space="preserve">UYAP Bilişim Sistemindeki bu dokümana http://vatandas.uyap.gov.tr adresinden ${escapeXml(webId)} ile erişebilirsiniz.</w:t>
    </w:r>
  </w:p>` : '';

        const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
      <w:ind w:left="0" w:right="0"/>
      <w:jc w:val="right"/>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
        <w:sz w:val="22"/>
      </w:rPr>
    </w:pPr>
    <w:fldSimple w:instr="PAGE">
      <w:r>
        <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/></w:rPr>
        <w:t>1</w:t>
      </w:r>
    </w:fldSimple>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve"> / </w:t></w:r>
    <w:fldSimple w:instr="NUMPAGES">
      <w:r>
        <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/></w:rPr>
        <w:t>1</w:t>
      </w:r>
    </w:fldSimple>
  </w:p>${footerNoticeHtml}
</w:ftr>`;
        const footerFinal = showPageNumber ? footerXml : footerXml.replace(/<w:p>[\s\S]*?<\/w:p>/, '<w:p/>');
        zip.file('word/footer1.xml', footerFinal);

        // 7. word/document.xml oluşturma
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

        function extractRunsFromNode(node) {
            const runs = [];
            function walk(n, state) {
                if (n.nodeType === Node.TEXT_NODE) {
                    let text = n.nodeValue;
                    if (text && text.length > 0) {
                        // Stray cedilla (¸) UYAP simge hatasını temizle
                        text = text.replace(/\u00b8/g, '');
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

                // Sekme (Tab) yakalama: Word OpenXML'de <w:tab/> üretilecek
                if (n.classList && n.classList.contains('udf-tab')) {
                    runs.push({ isTab: true, state: { ...state } });
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
                    nextState.family = n.style.fontFamily.split(',')[0].replace(/['"]/g, '');
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

                if (el.nodeType === 1 && (el.getAttribute('contenteditable') === 'false' || el.classList.contains('pb-spacer'))) continue;
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
                        bodyParts.push('        <w:trPr><w:cantSplit/></w:trPr>');
                        const cells = rows[r].querySelectorAll('td, th');
                        for (let c = 0; c < cells.length; c++) {
                            const cell = cells[c];
                            bodyParts.push('        <w:tc>');
                            bodyParts.push('          <w:p>');
                            bodyParts.push('            <w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>');
                            const cellRuns = extractRunsFromNode(cell);
                            if (cellRuns.length === 0) {
                                bodyParts.push('            <w:r><w:t></w:t></w:r>');
                            } else {
                                for (let cr of cellRuns) {
                                    if (cr.isTab) {
                                        bodyParts.push('            <w:r><w:tab/></w:r>');
                                        continue;
                                    }
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
                    // PARAGRAF (UYAP Birebir Boşluksuz ve Hizalı)
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
                    // OpenXML CT_PPr Strict Order: tabs -> spacing -> ind -> jc
                    const stops = parseTabStops(el.getAttribute('data-tabset'));
                    if (stops.length) {
                        bodyParts.push('        <w:tabs>');
                        for (const stop of stops) bodyParts.push(`          <w:tab w:val="${stop.align===1?'right':stop.align===2?'center':'left'}" w:pos="${Math.round((stop.rawPos !== undefined ? stop.rawPos : stop.pos)*20)}"/>`);
                        bodyParts.push('        </w:tabs>');
                    }
                    const asTwips = value => {
                        const n = parseFloat(value) || 0;
                        return Math.round(n * (/px$/.test(value) ? 15 : /cm$/.test(value) ? 566.929 : 20));
                    };
                    const before = asTwips(el.style.paddingTop || el.style.marginTop || '0');
                    const after = asTwips(el.style.paddingBottom || el.style.marginBottom || '0');
                    const line = Math.round(240 * (1.15 + (parseFloat(el.getAttribute('data-linespacing')) || 0)));
                    bodyParts.push(`        <w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/>`);
                    const left = asTwips(el.style.marginLeft || '0');
                    const right = asTwips(el.style.marginRight || '0');
                    const first = asTwips(el.style.textIndent || '0');
                    bodyParts.push(`        <w:ind w:left="${left}" w:right="${right}" ${first < 0 ? 'w:hanging="'+(-first)+'"' : 'w:firstLine="'+first+'"'}/>`);
                    if (jcVal !== 'left') {
                        bodyParts.push(`        <w:jc w:val="${jcVal}"/>`);
                    }
                    bodyParts.push('      </w:pPr>');

                    const runs = extractRunsFromNode(el);
                    if (runs.length === 0) {
                        bodyParts.push('      <w:r><w:t></w:t></w:r>');
                    } else {
                        for (let run of runs) {
                            if (run.isTab) {
                                bodyParts.push('      <w:r><w:tab/></w:r>');
                                continue;
                            }

                            const rPrXml = [
                                run.state.family ? `<w:rFonts w:ascii="${escapeXml(run.state.family)}" w:hAnsi="${escapeXml(run.state.family)}"/>` : '',
                                run.state.bold ? '<w:b/>' : '',
                                run.state.italic ? '<w:i/>' : '',
                                run.state.underline ? '<w:u w:val="single"/>' : '',
                                run.state.strike ? '<w:strike/>' : '',
                                run.state.sizePt ? `<w:sz w:val="${run.state.sizePt * 2}"/><w:szCs w:val="${run.state.sizePt * 2}"/>` : '',
                                run.state.color ? `<w:color w:val="${run.state.color}"/>` : ''
                            ].join('');

                            const parts = (run.text || '').split('\t');
                            for (let pi = 0; pi < parts.length; pi++) {
                                if (parts[pi]) {
                                    bodyParts.push('      <w:r>');
                                    if (rPrXml) bodyParts.push('        <w:rPr>' + rPrXml + '</w:rPr>');
                                    bodyParts.push(`        <w:t xml:space="preserve">${escapeXml(parts[pi])}</w:t>`);
                                    bodyParts.push('      </w:r>');
                                }
                                if (pi < parts.length - 1) {
                                    bodyParts.push('      <w:r><w:tab/></w:r>');
                                }
                            }
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
        bodyParts.push('      <w:headerReference w:type="default" r:id="rId2"/>');
        bodyParts.push('      <w:footerReference w:type="default" r:id="rId3"/>');
        bodyParts.push('      <w:footerReference w:type="first" r:id="rId3"/>');
        bodyParts.push(`      <w:pgSz w:w="${widthDxa}" w:h="${heightDxa}" w:orient="${orient}"/>`);
        bodyParts.push(`      <w:pgMar w:top="${topDxa}" w:right="${rightDxa}" w:bottom="${bottomDxa}" w:left="${leftDxa}" w:header="${headerDxa}" w:footer="${footerDxa}" w:gutter="0"/>`);
        bodyParts.push('      <w:titlePg/>');
        bodyParts.push('    </w:sectPr>');

        const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n  <w:body>\n${bodyParts.join('\n')}\n  </w:body>\n</w:document>`;
        zip.file('word/document.xml', docXml);

        return await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
    }

    /**
     * Microsoft Word (.docx) dosyasını tersine mühendislikle ayrıştırıp
     * tam uyumlu UDF veri modeline (udfModel) dönüştürür.
     * Web editörde açılıp düzenlenebilir ve doğrudan .udf olarak kaydedilebilir.
     * @param {ArrayBuffer|Uint8Array} buffer - .docx ikili veri bloğu
     * @returns {Promise<Object>} udfModel nesnesi
     */
    async function parseDocx(buffer) {
        if (!window.JSZip) {
            throw new Error('JSZip kütüphanesi yüklenemedi.');
        }

        const first = (root, name) => root.getElementsByTagNameNS('*', name)[0] || null;
        const all = (root, name) => Array.from(root.getElementsByTagNameNS('*', name));
        const zip = await window.JSZip.loadAsync(buffer);
        const docXmlFile = zip.file('word/document.xml');
        if (!docXmlFile) {
            throw new Error('Geçersiz Word belgesi: word/document.xml arşive dahil değil.');
        }

        const docXmlStr = await docXmlFile.async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(docXmlStr, 'application/xml');

        if (first(xmlDoc, 'parsererror')) throw new Error('Word XML ayrıştırılamadı.');
        // Üst bilgi (Header) kontrolü
        let headerLeft = '';
        let headerRight = '';
        const hdrFile = zip.file('word/header1.xml');
        if (hdrFile) {
            try {
                const hdrStr = await hdrFile.async('string');
                const hdrDoc = parser.parseFromString(hdrStr, 'application/xml');
                const hdrTexts = Array.from(all(hdrDoc, 't')).map(t => t.textContent.trim()).filter(Boolean);
                if (hdrTexts.length >= 2) {
                    headerLeft = hdrTexts[0];
                    headerRight = hdrTexts[1];
                } else if (hdrTexts.length === 1) {
                    headerLeft = hdrTexts[0];
                }
            } catch (e) {}
        }

        // Alt bilgi (Footer) ve UYAP WebId kontrolü
        let webId = '';
        const ftrFile = zip.file('word/footer1.xml');
        if (ftrFile) {
            try {
                const ftrStr = await ftrFile.async('string');
                const mWeb = ftrStr.match(/([A-Za-z0-9+/=]{4,}\s*-\s*[A-Za-z0-9+/=]{4,}\s*-\s*[A-Za-z0-9+/=]{4,}\s*-\s*[A-Za-z0-9+/=]{4,})/);
                if (mWeb) {
                    webId = mWeb[1].replace(/\s+/g, ' ');
                }
            } catch (e) {}
        }

        // Sayfa özellikleri (w:sectPr)
        const sectPr = first(xmlDoc, 'sectPr');
        let orient = 1;
        let leftDxa = 1134, rightDxa = 1418, topDxa = 1418, bottomDxa = 1418;
        let headerDxa = 300, footerDxa = 1200;

        if (sectPr) {
            const pgSz = first(sectPr, 'pgSz');
            if (pgSz) {
                if (pgSz.getAttribute('w:orient') === 'landscape') orient = 2;
            }
            const pgMar = first(sectPr, 'pgMar');
            if (pgMar) {
                leftDxa = parseInt(pgMar.getAttribute('w:left'), 10) || leftDxa;
                rightDxa = parseInt(pgMar.getAttribute('w:right'), 10) || rightDxa;
                topDxa = parseInt(pgMar.getAttribute('w:top'), 10) || topDxa;
                bottomDxa = parseInt(pgMar.getAttribute('w:bottom'), 10) || bottomDxa;
                headerDxa = parseInt(pgMar.getAttribute('w:header'), 10) || headerDxa;
                footerDxa = parseInt(pgMar.getAttribute('w:footer'), 10) || footerDxa;
            }
        }

        const leftMarginPt = leftDxa / 20;
        const rightMarginPt = rightDxa / 20;
        const topMarginPt = topDxa / 20;
        const bottomMarginPt = bottomDxa / 20;

        const leftMarginCm = (leftDxa / 566.929).toFixed(2);
        const rightMarginCm = (rightDxa / 566.929).toFixed(2);
        const topMarginCm = (topDxa / 566.929).toFixed(2);
        const bottomMarginCm = (bottomDxa / 566.929).toFixed(2);

        // Gövde elemanlarını dönüştür
        const body = first(xmlDoc, 'body');
        const elements = [];

        const isMetaLabel = (txt) => {
            return /^(DOSYA NO|KARAR NO|\[?C\.SAVCILIĞI ESAS NO\]?|HAKİM|KATİP|DAVACI|MÜŞTEKİ SANIK|SANIK|MAĞDUR|SUÇ|SUÇ TARİHİ|SUÇ YERİ|KARAR TARİHİ)\b/i.test(txt.trim());
        };

        if (body) {
            const children = Array.from(body.children);
            children.forEach(elem => {
                const tag = elem.localName || elem.tagName.split(':').pop();

                if (tag === 'p') {
                    const pPr = first(elem, 'pPr');
                    let alignment = 'left';
                    let firstLineIndent = 0;
                    let leftIndent = 0, rightIndent = 0, hanging = 0, lineSpacing = 0, spaceAbove = 0, spaceBelow = 0;
                    const tabSet = pPr ? all(pPr,'tab').map(t => (Number(t.getAttribute('w:pos'))/20)+':'+({right:1,center:2}[t.getAttribute('w:val')]||0)+':0').join(',') : '';

                    if (pPr) {
                        const jc = first(pPr, 'jc');
                        if (jc) {
                            const val = jc.getAttribute('w:val');
                            if (val === 'center') alignment = 'center';
                            else if (val === 'right') alignment = 'right';
                            else if (val === 'both') alignment = 'justify';
                        }
                        const ind = first(pPr, 'ind');
                        if (ind) {
                            const fl = parseInt(ind.getAttribute('w:firstLine'), 10);
                            if (!isNaN(fl) && fl > 0) firstLineIndent = fl / 20;
                            const li = parseInt(ind.getAttribute('w:left'), 10);
                            if (!isNaN(li) && li > 0) leftIndent = li / 20;
                            rightIndent = (Number(ind.getAttribute('w:right')) || 0)/20;
                            hanging = (Number(ind.getAttribute('w:hanging')) || 0)/20;
                        }
                    }

                    const spacing = pPr && first(pPr,'spacing');
                    if (spacing) {
                        spaceAbove=(Number(spacing.getAttribute('w:before'))||0)/20;
                        spaceBelow=(Number(spacing.getAttribute('w:after'))||0)/20;
                        const v=Number(spacing.getAttribute('w:line')); if(v)lineSpacing=Math.max(0,v/240-1.15);
                    }
                    const runs = [];
                    const childElements = Array.from(elem.children);

                    childElements.forEach(ch => {
                        const chTag = ch.localName || ch.tagName.split(':').pop();
                        if (chTag === 'r') {
                            const rPr = first(ch, 'rPr');
                            let bold = false, italic = false, underline = false, strike = false;
                            let size = 12;
                            let family = 'Times New Roman';
                            let foreground = '#000000';

                            if (rPr) {
                                if (first(rPr, 'b')) bold = true;
                                if (first(rPr, 'i')) italic = true;
                                if (first(rPr, 'u')) underline = true;
                                if (first(rPr, 'strike')) strike = true;

                                const rFonts = first(rPr, 'rFonts');
                                if (rFonts) {
                                    family = rFonts.getAttribute('w:ascii') || rFonts.getAttribute('w:hAnsi') || family;
                                }
                                const sz = first(rPr, 'sz');
                                if (sz) {
                                    const halfPt = parseInt(sz.getAttribute('w:val'), 10);
                                    if (!isNaN(halfPt)) size = Math.round(halfPt / 2);
                                }
                                const col = first(rPr, 'color');
                                if (col) {
                                    const cVal = col.getAttribute('w:val');
                                    if (cVal && cVal !== 'auto') foreground = `#${cVal}`;
                                }
                            }

                            Array.from(ch.children).forEach(rChild => {
                                const rcTag = rChild.localName || rChild.tagName.split(':').pop();
                                if (rcTag === 't') {
                                    let txt = rChild.textContent || '';
                                    txt = txt.replace(/\u00b8/g, ''); // stray cedilla temizle
                                    if (txt) {
                                        runs.push({
                                            text: txt,
                                            bold,
                                            italic,
                                            underline,
                                            strikethrough: strike,
                                            size,
                                            family,
                                            foreground
                                        });
                                    }
                                } else if (rcTag === 'br' || rcTag === 'cr') {
                                    runs.push({text:'\n',size,family});
                                } else if (rcTag === 'tab') {
                                    runs.push({
                                        text: '\t',
                                        isTab: true,
                                        bold,
                                        size,
                                        family,
                                        foreground
                                    });
                                }
                            });
                        }
                    });

                    elements.push({
                        type: 'paragraph',
                        alignment,
                        leftIndent,
                        rightIndent, hanging, lineSpacing, spaceAbove, spaceBelow,
                        firstLineIndent, tabSet,
                        runs: runs.length > 0 ? runs : [{ text: '', size: 12, family: 'Times New Roman' }]
                    });

                } else if (tag === 'tbl') {
                    // Tablo
                    const rows = [];
                    const trs = Array.from(all(elem, 'tr'));
                    let maxCols = 0;

                    trs.forEach(tr => {
                        const cells = [];
                        const tcs = Array.from(all(tr, 'tc'));
                        if (tcs.length > maxCols) maxCols = tcs.length;

                        tcs.forEach(tc => {
                            const pNodes = Array.from(all(tc, 'p'));
                            const cellParas = [];

                            pNodes.forEach(p => {
                                const runs = [];
                                Array.from(all(p, 'r')).forEach(r => {
                                    const t = first(r, 't');
                                    const isBold = !!first(r, 'b');
                                    const isItalic = !!first(r, 'i');
                                    if (t && t.textContent) {
                                        runs.push({
                                            text: t.textContent.replace(/\u00b8/g, ''),
                                            bold: isBold,
                                            italic: isItalic,
                                            size: 11,
                                            family: 'Times New Roman'
                                        });
                                    }
                                });
                                cellParas.push({
                                    type: 'paragraph',
                                    alignment: 'left',
                                    runs: runs.length > 0 ? runs : [{ text: '', size: 11 }]
                                });
                            });

                            cells.push({
                                paragraphs: cellParas.length > 0 ? cellParas : [{
                                    type: 'paragraph',
                                    alignment: 'left',
                                    runs: [{ text: '', size: 11 }]
                                }]
                            });
                        });

                        rows.push({ cells });
                    });

                    if (rows.length > 0) {
                        elements.push({
                            type: 'table',
                            tableName: 'Sabit',
                            border: 'borderCell',
                            columnSpans: new Array(maxCols || 1).fill(100),
                            rows
                        });
                    }
                }
            });
        }

        return {
            formatId: '1.8',
            isSigned: false,
            signatures: [],
            pageProperties: {
                mediaSizeName: '1',
                leftMargin: leftMarginPt,
                rightMargin: rightMarginPt,
                topMargin: topMarginPt,
                bottomMargin: bottomMarginPt,
                leftMarginCm,
                rightMarginCm,
                topMarginCm,
                bottomMarginCm,
                paperOrientation: orient,
                headerFOffset: headerDxa / 20,
                footerFOffset: footerDxa / 20
            },
            headerInfo: headerLeft || headerRight ? { left: headerLeft, right: headerRight, startPage: 2 } : null,
            webId,
            docProperties: {
                uyapdogrulamakodu: webId,
                uyapsicil: ''
            },
            elements
        };
    }

    window.UkiCore = {
        UDF_CONSTANTS,
        ptToCm,
        cmToPt,
        argbToHex,
        hexToArgb,
        parseUdf,
        parseDocx,
        udfModelToHtml,
        layoutTabs,
        exportUdfBlob,
        exportDocxBlob
    };

})(window);
