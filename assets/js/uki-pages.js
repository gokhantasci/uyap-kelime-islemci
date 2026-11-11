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
        'e-sign-seal-badge', 'udf-seal-stamp', 'pb-spacer'];

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
        if (!sel || sel.rangeCount === 0 || !ed.contains(sel.anchorNode) || document.activeElement !== ed) return null;
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
        return (a < 0 || f < 0) ? null : { a, f };
    }
    function restoreSel(s) {
        if (!s) return;
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
        const sel = window.getSelection();
        sel.setBaseAndExtent(a[0], a[1], f[0], f[1]);
    }

    // ---- Karakter geometrisi ----
    function charRect(node, off) {
        const r = document.createRange();
        r.setStart(node, off);
        r.setEnd(node, Math.min(off + 1, node.nodeValue.length));
        const rects = r.getClientRects();
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
                const sp = findSplitPoint(block, limit);
                if (!sp) break; // hiçbir karakter sınırı aşmıyor: sığıyor
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
                h.style.cssText = `top:${pageTop + (cfg.antetBase > 0 ? cfg.antetBase + 6 : 36)}px;left:${g.Ml}px;right:${g.Mr}px;`;

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
                        rightEl.appendChild(document.createTextNode(rText.substring('Dosya-Karar No:'.length)));
                    } else if (rText.startsWith('Dosya-Karar:')) {
                        const b = document.createElement('b');
                        b.textContent = 'Dosya-Karar:';
                        rightEl.appendChild(b);
                        rightEl.appendChild(document.createTextNode(rText.substring('Dosya-Karar:'.length)));
                    } else {
                        rightEl.textContent = rText;
                    }
                }

                h.appendChild(leftEl);
                h.appendChild(rightEl);
                layer.appendChild(h);
            }
            // Sayfa Numarası (örnek karar.pdf: Y=1017.6px -> g.H - 105px, X=680px -> right: g.Mr + 4px)
            if (cfg.showPageNumber !== false && (k > 0 || cfg.showPageNumberOnFirstPage)) {
                const num = document.createElement('div');
                num.className = 'pb-footer pb-pagenum';
                let numStr = (k + 1) + '/' + n;
                if (cfg.pageNumberFormat === 'single') numStr = String(k + 1);
                else if (cfg.pageNumberFormat === 'dash') numStr = '- ' + (k + 1) + ' -';
                else if (cfg.pageNumberFormat === 'bracket') numStr = '[ ' + (k + 1) + ' / ' + n + ' ]';
                else if (cfg.pageNumberFormat === 'word') numStr = 'Sayfa ' + (k + 1) + ' / ' + n;
                else if (cfg.pageNumberFormat === 'page_of') numStr = (k + 1) + ' of ' + n;
                num.textContent = numStr;

                const align = cfg.pageNumberAlign || 'right';
                let alignCss = `right:${g.Mr + 4}px; text-align: right;`;
                if (align === 'center') {
                    alignCss = `left:0; right:0; text-align: center; margin: 0 auto; width: 100%;`;
                } else if (align === 'left') {
                    alignCss = `left:${g.Ml}px; text-align: left;`;
                }
                num.style.cssText = `top:${pageTop + g.H - 118}px; ${alignCss}`;
                layer.appendChild(num);
            }

            // Alt Bilgi Notu ve Doğrulama (örnek karar.pdf: Y=1081.6px -> g.H - 41px)
            if (cfg.showFooter !== false && cfg.webId) {
                const line = document.createElement('div');
                line.className = 'pb-footer pb-notice';
                line.style.cssText = `top:${pageTop + g.H - 41}px;left:${g.Ml}px;right:${g.Mr}px;`;
                if (cfg.qrCode) {
                    const qr = document.createElement('div');
                    qr.className = 'pb-qr pb-footer';
                    // Doğrulama Karekodu (örnek karar.pdf: X=[715, 782] -> right: 12px; Y=[1032, 1098.7] -> top: g.H - 91px; 67x67px / 50pt)
                    qr.style.cssText = `top:${pageTop + g.H - 91}px;right:12px;width:67px;height:67px;`;
                    qr.innerHTML = qrSvg('https://evrakdogrula.uyap.gov.tr/' + cfg.qrCode, 67, true);
                    layer.appendChild(qr);
                }
                line.appendChild(document.createTextNode('UYAP Bilişim Sistemindeki bu dokümana http://vatandas.uyap.gov.tr adresinden '));
                const code = document.createElement('b');
                code.textContent = cfg.webId;
                code.className = 'pb-copy-code';
                code.title = 'Tek tıkla kopyala';
                code.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    copyText(cfg.webId, code);
                });
                line.appendChild(code);
                line.appendChild(document.createTextNode(' ile erişebilirsiniz.'));
                layer.appendChild(line);
            }
        }
    }

    // ---- Ana giriş ----
    function repaginate() {
        if (!ed || busy) return UkiPages.pageCount || 1;
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
        const paras = he.paragraphs.map(p => ({ tabSet: p.tabSet || '', runs: (p.runs || []).map(r => ({ text: r.text || '', bold: !!r.bold })) }));
        return { left, right, startPage: he.startPage || 1, paras };
    }

    const UkiPages = {
        pageCount: 1,
        GAP,
        init(editorEl, layerEl) {
            ed = editorEl;
            layer = layerEl || editorEl.querySelector('.page-boundaries-layer');
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => repaginate());
            window.addEventListener('resize', () => { clearTimeout(UkiPages._rt); UkiPages._rt = setTimeout(repaginate, 200); });
        },
        configure(model) {
            const h = headerTexts(model);
            cfg.header = h;
            cfg.startPage = h ? h.startPage : 2;
            cfg.webId = (model && model.webId) || '';
            const pp = (model && model.pageProperties) || {};
            cfg.footerOffsetPt = pp.footerFOffset > 0 ? pp.footerFOffset : 60;
            cfg.signed = !!(model && model.isSigned);
            cfg.qrCode = (model && model.docProperties && model.docProperties.uyapdogrulamakodu) || '';
            cfg.footerEl = !!(model && model.footerElement);
            cfg.reserve = !!cfg.webId || cfg.footerEl;
            const saved = model && model.editorSettings || {};
            if (saved.webId !== undefined) cfg.webId = String(saved.webId);
            if (saved.qrCode !== undefined) cfg.qrCode = String(saved.qrCode);
            cfg.reserve = !!cfg.webId || cfg.footerEl;
            cfg.showFooter = saved.showFooter !== false;
            cfg.showPageNumber = saved.showPageNumber !== undefined ? saved.showPageNumber : !!cfg.footerEl;
            cfg.pageNumberFormat = saved.pageNumberFormat || 'slash';
            cfg.pageNumberAlign = saved.pageNumberAlign || 'right';
            cfg.showPageNumberOnFirstPage = saved.showPageNumberOnFirstPage !== false;
        },
        getHeader() { return cfg.header ? { left: cfg.header.left, right: cfg.header.right, startPage: cfg.startPage } : null; },
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
                cfg.header = { left, right, startPage, paras };
                cfg.startPage = startPage;
            }
            document.dispatchEvent(new Event('uki-document-change'));
            repaginate();
        },
        removeHeader() {
            cfg.header = null;
            document.dispatchEvent(new Event('uki-document-change'));
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
            document.dispatchEvent(new Event('uki-document-change'));
            repaginate();
        },
        removeFooter() {
            cfg.showFooter = false;
            cfg.webId = '';
            cfg.qrCode = '';
            cfg.reserve = false;
            document.dispatchEvent(new Event('uki-document-change'));
            repaginate();
        },
        setPageNumber(pData) {
            if (!pData) {
                cfg.showPageNumber = false;
            } else {
                cfg.showPageNumber = pData.showPageNumber !== undefined ? !!pData.showPageNumber : true;
                if (pData.pageNumberFormat) cfg.pageNumberFormat = pData.pageNumberFormat;
                if (pData.pageNumberAlign) cfg.pageNumberAlign = pData.pageNumberAlign;
                if (pData.showPageNumberOnFirstPage !== undefined) cfg.showPageNumberOnFirstPage = !!pData.showPageNumberOnFirstPage;
            }
            document.dispatchEvent(new Event('uki-document-change'));
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
        reset() { cfg.header = null; cfg.webId = ''; cfg.startPage = 2; cfg.signed = false; cfg.qrCode = ''; cfg.reserve = false; cfg.footerEl = false; cfg.footerOffsetPt = 60; cfg.showFooter = true; cfg.showPageNumber = false; cfg.pageNumberFormat = 'slash'; cfg.showPageNumberOnFirstPage = true; },
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
        scale
    };

    window.UkiPages = UkiPages;
})(window);
