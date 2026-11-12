/**
 * UYAP Kelime İşlemci (UKİ) - Notion Tarzı Slash Komut Menüsü (UkiSlashMenu)
 * Geliştirici: Gökhan TAŞÇI (Sakarya Yazı İşleri Müdürü - Sicil: 139329)
 * 
 * Notion, TipTap ve Linear Çapraz Paritesi:
 * - Belgede boş satırda veya kelime başında '/' tuşuna basıldığında açılan mini komut paleti.
 * - Klavyeden Yukarı/Aşağı oklar ve Enter ile seçim; Esc ile çıkış.
 * - Yazdıkça anlık filtreleme (/tablo, /antet, /imza, /hüküm, /tarih, /kvkk).
 * - Adli ve hukuk metinleri için optimize edilmiş zengin blok kütüphanesi.
 */

(function (window, document) {
    'use strict';

    let menuEl = null;
    let isOpen = false;
    let selectedIndex = 0;
    let filterQuery = '';
    let slashRange = null;

    const COMMANDS = [
        {
            id: 'h1',
            title: 'Ana Başlık (H1)',
            desc: 'Büyük bölüm ve mahkeme başlığı',
            icon: '📌',
            keywords: ['başlık', 'h1', 'ana', 'bölüm'],
            action: () => document.execCommand('formatBlock', false, '<h1>')
        },
        {
            id: 'h2',
            title: 'Alt Başlık (H2)',
            desc: 'Konu, iddia veya savunma başlığı',
            icon: '📑',
            keywords: ['alt', 'h2', 'başlık', 'iddia', 'savunma'],
            action: () => document.execCommand('formatBlock', false, '<h2>')
        },
        {
            id: 'antet',
            title: 'Mahkeme / Avukat Anteti',
            desc: 'Resmi T.C. antet veya avukat başlıklı kağıt',
            icon: '⚖️',
            keywords: ['antet', 'mahkeme', 'tc', 'avukat', 'başlık'],
            action: () => {
                const btn = document.getElementById('btn-antet') || document.getElementById('btn-antet-setup');
                if (btn) btn.click();
            }
        },
        {
            id: 'imza',
            title: 'Nitelikli E-İmza Bloğu',
            desc: 'Hakim, Katip veya Avukat imza alanı ekle',
            icon: '🖋️',
            keywords: ['imza', 'e-imza', 'mühür', 'katip', 'hakim', 'avukat'],
            action: () => {
                const dateStr = new Date().toLocaleDateString('tr-TR');
                const html = `
                    <div class="udf-signature-block" style="margin-top: 24px; text-align: right; font-family: 'Times New Roman', serif;">
                        <p style="margin: 0; font-weight: bold;">(e-imzalıdır)</p>
                        <p style="margin: 2px 0; font-weight: bold;">Gökhan TAŞÇI</p>
                        <p style="margin: 0; font-size: 0.9em; color: #475569;">Yazı İşleri Müdürü 139329</p>
                    </div>
                    <p><br></p>
                `;
                document.execCommand('insertHTML', false, html);
            }
        },
        {
            id: 'tarih',
            title: 'Günün Tarihi',
            desc: 'Bugünün tarihini ekle (GG.AA.YYYY)',
            icon: '📅',
            keywords: ['tarih', 'bugün', 'date', 'gün'],
            action: () => {
                const now = new Date();
                const d = String(now.getDate()).padStart(2, '0');
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const y = now.getFullYear();
                document.execCommand('insertText', false, `${d}.${m}.${y}`);
            }
        },
        {
            id: 'hukum',
            title: 'Karar Hüküm Bloğu',
            desc: 'GEREĞİ DÜŞÜNÜLDÜ standart karar şablonu',
            icon: '📜',
            keywords: ['hüküm', 'karar', 'gereği', 'düşünüldü', 'beraat'],
            action: () => {
                const html = `
                    <p style="text-align: center; font-weight: bold; margin-top: 18px; margin-bottom: 6px;">H Ü K Ü M : Gerekçesi yukarıda açıklandığı üzere;</p>
                    <p style="text-indent: 1.5cm; margin-bottom: 4px;">1- Sanığın üzerine atılı suçtan CMK 223/2-e maddesi uyarınca <strong>BERAATİNE,</strong></p>
                    <p style="text-indent: 1.5cm; margin-bottom: 4px;">2- Yargılama giderlerinin kamu üzerinde bırakılmasına,</p>
                    <p style="text-indent: 1.5cm; margin-bottom: 4px;">Dair, tefhimden itibaren 2 hafta içinde istinaf kanun yolu açık olmak üzere karar verildi.</p>
                    <p><br></p>
                `;
                document.execCommand('insertHTML', false, html);
            }
        },
        {
            id: 'tablo',
            title: 'Tablo Ekle',
            desc: '3 satır, 3 sütunlu standart adli tablo',
            icon: '📊',
            keywords: ['tablo', 'çizelge', 'table', 'grid'],
            action: () => {
                if (window.UkiTable && typeof window.UkiTable.insertTableAtSelection === 'function') {
                    const table = document.createElement('table');
                    table.className = 'udf-table';
                    table.setAttribute('border', '1');
                    table.style.width = '100%';
                    table.style.borderCollapse = 'collapse';
                    table.style.margin = '12px 0';
                    table.innerHTML = `
                        <tbody>
                            <tr><th style="padding:6px;border:1px solid #94a3b8;background:#f8fafc;">S.No</th><th style="padding:6px;border:1px solid #94a3b8;background:#f8fafc;">Açıklama</th><th style="padding:6px;border:1px solid #94a3b8;background:#f8fafc;">Miktar / Tutar</th></tr>
                            <tr><td style="padding:6px;border:1px solid #94a3b8;">1</td><td style="padding:6px;border:1px solid #94a3b8;">Kalem Harcı</td><td style="padding:6px;border:1px solid #94a3b8;">₺0,00</td></tr>
                            <tr><td style="padding:6px;border:1px solid #94a3b8;">2</td><td style="padding:6px;border:1px solid #94a3b8;">Tebligat Masrafı</td><td style="padding:6px;border:1px solid #94a3b8;">₺0,00</td></tr>
                        </tbody>
                    `;
                    const editor = document.getElementById('editor');
                    window.UkiTable.insertTableAtSelection(table, editor);
                } else {
                    document.execCommand('insertHTML', false, '<table border="1" style="width:100%;border-collapse:collapse;"><tr><td>1</td><td>Hücre</td></tr></table><p><br></p>');
                }
            }
        },
        {
            id: 'madde',
            title: 'Madde İşaretli Liste',
            desc: 'Noktalı sıralama listesi',
            icon: '🔘',
            keywords: ['liste', 'madde', 'nokta', 'bullet'],
            action: () => document.execCommand('insertUnorderedList')
        },
        {
            id: 'numara',
            title: 'Numaralı Liste',
            desc: '1, 2, 3 formatında sıralı adli liste',
            icon: '🔢',
            keywords: ['numara', 'sıralı', 'liste', '123'],
            action: () => document.execCommand('insertOrderedList')
        },
        {
            id: 'kvkk',
            title: 'KVKK Anonimleştirme',
            desc: 'TC, İsim ve Adresleri otomatik maskele',
            icon: '🛡️',
            keywords: ['kvkk', 'maskele', 'gizle', 'anonim', 'tc'],
            action: () => {
                const btn = document.getElementById('btn-kvkk-mask');
                if (btn) btn.click();
            }
        },
        {
            id: 'ai',
            title: 'Yapay Zeka Hukuk Asistanı',
            desc: 'Karar analizi, özetleme ve mevzuat denetimi',
            icon: '✨',
            keywords: ['ai', 'yapay', 'zeka', 'asistan', 'özet'],
            action: () => {
                const btn = document.getElementById('btn-ai-assistant');
                if (btn) btn.click();
            }
        },
        {
            id: 'cizgi',
            title: 'Yatay Çizgi / Ayırıcı',
            desc: 'Bölümler arasına görsel çizgi çek',
            icon: '➖',
            keywords: ['çizgi', 'ayırıcı', 'hr', 'horizontal'],
            action: () => document.execCommand('insertHorizontalRule')
        },
        {
            id: 'linter',
            title: 'Tipografi & Boşluk Temizle',
            desc: 'Çift boşlukları ve hatalı noktalamaları düzelt',
            icon: '🧹',
            keywords: ['temizle', 'boşluk', 'tipografi', 'düzelt'],
            action: () => {
                if (window.UkiLinter && typeof window.UkiLinter.cleanTypography === 'function') {
                    window.UkiLinter.cleanTypography();
                }
            }
        }
    ];

    function createMenuElement() {
        if (menuEl) return menuEl;
        menuEl = document.createElement('div');
        menuEl.id = 'uki-slash-menu';
        menuEl.className = 'uki-slash-menu';
        menuEl.style.display = 'none';
        document.body.appendChild(menuEl);
        return menuEl;
    }

    function getCaretCoordinates() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return null;
        const range = sel.getRangeAt(0).cloneRange();
        range.collapse(true);
        const rects = range.getClientRects();
        if (rects.length > 0) {
            return { top: rects[0].bottom + 6, left: rects[0].left };
        }
        return null;
    }

    function renderItems() {
        if (!menuEl) return;
        const q = filterQuery.toLowerCase().trim();
        const filtered = COMMANDS.filter(cmd => {
            if (!q) return true;
            if (cmd.title.toLowerCase().includes(q)) return true;
            if (cmd.desc.toLowerCase().includes(q)) return true;
            return cmd.keywords.some(k => k.includes(q));
        });

        if (!filtered.length) {
            menuEl.innerHTML = `
                <div class="slash-menu-empty">
                    <span>Eşleşen komut bulunamadı</span>
                </div>
            `;
            return;
        }

        if (selectedIndex >= filtered.length) selectedIndex = 0;

        menuEl.innerHTML = `
            <div class="slash-menu-header">
                <span>HIZLI KOMUTLAR</span>
                <span class="slash-menu-hint">↑↓ gezin, Enter seç</span>
            </div>
            <div class="slash-menu-list">
                ${filtered.map((cmd, idx) => `
                    <div class="slash-menu-item ${idx === selectedIndex ? 'active' : ''}" data-idx="${idx}" data-id="${cmd.id}">
                        <div class="slash-item-icon">${cmd.icon}</div>
                        <div class="slash-item-body">
                            <div class="slash-item-title">${cmd.title}</div>
                            <div class="slash-item-desc">${cmd.desc}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Tıklama dinleyicileri
        menuEl.querySelectorAll('.slash-menu-item').forEach(el => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const id = el.getAttribute('data-id');
                executeCommandById(id);
            });
        });
    }

    function executeCommandById(cmdId) {
        const cmd = COMMANDS.find(c => c.id === cmdId);
        if (!cmd) return;

        closeMenu();

        // Yazılan '/' ve arama metnini sil
        const sel = window.getSelection();
        if (sel.rangeCount && slashRange) {
            try {
                sel.removeAllRanges();
                sel.addRange(slashRange);
                document.execCommand('delete', false, null);
            } catch (e) {}
        }

        setTimeout(() => {
            cmd.action();
        }, 10);
    }

    function openMenu() {
        createMenuElement();
        const coords = getCaretCoordinates();
        if (!coords) return;

        const sel = window.getSelection();
        if (sel.rangeCount) {
            slashRange = sel.getRangeAt(0).cloneRange();
        }

        filterQuery = '';
        selectedIndex = 0;
        renderItems();

        menuEl.style.top = coords.top + 'px';
        menuEl.style.left = Math.min(coords.left, window.innerWidth - 320) + 'px';
        menuEl.style.display = 'block';
        isOpen = true;
    }

    function closeMenu() {
        if (!menuEl || !isOpen) return;
        menuEl.style.display = 'none';
        isOpen = false;
        filterQuery = '';
        selectedIndex = 0;
        slashRange = null;
    }

    function handleKeyDown(e) {
        if (!isOpen) {
            // Boş satırda veya kelime başında '/' tuşuna basıldığında
            if (e.key === '/') {
                setTimeout(openMenu, 20);
            }
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            closeMenu();
            return;
        }

        const q = filterQuery.toLowerCase().trim();
        const filtered = COMMANDS.filter(cmd => {
            if (!q) return true;
            if (cmd.title.toLowerCase().includes(q)) return true;
            if (cmd.desc.toLowerCase().includes(q)) return true;
            return cmd.keywords.some(k => k.includes(q));
        });

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (filtered.length) {
                selectedIndex = (selectedIndex + 1) % filtered.length;
                renderItems();
            }
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (filtered.length) {
                selectedIndex = (selectedIndex - 1 + filtered.length) % filtered.length;
                renderItems();
            }
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered.length && filtered[selectedIndex]) {
                executeCommandById(filtered[selectedIndex].id);
            } else {
                closeMenu();
            }
            return;
        }

        if (e.key === 'Backspace') {
            if (filterQuery.length > 0) {
                filterQuery = filterQuery.slice(0, -1);
                selectedIndex = 0;
                renderItems();
            } else {
                closeMenu();
            }
            return;
        }

        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            filterQuery += e.key;
            selectedIndex = 0;
            renderItems();
        }
    }

    const UkiSlashMenu = {
        init() {
            const editor = document.getElementById('editor');
            if (editor) {
                editor.addEventListener('keydown', handleKeyDown);
            }
            document.addEventListener('click', (e) => {
                if (isOpen && menuEl && !menuEl.contains(e.target)) {
                    closeMenu();
                }
            });
        },
        open: openMenu,
        close: closeMenu
    };

    window.UkiSlashMenu = UkiSlashMenu;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UkiSlashMenu.init());
    } else {
        UkiSlashMenu.init();
    }

})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : {});

