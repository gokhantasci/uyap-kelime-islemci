/**
 * UYAP Kelime İşlemci (UKİ) - UDF Mizanpaj ve Geometri Denetçisi (Layout Debugger)
 * Paragraf, tablo, hücre ve alt/üst bilgi öğelerinin fiziksel X/Y koordinatlarını,
 * genişlik, yükseklik ve biçimlendirme metriklerini tarayıcı üzerinde canlı ölçer.
 */

(function (window) {
    'use strict';

    const PX_TO_PT = 72 / 96;
    const PT_TO_MM = 25.4 / 72;

    let isEnabled = false;
    let overlayEl = null;
    let tooltipEl = null;
    let drawerEl = null;
    let activeHighlight = null;

    const UkiLayoutDebugger = {
        init() {
            this.createOverlay();
            this.bindEvents();
        },

        isEnabled() {
            return isEnabled;
        },

        toggle() {
            isEnabled = !isEnabled;
            document.body.classList.toggle('uki-layout-debug-active', isEnabled);
            if (overlayEl) overlayEl.style.display = isEnabled ? 'block' : 'none';
            if (tooltipEl) tooltipEl.style.display = 'none';

            if (isEnabled) {
                this.openDrawer();
                this.refreshMetrics();
                if (window.UkiDialog && window.UkiDialog.toast) {
                    window.UkiDialog.toast('📐 UDF Mizanpaj Denetçisi Aktif (Ctrl+Alt+D ile kapatabilirsiniz)');
                }
            } else {
                if (drawerEl) drawerEl.style.display = 'none';
                if (activeHighlight) activeHighlight.remove();
            }
            return isEnabled;
        },

        createOverlay() {
            if (overlayEl) return;
            overlayEl = document.createElement('div');
            overlayEl.id = 'uki-layout-debugger-overlay';
            overlayEl.className = 'uki-layout-debugger-overlay';
            overlayEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99998;display:none;';

            tooltipEl = document.createElement('div');
            tooltipEl.id = 'uki-layout-debugger-tooltip';
            tooltipEl.className = 'uki-layout-debugger-tooltip';
            tooltipEl.style.cssText = `
                position: fixed;
                background: rgba(15, 23, 42, 0.95);
                color: #f8fafc;
                padding: 8px 12px;
                border-radius: 6px;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 11px;
                line-height: 1.45;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
                pointer-events: none;
                z-index: 99999;
                display: none;
                max-width: 360px;
                backdrop-filter: blur(4px);
            `;
            document.body.appendChild(overlayEl);
            document.body.appendChild(tooltipEl);
        },

        bindEvents() {
            window.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.altKey && (e.key === 'd' || e.key === 'D')) {
                    e.preventDefault();
                    this.toggle();
                }
            });

            const editor = document.getElementById('editor');
            if (!editor) return;

            editor.addEventListener('mousemove', (e) => {
                if (!isEnabled) return;
                const target = e.target.closest('p, table, td, th, .pb-header, .pb-footer, .pb-qr');
                if (target && editor.contains(target)) {
                    this.inspectElement(target, e.clientX, e.clientY);
                } else {
                    if (tooltipEl) tooltipEl.style.display = 'none';
                    if (activeHighlight) activeHighlight.remove();
                }
            });

            editor.addEventListener('mouseleave', () => {
                if (tooltipEl) tooltipEl.style.display = 'none';
                if (activeHighlight) activeHighlight.remove();
            });
        },

        inspectElement(el, mouseX, mouseY) {
            const editor = document.getElementById('editor');
            const edRect = editor.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);

            const xPt = (r.left - edRect.left) * PX_TO_PT;
            const yPt = (r.top - edRect.top) * PX_TO_PT;
            const wPt = r.width * PX_TO_PT;
            const hPt = r.height * PX_TO_PT;

            const xMm = xPt * PT_TO_MM;
            const yMm = yPt * PT_TO_MM;
            const wMm = wPt * PT_TO_MM;
            const hMm = hPt * PT_TO_MM;

            // Highlight box
            if (!activeHighlight) {
                activeHighlight = document.createElement('div');
                activeHighlight.className = 'uki-debug-highlight';
                activeHighlight.style.cssText = 'position:fixed;pointer-events:none;z-index:99997;border:2px dashed #2563eb;background:rgba(37, 99, 235, 0.08);';
                document.body.appendChild(activeHighlight);
            }
            activeHighlight.style.top = r.top + 'px';
            activeHighlight.style.left = r.left + 'px';
            activeHighlight.style.width = r.width + 'px';
            activeHighlight.style.height = r.height + 'px';

            const tag = el.tagName.toLowerCase();
            const tabSet = el.getAttribute('data-tabset') || '-';
            const align = cs.textAlign || el.style.textAlign || '-';
            const textPreview = (el.textContent || '').trim().replace(/\s+/g, ' ').substring(0, 50);

            tooltipEl.innerHTML = `
                <div style="font-weight:700;color:#60a5fa;margin-bottom:4px;border-bottom:1px solid #334155;padding-bottom:3px;">
                    &lt;${tag}&gt; ${el.id ? '#' + el.id : ''} ${el.className ? '.' + el.className.split(' ')[0] : ''}
                </div>
                <div><b>X:</b> ${xPt.toFixed(1)} pt (${xMm.toFixed(1)} mm)</div>
                <div><b>Y:</b> ${yPt.toFixed(1)} pt (${yMm.toFixed(1)} mm)</div>
                <div><b>G:</b> ${wPt.toFixed(1)} pt (${wMm.toFixed(1)} mm) | <b>Y:</b> ${hPt.toFixed(1)} pt</div>
                <div><b>Yazı:</b> ${cs.fontFamily.split(',')[0]} ${cs.fontSize} / LH ${cs.lineHeight}</div>
                <div><b>Hizalama:</b> ${align} | <b>Sekme (TabSet):</b> ${tabSet}</div>
                <div style="color:#94a3b8;margin-top:4px;font-style:italic;">"${textPreview || '(boş)'}"</div>
            `;
            tooltipEl.style.display = 'block';

            let left = mouseX + 16;
            let top = mouseY + 16;
            if (left + 360 > window.innerWidth) left = mouseX - 370;
            if (top + 180 > window.innerHeight) top = mouseY - 190;
            tooltipEl.style.left = Math.max(8, left) + 'px';
            tooltipEl.style.top = Math.max(8, top) + 'px';
        },

        openDrawer() {
            if (!drawerEl) {
                drawerEl = document.createElement('div');
                drawerEl.id = 'uki-layout-debugger-drawer';
                drawerEl.style.cssText = `
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 280px;
                    background: #0f172a;
                    color: #f8fafc;
                    border-top: 2px solid #2563eb;
                    z-index: 99990;
                    box-shadow: 0 -10px 25px rgba(0,0,0,0.5);
                    display: flex;
                    flex-direction: column;
                    font-family: ui-monospace, monospace;
                    font-size: 11px;
                `;

                drawerEl.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 14px;background:#1e293b;border-bottom:1px solid #334155;">
                        <div style="font-weight:700;color:#38bdf8;display:flex;align-items:center;gap:8px;">
                            <span>📐 UDF Layout Debugger (Mizanpaj ve Geometri Denetçisi)</span>
                            <span id="uki-debug-count" style="font-size:10px;background:#334155;padding:1px 6px;border-radius:10px;color:#cbd5e1;">0 öğe</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <button id="btn-uki-debug-refresh" style="background:#2563eb;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">Yenile</button>
                            <button id="btn-uki-debug-export" style="background:#334155;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">JSON Kopyala</button>
                            <button id="btn-uki-debug-close" style="background:transparent;color:#94a3b8;border:none;font-size:16px;cursor:pointer;">✕</button>
                        </div>
                    </div>
                    <div id="uki-debug-table-container" style="flex:1;overflow:auto;padding:4px;">
                        <table style="width:100%;border-collapse:collapse;text-align:left;font-size:11px;">
                            <thead>
                                <tr style="background:#1e293b;color:#94a3b8;position:sticky;top:0;">
                                    <th style="padding:4px 8px;">#</th>
                                    <th style="padding:4px 8px;">Etiket</th>
                                    <th style="padding:4px 8px;">X (pt / mm)</th>
                                    <th style="padding:4px 8px;">Y (pt / mm)</th>
                                    <th style="padding:4px 8px;">Genişlik</th>
                                    <th style="padding:4px 8px;">Yükseklik</th>
                                    <th style="padding:4px 8px;">Sekme (TabSet)</th>
                                    <th style="padding:4px 8px;">Metin Önizleme</th>
                                </tr>
                            </thead>
                            <tbody id="uki-debug-tbody"></tbody>
                        </table>
                    </div>
                `;
                document.body.appendChild(drawerEl);

                drawerEl.querySelector('#btn-uki-debug-close').onclick = () => this.toggle();
                drawerEl.querySelector('#btn-uki-debug-refresh').onclick = () => this.refreshMetrics();
                drawerEl.querySelector('#btn-uki-debug-export').onclick = () => this.exportMetricsJson();
            }
            drawerEl.style.display = 'flex';
        },

        collectMetrics() {
            const editor = document.getElementById('editor');
            if (!editor) return [];
            const edRect = editor.getBoundingClientRect();
            const elements = Array.from(editor.querySelectorAll('p, table, .pb-header, .pb-footer, .pb-qr, .pb-spacer'));

            return elements.map((el, i) => {
                const r = el.getBoundingClientRect();
                const cs = window.getComputedStyle(el);
                const xPt = (r.left - edRect.left) * PX_TO_PT;
                const yPt = (r.top - edRect.top) * PX_TO_PT;
                const wPt = r.width * PX_TO_PT;
                const hPt = r.height * PX_TO_PT;

                return {
                    idx: i,
                    tag: el.tagName.toLowerCase(),
                    className: el.className,
                    xPt: parseFloat(xPt.toFixed(1)),
                    yPt: parseFloat(yPt.toFixed(1)),
                    wPt: parseFloat(wPt.toFixed(1)),
                    hPt: parseFloat(hPt.toFixed(1)),
                    xMm: parseFloat((xPt * PT_TO_MM).toFixed(1)),
                    yMm: parseFloat((yPt * PT_TO_MM).toFixed(1)),
                    tabSet: el.getAttribute('data-tabset') || '',
                    align: cs.textAlign || '',
                    text: (el.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 60),
                    element: el
                };
            });
        },

        refreshMetrics() {
            if (!drawerEl) return;
            const items = this.collectMetrics();
            const countEl = drawerEl.querySelector('#uki-debug-count');
            if (countEl) countEl.textContent = `${items.length} öğe`;

            const tbody = drawerEl.querySelector('#uki-debug-tbody');
            if (!tbody) return;
            tbody.innerHTML = '';

            items.forEach((item) => {
                const tr = document.createElement('tr');
                tr.style.cssText = 'border-bottom:1px solid #1e293b;cursor:pointer;';
                tr.onmouseenter = () => { tr.style.background = '#1e293b'; };
                tr.onmouseleave = () => { tr.style.background = 'transparent'; };
                tr.onclick = () => {
                    item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    item.element.style.outline = '2px solid #ef4444';
                    setTimeout(() => { item.element.style.outline = ''; }, 1500);
                };

                tr.innerHTML = `
                    <td style="padding:3px 8px;color:#64748b;">${item.idx}</td>
                    <td style="padding:3px 8px;font-weight:700;color:#38bdf8;">${item.tag}</td>
                    <td style="padding:3px 8px;">${item.xPt} pt <span style="color:#64748b;">(${item.xMm}mm)</span></td>
                    <td style="padding:3px 8px;">${item.yPt} pt <span style="color:#64748b;">(${item.yMm}mm)</span></td>
                    <td style="padding:3px 8px;">${item.wPt} pt</td>
                    <td style="padding:3px 8px;">${item.hPt} pt</td>
                    <td style="padding:3px 8px;color:#a855f7;">${item.tabSet || '-'}</td>
                    <td style="padding:3px 8px;color:#cbd5e1;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.text || '(boş)'}</td>
                `;
                tbody.appendChild(tr);
            });
        },

        exportMetricsJson() {
            const metrics = this.collectMetrics().map(m => {
                const copy = Object.assign({}, m);
                delete copy.element;
                return copy;
            });
            const jsonStr = JSON.stringify(metrics, null, 2);
            navigator.clipboard.writeText(jsonStr).then(() => {
                if (window.UkiDialog && window.UkiDialog.toast) {
                    window.UkiDialog.toast('📋 Mizanpaj metrikleri panoya JSON olarak kopyalandı');
                }
            });
        }
    };

    window.UkiLayoutDebugger = UkiLayoutDebugger;
    document.addEventListener('DOMContentLoaded', () => UkiLayoutDebugger.init());
})(window);

