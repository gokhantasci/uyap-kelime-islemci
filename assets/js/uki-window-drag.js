/* Pencereleri (modal + renk paleti) başlığından sürükleyip taşıma; son konum tarayıcıda hatırlanır. */
(function (window, document) {
    'use strict';
    var PREFIX = 'uki-win-pos:';
    var MARGIN = 40; // başlıktan en az bu kadar piksel ekranda kalsın

    function load(key) {
        try { return JSON.parse(localStorage.getItem(PREFIX + key) || 'null'); } catch (_) { return null; }
    }
    function save(key, pos) {
        try { localStorage.setItem(PREFIX + key, JSON.stringify(pos)); } catch (_) { /* yoksay */ }
    }
    function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

    /* ---------- Modal pencereler (.ax-modal-dialog) ---------- */
    function dialogKey(dlg) {
        var bd = dlg.closest('.ax-modal-backdrop');
        if (bd && bd.id) return bd.id;
        var h = dlg.querySelector('.ax-modal-header h3, .ax-modal-header');
        return 'dlg:' + (h ? h.textContent.trim().slice(0, 40) : 'x');
    }

    function applyDialogPos(dlg) {
        var key = dialogKey(dlg);
        var pos = load(key);
        if (!pos) { dlg.style.translate = ''; return; }
        // Pencere içeriği değişmiş/ekran küçülmüş olabilir: görünür alanda tut
        var r = dlg.getBoundingClientRect();
        if (!r.width) return;
        var baseLeft = r.left - (parseFloat(dlg._dx) || 0);
        var baseTop = r.top - (parseFloat(dlg._dy) || 0);
        var dx = clamp(pos.x, MARGIN - r.width - baseLeft, window.innerWidth - MARGIN - baseLeft);
        var dy = clamp(pos.y, -baseTop, window.innerHeight - MARGIN - baseTop);
        dlg._dx = dx; dlg._dy = dy;
        dlg.style.translate = dx + 'px ' + dy + 'px';
    }

    document.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        var head = e.target.closest && e.target.closest('.ax-modal-header');
        if (!head || e.target.closest('button, input, select, textarea, a')) return;
        var dlg = head.closest('.ax-modal-dialog');
        if (!dlg) return;
        e.preventDefault();
        var startX = e.clientX, startY = e.clientY;
        var origX = parseFloat(dlg._dx) || 0, origY = parseFloat(dlg._dy) || 0;
        var r0 = dlg.getBoundingClientRect();
        var baseLeft = r0.left - origX, baseTop = r0.top - origY;
        head.style.cursor = 'grabbing';
        function move(ev) {
            var dx = clamp(origX + ev.clientX - startX, MARGIN - r0.width - baseLeft, window.innerWidth - MARGIN - baseLeft);
            var dy = clamp(origY + ev.clientY - startY, -baseTop, window.innerHeight - MARGIN - baseTop);
            dlg._dx = dx; dlg._dy = dy;
            dlg.style.translate = dx + 'px ' + dy + 'px';
        }
        function up() {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
            head.style.cursor = '';
            save(dialogKey(dlg), { x: dlg._dx || 0, y: dlg._dy || 0 });
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    });

    function watchBackdrop(bd) {
        if (bd._ukiDragWatched) return;
        bd._ukiDragWatched = true;
        var dlg = function () { return bd.querySelector('.ax-modal-dialog'); };
        var obs = new MutationObserver(function () {
            var d = dlg();
            if (d && getComputedStyle(bd).display !== 'none') applyDialogPos(d);
        });
        obs.observe(bd, { attributes: true, attributeFilter: ['style', 'class'] });
        var d0 = dlg();
        if (d0 && getComputedStyle(bd).display !== 'none') applyDialogPos(d0);
    }

    function scan(root) {
        (root.querySelectorAll ? root.querySelectorAll('.ax-modal-backdrop') : []).forEach(watchBackdrop);
        if (root.classList && root.classList.contains('ax-modal-backdrop')) watchBackdrop(root);
    }

    /* ---------- Serbest (fixed) pencereler: renk paleti vb. ---------- */
    function attachFixed(box, handle, key) {
        handle.style.cursor = 'grab';
        handle.addEventListener('mousedown', function (e) {
            if (e.button !== 0 || (e.target.closest && e.target.closest('button, input'))) return;
            e.preventDefault();
            var sx = e.clientX, sy = e.clientY;
            var ox = box.offsetLeft, oy = box.offsetTop;
            function move(ev) {
                box.style.left = clamp(ox + ev.clientX - sx, 0, window.innerWidth - MARGIN) + 'px';
                box.style.top = clamp(oy + ev.clientY - sy, 0, window.innerHeight - MARGIN) + 'px';
            }
            function up() {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                save(key, { left: box.offsetLeft, top: box.offsetTop });
            }
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });
        var pos = load(key);
        if (pos && typeof pos.left === 'number') {
            box.style.left = clamp(pos.left, 0, Math.max(0, window.innerWidth - box.offsetWidth)) + 'px';
            box.style.top = clamp(pos.top, 0, Math.max(0, window.innerHeight - 60)) + 'px';
            return true;
        }
        return false;
    }

    function init() {
        scan(document);
        new MutationObserver(function (muts) {
            muts.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); }); });
        }).observe(document.body, { childList: true });
    }

    window.UkiWinDrag = { attachFixed: attachFixed };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})(window, document);
