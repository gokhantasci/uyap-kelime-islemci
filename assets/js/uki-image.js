/**
 * UYAP Kelime İşlemci (UKİ) - Resim Ekleme, Seçme ve Düzenleme Modülü (UkiImage)
 * UYAP Doküman Editörü Grafik / Resim Ekle/Düzenle 1:1 Paritesi
 */
(function(window, document) {
    'use strict';

    let selectedImage = null;
    let editingImage = null;
    let modalRotation = 0;
    let overlayEl = null;
    let fileInputEl = null;
    let isReplacing = false;
    let isDragging = false;
    let dragHandle = null;
    let startX = 0, startY = 0, startW = 0, startH = 0, aspectRatio = 1;
    let imageObserver = null;

    function getEditor() {
        return document.getElementById('editor');
    }

    function getScale() {
        const editor = getEditor();
        if (!editor || !editor.offsetWidth) return 1;
        const rect = editor.getBoundingClientRect();
        return (rect.width / editor.offsetWidth) || 1;
    }

    function getContainer() {
        const pw = document.getElementById('page-wrapper');
        if (pw) {
            pw.style.position = 'relative';
        }
        const ed = getEditor();
        if (ed) {
            ed.style.position = 'relative';
            return ed;
        }
        if (pw) return pw;
        return document.body;
    }

    /**
     * Resmi HTML5 Canvas üzerinden hedef piksel boyutlarına (en çok 540x750)
     * ve döndürme/gri tonlama değerine göre fiziksel olarak yeniden rasterize eder.
     * Bu sayede dışa aktarılan UDF dosyasındaki imageData (Base64), UYAP masaüstü
     * editöründe tam olarak bu boyutta ve açıda açılır.
     */
    function rescaleImageBitmap(img, targetW, targetH, rotationDeg = 0, isGrayscale = false) {
        return new Promise((resolve) => {
            if (!img || !img.src) {
                resolve(null);
                return;
            }
            try {
                // JSDOM veya canvas desteklenmeyen ortam kontrolü
                if (typeof window !== 'undefined' && window.navigator && window.navigator.userAgent && window.navigator.userAgent.includes('jsdom')) {
                    resolve(img.src);
                    return;
                }
                const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
                const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
                if (!canvas || !ctx) {
                    resolve(img.src);
                    return;
                }
                const ImageConstructor = (typeof window !== 'undefined' && window.Image) ? window.Image : (typeof Image !== 'undefined' ? Image : null);
                if (!ImageConstructor) {
                    resolve(img.src);
                    return;
                }
                const source = new ImageConstructor();
                source.crossOrigin = 'anonymous';
                source.onload = () => {
                    const rot = (rotationDeg % 360 + 360) % 360;
                    const isRot90 = rot === 90 || rot === 270;

                    const finalW = Math.max(30, Math.min(540, Math.round(targetW || img.offsetWidth || img.naturalWidth || 540)));
                    const finalH = Math.max(30, Math.min(750, Math.round(targetH || img.offsetHeight || img.naturalHeight || 405)));

                    canvas.width = finalW;
                    canvas.height = finalH;

                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    ctx.save();
                    ctx.translate(finalW / 2, finalH / 2);
                    if (rot !== 0) {
                        ctx.rotate((rot * Math.PI) / 180);
                    }
                    const drawW = isRot90 ? finalH : finalW;
                    const drawH = isRot90 ? finalW : finalH;
                    if (isGrayscale) {
                        ctx.filter = 'grayscale(100%)';
                    }
                    ctx.drawImage(source, -drawW / 2, -drawH / 2, drawW, drawH);
                    ctx.restore();

                    try {
                        const newSrc = canvas.toDataURL('image/png');
                        img.src = newSrc;
                        resolve(newSrc);
                    } catch (e) {
                        resolve(img.src);
                    }
                };
                source.onerror = () => resolve(img.src);
                source.src = img.src;
            } catch (e) {
                resolve(img.src);
            }
        });
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
            const targetImg = editingImage || selectedImage;
            if (replace && targetImg && document.contains(targetImg)) {
                targetImg.src = dataUrl;
                const preview = document.getElementById('img-edit-preview');
                if (preview) preview.src = dataUrl;

                const ImageConstructor = (typeof window !== 'undefined' && window.Image) ? window.Image : (typeof Image !== 'undefined' ? Image : null);
                if (ImageConstructor) {
                    const temp = new ImageConstructor();
                    temp.onload = () => {
                        const nw = temp.naturalWidth;
                        const nh = temp.naturalHeight;
                        const inputW = document.getElementById('img-edit-width');
                        const inputH = document.getElementById('img-edit-height');
                        if (inputW && inputH && nw && nh) {
                            const curW = nw > 540 ? 540 : nw;
                            const curH = nw > 540 ? Math.round(nh * (540 / nw)) : nh;
                            inputW.value = curW;
                            inputH.value = curH;
                            targetImg.style.width = curW + 'px';
                            targetImg.style.height = curH + 'px';
                            targetImg.setAttribute('width', String(curW));
                            targetImg.setAttribute('height', String(curH));
                        }
                        updateModalPreview();
                        updateOverlayPosition();
                        triggerChange();
                    };
                    temp.src = dataUrl;
                } else {
                    updateModalPreview();
                    updateOverlayPosition();
                    triggerChange();
                }

                if (typeof window.showToast === 'function') {
                    window.showToast('Görsel başarıyla yenilendi.', 'success');
                }
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
                    let curW = nw;
                    let curH = nh;
                    if (nw > 540) {
                        const ratio = 540 / nw;
                        curW = 540;
                        curH = Math.round(nh * ratio);
                    }
                    if (curH > 750) {
                        const ratio = 750 / curH;
                        curH = 750;
                        curW = Math.round(curW * ratio);
                    }
                    if (curW > 0 && curH > 0) {
                        img.style.width = curW + 'px';
                        img.style.height = curH + 'px';
                        img.setAttribute('width', String(curW));
                        img.setAttribute('height', String(curH));
                        rescaleImageBitmap(img, curW, curH).then(() => {
                            updateOverlayPosition();
                            triggerChange();
                        });
                    } else {
                        updateOverlayPosition();
                        triggerChange();
                    }
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

        if (typeof window !== 'undefined' && window.ResizeObserver) {
            try {
                imageObserver = new window.ResizeObserver(() => {
                    if (selectedImage) updateOverlayPosition();
                });
                imageObserver.observe(img);
            } catch (e) {}
        }
    }

    function deselectImage() {
        if (imageObserver) {
            imageObserver.disconnect();
            imageObserver = null;
        }
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

        const container = getContainer();

        overlayEl = document.createElement('div');
        overlayEl.className = 'uki-img-overlay';
        overlayEl.setAttribute('contenteditable', 'false');
        overlayEl.setAttribute('aria-hidden', 'true');

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
        const container = getContainer();
        const cRect = container.getBoundingClientRect();
        const iRect = selectedImage.getBoundingClientRect();
        const scale = getScale();

        const top = (iRect.top - cRect.top + (container.scrollTop || 0)) / scale;
        const left = (iRect.left - cRect.left + (container.scrollLeft || 0)) / scale;
        const width = iRect.width / scale;
        const height = iRect.height / scale;

        overlayEl.style.top = Math.round(top) + 'px';
        overlayEl.style.left = Math.round(left) + 'px';
        overlayEl.style.width = Math.round(width) + 'px';
        overlayEl.style.height = Math.round(height) + 'px';
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
                const scale = getScale();

                const onMouseMove = (ev) => {
                    if (!isDragging || !selectedImage) return;
                    ev.preventDefault();
                    const dx = (ev.clientX - startX) / scale;
                    const dy = (ev.clientY - startY) / scale;

                    let newW = startW;
                    let newH = startH;

                    if (dragHandle === 'se' || dragHandle === 'e') {
                        newW = startW + dx;
                        newH = Math.round(newW / aspectRatio);
                    } else if (dragHandle === 's') {
                        newH = startH + dy;
                        newW = Math.round(newH * aspectRatio);
                    } else if (dragHandle === 'sw' || dragHandle === 'w') {
                        newW = startW - dx;
                        newH = Math.round(newW / aspectRatio);
                    } else if (dragHandle === 'ne') {
                        newW = startW + dx;
                        newH = Math.round(newW / aspectRatio);
                    } else if (dragHandle === 'nw' || dragHandle === 'n') {
                        newW = startW - dx;
                        newH = Math.round(newW / aspectRatio);
                    }

                    // A4 Sayfa sınırları koruması (Maksimum 540px genişlik, 750px yükseklik, minimum 30px)
                    if (newW > 540) {
                        newW = 540;
                        newH = Math.round(540 / aspectRatio);
                    }
                    if (newH > 750) {
                        newH = 750;
                        newW = Math.round(750 * aspectRatio);
                    }
                    newW = Math.max(30, Math.min(540, Math.round(newW)));
                    newH = Math.max(30, Math.min(750, Math.round(newH)));

                    selectedImage.style.width = newW + 'px';
                    selectedImage.style.height = newH + 'px';
                    selectedImage.setAttribute('width', String(newW));
                    selectedImage.setAttribute('height', String(newH));
                    updateOverlayPosition();
                };

                const onMouseUp = () => {
                    if (isDragging) {
                        isDragging = false;
                        dragHandle = null;
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);

                        const finalW = parseInt(selectedImage.style.width, 10) || selectedImage.offsetWidth || 540;
                        const finalH = parseInt(selectedImage.style.height, 10) || selectedImage.offsetHeight || 405;

                        rescaleImageBitmap(selectedImage, finalW, finalH).then(() => {
                            updateOverlayPosition();
                            triggerChange();
                        });
                    }
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    }

    function deleteSelectedImage() {
        const img = editingImage || selectedImage;
        if (!img) return;
        editingImage = null;
        deselectImage();
        img.remove();
        closeEditModal();
        triggerChange();
        if (typeof window.showToast === 'function') {
            window.showToast('Resim silindi.', 'info');
        }
    }

    // =========================================================================
    // RESİM ÖZELLİKLERİ & DÜZENLEME MODAL DİYALOĞU
    // =========================================================================
    function getModalAspect() {
        const img = editingImage || selectedImage;
        if (img && img.naturalWidth && img.naturalHeight) {
            return img.naturalWidth / img.naturalHeight;
        }
        const inputW = document.getElementById('img-edit-width');
        const inputH = document.getElementById('img-edit-height');
        const w = parseFloat(inputW ? inputW.value : 0) || 1;
        const h = parseFloat(inputH ? inputH.value : 0) || 1;
        return w / h;
    }

    function updateModalPreview() {
        const preview = document.getElementById('img-edit-preview');
        const infoDim = document.getElementById('img-edit-info-dim');
        const inputW = document.getElementById('img-edit-width');
        const inputH = document.getElementById('img-edit-height');
        const borderW = document.getElementById('img-edit-border-w');
        const borderStyle = document.getElementById('img-edit-border-style');
        const borderRadius = document.getElementById('img-edit-border-radius');
        const chkGrayscale = document.getElementById('img-edit-grayscale');

        const img = editingImage || selectedImage;
        const natW = img ? (img.naturalWidth || parseInt(img.style.width, 10) || 0) : 0;
        const natH = img ? (img.naturalHeight || parseInt(img.style.height, 10) || 0) : 0;
        const wVal = parseInt(inputW ? inputW.value : 0, 10) || natW;
        const hVal = parseInt(inputH ? inputH.value : 0, 10) || natH;

        if (infoDim) {
            const natStr = (natW && natH) ? `Doğal: ${natW} × ${natH} px` : '';
            const selStr = `Seçili: ${wVal} × ${hVal} px`;
            const rotStr = modalRotation ? ` • ${modalRotation}°` : '';
            infoDim.textContent = natStr ? `${natStr} (${selStr}${rotStr})` : `${selStr}${rotStr}`;
        }

        if (preview) {
            // Siyah-Beyaz Filtre
            if (chkGrayscale && chkGrayscale.checked) {
                preview.style.filter = 'grayscale(100%)';
            } else {
                preview.style.filter = 'none';
            }

            // Kenarlık
            const bw = parseInt(borderW ? borderW.value : 0, 10) || 0;
            const bs = borderStyle ? borderStyle.value : 'solid';
            if (bw > 0) {
                preview.style.border = `${bw}px ${bs} #1e293b`;
            } else {
                preview.style.border = 'none';
            }

            // Köşe Yuvarlaklığı
            const br = parseInt(borderRadius ? borderRadius.value : 0, 10) || 0;
            preview.style.borderRadius = br > 0 ? (br + 'px') : '0';

            // Döndürme
            preview.style.transform = modalRotation ? `rotate(${modalRotation}deg)` : 'none';
            preview.style.transition = 'transform 0.2s ease, filter 0.15s ease';
        }
    }

    function applyModalScale(factor) {
        const img = editingImage || selectedImage;
        if (!img) return;
        const inputW = document.getElementById('img-edit-width');
        const inputH = document.getElementById('img-edit-height');
        const curW = parseInt(inputW ? inputW.value : 0, 10) || parseInt(img.style.width, 10) || img.offsetWidth || 400;
        const curH = parseInt(inputH ? inputH.value : 0, 10) || parseInt(img.style.height, 10) || img.offsetHeight || 300;
        const nw = img.naturalWidth || curW;
        const nh = img.naturalHeight || curH;
        if (inputW) inputW.value = Math.max(20, Math.round(nw * factor));
        if (inputH) inputH.value = Math.max(20, Math.round(nh * factor));
        updateModalPreview();
    }

    function rotateModalImage() {
        modalRotation = (modalRotation + 90) % 360;
        updateModalPreview();
    }

    function openEditModal(img) {
        if (!img && selectedImage) img = selectedImage;
        if (!img) return;
        editingImage = img;
        selectedImage = img;
        const modal = document.getElementById('modal-image-edit');
        if (!modal) return;

        modalRotation = parseInt(img.dataset.rotation || '0', 10);

        // Modal Alanlarını Doldur
        const preview = document.getElementById('img-edit-preview');
        const infoDim = document.getElementById('img-edit-info-dim');
        const inputW = document.getElementById('img-edit-width');
        const inputH = document.getElementById('img-edit-height');
        const lockAspect = document.getElementById('img-edit-aspect-lock');
        const alignSelect = document.getElementById('img-edit-align');
        const borderW = document.getElementById('img-edit-border-w');
        const borderStyle = document.getElementById('img-edit-border-style');
        const borderRadius = document.getElementById('img-edit-border-radius');
        const chkGrayscale = document.getElementById('img-edit-grayscale');

        if (preview) preview.src = img.src;
        const curW = parseInt(img.style.width, 10) || img.offsetWidth || img.naturalWidth || 300;
        const curH = parseInt(img.style.height, 10) || img.offsetHeight || img.naturalHeight || 200;

        if (inputW) inputW.value = curW;
        if (inputH) inputH.value = curH;
        if (lockAspect) lockAspect.checked = true;

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
        if (borderRadius) {
            borderRadius.value = String(parseInt(img.style.borderRadius, 10) || 0);
        }

        // Filtreler
        if (chkGrayscale) {
            chkGrayscale.checked = !!(img.style.filter && img.style.filter.includes('grayscale'));
        }

        updateModalPreview();

        modal.style.display = 'flex';
    }

    function closeEditModal() {
        const modal = document.getElementById('modal-image-edit');
        if (modal) modal.style.display = 'none';
        editingImage = null;
    }

    function applyEditModalChanges() {
        const img = editingImage || selectedImage;
        if (!img) {
            closeEditModal();
            return;
        }

        const inputW = document.getElementById('img-edit-width');
        const inputH = document.getElementById('img-edit-height');
        const alignSelect = document.getElementById('img-edit-align');
        const borderW = document.getElementById('img-edit-border-w');
        const borderStyle = document.getElementById('img-edit-border-style');
        const borderRadius = document.getElementById('img-edit-border-radius');
        const chkGrayscale = document.getElementById('img-edit-grayscale');

        let newW = parseInt(inputW ? inputW.value : 0, 10) || img.offsetWidth || img.naturalWidth || 300;
        let newH = parseInt(inputH ? inputH.value : 0, 10) || img.offsetHeight || img.naturalHeight || 200;

        // Sayfa sınırları koruması (Max 540px genişlik, 750px yükseklik, min 30px)
        if (newW > 540) {
            const ratio = newH / newW;
            newW = 540;
            newH = Math.round(540 * ratio);
        }
        if (newH > 750) {
            const ratio = newW / newH;
            newH = 750;
            newW = Math.round(750 * ratio);
        }
        newW = Math.max(30, newW);
        newH = Math.max(30, newH);

        const isGray = chkGrayscale ? chkGrayscale.checked : false;

        // Senkron DOM güncellemeleri
        img.style.width = newW + 'px';
        img.style.height = newH + 'px';
        img.style.maxWidth = '100%';
        img.style.maxHeight = '750px';
        img.style.objectFit = 'contain';
        img.setAttribute('width', String(newW));
        img.setAttribute('height', String(newH));

        if (alignSelect) {
            const align = alignSelect.value;
            if (align === 'left') {
                img.style.display = 'block';
                img.style.float = 'left';
                img.style.margin = '4px 16px 4px 0';
                img.style.verticalAlign = 'baseline';
            } else if (align === 'right') {
                img.style.display = 'block';
                img.style.float = 'right';
                img.style.margin = '4px 0 4px 16px';
                img.style.verticalAlign = 'baseline';
            } else if (align === 'center') {
                img.style.display = 'block';
                img.style.float = 'none';
                img.style.margin = '10px auto';
                img.style.verticalAlign = 'baseline';
            } else {
                img.style.display = 'inline-block';
                img.style.float = 'none';
                img.style.verticalAlign = 'middle';
                img.style.margin = '4px 6px';
            }
        }

        if (borderW) {
            const bw = parseInt(borderW.value, 10) || 0;
            const bs = borderStyle ? borderStyle.value : 'solid';
            if (bw > 0) {
                img.style.borderWidth = bw + 'px';
                img.style.borderStyle = bs;
                img.style.borderColor = '#1e293b';
            } else {
                img.style.border = 'none';
            }
        }

        if (borderRadius) {
            const br = parseInt(borderRadius.value, 10) || 0;
            img.style.borderRadius = br > 0 ? (br + 'px') : '0';
        }

        if (chkGrayscale) {
            if (chkGrayscale.checked) {
                img.style.filter = 'grayscale(100%)';
            } else {
                img.style.filter = '';
            }
        }

        // 90° Döndürme
        img.dataset.rotation = String(modalRotation);
        if (modalRotation) {
            img.style.transform = `rotate(${modalRotation}deg)`;
        } else {
            img.style.transform = '';
        }

        closeEditModal();
        selectImage(img);
        triggerChange();

        // Arka planda canvas piksel rasterizasyonu (UYAP masaüstü dosya uyumu için)
        rescaleImageBitmap(img, newW, newH, modalRotation, isGray).then(() => {
            if (modalRotation) {
                img.style.transform = '';
                img.dataset.rotation = '0';
                modalRotation = 0;
            }
            updateOverlayPosition();
            triggerChange();
        }).catch(() => {});

        if (typeof window.showToast === 'function') {
            window.showToast('Resim özellikleri başarıyla güncellendi.', 'success');
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
            let targetImg = e.target;
            if (targetImg && (targetImg.tagName === 'IMG' || (targetImg.classList && targetImg.classList.contains('udf-img')))) {
                e.stopPropagation();
                selectImage(targetImg);
            } else if (!e.target.closest('.uki-img-overlay') && !e.target.closest('.uki-img-toolbar')) {
                deselectImage();
            }
        });

        editor.addEventListener('dblclick', (e) => {
            let targetImg = e.target;
            if (targetImg && (targetImg.tagName === 'IMG' || (targetImg.classList && targetImg.classList.contains('udf-img')))) {
                e.stopPropagation();
                openEditModal(targetImg);
            }
        });

        // Dışarı tıklandığında seçimi kaldır
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('modal-image-edit');
            if (modal && modal.style.display !== 'none') return;
            if (e.target.closest('#modal-image-edit') || e.target.closest('.ax-modal-backdrop')) return;
            if (overlayEl && (overlayEl.contains(e.target) || overlayEl === e.target)) return;
            if (e.target.closest('.uki-img-overlay') || e.target.closest('.uki-img-toolbar')) return;
            if (e.target && (e.target.tagName === 'IMG' || (e.target.classList && e.target.classList.contains('udf-img')))) return;
            if (e.target.closest('#group-grafik') || e.target.closest('#btn-insert-image')) return;
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

        const wsContainer = document.getElementById('workspace-container');
        if (wsContainer) {
            wsContainer.addEventListener('scroll', updateOverlayPosition, { passive: true });
        }

        const zoomSelect = document.getElementById('zoom-select');
        if (zoomSelect) {
            zoomSelect.addEventListener('change', () => {
                setTimeout(updateOverlayPosition, 50);
            });
        }

        document.addEventListener('uki-document-change', () => {
            if (selectedImage) updateOverlayPosition();
        });

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
                openFilePicker(true);
            });
        }

        const btnModalDelete = document.getElementById('btn-img-modal-delete');
        if (btnModalDelete) {
            btnModalDelete.addEventListener('click', deleteSelectedImage);
        }

        const modalImageEdit = document.getElementById('modal-image-edit');
        if (modalImageEdit) {
            modalImageEdit.querySelectorAll('[data-close-modal], .ax-modal-close').forEach(b => {
                b.addEventListener('click', closeEditModal);
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
                const img = editingImage || selectedImage;
                if (!img) return;
                const nw = img.naturalWidth || parseInt(img.style.width, 10) || 600;
                const nh = img.naturalHeight || parseInt(img.style.height, 10) || 400;
                const fitW = 540;
                const fitH = Math.max(20, Math.round(nh * (fitW / nw)));
                const inputW = document.getElementById('img-edit-width');
                const inputH = document.getElementById('img-edit-height');
                if (inputW) inputW.value = fitW;
                if (inputH) inputH.value = fitH;
                updateModalPreview();
            });
        }

        // 90 Derece Döndürme
        const btnRotate = document.getElementById('btn-img-rotate-90');
        if (btnRotate) {
            btnRotate.addEventListener('click', rotateModalImage);
        }

        // Dinamik Giriş ve Değişiklik Olayları
        const inputW = document.getElementById('img-edit-width');
        const inputH = document.getElementById('img-edit-height');
        const lockAspect = document.getElementById('img-edit-aspect-lock');
        const borderW = document.getElementById('img-edit-border-w');
        const borderStyle = document.getElementById('img-edit-border-style');
        const borderRadius = document.getElementById('img-edit-border-radius');
        const chkGrayscale = document.getElementById('img-edit-grayscale');

        if (inputW) {
            inputW.addEventListener('input', () => {
                if (lockAspect && lockAspect.checked) {
                    const aspect = getModalAspect();
                    const wVal = parseFloat(inputW.value) || 0;
                    if (inputH) inputH.value = Math.max(10, Math.round(wVal / aspect));
                }
                updateModalPreview();
            });
        }

        if (inputH) {
            inputH.addEventListener('input', () => {
                if (lockAspect && lockAspect.checked) {
                    const aspect = getModalAspect();
                    const hVal = parseFloat(inputH.value) || 0;
                    if (inputW) inputW.value = Math.max(10, Math.round(hVal * aspect));
                }
                updateModalPreview();
            });
        }

        if (borderW) borderW.addEventListener('change', updateModalPreview);
        if (borderStyle) borderStyle.addEventListener('change', updateModalPreview);
        if (borderRadius) borderRadius.addEventListener('change', updateModalPreview);
        if (chkGrayscale) chkGrayscale.addEventListener('change', updateModalPreview);
    }

    function bindScaleBtn(btnId, factor) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', () => {
            applyModalScale(factor);
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
