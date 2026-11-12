/**
 * UYAP Kelime İşlemci (UKİ) - "Dosya" menüsü (e-UDF tarzı: ikonlu, gruplu, alt menülü)
 *
 *  - Yeni belge / Şablondan yeni belge
 *  - Belge Aç: bilgisayardan, bağlantıdan, otomatik yedeklerden
 *  - Yeniden adlandır, Son Açılanlar, Belgeyi indir (UDF / Word), Yazdır
 *
 * Son açılanlar ve otomatik yedekler yalnızca bu tarayıcının IndexedDB'sinde tutulur (sunucuya gönderilmez).
 */
(function (window, document) {
    'use strict';

    const DB_NAME = 'uki-files';
    const MAX_RECENT = 8;
    const MAX_BACKUP = 8;
    const AUTOSAVE_MS = 5000;

    // ---------------- IndexedDB (basit anahtar-değer) ----------------
    let dbPromise = null;
    function db() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) { reject(new Error('IndexedDB yok')); return; }
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                const d = req.result;
                if (!d.objectStoreNames.contains('recent')) d.createObjectStore('recent', { keyPath: 'name' });
                if (!d.objectStoreNames.contains('backup')) d.createObjectStore('backup', { keyPath: 'name' });
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }
    function tx(store, mode, fn) {
        return db().then((d) => new Promise((resolve, reject) => {
            const t = d.transaction(store, mode);
            const s = t.objectStore(store);
            const r = fn(s);
            t.oncomplete = () => resolve(r && r.result !== undefined ? r.result : undefined);
            t.onerror = () => reject(t.error);
        }));
    }
    const putItem = (store, item) => tx(store, 'readwrite', (s) => s.put(item));
    const delItem = (store, key) => tx(store, 'readwrite', (s) => s.delete(key));
    const clearStore = (store) => tx(store, 'readwrite', (s) => s.clear());
    const listItems = (store) => tx(store, 'readonly', (s) => s.getAll()).then((r) => (r || []).sort((a, b) => b.date - a.date));

    async function trim(store, max) {
        const all = await listItems(store);
        for (const it of all.slice(max)) await delItem(store, it.name);
    }

    // ---------------- Simgeler ----------------
    const ic = (d) => '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
    const ICON = {
        newDoc: ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>'),
        template: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>'),
        device: ic('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
        link: ic('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
        backup: ic('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>'),
        rename: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
        recent: ic('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
        download: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
        print: ic('<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
        word: ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>'),
        udf: ic('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'),
        trash: ic('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>'),
        chevron: '<svg class="fm-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>'
    };

    // ---------------- Yardımcılar ----------------
    const $ = (id) => document.getElementById(id);
    const toast = (msg, type) => { if (typeof window.showToast === 'function') window.showToast(msg, type || 'info'); };
    const fmtDate = (t) => {
        const d = new Date(t);
        const p = (n) => String(n).padStart(2, '0');
        return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    };
    const ensureUdfName = (n) => (/\.udf$/i.test(n) ? n : n + '.udf');

    // Dosyayı uygulamanın kendi "UDF aç" yolundan geçirir (gizli dosya seçici üzerinden): açılan belge,
    // son açılanlar, sayfalama, filigran vb. tüm akışlar aynen çalışır.
    function openFile(file) {
        const input = $('file-input');
        if (!input) return false;
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    async function openStored(item) {
        openFile(new File([item.blob], item.name, { type: 'application/octet-stream' }));
    }

    // ---------------- Menü ----------------
    let root, trigger, menu, subRecent, subBackup;

    function el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }

    function item(icon, label, kbd, onClick, opts) {
        const b = el('button', 'fm-item' + (opts && opts.sub ? ' fm-has-sub' : ''));
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        b.innerHTML = '<span class="fm-ico">' + icon + '</span><span class="fm-label"></span>' +
            (kbd ? '<kbd class="fm-kbd">' + kbd + '</kbd>' : '') + (opts && opts.sub ? ICON.chevron : '');
        b.querySelector('.fm-label').textContent = label;
        if (onClick) b.addEventListener('click', (e) => { e.stopPropagation(); close(); onClick(); });
        return b;
    }
    function group(t) {
        const g = el('div', 'fm-group');
        g.textContent = t;
        return g;
    }
    const divider = () => el('div', 'fm-divider');

    function withSub(parentItem, subEl) {
        const wrap = el('div', 'fm-sub-wrap');
        wrap.appendChild(parentItem);
        wrap.appendChild(subEl);
        const openSub = () => { wrap.classList.add('open'); parentItem.setAttribute('aria-expanded', 'true'); };
        const closeSub = () => { wrap.classList.remove('open'); parentItem.setAttribute('aria-expanded', 'false'); };
        wrap.addEventListener('mouseenter', openSub);
        wrap.addEventListener('mouseleave', closeSub);
        parentItem.addEventListener('click', (e) => { e.stopPropagation(); wrap.classList.toggle('open'); });
        return wrap;
    }

    function build() {
        root = el('div', 'fm-root');
        trigger = el('button', 'fm-trigger', 'Dosya <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>');
        trigger.type = 'button';
        trigger.id = 'btn-file-menu';
        trigger.setAttribute('aria-haspopup', 'menu');
        trigger.setAttribute('aria-expanded', 'false');
        menu = el('div', 'fm-menu');
        menu.setAttribute('role', 'menu');
        menu.hidden = true;

        menu.appendChild(item(ICON.newDoc, 'Yeni belge oluştur', 'Ctrl+N', () => { const b = $('btn-new'); if (b) b.click(); }));
        menu.appendChild(item(ICON.template, 'Şablondan yeni belge oluştur', '', () => {
            const sel = $('template-select');
            if (sel) { sel.focus(); if (sel.showPicker) { try { sel.showPicker(); } catch (e) { /* kullanıcı etkileşimi gerekir */ } } }
        }));

        menu.appendChild(divider());
        menu.appendChild(group('Belge Aç'));
        menu.appendChild(item(ICON.device, 'Bilgisayardan belge aç', 'Ctrl+O', () => { const b = $('btn-open'); if (b) b.click(); }));
        menu.appendChild(item(ICON.link, 'Bağlantıdan (URL) belge aç', '', openFromUrl));
        subBackup = el('div', 'fm-sub');
        subBackup.setAttribute('role', 'menu');
        menu.appendChild(withSub(item(ICON.backup, 'Otomatik yedeklerden aç', '', null, { sub: true }), subBackup));

        menu.appendChild(divider());
        menu.appendChild(item(ICON.rename, 'Yeniden adlandır', 'F2', rename));
        subRecent = el('div', 'fm-sub');
        subRecent.setAttribute('role', 'menu');
        menu.appendChild(withSub(item(ICON.recent, 'Son açılanlar', '', null, { sub: true }), subRecent));

        menu.appendChild(divider());
        const subDl = el('div', 'fm-sub');
        subDl.setAttribute('role', 'menu');
        subDl.appendChild(item(ICON.udf, 'UYAP belgesi (.udf)', 'Ctrl+S', () => { const b = $('btn-save'); if (b) b.click(); }));
        subDl.appendChild(item(ICON.word, 'Word belgesi (.docx)', '', () => { const b = $('btn-export-docx'); if (b) b.click(); }));
        subDl.appendChild(item(ICON.word, 'OpenDocument (.odt)', '', () => window.UkiODT.download()));
        subDl.appendChild(item(ICON.print, 'PDF olarak (yazdır)', 'Ctrl+P', () => window.print()));
        menu.appendChild(withSub(item(ICON.download, 'Belgeyi indir', '', null, { sub: true }), subDl));
        menu.appendChild(item(ICON.print, 'Yazdır', 'Ctrl+P', () => window.print()));

        root.appendChild(trigger);
        root.appendChild(menu);

        trigger.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden ? open() : close(); });
        document.addEventListener('click', (e) => { if (!root.contains(e.target)) close(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !menu.hidden) { close(); trigger.focus(); }
            if (e.key === 'F2' && !e.ctrlKey && !e.altKey) { const t = e.target; if (!t || t.id !== 'doc-title') { e.preventDefault(); rename(); } }
        });
    }

    function open() {
        // Aynı anda yalnızca bir menü açık kalsın (Görünüm/Araçlar/Yardım menüleri bu olayı dinler)
        document.dispatchEvent(new CustomEvent('uki-menu-open', { detail: 'file' }));
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        root.classList.add('open');
        try {
            const rect = menu.getBoundingClientRect();
            const maxAllowed = (typeof window !== 'undefined' ? window.innerHeight : 800) - rect.top - 12;
            if (maxAllowed > 100 && rect.bottom > (typeof window !== 'undefined' ? window.innerHeight : 800)) {
                menu.style.maxHeight = maxAllowed + 'px';
                menu.style.overflowY = 'auto';
            }
        } catch (_) {}
        refreshLists();
    }
    function close() {
        if (!menu) return;
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        root.classList.remove('open');
        menu.querySelectorAll('.fm-sub-wrap.open').forEach((w) => w.classList.remove('open'));
    }

    function rename() {
        const t = $('doc-title');
        if (t) { t.focus(); t.select(); }
    }

    async function openFromUrl() {
        const url = await window.UkiDialog.prompt('Açmak istediğiniz UDF dosyasının internet adresini yazın.', 'https://', {
            title: 'Bağlantıdan belge aç',
            okText: 'Belgeyi aç',
            placeholder: 'https://ornek.gov.tr/belge.udf'
        });
        if (!url || !/^https?:\/\//i.test(url.trim())) {
            if (url) toast('Yalnızca http(s) bağlantıları açılabilir.', 'warning');
            return;
        }
        try {
            toast('Bağlantıdan belge indiriliyor...', 'info');
            const clean = url.trim();
            // Doğrudan indirilir; üçüncü taraf vekil sunucu kullanılmaz (belge adresi dışarı sızmaz)
            const resp = await fetch(clean, { mode: 'cors' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const blob = await resp.blob();
            let name = 'indirilen_belge.udf';
            try { name = decodeURIComponent(new URL(clean).pathname.split('/').pop()) || name; } catch (e) { /* varsayılan ad */ }
            openFile(new File([blob], ensureUdfName(name), { type: 'application/octet-stream' }));
        } catch (err) {
            toast('Bağlantıdan belge açılamadı (site dışarıdan indirmeye izin vermiyor olabilir): ' + err.message, 'error');
        }
    }

    // ---------------- Listeler ----------------
    function fillSub(sub, items, store, emptyText, emptyHint) {
        sub.innerHTML = '';
        if (!items.length) {
            const e = el('div', 'fm-empty');
            const strong = el('strong');
            strong.textContent = emptyText;
            const small = el('span');
            small.textContent = emptyHint;
            e.appendChild(strong);
            e.appendChild(small);
            sub.appendChild(e);
            return;
        }
        items.forEach((it) => {
            const row = el('div', 'fm-row');
            const b = el('button', 'fm-item fm-recent');
            b.type = 'button';
            b.setAttribute('role', 'menuitem');
            b.innerHTML = '<span class="fm-ico">' + ICON.udf + '</span><span class="fm-two"><span class="fm-name"></span><span class="fm-date"></span></span>';
            b.querySelector('.fm-name').textContent = it.name;
            b.querySelector('.fm-date').textContent = fmtDate(it.date);
            b.addEventListener('click', (e) => { e.stopPropagation(); close(); openStored(it); });
            const del = el('button', 'fm-del', ICON.trash);
            del.type = 'button';
            del.title = 'Listeden kaldır';
            del.addEventListener('click', async (e) => { e.stopPropagation(); await delItem(store, it.name); refreshLists(); });
            row.appendChild(b);
            row.appendChild(del);
            sub.appendChild(row);
        });
        const clear = el('button', 'fm-item fm-clear');
        clear.type = 'button';
        clear.textContent = 'Listeyi temizle';
        clear.addEventListener('click', async (e) => { e.stopPropagation(); await clearStore(store); refreshLists(); });
        sub.appendChild(clear);
    }

    async function refreshLists() {
        try {
            fillSub(subRecent, await listItems('recent'), 'recent', 'Henüz açılmış belge yok', 'Açtığınız veya kaydettiğiniz belgeler burada listelenir.');
            fillSub(subBackup, await listItems('backup'), 'backup', 'Henüz otomatik yedek yok', 'Yazarken belge tarayıcınıza düzenli olarak yedeklenir.');
        } catch (e) {
            fillSub(subRecent, [], 'recent', 'Liste kullanılamıyor', 'Tarayıcı depolaması kapalı olabilir.');
            fillSub(subBackup, [], 'backup', 'Liste kullanılamıyor', 'Tarayıcı depolaması kapalı olabilir.');
        }
    }

    // ---------------- Dışarıya açılan API ----------------
    async function addRecent(name, data) {
        try {
            const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/octet-stream' });
            await putItem('recent', { name: ensureUdfName(String(name || 'belge')), date: Date.now(), blob });
            await trim('recent', MAX_RECENT);
        } catch (e) { /* depolama kapalı: sessizce geç */ }
    }

    // ---------------- Otomatik yedek ----------------
    let timer = null;
    let backingUp = false;
    let lastSig = '';
    function scheduleBackup() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(runBackup, AUTOSAVE_MS);
    }
    async function runBackup() {
        try {
            const ed = $('editor');
            if (!ed || !window.UkiCore || !window.UkiCore.exportUdfBlob) return;
            const text = (ed.innerText || '').trim();
            if (text.length < 3) return;
            const copy = ed.cloneNode(true);
            copy.querySelectorAll('[contenteditable="false"],.pb-spacer').forEach(n => n.remove());
            const sig = copy.innerHTML + JSON.stringify(window.UkiPages.getConfig());
            if (sig === lastSig) return;
            lastSig = sig;
            // Sayfa ölçüleri editörün gerçek dolgularından (pt) alınır
            const cs = getComputedStyle(ed);
            const pt = (v) => (parseFloat(v) || 0) * 0.75;
            const props = {
                leftMargin: pt(cs.paddingLeft), rightMargin: pt(cs.paddingRight),
                topMargin: pt(cs.paddingTop), bottomMargin: pt(cs.paddingBottom),
                paperOrientation: ed.classList.contains('orientation-landscape') ? 2 : 1,
                headerInfo: window.UkiPages && window.UkiPages.getHeader ? window.UkiPages.getHeader() : null
            };
            backingUp = true;
            let blob;
            try { blob = await window.UkiCore.exportUdfBlob(ed, props, null); } finally { backingUp = false; }
            const titleEl = $('doc-title');
            const title = ((titleEl && titleEl.value) || 'belge').trim() || 'belge';
            await putItem('backup', { name: ensureUdfName(title), date: Date.now(), blob });
            await trim('backup', MAX_BACKUP);
        } catch (e) { /* yedek alınamadı: sessizce geç */ }
    }

    function init() {
        const brand = document.querySelector('.header-bar .brand');
        if (!brand || document.getElementById('btn-file-menu')) return;
        build();
        brand.insertAdjacentElement('afterend', root);
        document.addEventListener('uki-menu-open', (e) => { if (e.detail !== 'file') close(); });
        const ed = $('editor');
        if (ed) ed.addEventListener('input', scheduleBackup);

        // Bilgisayardan açılan dosyalar "Son açılanlar"a eklenir
        const input = $('file-input');
        if (input) {
            input.addEventListener('change', () => {
                const f = input.files && input.files[0];
                if (f && /\.udf$/i.test(f.name)) addRecent(f.name, f);
            }, true);
        }

        // UDF kaydedilince (UkiCore.exportUdfBlob çağrısı) "Son açılanlar"a eklenir; otomatik yedek sayılmaz
        if (window.UkiCore && window.UkiCore.exportUdfBlob && !window.UkiCore.__fmWrapped) {
            const orig = window.UkiCore.exportUdfBlob;
            window.UkiCore.exportUdfBlob = async function () {
                const blob = await orig.apply(this, arguments);
                if (!backingUp) {
                    const t = $('doc-title');
                    addRecent(((t && t.value) || 'belge').trim() || 'belge', blob);
                }
                return blob;
            };
            window.UkiCore.__fmWrapped = true;
        }

        // Durum çubuğundaki "Boşluklar" bilgisine çift tıklayınca Sayfa Düzenleme açılır
        const margins = $('stat-margins-info');
        if (margins) {
            margins.style.cursor = 'pointer';
            margins.title = 'Kenar boşluklarını düzenlemek için çift tıklayın (Shift+Alt+N)';
            margins.addEventListener('dblclick', () => { const b = $('btn-page-setup'); if (b) b.click(); });
        }
    }

    window.UkiFileMenu = { init, addRecent, refresh: refreshLists };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})(window, document);
