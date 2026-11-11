/**
 * UYAP Kelime İşlemci (UKİ) - Düzenleme düzeltmeleri
 *
 *  1. Ctrl+A: Tarayıcının varsayılanı, editörün içindeki dokunulamaz katmanları (filigran, antet, sayfa kromu,
 *     sayfa boşlukları) da seçer; bu durumda execCommand (yazı tipi, kalın...) hiçbir şey yapmaz.
 *     Seçim yalnızca belge metninin ilk ve son karakteri arasına alınır.
 *  2. Punto: Çok paragraflı seçimde paragrafları <span> içine sarıp yapıyı bozuyordu; artık her metin parçası
 *     kendi <span>'ı ile boyutlandırılır.
 *  3. Hizalama ve girinti: seçilen tüm paragraflara uygulanır (execCommand yalnızca ilk paragrafı etkiliyor,
 *     "indent" ise <blockquote> üretip UDF'ye yanlış kaydediyordu). Girinti paragrafın sol boşluğudur.
 *  4. Cetveldeki sekme durakları sürüklenerek taşınır; cetvelden aşağı sürüklenip bırakılırsa silinir.
 */
(function (window, document) {
    'use strict';

    const SKIP = '.pb-spacer, .udf-tab, #page-boundaries-layer, #page-antet-layer, #antet-layer, #watermark-layer, .udf-seal-stamp, .e-sign-seal-badge, [contenteditable="false"]';
    const INDENT_STEP_PT = 36; // 1,27 cm
    let ed = null;

    function textNodesIn(range) {
        const root = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
        const out = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => {
                if (!n.nodeValue || !range.intersectsNode(n)) return NodeFilter.FILTER_SKIP;
                if (n.parentElement && n.parentElement.closest(SKIP)) return NodeFilter.FILTER_SKIP;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        let n;
        while ((n = walker.nextNode())) out.push(n);
        return out;
    }

    function selectDocumentText() {
        const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => (n.parentElement && n.parentElement.closest(SKIP)) ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT
        });
        let first = null, last = null, n;
        while ((n = walker.nextNode())) {
            if (!first) first = n;
            last = n;
        }
        if (!first) return false;
        const range = document.createRange();
        range.setStart(first, 0);
        range.setEnd(last, last.nodeValue.length);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
    }

    // Seçimdeki paragraflar (tablo hücrelerindekiler dahil)
    function selectedParagraphs() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !ed.contains(sel.anchorNode)) return [];
        const range = sel.getRangeAt(0);
        const all = Array.from(ed.querySelectorAll('p')).filter((p) => !p.closest(SKIP));
        const hit = all.filter((p) => range.intersectsNode(p));
        if (hit.length) return hit;
        const base = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
        const p = base && base.closest ? base.closest('p') : null;
        return p && ed.contains(p) ? [p] : [];
    }

    function notifyChange() {
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Seçili metne satır içi stil uygular (her metin parçası kendi span'ında)
    function applyInlineStyle(range, style) {
        const nodes = textNodesIn(range);
        if (!nodes.length) return false;
        let firstWrap = null, lastWrap = null;
        nodes.forEach((node) => {
            let from = 0, to = node.nodeValue.length;
            if (node === range.startContainer) from = range.startOffset;
            if (node === range.endContainer) to = range.endOffset;
            if (to <= from) return;
            let target = node;
            if (to < node.nodeValue.length) node.splitText(to);
            if (from > 0) target = node.splitText(from);
            const parent = target.parentNode;
            let wrap;
            if (parent.tagName === 'SPAN' && parent.childNodes.length === 1 && !parent.classList.length) {
                wrap = parent; // zaten tek çocuklu span: stilini güncelle
            } else {
                wrap = document.createElement('span');
                parent.insertBefore(wrap, target);
                wrap.appendChild(target);
            }
            Object.keys(style).forEach((k) => { wrap.style[k] = style[k]; });
            // iç içe span'lardaki eski boyut yeni boyutu ezmesin
            wrap.querySelectorAll('span').forEach((s) => { Object.keys(style).forEach((k) => { s.style[k] = ''; }); });
            if (!firstWrap) firstWrap = wrap;
            lastWrap = wrap;
        });
        if (firstWrap) {
            const r = document.createRange();
            r.setStartBefore(firstWrap);
            r.setEndAfter(lastWrap);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(r);
        }
        return !!firstWrap;
    }

    function patchEditor() {
        const proto = window.UkiEditor && window.UkiEditor.prototype;
        if (!proto || proto.__editfix) return;
        proto.__editfix = true;
        const origFormat = proto.format;

        proto.format = function (command, value) {
            const align = { justifyLeft: 'left', justifyCenter: 'center', justifyRight: 'right', justifyFull: 'justify' }[command];
            if (align || command === 'indent' || command === 'outdent') {
                this.el.focus();
                const paras = selectedParagraphs();
                if (paras.length) {
                    paras.forEach((p) => {
                        if (align) {
                            p.style.textAlign = align;
                        } else {
                            const cur = parseFloat(p.style.marginLeft) || 0;
                            const next = Math.max(0, cur + (command === 'indent' ? INDENT_STEP_PT : -INDENT_STEP_PT));
                            p.style.marginLeft = next ? next + 'pt' : '';
                            if (p.hasAttribute('data-li') || next) p.setAttribute('data-li', String(next));
                        }
                    });
                    if (this.updateToolbarState) this.updateToolbarState();
                    if (this.updateStats) this.updateStats();
                    notifyChange();
                    return;
                }
            }
            return origFormat.call(this, command, value);
        };

        const origSize = proto.setFontSize;
        proto.setFontSize = function (sizePt) {
            this.el.focus();
            const sel = window.getSelection();
            if (!sel.rangeCount) return;
            const range = sel.getRangeAt(0);
            if (range.collapsed) return origSize.call(this, sizePt);
            if (applyInlineStyle(range, { fontSize: sizePt + 'pt' })) {
                if (this.updateToolbarState) this.updateToolbarState();
                if (this.updateStats) this.updateStats();
                notifyChange();
            }
        };
    }

    // ---- Sekme duraklarını sürükleme ----
    function parseStops(p) {
        return (p.getAttribute('data-tabset') || '').split(',').filter(Boolean).map((x) => {
            const f = x.split(':');
            return { pos: parseFloat(f[0]), align: f[1] || '0', lead: f[2] || '0' };
        }).filter((s) => !isNaN(s.pos));
    }
    function writeStops(p, stops) {
        stops.sort((a, b) => a.pos - b.pos);
        if (stops.length) p.setAttribute('data-tabset', stops.map((s) => (Math.round(s.pos * 10) / 10) + ':' + s.align + ':' + s.lead).join(','));
        else p.removeAttribute('data-tabset');
    }

    function bindTabStopDrag() {
        const scale = document.getElementById('ruler-scale');
        if (!scale) return;
        let drag = null;
        let blockClickUntil = 0;

        scale.addEventListener('pointerdown', (e) => {
            const stop = e.target.closest && e.target.closest('.ruler-tabstop');
            if (!stop) return;
            e.preventDefault();
            e.stopPropagation();
            try { stop.setPointerCapture(e.pointerId); } catch (err) { /* sentetik olaylarda yakalama yok */ }
            const ml = parseFloat(getComputedStyle(ed).paddingLeft) || 0;
            const startLeft = parseFloat(stop.style.left) || 0;
            drag = { stop, ml, startLeft, oldPos: (startLeft - ml) * 0.75, startY: e.clientY, moved: false, remove: false };
        });

        scale.addEventListener('pointermove', (e) => {
            if (!drag) return;
            const r = scale.getBoundingClientRect();
            const sc = r.width / scale.offsetWidth || 1;
            const x = (e.clientX - r.left) / sc;
            const snapped = Math.round(((x - drag.ml) * 0.75) / 2.83465) * 2.83465; // 1 mm adım
            drag.newPos = Math.max(4, snapped);
            drag.moved = true;
            drag.remove = Math.abs(e.clientY - drag.startY) > 26; // cetvelden uzaklaşınca silinir
            drag.stop.style.left = (drag.ml + drag.newPos / 0.75) + 'px';
            drag.stop.style.opacity = drag.remove ? '0.35' : '1';
        });

        const finish = () => {
            if (!drag) return;
            const d = drag;
            drag = null;
            if (!d.moved) return;
            blockClickUntil = Date.now() + 350;
            selectedParagraphs().forEach((p) => {
                const stops = parseStops(p);
                const hit = stops.reduce((best, s) => (best === null || Math.abs(s.pos - d.oldPos) < Math.abs(best.pos - d.oldPos)) ? s : best, null);
                if (!hit || Math.abs(hit.pos - d.oldPos) > 3) return;
                if (d.remove) stops.splice(stops.indexOf(hit), 1);
                else if (!stops.some((s) => s !== hit && Math.abs(s.pos - d.newPos) < 1)) hit.pos = d.newPos;
                writeStops(p, stops);
            });
            if (window.UkiCore && window.UkiCore.layoutTabs) window.UkiCore.layoutTabs(ed);
            notifyChange();
            document.dispatchEvent(new Event('selectionchange')); // cetveldeki durakları yeniden çiz
        };
        scale.addEventListener('pointerup', finish);
        scale.addEventListener('pointercancel', finish);

        // Sürükleme bitince oluşan "click" yeni durak eklemesin
        scale.addEventListener('click', (e) => {
            if (Date.now() < blockClickUntil) { e.stopImmediatePropagation(); e.preventDefault(); }
        }, true);
    }

    // ---- İmleç sayfa boşluğuna (pb-spacer) düşmesin ----
    // Sayfa sonlarındaki boşluk elemanı imleci içine alabiliyordu: sayfa aralığında uzun bir imleç görünüyor ve
    // yazılan metin orada başlıyordu. İmleç boşluğa denk gelirse, boşluğun ardındaki ilk metin karakterine taşınır.
    let fixingCaret = false;
    function isSpacer(n) { return n && n.nodeType === 1 && n.classList && n.classList.contains('pb-spacer'); }

    function firstTextAfter(node) {
        const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT, {
            acceptNode: (t) => (t.parentElement && t.parentElement.closest(SKIP)) || !t.nodeValue ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT
        });
        let t;
        while ((t = walker.nextNode())) {
            if (node.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) return t;
        }
        return null;
    }

    function keepCaretOutOfSpacers() {
        if (fixingCaret) return;
        const sel = window.getSelection();
        if (!sel || !sel.isCollapsed || !sel.anchorNode || !ed.contains(sel.anchorNode)) return;
        let spacer = null;
        const node = sel.anchorNode;
        const off = sel.anchorOffset;
        if (node.nodeType === 1) {
            if (node.closest && node.closest('.pb-spacer')) spacer = node.closest('.pb-spacer');
            else if (isSpacer(node.childNodes[off])) spacer = node.childNodes[off];
            else if (off > 0 && isSpacer(node.childNodes[off - 1])) spacer = node.childNodes[off - 1];
        } else if (node.parentElement && node.parentElement.closest('.pb-spacer')) {
            spacer = node.parentElement.closest('.pb-spacer');
        }
        if (!spacer) return;
        const target = firstTextAfter(spacer);
        if (!target) return;
        fixingCaret = true;
        try { sel.collapse(target, 0); } finally { fixingCaret = false; }
    }

    function init() {
        ed = document.getElementById('editor');
        if (!ed) return;
        document.addEventListener('selectionchange', keepCaretOutOfSpacers);
        ed.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'a' || e.key === 'A')) {
                if (selectDocumentText()) e.preventDefault();
            }
        });
        patchEditor();
        bindTabStopDrag();
        window.UkiEditFix = { selectAll: () => { ed.focus(); return selectDocumentText(); }, applyInlineStyle };
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})(window, document);
