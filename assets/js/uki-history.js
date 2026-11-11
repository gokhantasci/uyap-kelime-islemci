/**
 * UYAP Kelime İşlemci (UKİ) - Geri Al / Yinele (Undo / Redo) ve Belge Geçmişi Modülü
 * 
 * Editördeki tüm biçim boyacısı (format painter), hızlı stiller, hizalama (iki yana yasla / sola yasla),
 * paragraf ayarları ve metin düzenleme işlemlerini eksiksiz, çift yönlü ve güvenilir şekilde geri alır.
 */
(function (window, document) {
    'use strict';

    const MAX_STACK = 100;
    let undoStack = [];
    let redoStack = [];
    let isPerformingUndoRedo = false;
    let typingTimer = null;
    let editorEl = null;

    function getEditor() {
        if (!editorEl || !document.contains(editorEl)) {
            editorEl = document.getElementById('editor');
        }
        return editorEl;
    }

    // Seçim sınırlarını karakter ofsetleri olarak hesaplar
    function getSelectionOffsets(root) {
        if (!root) return null;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        const range = sel.getRangeAt(0);
        if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

        let start = 0, end = 0;
        let charCount = 0;
        let foundStart = false, foundEnd = false;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => {
                if (n.parentElement && n.parentElement.closest('.pb-spacer, #page-boundaries-layer, #page-antet-layer, #antet-layer, #watermark-layer')) {
                    return NodeFilter.FILTER_SKIP;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        let n;
        while ((n = walker.nextNode())) {
            const len = n.nodeValue ? n.nodeValue.length : 0;
            if (!foundStart && (n === range.startContainer || n.contains(range.startContainer))) {
                start = charCount + range.startOffset;
                foundStart = true;
            }
            if (!foundEnd && (n === range.endContainer || n.contains(range.endContainer))) {
                end = charCount + range.endOffset;
                foundEnd = true;
            }
            charCount += len;
        }

        if (!foundStart) start = charCount;
        if (!foundEnd) end = charCount;

        return { start, end };
    }

    // Karakter ofsetlerinden imleç seçimini geri yükler
    function restoreSelectionOffsets(root, offsets) {
        if (!root || !offsets) return;
        const sel = window.getSelection();
        if (!sel) return;

        let startNode = null, startOffset = 0;
        let endNode = null, endOffset = 0;
        let charCount = 0;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => {
                if (n.parentElement && n.parentElement.closest('.pb-spacer, #page-boundaries-layer, #page-antet-layer, #antet-layer, #watermark-layer')) {
                    return NodeFilter.FILTER_SKIP;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        let n;
        while ((n = walker.nextNode())) {
            const len = n.nodeValue ? n.nodeValue.length : 0;
            if (!startNode && charCount + len >= offsets.start) {
                startNode = n;
                startOffset = Math.max(0, Math.min(len, offsets.start - charCount));
            }
            if (!endNode && charCount + len >= offsets.end) {
                endNode = n;
                endOffset = Math.max(0, Math.min(len, offsets.end - charCount));
            }
            charCount += len;
        }

        if (startNode && endNode) {
            try {
                const range = document.createRange();
                range.setStart(startNode, startOffset);
                range.setEnd(endNode, endOffset);
                sel.removeAllRanges();
                sel.addRange(range);
            } catch (_) {}
        }
    }

    // Katmanlar (filigran, antet, sayfa ayracı) hariç dokümanın düzenlenebilir içeriğini klonlayıp serileştirir
    function serializeContent(root) {
        if (!root) return '';
        const wrapper = document.createElement('div');
        Array.from(root.childNodes).forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const id = node.id;
                if (id === 'page-boundaries-layer' || id === 'antet-layer' || id === 'watermark-layer' || id === 'page-antet-layer') {
                    return;
                }
                if (node.classList && (node.classList.contains('pb-spacer') || node.classList.contains('page-boundaries-layer'))) {
                    return;
                }
            }
            wrapper.appendChild(node.cloneNode(true));
        });
        wrapper.querySelectorAll('.pb-spacer').forEach(s => s.remove());
        return wrapper.innerHTML;
    }

    function deserializeContent(root, html) {
        if (!root) return;
        const toRemove = [];
        Array.from(root.childNodes).forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const id = node.id;
                if (id === 'page-boundaries-layer' || id === 'antet-layer' || id === 'watermark-layer' || id === 'page-antet-layer') {
                    return;
                }
            }
            toRemove.push(node);
        });
        toRemove.forEach(n => n.remove());

        const temp = document.createElement('div');
        temp.innerHTML = html;
        while (temp.firstChild) {
            root.appendChild(temp.firstChild);
        }
    }

    function takeSnapshot(label = '') {
        const ed = getEditor();
        if (!ed) return null;
        return {
            label,
            html: serializeContent(ed),
            sel: getSelectionOffsets(ed),
            timestamp: Date.now()
        };
    }

    const UkiHistory = {
        record(label = '') {
            if (isPerformingUndoRedo) return;
            const ed = getEditor();
            if (!ed) return;

            const snap = takeSnapshot(label);
            if (!snap) return;

            // Tekrarlayan özdeş durumları yığına ekleme
            if (undoStack.length > 0 && undoStack[undoStack.length - 1].html === snap.html) {
                return;
            }

            undoStack.push(snap);
            if (undoStack.length > MAX_STACK) undoStack.shift();
            redoStack = []; // Yeni işlemde redo sıfırlanır
        },

        undo() {
            const ed = getEditor();
            if (!ed) return false;
            clearTimeout(typingTimer);

            if (undoStack.length <= 1) {
                // Stack'te 1 öğe var ama mevcut DOM'dan farklıysa geri dönülebilir
                if (undoStack.length === 1) {
                    const baseSnap = undoStack[0];
                    if (!baseSnap || !baseSnap.html || !baseSnap.html.trim()) {
                        // Taban durum boşsa ve editörde metin varsa, tüm belgeyi silme;
                        // mevcut içeriği yeni taban durum yap:
                        const curHtml = serializeContent(ed);
                        if (curHtml && curHtml.trim()) {
                            undoStack[0] = takeSnapshot('Başlangıç');
                        }
                        return false;
                    }
                    const curHtml = serializeContent(ed);
                    if (curHtml !== baseSnap.html) {
                        isPerformingUndoRedo = true;
                        try {
                            const curSnap = takeSnapshot('Güncel');
                            redoStack.push(curSnap);
                            this._applySnapshot(baseSnap);
                            return true;
                        } finally {
                            isPerformingUndoRedo = false;
                        }
                    }
                }
                return false;
            }

            isPerformingUndoRedo = true;
            try {
                // Mevcut durumu redo yığınına kaydet
                const curSnap = takeSnapshot('Mevcut');
                redoStack.push(curSnap);

                // Son durumu çıkar ve bir öncekini uygula
                undoStack.pop();
                const prevState = undoStack[undoStack.length - 1];
                if (prevState && (!prevState.html || !prevState.html.trim()) && curSnap && curSnap.html && curSnap.html.trim()) {
                    // prevState boş bir açılış/taslak ise ve belgede gerçek içerik varsa, tüm belgeyi silmeyi engelle
                    undoStack[undoStack.length - 1] = curSnap;
                    return false;
                }
                this._applySnapshot(prevState);
                return true;
            } finally {
                isPerformingUndoRedo = false;
            }
        },

        redo() {
            const ed = getEditor();
            if (!ed || redoStack.length === 0) return false;
            clearTimeout(typingTimer);

            isPerformingUndoRedo = true;
            try {
                const nextState = redoStack.pop();
                undoStack.push(nextState);
                this._applySnapshot(nextState);
                return true;
            } finally {
                isPerformingUndoRedo = false;
            }
        },

        canUndo() {
            const ed = getEditor();
            if (!ed) return false;
            if (undoStack.length > 1) return true;
            if (undoStack.length === 1) {
                const baseSnap = undoStack[0];
                if (!baseSnap || !baseSnap.html || !baseSnap.html.trim()) return false;
                const curHtml = serializeContent(ed);
                return curHtml !== baseSnap.html;
            }
            return false;
        },

        canRedo() {
            return redoStack.length > 0;
        },

        clear() {
            clearTimeout(typingTimer);
            undoStack = [];
            redoStack = [];
            const ed = getEditor();
            if (ed) {
                const cur = serializeContent(ed);
                if (cur && cur.trim()) {
                    this.record('Başlangıç');
                }
            }
        },

        _applySnapshot(snap) {
            const ed = getEditor();
            if (!ed || !snap) return;

            deserializeContent(ed, snap.html);
            restoreSelectionOffsets(ed, snap.sel);

            document.dispatchEvent(new Event('uki-document-change'));
            if (window.UkiPages && typeof window.UkiPages.repaginate === 'function') {
                window.UkiPages.repaginate();
            }
            if (typeof window.recalculatePagesAndThumbnails === 'function') {
                window.recalculatePagesAndThumbnails();
            }
            if (window.editor && typeof window.editor.updateToolbarState === 'function') {
                window.editor.updateToolbarState();
            }
        },

        init() {
            const ed = getEditor();
            if (!ed) return;

            // İlk durumu kaydet (editörde başlangıç içeriği varsa)
            if (undoStack.length === 0) {
                const cur = serializeContent(ed);
                if (cur && cur.trim()) {
                    this.record('Açılış');
                }
            }

            // Klavye kısayolları dinleyicisi (Ctrl+Z ve Ctrl+Y / Ctrl+Shift+Z)
            window.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && !e.altKey) {
                    const key = e.key.toLowerCase();
                    if (key === 'z' && !e.shiftKey) {
                        if (this.canUndo()) {
                            e.preventDefault();
                            this.undo();
                        }
                    } else if ((key === 'y' && !e.shiftKey) || (key === 'z' && e.shiftKey)) {
                        if (this.canRedo()) {
                            e.preventDefault();
                            this.redo();
                        }
                    }
                }
            }, true); // Capture fazında dinle

            // Yazma işlemlerini gecikmeli olarak yığına kaydet
            ed.addEventListener('input', () => {
                clearTimeout(typingTimer);
                typingTimer = setTimeout(() => {
                    this.record('Yazma');
                }, 400);
            });

            // Enter tuşunda doğrudan sınır oluştur
            ed.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(typingTimer);
                    this.record('Enter Öncesi');
                    setTimeout(() => this.record('Enter Sonrası'), 50);
                }
            });

            // Altı çizili boşluk noktası (udf-underline-dot) seçilip silindiğinde veya Backspace/Delete tuşlandığında
            ed.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' || e.key === 'Delete') {
                    const sel = window.getSelection();
                    if (!sel || !sel.rangeCount) return;
                    const range = sel.getRangeAt(0);
                    const p = sel.anchorNode.nodeType === 1 ? sel.anchorNode.closest('p') : sel.anchorNode.parentElement?.closest('p');
                    if (p && ed.contains(p)) {
                        const dot = p.querySelector('.udf-underline-dot');
                        if (dot) {
                            const pText = p.textContent.replace(/[\r\n\s]+/g, '');
                            if (pText === '.' || pText === '' || range.intersectsNode(dot) || range.commonAncestorContainer === dot || dot.contains(range.commonAncestorContainer)) {
                                e.preventDefault();
                                UkiHistory.record('Nokta Silinmeden Önce');
                                dot.remove();
                                p.removeAttribute('data-underline');
                                p.setAttribute('data-udf-dot-cleared', 'true');
                                if (!p.querySelector('br')) p.innerHTML = '<br>';

                                try {
                                    const newRange = document.createRange();
                                    newRange.setStart(p, 0);
                                    newRange.collapse(true);
                                    sel.removeAllRanges();
                                    sel.addRange(newRange);
                                } catch (_) {}

                                UkiHistory.record('Nokta Silindi');
                                document.dispatchEvent(new Event('uki-document-change'));
                                if (window.UkiPages && typeof window.UkiPages.repaginate === 'function') {
                                    window.UkiPages.repaginate();
                                }
                            }
                        }
                    }
                }
            });

            // Kullanıcı noktanın üzerine yazı yazarsa veya elle silerse temizle
            ed.addEventListener('input', () => {
                const dots = ed.querySelectorAll('.udf-underline-dot');
                dots.forEach(dot => {
                    if (!dot.textContent || dot.textContent.trim() === '' || dot.textContent !== '.') {
                        const p = dot.closest('p');
                        dot.remove();
                        if (p) {
                            p.removeAttribute('data-underline');
                            p.setAttribute('data-udf-dot-cleared', 'true');
                            if (!p.textContent.trim() && !p.querySelector('br')) {
                                p.innerHTML = '<br>';
                            }
                        }
                    }
                });
            });
        }
    };

    window.UkiHistory = UkiHistory;

    // DOM hazır olduğunda başlat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UkiHistory.init());
    } else {
        UkiHistory.init();
    }

})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : {});
