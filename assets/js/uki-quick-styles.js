/**
 * UYAP Kelime İşlemci (UKİ) - Hızlı Stiller & Biçim Boyacısı Modülü
 * ----------------------------------------------------------------
 * 1. Biçim Boyacısı (Format Painter): Biçim Kopyalama / Yapıştırma
 *    - Tek tık: tek seferlik boyama
 *    - Çift tık: kilitli çoklu boyama (Esc veya tekrar tıkla çıkış)
 *    - Kısayollar: Ctrl+Shift+C (Kopyala), Ctrl+Shift+V (Yapıştır)
 * 2. Kişiselleştirilmiş Hızlı Stiller:
 *    - Kullanıcı ortala + mavi yap + bold + italik gibi kombine stilleri kaydedebilir.
 *    - Metni seçip tek tıkla tüm özellikleri (font, punto, bold, italik, renk, hizalama, aralık) uygular.
 *    - Yerel hafızaya (localStorage) kaydedilir, silinebilir, düzenlenebilir.
 */

(function (window, document) {
    'use strict';

    const LS_KEY_STYLES = 'uki-custom-quick-styles';

    // Standart UYAP ve Adliye hazır stilleri
    const DEFAULT_PRESETS = [
        {
            id: 'preset-mavi-vurgu-orta',
            name: 'Mavi Vurgulu Başlık (Ortalı, Bold, İtalik)',
            isDefault: true,
            fontFamily: 'Times New Roman',
            fontSize: '13pt',
            bold: true,
            italic: true,
            underline: false,
            color: '#1e40af',
            backgroundColor: 'transparent',
            textAlign: 'center',
            lineHeight: '1.15'
        },
        {
            id: 'preset-mavi-vurgu',
            name: 'Önemli Vurgu (Mavi, Bold, İtalik)',
            isDefault: true,
            fontFamily: 'Times New Roman',
            fontSize: '12pt',
            bold: true,
            italic: true,
            underline: false,
            color: '#1e40af',
            backgroundColor: 'transparent',
            textAlign: '',
            lineHeight: ''
        },
        {
            id: 'preset-karar-basligi',
            name: 'Gerekçeli Karar Başlığı (13pt, Bold, Ortalı)',
            isDefault: true,
            fontFamily: 'Times New Roman',
            fontSize: '13pt',
            bold: true,
            italic: false,
            underline: false,
            color: '#000000',
            backgroundColor: 'transparent',
            textAlign: 'center',
            lineHeight: '1.15'
        },
        {
            id: 'preset-imza-blogu',
            name: 'Hâkim / Kâtip İmzası (Bold, Sağa Dayalı)',
            isDefault: true,
            fontFamily: 'Times New Roman',
            fontSize: '12pt',
            bold: true,
            italic: false,
            underline: false,
            color: '#000000',
            backgroundColor: 'transparent',
            textAlign: 'right',
            lineHeight: '1.0'
        },
        {
            id: 'preset-iddia-savunma',
            name: 'İddia / Savunma Vurgusu (Bold, Altı Çizili)',
            isDefault: true,
            fontFamily: 'Times New Roman',
            fontSize: '12pt',
            bold: true,
            italic: false,
            underline: true,
            color: '#000000',
            backgroundColor: 'transparent',
            textAlign: 'justify',
            lineHeight: '1.0'
        },
        {
            id: 'preset-uyap-standart',
            name: 'Standart UYAP Metni (12pt, İki Yana, 1.25cm Girinti)',
            isDefault: true,
            fontFamily: 'Times New Roman',
            fontSize: '12pt',
            bold: false,
            italic: false,
            underline: false,
            color: '#000000',
            backgroundColor: 'transparent',
            textAlign: 'justify',
            lineHeight: '1.0',
            textIndent: '35.43pt' // 1.25 cm
        }
    ];

    let stylesList = [];
    function loadStyles() {
        stylesList = [...DEFAULT_PRESETS];
        try {
            const raw = localStorage.getItem(LS_KEY_STYLES);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    parsed.forEach(st => {
                        if (st && st.id && !stylesList.some(x => x.id === st.id)) {
                            stylesList.push(st);
                        }
                    });
                }
            }
        } catch (_) {}
    }

    function saveCustomStyles() {
        try {
            const customs = stylesList.filter(s => !s.isDefault);
            localStorage.setItem(LS_KEY_STYLES, JSON.stringify(customs));
        } catch (_) {}
    }

    // -------------------------------------------------------------------------
    // BİÇİM BOYACISI (FORMAT PAINTER) DURUMU
    // -------------------------------------------------------------------------
    let copiedFormat = null;
    let isPaintActive = false;
    let isPaintLocked = false; // Çift tık ile kilitlenme

    function extractComputedFormat(targetEl) {
        if (!targetEl) return null;
        const comp = window.getComputedStyle(targetEl);
        const p = targetEl.closest ? targetEl.closest('p') : null;
        const pComp = p ? window.getComputedStyle(p) : null;

        return {
            fontFamily: comp.fontFamily,
            fontSize: comp.fontSize,
            fontWeight: comp.fontWeight,
            fontStyle: comp.fontStyle,
            textDecoration: comp.textDecoration,
            color: comp.color,
            backgroundColor: comp.backgroundColor === 'rgba(0, 0, 0, 0)' ? 'transparent' : comp.backgroundColor,
            // Paragraf özellikleri
            textAlign: p ? (p.style.textAlign || pComp.textAlign) : '',
            lineHeight: p ? (p.style.lineHeight || pComp.lineHeight) : '',
            textIndent: p ? (p.style.textIndent || pComp.textIndent) : '',
            paddingLeft: p ? p.style.paddingLeft : '',
            paddingRight: p ? p.style.paddingRight : '',
            dataFli: p ? p.getAttribute('data-fli') : null,
            dataHanging: p ? p.getAttribute('data-hanging') : null,
            dataLi: p ? p.getAttribute('data-li') : null,
            dataRi: p ? p.getAttribute('data-ri') : null,
            dataSpaceAbove: p ? p.getAttribute('data-spaceabove') : null,
            dataSpaceBelow: p ? p.getAttribute('data-spacebelow') : null,
            dataLineSpacing: p ? p.getAttribute('data-linespacing') : null
        };
    }

    function copyFormatFromSelection() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return false;
        const node = sel.anchorNode;
        const targetEl = node ? (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) : null;
        if (!targetEl) return false;

        copiedFormat = extractComputedFormat(targetEl);
        return !!copiedFormat;
    }

    function applyFormatToSelection(fmt) {
        if (!fmt) return;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        // 1. Karakter stillerini seçili metne uygula
        if (!sel.isCollapsed) {
            // Seçim boş değilse inline span ile sar veya stillendir
            document.execCommand('styleWithCSS', false, true);

            // Font & Punto
            if (fmt.fontFamily) document.execCommand('fontName', false, fmt.fontFamily);
            if (fmt.fontSize) {
                // fontSize execCommand puntoyu tam vermeyebilir, seçimi span ile stillendir
                applyInlineStylesToRange(sel.getRangeAt(0), {
                    fontSize: fmt.fontSize,
                    color: fmt.color,
                    backgroundColor: fmt.backgroundColor && fmt.backgroundColor !== 'transparent' ? fmt.backgroundColor : ''
                });
            }

            // Bold
            const isBold = fmt.bold || fmt.fontWeight === 'bold' || parseInt(fmt.fontWeight, 10) >= 700;
            if (isBold) {
                if (!document.queryCommandState('bold')) document.execCommand('bold', false, null);
            } else {
                if (document.queryCommandState('bold')) document.execCommand('bold', false, null);
            }

            // Italic
            const isItalic = fmt.italic || fmt.fontStyle === 'italic';
            if (isItalic) {
                if (!document.queryCommandState('italic')) document.execCommand('italic', false, null);
            } else {
                if (document.queryCommandState('italic')) document.execCommand('italic', false, null);
            }

            // Underline
            const isUnderline = fmt.underline || (fmt.textDecoration && fmt.textDecoration.includes('underline'));
            if (isUnderline) {
                if (!document.queryCommandState('underline')) document.execCommand('underline', false, null);
            } else {
                if (document.queryCommandState('underline')) document.execCommand('underline', false, null);
            }

            // Renk
            if (fmt.color && fmt.color !== 'transparent') {
                document.execCommand('foreColor', false, fmt.color);
            }
        }

        // 2. Paragraf / Blok Düzeyi Stilleri Uygula (Hizalama, Girinti, Satır Aralığı)
        const range = sel.getRangeAt(0);
        const editorEl = document.getElementById('editor');
        if (editorEl) {
            const allP = Array.from(editorEl.querySelectorAll('p'));
            const targetPs = allP.filter(p => range.intersectsNode(p));
            if (!targetPs.length) {
                const p = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode.closest('p') : sel.anchorNode.parentElement.closest('p');
                if (p && editorEl.contains(p)) targetPs.push(p);
            }

            targetPs.forEach(p => {
                if (fmt.textAlign) p.style.textAlign = fmt.textAlign;
                if (fmt.lineHeight) p.style.lineHeight = fmt.lineHeight;
                if (fmt.textIndent) p.style.textIndent = fmt.textIndent;
                if (fmt.paddingLeft) p.style.paddingLeft = fmt.paddingLeft;
                if (fmt.paddingRight) p.style.paddingRight = fmt.paddingRight;

                if (fmt.dataFli !== undefined && fmt.dataFli !== null) p.setAttribute('data-fli', fmt.dataFli);
                if (fmt.dataHanging !== undefined && fmt.dataHanging !== null) p.setAttribute('data-hanging', fmt.dataHanging);
                if (fmt.dataLi !== undefined && fmt.dataLi !== null) p.setAttribute('data-li', fmt.dataLi);
                if (fmt.dataRi !== undefined && fmt.dataRi !== null) p.setAttribute('data-ri', fmt.dataRi);
                if (fmt.dataSpaceAbove !== undefined && fmt.dataSpaceAbove !== null) p.setAttribute('data-spaceabove', fmt.dataSpaceAbove);
                if (fmt.dataSpaceBelow !== undefined && fmt.dataSpaceBelow !== null) p.setAttribute('data-spacebelow', fmt.dataSpaceBelow);
                if (fmt.dataLineSpacing !== undefined && fmt.dataLineSpacing !== null) p.setAttribute('data-linespacing', fmt.dataLineSpacing);
            });

            document.dispatchEvent(new Event('uki-document-change'));
            if (typeof window.recalculatePagesAndThumbnails === 'function') {
                window.recalculatePagesAndThumbnails();
            }
        }
    }

    function applyInlineStylesToRange(range, styles) {
        if (!range || range.collapsed) return;
        if (window.UkiEditFix) { window.UkiEditFix.applyInlineStyle(range, styles); return; }
        try {
            const span = document.createElement('span');
            Object.assign(span.style, styles);
            const content = range.extractContents();
            span.appendChild(content);
            range.insertNode(span);
        } catch (_) {}
    }

    // -------------------------------------------------------------------------
    // HIZLI STİLLER KONTROLCÜSÜ
    // -------------------------------------------------------------------------
    class UkiQuickStylesController {
        constructor() {
            this.btnPainter = null;
            this.btnQuickStyles = null;
            this.dropdownPanel = null;
            this.modalSaveStyle = null;
            this.editorEl = null;
        }

        init() {
            this.editorEl = document.getElementById('editor');
            this.btnPainter = document.getElementById('btn-format-painter');
            this.btnQuickStyles = document.getElementById('btn-quick-styles');
            this.dropdownPanel = document.getElementById('quick-styles-dropdown-panel');
            this.modalSaveStyle = document.getElementById('modal-save-quick-style');

            loadStyles();
            this.buildDropdownMenu();
            this.bindFormatPainter();
            this.bindShortcuts();
            this.bindSaveModal();
        }

        // Biçim Boyacısı Buton Bağlantıları
        bindFormatPainter() {
            if (!this.btnPainter) return;

            // Tek Tık: Kopyala veya Tek Seferlik Boyama Moduna Geç
            this.btnPainter.addEventListener('click', (e) => {
                if (isPaintActive) {
                    this.deactivateFormatPainter();
                } else {
                    const ok = copyFormatFromSelection();
                    if (ok) {
                        isPaintActive = true;
                        isPaintLocked = false;
                        this.updatePainterUi();
                        if (typeof window.showToast === 'function') {
                            window.showToast('Biçim kopyalandı. Hedef metni seçin (İptal için Esc).', 'info');
                        }
                    } else {
                        if (typeof window.showToast === 'function') {
                            window.showToast('Lütfen önce biçimi kopyalanacak bir metne tıklayın veya seçin.', 'warning');
                        }
                    }
                }
            });

            // Çift Tık: Kilitli Boyama Modu (Çoklu Seçim İçin)
            this.btnPainter.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const ok = copyFormatFromSelection();
                if (ok) {
                    isPaintActive = true;
                    isPaintLocked = true;
                    this.updatePainterUi();
                    if (typeof window.showToast === 'function') {
                        window.showToast('Biçim Boyacısı kilitlendi (Çoklu boyama). Çıkmak için Esc tuşuna basın.', 'success');
                    }
                }
            });

            // Editörde Seçim Yapılınca / Tıklanınca Biçimi Uygula
            if (this.editorEl) {
                this.editorEl.addEventListener('mouseup', () => {
                    if (!isPaintActive || !copiedFormat) return;
                    const sel = window.getSelection();
                    if (!sel || !sel.rangeCount) return;

                    // Biçimi uygula
                    applyFormatToSelection(copiedFormat);

                    if (!isPaintLocked) {
                        this.deactivateFormatPainter();
                    }
                });
            }

            // Esc Tuşu ile Çıkış
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && isPaintActive) {
                    this.deactivateFormatPainter();
                    if (typeof window.showToast === 'function') {
                        window.showToast('Biçim boyama iptal edildi.', 'info');
                    }
                }
            });
        }

        updatePainterUi() {
            if (this.btnPainter) {
                this.btnPainter.classList.toggle('active', isPaintActive);
                this.btnPainter.classList.toggle('locked', isPaintLocked);
            }
            if (this.editorEl) {
                this.editorEl.classList.toggle('format-painting-cursor', isPaintActive);
            }
        }

        deactivateFormatPainter() {
            isPaintActive = false;
            isPaintLocked = false;
            this.updatePainterUi();
        }

        // Klavye Kısayolları (Ctrl+Shift+C / Ctrl+Shift+V)
        bindShortcuts() {
            window.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
                    const key = e.key.toUpperCase();
                    if (key === 'C') {
                        e.preventDefault();
                        const ok = copyFormatFromSelection();
                        if (ok && typeof window.showToast === 'function') {
                            window.showToast('Biçim kopyalandı (Ctrl+Shift+V ile yapıştırabilirsiniz).', 'info');
                        }
                    } else if (key === 'V') {
                        e.preventDefault();
                        if (copiedFormat) {
                            applyFormatToSelection(copiedFormat);
                            if (typeof window.showToast === 'function') {
                                window.showToast('Biçim uygulandı.', 'success');
                            }
                        } else {
                            if (typeof window.showToast === 'function') {
                                window.showToast('Henüz kopyalanmış bir biçim yok (Ctrl+Shift+C ile kopyalayın).', 'warning');
                            }
                        }
                    }
                }
            });
        }

        // Hızlı Stiller Açılır Menüsünü Oluştur
        buildDropdownMenu() {
            if (!this.dropdownPanel) return;

            if (this.btnQuickStyles) {
                this.btnQuickStyles.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isOpen = this.dropdownPanel.style.display === 'block';
                    this.dropdownPanel.style.display = isOpen ? 'none' : 'block';
                    if (!isOpen) this.renderStylesList();
                });

                document.addEventListener('click', (e) => {
                    if (!this.dropdownPanel.contains(e.target) && e.target !== this.btnQuickStyles) {
                        this.dropdownPanel.style.display = 'none';
                    }
                });
            }
        }

        renderStylesList() {
            if (!this.dropdownPanel) return;
            this.dropdownPanel.innerHTML = '';

            const header = document.createElement('div');
            header.className = 'quick-styles-header';
            header.innerHTML = `
                <div style="font-weight: 700; font-size: 11.5px; color: #1e3a5f;">Hızlı Stiller Galerisi</div>
                <button type="button" id="btn-open-save-style-modal" class="tool-btn-primary" style="font-size: 10.5px; padding: 3px 8px;">
                    + Yeni Stil Kaydet
                </button>
            `;
            this.dropdownPanel.appendChild(header);

            const saveBtn = header.querySelector('#btn-open-save-style-modal');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    this.dropdownPanel.style.display = 'none';
                    this.openSaveModal();
                });
            }

            const grid = document.createElement('div');
            grid.className = 'quick-styles-grid';

            stylesList.forEach(st => {
                const card = document.createElement('div');
                card.className = 'quick-style-card';

                // Önizleme Stilleri
                let previewStyle = `font-family: ${st.fontFamily || 'Times New Roman'}; font-size: 12px;`;
                if (st.bold) previewStyle += 'font-weight: 700;';
                if (st.italic) previewStyle += 'font-style: italic;';
                if (st.underline) previewStyle += 'text-decoration: underline;';
                if (st.color) previewStyle += `color: ${st.color};`;
                if (st.textAlign) previewStyle += `text-align: ${st.textAlign};`;

                card.innerHTML = `
                    <div class="quick-style-preview" style="${previewStyle}">
                        AaBbCc - Örnek Karar Metni
                    </div>
                    <div class="quick-style-footer">
                        <span class="quick-style-name" title="${st.name}">${st.name}</span>
                        ${!st.isDefault ? `<button type="button" class="quick-style-del-btn" data-id="${st.id}" title="Bu Stili Sil">&times;</button>` : ''}
                    </div>
                `;

                // Tıklanınca Stili Seçili Metne Uygula
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.quick-style-del-btn')) return;
                    this.applyPreset(st);
                    this.dropdownPanel.style.display = 'none';
                });

                // Silme butonu
                const delBtn = card.querySelector('.quick-style-del-btn');
                if (delBtn) {
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deleteStyle(st.id);
                    });
                }

                grid.appendChild(card);
            });

            this.dropdownPanel.appendChild(grid);
        }

        applyPreset(preset) {
            applyFormatToSelection(preset);
            if (typeof window.showToast === 'function') {
                window.showToast(`"${preset.name}" stili uygulandı.`, 'success');
            }
        }

        deleteStyle(styleId) {
            stylesList = stylesList.filter(s => s.id !== styleId);
            saveCustomStyles();
            this.renderStylesList();
            if (typeof window.showToast === 'function') {
                window.showToast('Özel stil silindi.', 'info');
            }
        }

        // Yeni Stil Kaydetme Modalı
        bindSaveModal() {
            const btnSave = document.getElementById('btn-save-custom-style-confirm');
            if (btnSave) {
                btnSave.addEventListener('click', () => {
                    this.confirmSaveCustomStyle();
                });
            }
        }

        openSaveModal() {
            if (!this.modalSaveStyle) return;

            // Seçili metinden mevcut formatı oku ve modal alanlarına doldur
            const currentFmt = copyFormatFromSelection() ? copiedFormat : null;

            const nameInp = document.getElementById('input-style-name');
            const fontSel = document.getElementById('style-font-family');
            const sizeInp = document.getElementById('style-font-size');
            const chkBold = document.getElementById('style-chk-bold');
            const chkItalic = document.getElementById('style-chk-italic');
            const chkUnderline = document.getElementById('style-chk-underline');
            const colorInp = document.getElementById('style-color-picker');
            const alignSel = document.getElementById('style-align-select');

            if (nameInp) nameInp.value = '';

            if (currentFmt) {
                if (fontSel && currentFmt.fontFamily) fontSel.value = currentFmt.fontFamily.replace(/["']/g, '');
                if (sizeInp && currentFmt.fontSize) sizeInp.value = currentFmt.fontSize;
                if (chkBold) chkBold.checked = currentFmt.fontWeight === 'bold' || parseInt(currentFmt.fontWeight, 10) >= 700;
                if (chkItalic) chkItalic.checked = currentFmt.fontStyle === 'italic';
                if (chkUnderline) chkUnderline.checked = (currentFmt.textDecoration || '').includes('underline');
                if (alignSel && currentFmt.textAlign) alignSel.value = currentFmt.textAlign;
            }

            if (typeof window.openModal === 'function') {
                window.openModal(this.modalSaveStyle);
            } else {
                this.modalSaveStyle.style.display = 'flex';
            }
        }

        confirmSaveCustomStyle() {
            const nameInp = document.getElementById('input-style-name');
            const fontSel = document.getElementById('style-font-family');
            const sizeInp = document.getElementById('style-font-size');
            const chkBold = document.getElementById('style-chk-bold');
            const chkItalic = document.getElementById('style-chk-italic');
            const chkUnderline = document.getElementById('style-chk-underline');
            const colorInp = document.getElementById('style-color-picker');
            const alignSel = document.getElementById('style-align-select');

            const name = (nameInp ? nameInp.value.trim() : '') || 'Özel Stil ' + (stylesList.length + 1);

            const newStyle = {
                id: 'custom-style-' + Date.now(),
                name: name,
                isDefault: false,
                fontFamily: fontSel ? fontSel.value : 'Times New Roman',
                fontSize: (sizeInp ? sizeInp.value.trim() : '12pt') || '12pt',
                bold: chkBold ? chkBold.checked : false,
                italic: chkItalic ? chkItalic.checked : false,
                underline: chkUnderline ? chkUnderline.checked : false,
                color: colorInp ? colorInp.value : '#000000',
                backgroundColor: 'transparent',
                textAlign: alignSel ? alignSel.value : 'left',
                lineHeight: '1.15'
            };

            stylesList.push(newStyle);
            saveCustomStyles();

            if (typeof window.closeModal === 'function') {
                window.closeModal(this.modalSaveStyle);
            } else if (this.modalSaveStyle) {
                this.modalSaveStyle.style.display = 'none';
            }

            if (typeof window.showToast === 'function') {
                window.showToast(`"${name}" stili Hızlı Stiller galerisine kaydedildi!`, 'success');
            }
        }
    }

    const controller = new UkiQuickStylesController();
    window.UkiQuickStyles = {
        init: () => controller.init(),
        copyFormat: copyFormatFromSelection,
        applyFormat: applyFormatToSelection,
        applyPreset: (p) => controller.applyPreset(p),
        openSaveModal: () => controller.openSaveModal()
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => controller.init());
    } else {
        controller.init();
    }

})(window, document);

