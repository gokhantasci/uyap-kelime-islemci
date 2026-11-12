/**
 * UYAP Kelime İşlemci (UKİ) - Belge Taslağı & Hukuki Başlık Gezgini (UkiOutline)
 * Geliştirici: Gökhan TAŞÇI (Sakarya Yazı İşleri Müdürü - Sicil: 139329)
 * 
 * Google Docs (Document Outline) & MS Word (Gezinti Bölmesi) Paritesi:
 * - Belgedeki H1, H2, H3 ve adli karar başlıklarını (İddia, Savunma, Gerekçe, Hüküm vb.) dinamik olarak tarar.
 * - Sol yan panelde tıklanabilir hiyerarşik taslak sunar.
 * - Başlığa tıklandığında sayfayı yumuşak animasyonla o noktaya kaydırır ve mavi vurgu ile işaretler.
 */

(function (window, document) {
    'use strict';

    const LEGAL_SECTION_PATTERNS = [
        /^T\.C\./i,
        /MAHKEMESİ|BAŞSAVCILIĞI/i,
        /DOSYA\s+NO/i,
        /KARAR\s+NO/i,
        /^İDDİA/i,
        /^SAVUNMA/i,
        /^DELİLLER/i,
        /^GEREKÇE/i,
        /^H\s*Ü\s*K\s*Ü\s*M/i,
        /SONUÇ\s+VE\s+İSTEM/i,
        /TALEP\s+KONUSU/i,
        /AÇIKLAMALAR/i,
        /HUKUKİ\s+SEBEPLER/i
    ];

    function scanHeadings() {
        const editor = document.getElementById('editor');
        if (!editor) return [];

        const headings = [];
        const elements = editor.querySelectorAll('h1, h2, h3, h4, p, div');

        elements.forEach((el, index) => {
            const tagName = el.tagName.toLowerCase();
            const text = (el.innerText || el.textContent || '').trim();
            if (!text || text.length > 120) return;

            let level = 0;
            let icon = '📌';

            if (tagName === 'h1') {
                level = 1;
                icon = '📑';
            } else if (tagName === 'h2') {
                level = 2;
                icon = '🔹';
            } else if (tagName === 'h3') {
                level = 3;
                icon = '▪️';
            } else if (tagName === 'h4') {
                level = 4;
                icon = '▫️';
            } else {
                // Paragraf içinde kalın veya belirgin adli başlık kontrolü
                let isBold = false;
                try {
                    isBold = !!el.querySelector('strong, b') || (window.getComputedStyle && window.getComputedStyle(el).fontWeight >= '600');
                } catch (_) {}
                if (isBold) {
                    for (const pattern of LEGAL_SECTION_PATTERNS) {
                        if (pattern.test(text)) {
                            level = 2;
                            icon = '⚖️';
                            break;
                        }
                    }
                }
            }

            if (level > 0) {
                // Benzersiz ID ata
                if (!el.id) {
                    el.id = 'outline-node-' + index + '-' + Math.random().toString(36).substr(2, 4);
                }
                headings.push({
                    id: el.id,
                    level: level,
                    icon: icon,
                    text: text.substring(0, 60)
                });
            }
        });

        return headings;
    }

    const UkiOutline = {
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

            const list = scanHeadings();
            if (!list.length) {
                container.innerHTML = `
                    <div class="outline-empty-state">
                        <div style="font-size: 1.5rem; margin-bottom: 6px;">📑</div>
                        <strong>Başlık Bulunamadı</strong>
                        <p style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">
                            Belgenize H1, H2 veya Hüküm başlıkları eklediğinizde burada listelenir.
                        </p>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="outline-tree-list">
                    ${list.map(h => `
                        <div class="outline-tree-item outline-level-${h.level}" onclick="window.UkiOutline.scrollToNode('${h.id}')">
                            <span class="outline-item-icon">${h.icon}</span>
                            <span class="outline-item-text" title="${h.text}">${h.text}</span>
                        </div>
                    `).join('')}
                </div>
            `;
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
