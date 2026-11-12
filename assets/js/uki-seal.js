/**
 * UkiSeal - Yüzen Elektronik İmza Rozeti Modülü (Floating E-Signature Widget)
 * UYAP Kelime İşlemci için bağımsız, sürüklenebilir ve yazıcıya (print) girmeyen e-imza rozeti.
 */
(function(window) {
    'use strict';

    let sealContainer = null;
    let sealContent = null;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialX = 0;
    let initialY = 0;
    let hasMoved = false;
    let currentSignatures = [];
    let onClickCallback = null;

    const DEFAULT_SVG = `
        <svg class="seal-svg" width="38" height="48" viewBox="0 0 48 58" fill="none" style="flex-shrink: 0;">
            <!-- Çift Kırmızı Kurdele -->
            <path d="M16 32L10 56L20 50L24 56L22 34" fill="#c5221f" stroke="#800" stroke-width="0.8"/>
            <path d="M32 32L38 56L28 50L24 56L26 34" fill="#d93025" stroke="#800" stroke-width="0.8"/>
            <!-- Altın Madalya Çerçevesi -->
            <circle cx="24" cy="22" r="18" fill="url(#sealGoldGradFloater)" stroke="#c3911c" stroke-width="2"/>
            <circle cx="24" cy="22" r="15" fill="none" stroke="#e0b84c" stroke-width="1" stroke-dasharray="2 1.5"/>
            <!-- Adalet Terazisi İkonu -->
            <path d="M24 12V28M17 17L31 17M17 17L14 23H20L17 17ZM31 17L28 23H34L31 17Z" stroke="#84580b" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="24" cy="22" r="2.5" fill="#84580b"/>
            <defs>
                <linearGradient id="sealGoldGradFloater" x1="10" y1="8" x2="38" y2="36" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#ffe28a"/>
                    <stop offset="0.5" stop-color="#fab92c"/>
                    <stop offset="1" stop-color="#d68b0b"/>
                </linearGradient>
            </defs>
        </svg>
    `;

    const UkiSeal = {
        init: function(options = {}) {
            if (sealContainer) return;

            onClickCallback = options.onClick || null;

            // Rozet Kapsayıcısını Oluştur
            sealContainer = document.createElement('div');
            sealContainer.id = 'floating-e-sign-seal';
            sealContainer.className = 'floating-seal-widget';
            sealContainer.setAttribute('role', 'button');
            sealContainer.setAttribute('tabindex', '0');
            sealContainer.title = 'Elektronik İmzalı Belge (Detayları görmek için tıklayın, taşımak için sürükleyin)';

            // CSS Stillerini Enjekte Et (Sayfaya ek CSS gerekmeden bağımsız çalışır)
            const style = document.createElement('style');
            style.id = 'uki-seal-style';
            style.textContent = `
                .floating-seal-widget {
                    position: fixed;
                    top: 110px;
                    right: 32px;
                    z-index: 9999;
                    display: none;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 12px;
                    background: rgba(255, 255, 255, 0.94);
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08);
                    cursor: grab;
                    user-select: none;
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.1s ease;
                    max-width: 280px;
                }
                .floating-seal-widget:hover {
                    box-shadow: 0 6px 24px rgba(37, 99, 235, 0.2), 0 2px 6px rgba(0, 0, 0, 0.1);
                    border-color: #93c5fd;
                }
                .floating-seal-widget:active {
                    cursor: grabbing;
                }
                .floating-seal-names {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    text-align: left;
                }
                .floating-seal-signer {
                    font-size: 11px;
                    font-weight: 800;
                    color: #0f172a;
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Times New Roman', serif;
                    letter-spacing: 0.3px;
                    line-height: 1.25;
                    white-space: nowrap;
                    text-transform: uppercase;
                }
                .floating-seal-badge-tag {
                    font-size: 9px;
                    font-weight: 600;
                    color: #166534;
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    margin-top: 2px;
                }
                .floating-seal-drag-handle {
                    width: 4px;
                    height: 24px;
                    border-left: 2px dotted #94a3b8;
                    margin-left: 4px;
                    cursor: grab;
                    opacity: 0.6;
                }
                .floating-seal-close {
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    font-size: 16px;
                    line-height: 1;
                    cursor: pointer;
                    padding: 2px 5px;
                    border-radius: 4px;
                    margin-left: 2px;
                    transition: color 0.15s, background 0.15s;
                }
                .floating-seal-close:hover {
                    color: #e11d48;
                    background: rgba(225, 29, 72, 0.1);
                }
                [data-theme="dark"] .floating-seal-widget {
                    background: rgba(30, 41, 59, 0.94);
                    border-color: #475569;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                }
                [data-theme="dark"] .floating-seal-signer {
                    color: #f8fafc;
                }
                [data-theme="dark"] .floating-seal-close {
                    color: #64748b;
                }
                [data-theme="dark"] .floating-seal-close:hover {
                    color: #fda4af;
                    background: rgba(244, 63, 94, 0.15);
                }
                /* KESİNLİKLE YAZDIRMAYA / PRINT'E GİRMESİN */
                @media print {
                    .floating-seal-widget,
                    #floating-e-sign-seal {
                        display: none !important;
                        visibility: hidden !important;
                        opacity: 0 !important;
                    }
                }
            `;
            document.head.appendChild(style);

            // Kaydedilmiş son pozisyonu yükle
            try {
                const savedPos = localStorage.getItem('uki-seal-position');
                if (savedPos) {
                    const pos = JSON.parse(savedPos);
                    if (pos.top && pos.left) {
                        sealContainer.style.top = pos.top;
                        sealContainer.style.left = pos.left;
                        sealContainer.style.right = 'auto';
                    }
                }
            } catch (e) {}

            // Sürükleme (Drag & Drop) Olayları
            sealContainer.addEventListener('mousedown', function(e) {
                // Sol tık kontrolü
                if (e.button !== 0) return;
                isDragging = true;
                hasMoved = false;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                const rect = sealContainer.getBoundingClientRect();
                initialX = rect.left;
                initialY = rect.top;
                sealContainer.style.cursor = 'grabbing';
                e.preventDefault();
            });

            window.addEventListener('mousemove', function(e) {
                if (!isDragging) return;
                const dx = e.clientX - dragStartX;
                const dy = e.clientY - dragStartY;

                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                    hasMoved = true;
                }

                let newX = initialX + dx;
                let newY = initialY + dy;

                // Ekran sınırlarını koru
                const maxX = window.innerWidth - sealContainer.offsetWidth - 10;
                const maxY = window.innerHeight - sealContainer.offsetHeight - 10;
                newX = Math.max(10, Math.min(maxX, newX));
                newY = Math.max(10, Math.min(maxY, newY));

                sealContainer.style.left = `${newX}px`;
                sealContainer.style.top = `${newY}px`;
                sealContainer.style.right = 'auto';
            });

            window.addEventListener('mouseup', function(e) {
                if (!isDragging) return;
                isDragging = false;
                sealContainer.style.cursor = 'grab';

                if (hasMoved) {
                    try {
                        localStorage.setItem('uki-seal-position', JSON.stringify({
                            top: sealContainer.style.top,
                            left: sealContainer.style.left
                        }));
                    } catch (err) {}
                } else {
                    // Sürüklenmedi, tıklama gerçekleşti
                    if (typeof onClickCallback === 'function') {
                        onClickCallback(currentSignatures);
                    }
                }
            });

            // Dokunmatik Cihazlar (Touch Support)
            sealContainer.addEventListener('touchstart', function(e) {
                const touch = e.touches[0];
                isDragging = true;
                hasMoved = false;
                dragStartX = touch.clientX;
                dragStartY = touch.clientY;
                const rect = sealContainer.getBoundingClientRect();
                initialX = rect.left;
                initialY = rect.top;
            }, { passive: true });

            window.addEventListener('touchmove', function(e) {
                if (!isDragging) return;
                const touch = e.touches[0];
                const dx = touch.clientX - dragStartX;
                const dy = touch.clientY - dragStartY;

                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                    hasMoved = true;
                }

                let newX = initialX + dx;
                let newY = initialY + dy;
                sealContainer.style.left = `${newX}px`;
                sealContainer.style.top = `${newY}px`;
                sealContainer.style.right = 'auto';
            }, { passive: true });

            window.addEventListener('touchend', function() {
                if (!isDragging) return;
                isDragging = false;
                if (!hasMoved && typeof onClickCallback === 'function') {
                    onClickCallback(currentSignatures);
                }
            });

            document.body.appendChild(sealContainer);
        },

        setSignatures: function(signatures) {
            currentSignatures = signatures || [];
            if (!sealContainer) this.init();

            if (!signatures || signatures.length === 0) {
                this.hide();
                this.removePageMedal();
                return;
            }

            // Sayfa 1 sol üst köşesine otantik UYAP Kırmızı Mühür Madalyasını iliştir (udf.adalet.gov.tr Screenshot 2)
            this.renderPageMedal(signatures);

            let namesHtml = '';
            signatures.forEach(s => {
                const name = (s.commonName || s.name || 'ELEKTRONİK İMZACI').toUpperCase();
                namesHtml += `<div class="floating-seal-signer">${String(name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}</div>`;
            });

            sealContainer.innerHTML = `
                ${DEFAULT_SVG}
                <div class="floating-seal-names">
                    ${namesHtml}
                    <div class="floating-seal-badge-tag">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                        E-İmza Doğrulandı
                    </div>
                </div>
                <div class="floating-seal-drag-handle" title="Taşımak için sürükleyin"></div>
                <button type="button" class="floating-seal-close" title="Rozeti Gizle" aria-label="Kapat">&times;</button>
            `;

            const closeBtn = sealContainer.querySelector('.floating-seal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    UkiSeal.hide();
                });
            }

            this.show();
        },

        show: function() {
            if (sealContainer && currentSignatures.length > 0) {
                sealContainer.style.display = 'flex';
            }
        },

        hide: function() {
            if (sealContainer) {
                sealContainer.style.display = 'none';
            }
            this.removePageMedal();
        },

        renderPageMedal: function(signatures) {
            this.removePageMedal();
            if (!signatures || signatures.length === 0) return;

            const pageWrapper = document.getElementById('page-wrapper');
            if (!pageWrapper) return;

            const medalEl = document.createElement('div');
            medalEl.id = 'ude-page-seal-ribbon';
            medalEl.className = 'ude-page-seal-ribbon';
            medalEl.setAttribute('role', 'button');
            medalEl.setAttribute('tabindex', '0');
            medalEl.title = `Elektronik İmzalı Belge (${signatures.length} İmza - İncelemek için tıklayın)`;

            medalEl.innerHTML = `
                <div class="ude-medal-container">
                    <svg width="40" height="52" viewBox="0 0 44 58" fill="none">
                        <!-- Çift Kırmızı Kurdele (Notched Ribbon Tails) -->
                        <path d="M14 26L7 55L19 49L23 55L20 28" fill="#c5221f" stroke="#7f1d1d" stroke-width="0.8"/>
                        <path d="M30 26L37 55L25 49L21 55L24 28" fill="#dc2626" stroke="#991b1b" stroke-width="0.8"/>
                        <!-- Altın Madalya ve Çift Çerçeve -->
                        <circle cx="22" cy="20" r="17" fill="url(#udeMedalGoldGrad)" stroke="#b45309" stroke-width="1.8"/>
                        <circle cx="22" cy="20" r="14" fill="none" stroke="#fde047" stroke-width="0.9" stroke-dasharray="2 1.5"/>
                        <!-- Adalet Terazisi / Mühür Rozeti -->
                        <path d="M22 10V26M15 15L29 15M15 15L12 21H18L15 15ZM29 15L26 21H32L29 15Z" stroke="#78350f" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="22" cy="20" r="2" fill="#78350f"/>
                        <defs>
                            <linearGradient id="udeMedalGoldGrad" x1="8" y1="6" x2="36" y2="34" gradientUnits="userSpaceOnUse">
                                <stop stop-color="#fef08a"/>
                                <stop offset="0.5" stop-color="#f59e0b"/>
                                <stop offset="1" stop-color="#b45309"/>
                            </linearGradient>
                        </defs>
                    </svg>
                    <div class="ude-medal-counter">${signatures.length}</div>
                </div>
            `;

            medalEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof onClickCallback === 'function') {
                    onClickCallback(currentSignatures);
                }
            });

            medalEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (typeof onClickCallback === 'function') {
                        onClickCallback(currentSignatures);
                    }
                }
            });

            const targetPage = pageWrapper.querySelector('.a4-page') || pageWrapper;
            if (targetPage !== pageWrapper) {
                targetPage.style.position = 'relative';
            }
            targetPage.appendChild(medalEl);
        },

        removePageMedal: function() {
            const existing = document.getElementById('ude-page-seal-ribbon');
            if (existing) existing.remove();
        },

        resetPosition: function() {
            if (sealContainer) {
                sealContainer.style.top = '110px';
                sealContainer.style.right = '32px';
                sealContainer.style.left = 'auto';
                try {
                    localStorage.removeItem('uki-seal-position');
                } catch (e) {}
            }
        }
    };

    window.UkiSeal = UkiSeal;

})(window);

