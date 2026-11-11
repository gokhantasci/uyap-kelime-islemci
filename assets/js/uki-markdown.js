/**
 * UkiMarkdown - Markdown <-> UDF Çift Yönlü Dönüştürücü Modülü
 * 1. Markdown (.md) dosyasını veya metnini UDF uyumlu HTML'e ve .udf dosyasına çevirir.
 * 2. UDF belgesini standart GitHub Flavored Markdown (.md) formatına dönüştürür.
 * 3. Tarayıcıda %100 yerel ve çevrimdışı çalışır.
 */
(function(window) {
    'use strict';

    /**
     * MARKDOWN -> HTML DÖNÜŞTÜRÜCÜ (UYAP A4 Standartlarına Uyumlu)
     */
    function mdToHtml(mdText) {
        if (!mdText) return '<p class="udf-p"><br></p>';

        const lines = mdText.replace(/\r\n/g, '\n').split('\n');
        let html = '';
        let inCodeBlock = false;
        let codeBuffer = [];
        let inTable = false;
        let tableRows = [];
        let inList = false;
        let listType = null; // 'ul' or 'ol'

        function flushTable() {
            if (!inTable || tableRows.length === 0) return;
            html += '<table style="width: 100%; border-collapse: collapse; margin: 10pt 0; font-family: \'Times New Roman\', serif; font-size: 11pt;" border="1">\n';
            tableRows.forEach((row, idx) => {
                const isHeader = idx === 0;
                const tag = isHeader ? 'th' : 'td';
                const bg = isHeader ? 'background-color: #f1f5f9; font-weight: bold;' : '';
                html += '  <tr>\n';
                row.forEach(cell => {
                    const inlineHtml = parseInlineMd(cell.trim());
                    html += `    <${tag} style="border: 1px solid #334155; padding: 4pt 8pt; text-align: left; ${bg}">${inlineHtml}</${tag}>\n`;
                });
                html += '  </tr>\n';
            });
            html += '</table>\n';
            tableRows = [];
            inTable = false;
        }

        function flushList() {
            if (!inList) return;
            html += listType === 'ol' ? '</ol>\n' : '</ul>\n';
            inList = false;
            listType = null;
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // 1. Kod Blokları (```)
            if (trimmed.startsWith('```')) {
                if (inCodeBlock) {
                    // Kod bloğu bitti
                    const codeContent = codeBuffer.join('\n')
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    html += `<pre style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8pt 12pt; font-family: monospace; font-size: 10pt; line-height: 1.4; margin: 8pt 0; overflow-x: auto; white-space: pre-wrap;"><code>${codeContent}</code></pre>\n`;
                    codeBuffer = [];
                    inCodeBlock = false;
                } else {
                    flushTable();
                    flushList();
                    inCodeBlock = true;
                    codeBuffer = [];
                }
                continue;
            }

            if (inCodeBlock) {
                codeBuffer.push(line);
                continue;
            }

            // 2. Tablo Satırları (| ... |)
            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                flushList();
                // Ayraç satırı mı? (| --- | :---: |)
                if (/^\|[\s\-:]+(\|[\s\-:]+)+\|$/.test(trimmed)) {
                    // Tablo ayraç satırını atla, önceki satır başlıktır
                    continue;
                }
                const cells = trimmed.slice(1, -1).split('|');
                tableRows.push(cells);
                inTable = true;
                continue;
            } else if (inTable) {
                flushTable();
            }

            // 3. Yatay Çizgi (---, ***)
            if (/^(?:---|\*\*\*|___)$/.test(trimmed)) {
                flushList();
                html += '<hr style="border: none; border-top: 1px solid #64748b; margin: 14pt 0;">\n';
                continue;
            }

            // 4. Başlıklar (# H1, ## H2, ### H3, #### H4)
            const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                flushList();
                const level = headingMatch[1].length;
                const text = parseInlineMd(headingMatch[2]);
                let fontSize = '12pt';
                let align = 'left';
                let margin = '8pt 0 4pt';

                if (level === 1) {
                    fontSize = '15pt';
                    align = 'center';
                    margin = '14pt 0 8pt';
                } else if (level === 2) {
                    fontSize = '13.5pt';
                    margin = '12pt 0 6pt';
                } else if (level === 3) {
                    fontSize = '12pt';
                    margin = '10pt 0 4pt';
                }

                html += `<p class="udf-p" style="font-size: ${fontSize}; font-weight: bold; text-align: ${align}; margin: ${margin}; font-family: 'Times New Roman', serif;">${text}</p>\n`;
                continue;
            }

            // 5. Alıntılar (> ...)
            if (trimmed.startsWith('>')) {
                flushList();
                const quoteText = parseInlineMd(trimmed.replace(/^>\s*/, ''));
                html += `<p class="udf-p" style="margin-left: 28pt; border-left: 3px solid #94a3b8; padding-left: 10pt; font-style: italic; color: #334155; margin-bottom: 6pt; font-family: 'Times New Roman', serif;">${quoteText}</p>\n`;
                continue;
            }

            // 6. Sırasız Liste (- veya * veya +)
            const ulMatch = line.match(/^(\s*)(?:[\*\-\+])\s+(.+)$/);
            if (ulMatch) {
                if (!inList || listType !== 'ul') {
                    flushList();
                    html += '<ul style="margin: 4pt 0 6pt 24pt; padding: 0; font-family: \'Times New Roman\', serif;">\n';
                    inList = true;
                    listType = 'ul';
                }
                const itemText = parseInlineMd(ulMatch[2]);
                html += `  <li style="margin-bottom: 3pt; line-height: 1.25;">${itemText}</li>\n`;
                continue;
            }

            // 7. Sıralı Liste (1. 2. 3.)
            const olMatch = line.match(/^(\s*)(?:\d+)\.\s+(.+)$/);
            if (olMatch) {
                if (!inList || listType !== 'ol') {
                    flushList();
                    html += '<ol style="margin: 4pt 0 6pt 24pt; padding: 0; font-family: \'Times New Roman\', serif;">\n';
                    inList = true;
                    listType = 'ol';
                }
                const itemText = parseInlineMd(olMatch[2]);
                html += `  <li style="margin-bottom: 3pt; line-height: 1.25;">${itemText}</li>\n`;
                continue;
            }

            // Liste satırı değilse açık listeyi kapat
            flushList();

            // 8. Boş Satır
            if (!trimmed) {
                html += '<p class="udf-p" style="margin: 0; line-height: 1.15;"><br></p>\n';
                continue;
            }

            // 9. Standart Paragraf
            const paraText = parseInlineMd(trimmed);
            html += `<p class="udf-p" style="margin-bottom: 6pt; text-align: justify; text-indent: 28pt; line-height: 1.15; font-family: 'Times New Roman', serif; font-size: 12pt;">${paraText}</p>\n`;
        }

        flushTable();
        flushList();

        return html;
    }

    /**
     * Satır içi Markdown etiketlerini (bold, italic, strike, link, code) HTML'e çevirir.
     */
    function escHtml(t) {
        return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Bağlantı/görsel adresi: yalnızca http(s), mailto ve (bağlantılarda) sayfa içi/göreli adresler; görselde ayrıca data:image/(png|jpe?g|gif|webp)
    function safeUrl(rawEscaped, isImage) {
        const url = rawEscaped.trim().replace(/&amp;/g, '&');
        const ok = /^(https?:|mailto:)/i.test(url) || (!isImage && /^(#|\/|\.\/)/.test(url)) ||
            (isImage && /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+\/=]+$/i.test(url));
        return ok ? escHtml(url) : '#';
    }

    function parseInlineMd(text) {
        if (!text) return '';
        // Markdown metni güvenilmezdir: önce tüm HTML kaçışlanır, sonra yalnızca bilinen kurallar etiket üretir
        let s = escHtml(text);

        // Görseller ![alt](url)
        s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, url) =>
            '<img src="' + safeUrl(url, true) + '" alt="' + alt + '" style="max-width: 100%; height: auto; display: inline-block;">');

        // Linkler [metin](url)
        s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, url) =>
            '<a href="' + safeUrl(url, false) + '" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">' + label + '</a>');

        // Kalın ve İtalik ***metin*** veya ___metin___
        s = s.replace(/(\*\*\*|___)(.+?)\1/g, '<strong><em>$2</em></strong>');

        // Kalın **metin** veya __metin__
        s = s.replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>');

        // İtalik *metin* veya _metin_
        s = s.replace(/(\*|_)(.+?)\1/g, '<em>$2</em>');

        // Üstü çizili ~~metin~~
        s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');

        // Satır içi kod `kod`
        s = s.replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 10.5pt;">$1</code>');

        return s;
    }

    /**
     * HTML / DOM -> MARKDOWN DÖNÜŞTÜRÜCÜ
     */
    function htmlToMd(elementOrHtml) {
        let container = null;
        if (typeof elementOrHtml === 'string') {
            container = document.createElement('div');
            container.innerHTML = elementOrHtml;
        } else if (elementOrHtml && elementOrHtml.nodeType) {
            container = elementOrHtml.cloneNode(true);
        } else {
            return '';
        }

        // Katmanları, filigranları ve yardımcı araçları temizle
        const discardSelectors = [
            '#page-boundaries-layer', '#antet-layer', '#watermark-layer',
            '.page-boundaries-layer', '.a4-antet-layer', '.a4-watermark-layer',
            '.floating-seal-widget', '#floating-e-sign-seal', '.pb-header', '.pb-footer',
            '.page-break-divider', '.horizontal-ruler', '#horizontal-ruler'
        ];
        discardSelectors.forEach(sel => {
            container.querySelectorAll(sel).forEach(el => el.remove());
        });

        let md = '';
        const childNodes = Array.from(container.children);

        if (childNodes.length === 0) {
            return processNodeToMd(container).trim();
        }

        childNodes.forEach(node => {
            const blockMd = processBlockNode(node);
            if (blockMd !== null && blockMd !== undefined) {
                md += blockMd + '\n\n';
            }
        });

        // Fazla boş satırları toparla
        return md.replace(/\n{3,}/g, '\n\n').trim() + '\n';
    }

    function processBlockNode(node) {
        if (!node) return '';
        const tag = node.tagName ? node.tagName.toLowerCase() : '';

        // Tablo
        if (tag === 'table') {
            return tableToMd(node);
        }

        // Başlıklar
        if (/^h[1-6]$/.test(tag)) {
            const level = parseInt(tag.charAt(1), 10);
            const prefix = '#'.repeat(level) + ' ';
            return prefix + processInlineNodes(node).trim();
        }

        // Yatay çizgi
        if (tag === 'hr') {
            return '---';
        }

        // Kod Bloğu
        if (tag === 'pre') {
            return '```\n' + (node.textContent || '').trim() + '\n```';
        }

        // Sırasız Liste
        if (tag === 'ul') {
            const items = Array.from(node.querySelectorAll(':scope > li'));
            return items.map(li => '- ' + processInlineNodes(li).trim()).join('\n');
        }

        // Sıralı Liste
        if (tag === 'ol') {
            const items = Array.from(node.querySelectorAll(':scope > li'));
            return items.map((li, idx) => `${idx + 1}. ` + processInlineNodes(li).trim()).join('\n');
        }

        // Alıntı
        if (tag === 'blockquote') {
            return '> ' + processInlineNodes(node).trim().replace(/\n/g, '\n> ');
        }

        // Paragraf veya Div
        if (tag === 'p' || tag === 'div') {
            // Boş paragraf kontrolü
            if (!node.textContent.trim() && !node.querySelector('img')) {
                return '';
            }

            // Başlık stili uygulanmış paragraf kontrolü (büyük punto ve bold)
            const style = node.getAttribute('style') || '';
            const isBold = /font-weight:\s*(?:bold|[6-9]00)/i.test(style) || (node.querySelector('strong, b') && node.textContent.trim() === (node.querySelector('strong, b') || {}).textContent?.trim());
            const isCentered = /text-align:\s*center/i.test(style);
            const isBigFont = /(?:1[4-9]|2[0-9])pt/i.test(style);

            if (isBold && (isCentered || isBigFont)) {
                return '# ' + processInlineNodes(node).trim();
            }

            // Madde işaretiyle başlayan paragraflar
            const textContent = node.textContent.trim();
            if (textContent.startsWith('•') || textContent.startsWith('-')) {
                return '- ' + processInlineNodes(node).trim().replace(/^[•\-]\s*/, '');
            }

            return processInlineNodes(node).trim();
        }

        return processInlineNodes(node).trim();
    }

    function tableToMd(tableNode) {
        const rows = Array.from(tableNode.querySelectorAll('tr'));
        if (rows.length === 0) return '';

        let tableMd = '';
        let headerColCount = 0;

        rows.forEach((tr, rIdx) => {
            const cells = Array.from(tr.querySelectorAll('th, td'));
            if (cells.length === 0) return;

            const rowTexts = cells.map(c => processInlineNodes(c).trim().replace(/\|/g, '\\|').replace(/\n/g, ' '));
            tableMd += '| ' + rowTexts.join(' | ') + ' |\n';

            // Başlık ayracı
            if (rIdx === 0) {
                headerColCount = cells.length;
                const seps = Array(headerColCount).fill('---');
                tableMd += '| ' + seps.join(' | ') + ' |\n';
            }
        });

        return tableMd.trim();
    }

    function processInlineNodes(parent) {
        if (!parent) return '';
        let out = '';

        Array.from(parent.childNodes).forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                out += child.nodeValue;
                return;
            }

            if (child.nodeType !== Node.ELEMENT_NODE) return;

            const tag = child.tagName.toLowerCase();
            const inner = processInlineNodes(child);

            if (tag === 'strong' || tag === 'b') {
                out += `**${inner}**`;
            } else if (tag === 'em' || tag === 'i') {
                out += `*${inner}*`;
            } else if (tag === 'u') {
                out += `<u>${inner}</u>`;
            } else if (tag === 'del' || tag === 's' || tag === 'strike') {
                out += `~~${inner}~~`;
            } else if (tag === 'code') {
                out += `\`${inner}\``;
            } else if (tag === 'a') {
                const href = child.getAttribute('href') || '#';
                out += `[${inner}](${href})`;
            } else if (tag === 'img') {
                const src = child.getAttribute('src') || '';
                const alt = child.getAttribute('alt') || 'Görsel';
                out += `![${alt}](${src})`;
            } else if (tag === 'br') {
                out += '\n';
            } else {
                out += inner;
            }
        });

        return out;
    }

    /**
     * MARKDOWN DOSYASINI İÇE AKTARMA (IMPORT .MD -> EDITOR)
     */
    async function importMdFile(file) {
        if (!file) return;

        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = (e) => {
                try {
                    const mdText = e.target.result;
                    const htmlContent = mdToHtml(mdText);

                    const baseName = file.name.replace(/\.(?:md|markdown|txt)$/i, '');
                    window.UkiApp.replaceDocument(htmlContent, baseName, {source:'markdown'});

                    if (window.showToast) {
                        window.showToast(`"${file.name}" Markdown belgesi başarıyla UDF formatına dönüştürüldü ve açıldı.`, 'success');
                    }
                    resolve(true);
                } catch (err) {
                    console.error('Markdown içe aktarma hatası:', err);
                    if (window.showToast) {
                        window.showToast('Markdown dosyası dönüştürülürken hata oluştu.', 'error');
                    }
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file, 'UTF-8');
        });
    }

    /**
     * DÜZENLENEN BELGEYİ MARKDOWN (.MD) OLARAK İNDİRME (EXPORT EDITOR -> .MD)
     */
    function exportMdFile() {
        const editor = document.getElementById('editor');
        if (!editor) return;

        const mdText = htmlToMd(editor);
        const blob = new Blob([mdText], { type: 'text/markdown;charset=utf-8' });

        const docTitleInput = document.getElementById('doc-title');
        let rawTitle = (docTitleInput ? docTitleInput.value.trim() : '') || 'belge';
        let baseName = rawTitle.replace(/\.udf$/i, '').replace(/\.docx$/i, '').replace(/\.md$/i, '');
        const filename = `${baseName}.md`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        if (window.UkiStats) {
            window.UkiStats.recordDocumentDownloaded('md');
        }
        if (window.showToast) {
            window.showToast(`Belge "${filename}" olarak indirildi.`, 'success');
        }
    }

    /**
     * DÖNÜŞTÜRÜCÜ MODALI (MD <-> UDF ÇİFT YÖNLÜ DİYALOG)
     */
    let mdModalEl = null;

    function createConverterModal() {
        if (mdModalEl) return;
        mdModalEl = document.createElement('div');
        mdModalEl.id = 'modal-md-converter';
        mdModalEl.className = 'ax-modal-backdrop';
        mdModalEl.style.display = 'none';

        mdModalEl.innerHTML = `
            <div class="ax-modal-dialog" style="max-width: 720px;">
                <div class="ax-modal-header">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="7 8 7 16 10 12 13 16 13 8"/><polyline points="17 11 17 16"/><polyline points="15 14 17 16 19 14"/></svg>
                        <h3>Markdown &harr; UDF Çift Yönlü Dönüştürücü</h3>
                    </div>
                    <button type="button" class="ax-modal-close" onclick="window.UkiMarkdown.closeModal()">&times;</button>
                </div>
                <div class="ax-modal-body" style="padding: 16px;">
                    <div class="find-replace-tabs" style="margin-bottom: 14px;">
                        <button type="button" class="find-tab-btn active" id="tab-btn-md-to-udf">Markdown (.md) &rarr; UDF</button>
                        <button type="button" class="find-tab-btn" id="tab-btn-udf-to-md">UDF (.udf) &rarr; Markdown (.md)</button>
                    </div>

                    <!-- Panel 1: MD -> UDF -->
                    <div id="panel-md-to-udf">
                        <p style="font-size: 12px; color: var(--ax-color-neutral-600); margin-bottom: 10px;">
                            Markdown metninizi yapıştırın veya bir <code>.md</code> dosyası seçin. Başlıklar, tablolar, listeler ve kalın/italik biçimler otomatik olarak resmî UDF formatına uyarlanır.
                        </p>
                        <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                            <input type="file" id="md-convert-file-input" accept=".md,.markdown,.txt" style="display: none;">
                            <button type="button" class="tool-btn-secondary" onclick="document.getElementById('md-convert-file-input').click()">
                                📂 .md Dosyası Seç
                            </button>
                            <span id="md-file-selected-name" style="font-size: 11.5px; color: var(--ax-color-neutral-600); align-self: center;"></span>
                        </div>
                        <textarea id="md-input-text" rows="10" class="ax-input" style="width: 100%; height: 180px; text-align: left; font-family: monospace; font-size: 11.5px; padding: 8px; box-sizing: border-box; resize: vertical;" placeholder="# Dilekçe Başlığı&#10;&#10;**Davacı:** Ad Soyad&#10;**Vekili:** Av. Ad Soyad&#10;&#10;### Konu ve Talepler&#10;- Talep maddesi 1&#10;- Talep maddesi 2&#10;&#10;| Sıra | Kalem | Tutar |&#10;| --- | --- | --- |&#10;| 1 | Alacak | 10.000 TL |"></textarea>
                    </div>

                    <!-- Panel 2: UDF -> MD -->
                    <div id="panel-udf-to-md" style="display: none;">
                        <p style="font-size: 12px; color: var(--ax-color-neutral-600); margin-bottom: 10px;">
                            Mevcut açık belgenin Markdown karşılığını inceleyin veya harici bir <code>.udf</code> dosyası yükleyerek anında Markdown'a çevirin.
                        </p>
                        <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                            <input type="file" id="udf-to-md-file-input" accept=".udf" style="display: none;">
                            <button type="button" class="tool-btn-secondary" onclick="document.getElementById('udf-to-md-file-input').click()">
                                📂 Başka Bir .udf Dosyası Seç
                            </button>
                            <button type="button" class="tool-btn-secondary" id="btn-sync-current-editor-to-md">
                                🔄 Geçerli Editör Metnini Getir
                            </button>
                        </div>
                        <textarea id="md-output-text" rows="10" class="ax-input" style="width: 100%; height: 180px; text-align: left; font-family: monospace; font-size: 11.5px; padding: 8px; box-sizing: border-box; resize: vertical;" readonly></textarea>
                    </div>
                </div>
                <div class="ax-modal-footer" style="justify-content: space-between;">
                    <div style="font-size: 11.5px; color: var(--ax-color-neutral-600);">
                        ⚡ 100% Yerel Tarayıcı Dönüştürücüsü (Sunucuya aktarılmaz)
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" id="btn-md-apply-editor" class="tool-btn-primary">Editörde Aç ve Düzenle</button>
                        <button type="button" id="btn-md-download-udf" class="tool-btn-secondary">Doğrudan .udf İndir</button>
                        <button type="button" id="btn-copy-converted-md" class="tool-btn-secondary" style="display: none;">Markdown'u Kopyala</button>
                        <button type="button" id="btn-download-converted-md" class="tool-btn-primary" style="display: none;">.md Olarak İndir</button>
                        <button type="button" class="tool-btn-secondary" onclick="window.UkiMarkdown.closeModal()">Kapat</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(mdModalEl);

        // Tab Değiştirme Mantığı
        const tabMdToUdf = document.getElementById('tab-btn-md-to-udf');
        const tabUdfToMd = document.getElementById('tab-btn-udf-to-md');
        const panelMdToUdf = document.getElementById('panel-md-to-udf');
        const panelUdfToMd = document.getElementById('panel-udf-to-md');

        const btnApplyEditor = document.getElementById('btn-md-apply-editor');
        const btnDownloadUdf = document.getElementById('btn-md-download-udf');
        const btnCopyMd = document.getElementById('btn-copy-converted-md');
        const btnDownloadMd = document.getElementById('btn-download-converted-md');

        tabMdToUdf.addEventListener('click', () => {
            tabMdToUdf.classList.add('active');
            tabUdfToMd.classList.remove('active');
            panelMdToUdf.style.display = 'block';
            panelUdfToMd.style.display = 'none';

            btnApplyEditor.style.display = 'inline-flex';
            btnDownloadUdf.style.display = 'inline-flex';
            btnCopyMd.style.display = 'none';
            btnDownloadMd.style.display = 'none';
        });

        tabUdfToMd.addEventListener('click', () => {
            tabUdfToMd.classList.add('active');
            tabMdToUdf.classList.remove('active');
            panelUdfToMd.style.display = 'block';
            panelMdToUdf.style.display = 'none';

            btnApplyEditor.style.display = 'none';
            btnDownloadUdf.style.display = 'none';
            btnCopyMd.style.display = 'inline-flex';
            btnDownloadMd.style.display = 'inline-flex';

            syncCurrentEditorToMd();
        });

        // Editör içeriğini MD alanına çek
        function syncCurrentEditorToMd() {
            const editor = document.getElementById('editor');
            const outputText = document.getElementById('md-output-text');
            if (editor && outputText) {
                outputText.value = htmlToMd(editor);
            }
        }

        document.getElementById('btn-sync-current-editor-to-md').addEventListener('click', syncCurrentEditorToMd);

        // MD Dosya Seçimi
        const mdFileInput = document.getElementById('md-convert-file-input');
        mdFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const f = e.target.files[0];
                document.getElementById('md-file-selected-name').textContent = f.name;
                const r = new FileReader();
                r.onload = (ev) => {
                    document.getElementById('md-input-text').value = ev.target.result;
                };
                r.readAsText(f, 'UTF-8');
            }
        });

        // UDF Dosya Seçimi (UDF -> MD sekmesinde)
        const udfFileInput = document.getElementById('udf-to-md-file-input');
        udfFileInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0] && window.UkiCore) {
                const f = e.target.files[0];
                try {
                    const doc = await window.UkiCore.parseUdf(f);
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = window.UkiCore.udfModelToHtml(doc);
                    document.getElementById('md-output-text').value = htmlToMd(tempDiv);
                    if (window.showToast) {
                        window.showToast(`"${f.name}" UDF belgesi Markdown'a dönüştürüldü.`, 'success');
                    }
                } catch (err) {
                    console.error('UDF ayrıştırma hatası:', err);
                    if (window.showToast) {
                        window.showToast('UDF belgesi okunurken hata oluştu.', 'error');
                    }
                }
            }
        });

        // "Editörde Aç ve Düzenle"
        btnApplyEditor.addEventListener('click', () => {
            const mdText = document.getElementById('md-input-text').value;
            if (!mdText.trim()) {
                if (window.showToast) window.showToast('Lütfen dönüştürülecek Markdown metni girin.', 'warning');
                return;
            }
            const htmlContent = mdToHtml(mdText);
            const editor = document.getElementById('editor');
            if (editor) {
                if (window.editor && typeof window.editor.setContentHtml === 'function') {
                    window.editor.setContentHtml(htmlContent);
                } else {
                    editor.innerHTML = htmlContent;
                    if (window.UkiHistory && typeof window.UkiHistory.clear === 'function') {
                        window.UkiHistory.clear();
                    }
                }
                if (window.UkiPages) window.UkiPages.updatePages();
            }
            closeModal();
            if (window.showToast) window.showToast('Markdown metni UDF editörüne aktarıldı.', 'success');
        });

        // "Doğrudan .udf İndir"
        btnDownloadUdf.addEventListener('click', async () => {
            const mdText = document.getElementById('md-input-text').value;
            if (!mdText.trim()) {
                if (window.showToast) window.showToast('Lütfen dönüştürülecek Markdown metni girin.', 'warning');
                return;
            }
            if (!window.UkiCore) return;

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = mdToHtml(mdText);

            try {
                const blob = await window.UkiCore.exportUdfBlob(tempDiv);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'markdown_belge.udf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                if (window.showToast) window.showToast('UDF belgesi başarıyla oluşturuldu ve indirildi.', 'success');
            } catch (err) {
                console.error(err);
                if (window.showToast) window.showToast('UDF oluşturulurken hata meydana geldi.', 'error');
            }
        });

        // "Markdown'u Kopyala"
        btnCopyMd.addEventListener('click', () => {
            const text = document.getElementById('md-output-text').value;
            if (!text.trim()) return;
            navigator.clipboard.writeText(text).then(() => {
                if (window.showToast) window.showToast('Markdown metni panoya kopyalandı.', 'success');
            });
        });

        // ".md Olarak İndir"
        btnDownloadMd.addEventListener('click', () => {
            const text = document.getElementById('md-output-text').value;
            if (!text.trim()) return;
            const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'belge.md';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
    }

    function openModal() {
        createConverterModal();
        mdModalEl.style.display = 'flex';
        // Mevcut editör içeriğini otomatik panele çek
        const editor = document.getElementById('editor');
        const outputText = document.getElementById('md-output-text');
        if (editor && outputText) {
            outputText.value = htmlToMd(editor);
        }
    }

    function closeModal() {
        if (mdModalEl) {
            mdModalEl.style.display = 'none';
        }
    }

    // Dışa açılan API
    window.UkiMarkdown = {
        mdToHtml: mdToHtml,
        htmlToMd: htmlToMd,
        importMdFile: importMdFile,
        exportMdFile: exportMdFile,
        openModal: openModal,
        closeModal: closeModal
    };

})(window);
