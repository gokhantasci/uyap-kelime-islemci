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
            this.el.setAttribute('spellcheck', 'true');

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
            // Düz metin veya temiz HTML yapıştırma desteği
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
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

        insertTable(rows = 3, cols = 3) {
            this.el.focus();
            let tableHtml = '<table class="udf-table" style="width: 100%; border-collapse: collapse; margin: 10px 0;"><tbody>';
            for (let r = 0; r < rows; r++) {
                tableHtml += '<tr>';
                for (let c = 0; c < cols; c++) {
                    tableHtml += '<td style="border: 1px solid #777; padding: 6px 8px; min-width: 50px;"><p><br></p></td>';
                }
                tableHtml += '</tr>';
            }
            tableHtml += '</tbody></table><p><br></p>';
            this.format('insertHTML', tableHtml);
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
            this.el.innerHTML = html;
            this.updateStats();
            this.updateToolbarState();
        }

        clear() {
            this.el.innerHTML = '<p><br></p>';
            this.updateStats();
        }
    }

    window.UkiEditor = UkiEditor;

})(window);

