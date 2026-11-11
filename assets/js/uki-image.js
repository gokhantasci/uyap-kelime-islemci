/**
 * UYAP Kelime İşlemci (UKİ) - Resim Ekleme, Seçme ve Düzenleme Modülü (UkiImage)
 * UYAP Doküman Editörü Grafik / Resim Ekle/Düzenle 1:1 Paritesi
 */
(function(window, document) {
    'use strict';

    let selectedImage = null;
    let overlayEl = null;
    let fileInputEl = null;
    let isReplacing = false;
    let isDragging = false;
    let dragHandle = null;
    let startX = 0, startY = 0, startW = 0, startH = 0, aspectRatio = 1;

    function getEditor() {
        return document.getElementById('editor');
    }

    function triggerChange() {
        if (window.UkiPages && typeof window.UkiPages.repaginate === 'function') {
            window.UkiPages.repaginate();
        }
        if (window.UkiHistory && typeof window.UkiHistory.record === 'function') {
            window.UkiHistory.record();
        }
        try {
            document.dispatchEvent(new (window.Event || Event)('uki-document-change'));
        } catch (e) {}
    }

    function triggerImageAction() {
        if (selectedImage && document.contains(selectedImage)) {
            openEditModal(selectedImage);
        } else {
            openFilePicker(false);
        }
    }

    function openFilePicker(replaceMode = false) {
        isReplacing = replaceMode;
        if (!fileInputEl) {
            fileInputEl = document.createElement('input');
            fileInputEl.type = 'file';
            fileInputEl.accept = 'image/png,image/jpeg,image/jpg,image/gif,image/bmp,image/webp,image/tiff';
            fileInputEl.style.display = 'none';
            document.body.appendChild(fileInputEl);

            fileInputEl.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                handleImageFile(file, isReplacing);
                fileInputEl.value = '';
            });
        }
        fileInputEl.click();
    }

    function handleImageFile(file, replace = false) {
        if (!file || !file.type.startsWith('image/')) {
            if (typeof window.showToast === 'function') {
                window.showToast('Lütfen geçerli bir görsel dosyası seçin (PNG, JPG, BMP vb.)', 'warning');
            }
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            if (replace && selectedImage && document.contains(selectedImage)) {
                selectedImage.src = dataUrl;
                updateOverlayPosition();
                if (typeof window.showToast === 'function') {
                    window.showToast('Görsel başarıyla yenilendi.', 'success');
                }
                triggerChange();
            } else {
                insertImage(dataUrl);
            }
        };
        reader.readAsDataURL(file);
    }

    function insertImage(dataUrlOrFile) {
        if (typeof dataUrlOrFile === 'string') {
            const editor = getEditor();
            if (!editor) return null;

            const img = document.createElement('img');
            img.className = 'udf-img';
            img.src = dataUrlOrFile;
            img.alt = 'Resim';
            img.setAttribute('contenteditable', 'false');
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.display = 'inline-block';
            img.style.verticalAlign = 'middle';
            img.style.margin = '4px 6px';

            // Resim elemanını doğrudan editöre yerleştir
            insertAtCursor(img, editor);
            selectImage(img);
            triggerChange();

            const ImageConstructor = (typeof window !== 'undefined' && window.Image) ? window.Image : (typeof Image !== 'undefined' ? Image : null);
            if (ImageConstructor) {
                const tempImg = new ImageConstructor();
                tempImg.onload = () => {
                    const nw = tempImg.naturalWidth;
                    const nh = tempImg.naturalHeight;
                    if (nw > 540) {
                        const ratio = 540 / nw;
                        img.style.width = '540px';
                        img.style.height = Math.round(nh * ratio) + 'px';
                    } else if (nw > 0) {
                        img.style.width = nw + 'px';
                        img.style.height = nh + 'px';
                    }
                    updateOverlayPosition();
                    triggerChange();
                };
                tempImg.src = dataUrlOrFile;
            }
            if (typeof window.showToast === 'function') {
                window.showToast('Resim eklendi. Boyutlandırmak için köşelerinden sürükleyin veya çift tıklayın.', 'success');
            }
            return img;
        } else if (dataUrlOrFile instanceof File || dataUrlOrFile instanceof Blob) {
            handleImageFile(dataUrlOrFile, false);
            return null;
        }
    }

    function insertAtCursor(node, editor) {
        editor.focus();
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            let range = sel.getRangeAt(0);
            if (!editor.contains(range.commonAncestorContainer)) {
                let targetP = editor.querySelector('p');
                if (!targetP) {
                    targetP = document.createElement('p');
                    editor.appendChild(targetP);
                }
                targetP.appendChild(node);
                return;
            }
            range.deleteContents();
            range.insertNode(node);

            const newRange = document.createRange();
            newRange.setStartAfter(node);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
        } else {
            let targetP = editor.querySelector('p');
            if (!targetP) {
                targetP = document.createElement('p');
                editor.appendChild(targetP);
            }
            targetP.appendChild(node);
        }
    }

    function selectImage(img) {
        if (!img) return;
        deselectImage();
        selectedImage = img;
        img.classList.add('udf-img-selected');
        createOverlay(img);
    }

    function deselectImage() {
        if (selectedImage) {
            selectedImage.classList.remove('udf-img-selected');
            selectedImage = null;
        }
        removeOverlay();
    }

    function removeOverlay() {
        if (overlayEl) {
            overlayEl.remove();
            overlayEl = null;
        }
    }

    function createOverlay(img) {
        removeOverlay();
        if (!img || !document.contains(img)) return;

        const container = document.getElementById('page-wrapper') || document.body;

        overlayEl = document.createElement('div');
        overlayEl.className = 'uki-img-overlay';

        // 8 Boyutlandırma Kulpu (Resize Handles)
        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        handles.forEach((pos) => {
            const h = document.createElement('div');
            h.className = `img-handle img-handle-${pos}`;
            h.dataset.handle = pos;
            overlayEl.appendChild(h);
        });

        // Üst Kayan Araç Çubuğu (Floating Toolbar)
        const toolbar = document.createElement('div');
        toolbar.className = 'uki-img-toolbar';
        toolbar.innerHTML = `
            <button type="button" class="img-pill-btn btn-pill-edit" title="Resim Özellikleri &amp; Düzenle">📐 Düzenle</button>
            <button type="button" class="img-pill-btn btn-pill-replace" title="Resmi Başka Bir Dosyayla Değiştir">🔄 Değiştir</button>
            <button type="button" class="img-pill-btn btn-pill-delete" title="Resmi Belgeden Sil (Delete)">🗑️ Sil</button>
        `;
        overlayEl.appendChild(toolbar);

        toolbar.querySelector('.btn-pill-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(selectedImage);
        });
        toolbar.querySelector('.btn-pill-replace').addEventListener('click', (e) => {
            e.stopPropagation();
            openFilePicker(true);
        });
        toolbar.querySelector('.btn-pill-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSelectedImage();
        });

        container.appendChild(overlayEl);
        updateOverlayPosition();
        bindOverlayEvents();
    }

    function updateOverlayPosition() {
        if (!overlayEl || !selectedImage || !document.contains(selectedImage)) {
            removeOverlay();
            return;
        }
        const container = document.getElementById('page-wrapper') || document.body;
        const cRect = container.getBoundingClientRect();
        const iRect = selectedImage.getBoundingClientRect();

        const top = iRect.top - cRect.top + container.scrollTop;
        const left = iRect.left - cRect.left + container.scrollLeft;
        const width = iRect.width;
        const height = iRect.height;

        overlayEl.style.top = top + 'px';
        overlayEl.style.left = left + 'px';
        overlayEl.style.width = width + 'px';
        overlayEl.style.height = height + 'px';
    }

    function bindOverlayEvents() {
        if (!overlayEl) return;
        const handles = overlayEl.querySelectorAll('.img-handle');
        handles.forEach((h) => {
            h.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                isDragging = true;
                dragHandle = h.dataset.handle;
                startX = e.clientX;
                startY = e.clientY;
                startW = selectedImage.offsetWidth || selectedImage.naturalWidth || 100;
                startH = selectedImage.offsetHeight || selectedImage.naturalHeight || 100;
                aspectRatio = startW / (startH || 1);

                const onMouseMove = (ev) => {
                    if (!isDragging || !selectedImage) return;
                    ev.preventDefault();
                    const dx = ev.clientX - startX;
                    const dy = ev.clientY - startY;

                    let newW = startW;
                    let newH = startH;

                    if (dragHandle === 'se' || dragHandle === 'e') {
                        newW = Math.max(30, startW + dx);
                        newH = Math.round(newW / aspectRatio);
                    } else if (dragHandle === 's') {
                        newH = Math.max(30, startH + dy);
                        newW = Math.round(newH * aspectRatio);
                    } else if (dragHandle === 'sw' || dragHandle === 'w') {
                        newW = Math.max(30, startW - dx);
                        newH = Math.round(newW / aspectRatio);
                    } else if (dragHandle === 'ne') {
                        newW = Math.max(30, startW + dx);
                        newH = Math.round(newW / aspectRatio);
                    } else if (dragHandle === 'nw' || dragHandle === 'n') {
                        newW = Math.max(30, startW - dx);
                        newH = Math.round(newW / aspectRatio);
                    }

                    selectedImage.style.width = newW + 'px';
                    selectedImage.style.height = newH + 'px';
                    updateOverlayPosition();
                };

                const onMouseUp = () => {
                    if (isDragging) {
                        isDragging = false;
                        dragHandle = null;
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        triggerChange();
                    }
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    }

    function deleteSelectedImage() {
        if (!selectedImage) return;
        const img = selectedImage;
        deselectImage();
        img.remove();
        triggerChange();
        if (typeof window.showToast === 'function') {
            window.showToast('Resim silindi.', 'info');
        }
    }

    // =========================================================================
    // RESİM ÖZELLİKLERİ & DÜZENLEME MODAL DİYALOĞU
    // =========================================================================
    function openEditModal(img) {
        if (!img) return;
        selectedImage = img;
        const modal = document.getElementById('modal-image-edit');
        if (!modal) return;

        // Modal Alanlarını Doldur
        const preview = document.getElementById('img-edit-preview');
        const infoDim = document.getElementById('img-edit-info-dim');
        const inputW = document.getElementById('img-edit-width');
        const inputH = document.getElementById('img-edit-height');
        const lockAspect = document.getElementById('img-edit-aspect-lock');
        const alignSelect = document.getElementById('img-edit-align');
        const borderW = document.getElementById('img-edit-border-w');
        const borderStyle = document.getElementById('img-edit-border-style');
        const borderColor = document.getElementById('img-edit-border-color');
        const borderRadius = document.getElementById('img-edit-border-radius');
        const chkGrayscale = document.getElementById('img-edit-grayscale');

        if (preview) preview.src = img.src;
        const curW = parseInt(img.style.width, 10) || img.offsetWidth || img.naturalWidth || 300;
        const curH = parseInt(img.style.height, 10) || img.offsetHeight || img.naturalHeight || 200;

        if (infoDim) {
            infoDim.textContent = `Doğal Boyut: ${img.naturalWidth || curW} × ${img.naturalHeight || curH} px`;
        }
        if (inputW) inputW.value = curW;
        if (inputH) inputH.value = curH;
        if (lockAspect) lockAspect.checked = true;

        // Oran kilidi dinleyicisi
        if (inputW && inputH) {
            const aspect = (img.naturalWidth && img.naturalHeight) ? (img.naturalWidth / img.naturalHeight) : (curW / (curH || 1));
            inputW.oninput = () => {
                if (lockAspect && lockAspect.checked) {
                    const wVal = parseFloat(inputW.value) || 0;
                    inputH.value = Math.round(wVal / aspect);
                }
            };
            inputH.oninput = () => {
                if (lockAspect && lockAspect.checked) {
                    const hVal = parseFloat(inputH.value) || 0;
                    inputW.value = Math.round(hVal * aspect);
                }
            };
        }

        // Hizalama
        if (alignSelect) {
            if (img.style.float === 'left') {
                alignSelect.value = 'left';
            } else if (img.style.float === 'right') {
                alignSelect.value = 'right';
            } else if (img.style.display === 'block' && img.style.margin && img.style.margin.includes('auto')) {
                alignSelect.value = 'center';
            } else {
                alignSelect.value = 'inline';
            }
        }

        // Kenarlık
        if (borderW) {
            const bw = parseInt(img.style.borderWidth, 10) || 0;
            borderW.value = String(bw);
        }
        if (borderStyle) {
            borderStyle.value = img.style.borderStyle || 'solid';
        }
        if (borderColor) {
            borderColor.value = '#000000';
        }
        if (borderRadius) {
            borderRadius.value = parseInt(img.style.borderRadius, 10) || 0;
        }

        // Filtreler
        if (chkGrayscale) {
            chkGrayscale.checked = (img.style.filter && img.style.filter.includes('grayscale'));
        }

        modal.style.display = 'flex';
    }

    function closeEditModal() {
        const modal = document.getElementById('modal-image-edit');
        if (modal) modal.style.display = 'none';
    }

    function applyEditModalChanges() {
        if (!selectedImage) {
            closeEditModal();
            return;
        }
        const img = selectedImage;
        const inputW = document.getElementById('img-edit-width');
        const inputH = document.getElementById('img-edit-height');
        const alignSelect = document.getElementById('img-edit-align');
        const borderW = document.getElementById('img-edit-border-w');
        const borderStyle = document.getElementById('img-edit-border-style');
        const borderColor = document.getElementById('img-edit-border-color');
        const borderRadius = document.getElementById('img-edit-border-radius');
        const chkGrayscale = document.getElementById('img-edit-grayscale');

        if (inputW && inputW.value) img.style.width = parseInt(inputW.value, 10) + 'px';
        if (inputH && inputH.value) img.style.height = parseInt(inputH.value, 10) + 'px';

        if (alignSelect) {
            const align = alignSelect.value;
            if (align === 'left') {
                img.style.display = 'block';
                img.style.float = 'left';
                img.style.margin = '4px 14px 4px 0';
            } else if (align === 'right') {
                img.style.display = 'block';
                img.style.float = 'right';
                img.style.margin = '4px 0 4px 14px';
            } else if (align === 'center') {
                img.style.display = 'block';
                img.style.float = 'none';
                img.style.margin = '8px auto';
            } else {
                img.style.display = 'inline-block';
                img.style.float = 'none';
                img.style.verticalAlign = 'middle';
                img.style.margin = '4px 6px';
            }
        }

        if (borderW) {
            const bw = parseInt(borderW.value, 10);
            if (bw > 0) {
                img.style.borderWidth = bw + 'px';
                img.style.borderStyle = borderStyle ? borderStyle.value : 'solid';
                img.style.borderColor = borderColor ? borderColor.value : '#000000';
            } else {
                img.style.border = 'none';
            }
        }

        if (borderRadius) {
            const br = parseInt(borderRadius.value, 10);
            img.style.borderRadius = br > 0 ? (br + 'px') : '0';
        }

        if (chkGrayscale) {
            if (chkGrayscale.checked) {
                img.style.filter = 'grayscale(100%)';
            } else {
                img.style.filter = '';
            }
        }

        closeEditModal();
        updateOverlayPosition();
        triggerChange();
        if (typeof window.showToast === 'function') {
            window.showToast('Resim özellikleri güncellendi.', 'success');
        }
    }

    // =========================================================================
    // GRAFİK GRUBU EK ARAÇLARI: SEMBOL, BARKOD, KÖPRÜ
    // =========================================================================
    function openSymbolPicker() {
        const modal = document.getElementById('modal-symbol-picker');
        if (modal) modal.style.display = 'flex';
    }

    function insertSymbol(sym) {
        const editor = getEditor();
        if (!editor || !sym) return;
        editor.focus();
        const span = document.createElement('span');
        span.textContent = sym;
        insertAtCursor(span, editor);
        triggerChange();
        const modal = document.getElementById('modal-symbol-picker');
        if (modal) modal.style.display = 'none';
    }

    function openBarcodeModal() {
        const modal = document.getElementById('modal-barcode-insert');
        if (modal) modal.style.display = 'flex';
    }

    function insertBarcode(barcodeNum) {
        const editor = getEditor();
        if (!editor) return;
        const code = (barcodeNum || '').trim();
        if (!code) {
            if (typeof window.showToast === 'function') window.showToast('Lütfen geçerli bir barkod numarası girin.', 'warning');
            return;
        }

        const bcodeSpan = document.createElement('span');
        bcodeSpan.className = 'udf-barcode';
        bcodeSpan.setAttribute('data-barcode', code);
        bcodeSpan.setAttribute('contenteditable', 'false');
        bcodeSpan.style.cssText = 'display:inline-block;margin:4pt 0;line-height:1;user-select:none;vertical-align:middle;';
        
        if (window.UkiCore && typeof window.UkiCore.generateBarcodeSvg === 'function') {
            bcodeSpan.innerHTML = window.UkiCore.generateBarcodeSvg(code, 44);
        } else {
            bcodeSpan.innerHTML = `<span style="font-family:monospace;letter-spacing:2px;padding:4px 8px;border:1px solid #000;background:#fff;">||| ${code} |||</span>`;
        }

        insertAtCursor(bcodeSpan, editor);
        triggerChange();
        const modal = document.getElementById('modal-barcode-insert');
        if (modal) modal.style.display = 'none';
        if (typeof window.showToast === 'function') window.showToast('Barkod eklendi.', 'success');
    }

    function openLinkModal() {
        const url = prompt('Köprü Adresini Girin (URL):', 'https://');
        if (!url || url.trim() === '' || url === 'https://') return;
        const text = prompt('Görüntülenecek Metin (Boş bırakırsanız URL kullanılır):', '') || url;
        
        const editor = getEditor();
        if (!editor) return;
        const a = document.createElement('a');
        a.href = url.trim();
        a.textContent = text;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.color = '#1e40af';
        a.style.textDecoration = 'underline';
        insertAtCursor(a, editor);
        triggerChange();
    }

    // =========================================================================
    // BAŞLATMA VE OLAY DİNLEYİCİLERİ
    // =========================================================================
    function init() {
        const editor = getEditor();
        if (!editor) return;

        // Editör içindeki resimlere tıklama ve çift tıklama
        editor.addEventListener('click', (e) => {
            if (e.target && e.target.classList && e.target.classList.contains('udf-img')) {
                e.stopPropagation();
                selectImage(e.target);
            } else if (!e.target.closest('.uki-img-overlay')) {
                deselectImage();
            }
        });

        editor.addEventListener('dblclick', (e) => {
            if (e.target && e.target.classList && e.target.classList.contains('udf-img')) {
                e.stopPropagation();
                openEditModal(e.target);
            }
        });

        // Dışarı tıklandığında seçimi kaldır
        document.addEventListener('click', (e) => {
            if (overlayEl && overlayEl.contains(e.target)) return;
            if (e.target && e.target.classList && e.target.classList.contains('udf-img')) return;
            deselectImage();
        });

        // Delete / Backspace tuşu ile resmi silme
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImage) {
                // Eğer odak bir input veya textarea içinde değilse
                const active = document.activeElement;
                if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
                    // editörün kendisi değilse ve imleç metindeyse
                    if (active !== editor && active.tagName !== 'BODY') return;
                }
                e.preventDefault();
                deleteSelectedImage();
            }
        });

        // Pano (Clipboard) Resim Yapıştırma Desteği (Ctrl+V)
        editor.addEventListener('paste', (e) => {
            if (!e.clipboardData || !e.clipboardData.items) return;
            for (let i = 0; i < e.clipboardData.items.length; i++) {
                const item = e.clipboardData.items[i];
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    if (blob) {
                        e.preventDefault();
                        handleImageFile(blob, false);
                        break;
                    }
                }
            }
        });

        // Sürükle - Bırak (Drag & Drop) ile Resim Ekleme
        editor.addEventListener('dragover', (e) => {
            if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
                e.preventDefault();
            }
        });
        editor.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type && file.type.startsWith('image/')) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleImageFile(file, false);
                }
            }
        });

        // Sayfa kaydırma veya pencere boyutu değiştiğinde kulp konumunu güncelle
        window.addEventListener('resize', updateOverlayPosition);
        window.addEventListener('scroll', updateOverlayPosition, true);

        // Araç çubuğu buton bağlama
        const btnInsertImage = document.getElementById('btn-insert-image');
        if (btnInsertImage) {
            btnInsertImage.addEventListener('click', triggerImageAction);
        }

        const btnInsertBg = document.getElementById('btn-insert-bg-image');
        if (btnInsertBg) {
            btnInsertBg.addEventListener('click', () => {
                const antetBtn = document.getElementById('btn-antet-setup');
                if (antetBtn) antetBtn.click();
            });
        }

        const btnInsertSymbol = document.getElementById('btn-insert-symbol');
        if (btnInsertSymbol) {
            btnInsertSymbol.addEventListener('click', openSymbolPicker);
        }

        const btnInsertBarcode = document.getElementById('btn-insert-barcode');
        if (btnInsertBarcode) {
            btnInsertBarcode.addEventListener('click', openBarcodeModal);
        }

        const btnInsertLink = document.getElementById('btn-insert-link');
        if (btnInsertLink) {
            btnInsertLink.addEventListener('click', openLinkModal);
        }

        // Resim Düzenleme Modal Butonları
        const btnSaveImgEdit = document.getElementById('btn-save-image-edit');
        if (btnSaveImgEdit) btnSaveImgEdit.addEventListener('click', applyEditModalChanges);

        const btnModalReplace = document.getElementById('btn-img-modal-replace');
        if (btnModalReplace) {
            btnModalReplace.addEventListener('click', () => {
                closeEditModal();
                openFilePicker(true);
            });
        }

        const btnModalDelete = document.getElementById('btn-img-modal-delete');
        if (btnModalDelete) {
            btnModalDelete.addEventListener('click', () => {
                closeEditModal();
                deleteSelectedImage();
            });
        }

        // Hızlı Ölçek Butonları
        bindScaleBtn('btn-img-scale-25', 0.25);
        bindScaleBtn('btn-img-scale-50', 0.50);
        bindScaleBtn('btn-img-scale-75', 0.75);
        bindScaleBtn('btn-img-scale-100', 1.00);
        
        const btnScaleFit = document.getElementById('btn-img-scale-fit');
        if (btnScaleFit) {
            btnScaleFit.addEventListener('click', () => {
                if (!selectedImage) return;
                const inputW = document.getElementById('img-edit-width');
                const inputH = document.getElementById('img-edit-height');
                const nw = selectedImage.naturalWidth || 600;
                const nh = selectedImage.naturalHeight || 400;
                const fitW = 540;
                const fitH = Math.round(nh * (fitW / nw));
                if (inputW) inputW.value = fitW;
                if (inputH) inputH.value = fitH;
            });
        }

        // 90 Derece Döndürme
        const btnRotate = document.getElementById('btn-img-rotate-90');
        if (btnRotate) {
            btnRotate.addEventListener('click', () => {
                if (!selectedImage) return;
                const curRot = parseInt(selectedImage.dataset.rotation || '0', 10);
                const nextRot = (curRot + 90) % 360;
                selectedImage.dataset.rotation = nextRot;
                selectedImage.style.transform = `rotate(${nextRot}deg)`;
                updateOverlayPosition();
            });
        }
    }

    function bindScaleBtn(btnId, factor) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (!selectedImage) return;
            const inputW = document.getElementById('img-edit-width');
            const inputH = document.getElementById('img-edit-height');
            const nw = selectedImage.naturalWidth || 400;
            const nh = selectedImage.naturalHeight || 300;
            const targetW = Math.round(nw * factor);
            const targetH = Math.round(nh * factor);
            if (inputW) inputW.value = targetW;
            if (inputH) inputH.value = targetH;
        });
    }

    window.UkiImage = {
        init,
        triggerImageAction,
        openFilePicker,
        insertImage,
        selectImage,
        deselectImage,
        deleteSelectedImage,
        openEditModal,
        closeEditModal,
        applyEditModalChanges,
        openSymbolPicker,
        insertSymbol,
        openBarcodeModal,
        insertBarcode,
        openLinkModal,
        getSelectedImage: () => selectedImage
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document);
