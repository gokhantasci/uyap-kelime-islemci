/**
 * UYAP Kelime İşlemci (UKİ) - Editör Mantığı ve Biçimlendirme Motoru
 * Açık Kaynak Web Sürümü
 */

(function (window) {
    'use strict';

    class UkiEditor {
        constructor(editableElement, options = {}) {
            this.el = editableElement;
            this.options = options;
            this.onStatsChange = options.onStatsChange || null;
            this.init();
        }

        init() {
            this.el.setAttribute('contenteditable', 'true');
            this.el.setAttribute('spellcheck', 'false');

            // Değişiklik dinleyicileri
            this.el.addEventListener('input', () => this.updateStats());
            this.el.addEventListener('keyup', () => {
                this.updateStats();
                this.updateToolbarState();
            });
            this.el.addEventListener('mouseup', () => this.updateToolbarState());
            this.el.addEventListener('paste', (e) => this.handlePaste(e));

            // Başlangıç istatistikleri
            this.updateStats();
        }

        handlePaste(e) {
            e.preventDefault();
            const clipboardData = e.clipboardData || window.clipboardData;
            if (!clipboardData) return;

            // 1. Excel, Word, Google E-Tablolar veya TSV tablo yapıştırma desteği
            if (window.UkiTable) {
                const tableEl = window.UkiTable.parseClipboard(clipboardData);
                if (tableEl) {
                    window.UkiTable.insertTableAtSelection(tableEl, this.el);
                    this.updateStats();
                    if (window.UkiPages && typeof window.UkiPages.repaginate === 'function') {
                        window.UkiPages.repaginate();
                    }
                    if (typeof window.showToast === 'function') {
                        const rowCount = tableEl.querySelectorAll('tr').length;
                        const colCount = tableEl.querySelector('tr')?.querySelectorAll('td, th').length || 0;
                        window.showToast(`Tablo başarıyla yapıştırıldı (${rowCount} satır, ${colCount} sütun).`, 'success');
                    }
                    return;
                }
            }

            // 2. Normal düz metin yapıştırma
            const text = clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
            this.updateStats();
        }

        format(command, value = null) {
            this.el.focus();
            document.execCommand(command, false, value);
            this.updateToolbarState();
            this.updateStats();
        }

        setFontFamily(family) {
            this.format('fontName', family);
        }

        setFontSize(sizePt) {
            this.el.focus();
            // Standart execCommand fontSize 1-7 değerleri alır.
            // Piksel / Punto hassasiyeti için seçili metni span ile sarmalayabiliriz:
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            if (range.collapsed) {
                // Seçim yoksa doğrudan execCommand
                this.format('fontSize', '3');
                return;
            }

            const span = document.createElement('span');
            span.style.fontSize = `${sizePt}pt`;
            span.appendChild(range.extractContents());
            range.insertNode(span);

            // Seçimi koru
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.addRange(newRange);

            this.updateToolbarState();
            this.updateStats();
        }

        setTextColor(colorHex) {
            this.format('foreColor', colorHex);
        }

        setAlignment(align) {
            if (align === 'left') this.format('justifyLeft');
            else if (align === 'center') this.format('justifyCenter');
            else if (align === 'right') this.format('justifyRight');
            else if (align === 'justify') this.format('justifyFull');
        }

        insertTable(rows = 3, cols = 3, targetRange = null) {
            this.el.focus();
            const table = document.createElement('table');
            table.className = 'udf-table';
            table.style.cssText = 'width: 100%; border-collapse: collapse; margin: 10px 0; table-layout: fixed;';
            const tbody = document.createElement('tbody');
            table.appendChild(tbody);
            for (let r = 0; r < rows; r++) {
                const tr = document.createElement('tr');
                for (let c = 0; c < cols; c++) {
                    const td = document.createElement('td');
                    td.style.cssText = 'border: 1px solid #777; padding: 6px 8px; min-width: 50px;';
                    td.innerHTML = '<p style="margin: 0; min-height: 1.2em;"><br></p>';
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }

            if (window.UkiTable && window.UkiTable.insertTableAtSelection) {
                window.UkiTable.insertTableAtSelection(table, this.el, targetRange);
            } else {
                this.el.appendChild(table);
            }

            this.updateStats();
            if (typeof window.recalculatePagesAndThumbnails === 'function') {
                window.recalculatePagesAndThumbnails();
            }
        }

        insertPageBreak() {
            this.el.focus();
            const pageBreakHtml = '<div class="udf-page-break" style="page-break-after: always; border-bottom: 2px dashed #999; margin: 20px 0; height: 1px;"></div><p><br></p>';
            this.format('insertHTML', pageBreakHtml);
        }

        updateStats() {
            const text = this.el.innerText || '';
            const words = text.trim() ? text.trim().split(/\s+/).length : 0;
            const chars = text.length;
            const charsNoSpaces = text.replace(/\s+/g, '').length;

            // Tahmini A4 sayfa sayısı hesabı (yükseklik bazlı)
            const height = this.el.scrollHeight;
            const pageHeightPx = 1122; // A4 96 DPI'da yaklaşık 1122px
            const pages = Math.max(1, Math.ceil(height / pageHeightPx));

            if (this.onStatsChange) {
                this.onStatsChange({
                    words,
                    chars,
                    charsNoSpaces,
                    pages
                });
            }
        }

        updateToolbarState() {
            const activeStates = {
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                underline: document.queryCommandState('underline'),
                strikethrough: document.queryCommandState('strikeThrough'),
                justifyLeft: document.queryCommandState('justifyLeft'),
                justifyCenter: document.queryCommandState('justifyCenter'),
                justifyRight: document.queryCommandState('justifyRight'),
                justifyFull: document.queryCommandState('justifyFull')
            };

            // Düğmeleri güncelle
            document.querySelectorAll('[data-command]').forEach(btn => {
                const cmd = btn.getAttribute('data-command');
                if (activeStates[cmd]) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        getContentHtml() {
            return this.el.innerHTML;
        }

        setContentHtml(html) {
            // Katmanları (antet, filigran, imza rozeti, sayfa kromu) koru
            const keep = Array.from(this.el.children).filter(c =>
                c.id === 'antet-layer' || c.id === 'watermark-layer' ||
                c.id === 'e-sign-seal-badge' || c.id === 'page-boundaries-layer');
            this.el.innerHTML = html;
            keep.reverse().forEach(c => this.el.insertBefore(c, this.el.firstChild));
            this.updateStats();
            this.updateToolbarState();
            if (window.UkiHistory && typeof window.UkiHistory.clear === 'function') {
                window.UkiHistory.clear();
            }
        }

        clear() {
            this.setContentHtml('<p><br></p>'); // katmanları (antet, filigran...) korur
            return;
            this.updateStats();
        }
    }

    window.UkiEditor = UkiEditor;

})(window);

