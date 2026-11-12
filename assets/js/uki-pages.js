/**
 * UYAP Kelime İşlemci (UKİ) - Sayfalama Motoru (Pagination Engine)
 *
 * Tek parça contenteditable alanı gerçek A4 sayfalarına böler:
 *  - Sayfa sınırını aşan paragraf/satır/tablo satırı, "pb-spacer" ile bir sonraki sayfanın
 *    üst boşluğuna itilir (içerik DOM'unda yalnızca contenteditable="false" boşluk öğesi eklenir).
 *  - Sayfa araları, 2. sayfadan itibaren üst bilgi, her sayfada alt bilgi + sayfa no çizilir.
 *  - Küçük sayfa önizlemeleri ve sayfaya git için geometri bilgisi sağlar.
 */
(function (window) {
    'use strict';

    const GAP = 28; // iki sayfa arasındaki görsel boşluk (px)
    const SKIP_CLASSES = ['page-boundaries-layer', 'a4-antet-layer', 'a4-watermark-layer',
        'e-sign-seal-badge', 'udf-seal-stamp', 'pb-spacer', 'uki-img-overlay', 'uki-img-toolbar'];

    let ed = null;
    let layer = null;
    let busy = false;
    const cfg = {
        header: null,
        webId: '',
        startPage: 2,
        showFooter: true,
        showPageNumber: true,
        pageNumberFormat: 'slash',
        showPageNumberOnFirstPage: true,
        footerOffsetPt: 60,
        signed: false,
        reserve: false,
        qrCode: '',
        antetTop: 0,
        antetBottom: 0
    };
    let lastGeom = null;


    // UYAP doğrulama karekodu: https://evrakdogrula.uyap.gov.tr/<uyapdogrulamakodu> (UYAP masaüstü standardı: 36x36px / ~27pt)
    function qrSvg(text, size = 36, uyapQuiet = false) {
        if (typeof qrcode !== 'function') return '';
        const qr = qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        const n = qr.getModuleCount();
        // UYAP karekod standardı: 29x29 modül QR, 51x51 piksel kare içinde 11 modül sessiz alan (quiet zone) ile yerleşir.
        const quiet = uyapQuiet ? Math.round(n * 11 / 29) : 4;
        let d = '';
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (qr.isDark(r, c)) d += 'M' + (c + quiet) + ' ' + (r + quiet) + 'h1v1h-1z';
            }
        }
        const sz = n + quiet * 2;
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + sz + ' ' + sz + '" shape-rendering="crispEdges" style="width:' + size + 'px;height:' + size + 'px;display:block;"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
    }

    function copyText(text, el) {
        const done = () => {
            if (el) {
                el.classList.add('copied');
                setTimeout(() => el.classList.remove('copied'), 1200);
            }
            if (typeof UkiPages.onCopied === 'function') UkiPages.onCopied(text);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, () => legacy());
        } else {
            legacy();
        }
        function legacy() {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); done(); } catch (e) { /* kopyalanamadı */ }
            ta.remove();
        }
    }

    function px(v) { return parseFloat(v) || 0; }

    function scale() {
        const r = ed.getBoundingClientRect();
        return ed.offsetWidth ? r.width / ed.offsetWidth : 1;
    }

    // ---- Antet (her sayfada yinelenir) ----
    function antetSource() {
        const l = document.getElementById('antet-layer');
        return l && l.style.display !== 'none' && l.innerHTML.trim() ? l : null;
    }

    // Avukat anteti: üst blok ve alt blok yüksekliği ölçülür; metin bunların arasında akar
    function measureAntet(H) {
        cfg.antetTop = 0;
        cfg.antetBase = 0;
        cfg.antetBottom = 0;
        const src = antetSource();
        if (!src) return;
        src.style.height = H + 'px';
        const c = src.querySelector('.lawyer-antet-container');
        if (!c || c.children.length < 1) return;
        const sc = scale();
        const lr = src.getBoundingClientRect();
        const first = c.children[0].getBoundingClientRect();
        cfg.antetBase = (first.bottom - lr.top) / sc;
        // Üst bilgi (2. sayfadan) varsa antetin altında ayrıca yer ayrılır
        cfg.antetTop = cfg.antetBase + 12 + (cfg.header ? 28 : 0);
        if (c.children.length > 1) {
            const last = c.children[c.children.length - 1].getBoundingClientRect();
            cfg.antetBottom = (lr.bottom - last.top) / sc + 8;
        }
    }

    function renderAntets(n, g) {
        let cp = document.getElementById('page-antet-layer');
        const src = antetSource();
        if (!src || n < 2) { if (cp) cp.remove(); return; }
        if (!cp || !ed.contains(cp)) {
            cp = document.createElement('div');
            cp.id = 'page-antet-layer';
            cp.className = 'a4-antet-layer';
            cp.setAttribute('contenteditable', 'false');
            src.parentNode.insertBefore(cp, src.nextSibling);
        }
        cp.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:0;overflow:visible;pointer-events:none;z-index:0;';
        cp.innerHTML = '';
        for (let k = 1; k < n; k++) {
            const d = document.createElement('div');
            d.style.cssText = 'position:absolute;top:' + (k * g.S) + 'px;left:0;width:100%;height:' + g.H + 'px;overflow:hidden;';
            d.innerHTML = src.innerHTML;
            cp.appendChild(d);
        }
    }

    function geom() {
        const cs = getComputedStyle(ed);
        const W = ed.offsetWidth;
        const land = ed.classList.contains('orientation-landscape');
        const H = Math.round(land ? W * 210 / 297 : W * 297 / 210);
        measureAntet(H);
        const g = {
            W, H, GAP, S: H + GAP,
            MtRaw: px(cs.paddingTop),
            Mt: Math.max(px(cs.paddingTop), cfg.antetTop || 0), Mb: px(cs.paddingBottom),
            // Alt bilgi varsa metin, alt bilginin üstünde biter (UYAP: footerFOffset + alt bilgi yüksekliği ~96pt / 128px)
            MbEff: Math.max(cfg.reserve ? Math.max(px(cs.paddingBottom), (cfg.footerOffsetPt + 36) * 96 / 72) : px(cs.paddingBottom), cfg.antetBottom || 0),
            Ml: px(cs.paddingLeft), Mr: px(cs.paddingRight)
        };
        lastGeom = g;
        return g;
    }

    function isBlock(el) {
        if (el.nodeType !== 1) return false;
        for (const c of SKIP_CLASSES) if (el.classList.contains(c)) return false;
        return true;
    }

    function blocks() {
        return Array.from(ed.children).filter(isBlock);
    }

    // y koordinatı (editör içi, zoom'dan bağımsız px)
    function relTop(rectTop) { return (rectTop - ed.getBoundingClientRect().top) / scale(); }

    function makeSpacer(tag) {
        const s = document.createElement(tag || 'span');
        s.className = 'pb-spacer';
        s.setAttribute('contenteditable', 'false');
        s.setAttribute('data-pb', '1');
        return s;
    }

    function clearSpacers() {
        const list = ed.querySelectorAll('.pb-spacer');
        const parents = new Set();
        list.forEach(s => { parents.add(s.parentNode); s.remove(); });
        parents.forEach(p => { if (p && p.normalize) p.normalize(); });
    }

    // ---- Seçim koruma (boşluk eklenip silinirken imleç kaybolmasın) ----
    function textNodes(root) {
        const out = [];
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let n;
        while ((n = w.nextNode())) {
            if (n.parentNode && n.parentNode.closest && n.parentNode.closest('.pb-spacer')) continue;
            out.push(n);
        }
        return out;
    }
    function saveSel() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !ed.contains(sel.anchorNode)) return null;
        const pos = (node, off) => {
            let total = 0;
            for (const t of textNodes(ed)) {
                if (t === node) return total + off;
                total += t.nodeValue.length;
            }
            return -1;
        };
        const a = pos(sel.anchorNode, sel.anchorOffset);
        const f = pos(sel.focusNode, sel.focusOffset);
        if (a >= 0 && f >= 0) {
            return { type: 'text', a, f };
        }
        // Boş paragraf (<p><br></p>), tablo hücresi veya metin içermeyen eleman seçimi
        let aNode = sel.anchorNode;
        let aOff = sel.anchorOffset;
        let fNode = sel.focusNode || aNode;
        let fOff = sel.focusOffset || aOff;
        if (aNode && aNode.nodeType === 1 && aNode.classList && aNode.classList.contains('pb-spacer')) {
            aNode = aNode.nextSibling || aNode.parentNode;
            aOff = 0;
        }
        if (fNode && fNode.nodeType === 1 && fNode.classList && fNode.classList.contains('pb-spacer')) {
            fNode = fNode.nextSibling || fNode.parentNode;
            fOff = 0;
        }
        return { type: 'node', anchorNode: aNode, anchorOffset: aOff, focusNode: fNode, focusOffset: fOff };
    }
    function restoreSel(s) {
        if (!s) return;
        const sel = window.getSelection();
        if (!sel) return;

        if (s.type === 'node') {
            if (s.anchorNode && s.anchorNode.isConnected && ed.contains(s.anchorNode)) {
                try {
                    const fNode = (s.focusNode && s.focusNode.isConnected && ed.contains(s.focusNode)) ? s.focusNode : s.anchorNode;
                    const fOff = (s.focusNode && s.focusNode.isConnected) ? s.focusOffset : s.anchorOffset;
                    const maxA = s.anchorNode.nodeType === 1 ? s.anchorNode.childNodes.length : (s.anchorNode.nodeValue ? s.anchorNode.nodeValue.length : 0);
                    const maxF = fNode.nodeType === 1 ? fNode.childNodes.length : (fNode.nodeValue ? fNode.nodeValue.length : 0);
                    sel.setBaseAndExtent(
                        s.anchorNode, Math.min(s.anchorOffset, maxA),
                        fNode, Math.min(fOff, maxF)
                    );
                    return;
                } catch (e) {}
            }
            return;
        }

        const find = (idx) => {
            let total = 0;
            for (const t of textNodes(ed)) {
                const len = t.nodeValue.length;
                if (idx <= total + len) return [t, idx - total];
                total += len;
            }
            return null;
        };
        const a = find(s.a), f = find(s.f);
        if (!a || !f) return;
        try {
            sel.setBaseAndExtent(a[0], a[1], f[0], f[1]);
        } catch (e) {}
    }

    // ---- Karakter geometrisi ----
    function charRect(node, off) {
        const r = document.createRange();
        r.setStart(node, off);
        r.setEnd(node, Math.min(off + 1, node.nodeValue.length));
        const rects = (r.getClientRects && r.getClientRects()) || [];
        return rects.length ? rects[0] : null;
    }

    // Bloğun, limit çizgisini aşan ilk satırının ilk karakter konumunu bulur
    function findSplitPoint(block, limit) {
        const nodes = textNodes(block).filter(n => n.nodeValue.length > 0);
        if (!nodes.length) return null;
        const flat = [];
        nodes.forEach(n => { for (let i = 0; i < n.nodeValue.length; i++) flat.push([n, i]); });
        const bottomOf = (i) => {
            for (let k = i; k < Math.min(flat.length, i + 8); k++) {
                const r = charRect(flat[k][0], flat[k][1]);
                if (r && r.height > 0) return { top: relTop(r.top), bottom: relTop(r.bottom), idx: k };
            }
            return null;
        };
        let lo = 0, hi = flat.length - 1, found = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const b = bottomOf(mid);
            if (!b) { hi = mid - 1; continue; }
            if (b.bottom > limit + 0.5) { found = mid; hi = mid - 1; } else { lo = mid + 1; }
        }
        if (found <= 0) return found === 0 ? { idx: 0, flat } : null;
        // satırın ilk karakterine geri git
        const base = bottomOf(found);
        let i = found;
        while (i > 0) {
            const p = bottomOf(i - 1);
            if (p && Math.abs(p.top - base.top) < 2) i = p.idx === i - 1 ? i - 1 : i - 1; else break;
        }
        return { idx: i, flat };
    }

    function paginate() {
        const g = geom();
        const list = blocks();
        let guard = 0;

        // Antet üst bloğu varsa 1. sayfada metin onun altından başlar (diğer sayfalar Mt ile hizalanır)
        if (list.length && g.Mt - g.MtRaw > 1) {
            const top = makeSpacer('div');
            top.style.height = (g.Mt - g.MtRaw) + 'px';
            list[0].parentNode.insertBefore(top, list[0]);
        }

        for (const block of list) {
            // Manuel sayfa kesmesi (Ctrl+Enter / Sayfa Kesmesi Ekle)
            if (block.classList && (block.classList.contains('udf-page-break') || block.getAttribute('data-page-break') === '1')) {
                const r0 = block.getBoundingClientRect();
                let k = Math.max(0, Math.floor((relTop(r0.top) + 0.5) / g.S));
                const nextTop = (k + 1) * g.S + g.Mt;
                const bBottom = relTop(r0.bottom);
                if (bBottom < nextTop - 2) {
                    const sp = makeSpacer('div');
                    sp.style.height = Math.max(1, nextTop - bBottom) + 'px';
                    block.parentNode.insertBefore(sp, block.nextSibling);
                }
                continue;
            }

            const r0 = block.getBoundingClientRect();
            let k = Math.max(0, Math.floor((relTop(r0.top) + 0.5) / g.S));
            let loops = 0;
            while (loops++ < 60 && guard++ < 3000) {
                const r = block.getBoundingClientRect();
                const top = relTop(r.top);
                k = Math.max(0, Math.floor((top + 0.5) / g.S));
                const pageContentTop = k * g.S + g.Mt;

                // 2. ve sonraki sayfalarda (k >= 1), blok sayfa üst kenar boşluğunun (g.Mt) üstünde başlayamaz!
                if (k >= 1 && top < pageContentTop - 1.5) {
                    const needed = Math.max(1, Math.round(pageContentTop - top));
                    const spTop = makeSpacer('div');
                    spTop.style.height = needed + 'px';
                    block.parentNode.insertBefore(spTop, block);
                    continue;
                }

                // Alt dolgu (paragraf sonrası boşluk) sığmasa da son satır sığıyorsa bölme
                const padB = block.tagName.toLowerCase() === 'table' ? 0 : (parseFloat(getComputedStyle(block).paddingBottom) || 0);
                const bottom = relTop(r.bottom) - padB;
                if (bottom - top < 1) break;
                const limit = k * g.S + g.H - g.MbEff;
                const nextTop = (k + 1) * g.S + g.Mt;
                if (bottom <= limit + 0.5) break;

                const atPageTop = top <= k * g.S + g.Mt + 2;
                const tag = block.tagName.toLowerCase();

                if (tag === 'table') {
                    const rows = Array.from(block.querySelectorAll('tr')).filter(tr => !tr.classList.contains('pb-spacer'));
                    let crossing = null;
                    for (const tr of rows) {
                        if (relTop(tr.getBoundingClientRect().bottom) > limit + 0.5) { crossing = tr; break; }
                    }
                    if (!crossing) break;
                    const cTop = relTop(crossing.getBoundingClientRect().top);
                    if (cTop >= nextTop - 1) { k++; continue; }
                    if (crossing === rows[0]) {
                        if (atPageTop) break;
                        const sp = makeSpacer('div');
                        sp.style.height = Math.max(1, nextTop - top) + 'px';
                        block.parentNode.insertBefore(sp, block);
                    } else {
                        const sp = document.createElement('tr');
                        sp.className = 'pb-spacer';
                        sp.setAttribute('contenteditable', 'false');
                        const td = document.createElement('td');
                        td.colSpan = 99;
                        td.style.cssText = 'padding:0;border:0;height:' + Math.max(1, nextTop - cTop) + 'px';
                        sp.appendChild(td);
                        crossing.parentNode.insertBefore(sp, crossing);
                    }
                    k++;
                    continue;
                }

                // Metin bloğu: satır düzeyinde böl
                const hasText = textNodes(block).some(n => n.nodeValue.length > 0);
                const sp = findSplitPoint(block, limit);
                if (hasText && !sp) break; // metin karakterlerinin tümü sınıra sığıyor
                if (sp && sp.idx > 0) {
                    const pos = sp.flat[sp.idx];
                    const cr0 = charRect(pos[0], pos[1]);
                    if (cr0 && relTop(cr0.top) >= nextTop - 1) { k++; continue; }
                    let target = pos[0];
                    if (pos[1] > 0) target = pos[0].splitText(pos[1]);
                    // Satır içi (inline-block) boşluk: önceki satır "paragrafın son satırı" sayılmaz, iki yana yaslı kalır
                    const spacer = makeSpacer('span');
                    const cTop = cr0 ? relTop(cr0.top) : limit;
                    const hNeeded = Math.max(1, nextTop + findFirstLineTop(block).d - cTop);
                    spacer.style.cssText = 'display:inline-block;width:100%;vertical-align:top;height:' + hNeeded + 'px;';
                    target.parentNode.insertBefore(spacer, target);
                    k++;
                    continue;
                }
                if (atPageTop) break;
                if (top >= nextTop - 1) { k++; continue; }
                const whole = makeSpacer('div');
                whole.style.height = Math.max(1, nextTop - top) + 'px';
                block.parentNode.insertBefore(whole, block);
                k++;
            }
        }

        const all = blocks();
        let lastBottom = g.Mt;
        const edTop = ed.getBoundingClientRect().top;
        all.forEach(b => { lastBottom = Math.max(lastBottom, (b.getBoundingClientRect().bottom - edTop) / scale()); });
        const n = Math.max(1, Math.floor((lastBottom - 1) / g.S) + 1);
        ed.style.setProperty('min-height', (n * g.H + (n - 1) * GAP) + 'px', 'important');
        return n;
    }

    // Bloktaki ilk karakterin satır kutusuna göre sapması (d = karakter üstü - blok üstü)
    function findFirstLineTop(block) {
        const nodes = textNodes(block).filter(n => n.nodeValue.length > 0);
        if (!nodes.length) return { d: 0 };
        const r = charRect(nodes[0], 0);
        if (!r) return { d: 0 };
        // Blok üstünden sapma: aynı blokta ilk karakterin üstü
        const bt = block.getBoundingClientRect().top;
        return { d: (r.top - bt) / scale() };
    }

    // ---- Aktif Satır İçi (Inline) Üst/Alt Yazı Düzenleme Durumu ----
    let activeInlineEdit = null;

    function finishActiveInlineEdit() {
        if (activeInlineEdit && typeof activeInlineEdit.save === 'function') {
            activeInlineEdit.save();
        }
    }

    function startHeaderInlineEdit(hEl) {
        if (!hEl || hEl.classList.contains('pb-header-editing')) return;
        finishActiveInlineEdit();

        hEl.classList.add('pb-header-editing');
        const leftEl = hEl.querySelector('.pb-header-left');
        const rightEl = hEl.querySelector('.pb-header-right');

        if (leftEl) {
            leftEl.setAttribute('contenteditable', 'true');
            leftEl.setAttribute('spellcheck', 'false');
            leftEl.title = 'Mahkeme / Kurum adını düzenleyin';
        }
        if (rightEl) {
            rightEl.setAttribute('contenteditable', 'true');
            rightEl.setAttribute('spellcheck', 'false');
            rightEl.title = 'Dosya-Karar numarasını düzenleyin';
        }

        const toolbar = document.createElement('div');
        toolbar.className = 'pb-inline-toolbar';
        toolbar.setAttribute('contenteditable', 'false');
        toolbar.innerHTML = `
            <span class="pb-inline-title">Üst Yazı</span>
            <button type="button" class="pb-inline-btn pb-inline-btn-primary btn-save-inline" title="Değişiklikleri Kaydet (Enter)">💾 Kaydet</button>
            <button type="button" class="pb-inline-btn btn-modal-inline" title="Gelişmiş Üst Yazı Ayarları Penceresini Aç">⚙️ Ayarlar</button>
            <button type="button" class="pb-inline-btn btn-cancel-inline" title="Vazgeç (Esc)">✖ Kapat</button>
        `;
        hEl.appendChild(toolbar);

        let isSaved = false;
        const saveHeader = () => {
            if (isSaved) return;
            isSaved = true;
            const leftVal = leftEl ? ((leftEl.innerText !== undefined ? leftEl.innerText : leftEl.textContent) || '').trim() : '';
            const rightVal = rightEl ? ((rightEl.innerText !== undefined ? rightEl.innerText : rightEl.textContent) || '').trim() : '';

            hEl.classList.remove('pb-header-editing');
            toolbar.remove();
            if (leftEl) leftEl.removeAttribute('contenteditable');
            if (rightEl) rightEl.removeAttribute('contenteditable');
            activeInlineEdit = null;

            const curStart = (cfg.header && typeof cfg.header.startPage === 'number') ? cfg.header.startPage : 2;
            UkiPages.setHeader({
                left: leftVal,
                right: rightVal,
                startPage: curStart
            });

            if (window.currentDocModel) {
                if (!window.currentDocModel.headerInfo) window.currentDocModel.headerInfo = {};
                window.currentDocModel.headerInfo.left = leftVal;
                window.currentDocModel.headerInfo.right = rightVal;
                if (window.currentDocModel.pageProperties) {
                    if (!window.currentDocModel.pageProperties.headerInfo) window.currentDocModel.pageProperties.headerInfo = {};
                    window.currentDocModel.pageProperties.headerInfo.left = leftVal;
                    window.currentDocModel.pageProperties.headerInfo.right = rightVal;
                }
            }
            if (typeof window.showToast === 'function') {
                window.showToast('Üst yazı güncellendi.', 'success');
            }
        };

        const cancelHeader = () => {
            if (isSaved) return;
            isSaved = true;
            hEl.classList.remove('pb-header-editing');
            toolbar.remove();
            if (leftEl) leftEl.removeAttribute('contenteditable');
            if (rightEl) rightEl.removeAttribute('contenteditable');
            activeInlineEdit = null;
            repaginate();
        };

        toolbar.querySelector('.btn-save-inline').addEventListener('click', (ev) => {
            ev.stopPropagation();
            saveHeader();
        });
        toolbar.querySelector('.btn-cancel-inline').addEventListener('click', (ev) => {
            ev.stopPropagation();
            cancelHeader();
        });
        toolbar.querySelector('.btn-modal-inline').addEventListener('click', (ev) => {
            ev.stopPropagation();
            cancelHeader();
            if (window.openHeaderSetupModal) window.openHeaderSetupModal();
        });

        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                cancelHeader();
            } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                saveHeader();
            }
        };
        if (leftEl) leftEl.addEventListener('keydown', keyHandler);
        if (rightEl) rightEl.addEventListener('keydown', keyHandler);

        activeInlineEdit = { type: 'header', el: hEl, save: saveHeader, cancel: cancelHeader };

        setTimeout(() => {
            if (leftEl) {
                leftEl.focus();
                try {
                    const r = document.createRange();
                    r.selectNodeContents(leftEl);
                    r.collapse(false);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(r);
                } catch (e) {}
            }
        }, 20);
    }

    function startFooterTextInlineEdit(fEl) {
        if (!fEl || fEl.classList.contains('pb-footer-editing')) return;
        finishActiveInlineEdit();

        fEl.classList.add('pb-footer-editing');
        fEl.setAttribute('contenteditable', 'true');
        fEl.setAttribute('spellcheck', 'false');

        const toolbar = document.createElement('div');
        toolbar.className = 'pb-inline-toolbar';
        toolbar.setAttribute('contenteditable', 'false');
        toolbar.innerHTML = `
            <span class="pb-inline-title">Alt Yazı</span>
            <button type="button" class="pb-inline-btn pb-inline-btn-primary btn-save-inline" title="Değişiklikleri Kaydet (Enter)">💾 Kaydet</button>
            <button type="button" class="pb-inline-btn btn-modal-inline" title="Gelişmiş Alt Yazı Ayarları Penceresini Aç">⚙️ Ayarlar</button>
            <button type="button" class="pb-inline-btn btn-cancel-inline" title="Vazgeç (Esc)">✖ Kapat</button>
        `;
        fEl.appendChild(toolbar);

        let isSaved = false;
        const saveFooter = () => {
            if (isSaved) return;
            isSaved = true;
            toolbar.remove();
            const textVal = ((fEl.innerText !== undefined ? fEl.innerText : fEl.textContent) || '').trim();
            fEl.classList.remove('pb-footer-editing');
            fEl.removeAttribute('contenteditable');
            activeInlineEdit = null;

            cfg.footerParas = [{ tabSet: '', runs: [{ text: textVal, fontName: 'Times New Roman', size: 11 }] }];
            cfg.footerEl = true;
            cfg.showFooter = true;
            try { document.dispatchEvent(new (window.Event || Event)('uki-document-change')); } catch(e) {}
            repaginate();

            if (typeof window.showToast === 'function') {
                window.showToast('Alt yazı güncellendi.', 'success');
            }
        };

        const cancelFooter = () => {
            if (isSaved) return;
            isSaved = true;
            toolbar.remove();
            fEl.classList.remove('pb-footer-editing');
            fEl.removeAttribute('contenteditable');
            activeInlineEdit = null;
            repaginate();
        };

        toolbar.querySelector('.btn-save-inline').addEventListener('click', (ev) => {
            ev.stopPropagation();
            saveFooter();
        });
        toolbar.querySelector('.btn-cancel-inline').addEventListener('click', (ev) => {
            ev.stopPropagation();
            cancelFooter();
        });
        toolbar.querySelector('.btn-modal-inline').addEventListener('click', (ev) => {
            ev.stopPropagation();
            cancelFooter();
            if (window.openFooterSetupModal) window.openFooterSetupModal();
        });

        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                cancelFooter();
            } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                saveFooter();
            }
        };
        fEl.addEventListener('keydown', keyHandler);

        activeInlineEdit = { type: 'footer', el: fEl, save: saveFooter, cancel: cancelFooter };

        setTimeout(() => {
            fEl.focus();
            try {
                const r = document.createRange();
                r.selectNodeContents(fEl);
                r.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(r);
            } catch (e) {}
        }, 20);
    }

    // ---- Sayfa kromu (üst/alt bilgi, sayfa araları) ----
    function renderChrome(n) {
        if (!layer || !ed.contains(layer)) {
            layer = document.createElement('div');
            layer.id = 'page-boundaries-layer';
            layer.className = 'page-boundaries-layer';
            layer.setAttribute('contenteditable', 'false');
            ed.insertBefore(layer, ed.firstChild);
        }
        layer.style.cssText = 'position:absolute;top:0;left:0;right:0;height:0;margin:0;padding:0;pointer-events:none;z-index:6;';
        const g = lastGeom;
        layer.innerHTML = '';
        for (let k = 0; k < n; k++) {
            const pageTop = k * g.S;
            if (k < n - 1) {
                const gap = document.createElement('div');
                gap.className = 'pb-gap';
                gap.style.cssText = `top:${pageTop + g.H}px;height:${GAP}px;`;
                layer.appendChild(gap);
            }
            if (cfg.header && (k + 1) >= cfg.startPage) {
                const h = document.createElement('div');
                h.className = 'pb-header';
                h.title = 'Üst Yazı (Düzenlemek için çift tıklayın)';
                h.addEventListener('dblclick', (ev) => {
                    ev.stopPropagation();
                    startHeaderInlineEdit(h);
                });
                const hTopPt = cfg.headerOffsetPt > 0 ? cfg.headerOffsetPt : 15;
                const hTopPx = pageTop + Math.round(hTopPt * 96 / 72) + 2; // masaüstü PDF: üst bilgi tabanı 1.5pt aşağıda
                h.style.cssText = `top:${hTopPx}px;left:${g.Ml}px;right:${g.Mr}px;`;

                const leftEl = document.createElement('div');
                leftEl.className = 'pb-header-left';
                leftEl.textContent = (cfg.header && cfg.header.left) || '';

                const rightEl = document.createElement('div');
                rightEl.className = 'pb-header-right';
                const rText = (cfg.header && cfg.header.right) || '';
                if (rText) {
                    if (rText.startsWith('Dosya-Karar No:')) {
                        const b = document.createElement('b');
                        b.textContent = 'Dosya-Karar No:';
                        rightEl.appendChild(b);
                        const span = document.createElement('span');
                        span.textContent = rText.substring('Dosya-Karar No:'.length);
                        rightEl.appendChild(span);
                    } else if (rText.startsWith('Dosya-Karar:')) {
                        const b = document.createElement('b');
                        b.textContent = 'Dosya-Karar:';
                        rightEl.appendChild(b);
                        const span = document.createElement('span');
                        span.textContent = rText.substring('Dosya-Karar:'.length);
                        rightEl.appendChild(span);
                    } else {
                        rightEl.textContent = rText;
                    }
                    if (cfg.header && cfg.header.tabPosPt > 0) {
                        const tabPt = Math.max(0, cfg.header.tabPosPt - 5.0);
                        const tabPx = Math.round(tabPt * 96 / 72);
                        rightEl.style.position = 'absolute';
                        rightEl.style.left = tabPx + 'px';
                    }
                }

                const hStyle = cfg.header && cfg.header.style;
                if (hStyle) {
                    h.style.setProperty('font-size', (hStyle.size * 0.98).toFixed(2) + 'pt', 'important');
                    h.style.setProperty('color', hStyle.color || '#000', 'important');
                    h.style.setProperty('font-weight', hStyle.bold ? '700' : '400', 'important');
                    leftEl.style.setProperty('font-weight', hStyle.bold ? '700' : '400', 'important');
                }
                h.appendChild(leftEl);
                h.appendChild(rightEl);
                layer.appendChild(h);
            }
            // Sayfa Numarası (UYAP PDF standardı: Y0=753.2pt -> 1004.3px, X=right margin)
            if (cfg.showPageNumber !== false && (k > 0 || cfg.showPageNumberOnFirstPage)) {
                const num = document.createElement('div');
                num.className = 'pb-footer pb-pagenum';
                
                const curr = k + (cfg.pageNumberStartNum || 1);
                const total = n;

                function toRoman(val) {
                    if (val <= 0) return String(val);
                    const romanLookup = [
                        [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
                        [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
                        [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
                    ];
                    let s = '';
                    let temp = val;
                    for (const [v, sym] of romanLookup) {
                        while (temp >= v) {
                            s += sym;
                            temp -= v;
                        }
                    }
                    return s;
                }

                function toLetter(val) {
                    if (val <= 0) return String(val);
                    let s = '';
                    let temp = val;
                    while (temp > 0) {
                        const rem = (temp - 1) % 26;
                        s = String.fromCharCode(65 + rem) + s;
                        temp = Math.floor((temp - 1) / 26);
                    }
                    return s;
                }

                let baseFormatted = curr + '/' + total; // UYAP standartı
                if (cfg.pageNumberFormat === 'single') baseFormatted = String(curr);
                else if (cfg.pageNumberFormat === 'dash') baseFormatted = '- ' + curr + ' -';
                else if (cfg.pageNumberFormat === 'bracket') baseFormatted = '[ ' + curr + ' / ' + total + ' ]';
                else if (cfg.pageNumberFormat === 'word') baseFormatted = 'Sayfa ' + curr + ' / ' + total;
                else if (cfg.pageNumberFormat === 'page_of') baseFormatted = curr + ' of ' + total;
                else if (cfg.pageNumberFormat === 'dot') baseFormatted = curr + '.';
                else if (cfg.pageNumberFormat === 'bullet') baseFormatted = '• ' + curr + ' •';
                else if (cfg.pageNumberFormat === 'tilde') baseFormatted = '~ ' + curr + ' ~';
                else if (cfg.pageNumberFormat === 'roman') baseFormatted = toRoman(curr) + ' / ' + toRoman(total);
                else if (cfg.pageNumberFormat === 'roman_single') baseFormatted = toRoman(curr);
                else if (cfg.pageNumberFormat === 'letter') baseFormatted = toLetter(curr) + ' / ' + toLetter(total);

                let numStr = baseFormatted;
                if (cfg.pageNumberForeStr) {
                    if (cfg.pageNumberForeStr.includes('{page}')) {
                        numStr = cfg.pageNumberForeStr
                            .replace(/\{page\}/g, String(curr))
                            .replace(/\{total\}/g, String(total));
                    } else {
                        numStr = cfg.pageNumberForeStr + baseFormatted;
                    }
                }
                num.textContent = numStr;
                num.title = 'Sayfa Numarası (Biçimlendirmek için çift tıklayın)';
                num.addEventListener('dblclick', (ev) => {
                    ev.stopPropagation();
                    if (window.openPageNumSetupModal) window.openPageNumSetupModal();
                });

                const align = cfg.pageNumberAlign || 'right';
                let alignCss = `right:${(g.Mr - 2.67).toFixed(2)}px; text-align: right;`; // masaüstü PDF: numara 2pt daha sağda
                if (align === 'center') {
                    alignCss = `left:0; right:0; text-align: center; margin: 0 auto; width: 100%;`;
                } else if (align === 'left') {
                    alignCss = `left:${g.Ml}px; text-align: left;`;
                }
                const numTopPx = pageTop + Math.round(753.20 * 96 / 72);
                num.style.cssText = `top:${numTopPx}px; ${alignCss}`;
                layer.appendChild(num);
            }

            // Özel Belge Alt Yazısı (Alt yazı)
            if (cfg.showFooter !== false && cfg.footerParas && cfg.footerParas.length > 0) {
                const fText = cfg.footerParas.map(p => (p.runs || []).map(r => r.text || '').join('')).join(' ').trim();
                if (fText) {
                    const fDiv = document.createElement('div');
                    fDiv.className = 'pb-footer pb-footer-text';
                    fDiv.title = 'Alt Yazı (Düzenlemek için çift tıklayın)';
                    fDiv.addEventListener('dblclick', (ev) => {
                        ev.stopPropagation();
                        startFooterTextInlineEdit(fDiv);
                    });
                    const baseH = g.H > 0 ? g.H : 1123;
                    const footOffPt = cfg.footerOffsetPt > 0 ? cfg.footerOffsetPt : 20;
                    const fTopPx = pageTop + baseH - Math.round((footOffPt + 24) * 96 / 72);
                    fDiv.style.cssText = `top:${fTopPx}px;left:${g.Ml}px;text-align:left;font-family:'Times New Roman',serif;font-size:11pt;color:#333;`;
                    fDiv.textContent = fText;
                    layer.appendChild(fDiv);
                }
            }

            // Alt Bilgi Notu ve Doğrulama (UYAP PDF standardı: Y0=811.20pt -> 1081.6px, X0=65.88pt -> 87.84px, W=477.36pt -> 636.48px)
            if (cfg.showFooter !== false && cfg.webId) {
                const line = document.createElement('div');
                line.className = 'pb-footer pb-notice';
                line.title = 'Alt Bilgi Doğrulama (Düzenlemek için çift tıklayın)';
                line.addEventListener('dblclick', (ev) => {
                    ev.stopPropagation();
                    if (window.openFooterSetupModal) window.openFooterSetupModal();
                });
                const lineTopPx = pageTop + Math.round(807.00 * 96 / 72); // masaüstü PDF taban çizgisi ölçümüne göre (811.2pt kutu üstü -> 4.2pt yukarı)
                line.style.cssText = `top:${lineTopPx}px;left:87.84px;width:636.48px;`;
                if (cfg.qrCode) {
                    const qr = document.createElement('div');
                    qr.className = 'pb-qr pb-footer';
                    // UYAP PDF standardı: width=50.04pt (66.72px), height=50.04pt (66.72px), right=9.00pt (12px), Y0=774.00pt (1032px from pageTop)
                    const qrTopPx = pageTop + Math.round(774.00 * 96 / 72);
                    qr.style.cssText = `top:${qrTopPx}px;right:12px;width:66.72px;height:66.72px;`;
                    qr.innerHTML = qrSvg('https://evrakdogrula.uyap.gov.tr/' + cfg.qrCode, 66.72, true);
                    layer.appendChild(qr);
                }
                line.appendChild(document.createTextNode('UYAP Bilişim Sistemindeki bu dokümana http://vatandas.uyap.gov.tr adresinden  '));
                const code = document.createElement('b');
                code.textContent = cfg.webId;
                code.className = 'pb-copy-code';
                code.title = 'Tek tıkla kopyala';
                code.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    copyText(cfg.webId, code);
                });
                line.appendChild(code);
                line.appendChild(document.createTextNode('  ile erişebilirsiniz.'));
                layer.appendChild(line);
            }
        }
    }

    // ---- Ana giriş ----
    function repaginate() {
        if (!ed || busy || activeInlineEdit) return UkiPages.pageCount || 1;
        busy = true;
        let n = 1;
        try {
            const sel = saveSel();
            clearSpacers();
            n = paginate();
            if (n > 1 && !cfg.reserve) {
                // Çok sayfalı belgede sayfa numarası/alt bilgi vardır: alanı ayırıp yeniden böl
                cfg.reserve = true;
                clearSpacers();
                n = paginate();
            } else if (n === 1 && cfg.reserve && !cfg.webId && !cfg.footerEl) {
                cfg.reserve = false;
            }
            renderChrome(n);
            renderAntets(n, lastGeom);
            if (window.UkiCore && UkiCore.layoutTabs && layer) UkiCore.layoutTabs(layer);
            restoreSel(sel);
            UkiPages.pageCount = n;
        } catch (e) {
            console.error('Sayfalama hatası:', e);
        } finally {
            busy = false;
        }
        return n;
    }

    function headerTexts(model) {
        if (model && model.headerInfo) return model.headerInfo;
        const he = model && model.headerElement;
        if (!he || !he.paragraphs || !he.paragraphs.length) return null;
        const full = he.paragraphs.map(p => (p.runs || []).map(r => r.text || '').join(''))
            .join(' ').replace(/[\r\n]+/g, ' ').trim();
        let left = full, right = '';
        if (full.indexOf('\t') >= 0) {
            const parts = full.split('\t');
            left = parts[0].trim();
            right = parts.slice(1).join(' ').trim();
        } else if (full.indexOf('Dosya-Karar') >= 0) {
            const i = full.indexOf('Dosya-Karar');
            left = full.substring(0, i).trim();
            right = full.substring(i).trim();
        }
        const p0 = he.paragraphs[0] || {};
        const tabSet = p0.tabSet || '';
        const tabParts = tabSet ? tabSet.split(',')[0].split(':') : [];
        const tabPosPt = tabParts[0] ? parseFloat(tabParts[0]) : (right ? 255 : 0);
        const firstRun = (p0.runs && p0.runs[0]) || {};
        const fontSize = firstRun.size || 10;
        const fontFamily = firstRun.family || 'Times New Roman';
        const paras = he.paragraphs.map(p => ({ tabSet: p.tabSet || '', runs: (p.runs || []).map(r => ({ text: r.text || '', bold: !!r.bold })) }));
        const startPg = (he.startPage !== undefined && he.startPage !== null) ? he.startPage : (he.attrs && he.attrs.startPage ? parseInt(he.attrs.startPage, 10) : 1);
        return { left, right, startPage: startPg, paras, tabPosPt, fontSize, fontFamily };
    }

    const UkiPages = {
        pageCount: 1,
        GAP,
        init(editorEl, layerEl) {
            ed = editorEl;
            layer = layerEl || editorEl.querySelector('.page-boundaries-layer');
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => repaginate());
            window.addEventListener('resize', () => { clearTimeout(UkiPages._rt); UkiPages._rt = setTimeout(repaginate, 200); });

            // Üst veya alt kenar boşluğuna çift tıklanınca ilgili alanı düzenlemeye aç
            editorEl.addEventListener('dblclick', (e) => {
                if (e.target && e.target.closest && (e.target.closest('.pb-header') || e.target.closest('.pb-footer') || e.target.closest('.pb-inline-toolbar'))) {
                    return;
                }

                const g = lastGeom || (ed ? geom() : null);
                if (!g || !g.S) return;

                const edRect = editorEl.getBoundingClientRect();
                const sc = scale();
                const offsetY = (e.clientY - edRect.top) / sc;
                const pageIndex = Math.floor(offsetY / g.S);
                const inPageY = offsetY - (pageIndex * g.S);

                // Üst kenar boşluğu (Header alanı)
                if (inPageY >= 0 && inPageY < Math.max(75, g.Mt || 95)) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!cfg.header) {
                        cfg.header = {
                            left: 'T.C. MAHKEMESİ',
                            right: 'Dosya-Karar No: ',
                            startPage: 2,
                            paras: []
                        };
                        repaginate();
                    }
                    const hEl = layer ? layer.querySelector('.pb-header') : null;
                    if (hEl) {
                        startHeaderInlineEdit(hEl);
                    } else if (window.openHeaderSetupModal) {
                        window.openHeaderSetupModal();
                    }
                    return;
                }

                // Alt kenar boşluğu (Footer alanı)
                if (inPageY > (g.H - Math.max(75, g.Mb || 95)) && inPageY <= g.H) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!cfg.footerParas || !cfg.footerParas.length) {
                        cfg.footerParas = [{ tabSet: '', runs: [{ text: 'Alt Yazı Metni', fontName: 'Times New Roman', size: 11 }] }];
                        cfg.footerEl = true;
                        cfg.showFooter = true;
                        repaginate();
                    }
                    const fEl = layer ? layer.querySelector('.pb-footer-text') : null;
                    if (fEl) {
                        startFooterTextInlineEdit(fEl);
                    } else if (window.openFooterSetupModal) {
                        window.openFooterSetupModal();
                    }
                    return;
                }
            });

            // Düzenleme alanının dışına tıklanırsa otomatik kaydet ve kapat
            document.addEventListener('mousedown', (e) => {
                if (!activeInlineEdit) return;
                if (activeInlineEdit.el && (activeInlineEdit.el.contains(e.target) || activeInlineEdit.el === e.target)) {
                    return;
                }
                finishActiveInlineEdit();
            });
        },
        configure(model) {
            const h = headerTexts(model);
            cfg.header = h;
            cfg.startPage = h ? h.startPage : 2;
            cfg.webId = (model && model.webId) || '';
            const pp = (model && model.pageProperties) || {};
            cfg.headerOffsetPt = pp.headerFOffset > 0 ? pp.headerFOffset : 15;
            cfg.footerOffsetPt = pp.footerFOffset > 0 ? pp.footerFOffset : 60;
            cfg.signed = !!(model && model.isSigned);
            cfg.qrCode = (model && model.docProperties && model.docProperties.uyapdogrulamakodu) || '';
            const fe = model && model.footerElement;
            cfg.footerEl = !!fe;
            const saved = model && model.editorSettings || {};
            cfg.footerParas = (fe && fe.paragraphs) || [];
            cfg.pageNumberForeStr = (fe && fe.pageNumberForeStr) || (saved && saved.pageNumberForeStr) || '';
            cfg.pageNumberStartNum = (fe && fe.pageNumberStartNum) || 1;
            cfg.reserve = !!cfg.webId || cfg.footerEl;
            if (saved.webId !== undefined) cfg.webId = String(saved.webId);
            if (saved.qrCode !== undefined) cfg.qrCode = String(saved.qrCode);
            if (saved.pageNumberForeStr !== undefined) cfg.pageNumberForeStr = String(saved.pageNumberForeStr);
            cfg.reserve = !!cfg.webId || cfg.footerEl;
            cfg.showFooter = saved.showFooter !== false;
            cfg.showPageNumber = saved.showPageNumber !== undefined ? saved.showPageNumber : !!cfg.footerEl;
            cfg.pageNumberFormat = saved.pageNumberFormat || 'slash';
            cfg.pageNumberAlign = saved.pageNumberAlign || 'right';
            cfg.showPageNumberOnFirstPage = saved.showPageNumberOnFirstPage !== false;
        },
        getHeader() { return cfg.header ? { left: cfg.header.left, right: cfg.header.right, startPage: cfg.startPage, style: cfg.header.style || null } : null; },
        setHeader(hData) {
            if (!hData || (!hData.left && !hData.right)) {
                cfg.header = null;
            } else {
                const left = hData.left || '';
                const right = hData.right || '';
                const startPage = parseInt(hData.startPage, 10) || 2;
                const paras = [{
                    tabSet: '',
                    runs: [
                        { text: left, bold: true },
                        { text: right ? String.fromCharCode(9) + right : '', bold: true }
                    ]
                }];
                cfg.header = { left, right, startPage, paras, style: (hData.style || (cfg.header && cfg.header.style) || null) };
                cfg.startPage = startPage;
            }
            try { document.dispatchEvent(new (window.Event || Event)('uki-document-change')); } catch(e) {}
            repaginate();
        },
        removeHeader() {
            cfg.header = null;
            try { document.dispatchEvent(new (window.Event || Event)('uki-document-change')); } catch(e) {}
            repaginate();
        },
        setFooter(fData) {
            if (!fData) {
                cfg.showFooter = false;
            } else {
                cfg.showFooter = fData.showFooter !== undefined ? !!fData.showFooter : true;
                if (fData.webId !== undefined) cfg.webId = fData.webId;
                if (fData.qrCode !== undefined) cfg.qrCode = fData.qrCode;
                cfg.reserve = !!cfg.webId;
            }
            try { document.dispatchEvent(new (window.Event || Event)('uki-document-change')); } catch(e) {}
            repaginate();
        },
        removeFooter() {
            cfg.showFooter = false;
            cfg.webId = '';
            cfg.qrCode = '';
            cfg.reserve = false;
            try { document.dispatchEvent(new (window.Event || Event)('uki-document-change')); } catch(e) {}
            repaginate();
        },
        setPageNumber(pData) {
            if (!pData) {
                cfg.showPageNumber = false;
            } else {
                cfg.showPageNumber = pData.showPageNumber !== undefined ? !!pData.showPageNumber : true;
                if (pData.pageNumberFormat) cfg.pageNumberFormat = pData.pageNumberFormat;
                if (pData.pageNumberAlign) cfg.pageNumberAlign = pData.pageNumberAlign;
                if (pData.pageNumberForeStr !== undefined) cfg.pageNumberForeStr = pData.pageNumberForeStr;
                if (pData.showPageNumberOnFirstPage !== undefined) cfg.showPageNumberOnFirstPage = !!pData.showPageNumberOnFirstPage;
            }
            try { document.dispatchEvent(new (window.Event || Event)('uki-document-change')); } catch(e) {}
            repaginate();
        },
        togglePageNumber() {
            cfg.showPageNumber = !cfg.showPageNumber;
            repaginate();
            return cfg.showPageNumber;
        },
        getConfig() { return Object.assign({}, cfg); },
        qrSvg,
        copyText,
        reset() { cfg.header = null; cfg.webId = ''; cfg.startPage = 2; cfg.signed = false; cfg.qrCode = ''; cfg.reserve = false; cfg.footerEl = false; cfg.footerOffsetPt = 60; cfg.showFooter = true; cfg.showPageNumber = false; cfg.pageNumberFormat = 'slash'; cfg.pageNumberAlign = 'right'; cfg.pageNumberForeStr = ''; cfg.showPageNumberOnFirstPage = true; },
        repaginate,
        updatePages() { return window.UkiApp ? window.UkiApp.refresh() : repaginate(); },
        geometry() { return lastGeom || (ed ? geom() : null); },
        /** Sayfa k (1 tabanlı) üst konumu: editör üstüne göre px (zoom'dan bağımsız) */
        pageTop(k) { const g = UkiPages.geometry(); return (k - 1) * g.S; },
        /** Editör üst kenarının, kaydırma alanına göre mutlak ofseti (zoom dahil) */
        pageFromScroll(container) {
            const g = UkiPages.geometry();
            const sc = scale();
            const cTop = container.getBoundingClientRect().top;
            const edTop = ed.getBoundingClientRect().top;
            const mid = (cTop + container.clientHeight * 0.35) - edTop;
            return Math.max(1, Math.min(UkiPages.pageCount, Math.floor(mid / sc / g.S) + 1));
        },
        scrollTo(container, k) {
            const g = UkiPages.geometry();
            const sc = scale();
            const edTop = ed.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
            container.scrollTo({ top: Math.max(0, edTop + (k - 1) * g.S * sc - 12), behavior: 'smooth' });
        },
        scale,
        startHeaderInlineEdit,
        startFooterTextInlineEdit,
        finishActiveInlineEdit
    };

    window.UkiPages = UkiPages;
})(window);
