/**
 * UYAP Kelime İşlemci (UKİ) - Derli toplu üst çubuk (e-UDF'ten esinlenen)
 *
 *  Üst çubuk : Logo · Dosya · Görünüm · Araçlar · Yardım · belge adı · İmzalı rozeti · UDF Kaydet
 *  Araç çubuğu: Geri/İleri · Yazı tipi/punto · B I U S · renk · hizalama · girinti/aralık · tablo/bul · Antet ▾ · Şablon · yakınlaştırma
 *
 *  Eski düğmeler silinmez: görünmez yapılır ve menü maddeleri onlara .click() gönderir; böylece mevcut kodun tüm
 *  olay bağlantıları ve kısayolları aynen çalışır.
 */
(function (window, document) {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const click = (id) => { const b = $(id); if (b) b.click(); };

    // ---------------- Simgeler ----------------
    const ic = (d) => '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
    const I = {
        thumbs: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>'),
        ruler: ic('<path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4z"/><path d="m7.5 10.5 2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2"/>'),
        shield: ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
        moon: ic('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),
        theme: ic('<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>'),
        desktop: ic('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
        zoom: ic('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>'),
        full: ic('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
        sign: ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>'),
        find: ic('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
        book: ic('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
        tip: ic('<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/>'),
        scan: ic('<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/>'),
        md: ic('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 15V9l3 3 3-3v6M17 9v6M15 13l2 2 2-2"/>'),
        chart: ic('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
        info: ic('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
        keyboard: ic('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M7 15h10"/>'),
        lock: ic('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
        user: ic('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
        watermark: ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
        image: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
        scales: ic('<path d="M12 3v18M5 7l7-4 7 4M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0z"/>'),
        textColor: ic('<path d="M4 20h16M12 4L5 18h2.4l1.4-3h6.4l1.4 3H19L12 4zm-2.3 9l2.3-5.5 2.3 5.5H9.7z"/>'),
        paper: ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
        canvas: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>'),
        undo: ic('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>'),
        redo: ic('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>'),
        pageSetup: ic('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>'),
        header: ic('<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="8" y1="5.5" x2="16" y2="5.5"/>'),
        headerRemove: ic('<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="10" y1="13" x2="14" y2="17"/><line x1="14" y1="13" x2="10" y2="17"/>'),
        footer: ic('<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="4" y1="16" x2="20" y2="16"/><line x1="8" y1="18.5" x2="16" y2="18.5"/>'),
        footerRemove: ic('<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="4" y1="16" x2="20" y2="16"/><line x1="10" y1="7" x2="14" y2="11"/><line x1="14" y1="7" x2="10" y2="11"/>'),
        pageNum: ic('<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="10" y1="10" x2="12" y2="8"/>'),
        pageBreak: ic('<path d="M4 4h16M4 20h16"/><line x1="2" y1="12" x2="22" y2="12" stroke-dasharray="3 3"/>'),
        table: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>'),
        chevron: '<svg class="fm-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>',
        check: '<svg class="fm-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
        caret: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>'
    };

    // ---------------- Menü kurucu (Dosya menüsüyle aynı görünüm) ----------------
    const openMenus = [];
    function closeAll(except) { openMenus.forEach((m) => { if (m !== except) m.close(); }); }

    function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

    function makeItem(spec, menu) {
        if (spec === '-') return el('div', 'fm-divider');
        if (spec.group) { const g = el('div', 'fm-group'); g.textContent = spec.group; return g; }
        const b = el('button', 'fm-item');
        b.type = 'button';
        b.setAttribute('role', spec.check ? 'menuitemcheckbox' : 'menuitem');
        const ico = el('span', 'fm-ico'); ico.innerHTML = spec.icon || '';
        const label = el('span', 'fm-label'); label.textContent = spec.label;
        b.appendChild(ico);
        b.appendChild(label);
        if (spec.kbd) { const k = el('kbd', 'fm-kbd'); k.textContent = spec.kbd; b.appendChild(k); }
        if (spec.check) {
            const mark = el('span', 'fm-mark'); mark.innerHTML = I.check; b.appendChild(mark);
            b._refresh = () => { const on = !!spec.check(); b.setAttribute('aria-checked', on ? 'true' : 'false'); mark.style.visibility = on ? 'visible' : 'hidden'; };
        }
        if (spec.sub) {
            const wrap = el('div', 'fm-sub-wrap');
            const sub = el('div', 'fm-sub');
            sub.setAttribute('role', 'menu');
            spec.sub.forEach((s) => sub.appendChild(makeItem(s, menu)));
            b.insertAdjacentHTML('beforeend', I.chevron);
            wrap.appendChild(b);
            wrap.appendChild(sub);
            wrap.addEventListener('mouseenter', () => wrap.classList.add('open'));
            wrap.addEventListener('mouseleave', () => wrap.classList.remove('open'));
            b.addEventListener('click', (e) => { e.stopPropagation(); wrap.classList.toggle('open'); });
            return wrap;
        }
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.close();
            if (spec.run) spec.run(e);
        });
        return b;
    }

    function makeMenu(label, specs, opts) {
        const root = el('div', 'fm-root tb-menu' + (opts && opts.cls ? ' ' + opts.cls : ''));
        const trigger = el('button', 'fm-trigger' + (opts && opts.flat ? ' tb-flat' : ''));
        trigger.type = 'button';
        trigger.setAttribute('aria-haspopup', 'menu');
        trigger.setAttribute('aria-expanded', 'false');
        if (opts && opts.icon) trigger.insertAdjacentHTML('beforeend', opts.icon);
        const t = document.createElement('span'); t.textContent = label; trigger.appendChild(t);
        trigger.insertAdjacentHTML('beforeend', I.caret);
        if (opts && opts.title) trigger.title = opts.title;
        const panel = el('div', 'fm-menu');
        panel.setAttribute('role', 'menu');
        panel.hidden = true;
        const menu = {
            close() { panel.hidden = true; root.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); panel.querySelectorAll('.fm-sub-wrap.open').forEach((w) => w.classList.remove('open')); },
            open() {
                closeAll(menu);
                document.dispatchEvent(new CustomEvent('uki-menu-open', { detail: 'topbar' })); // Dosya menüsünü kapat
                panel.querySelectorAll('.fm-item').forEach((b) => b._refresh && b._refresh());
                panel.hidden = false; root.classList.add('open'); trigger.setAttribute('aria-expanded', 'true');
                try {
                    const rect = panel.getBoundingClientRect();
                    const maxAllowed = (typeof window !== 'undefined' ? window.innerHeight : 800) - rect.top - 12;
                    if (maxAllowed > 100 && rect.bottom > (typeof window !== 'undefined' ? window.innerHeight : 800)) {
                        panel.style.maxHeight = maxAllowed + 'px';
                        panel.style.overflowY = 'auto';
                    }
                } catch (_) {}
            }
        };
        specs.forEach((s) => panel.appendChild(makeItem(s, menu)));
        trigger.addEventListener('click', (e) => { e.stopPropagation(); panel.hidden ? menu.open() : menu.close(); });
        root.appendChild(trigger);
        root.appendChild(panel);
        openMenus.push(menu);
        return root;
    }

    document.addEventListener('click', () => closeAll(null));
    document.addEventListener('uki-menu-open', (e) => { if (e.detail === 'file') closeAll(null); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(null); });

    // ---------------- Durum yardımcıları ----------------
    const isActive = (id) => () => { const b = $(id); return !!(b && b.classList.contains('active')); };
    const dark = () => document.documentElement.getAttribute('data-theme') === 'dark';
    const classic = () => document.documentElement.getAttribute('data-ui-theme') === 'uyap-classic';

    function zoomItems() {
        return [75, 90, 100, 125, 150].map((z) => ({
            label: '%' + z,
            check: () => { const s = $('zoom-select'); return !!s && Number(s.value) === z; },
            run: () => { const s = $('zoom-select'); if (s) { s.value = String(z); s.dispatchEvent(new Event('change', { bubbles: true })); } }
        }));
    }

    function aboutDeveloper() {
        const msg = 'UYAP Kelime İşlemci\nSunucusuz, tarayıcıda çalışan UDF açıcı ve düzenleyici.\n\nGeliştirici: Gökhan TAŞÇI\nSakarya Yazı İşleri Müdürü (Sicil No: 139329)';
        if (window.UkiDialog) window.UkiDialog.alert(msg, { title: 'Hakkında', okText: 'Kapat' });
    }

    function buildMenus() {
        const exec = (cmd) => { const ed = $('editor'); if (ed) ed.focus(); try { document.execCommand(cmd); } catch (_) { /* yoksay */ } };
        const edit = makeMenu('Düzenle', [
            { icon: I.undo, label: 'Geri al', kbd: 'Ctrl+Z', run: () => click('btn-tb-undo') },
            { icon: I.redo, label: 'İleri al', kbd: 'Ctrl+Y', run: () => click('btn-tb-redo') },
            '-',
            { icon: I.scan, label: 'Kes', kbd: 'Ctrl+X', run: () => exec('cut') },
            { icon: I.paper, label: 'Kopyala', kbd: 'Ctrl+C', run: () => exec('copy') },
            {
                icon: I.paper, label: 'Yapıştır', kbd: 'Ctrl+V', run: () => {
                    const ed = $('editor'); if (ed) ed.focus();
                    if (navigator.clipboard && navigator.clipboard.readText) {
                        navigator.clipboard.readText().then((t) => { document.execCommand('insertText', false, t); }, () => {
                            if (window.showToast) window.showToast('Yapıştırmak için Ctrl+V tuşunu kullanın (tarayıcı pano izni gerekli).', 'info');
                        });
                    } else if (window.showToast) window.showToast('Yapıştırmak için Ctrl+V tuşunu kullanın.', 'info');
                }
            },
            '-',
            { icon: I.find, label: 'Bul ve değiştir', kbd: 'Ctrl+F', run: () => click('btn-find-replace') },
            { icon: I.find, label: 'Sayfaya git…', kbd: 'Ctrl+G', run: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true, cancelable: true })) }
        ]);

        const format = makeMenu('Biçim', [
            { icon: I.textColor, label: 'Yazı tipi…', kbd: 'Ctrl+D', run: () => click('btn-font-dialog') },
            { icon: I.pageSetup, label: 'Paragraf…', run: () => click('btn-para-setup') },
            '-',
            {
                icon: I.check, label: 'Otomatik büyük harf (cümle başı)',
                check: () => { const c = $('chk-auto-caps'); return !!(c && c.checked); },
                run: () => { const c = $('chk-auto-caps'); if (c) { c.checked = !c.checked; c.dispatchEvent(new Event('change', { bubbles: true })); } }
            }
        ]);

        const insert = makeMenu('Ekle', [
            { icon: I.header, label: 'Üst yazı (üst bilgi)…', run: () => window.openHeaderSetupModal && window.openHeaderSetupModal() },
            { icon: I.headerRemove, label: 'Üst yazıyı kaldır', run: () => window.removeDocumentHeader && window.removeDocumentHeader() },
            '-',
            { icon: I.footer, label: 'Alt yazı (alt bilgi)…', run: () => window.openFooterSetupModal && window.openFooterSetupModal() },
            { icon: I.footerRemove, label: 'Alt yazıyı kaldır', run: () => window.removeDocumentFooter && window.removeDocumentFooter() },
            '-',
            { icon: I.pageNum, label: 'Sayfa numarası…', run: () => window.openPageNumSetupModal && window.openPageNumSetupModal() },
            { icon: I.pageBreak, label: 'Tab (sekme boşluğu)', kbd: 'Tab', run: () => { const ed = $('editor'); if (ed) ed.focus(); document.execCommand('insertText', false, '\t'); } },
            { icon: I.pageBreak, label: 'Sayfa kesmesi (sonraki sayfa)', kbd: 'Ctrl+Enter', run: () => window.insertPageBreak && window.insertPageBreak() },
            { icon: I.find, label: 'Sayfaya git…', kbd: 'Ctrl+G', run: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true, cancelable: true })) },
            '-',
            { icon: I.table, label: 'Tablo ekle…', run: () => click('btn-insert-table') },
            { icon: I.image, label: 'Resim ekle / düzenle…', run: () => window.UkiImage && window.UkiImage.triggerImageAction() },
            { icon: I.image, label: 'Antet / arka plan resmi…', run: () => click('btn-antet-setup') },
            { icon: I.tip, label: 'Sembol ekle…', run: () => window.UkiImage && window.UkiImage.openSymbolPicker() },
            { icon: I.sign, label: 'Barkod ekle…', run: () => window.UkiImage && window.UkiImage.openBarcodeModal() },
            { icon: I.full, label: 'Köprü ekle…', run: () => window.UkiImage && window.UkiImage.openLinkModal() }
        ]);

        const view = makeMenu('Görünüm', [
            { icon: I.pageSetup, label: 'Sayfa yapısı…', run: () => click('btn-page-setup') },
            { icon: I.ruler, label: 'Görünmez karakterler', check: () => { const e = $('editor'); return !!(e && e.classList.contains('show-invisibles')); }, run: () => { if (window.toggleInvisibleChars) window.toggleInvisibleChars(); else click('btn-toggle-invisibles'); } },
            '-',
            { icon: I.thumbs, label: 'Sayfa önizlemeleri', kbd: 'Ctrl+G', check: isActive('btn-toggle-thumbnails'), run: () => click('btn-toggle-thumbnails') },
            { icon: I.ruler, label: 'Cetvel', check: isActive('btn-toggle-ruler'), run: () => click('btn-toggle-ruler') },
            { icon: I.ruler, label: 'Mizanpaj denetçisi (Layout Debugger)', kbd: 'Ctrl+Alt+D', check: () => !!(window.UkiLayoutDebugger && window.UkiLayoutDebugger.isEnabled()), run: () => window.UkiLayoutDebugger && window.UkiLayoutDebugger.toggle() },
            { icon: I.watermark, label: 'Güvenlik filigranı', check: isActive('btn-toggle-watermark'), run: () => click('btn-toggle-watermark') },
            { icon: I.moon, label: 'Sayfa koyu (gece okuma)', check: isActive('btn-doc-dark'), run: () => click('btn-doc-dark') },
            '-',
            { icon: I.paper, label: 'Sayfa rengi (kâğıt)…', run: (e) => window.openColorPicker && window.openColorPicker('page-color-picker', e) },
            { icon: I.canvas, label: 'Tuval rengi (masaüstü)…', run: (e) => window.openColorPicker && window.openColorPicker('canvas-color-picker', e) },
            { icon: I.undo, label: 'Tasarımı ve renkleri sıfırla', run: () => window.resetDesignToDefault && window.resetDesignToDefault() },
            '-',
            { icon: I.zoom, label: 'Yakınlaştırma', sub: zoomItems() },
            { icon: I.theme, label: 'Karanlık tema', kbd: 'Shift+Ctrl+D', check: dark, run: () => click('btn-theme-toggle') },
            { icon: I.desktop, label: 'Klasik UYAP tasarımı', check: classic, run: () => click('btn-uyap-classic-toggle') },
            { icon: I.full, label: 'Tam ekran', run: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); } }
        ]);

        const tools = makeMenu('Araçlar', [
            { icon: I.check, label: 'Harf denetimi (Tümünü denetle)…', kbd: 'F7', run: () => click('btn-spellcheck-all') },
            { icon: I.sign, label: 'Elektronik imzaları incele', kbd: 'Shift+Ctrl+G', run: () => click('btn-view-signatures') },
            { icon: I.find, label: 'Bul ve değiştir', kbd: 'Ctrl+F', run: () => click('btn-find-replace') },
            '-',
            { icon: I.book, label: 'Hukuk sözlüğü', kbd: 'Alt+S', run: () => click('btn-legal-dictionary') },
            {
                icon: I.tip, label: 'Sözlük ipuçları (üzerine gelince)',
                check: () => !!(window.UkiDictionary && window.UkiDictionary.isHoverEnabled && window.UkiDictionary.isHoverEnabled()),
                run: () => { const d = window.UkiDictionary; if (d && d.setHoverEnabled) d.setHoverEnabled(!d.isHoverEnabled(), true); }
            },
            { icon: I.scan, label: 'Belge tara (OCR)', run: () => click('btn-ocr-scan') },
            '-',
            { icon: I.md, label: 'Markdown (.md) olarak indir', run: () => click('btn-export-md') },
            { icon: I.chart, label: 'Kullanım istatistikleri', run: () => click('btn-header-stats') }
        ]);

        const help = makeMenu('Yardım', [
            { icon: I.info, label: 'Neler yeni?', run: () => click('btn-whats-new') },
            { icon: I.keyboard, label: 'Kısayol tuşları', kbd: 'Alt+Q', run: () => click('btn-shortcuts') },
            { icon: I.lock, label: 'Gizlilik ve güvenlik', run: () => click('btn-privacy-info') },
            '-',
            { icon: I.user, label: 'Hakkında / geliştirici', run: aboutDeveloper }
        ]);
        return [edit, view, insert, format, tools, help];
    }

    // ---------------- Araç çubuğu ----------------
    function tbButton(icon, title, onClick, id) {
        const b = el('button', 'tool-btn tb-icon');
        b.type = 'button';
        if (id) b.id = id;
        b.title = title;
        b.setAttribute('aria-label', title);
        b.innerHTML = icon;
        b.addEventListener('click', onClick);
        return b;
    }

    function buildToolbar() {
        const toolbar = document.querySelector('.toolbar');
        if (!toolbar || toolbar.querySelector('#btn-tb-undo')) return;

        // Geri / ileri (en başa)
        const g = el('div', 'tool-group');
        g.appendChild(tbButton(I.undo, 'Geri al (Ctrl+Z)', () => {
            if (window.UkiHistory) {
                if (window.UkiHistory.canUndo()) window.UkiHistory.undo();
            } else {
                const ed = $('editor'); if (ed) ed.focus(); document.execCommand('undo');
            }
        }, 'btn-tb-undo'));
        g.appendChild(tbButton(I.redo, 'Yinele (Ctrl+Y)', () => {
            if (window.UkiHistory) {
                if (window.UkiHistory.canRedo()) window.UkiHistory.redo();
            } else {
                const ed = $('editor'); if (ed) ed.focus(); document.execCommand('redo');
            }
        }, 'btn-tb-redo'));
        toolbar.insertBefore(g, toolbar.firstChild);

        // Antet ▾ (kurum anteti, avukat anteti, sayfa rengi, tuval rengi)
        const antet = makeMenu('Antet', [
            { icon: I.image, label: 'Kurum anteti / arka plan resmi…', run: () => click('btn-antet-setup') },
            { icon: I.scales, label: 'Avukat antet hazırlayıcı…', run: () => click('btn-lawyer-antet') },
            '-',
            { icon: I.textColor, label: 'Yazı rengi…', run: (e) => window.openColorPicker && window.openColorPicker('text-color-picker', e) },
            { icon: I.paper, label: 'Sayfa rengi (kâğıt)…', run: (e) => window.openColorPicker && window.openColorPicker('page-color-picker', e) },
            { icon: I.canvas, label: 'Tuval rengi (masaüstü)…', run: (e) => window.openColorPicker && window.openColorPicker('canvas-color-picker', e) },
            '-',
            { icon: I.undo, label: 'Tüm tasarım ve renkleri sıfırla…', run: () => window.resetDesignToDefault && window.resetDesignToDefault() }
        ], { cls: 'tb-antet', icon: I.image, title: 'Antet, arka plan ve sayfa renkleri' });
        const tpl = $('template-select');
        const host = tpl ? tpl.closest('.tool-group') : null;
        if (host) host.parentNode.insertBefore(antet, host);
        else toolbar.appendChild(antet);
    }

    // ---------------- Kurulum ----------------
    function init() {
        const header = document.querySelector('.header-bar');
        if (!header || document.documentElement.hasAttribute('data-topbar-ready')) return;
        document.documentElement.setAttribute('data-topbar-ready', '1');

        const fileRoot = document.querySelector('.fm-root');
        const menus = buildMenus();
        let anchor = fileRoot;
        if (!anchor) { anchor = document.querySelector('.header-bar .brand'); }
        menus.forEach((m) => { anchor.insertAdjacentElement('afterend', m); anchor = m; });

        buildToolbar();

        // İçindeki tüm düğmeler menülere taşınmış boş gruplar (küçük "nokta" kutusu) gizlenir
        document.querySelectorAll('.toolbar > .tool-group').forEach((g) => {
            const visible = Array.from(g.children).some((c) => c.getBoundingClientRect().width > 2 && c.getBoundingClientRect().height > 2);
            if (!visible) g.style.display = 'none';
        });

        // Klasik UYAP menü çubuğu: odak + üzerine gelme aynı anda iki menü açıyordu; yalnızca tek menü açık kalır,
        // bir madde seçilince menü kapanır (fare ayrılınca yeniden açılabilir).
        const bar = document.querySelector('.uyap-classic-menubar');
        if (bar) {
            bar.addEventListener('mouseover', (e) => {
                const item = e.target.closest && e.target.closest('.uyap-menu-item');
                const active = document.activeElement;
                if (item && active && active !== item && bar.contains(active) && !item.contains(active)) active.blur();
            });
            bar.addEventListener('click', (e) => {
                const row = e.target.closest && e.target.closest('.uyap-dropdown-item');
                const item = e.target.closest && e.target.closest('.uyap-menu-item');
                if (row && item) {
                    item.classList.add('uyap-suppress');
                    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
                }
            });
            bar.querySelectorAll('.uyap-menu-item').forEach((m) => m.addEventListener('mouseleave', () => m.classList.remove('uyap-suppress')));
        }

        // Araç çubuğu simgeleri belge sayfasının tam ortasına hizalanır (soldaki sayfa önizleme bölmesi
        // sayfayı sağa ittiği için ekran ortasından farklıdır)
        const toolbar = document.querySelector('.toolbar');
        const page = $('editor');
        if (toolbar && page) {
            let raf = null;
            const align = () => {
                raf = null;
                toolbar.style.paddingLeft = '';
                const tr = toolbar.getBoundingClientRect();
                const pr = page.getBoundingClientRect();
                if (!tr.width || !pr.width) return;
                const shift = (pr.left + pr.width / 2) - (tr.left + tr.width / 2);
                const padLeft = 16 + (shift > 0 ? 2 * shift : 0);
                toolbar.style.paddingLeft = padLeft + 'px';
                if (shift < 0) toolbar.style.paddingRight = (16 + 2 * -shift) + 'px'; else toolbar.style.paddingRight = '';
            };
            const schedule = () => { if (!raf) raf = requestAnimationFrame(align); };
            window.addEventListener('resize', schedule);
            const side = $('thumbnails-sidebar');
            if (side && window.MutationObserver) new MutationObserver(schedule).observe(side, { attributes: true, attributeFilter: ['class', 'style'] });
            if (window.ResizeObserver) new ResizeObserver(schedule).observe(page);
            document.addEventListener('uki-menu-open', schedule);
            setTimeout(schedule, 300);
            setTimeout(schedule, 1500);
        }

        // Dosya menüsü ile birlikte açılıp kapanma (aynı anda yalnızca biri açık)
        const fileTrigger = $('btn-file-menu');
        if (fileTrigger) fileTrigger.addEventListener('click', () => closeAll(null), true);
    }

    window.UkiTopbar = { init };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
    else setTimeout(init, 0);
})(window, document);
