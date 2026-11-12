/**
 * UYAP Kelime İşlemci (UKİ) - Belge Taslağı & Hukuki Bölüm Gezgini (UkiOutline)
 * Geliştirici: Gökhan TAŞÇI (Sakarya Yazı İşleri Müdürü - Sicil: 139329)
 *
 * Belgeyi hukuki bölümlere ayırır:
 *  - Adli yargı (ceza/hukuk): CMK m. 230 ve HMK m. 297'nin saydığı bölümler (iddia, savunma, beyanlar, deliller,
 *    gerekçe/hukuki nitelendirme, hüküm, kanun yolu), mütalaa, bilirkişi raporu, dava/cevap/istinaf dilekçeleri.
 *  - İdari yargı: Danıştay Karar Yazım Rehberi'ndeki başlıklar (Davanın Tarafları, Davanın Konusu, Davacının İddiaları,
 *    Davalının Savunması, Tetkik Hâkimi / Savcı Düşüncesi, Maddi Olay ve Hukuki Süreç, İnceleme ve Gerekçe, Karar Sonucu,
 *    Yargılama Giderleri, Heyet).
 * Kullanıcının kendi H1-H4 başlıkları da korunur. Tıklanınca ilgili yere kaydırır.
 */

(function (window, document) {
    'use strict';

    // key: bölüm türü, label: panelde görünen ad, icon, level (1: ana bölüm, 2: alt bölüm), names: belgede geçen başlık yazımları
    const CATALOG = [
        { key: 'turk_milleti', label: 'Türk Milleti Adına', icon: '🏛️', level: 1, names: ['TÜRK MİLLETİ ADINA'] },
        { key: 'dilekce', label: null, icon: '📄', level: 1, names: ['DAVA DİLEKÇESİ', 'CEVAP DİLEKÇESİ', 'CEVABA CEVAP DİLEKÇESİ', 'KARŞI DAVA DİLEKÇESİ', 'ISLAH DİLEKÇESİ', 'İSTİNAF DİLEKÇESİ', 'TEMYİZ DİLEKÇESİ', 'İTİRAZ DİLEKÇESİ', 'BEYAN DİLEKÇESİ', 'DELİL LİSTESİ DİLEKÇESİ', 'İDDİANAME', 'GEREKÇELİ KARAR', 'KISA KARAR', 'ARA KARAR', 'TENSİP ZAPTI', 'DURUŞMA TUTANAĞI', 'KARAR', 'İHTARNAME', 'İCRA EMRİ'] },
        { key: 'bilirkisi', label: 'Bilirkişi Raporu', icon: '🧮', level: 1, names: ['BİLİRKİŞİ RAPORU', 'BİLİRKİŞİ RAPORLARI', 'BİLİRKİŞİ KURUL RAPORU', 'BİLİRKİŞİ GÖRÜŞÜ', 'BİLİRKİŞİ İNCELEMESİ', 'KEŞİF', 'KEŞİF VE BİLİRKİŞİ İNCELEMESİ'] },
        { key: 'taraf', label: 'Taraflar', icon: '👥', level: 2, names: ['DAVANIN TARAFLARI', 'TARAFLAR', 'DAVACI', 'DAVALI', 'DAVALILAR', 'VEKİLİ', 'VEKİLLERİ', 'SANIK', 'SANIKLAR', 'MÜŞTEKİ', 'MÜŞTEKİ SANIK', 'KATILAN', 'MÜDAFİİ', 'ŞÜPHELİ', 'MAĞDUR', 'TEMYİZ EDEN', 'KARŞI TARAF', 'KARŞI TARAF (DAVALI)', 'İSTİNAF EDEN', 'İTİRAZ EDEN', 'BORÇLU', 'ALACAKLI', 'KARARIN DÜZELTİLMESİNİ İSTEYEN'] },
        { key: 'konu', label: 'Dava / Suç / İstem Konusu', icon: '📌', level: 2, names: ['DAVANIN KONUSU', 'DAVA KONUSU', 'KONU', 'SUÇ', 'SUÇ TARİHİ', 'SUÇ YERİ', 'SUÇ TARİHİ / SAATİ', 'TALEP KONUSU', 'İSTEMİN KONUSU', 'DAVA DEĞERİ', 'DAVA KONUSU İŞLEM', 'DAVA KONUSU İŞLEM / EYLEM'] },
        { key: 'iddia', label: 'İddia', icon: '📣', level: 1, names: ['İDDİA', 'İDDİALAR', 'İDDİA VE TALEP', 'DAVACININ İDDİALARI', 'DAVACI İDDİASI', 'DAVACI İDDİALARI', 'TEMYİZ EDENİN İDDİALARI', 'İSTİNAF EDENİN İDDİALARI', 'TEMYİZ EDEN İDDİALARI', 'DAVA', 'TALEP', 'İDDİANAMEDEKİ İDDİA'] },
        { key: 'savunma', label: 'Savunma / Cevap', icon: '🛡️', level: 1, names: ['SAVUNMA', 'SAVUNMALAR', 'SAVUNMA VE CEVAP', 'CEVAP', 'CEVAPLAR', 'DAVALININ SAVUNMASI', 'DAVALILARIN SAVUNMASI', 'DAVALI SAVUNMASI', 'KARŞI TARAFIN SAVUNMASI', 'SANIK SAVUNMASI', 'SANIĞIN SAVUNMASI', 'SANIKLARIN SAVUNMASI', 'MÜDAFİİN SAVUNMASI', 'İDARENİN SAVUNMASI', 'DAVALI İDARENİN SAVUNMASI', 'DAVALI İDARE SAVUNMASI'] },
        { key: 'beyan', label: 'Beyanlar', icon: '🗣️', level: 2, names: ['BEYANLAR', 'BEYAN', 'KATILAN BEYANI', 'KATILANIN BEYANI', 'MÜŞTEKİ BEYANI', 'MÜŞTEKİNİN BEYANI', 'MAĞDUR BEYANI', 'TANIK BEYANLARI', 'TANIK BEYANI', 'TANIKLAR', 'TANIK İFADELERİ', 'SANIK BEYANI', 'SANIK İFADESİ', 'İFADELER', 'ÇEKİŞME', 'DAVACI BEYANI', 'DAVALI BEYANI', 'ŞİKAYETÇİ BEYANI'] },
        { key: 'mutalaa', label: 'Mütalaa / Düşünce', icon: '🧑‍⚖️', level: 1, names: ['MÜTALAA', 'ESAS HAKKINDAKİ MÜTALAA', 'ESASA İLİŞKİN MÜTALAA', 'CUMHURİYET SAVCISININ MÜTALAASI', 'SAVCILIK MÜTALAASI', 'SAVCI MÜTALAASI', 'SAVCILIK GÖRÜŞÜ', 'DANIŞTAY TETKİK HAKİMİNİN DÜŞÜNCESİ', 'DANIŞTAY SAVCISININ DÜŞÜNCESİ', 'TETKİK HAKİMİNİN DÜŞÜNCESİ', 'TETKİK HÂKİMİNİN DÜŞÜNCESİ', 'SAVCININ DÜŞÜNCESİ', 'SAVCI DÜŞÜNCESİ', 'BÖLGE İDARE MAHKEMESİ SAVCISININ DÜŞÜNCESİ', 'DÜŞÜNCE', 'TETKİK HAKİMİ DÜŞÜNCESİ'] },
        { key: 'olay', label: 'Maddi Olay / Yargılama Süreci', icon: '📅', level: 1, names: ['MADDİ OLAY', 'MADDİ OLAY VE HUKUKİ SÜREÇ', 'MADDİ OLAY VE HUKUKİ SÜREÇ', 'OLAY', 'OLAYLAR', 'OLAY VE OLGULAR', 'YARGILAMA SÜRECİ', 'DOSYA ÖZETİ', 'DAVA ÖZETİ', 'ÖZET', 'YARGILAMA SÜRECİ VE OLAY', 'AÇIKLAMALAR VE OLAY'] },
        { key: 'mevzuat', label: 'İlgili Mevzuat', icon: '📚', level: 2, names: ['İLGİLİ MEVZUAT', 'İLGİLİ HUKUK', 'İLGİLİ KANUN MADDELERİ', 'UYGULANAN MEVZUAT', 'MEVZUAT'] },
        { key: 'delil', label: 'Deliller', icon: '🔎', level: 1, names: ['DELİLLER', 'DELİL', 'DELİLLER VE DEĞERLENDİRME', 'DELİLLERİN DEĞERLENDİRİLMESİ', 'DELİLLERİN TARTIŞILMASI', 'DELİLLERİN TARTIŞILMASI VE DEĞERLENDİRİLMESİ', 'TOPLANAN DELİLLER', 'DELİL LİSTESİ', 'HUKUKİ DELİLLER', 'DELİLLER:', 'DELİLLERİN DEĞERLENDİRİLMESİ VE GEREKÇE'] },
        { key: 'aciklama', label: 'Açıklamalar', icon: '📝', level: 1, names: ['AÇIKLAMALAR', 'AÇIKLAMA', 'AÇIKLAMALARIMIZ', 'OLAYLAR VE AÇIKLAMALAR'] },
        { key: 'hukuki_sebep', label: 'Hukuki Sebepler', icon: '⚖️', level: 2, names: ['HUKUKİ SEBEPLER', 'HUKUKİ NEDENLER', 'HUKUKİ SEBEP', 'HUKUKİ DAYANAK'] },
        { key: 'nitelendirme', label: 'Hukuki Nitelendirme / Değerlendirme', icon: '🧭', level: 2, names: ['HUKUKİ NİTELENDİRME', 'HUKUKİ NİTELİK', 'HUKUKİ DEĞERLENDİRME', 'HUKUKİ DEĞERLENDİRME VE GEREKÇE', 'DEĞERLENDİRME', 'GEREKÇE VE HUKUKİ DEĞERLENDİRME', 'HUKUKİ İNCELEME'] },
        { key: 'ceza_tayini', label: 'Ceza Tayini', icon: '⚖️', level: 2, names: ['CEZA TAYİNİ', 'CEZANIN BELİRLENMESİ', 'CEZANIN TAYİNİ', 'TEŞDİT VE TAKDİRİ İNDİRİM', 'TAKDİRİ İNDİRİM', 'CEZA TAYİNİNDE DİKKATE ALINAN HUSUSLAR'] },
        { key: 'gerekce', label: 'Gerekçe', icon: '💡', level: 1, names: ['GEREKÇE', 'GEREKÇELER', 'İNCELEME VE GEREKÇE', 'İNCELEME', 'GEREĞİ DÜŞÜNÜLDÜ', 'GEREĞİ GÖRÜŞÜLÜP DÜŞÜNÜLDÜ', 'KARARIN GEREKÇESİ', 'HÜKÜM GEREKÇESİ', 'GEREKÇE VE SONUÇ'] },
        { key: 'sonuc_istem', label: 'Sonuç ve İstem', icon: '🎯', level: 1, names: ['SONUÇ VE İSTEM', 'SONUÇ VE TALEP', 'İSTEM', 'SONUÇ VE İSTEMİM', 'NETİCEİ TALEP', 'NETİCE VE TALEP'] },
        { key: 'hukum', label: 'Hüküm / Karar Sonucu', icon: '⚖️', level: 1, names: ['HÜKÜM', 'HÜKÜM FIKRASI', 'KARAR SONUCU', 'KARAR SONUCU VE HÜKÜM', 'SONUÇ', 'SONUÇ VE HÜKÜM', 'HÜKÜM VE SONUÇ', 'SONUÇ VE KARAR'] },
        { key: 'gider', label: 'Yargılama Giderleri', icon: '💰', level: 2, names: ['YARGILAMA GİDERLERİ', 'YARGILAMA GİDERİ', 'HARÇ VE GİDERLER', 'GİDERLER'] },
        { key: 'heyet', label: 'Heyet / İmzalar', icon: '🖋️', level: 2, names: ['HEYET BAŞKAN VE ÜYELERİNİN ADLARI', 'HEYET', 'HAKİM', 'HÂKİM', 'KATİP', 'KÂTİP', 'BAŞKAN', 'ÜYE'] },
        { key: 'kanun_yolu', label: 'Kanun Yolu', icon: '⏱️', level: 2, names: ['KANUN YOLU', 'KANUN YOLLARI', 'KESİNLEŞME', 'TEBLİĞ', 'İTİRAZ YOLU', 'İSTİNAF YOLU', 'TEMYİZ YOLU'] },
        { key: 'ekler', label: 'Ekler', icon: '📎', level: 2, names: ['EKLER', 'EK', 'EK:', 'EKLERİ'] }
    ];

    const up = (s) => String(s || '').toLocaleUpperCase('tr-TR');

    // Kullanılan harf aralıklı yazımı ("H Ü K Ü M", "T Ü R K   M İ L L E T İ") düz yazıma çevirir
    function unspace(s) {
        const tokens = s.split(/\s+/).filter(Boolean);
        if (tokens.length >= 4 && tokens.filter(t => t.length === 1).length / tokens.length > 0.6) {
            return s.split(/\s{2,}/).map(w => w.replace(/\s+/g, '')).join(' ');
        }
        return s;
    }

    function normalize(raw) {
        let s = up(unspace(String(raw || '').replace(/ /g, ' ').trim())).replace(/\s+/g, ' ');
        // baştaki numaralandırma: "1.", "1-", "A-", "II.", "(1)" ...
        s = s.replace(/^(?:\(?(?:\d{1,2}|[A-ZÇĞİÖŞÜ]{1,3})[\.\)\-–]\s*)+/, '');
        return s.trim();
    }

    // ad -> katalog kaydı (normalize edilmiş)
    const NAME_MAP = new Map();
    CATALOG.forEach((entry) => entry.names.forEach((n) => NAME_MAP.set(normalize(n).replace(/[:;.\s]+$/, ''), entry)));

    function classify(rawText) {
        const text = String(rawText || '').replace(/ /g, ' ').trim();
        if (!text) return null;

        // "Dair; ..." fıkrası: hükmün kanun yolu bildirimi
        if (/^DAİR\s*[;,]/.test(up(unspace(text)))) {
            return { key: 'kanun_yolu', label: 'Kanun Yolu (Dair…)', icon: '⏱️', level: 2 };
        }

        // Başlık "BAŞLIK : içerik" biçiminde olabilir: yalnız iki nokta öncesi (en çok 48 karakter) başlık sayılır
        let head = text;
        const colon = text.indexOf(':');
        if (colon > 0 && colon <= 48) head = text.slice(0, colon);
        else if (text.length > 90) return null;

        const norm = normalize(head).replace(/[:;.\s]+$/, '');
        if (!norm || norm.length > 70) return null;

        const entry = NAME_MAP.get(norm);
        if (!entry) return null;
        // İçerik cümlesi olan satırlarda yalnız açık başlık biçimini kabul et (iki nokta ile)
        if (head === text && text.length > 90) return null;
        const label = entry.label || (norm.charAt(0) + norm.slice(1).toLocaleLowerCase('tr-TR')).replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toLocaleUpperCase('tr-TR'));
        return { key: entry.key, label, icon: entry.icon, level: entry.level };
    }

    function scan() {
        const editor = document.getElementById('editor');
        if (!editor) return [];

        const found = [];
        let lastTarafIdx = -100;
        const nodes = editor.querySelectorAll('h1, h2, h3, h4, p');
        nodes.forEach((el, index) => {
            if (el.closest('.page-boundaries-layer, .a4-antet-layer, .pb-spacer, .pb-header, .pb-footer')) return;
            const rawText = (el.textContent || '').trim();
            if (!rawText) return;
            const text = rawText.replace(/\s+/g, ' ');
            const tag = el.tagName.toLowerCase();

            let item = null;
            if (/^h[1-4]$/.test(tag)) {
                const level = Number(tag.charAt(1));
                item = { key: 'baslik', level, icon: ['', '📑', '🔹', '▪️', '▫️'][level], text: text.slice(0, 60), full: text };
            } else {
                const c = classify(rawText);
                if (c) {
                    // Ardışık taraf/konu satırları (DAVACI, VEKİLİ, DAVALI…) tek öğe olarak gösterilir
                    if (c.key === 'taraf' || c.key === 'heyet') {
                        if (index - lastTarafIdx <= 8) { lastTarafIdx = index; return; }
                        lastTarafIdx = index;
                    }
                    if (c.key === 'konu' && found.length && found[found.length - 1].key === 'konu') return;
                    item = { key: c.key, level: c.level, icon: c.icon, text: c.label, full: text.slice(0, 120) };
                }
            }
            if (!item) return;
            if (!el.id) el.id = 'outline-node-' + index + '-' + Math.random().toString(36).slice(2, 6);
            item.id = el.id;
            found.push(item);
        });
        return found;
    }

    function docSummary() {
        try {
            if (window.UkiAI && typeof window.UkiAI.extractLegalFacts === 'function' && window.UkiApp && window.UkiApp.text) {
                const f = window.UkiAI.extractLegalFacts(window.UkiApp.text());
                if (f && f.docType && f.docType !== 'Boş veya Çok Kısa Belge') {
                    return f.docType + (f.court ? ' · ' + f.court : '');
                }
            }
        } catch (_) { /* özet isteğe bağlı */ }
        return '';
    }

    const UkiOutline = {
        scan,
        classify,

        init() {
            const editor = document.getElementById('editor');
            if (editor) {
                let debounceTimer;
                editor.addEventListener('input', () => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => UkiOutline.refresh(), 500);
                });
            }
            setTimeout(() => UkiOutline.refresh(), 1000);
        },

        refresh() {
            const container = document.getElementById('sidebar-outline-content');
            if (!container) return;
            container.textContent = '';

            const list = scan();
            if (!list.length) {
                const box = document.createElement('div');
                box.className = 'outline-empty-state';
                const t = document.createElement('strong');
                t.textContent = 'Bölüm bulunamadı';
                const p = document.createElement('p');
                p.style.cssText = 'font-size:0.8rem;color:#64748b;margin-top:4px;';
                p.textContent = 'İddia, Savunma, Beyanlar, Deliller, Gerekçe, Hüküm, Mütalaa, dilekçe ve bilirkişi raporu gibi bölüm başlıkları (ya da H1–H3 başlıkları) burada otomatik listelenir.';
                const ic = document.createElement('div');
                ic.style.cssText = 'font-size:1.5rem;margin-bottom:6px;';
                ic.textContent = '📑';
                box.append(ic, t, p);
                container.appendChild(box);
                return;
            }

            const summary = docSummary();
            if (summary) {
                const s = document.createElement('div');
                s.className = 'outline-doc-summary';
                s.textContent = '📂 ' + summary;
                container.appendChild(s);
            }

            const tree = document.createElement('div');
            tree.className = 'outline-tree-list';
            list.forEach((h) => {
                const row = document.createElement('div');
                row.className = 'outline-tree-item outline-level-' + h.level + ' outline-key-' + h.key;
                row.setAttribute('role', 'button');
                row.tabIndex = 0;
                row.title = h.full || h.text;
                const icon = document.createElement('span');
                icon.className = 'outline-item-icon';
                icon.textContent = h.icon;
                const txt = document.createElement('span');
                txt.className = 'outline-item-text';
                txt.textContent = h.text;
                row.append(icon, txt);
                const go = () => UkiOutline.scrollToNode(h.id);
                row.addEventListener('click', go);
                row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
                tree.appendChild(row);
            });
            container.appendChild(tree);
        },

        scrollToNode(nodeId) {
            const el = document.getElementById(nodeId);
            if (!el) return;

            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('outline-scroll-target-highlight');
            setTimeout(() => {
                el.classList.remove('outline-scroll-target-highlight');
            }, 1800);
        }
    };

    window.UkiOutline = UkiOutline;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UkiOutline.init());
    } else {
        UkiOutline.init();
    }

})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : {});
