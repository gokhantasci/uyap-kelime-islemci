/* Üst eylem pill'lerini sadeleştirir: ikincil eylemler "Daha Fazla" menüsüne taşınır.
   Düğümler taşınır (kopyalanmaz), böylece mevcut olay dinleyicileri çalışmaya devam eder. */
(function () {
    'use strict';
    var SECONDARY = ['ude-pill-diff', 'ude-pill-versions', 'ude-pill-access-code', 'ude-pill-kvkk', 'ude-pill-zen'];

    function init() {
        var bar = document.querySelector('.ude-toolbar-actions-right');
        if (!bar || bar.querySelector('.ude-more-wrap')) return;
        var wrap = document.createElement('div');
        wrap.className = 'ude-more-wrap';
        var trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'ude-pill-feature';
        trigger.id = 'ude-pill-more';
        trigger.title = 'Daha fazla araç';
        trigger.setAttribute('aria-haspopup', 'menu');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.innerHTML = '<span>Daha Fazla</span><span aria-hidden="true">▾</span>';
        var menu = document.createElement('div');
        menu.className = 'ude-more-menu';
        menu.setAttribute('role', 'menu');
        SECONDARY.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) menu.appendChild(el);
        });
        wrap.appendChild(trigger);
        wrap.appendChild(menu);
        var word = document.getElementById('ude-pill-docx');
        bar.insertBefore(wrap, word || null);

        function close() { menu.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); }
        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = menu.classList.toggle('open');
            if (open) {
                var r = trigger.getBoundingClientRect();
                menu.style.top = (r.bottom + 6) + 'px';
                menu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
            }
            trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        menu.addEventListener('click', close);
        document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) close(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
