/**
 * UYAP Kelime İşlemci (UKİ) - Ana Uygulama Mantığı (Web App Controller)
 * Sayfa Düzenleme (Boşluklar), Elektronik İmza Görüntüleyici ve Araçlar
 */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const editorEl = document.getElementById('editor');
    const fileInput = document.getElementById('file-input');
    const docTitleInput = document.getElementById('doc-title');
    const signatureBadge = document.getElementById('signature-badge');
    const signatureBadgeText = document.getElementById('signature-badge-text');

    // Durum Çubuğu Öğeleri
    const statPages = document.getElementById('stat-pages');
    const statWords = document.getElementById('stat-words');
    const statChars = document.getElementById('stat-chars');
    const statStatus = document.getElementById('stat-status');
    const statMarginsInfo = document.getElementById('stat-margins-info');

    // Modallar
    const modalPageSetup = document.getElementById('modal-page-setup');
    const modalHeaderSetup = document.getElementById('modal-header-setup');
    const modalFooterSetup = document.getElementById('modal-footer-setup');
    const modalPageNumSetup = document.getElementById('modal-pagenum-setup');
    const modalSignatures = document.getElementById('modal-signatures');
    const modalParaSetup = document.getElementById('modal-paragraph-setup');
    const modalTabstopSetup = document.getElementById('modal-tabstop-setup');
    const modalFontSetup = document.getElementById('modal-font-setup');
    const modalFindReplace = document.getElementById('modal-find-replace');
    const modalShortcuts = document.getElementById('modal-shortcuts');
    const modalGotoPage = document.getElementById('modal-goto-page');
    const modalWhatsNew = document.getElementById('modal-whats-new');
    const modalTemplateWizard = document.getElementById('modal-template-wizard');
    const modalStats = document.getElementById('modal-stats');
    const modalPrivacy = document.getElementById('modal-privacy');
    const btnWhatsNew = document.getElementById('btn-whats-new');
    const btnOpenWhatsNewDoc = document.getElementById('btn-open-whats-new-doc');
    const btnPrivacyInfo = document.getElementById('btn-privacy-info');
    const btnStatsInfo = document.getElementById('btn-stats-info');
    const btnHeaderStats = document.getElementById('btn-header-stats');
    const btnResetStats = document.getElementById('btn-reset-stats');
    const wizardTitle = document.getElementById('wizard-title');
    const wizardFormContainer = document.getElementById('wizard-form-container');
    const btnWizardApply = document.getElementById('btn-wizard-apply');
    const btnWizardSkip = document.getElementById('btn-wizard-skip');

    // Aktif imleç konumu takibi (Diyaloglar açıldığında imleç konumunu kaybetmemek için)
    let lastEditorRange = null;
    function updateLastEditorRange() {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editorEl && editorEl.contains(sel.anchorNode)) {
            lastEditorRange = sel.getRangeAt(0).cloneRange();
        }
    }
    document.addEventListener('selectionchange', updateLastEditorRange);
    ['keyup', 'mouseup', 'pointerup', 'touchend'].forEach(evt => {
        document.addEventListener(evt, updateLastEditorRange);
    });

    // Sayfa Düzenleme Form Öğeleri
    const pageMediaSelect = document.getElementById('page-media-size');
    const orientPortrait = document.getElementById('orient-portrait');
    const orientLandscape = document.getElementById('orient-landscape');
    const marginLeftInput = document.getElementById('margin-left-cm');
    const marginRightInput = document.getElementById('margin-right-cm');
    const marginTopInput = document.getElementById('margin-top-cm');
    const marginBottomInput = document.getElementById('margin-bottom-cm');
    const marginHeaderInput = document.getElementById('margin-header-cm');
    const marginFooterInput = document.getElementById('margin-footer-cm');
    const pagePreviewBox = document.getElementById('page-preview-box');

    let currentDocModel = null;
    let currentFileName = 'adsiz_belge.udf';

    // Editör Motoru Başlatma
    const editor = new UkiEditor(editorEl, {
        onStatsChange: (stats) => {
            if (statPages) statPages.textContent = `Sayfa: ${stats.pages}`;
            if (statWords) statWords.textContent = `Kelime: ${stats.words}`;
            if (statChars) statChars.textContent = `Karakter: ${stats.chars}`;
        }
    });

    // ----------------------------------------------------
    // GENEL MODAL YÖNETİMİ
    // ----------------------------------------------------
    function openModal(modal) {
        if (!modal) return;
        modal.style.display = 'flex';
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.style.display = 'none';
    }

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.ax-modal-backdrop');
            closeModal(modal);
        });
    });

    document.querySelectorAll('.ax-modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal(backdrop);
        });
    });

    if (btnPrivacyInfo) {
        btnPrivacyInfo.addEventListener('click', () => openModal(modalPrivacy));
    }

    function openStatsModal() {
        if (window.UkiStats) window.UkiStats.populateModal();
        openModal(modalStats);
    }

    if (btnStatsInfo) btnStatsInfo.addEventListener('click', openStatsModal);
    if (btnHeaderStats) btnHeaderStats.addEventListener('click', openStatsModal);

    if (btnResetStats) {
        btnResetStats.addEventListener('click', () => {
            if (window.UkiStats) window.UkiStats.resetStats();
        });
    }

    const modalWebmaster = document.getElementById('modal-webmaster-settings');
    const btnWebmasterSettings = document.getElementById('btn-webmaster-settings');
    if (btnWebmasterSettings) {
        btnWebmasterSettings.addEventListener('click', () => {
            window.dispatchEvent(new Event('uki-open-webmaster-modal'));
            openModal(modalWebmaster);
        });
    }

    // Başlangıç sayaç rozetini yenile
    if (window.UkiStats) {
        window.UkiStats.updateUIBadges();
    }

    // ----------------------------------------------------
    // TEMA YÖNETİMİ (DARK / LIGHT THEME & BELGE GECE MODU)
    // ----------------------------------------------------
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const themeIconSun = document.getElementById('theme-icon-sun');
    const themeIconMoon = document.getElementById('theme-icon-moon');
    const themeModeText = document.getElementById('theme-mode-text');
    const btnDocDark = document.getElementById('btn-doc-dark');

    function updateDocThemeButton() {
        if (!btnDocDark) return;
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const docTheme = document.documentElement.getAttribute('data-doc-theme');
        const isDocDark = (currentTheme === 'dark' && docTheme !== 'light') || (docTheme === 'dark');
        if (isDocDark) {
            btnDocDark.classList.add('active');
            btnDocDark.setAttribute('title', 'Sayfa Kağıdını Açık / Beyaz Yap');
        } else {
            btnDocDark.classList.remove('active');
            btnDocDark.setAttribute('title', 'Sayfa Kağıdını Göz Yormayan Koyu Yap');
        }
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('uki-theme', theme);
        if (theme === 'dark') {
            if (themeIconSun) themeIconSun.style.display = 'none';
            if (themeIconMoon) themeIconMoon.style.display = 'inline-block';
            if (themeModeText) themeModeText.textContent = 'Açık Tema';
        } else {
            if (themeIconSun) themeIconSun.style.display = 'inline-block';
            if (themeIconMoon) themeIconMoon.style.display = 'none';
            if (themeModeText) themeModeText.textContent = 'Koyu Tema';
        }
        updateDocThemeButton();
    }

    const savedTheme = localStorage.getItem('uki-theme') || 
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);

    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            applyTheme(current === 'dark' ? 'light' : 'dark');
        });
    }

    if (btnDocDark) {
        btnDocDark.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const docTheme = document.documentElement.getAttribute('data-doc-theme');
            const isDocDark = (currentTheme === 'dark' && docTheme !== 'light') || (docTheme === 'dark');
            if (isDocDark) {
                if (currentTheme === 'dark') {
                    document.documentElement.setAttribute('data-doc-theme', 'light');
                } else {
                    document.documentElement.removeAttribute('data-doc-theme');
                }
            } else {
                if (currentTheme === 'dark') {
                    document.documentElement.removeAttribute('data-doc-theme');
                } else {
                    document.documentElement.setAttribute('data-doc-theme', 'dark');
                }
            }
            updateDocThemeButton();
        });
    }

    // ----------------------------------------------------
    // KLASİK UYAP DOKÜMAN EDİTÖRÜ TASARIMI YÖNETİMİ
    // ----------------------------------------------------
    const btnUyapClassicToggle = document.getElementById('btn-uyap-classic-toggle');
    const uyapClassicText = document.getElementById('uyap-classic-text');

    function setUyapClassicTheme(enable, notify = true) {
        if (enable) {
            document.documentElement.setAttribute('data-ui-theme', 'uyap-classic');
            localStorage.setItem('uki-ui-theme', 'uyap-classic');
            if (uyapClassicText) uyapClassicText.textContent = 'Modern Tasarım';
            if (btnUyapClassicToggle) {
                btnUyapClassicToggle.classList.add('active');
                btnUyapClassicToggle.setAttribute('title', 'Modern Web Tasarımına Geri Dön');
            }
            if (notify) showToast('Masaüstü UYAP Doküman Editörü tasarımına geçildi.', 'info');
        } else {
            document.documentElement.removeAttribute('data-ui-theme');
            localStorage.setItem('uki-ui-theme', 'modern');
            if (uyapClassicText) uyapClassicText.textContent = 'UYAP Tasarımı';
            if (btnUyapClassicToggle) {
                btnUyapClassicToggle.classList.remove('active');
                btnUyapClassicToggle.setAttribute('title', 'Masaüstü UYAP Doküman Editörü Tasarımına Geç');
            }
            if (notify) showToast('Modern Web tasarımına dönüldü.', 'info');
        }
    }

    if (btnUyapClassicToggle) {
        btnUyapClassicToggle.addEventListener('click', () => {
            const isClassic = document.documentElement.getAttribute('data-ui-theme') === 'uyap-classic';
            setUyapClassicTheme(!isClassic, true);
        });
    }

    // Başlangıçta kayıtlı UYAP tasarım tercihini uygula
    const savedUiTheme = localStorage.getItem('uki-ui-theme');
    if (savedUiTheme === 'uyap-classic') {
        setUyapClassicTheme(true, false);
    }

    // ----------------------------------------------------
    // RESMÎ UYAP KLAVYE KISAYOLLARI (657.com.tr)
    // ----------------------------------------------------
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();

        // Alt + Q: Kısayolları Görüntüle
        if (e.altKey && key === 'q') {
            e.preventDefault();
            openModal(modalShortcuts);
            return;
        }

        // Shift + Alt + N: Sayfa Düzenleme (Boşluklar)
        if (e.shiftKey && e.altKey && key === 'n') {
            e.preventDefault();
            populatePageSetupForm();
            openModal(modalPageSetup);
            return;
        }

        // Shift + Ctrl + G: İmzaları Göster
        if (e.shiftKey && (e.ctrlKey || e.metaKey) && key === 'g') {
            e.preventDefault();
            showSignaturesModal();
            return;
        }

        // Shift + Ctrl + Q: İlk Satır Girinti Artır
        if (e.shiftKey && (e.ctrlKey || e.metaKey) && key === 'q') {
            e.preventDefault();
            adjustFirstLineIndent(10);
            return;
        }

        // Shift + Ctrl + D: Tema Değiştir (Aydınlık / Karanlık)
        if (e.shiftKey && (e.ctrlKey || e.metaKey) && key === 'd') {
            e.preventDefault();
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            applyTheme(current === 'dark' ? 'light' : 'dark');
            return;
        }

        if (e.ctrlKey || e.metaKey) {
            if (key === 's') {
                e.preventDefault();
                triggerSave();
            } else if (key === 'o') {
                e.preventDefault();
                fileInput.click();
            } else if (key === 'n') {
                e.preventDefault();
                triggerNewDoc();
            } else if (key === 'p') {
                e.preventDefault();
                window.print();
            } else if (key === 'f' || key === 'h') {
                e.preventDefault();
                openModal(modalFindReplace);
            } else if (key === 'k') {
                // UYAP Kalın Kısayolu (Ctrl + K)
                e.preventDefault();
                editor.format('bold');
            } else if (key === 't') {
                // UYAP İtalik Kısayolu (Ctrl + T)
                e.preventDefault();
                editor.format('italic');
            } else if (e.shiftKey && key === 'a') {
                // UYAP Altı Çizili Kısayolu (Shift + Ctrl + A)
                e.preventDefault();
                editor.format('underline');
            } else if (e.key === 'ArrowUp') {
                // UYAP Punto Büyüt (Ctrl + Yukarı Ok)
                e.preventDefault();
                adjustFontSize(1);
            } else if (e.key === 'ArrowDown') {
                // UYAP Punto Küçült (Ctrl + Aşağı Ok)
                e.preventDefault();
                adjustFontSize(-1);
            } else if (key === 'enter') {
                // UYAP Sayfa Kesmesi (Ctrl + Enter)
                e.preventDefault();
                if (window.insertPageBreak) window.insertPageBreak();
            } else if (key === 'w') {
                // UYAP Boşlukları Göster/Gizle (Ctrl + W)
                e.preventDefault();
                toggleInvisibleChars();
            } else if (!e.shiftKey && !e.altKey && (key === 'l' || key === 'e' || key === 'r' || key === 'j')) {
                // UYAP Hizalama: Ctrl+L sola, Ctrl+E ortala, Ctrl+R sağa, Ctrl+J iki yana yasla
                e.preventDefault();
                editor.format({ l: 'justifyLeft', e: 'justifyCenter', r: 'justifyRight', j: 'justifyFull' }[key]);
            }
        }
    });

    const btnShortcuts = document.getElementById('btn-shortcuts');
    if (btnShortcuts) {
        btnShortcuts.addEventListener('click', () => openModal(modalShortcuts));
    }

    const btnLegalDictionary = document.getElementById('btn-legal-dictionary');
    if (btnLegalDictionary) {
        btnLegalDictionary.addEventListener('click', () => {
            if (window.UkiDictionary) {
                window.UkiDictionary.openModal();
            }
        });
    }

    function adjustFontSize(delta) {
        const curSize = parseInt(sizeSelect ? sizeSelect.value : '12', 10) || 12;
        const newSize = Math.max(6, Math.min(48, curSize + delta));
        if (sizeSelect) sizeSelect.value = String(newSize);
        editor.setFontSize(newSize);
        showToast(`Yazı Boyutu: ${newSize} pt`, 'info');
    }

    function adjustFirstLineIndent(deltaPt) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const node = selection.getRangeAt(0).startContainer;
            const targetP = node.nodeType === Node.ELEMENT_NODE ? node.closest('p') : node.parentElement.closest('p');
            if (targetP && targetP.parentElement === editorEl) {
                const cur = parseFloat(targetP.style.textIndent || '0') || 0;
                const next = Math.max(0, cur + deltaPt);
                targetP.style.textIndent = `${next}pt`;
                showToast(`İlk Satır Girintisi: ${next} pt`, 'info');
                return;
            }
        }
        showToast('Girintiyi artırmak için bir paragraf seçin.', 'info');
    }

    let invisibleCharsActive = false;
    function toggleInvisibleChars() {
        invisibleCharsActive = !invisibleCharsActive;
        editorEl.classList.toggle('show-invisibles', invisibleCharsActive);
        showToast(invisibleCharsActive ? 'Boşluk ve sekmeler görünür yapıldı.' : 'Boşluk işaretleri gizlendi.', 'info');
    }

    async function triggerNewDoc() {
        if (!window.UkiApp.isDirty() || await UkiDialog.confirm('Geçerli belgedeki kaydedilmemiş değişiklikler kaybolabilir. Yeni boş belge açılsın mı?', { title: 'Yeni belge', okText: 'Yeni belge aç' })) {
            editor.clear();
            if (docTitleInput) docTitleInput.value = 'Yeni Belge';
            currentFileName = 'Yeni Belge.udf';
            currentDocModel = null;
            if (signatureBadge) signatureBadge.style.display = 'none';
            renderWatermark('', true); // yeni belgede sicil bilgisi yok: filigran yok
            if (window.UkiSeal) window.UkiSeal.setSignatures([]);
            recalculatePagesAndThumbnails();
            window.UkiApp.markSaved();
            showToast('Yeni boş belge oluşturuldu.', 'info');
        }
    }

    // ----------------------------------------------------
    // ARAÇ ÇUBUĞU (TOOLBAR) EYLEMLERİ
    // ----------------------------------------------------
    document.querySelectorAll('[data-command]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const cmd = btn.getAttribute('data-command');
            const val = btn.getAttribute('data-value') || null;
            editor.format(cmd, val);
        });
    });

    const fontSelect = document.getElementById('font-family-select');
    if (fontSelect) {
        fontSelect.addEventListener('change', () => editor.setFontFamily(fontSelect.value));
    }

    const sizeSelect = document.getElementById('font-size-select');
    if (sizeSelect) {
        sizeSelect.addEventListener('change', () => editor.setFontSize(parseInt(sizeSelect.value, 10)));
    }

    const colorPicker = document.getElementById('text-color-picker');
    if (colorPicker) {
        colorPicker.addEventListener('input', () => editor.setTextColor(colorPicker.value));
    }

    const zoomSelect = document.getElementById('zoom-select');
    const pageWrapper = document.getElementById('page-wrapper');
    if (zoomSelect && pageWrapper) {
        zoomSelect.addEventListener('change', () => {
            const scale = parseFloat(zoomSelect.value) / 100;
            pageWrapper.style.transform = `scale(${scale})`;
            pageWrapper.style.transformOrigin = 'top center';
        });
    }

    // ----------------------------------------------------
    // SAYFA DÜZENLEME (PAGE SETUP / MARGINS) MODALI
    // ----------------------------------------------------
    const btnPageSetup = document.getElementById('btn-page-setup');
    if (btnPageSetup) {
        btnPageSetup.addEventListener('click', () => {
            populatePageSetupForm();
            openModal(modalPageSetup);
        });
    }

    function populatePageSetupForm() {
        const props = (currentDocModel && currentDocModel.pageProperties) ? currentDocModel.pageProperties : {
            leftMarginCm: '2',
            rightMarginCm: '2.5',
            topMarginCm: '2.5',
            bottomMarginCm: '2.5',
            headerFOffsetCm: '0.529',
            footerFOffsetCm: '2.117',
            paperOrientation: 1,
            mediaSizeName: '1'
        };

        if (marginLeftInput) marginLeftInput.value = props.leftMarginCm;
        if (marginRightInput) marginRightInput.value = props.rightMarginCm;
        if (marginTopInput) marginTopInput.value = props.topMarginCm;
        if (marginBottomInput) marginBottomInput.value = props.bottomMarginCm;
        if (marginHeaderInput) marginHeaderInput.value = props.headerFOffsetCm;
        if (marginFooterInput) marginFooterInput.value = props.footerFOffsetCm;

        if (props.paperOrientation === 2) {
            if (orientLandscape) orientLandscape.checked = true;
        } else {
            if (orientPortrait) orientPortrait.checked = true;
        }

        if (pageMediaSelect) pageMediaSelect.value = props.mediaSizeName || '1';
        updatePagePreviewSheet();
    }

    function updatePagePreviewSheet() {
        const sheet = document.getElementById('page-preview-sheet');
        const inner = document.getElementById('page-preview-inner');
        if (!sheet || !inner) return;

        const isLandscape = orientLandscape && orientLandscape.checked;
        if (isLandscape) {
            sheet.classList.add('orientation-landscape');
        } else {
            sheet.classList.remove('orientation-landscape');
        }

        const left = parseFloat(marginLeftInput ? marginLeftInput.value : 2.0) || 2.0;
        const right = parseFloat(marginRightInput ? marginRightInput.value : 2.5) || 2.5;
        const top = parseFloat(marginTopInput ? marginTopInput.value : 2.5) || 2.5;
        const bottom = parseFloat(marginBottomInput ? marginBottomInput.value : 2.5) || 2.5;

        // UYAP Preview Oranı (A4: 21x29.7cm)
        const factor = isLandscape ? (96 / 29.7) : (68 / 21.0);
        inner.style.top = `${Math.max(2, Math.min(28, top * factor))}px`;
        inner.style.bottom = `${Math.max(2, Math.min(28, bottom * factor))}px`;
        inner.style.left = `${Math.max(2, Math.min(24, left * factor))}px`;
        inner.style.right = `${Math.max(2, Math.min(24, right * factor))}px`;
    }

    if (orientPortrait) orientPortrait.addEventListener('change', updatePagePreviewSheet);
    if (orientLandscape) orientLandscape.addEventListener('change', updatePagePreviewSheet);
    [marginLeftInput, marginRightInput, marginTopInput, marginBottomInput].forEach(inp => {
        if (inp) {
            inp.addEventListener('input', updatePagePreviewSheet);
            inp.addEventListener('change', updatePagePreviewSheet);
        }
    });

    const btnPageSetupSave = document.getElementById('btn-page-setup-save');
    if (btnPageSetupSave) {
        btnPageSetupSave.addEventListener('click', () => {
            const leftCm = parseFloat(marginLeftInput.value) || 2.0;
            const rightCm = parseFloat(marginRightInput.value) || 2.5;
            const topCm = parseFloat(marginTopInput.value) || 2.5;
            const bottomCm = parseFloat(marginBottomInput.value) || 2.5;
            const headerCm = parseFloat(marginHeaderInput.value) || 0.529;
            const footerCm = parseFloat(marginFooterInput.value) || 2.117;
            const orientation = (orientLandscape && orientLandscape.checked) ? 2 : 1;
            const mediaSize = pageMediaSelect ? pageMediaSelect.value : '1';

            // pt hesapları
            const leftPt = UkiCore.cmToPt(leftCm);
            const rightPt = UkiCore.cmToPt(rightCm);
            const topPt = UkiCore.cmToPt(topCm);
            const bottomPt = UkiCore.cmToPt(bottomCm);
            const headPt = UkiCore.cmToPt(headerCm);
            const footPt = UkiCore.cmToPt(footerCm);

            if (!currentDocModel) {
                currentDocModel = { pageProperties: {} };
            }

            currentDocModel.pageProperties = {
                mediaSizeName: mediaSize,
                paperOrientation: orientation,
                leftMargin: leftPt,
                rightMargin: rightPt,
                topMargin: topPt,
                bottomMargin: bottomPt,
                headerFOffset: headPt,
                footerFOffset: footPt,
                leftMarginCm: String(leftCm),
                rightMarginCm: String(rightCm),
                topMarginCm: String(topCm),
                bottomMarginCm: String(bottomCm),
                headerFOffsetCm: String(headerCm),
                footerFOffsetCm: String(footerCm)
            };

            applyPagePropertiesToView(currentDocModel.pageProperties);
            closeModal(modalPageSetup);
            showToast('Sayfa ve kenar boşluğu ayarları güncellendi.', 'success');
        });
    }

    // ----------------------------------------------------
    // ÜST YAZI (HEADER) YÖNETİMİ
    // ----------------------------------------------------
    const inputHeaderLeft = document.getElementById('input-header-left');
    const inputHeaderRight = document.getElementById('input-header-right');
    const selectHeaderStartPage = document.getElementById('select-header-start-page');
    const previewHeaderLeft = document.getElementById('preview-header-left');
    const previewHeaderRight = document.getElementById('preview-header-right');
    const btnHeaderSave = document.getElementById('btn-header-save');
    const btnHeaderRemove = document.getElementById('btn-header-remove');

    function headerElementToInfo(he) {
        if (!he || !he.paragraphs || !he.paragraphs.length) return null;
        const full = he.paragraphs.map(p => (p.runs || []).map(r => r.text || '').join('')).join(' ').trim();
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
        return { left, right, startPage: he.startPage || 2 };
    }

    function updateHeaderPreview() {
        if (previewHeaderLeft) previewHeaderLeft.textContent = (inputHeaderLeft && inputHeaderLeft.value.trim()) || '(Sol metin yok)';
        if (previewHeaderRight) {
            const rText = (inputHeaderRight && inputHeaderRight.value.trim()) || '';
            previewHeaderRight.innerHTML = '';
            if (rText.startsWith('Dosya-Karar No:')) {
                const b = document.createElement('b');
                b.textContent = 'Dosya-Karar No:';
                previewHeaderRight.appendChild(b);
                previewHeaderRight.appendChild(document.createTextNode(rText.substring('Dosya-Karar No:'.length)));
            } else if (rText.startsWith('Dosya-Karar:')) {
                const b = document.createElement('b');
                b.textContent = 'Dosya-Karar:';
                previewHeaderRight.appendChild(b);
                previewHeaderRight.appendChild(document.createTextNode(rText.substring('Dosya-Karar:'.length)));
            } else {
                previewHeaderRight.textContent = rText;
            }
        }
    }
    if (inputHeaderLeft) inputHeaderLeft.addEventListener('input', updateHeaderPreview);
    if (inputHeaderRight) inputHeaderRight.addEventListener('input', updateHeaderPreview);

    window.openHeaderSetupModal = function() {
        const curHeader = (window.UkiPages && window.UkiPages.getHeader && window.UkiPages.getHeader()) || 
                          (currentDocModel && (currentDocModel.headerInfo || (currentDocModel.headerElement && headerElementToInfo(currentDocModel.headerElement)))) || null;
        if (inputHeaderLeft) inputHeaderLeft.value = (curHeader && curHeader.left) || '';
        if (inputHeaderRight) inputHeaderRight.value = (curHeader && curHeader.right) || '';
        if (selectHeaderStartPage) selectHeaderStartPage.value = String((curHeader && curHeader.startPage) || 2);
        updateHeaderPreview();
        openModal(modalHeaderSetup);
    };

    window.removeDocumentHeader = function() {
        if (window.UkiPages && window.UkiPages.removeHeader) {
            window.UkiPages.removeHeader();
        }
        if (currentDocModel) {
            currentDocModel.headerInfo = null;
            if (currentDocModel.pageProperties) currentDocModel.pageProperties.headerInfo = null;
        }
        closeModal(modalHeaderSetup);
        recalculatePagesAndThumbnails();
        showToast('Üst yazı kaldırıldı.', 'info');
    };

    if (btnHeaderSave) {
        btnHeaderSave.addEventListener('click', () => {
            const left = (inputHeaderLeft && inputHeaderLeft.value.trim()) || '';
            const right = (inputHeaderRight && inputHeaderRight.value.trim()) || '';
            const startP = parseInt(selectHeaderStartPage ? selectHeaderStartPage.value : '2', 10) || 2;
            if (!left && !right) {
                window.removeDocumentHeader();
                return;
            }
            const hData = { left, right, startPage: startP };
            if (window.UkiPages && window.UkiPages.setHeader) {
                window.UkiPages.setHeader(hData);
            }
            if (!currentDocModel) currentDocModel = { pageProperties: {} };
            currentDocModel.headerInfo = hData;
            if (!currentDocModel.pageProperties) currentDocModel.pageProperties = {};
            currentDocModel.pageProperties.headerInfo = hData;
            closeModal(modalHeaderSetup);
            recalculatePagesAndThumbnails();
            showToast('Üst yazı kaydedildi ve uygulandı.', 'success');
        });
    }
    if (btnHeaderRemove) {
        btnHeaderRemove.addEventListener('click', window.removeDocumentHeader);
    }

    // ----------------------------------------------------
    // ALT YAZI (FOOTER) YÖNETİMİ
    // ----------------------------------------------------
    const checkFooterEnabled = document.getElementById('check-footer-enabled');
    const inputFooterWebId = document.getElementById('input-footer-webid');
    const checkFooterQr = document.getElementById('check-footer-qr');
    const previewFooterCode = document.getElementById('preview-footer-code');
    const previewFooterQr = document.getElementById('preview-footer-qr');
    const btnFooterSave = document.getElementById('btn-footer-save');
    const btnFooterRemove = document.getElementById('btn-footer-remove');

    function updateFooterPreview() {
        const wid = (inputFooterWebId && inputFooterWebId.value.trim()) || '3jVCBSh - E0K32wM';
        if (previewFooterCode) previewFooterCode.textContent = wid;
        if (previewFooterQr) previewFooterQr.style.display = (checkFooterQr && checkFooterQr.checked) ? 'inline-block' : 'none';
    }
    if (inputFooterWebId) inputFooterWebId.addEventListener('input', updateFooterPreview);
    if (checkFooterQr) checkFooterQr.addEventListener('change', updateFooterPreview);

    window.openFooterSetupModal = function() {
        const cfg = (window.UkiPages && window.UkiPages.getConfig && window.UkiPages.getConfig()) || {};
        if (checkFooterEnabled) checkFooterEnabled.checked = cfg.showFooter !== false;
        if (inputFooterWebId) inputFooterWebId.value = cfg.webId || (currentDocModel && currentDocModel.docProperties && currentDocModel.docProperties.uyapdogrulamakodu) || '';
        if (checkFooterQr) checkFooterQr.checked = !!cfg.qrCode;
        updateFooterPreview();
        openModal(modalFooterSetup);
    };

    window.removeDocumentFooter = function() {
        if (window.UkiPages && window.UkiPages.removeFooter) {
            window.UkiPages.removeFooter();
        }
        closeModal(modalFooterSetup);
        recalculatePagesAndThumbnails();
        showToast('Alt yazı kaldırıldı.', 'info');
    };

    if (btnFooterSave) {
        btnFooterSave.addEventListener('click', () => {
            const enabled = checkFooterEnabled ? checkFooterEnabled.checked : true;
            const webId = (inputFooterWebId && inputFooterWebId.value.trim()) || '';
            const qrChecked = checkFooterQr ? checkFooterQr.checked : true;
            if (window.UkiPages && window.UkiPages.setFooter) {
                window.UkiPages.setFooter({
                    showFooter: enabled,
                    webId: webId,
                    qrCode: qrChecked ? (webId || 'UYAP') : ''
                });
            }
            closeModal(modalFooterSetup);
            recalculatePagesAndThumbnails();
            showToast('Alt yazı güncellendi.', 'success');
        });
    }
    if (btnFooterRemove) {
        btnFooterRemove.addEventListener('click', window.removeDocumentFooter);
    }

    // ----------------------------------------------------
    // SAYFA NUMARASI YÖNETİMİ
    // ----------------------------------------------------
    const checkPageNumEnabled = document.getElementById('check-pagenum-enabled');
    const selectPageNumFormat = document.getElementById('select-pagenum-format');
    const selectPageNumAlign = document.getElementById('select-pagenum-align');
    const checkPageNumFirstPage = document.getElementById('check-pagenum-firstpage');
    const previewPageNumDisplay = document.getElementById('preview-pagenum-display');
    const btnPageNumSave = document.getElementById('btn-pagenum-save');
    const btnPageNumRemove = document.getElementById('btn-pagenum-remove');

    function updatePageNumPreview() {
        const fmt = (selectPageNumFormat && selectPageNumFormat.value) || 'slash';
        const al = (selectPageNumAlign && selectPageNumAlign.value) || 'right';
        let txt = '1/3';
        if (fmt === 'single') txt = '1';
        else if (fmt === 'dash') txt = '- 1 -';
        else if (fmt === 'bracket') txt = '[ 1 / 3 ]';
        else if (fmt === 'word') txt = 'Sayfa 1 / 3';
        else if (fmt === 'page_of') txt = '1 of 3';
        if (previewPageNumDisplay) {
            previewPageNumDisplay.textContent = txt;
            if (previewPageNumDisplay.parentElement) {
                previewPageNumDisplay.parentElement.style.textAlign = al;
            }
        }
    }
    if (selectPageNumFormat) selectPageNumFormat.addEventListener('change', updatePageNumPreview);
    if (selectPageNumAlign) selectPageNumAlign.addEventListener('change', updatePageNumPreview);

    window.openPageNumSetupModal = function() {
        const cfg = (window.UkiPages && window.UkiPages.getConfig && window.UkiPages.getConfig()) || {};
        if (checkPageNumEnabled) checkPageNumEnabled.checked = cfg.showPageNumber !== false;
        if (selectPageNumFormat) selectPageNumFormat.value = cfg.pageNumberFormat || 'slash';
        if (selectPageNumAlign) selectPageNumAlign.value = cfg.pageNumberAlign || 'right';
        if (checkPageNumFirstPage) checkPageNumFirstPage.checked = cfg.showPageNumberOnFirstPage !== false;
        updatePageNumPreview();
        openModal(modalPageNumSetup);
    };

    window.toggleDocumentPageNumber = function() {
        if (window.UkiPages && window.UkiPages.togglePageNumber) {
            const active = window.UkiPages.togglePageNumber();
            recalculatePagesAndThumbnails();
            showToast(active ? 'Sayfa numaraları gösteriliyor.' : 'Sayfa numaraları gizlendi.', 'info');
        }
    };

    if (btnPageNumSave) {
        btnPageNumSave.addEventListener('click', () => {
            const enabled = checkPageNumEnabled ? checkPageNumEnabled.checked : true;
            const format = (selectPageNumFormat && selectPageNumFormat.value) || 'slash';
            const align = (selectPageNumAlign && selectPageNumAlign.value) || 'right';
            const firstPage = checkPageNumFirstPage ? checkPageNumFirstPage.checked : true;
            if (window.UkiPages && window.UkiPages.setPageNumber) {
                window.UkiPages.setPageNumber({
                    showPageNumber: enabled,
                    pageNumberFormat: format,
                    pageNumberAlign: align,
                    showPageNumberOnFirstPage: firstPage
                });
            }
            closeModal(modalPageNumSetup);
            recalculatePagesAndThumbnails();
            showToast('Sayfa numarası ayarları güncellendi.', 'success');
        });
    }
    if (btnPageNumRemove) {
        btnPageNumRemove.addEventListener('click', () => {
            if (window.UkiPages && window.UkiPages.setPageNumber) {
                window.UkiPages.setPageNumber({ showPageNumber: false });
            }
            closeModal(modalPageNumSetup);
            recalculatePagesAndThumbnails();
            showToast('Sayfa numaraları kaldırıldı.', 'info');
        });
    }

    // ----------------------------------------------------
    // MANUEL SAYFA KESMESİ (Ctrl+Enter)
    // ----------------------------------------------------
    window.insertPageBreak = function() {
        if (!editorEl) return;
        editorEl.focus();
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);

        const pb = document.createElement('div');
        pb.className = 'udf-page-break';
        pb.setAttribute('data-page-break', '1');
        pb.contentEditable = 'false';
        pb.innerHTML = '<span class="page-break-badge">─── Sayfa Kesmesi (Ctrl+Enter) ───</span>';

        const nextP = document.createElement('p');
        nextP.innerHTML = '<br>';

        range.deleteContents();
        range.insertNode(nextP);
        range.insertNode(pb);

        // İmleci sonraki paragrafa taşı
        const newRange = document.createRange();
        newRange.setStart(nextP, 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        recalculatePagesAndThumbnails();
        showToast('Sayfa kesmesi eklendi.', 'info');
    };

    function applyPagePropertiesToView(props) {
        if (!props) return;

        // Kağıt yönelimi (Dikey: 595pt x 842pt, Yatay: 842pt x 595pt)
        if (props.paperOrientation === 2) {
            editorEl.classList.add('orientation-landscape');
        } else {
            editorEl.classList.remove('orientation-landscape');
        }

        // Marjinleri doğrudan pt cinsinden padding olarak uygula
        // UYAP Java Swing editör penceresi iç kenar boşluğu (gutter) 4mm / 11.23pt'tir;
        // Sol marjin 2cm (56.69pt) olduğunda metin fiziksel olarak 67.92pt (2.4cm)'den başlar.
        // Sağ marjin 2.5cm (70.87pt) olduğunda UYAP PDF metin sınırı 522.50pt (marjin 72.82pt)'dedir.
        const leftEffPt = Math.abs(props.leftMargin - 56.69) < 2.0 ? 67.92 : props.leftMargin;
        const rightEffPt = Math.abs(props.rightMargin - 70.87) < 2.0 ? 72.82 : props.rightMargin;
        editorEl.style.padding = `${props.topMargin}pt ${rightEffPt}pt ${props.bottomMargin}pt ${leftEffPt}pt`;

        // Yatay Cetvel Marjin İşaretçilerini Güncelle
        updateRulerMarkers(parseFloat(props.leftMarginCm) || 2.0, parseFloat(props.rightMarginCm) || 2.5);

        // Durum çubuğunu güncelle
        if (statMarginsInfo) {
            statMarginsInfo.textContent = `Boşluklar: Sol ${props.leftMarginCm} cm, Sağ ${props.rightMarginCm} cm, Üst ${props.topMarginCm} cm, Alt ${props.bottomMarginCm} cm`;
        }

        // Yön/kenar boşluğu değişince sayfa ölçüleri değişir: sayfa araları, üst/alt bilgi ve önizlemeler yeniden hesaplanır
        if (typeof recalculatePagesAndThumbnails === 'function') recalculatePagesAndThumbnails();
    }

    // ----------------------------------------------------
    // ELEKTRONİK İMZA GÖRÜNTÜLEYİCİ
    // ----------------------------------------------------
    const btnViewSignatures = document.getElementById('btn-view-signatures');
    if (btnViewSignatures) {
        btnViewSignatures.addEventListener('click', showSignaturesModal);
    }
    if (signatureBadge) {
        signatureBadge.addEventListener('click', showSignaturesModal);
    }

    function showSignaturesModal() {
        const signListEl = document.getElementById('signatures-list');
        const koduEl = document.getElementById('sign-dogrulama-kodu');
        const sicilEl = document.getElementById('sign-sicil-no');

        if (!currentDocModel || !currentDocModel.isSigned) {
            showToast('Bu belgede kayıtlı elektronik imza bulunmuyor.', 'info');
            return;
        }

        if (window.UkiStats) {
            window.UkiStats.recordSignatureCheck();
        }

        const props = currentDocModel.docProperties || {};
        if (koduEl) {
            koduEl.textContent = props.uyapdogrulamakodu || 'Mevcut';
            if (props.uyapdogrulamakodu) {
                koduEl.style.cursor = 'pointer';
                koduEl.title = 'Tek tıkla kopyala';
                koduEl.onclick = () => UkiPages.copyText(props.uyapdogrulamakodu, koduEl);
            }
        }
        if (sicilEl) sicilEl.textContent = props.uyapsicil || 'Mevcut';

        if (signListEl) {
            signListEl.innerHTML = '';
            const signs = currentDocModel.signatures || [];

            if (signs.length === 0) {
                signListEl.innerHTML = '<p style="color: #64748b; font-size: 12px;">İmza dosyası (.sgn) mevcut ancak ayrıştırılabilir sertifika bulunamadı.</p>';
            } else {
                signs.forEach((s, idx) => {
                    const card = document.createElement('div');
                    card.className = 'signature-card';
                    card.innerHTML = `
                        <div class="signature-card-header">
                            <div class="signature-card-name">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                ${s.name}
                            </div>
                            <span class="signature-badge-valid">GEÇERLİ E-İMZA</span>
                        </div>
                        <div class="signature-details-grid">
                            <div><b>T.C. Kimlik / Sicil:</b> ${s.tcKimlik}</div>
                            <div><b>Sertifika Makamı:</b> ${s.issuer}</div>
                            <div><b>İmza Zamanı:</b> ${s.date}</div>
                            <div><b>Sertifika Türü:</b> ${s.type}</div>
                        </div>
                    `;
                    signListEl.appendChild(card);
                });
            }
        }

        openModal(modalSignatures);
    }

    // İmza Dosyasını (.sgn) İndir
    const btnDownloadSgn = document.getElementById('btn-download-sgn');
    if (btnDownloadSgn) {
        btnDownloadSgn.addEventListener('click', () => {
            if (!currentDocModel || !currentDocModel.sgnRawBytes) {
                showToast('İndirilecek .sgn imza dosyası bulunamadı.', 'warning');
                return;
            }
            const blob = new Blob([currentDocModel.sgnRawBytes], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = (currentFileName.replace(/\.[^/.]+$/, "") || 'belge') + '_sign.sgn';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('İmza dosyası (.sgn) indirildi.', 'success');
        });
    }

    // ----------------------------------------------------
    // PARAGRAF DÜZENLEME & SEKME DURAKLARI (UYAP SCREENSHOT PARİTESİ)
    // ----------------------------------------------------
    let currentParaAlign = 'justify';
    const btnParaSetup = document.getElementById('btn-para-setup');
    const paraLineSpacing = document.getElementById('para-line-spacing');
    const paraSpaceAbove = document.getElementById('para-space-above');
    const paraSpaceBelow = document.getElementById('para-space-below');
    const paraFirstIndent = document.getElementById('para-first-indent');
    const paraHangingIndent = document.getElementById('para-hanging-indent');
    const paraLeftIndent = document.getElementById('para-left-indent');
    const paraRightIndent = document.getElementById('para-right-indent');
    const paraPreviewBox = document.getElementById('para-preview-box');

    // Sayısal dönüştürme ve Türkçe virgül/nokta ayrıştırıcıları
    function parseCm(val, defaultVal = 0) {
        if (val === null || val === undefined) return defaultVal;
        const s = String(val).trim().replace(',', '.');
        const n = parseFloat(s);
        return isNaN(n) ? defaultVal : n;
    }

    function formatCm(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        if (Math.abs(num) < 0.0001) return '0';
        if (Math.abs(num - Math.round(num)) < 0.0001) return String(Math.round(num));
        let str = num.toFixed(decimals).replace('.', ',');
        if (str.includes(',')) {
            str = str.replace(/0+$/, '').replace(/,$/, '');
        }
        return str;
    }

    function updateParaPreview() {
        if (!paraPreviewBox) return;
        const lineSpacing = parseCm(paraLineSpacing ? paraLineSpacing.value : 1.0, 1.0);
        const spaceAbove = parseCm(paraSpaceAbove ? paraSpaceAbove.value : 0, 0);
        const spaceBelow = parseCm(paraSpaceBelow ? paraSpaceBelow.value : 0, 0);
        const firstIndent = parseCm(paraFirstIndent ? paraFirstIndent.value : 0, 0);
        const hangingIndent = parseCm(paraHangingIndent ? paraHangingIndent.value : 0, 0);
        const leftIndent = parseCm(paraLeftIndent ? paraLeftIndent.value : 0, 0);
        const rightIndent = parseCm(paraRightIndent ? paraRightIndent.value : 0, 0);

        paraPreviewBox.style.lineHeight = String(lineSpacing);
        paraPreviewBox.style.paddingTop = `${Math.min(10, spaceAbove * 30)}px`;
        paraPreviewBox.style.paddingBottom = `${Math.min(10, spaceBelow * 30)}px`;

        const CM_TO_PREVIEW_PX = 12;
        const leftPx = Math.min(40, leftIndent * CM_TO_PREVIEW_PX);
        const rightPx = Math.min(40, rightIndent * CM_TO_PREVIEW_PX);
        const firstPx = firstIndent * CM_TO_PREVIEW_PX;
        const hangPx = hangingIndent * CM_TO_PREVIEW_PX;

        if (hangPx > 0) {
            paraPreviewBox.style.paddingLeft = `${leftPx + hangPx}px`;
            paraPreviewBox.style.textIndent = `${-hangPx + firstPx}px`;
        } else {
            paraPreviewBox.style.paddingLeft = `${leftPx}px`;
            paraPreviewBox.style.textIndent = `${firstPx}px`;
        }
        paraPreviewBox.style.paddingRight = `${rightPx}px`;
        paraPreviewBox.style.textAlign = currentParaAlign;
    }

    // Hizalama butonları
    const paraAlignBtns = document.querySelectorAll('.para-align-btn');
    paraAlignBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            paraAlignBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentParaAlign = btn.getAttribute('data-align') || 'left';
            updateParaPreview();
        });
    });

    [paraLineSpacing, paraSpaceAbove, paraSpaceBelow, paraFirstIndent, paraHangingIndent, paraLeftIndent, paraRightIndent].forEach(inp => {
        if (inp) {
            inp.addEventListener('input', updateParaPreview);
            inp.addEventListener('change', updateParaPreview);
        }
    });

    if (btnParaSetup) {
        btnParaSetup.addEventListener('click', () => {
            // Aktif paragrafın UYAP özelliklerini (girintiler, aralıklar, hizalama) oku ve forma aktar
            const paras = typeof selectedParagraphs === 'function' ? selectedParagraphs() : [];
            const p = paras[0] || (editorEl ? editorEl.querySelector('p') : null);
            const PT_TO_CM = 2.54 / 72; // 0.035277777777777776 cm/pt

            if (p) {
                // 1. İlk Satır Girintisi (cm)
                let fliPt = 0;
                if (p.hasAttribute('data-fli')) {
                    fliPt = parseCm(p.getAttribute('data-fli'), 0);
                } else if (p.style.textIndent && parseFloat(p.style.textIndent) > 0) {
                    fliPt = parseFloat(p.style.textIndent);
                }
                if (paraFirstIndent) {
                    paraFirstIndent.value = fliPt > 0 ? formatCm(fliPt * PT_TO_CM, 2) : '0';
                }

                // 2. Asılı Girinti (cm)
                let hangPt = 0;
                if (p.hasAttribute('data-hanging')) {
                    hangPt = parseCm(p.getAttribute('data-hanging'), 0);
                } else if (parseFloat(p.style.paddingLeft) > 0 && parseFloat(p.style.textIndent) < 0) {
                    hangPt = parseFloat(p.style.paddingLeft);
                }
                if (paraHangingIndent) {
                    paraHangingIndent.value = hangPt > 0 ? formatCm(hangPt * PT_TO_CM, 2) : '0';
                }

                // 3. Sol Girinti (cm)
                let liPt = 0;
                if (p.hasAttribute('data-li')) {
                    liPt = parseCm(p.getAttribute('data-li'), 0);
                } else if (p.style.marginLeft) {
                    liPt = parseFloat(p.style.marginLeft);
                }
                if (paraLeftIndent) {
                    paraLeftIndent.value = liPt > 0 ? formatCm(liPt * PT_TO_CM, 2) : '0';
                }

                // 4. Sağ Girinti (cm)
                let riPt = 0;
                if (p.hasAttribute('data-ri')) {
                    riPt = parseCm(p.getAttribute('data-ri'), 0);
                } else if (p.style.marginRight) {
                    riPt = parseFloat(p.style.marginRight);
                }
                if (paraRightIndent) {
                    paraRightIndent.value = riPt > 0 ? formatCm(riPt * PT_TO_CM, 2) : '0';
                }

                // 5. Aralık Önce (cm)
                let saPt = 1.0;
                if (p.hasAttribute('data-spaceabove')) {
                    saPt = parseCm(p.getAttribute('data-spaceabove'), 1.0);
                } else if (p.style.paddingTop) {
                    saPt = parseFloat(p.style.paddingTop);
                }
                if (paraSpaceAbove) {
                    paraSpaceAbove.value = formatCm(saPt * PT_TO_CM, 3);
                }

                // 6. Aralık Sonra (cm)
                let sbPt = 1.0;
                if (p.hasAttribute('data-spacebelow')) {
                    sbPt = parseCm(p.getAttribute('data-spacebelow'), 1.0);
                } else if (p.style.paddingBottom) {
                    sbPt = parseFloat(p.style.paddingBottom);
                }
                if (paraSpaceBelow) {
                    paraSpaceBelow.value = formatCm(sbPt * PT_TO_CM, 3);
                }

                // 7. Satır Aralığı
                if (paraLineSpacing) {
                    const lsAttr = p.getAttribute('data-linespacing');
                    if (lsAttr !== null && lsAttr !== '' && lsAttr !== undefined) {
                        const lsNum = parseFloat(lsAttr);
                        if (Math.abs(lsNum - 0.0) < 0.01) paraLineSpacing.value = '1.0';
                        else if (Math.abs(lsNum - 0.5) < 0.01) paraLineSpacing.value = '1.5';
                        else if (Math.abs(lsNum - 1.0) < 0.01) paraLineSpacing.value = '2.0';
                        else paraLineSpacing.value = (1.0 + lsNum).toFixed(1);
                    } else if (p.style.lineHeight) {
                        paraLineSpacing.value = p.style.lineHeight;
                    } else {
                        paraLineSpacing.value = '1.0';
                    }
                }

                // 8. Hizalama
                const computed = window.getComputedStyle(p);
                currentParaAlign = p.style.textAlign || computed.textAlign || 'justify';
                if (currentParaAlign === 'start') currentParaAlign = 'left';
                paraAlignBtns.forEach(b => {
                    b.classList.toggle('active', b.getAttribute('data-align') === currentParaAlign);
                });
            } else {
                // UYAP varsayılanları (Screenshot 7 ile birebir)
                if (paraLineSpacing) paraLineSpacing.value = '1.0';
                if (paraSpaceAbove) paraSpaceAbove.value = '0,035';
                if (paraSpaceBelow) paraSpaceBelow.value = '0,035';
                if (paraFirstIndent) paraFirstIndent.value = '1,25';
                if (paraHangingIndent) paraHangingIndent.value = '0';
                if (paraLeftIndent) paraLeftIndent.value = '0';
                if (paraRightIndent) paraRightIndent.value = '0';
                currentParaAlign = 'justify';
                paraAlignBtns.forEach(b => {
                    b.classList.toggle('active', b.getAttribute('data-align') === currentParaAlign);
                });
            }
            updateParaPreview();
            openModal(modalParaSetup);
        });
    }

    // Paragraf modalı Alt tuşu erişim kısayolları
    if (modalParaSetup) {
        modalParaSetup.addEventListener('keydown', (e) => {
            if (e.altKey && !e.ctrlKey && !e.metaKey) {
                const k = e.key.toLowerCase();
                if (k === 's') {
                    e.preventDefault();
                    const b = document.getElementById('para-btn-align-left');
                    if (b) b.click();
                } else if (k === 'o') {
                    e.preventDefault();
                    const b = document.getElementById('para-btn-align-center');
                    if (b) b.click();
                } else if (k === 'a') {
                    e.preventDefault();
                    const b = document.getElementById('para-btn-align-right');
                    if (b) b.click();
                } else if (k === 'i' || k === 'ı') {
                    e.preventDefault();
                    const b = document.getElementById('para-btn-align-justify');
                    if (b) b.click();
                } else if (k === 't') {
                    e.preventDefault();
                    const btnSave = document.getElementById('btn-para-save');
                    if (btnSave) btnSave.click();
                } else if (k === 'v') {
                    e.preventDefault();
                    closeModal(modalParaSetup);
                }
            }
        });
    }

    const btnParaSave = document.getElementById('btn-para-save');
    if (btnParaSave) {
        btnParaSave.addEventListener('click', () => {
            const spacing = parseCm(paraLineSpacing ? paraLineSpacing.value : 1.0, 1.0);
            const firstIndent = parseCm(paraFirstIndent ? paraFirstIndent.value : 0, 0);
            const hangingIndent = parseCm(paraHangingIndent ? paraHangingIndent.value : 0, 0);
            const spaceAbove = parseCm(paraSpaceAbove ? paraSpaceAbove.value : 0, 0);
            const spaceBelow = parseCm(paraSpaceBelow ? paraSpaceBelow.value : 0, 0);
            const leftIndent = parseCm(paraLeftIndent ? paraLeftIndent.value : 0, 0);
            const rightIndent = parseCm(paraRightIndent ? paraRightIndent.value : 0, 0);

            const CM_TO_PT = 72 / 2.54; // 28.3464567 pt/cm
            const fliPt = Math.round(firstIndent * CM_TO_PT * 100) / 100;
            const hangPt = Math.round(hangingIndent * CM_TO_PT * 100) / 100;
            const liPt = Math.round(leftIndent * CM_TO_PT * 100) / 100;
            const riPt = Math.round(rightIndent * CM_TO_PT * 100) / 100;
            const saPt = Math.round(spaceAbove * CM_TO_PT * 100) / 100;
            const sbPt = Math.round(spaceBelow * CM_TO_PT * 100) / 100;

            const lsVal = spacing <= 1.0 ? '0.0' : (spacing - 1.0).toFixed(1);

            const paras = typeof selectedParagraphs === 'function' ? selectedParagraphs() : [];
            const targets = paras.length ? paras : (editorEl ? Array.from(editorEl.querySelectorAll('p')) : []);

            if (window.UkiHistory && typeof window.UkiHistory.record === 'function') {
                window.UkiHistory.record('Paragraf Ayarları Öncesi');
            }

            targets.forEach(p => {
                p.setAttribute('data-fli', String(fliPt));
                p.setAttribute('data-hanging', String(hangPt));
                p.setAttribute('data-li', String(liPt));
                p.setAttribute('data-ri', String(riPt));
                p.setAttribute('data-spaceabove', String(saPt));
                p.setAttribute('data-spacebelow', String(sbPt));
                p.setAttribute('data-linespacing', String(lsVal));

                p.style.textAlign = currentParaAlign;
                p.style.lineHeight = String(spacing);
                p.style.margin = `0 ${riPt}pt 0 ${liPt}pt`;
                p.style.padding = `${saPt}pt 0 ${sbPt}pt 0`;

                if (hangPt > 0) {
                    p.style.paddingLeft = hangPt + 'pt';
                    p.style.textIndent = (-hangPt + fliPt) + 'pt';
                } else if (fliPt > 0) {
                    p.style.textIndent = fliPt + 'pt';
                    p.style.paddingLeft = '0';
                } else {
                    p.style.textIndent = '0';
                    p.style.paddingLeft = '0';
                }
            });

            if (typeof UkiCore !== 'undefined' && UkiCore.layoutTabs) {
                UkiCore.layoutTabs(editorEl);
            }
            if (typeof renderRulerStops === 'function') {
                renderRulerStops();
            }
            if (typeof recalculatePagesAndThumbnails === 'function') {
                recalculatePagesAndThumbnails();
            }
            if (window.UkiHistory && typeof window.UkiHistory.record === 'function') {
                window.UkiHistory.record('Paragraf Ayarları');
            }

            closeModal(modalParaSetup);
            showToast('Paragraf özellikleri uygulandı.', 'success');
        });
    }

    // ----------------------------------------------------
    // SEKME DURAKLARI (TAB STOPS) MODALI
    // ----------------------------------------------------
    let currentModalTabStops = [];
    const btnParaTabStop = document.getElementById('btn-para-tab-stop');
    const inputTabstopCm = document.getElementById('input-tabstop-cm');
    const selectTabstopList = document.getElementById('select-tabstop-list');
    const btnTabstopAdd = document.getElementById('btn-tabstop-add');
    const btnTabstopDel = document.getElementById('btn-tabstop-del');
    const btnTabstopClearAll = document.getElementById('btn-tabstop-clear-all');
    const btnTabstopSave = document.getElementById('btn-tabstop-save');

    function renderTabstopList() {
        if (!selectTabstopList) return;
        selectTabstopList.innerHTML = '';
        currentModalTabStops.sort((a, b) => a.pos - b.pos);
        const alignLabels = { '0': 'Sol', '1': 'Sağa', '2': 'Ortalanmış', '3': 'Ondalık' };
        const PT_TO_CM = 2.54 / 72;
        currentModalTabStops.forEach((st, idx) => {
            const opt = document.createElement('option');
            opt.value = String(idx);
            const cm = formatCm(st.pos * PT_TO_CM, 2);
            const alignTxt = alignLabels[String(st.align)] || 'Sol';
            opt.textContent = `${cm} cm   (${alignTxt})`;
            selectTabstopList.appendChild(opt);
        });
    }

    function getSelectedTabAlign() {
        const el = document.querySelector('input[name="tabstop-align"]:checked');
        return el ? el.value : '0';
    }

    function setSelectedTabAlign(val) {
        const el = document.querySelector(`input[name="tabstop-align"][value="${val}"]`);
        if (el) el.checked = true;
    }

    function getSelectedTabLead() {
        const el = document.querySelector('input[name="tabstop-lead"]:checked');
        return el ? el.value : '0';
    }

    function setSelectedTabLead(val) {
        const el = document.querySelector(`input[name="tabstop-lead"][value="${val}"]`);
        if (el) el.checked = true;
    }

    if (btnParaTabStop) {
        btnParaTabStop.addEventListener('click', () => {
            const paras = typeof selectedParagraphs === 'function' ? selectedParagraphs() : [];
            const p = paras[0] || (editorEl ? editorEl.querySelector('p') : null);
            currentModalTabStops = (p && typeof parseStops === 'function') ? parseStops(p) : [];
            renderTabstopList();
            if (inputTabstopCm) inputTabstopCm.value = '';
            setSelectedTabAlign('0');
            setSelectedTabLead('0');
            openModal(modalTabstopSetup);
        });
    }

    if (selectTabstopList) {
        selectTabstopList.addEventListener('change', () => {
            const idx = parseInt(selectTabstopList.value, 10);
            if (!isNaN(idx) && currentModalTabStops[idx]) {
                const st = currentModalTabStops[idx];
                const PT_TO_CM = 2.54 / 72;
                if (inputTabstopCm) inputTabstopCm.value = formatCm(st.pos * PT_TO_CM, 2);
                setSelectedTabAlign(st.align || '0');
                setSelectedTabLead(st.lead || '0');
            }
        });
    }

    if (btnTabstopAdd) {
        btnTabstopAdd.addEventListener('click', () => {
            const cm = parseCm(inputTabstopCm ? inputTabstopCm.value : 0, 0);
            if (cm <= 0) {
                showToast('Lütfen geçerli bir sekme durağı konumu girin.', 'warning');
                return;
            }
            const CM_TO_PT = 72 / 2.54;
            const posPt = Math.round(cm * CM_TO_PT * 10) / 10;
            const align = getSelectedTabAlign();
            const lead = getSelectedTabLead();

            const existingIdx = currentModalTabStops.findIndex(x => Math.abs(x.pos - posPt) < 1.0);
            if (existingIdx >= 0) {
                currentModalTabStops[existingIdx] = { pos: posPt, align, lead };
            } else {
                currentModalTabStops.push({ pos: posPt, align, lead });
            }
            renderTabstopList();
            showToast(`${formatCm(cm, 2)} cm sekme durağı ayarlandı.`, 'info');
        });
    }

    if (btnTabstopDel) {
        btnTabstopDel.addEventListener('click', () => {
            const idx = parseInt(selectTabstopList.value, 10);
            if (isNaN(idx) || !currentModalTabStops[idx]) {
                showToast('Lütfen silinecek durağı listeden seçin.', 'warning');
                return;
            }
            currentModalTabStops.splice(idx, 1);
            renderTabstopList();
            if (inputTabstopCm) inputTabstopCm.value = '';
        });
    }

    if (btnTabstopClearAll) {
        btnTabstopClearAll.addEventListener('click', () => {
            currentModalTabStops = [];
            renderTabstopList();
            if (inputTabstopCm) inputTabstopCm.value = '';
            showToast('Tüm sekme durakları temizlendi.', 'info');
        });
    }

    if (btnTabstopSave) {
        btnTabstopSave.addEventListener('click', () => {
            const paras = typeof selectedParagraphs === 'function' ? selectedParagraphs() : [];
            const targets = paras.length ? paras : (editorEl ? Array.from(editorEl.querySelectorAll('p')) : []);
            if (typeof writeStops === 'function') {
                targets.forEach(p => writeStops(p, currentModalTabStops));
            }
            if (typeof afterTabChange === 'function') {
                afterTabChange();
            }
            closeModal(modalTabstopSetup);
            showToast('Sekme durakları uygulandı.', 'success');
        });
    }

    // ----------------------------------------------------
    // BUL VE DEĞİŞTİR (FIND & REPLACE - UYAP & ASTRYX STANDARD)
    // ----------------------------------------------------
    const btnFindReplace = document.getElementById('btn-find-replace');
    const tabBtnFind = document.getElementById('tab-btn-find');
    const tabBtnReplace = document.getElementById('tab-btn-replace');
    const replaceFieldGroup = document.getElementById('replace-field-group');
    const replaceActionsGroup = document.getElementById('replace-actions-group');
    const findInput = document.getElementById('find-input');
    const replaceInput = document.getElementById('replace-input');
    const findCountBadge = document.getElementById('find-count-badge');
    const chkFindCase = document.getElementById('chk-find-case');
    const chkFindWhole = document.getElementById('chk-find-whole');
    const btnFindPrev = document.getElementById('btn-find-prev');
    const btnFindNext = document.getElementById('btn-find-next');
    const btnReplaceOne = document.getElementById('btn-replace-one');
    const btnReplaceAll = document.getElementById('btn-replace-all');

    function switchFindReplaceMode(mode) {
        if (mode === 'replace') {
            if (tabBtnReplace) tabBtnReplace.classList.add('active');
            if (tabBtnFind) tabBtnFind.classList.remove('active');
            if (replaceFieldGroup) replaceFieldGroup.style.display = 'flex';
            if (replaceActionsGroup) replaceActionsGroup.style.display = 'flex';
        } else {
            if (tabBtnFind) tabBtnFind.classList.add('active');
            if (tabBtnReplace) tabBtnReplace.classList.remove('active');
            if (replaceFieldGroup) replaceFieldGroup.style.display = 'none';
            if (replaceActionsGroup) replaceActionsGroup.style.display = 'none';
        }
        updateFindCount();
    }

    if (tabBtnFind) tabBtnFind.addEventListener('click', () => switchFindReplaceMode('find'));
    if (tabBtnReplace) tabBtnReplace.addEventListener('click', () => switchFindReplaceMode('replace'));

    function openFindReplaceModal(mode = 'find') {
        switchFindReplaceMode(mode);
        openModal(modalFindReplace);

        // Seçili metin varsa arama kutusuna otomatik doldur
        const sel = window.getSelection();
        const selectedText = sel ? sel.toString().trim() : '';
        if (selectedText && selectedText.length < 100) {
            findInput.value = selectedText;
        }

        setTimeout(() => {
            if (findInput) {
                findInput.focus();
                findInput.select();
            }
            updateFindCount();
        }, 50);
    }

    if (btnFindReplace) {
        btnFindReplace.addEventListener('click', () => openFindReplaceModal('find'));
    }

    // Ctrl+F ve Ctrl+H Dinleyicisi
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
            e.preventDefault();
            openFindReplaceModal('find');
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H')) {
            e.preventDefault();
            openFindReplaceModal('replace');
        } else if (e.key === 'F3') {
            e.preventDefault();
            if (e.shiftKey) {
                executeFind(true);
            } else {
                executeFind(false);
            }
        }
    });

    if (findInput) {
        findInput.addEventListener('input', updateFindCount);
        findInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                executeFind(e.shiftKey);
            }
        });
    }

    if (replaceInput) {
        replaceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                executeReplaceOne();
            }
        });
    }

    if (chkFindCase) chkFindCase.addEventListener('change', updateFindCount);
    if (chkFindWhole) chkFindWhole.addEventListener('change', updateFindCount);

    function updateFindCount() {
        if (!findInput || !findCountBadge) return;
        const q = findInput.value;
        if (!q) {
            findCountBadge.style.display = 'none';
            return;
        }

        const caseSensitive = chkFindCase && chkFindCase.checked;
        const wholeWord = chkFindWhole && chkFindWhole.checked;
        const text = editorEl ? (editorEl.innerText || '') : '';

        try {
            const matches = text.match(buildFindRegex(q, caseSensitive, wholeWord));
            const count = matches ? matches.length : 0;

            findCountBadge.textContent = `${count} eşleşme`;
            findCountBadge.style.display = 'inline-block';
            findCountBadge.style.color = count > 0 ? 'var(--ax-color-primary)' : '#dc2626';
        } catch (err) {
            findCountBadge.style.display = 'none';
        }
    }

    function executeFind(backwards = false) {
        const query = findInput ? findInput.value : '';
        if (!query) return;

        const caseSensitive = chkFindCase ? chkFindCase.checked : false;
        const wholeWord = chkFindWhole ? chkFindWhole.checked : false;

        if (window.find) {
            const found = window.find(query, caseSensitive, backwards, true, wholeWord, false, false);
            if (!found) {
                showToast('Arama sonuna ulaşıldı veya eşleşme bulunamadı.', 'info');
            } else {
                const sel = window.getSelection();
                if (sel && sel.anchorNode && sel.anchorNode.parentElement) {
                    sel.anchorNode.parentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }
    }

    if (btnFindNext) btnFindNext.addEventListener('click', () => executeFind(false));
    if (btnFindPrev) btnFindPrev.addEventListener('click', () => executeFind(true));

    function executeReplaceOne() {
        const q = findInput ? findInput.value : '';
        const r = replaceInput ? replaceInput.value : '';
        if (!q) return;

        const sel = window.getSelection();
        const selectedText = sel ? sel.toString() : '';
        const caseSensitive = chkFindCase && chkFindCase.checked;

        const matches = caseSensitive 
            ? selectedText === q 
            : selectedText.toLowerCase() === q.toLowerCase();

        if (matches && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const textNode = document.createTextNode(r);
            range.insertNode(textNode);

            // Seçimi değiştirilen metnin sonrasına kaydır
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            sel.removeAllRanges();
            sel.addRange(range);

            showToast('Eşleşme değiştirildi.', 'success');
            executeFind(false);
            updateFindCount();
        } else {
            // Henüz seçili eşleşme yoksa önce bul
            executeFind(false);
        }
    }

    if (btnReplaceOne) btnReplaceOne.addEventListener('click', executeReplaceOne);

    if (btnReplaceAll) {
        btnReplaceAll.addEventListener('click', () => {
            const q = findInput ? findInput.value : '';
            const r = replaceInput ? replaceInput.value : '';
            if (!q) return;

            const caseSensitive = chkFindCase && chkFindCase.checked;
            const wholeWord = chkFindWhole && chkFindWhole.checked;

            const regex = buildFindRegex(q, caseSensitive, wholeWord);

            // DOM HTML taglerini bozmadan sadece metin düğümlerinde (TextNodes) güvenli değiştirme
            let replaceCount = 0;
            const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT, null, false);
            const textNodes = [];

            while (walker.nextNode()) {
                textNodes.push(walker.currentNode);
            }

            textNodes.forEach(node => {
                const original = node.nodeValue;
                const replaced = original.replace(regex, () => { replaceCount++; return r; });
                if (replaced !== original) node.nodeValue = replaced;
            });

            if (replaceCount > 0) {
                showToast(`${replaceCount} adet eşleşme başarıyla değiştirildi.`, 'success');
                updateFindCount();
            } else {
                showToast(`"${q}" için eşleşme bulunamadı.`, 'info');
            }
        });
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /** Türkçe duyarlı arama: i/İ ve ı/I eşleşmesi, Unicode sözcük sınırı (ç, ğ, ı, ö, ş, ü). */
    function buildFindRegex(query, caseSensitive, wholeWord) {
        let pattern = '';
        for (const ch of query) {
            if (!caseSensitive && 'iİ'.includes(ch)) pattern += '[iİ]';
            else if (!caseSensitive && 'ıI'.includes(ch)) pattern += '[ıI]';
            else pattern += escapeRegExp(ch);
        }
        if (wholeWord) pattern = '(?<![\\p{L}\\p{N}_])' + pattern + '(?![\\p{L}\\p{N}_])';
        return new RegExp(pattern, caseSensitive ? 'gu' : 'giu');
    }

    // ----------------------------------------------------
    // DOSYA İŞLEMLERİ: UDF AÇMA / YÜKLEME
    // ----------------------------------------------------
    const openBtn = document.getElementById('btn-open');
    if (openBtn) {
        openBtn.addEventListener('click', () => fileInput.click());
    }

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fname = file.name.toLowerCase();
        if (fname.endsWith('.docx')) {
            await loadDocxFile(file);
        } else if ((fname.endsWith('.md') || fname.endsWith('.markdown')) && window.UkiMarkdown) {
            await window.UkiMarkdown.importMdFile(file);
        } else if ((file.type.startsWith('image/') || fname.match(/\.(png|jpe?g|bmp|tiff?|webp)$/)) && window.UkiOCR) {
            window.UkiOCR.openModal(file);
        } else {
            await loadUdfFile(file);
        }
        fileInput.value = '';
    });

    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const fname = file.name.toLowerCase();
            if (fname.endsWith('.udf')) {
                await loadUdfFile(file);
            } else if (fname.endsWith('.docx')) {
                await loadDocxFile(file);
            } else if ((fname.endsWith('.md') || fname.endsWith('.markdown') || fname.endsWith('.txt')) && window.UkiMarkdown) {
                await window.UkiMarkdown.importMdFile(file);
            } else if ((file.type.startsWith('image/') || fname.match(/\.(png|jpe?g|bmp|tiff?|webp)$/)) && window.UkiOCR) {
                window.UkiOCR.openModal(file);
            } else {
                showToast('Lütfen .udf, .docx, .md veya taranacak bir görsel dosyası bırakın.', 'warning');
            }
        }
    });

    async function loadDocxFile(file) {
        try {
            setStatus('Word (.docx) belgesi açılıyor...');
            showToast('Word belgesi dönüştürülüyor...', 'info');
            const buffer = await file.arrayBuffer();
            const udfModel = await UkiCore.parseDocx(buffer);
            currentDocModel = udfModel;

            currentFileName = file.name;
            const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
            if (docTitleInput) docTitleInput.value = cleanTitle;

            // Marjinleri ve Sayfa Boyutlarını Uygula
            applyPagePropertiesToView(udfModel.pageProperties);

            // HTML'e çevir ve editöre yükle
            const html = UkiCore.udfModelToHtml(udfModel);
            editor.setContentHtml(html);
            UkiPages.configure(udfModel);
            removeAntetFromEditor();

            renderWatermark('', false);
            renderElectronicSeal([]);
            if (signatureBadge) signatureBadge.style.display = 'none';

            setTimeout(() => {
                if (typeof recalculatePagesAndThumbnails === 'function') {
                    recalculatePagesAndThumbnails();
                }
            }, 80);

            window.UkiApp.markSaved();
            if (window.UkiStats) {
                const plainText = window.UkiApp.text();
                window.UkiStats.recordDocumentOpened({
                    text: plainText,
                    source: 'docx',
                    title: cleanTitle
                });
            }

            setStatus('Hazır');
            showToast('Word belgesi başarıyla açıldı ve UDF formatına dönüştürüldü.', 'success');
            if (window.UkiAI && document.getElementById('ai-assistant-drawer')?.classList.contains('open')) {
                window.UkiAI.runAnalysis();
            }
        } catch (err) {
            console.error('[loadDocxFile]', err);
            setStatus('Hata');
            showToast('Word belgesi açılamadı: ' + err.message, 'error');
        }
    }

    const btnOcrScan = document.getElementById('btn-ocr-scan');
    if (btnOcrScan) {
        btnOcrScan.addEventListener('click', () => {
            if (window.UkiOCR) window.UkiOCR.openModal();
        });
    }

    async function loadUdfFile(file) {
        try {
            setStatus('Dosya açılıyor...');
            const buffer = await file.arrayBuffer();
            const udfModel = await UkiCore.parseUdf(buffer);
            currentDocModel = udfModel;

            currentFileName = file.name;
            const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
            if (docTitleInput) docTitleInput.value = cleanTitle;

            // Marjinleri ve Sayfa Boyutlarını Uygula
            applyPagePropertiesToView(udfModel.pageProperties);

            // HTML'e çevir ve editöre yükle
            const html = UkiCore.udfModelToHtml(udfModel);
            editor.setContentHtml(html);
            UkiPages.configure(udfModel);
            // Açılan belgenin kendi düzeni vardır; kayıtlı antet üzerine binmesin (kayıt silinmez)
            removeAntetFromEditor();

            // Güvenlik Filigranı Güncelle (Screenshot 3 ile birebir)
            renderWatermark(watermarkTextFor(udfModel), isWatermarkActive);

            // E-İmza kontrolü ve Altın Mühür Rozeti (Screenshot 3)
            if (udfModel.isSigned) {
                let sigList = udfModel.signatures;
                if (!sigList || sigList.length === 0) {
                    sigList = [
                        { commonName: 'İmza paketi mevcut — sertifika sahibi çözümlenemedi', type: 'Kriptografik doğrulama yapılmadı' }
                    ];
                }
                renderElectronicSeal(sigList);
                if (signatureBadge) {
                    signatureBadge.style.display = 'inline-flex';
                    if (signatureBadgeText) signatureBadgeText.textContent = `E-İmzalı (${sigList.length})`;
                }
            } else {
                renderElectronicSeal([]);
                if (signatureBadge) signatureBadge.style.display = 'none';
            }

            // Çok sayfalı döküman sayfa ve önizleme hesaplaması
            setTimeout(() => {
                if (typeof recalculatePagesAndThumbnails === 'function') {
                    recalculatePagesAndThumbnails();
                }
            }, 80);

            // Kullanım İstatistikleri ve 657astro Sayacı Kaydı
            window.UkiApp.markSaved();
            if (window.UkiStats) {
                const plainText = window.UkiApp.text();
                window.UkiStats.recordDocumentOpened({
                    text: plainText,
                    fileName: file.name,
                    source: (file.name && file.name.startsWith('http')) ? 'linkac' : 'file'
                });
            }

            setStatus('Hazır');
            showToast(`"${file.name}" başarıyla açıldı.`, 'success');
            if (window.UkiAI && document.getElementById('ai-assistant-drawer')?.classList.contains('open')) {
                window.UkiAI.runAnalysis();
            }
        } catch (err) {
            console.error('UDF Açma Hatası:', err);
            setStatus('Hata');
            showToast('Dosya açılırken hata oluştu: ' + err.message, 'error');
        }
    }

    // ----------------------------------------------------
    // DOSYA İŞLEMLERİ: UDF KAYDETME / İNDİRME
    // ----------------------------------------------------
    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) {
        saveBtn.addEventListener('click', triggerSave);
    }

    // ----------------------------------------------------
    // DOSYA İŞLEMLERİ: WORD (.DOCX) DIŞA AKTARMA
    // ----------------------------------------------------
    const exportDocxBtn = document.getElementById('btn-export-docx');
    if (exportDocxBtn) {
        exportDocxBtn.addEventListener('click', triggerExportDocx);
    }

    // ----------------------------------------------------
    // DOSYA İŞLEMLERİ: MARKDOWN (.MD) DIŞA AKTARMA
    // ----------------------------------------------------
    const exportMdBtn = document.getElementById('btn-export-md');
    if (exportMdBtn) {
        exportMdBtn.addEventListener('click', () => {
            if (window.UkiMarkdown) {
                window.UkiMarkdown.exportMdFile();
            }
        });
    }

    async function triggerExportDocx() {
        try {
            setStatus('Word (.docx) hazırlanıyor...');
            showToast('Word belgesi oluşturuluyor...', 'info');

            const pageProps = currentDocModel ? currentDocModel.pageProperties : {};
            const blob = await UkiCore.exportDocxBlob(editorEl, pageProps, currentDocModel);

            let rawTitle = (docTitleInput ? docTitleInput.value.trim() : '') || 'belge';
            let baseName = rawTitle.replace(/\.udf$/i, '').replace(/\.docx$/i, '');
            const filename = `${baseName}.docx`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);

            setStatus('DOCX Kaydedildi');
            showToast(`"${filename}" başarıyla indirildi.`, 'success');

            if (window.UkiStats) {
                window.UkiStats.recordDocumentDownloaded('docx');
            }
        } catch (err) {
            console.error('Word Dışa Aktarma Hatası:', err);
            setStatus('Hata');
            showToast('Word (.docx) oluşturulurken hata oluştu: ' + err.message, 'error');
        }
    }

    async function triggerSave() {
        try {
            setStatus('UDF oluşturuluyor...');
            const pageProps = currentDocModel ? (currentDocModel.pageProperties || {}) : {};
            const origZip = currentDocModel ? currentDocModel.zipInstance : null;
            const liveConfig = (window.UkiPages && window.UkiPages.getConfig) ? window.UkiPages.getConfig() : {};
            const liveHeader = (window.UkiPages && window.UkiPages.getHeader) ? window.UkiPages.getHeader() : null;
            const docWebId = liveConfig.webId || (currentDocModel && currentDocModel.webId) || '';

            const blob = await UkiCore.exportUdfBlob(editorEl, Object.assign({}, pageProps, {
                headerInfo: liveHeader || (currentDocModel && (currentDocModel.headerInfo || currentDocModel.headerElement)),
                footerInfo: liveConfig,
                webId: docWebId,
                footerElement: currentDocModel ? currentDocModel.footerElement : null
            }), origZip);

            let filename = (docTitleInput ? docTitleInput.value.trim() : '') || 'belge';
            if (!filename.toLowerCase().endsWith('.udf')) {
                filename += '.udf';
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            window.UkiApp.markSaved();
            setStatus('Kaydedildi');
            showToast(`"${filename}" başarıyla indirildi.`, 'success');

            if (window.UkiStats) {
                window.UkiStats.recordDocumentDownloaded('udf');
            }
        } catch (err) {
            console.error('UDF Kaydetme Hatası:', err);
            setStatus('Hata');
            showToast('UDF kaydedilirken hata oluştu: ' + err.message, 'error');
        }
    }

    // ----------------------------------------------------
    // YAZDIR / PDF AKTARMA
    // ----------------------------------------------------
    const printBtn = document.getElementById('btn-print');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            if (window.UkiStats) {
                window.UkiStats.recordPrint();
                window.UkiStats.recordDocumentDownloaded('pdf');
            }
            window.print();
        });
    }

    // ----------------------------------------------------
    // YENİ BELGE
    // ----------------------------------------------------
    const newBtn = document.getElementById('btn-new');
    if (newBtn) {
        newBtn.addEventListener('click', () => { triggerNewDoc(); });
    }

    // ----------------------------------------------------
    // TABLO İŞLEMLERİ (İMLEÇ KONUMUNA HASSAS EKLEME)
    // ----------------------------------------------------
    const insertTableBtn = document.getElementById('btn-insert-table');
    if (insertTableBtn) {
        insertTableBtn.addEventListener('click', async () => {
            // İmleç konumunu diyalog açılmadan HEMEN ÖNCE kaydet!
            let savedRange = null;
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && editorEl.contains(sel.anchorNode)) {
                savedRange = sel.getRangeAt(0).cloneRange();
            } else if (lastEditorRange && editorEl.contains(lastEditorRange.startContainer)) {
                savedRange = lastEditorRange.cloneRange();
            }

            const v = await UkiDialog.form({
                title: 'Tablo ekle',
                okText: 'Ekle',
                fields: [
                    { id: 'rows', label: 'Satır sayısı', value: 3, type: 'number', min: 1, max: 50 },
                    { id: 'cols', label: 'Sütun sayısı', value: 3, type: 'number', min: 1, max: 12 }
                ]
            });
            if (!v) return;
            const clamp = (x, lo, hi, d) => Math.min(hi, Math.max(lo, parseInt(x, 10) || d));
            const rows = clamp(v.rows, 1, 50, 3);
            const cols = clamp(v.cols, 1, 12, 3);
            editor.insertTable(rows, cols, savedRange);
            showToast(`${rows}x${cols} tablo imleç konumuna eklendi.`, 'success');
        });
    }

    // ----------------------------------------------------
    // NELER YENİ / DUYURULAR VE GELİŞTİRİCİ KÜNYESİ
    // ----------------------------------------------------
    if (btnWhatsNew) {
        btnWhatsNew.addEventListener('click', () => {
            openModal(modalWhatsNew);
        });
    }

    if (btnOpenWhatsNewDoc) {
        btnOpenWhatsNewDoc.addEventListener('click', () => {
            closeModal(modalWhatsNew);
            loadWhatsNewDocument();
        });
    }

    const EMBEDDED_SURUM_DUYURUSU_MD = `# SÜRÜM YENİLİKLERİ VE GELİŞTİRME GEÇMİŞİ

GELİŞTİRİCİ	: Gökhan TAŞÇI
GÖREVİ	: Sakarya Yazı İşleri Müdürü (Sicil No: 139329)
SÜRÜM	: v2.5 – 11 Kasım 2026
DAĞITIM	: Tek sayfalık, sunucusuz web uygulaması (GitHub Pages)

## BU SÜRÜMDE YENİ OLANLAR
1. Gerçek sayfalama: Belge A4 sayfalarına bölünür; 2. sayfadan itibaren üst bilgi, her sayfada sayfa numarası ve doğrulama satırı gösterilir. Sol bölmedeki küçük sayfa önizlemeleri ve durum çubuğundaki “Sayfa x / y” ile istenen sayfaya doğrudan gidilir (Ctrl+G).
2. Sekme (tab) durakları: UYAP paragraflarındaki TabSet (sol/sağ/ortalı) ve asılı girinti değerleri belgeye özel ayar olmadan birebir uygulanır.
3. UDF kaydetme düzeltildi: documentproperties.xml artık UYAP’ın kendi Java özellik biçiminde yazılır; paragraflara resolver ve tam nitelik kümesi eklenir; içeriği değiştirilen belgeye eski e-imza dosyası eklenmez.
4. Bul ve Değiştir: Belgeyi kapatmayan yan panel; Türkçe i/İ–ı/I eşleşmesi ve Türkçe karakter duyarlı “tam sözcük” araması.
5. Sanal yazıcı: print_to_udf.py her yazdırılabilir dosyayı (PDF, Word, Excel, HTML, metin) UDF’ye çevirir; ofsetler yeniden hesaplanır.

## ÖNCEKİ ÇALIŞMALAR
• Karanlık/aydınlık tema, 20’den fazla UYAP yazı tipi, resmî UYAP kısayolları (657.com.tr).
• Word (.docx) olarak indirme, şablon sihirbazı (her zaman atlanabilir), kurum ve avukat anteti (tarayıcıda saklanır).
• uki-embed.js: herhangi bir siteden “Web Editörde Aç” bağlantısı (?load=URL).

## BİLİNEN SINIRLAR
• Üretilen UDF dosyalarının masaüstü UYAP Doküman Editöründe açılması, gerçek editörle elle sınanmalıdır; bu sürümde kod düzeyinde biçim eşitlemesi yapılmıştır.
• Belge içeriği değiştirildiğinde e-imza geçersiz olur; imzalı belge yalnızca görüntülenebilir.

Gökhan TAŞÇI
Sakarya Yazı İşleri Müdürü – 139329`;

    async function loadWhatsNewDocument() {
        try {
            let text = '';
            try {
                const response = await fetch('assets/data/surum-duyurusu.md');
                if (response.ok) text = await response.text();
            } catch (_) {}
            if (!text || !text.trim()) text = EMBEDDED_SURUM_DUYURUSU_MD;
            const html = window.UkiMarkdown && window.UkiMarkdown.mdToHtml ? window.UkiMarkdown.mdToHtml(text) : `<p>${escapeHtml(text)}</p>`;
            window.UkiApp.replaceDocument(html, 'Sürüm Duyurusu', {source: 'welcome', clean: true});
            showToast('Sürüm duyurusu Markdown kaynağından açıldı.', 'success');
        } catch (err) {
            console.warn('Duyuru yükleme uyarısı:', err);
        }
    }

    // ----------------------------------------------------
    // ŞABLONLAR VE DİNAMİK ŞABLON SİHİRBAZI
    // ----------------------------------------------------
    const templateSelect = document.getElementById('template-select');
    let currentWizardTemplate = null;

    if (templateSelect) {
        templateSelect.addEventListener('change', async () => {
            const val = templateSelect.value;
            if (!val) return;

            if (val === 'ornek_karar') {
                try {
                    setStatus('Örnek karar yükleniyor...');
                    let resp = await fetch(['localhost','127.0.0.1'].includes(location.hostname) ? 'examples/örnek karar.udf' : 'assets/data/ornek-belge.udf');
                    if (!resp.ok) resp = await fetch('assets/data/ornek-belge.udf');
                    if (!resp.ok) throw new Error('Örnek dosya okunamadı: ' + resp.statusText);
                    const blob = await resp.blob();
                    const file = new File([blob], 'örnek karar.udf', { type: 'application/octet-stream' });
                    await loadUdfFile(file);
                } catch (e) {
                    showToast('Örnek dosya yüklenemedi: ' + e.message, 'error');
                }
            } else if (val === 'neler_yeni_doc') {
                loadWhatsNewDocument();
            } else if (val === 'tahliye_dava') {
                openTemplateWizard('tahliye_dava');
            } else if (val === 'isci_alacak') {
                openTemplateWizard('isci_alacak');
            } else {
                loadTemplate(val);
            }
            templateSelect.value = '';
        });
    }

    function openTemplateWizard(templateType) {
        currentWizardTemplate = templateType;
        if (!wizardFormContainer) return;

        if (templateType === 'tahliye_dava') {
            if (wizardTitle) wizardTitle.textContent = 'Kiralananın Tahliyesi Dava Dilekçesi Sihirbazı';
            wizardFormContainer.innerHTML = `
                <div class="wizard-form-grid">
                    <div class="wizard-field-full">
                        <label class="wizard-label">Görevli ve Yetkili Mahkeme:</label>
                        <input type="text" id="wz-mahkeme" class="wizard-input" value="SAKARYA NÖBETÇİ SULH HUKUK MAHKEMESİ'NE">
                    </div>
                    <div>
                        <label class="wizard-label">Davacı (Kiraya Veren):</label>
                        <input type="text" id="wz-davaci" class="wizard-input" placeholder="Ad Soyad">
                    </div>
                    <div>
                        <label class="wizard-label">Davacı T.C. Kimlik No:</label>
                        <input type="text" id="wz-davaci-tc" class="wizard-input" maxlength="11" placeholder="11 haneli T.C. No">
                    </div>
                    <div class="wizard-field-full">
                        <label class="wizard-label">Davacı Adresi:</label>
                        <input type="text" id="wz-davaci-adres" class="wizard-input" placeholder="Mahalle, Cadde, No, İlçe / İl">
                    </div>
                    <div>
                        <label class="wizard-label">Davalı (Kiracı):</label>
                        <input type="text" id="wz-davali" class="wizard-input" placeholder="Ad Soyad">
                    </div>
                    <div>
                        <label class="wizard-label">Davalı T.C. Kimlik No (Varsa):</label>
                        <input type="text" id="wz-davali-tc" class="wizard-input" maxlength="11" placeholder="Biliniyorsa">
                    </div>
                    <div class="wizard-field-full">
                        <label class="wizard-label">Kiralanan Taşınmazın Adresi:</label>
                        <input type="text" id="wz-tasinmaz-adres" class="wizard-input" placeholder="Tahliyesi istenen kiralanan yerin adresi">
                    </div>
                    <div>
                        <label class="wizard-label">Kira Başlangıç Tarihi:</label>
                        <input type="date" id="wz-kira-tarihi" class="wizard-input">
                    </div>
                    <div>
                        <label class="wizard-label">Aylık Kira Bedeli (TL):</label>
                        <input type="text" id="wz-kira-bedel" class="wizard-input" placeholder="Örn: 15.000 TL">
                    </div>
                    <div>
                        <label class="wizard-label">Tahliye Sebebi:</label>
                        <select id="wz-tahliye-sebebi" class="wizard-select">
                            <option value="taahhut">Yazılı Tahliye Taahhüdü Nedeniyle (TBK m. 352/1)</option>
                            <option value="ihtar">İki Haklı İhtar Nedeniyle (TBK m. 352/2)</option>
                            <option value="ihtiyac">Gereksinim (İhtiyaç) Nedeniyle (TBK m. 350)</option>
                        </select>
                    </div>
                    <div>
                        <label class="wizard-label">Taahhüt / İhtar Tarihi:</label>
                        <input type="date" id="wz-ek-tarih" class="wizard-input">
                    </div>
                </div>
            `;
        } else if (templateType === 'isci_alacak') {
            if (wizardTitle) wizardTitle.textContent = 'İşçilik Alacağı Dava Dilekçesi Sihirbazı';
            wizardFormContainer.innerHTML = `
                <div class="wizard-form-grid">
                    <div class="wizard-field-full">
                        <label class="wizard-label">Mahkeme:</label>
                        <input type="text" id="wz-mahkeme" class="wizard-input" value="SAKARYA NÖBETÇİ İŞ MAHKEMESİ'NE">
                    </div>
                    <div>
                        <label class="wizard-label">Davacı (İşçi):</label>
                        <input type="text" id="wz-davaci" class="wizard-input" placeholder="Ad Soyad">
                    </div>
                    <div>
                        <label class="wizard-label">Davacı T.C. Kimlik No:</label>
                        <input type="text" id="wz-davaci-tc" class="wizard-input" maxlength="11" placeholder="11 haneli T.C. No">
                    </div>
                    <div class="wizard-field-full">
                        <label class="wizard-label">Davacı Adresi:</label>
                        <input type="text" id="wz-davaci-adres" class="wizard-input" placeholder="İkamet adresi">
                    </div>
                    <div>
                        <label class="wizard-label">Davalı (İşveren Şirket / Şahıs):</label>
                        <input type="text" id="wz-davali" class="wizard-input" placeholder="Şirket unvanı veya ad soyad">
                    </div>
                    <div>
                        <label class="wizard-label">Arabuluculuk Son Tutanağı Tarihi:</label>
                        <input type="date" id="wz-ek-tarih" class="wizard-input">
                    </div>
                </div>
            `;
        }

        openModal(modalTemplateWizard);
    }

    if (btnWizardApply) {
        btnWizardApply.addEventListener('click', () => {
            applyWizardForm();
            closeModal(modalTemplateWizard);
        });
    }

    if (btnWizardSkip) {
        btnWizardSkip.addEventListener('click', () => {
            applyWizardBlank();
            closeModal(modalTemplateWizard);
        });
    }

    function applyWizardForm() {
        const mahkeme = (document.getElementById('wz-mahkeme') && document.getElementById('wz-mahkeme').value) || "SAKARYA NÖBETÇİ SULH HUKUK MAHKEMESİ'NE";
        const davaci = (document.getElementById('wz-davaci') && document.getElementById('wz-davaci').value) || "Ad Soyad";
        const davaciTc = (document.getElementById('wz-davaci-tc') && document.getElementById('wz-davaci-tc').value) || "11111111110";
        const davaciAdres = (document.getElementById('wz-davaci-adres') && document.getElementById('wz-davaci-adres').value) || "Adapazarı / SAKARYA";
        const davali = (document.getElementById('wz-davali') && document.getElementById('wz-davali').value) || "Ad Soyad";
        const davaliTc = (document.getElementById('wz-davali-tc') && document.getElementById('wz-davali-tc').value) || "";
        const tasinmazAdres = (document.getElementById('wz-tasinmaz-adres') && document.getElementById('wz-tasinmaz-adres').value) || "Adapazarı / SAKARYA";
        const kiraTarih = (document.getElementById('wz-kira-tarihi') && document.getElementById('wz-kira-tarihi').value) || "01/01/2024";
        const kiraBedel = (document.getElementById('wz-kira-bedel') && document.getElementById('wz-kira-bedel').value) || "15.000 TL";
        const sebepSelect = document.getElementById('wz-tahliye-sebebi');
        const sebepText = sebepSelect ? sebepSelect.options[sebepSelect.selectedIndex].text : "Yazılı Tahliye Taahhüdü Nedeniyle";
        const ekTarih = (document.getElementById('wz-ek-tarih') && document.getElementById('wz-ek-tarih').value) || "";

        // Tarayıcıda saklanan avukat profili varsa otomatik eşleştir
        let lawyerVekilStr = 'Av. [Ad Soyad] - [Baro Sicil No]';
        try {
            const rawLp = localStorage.getItem('uki-lawyer-profile');
            if (rawLp) {
                const lp = JSON.parse(rawLp);
                if (lp.lawyerName) {
                    lawyerVekilStr = `Av. ${lp.lawyerName}${lp.baroSicil ? ' (' + lp.baroSicil + ')' : ''}`;
                }
            }
        } catch (e) {}

        let html = '';
        if (currentWizardTemplate === 'tahliye_dava') {
            html = `
                <p style="text-align: center; margin-bottom: 12pt;"><span style="font-weight: bold; font-size: 13pt;">${mahkeme}</span></p>

                <div class="udf-meta-row">
                    <div class="udf-meta-key">DAVACI</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val"><b>${davaci}</b> (T.C. Kimlik No: ${davaciTc})<br>Adres: ${davaciAdres}</div>
                </div>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">VEKİLİ</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val">${lawyerVekilStr}</div>
                </div>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">DAVALI</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val"><b>${davali}</b> ${davaliTc ? '(T.C. No: ' + davaliTc + ')' : ''}<br>Adres: ${tasinmazAdres}</div>
                </div>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">KONU</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val">${sebepText} kiralanan taşınmazın tahliyesi ve tarafımıza teslimi talebidir.</div>
                </div>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">DAVA DEĞERİ</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val">Yıllık Kira Bedeli (${kiraBedel} x 12)</div>
                </div>

                <p style="text-align: center; font-weight: bold; margin: 12pt 0 6pt 0;">AÇIKLAMALAR</p>

                <p style="text-align: justify; text-indent: 28pt; margin-bottom: 4pt;">
                    1. Davalı kiracı, müvekkile ait yukarıda adresi belirtilen "${tasinmazAdres}" adresindeki gayrimenkulde ${kiraTarih} başlangıç tarihli kira sözleşmesi uyarınca kiracı olarak oturmaktadır. Taşınmazın aylık kira bedeli ${kiraBedel}'dir.
                </p>
                <p style="text-align: justify; text-indent: 28pt; margin-bottom: 4pt;">
                    2. Davalı, ${ekTarih ? ekTarih + ' tarihinde tanzim edilen taahhütname ile ' : ''}taşınmazı kayıtsız şartsız tahliye edeceğini taahhüt etmiş olmasına rağmen süresi içerisinde taşınmazı tahliye etmemiştir.
                </p>
                <p style="text-align: justify; text-indent: 28pt; margin-bottom: 4pt;">
                    3. Bu nedenle mezkur taşınmazın tahliyesini talep amacıyla Sayın Mahkemenize başvurma zarureti hasıl olmuştur.
                </p>

                <p style="text-align: center; font-weight: bold; margin: 12pt 0 6pt 0;">HUKUKİ SEBEPLER VE DELİLLER</p>
                <p style="text-indent: 28pt; text-align: justify; margin-bottom: 4pt;">
                    <b>HUKUKİ SEBEPLER:</b> 6098 Sayılı Türk Borçlar Kanunu, HMK ve ilgili sair mevzuat.
                </p>
                <p style="text-indent: 28pt; text-align: justify; margin-bottom: 4pt;">
                    <b>DELİLLER:</b> Kira sözleşmesi, ${ekTarih ? ekTarih + ' tarihli tahliye taahhütnamesi,' : ''} noter ihtarnameleri, tanık, bilirkişi ve her türlü yasal delil.
                </p>

                <p style="text-align: center; font-weight: bold; margin: 12pt 0 6pt 0;">SONUÇ VE İSTEM</p>
                <p style="text-align: justify; text-indent: 28pt; margin-bottom: 12pt;">
                    Yukarıda arz ve izah edilen nedenlerle; davanın kabulü ile davalının "${tasinmazAdres}" adresindeki taşınmazdan TAHLİYESİNE ve tarafımıza teslimine, yargılama giderleri ile vekâlet ücretinin davalı üzerinde bırakılmasına karar verilmesini saygılarımızla arz ve talep ederiz.
                </p>

                <p style="text-align: right; margin-right: 20pt; line-height: 1.3;">
                    <b>Davacı / Vekili</b><br>
                    ${davaci}<br>
                    İmza
                </p>
            `;
            if (docTitleInput) docTitleInput.value = 'Kiralananin_Tahliyesi_Dava_Dilekcesi';
        } else {
            html = `
                <p style="text-align: center; margin-bottom: 12pt;"><span style="font-weight: bold; font-size: 13pt;">${mahkeme}</span></p>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">DAVACI</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val"><b>${davaci}</b> (T.C. No: ${davaciTc})<br>Adres: ${davaciAdres}</div>
                </div>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">DAVALI</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val"><b>${davali}</b></div>
                </div>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">KONU</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val">Kıdem tazminatı, ihbar tazminatı, fazla mesai ve işçilik alacakları talebidir.</div>
                </div>
                <p style="text-align: center; font-weight: bold; margin: 12pt 0 6pt 0;">AÇIKLAMALAR</p>
                <p style="text-align: justify; text-indent: 28pt;">Davacı müvekkil davalı iş yerinde çalışmış, hak kazandığı işçilik alacakları ödenmemiştir...</p>
                <p style="text-align: right; margin-top: 14pt;"><b>Davacı / Vekili</b><br>İmza</p>
            `;
            if (docTitleInput) docTitleInput.value = 'Iscilik_Alacagi_Dava_Dilekcesi';
        }

        editor.setContentHtml(html);
        setTimeout(() => {
            if (typeof recalculatePagesAndThumbnails === 'function') recalculatePagesAndThumbnails();
        }, 80);
        showToast('Sihirbaz verileri şablona uygulandı.', 'success');
    }

    function applyWizardBlank() {
        let blankHtml = '';
        if (currentWizardTemplate === 'tahliye_dava') {
            blankHtml = `
                <p style="text-align: center; margin-bottom: 12pt;"><span style="font-weight: bold; font-size: 13pt;">.................... NÖBETÇİ SULH HUKUK MAHKEMESİ'NE</span></p>

                <div class="udf-meta-row">
                    <div class="udf-meta-key">DAVACI</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val">.................................................. (T.C. No: ....................)<br>Adres: ..................................................</div>
                </div>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">VEKİLİ</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val">Av. ..................................................</div>
                </div>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">DAVALI</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val">..................................................<br>Adres: ..................................................</div>
                </div>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">KONU</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val">Kiralanan taşınmazın tahliyesi ve teslimi talebidir.</div>
                </div>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">DAVA DEĞERİ</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val">.................... TL</div>
                </div>

                <p style="text-align: center; font-weight: bold; margin: 12pt 0 6pt 0;">AÇIKLAMALAR</p>
                <p style="text-align: justify; text-indent: 28pt; margin-bottom: 4pt;">1. Davalı kiracı ile müvekkil arasında .../.../...... tarihli kira sözleşmesi akdedilmiştir.</p>
                <p style="text-align: justify; text-indent: 28pt; margin-bottom: 4pt;">2. ...........................................................................................................................................</p>

                <p style="text-align: center; font-weight: bold; margin: 12pt 0 6pt 0;">SONUÇ VE İSTEM</p>
                <p style="text-align: justify; text-indent: 28pt; margin-bottom: 12pt;">Davalının mezkur taşınmazdan tahliyesine karar verilmesini saygıyla arz ve talep ederiz.</p>
                <p style="text-align: right; margin-right: 20pt;"><b>Davacı / Vekili</b><br>İmza</p>
            `;
            if (docTitleInput) docTitleInput.value = 'Kiralananin_Tahliyesi_Dilekcesi_Bos';
        } else {
            blankHtml = `
                <p style="text-align: center; margin-bottom: 12pt;"><span style="font-weight: bold; font-size: 13pt;">.................... MAHKEMESİ HÂKİMLİĞİ'NE</span></p>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">DAVACI</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val">..................................................</div>
                </div>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">DAVALI</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val">..................................................</div>
                </div>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">KONU</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val">Genel dava ve talep dilekçesidir.</div>
                </div>
                <p style="text-align: center; font-weight: bold; margin: 12pt 0 6pt 0;">AÇIKLAMALAR</p>
                <p style="text-align: justify; text-indent: 28pt;">...........................................................................................................................................</p>
                <p style="text-align: right; margin-top: 14pt;"><b>Davacı / Vekili</b><br>İmza</p>
            `;
            if (docTitleInput) docTitleInput.value = 'Bos_Dilekce_Sablonu';
        }

        editor.setContentHtml(blankHtml);
        setTimeout(() => {
            if (typeof recalculatePagesAndThumbnails === 'function') recalculatePagesAndThumbnails();
        }, 80);
        showToast('Boş şablon yüklendi.', 'info');
    }

    async function loadTemplate(type) {
        if (!(await UkiDialog.confirm('Seçilen şablon yüklenecek; geçerli belgenin içeriği değişir. Devam edilsin mi?', { title: 'Şablon yükle', okText: 'Şablonu yükle' }))) return;
        let content = '';
        if (type === 'bilirkisi') {
            content = `
                <p style="text-align: center;"><span style="font-weight: bold; font-size: 13pt;">SAKARYA NÖBETÇİ ASLİYE HUKUK MAHKEMESİ HÂKİMLİĞİ'NE</span></p>
                <p style="text-align: center;"><br></p>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">DOSYA NO</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val">2026/100 Esas</div>
                </div>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">BİLİRKİŞİ</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val"><b>Ad Soyad</b> (Uzman Mühendis / Hesap Bilirkişisi)</div>
                </div>
                <div class="udf-meta-row">
                    <div class="udf-meta-key">KONU</div>
                    <div class="udf-meta-colon">:</div>
                    <div class="udf-meta-val">Mahkemenizce tevdi edilen dosya kapsamında tanzim edilen Bilirkişi Raporudur.</div>
                </div>
                <p style="text-align: center; font-weight: bold; margin: 12pt 0 6pt 0;">İNCELEME VE TESPİTLER</p>
                <p style="text-align: justify; text-indent: 28pt;">Dosya kapsamındaki belgeler incelenmiş olup teknik değerlendirmeler aşağıdadır...</p>
                <p style="text-align: right; margin-top: 14pt;"><b>Bilirkişi</b><br>Ad Soyad<br>İmza</p>
            `;
            if (docTitleInput) docTitleInput.value = 'Ornek_Bilirkisi_Raporu';
        }

        editor.setContentHtml(content);
        setTimeout(() => {
            if (typeof recalculatePagesAndThumbnails === 'function') recalculatePagesAndThumbnails();
        }, 80);
        showToast('Şablon yüklendi.', 'success');
    }

    function setStatus(text) {
        if (statStatus) statStatus.textContent = text;
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `uki-toast uki-toast-${type}`;

        let iconSvg = '';
        if (type === 'success') {
            iconSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
        } else if (type === 'warning') {
            iconSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        } else if (type === 'error') {
            iconSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
        } else {
            iconSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
        }

        const iconSpan = document.createElement('span');
        iconSpan.className = 'uki-toast-icon';
        iconSpan.innerHTML = iconSvg;

        const textSpan = document.createElement('span');
        textSpan.className = 'uki-toast-text';
        textSpan.textContent = message;

        toast.appendChild(iconSpan);
        toast.appendChild(textSpan);
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3600);
    }
    window.showToast = showToast;

    // Tarayıcının ilkel alert() kutusunu Astryx tasarımına yönlendir
    const _origAlert = window.alert;
    window.alert = function (msg) {
        if (window.UkiDialog && typeof window.UkiDialog.alert === 'function') {
            window.UkiDialog.alert(String(msg), { title: 'Bilgilendirme' });
        } else {
            showToast(String(msg), 'info');
        }
    };

    // ----------------------------------------------------
    // ARKA PLAN RESMİ VE RESMÎ ANTET YÖNETİMİ (MODAL 8)
    // ----------------------------------------------------
    const modalAntetSetup = document.getElementById('modal-antet-setup');
    const modalLawyerAntetBuilder = document.getElementById('modal-lawyer-antet-builder');
    const btnAntetSetup = document.getElementById('btn-antet-setup');
    const btnLawyerAntet = document.getElementById('btn-lawyer-antet');
    const btnOpenLawyerBuilderFromAntet = document.getElementById('btn-open-lawyer-builder-from-antet');
    const antetLayer = document.getElementById('antet-layer');

    const antetPreviewImg = document.getElementById('antet-preview-img');
    const antetPreviewCaption = document.getElementById('antet-preview-caption');
    const antetCustomFile = document.getElementById('antet-custom-file');
    const btnAntetBrowse = document.getElementById('btn-antet-browse');
    const btnAntetApply = document.getElementById('btn-antet-apply');
    const btnAntetRemove = document.getElementById('btn-antet-remove');
    const chkAntetSaveDefault = document.getElementById('chk-antet-save-default');

    const ANTET_TEMPLATES = {
        yargitay: {
            name: 'T.C. Yargıtay Başkanlığı Resmî Anteti',
            src: 'assets/images/antet/yargitay_1.png',
            margins: { left: 1.0, right: 1.0, top: 1.0, bottom: 1.0 }
        },
        adalet: {
            name: 'T.C. Adalet Bakanlığı Resmî Anteti',
            src: 'assets/images/antet/adalet_1.jpg',
            margins: { left: 1.0, right: 1.0, top: 1.0, bottom: 1.0 }
        },
        teftis: {
            name: 'HSK Teftiş Kurulu Başkanlığı Anteti',
            src: 'assets/images/antet/teftis_1.jpg',
            margins: { left: 1.0, right: 1.0, top: 1.0, bottom: 1.0 }
        },
        dis: {
            name: 'Dış İlişkiler ve AB Genel Müdürlüğü Anteti',
            src: 'assets/images/antet/dis_1.jpg',
            margins: { left: 1.0, right: 1.0, top: 1.0, bottom: 1.0 }
        },
        adalet_solust: {
            name: 'Adalet Bakanlığı Sol Üst Logolu Antet',
            src: 'assets/images/antet/adalet_solust_1.jpg',
            margins: { left: 1.0, right: 1.0, top: 1.0, bottom: 1.0 }
        },
        adlitip: {
            name: 'Adli Tıp Kurumu Başkanlığı Anteti',
            src: 'assets/images/antet/adlitip_1.jpg',
            margins: { left: 1.0, right: 1.0, top: 1.0, bottom: 1.0 }
        },
        yuzuncuyil: {
            name: 'Cumhuriyetin 100. Yılı Özel Anteti',
            src: 'assets/images/antet/adalet_yuzuncuyil_1.jpg',
            margins: { left: 1.0, right: 1.0, top: 1.0, bottom: 1.0 }
        }
    };

    let activeSelectedAntetKey = 'yargitay';
    let customAntetDataUrl = null;

    if (btnAntetSetup) {
        btnAntetSetup.addEventListener('click', () => {
            openModal(modalAntetSetup);
        });
    }

    // Modül butonları dinleyicisi
    document.querySelectorAll('.antet-module-btn[data-antet]').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-antet');
            selectAntetTemplate(key);
        });
    });

    function selectAntetTemplate(key) {
        document.querySelectorAll('.antet-module-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`.antet-module-btn[data-antet="${key}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        activeSelectedAntetKey = key;
        const tmpl = ANTET_TEMPLATES[key];
        if (tmpl) {
            if (antetPreviewImg) antetPreviewImg.src = tmpl.src;
            if (antetPreviewCaption) antetPreviewCaption.textContent = tmpl.name;
        }
    }

    if (btnAntetBrowse && antetCustomFile) {
        btnAntetBrowse.addEventListener('click', () => antetCustomFile.click());
        antetCustomFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                customAntetDataUrl = evt.target.result;
                activeSelectedAntetKey = 'custom';
                document.querySelectorAll('.antet-module-btn').forEach(b => b.classList.remove('active'));
                btnAntetBrowse.classList.add('active');
                if (antetPreviewImg) antetPreviewImg.src = customAntetDataUrl;
                if (antetPreviewCaption) antetPreviewCaption.textContent = `Özel Yüklenen Antet (${file.name})`;
                showToast('Özel antet resmi yüklendi.', 'success');
            };
            reader.readAsDataURL(file);
        });
    }

    if (btnAntetApply) {
        btnAntetApply.addEventListener('click', () => {
            let antetSrc = '';
            let antetName = '';

            if (activeSelectedAntetKey === 'custom' && customAntetDataUrl) {
                antetSrc = customAntetDataUrl;
                antetName = 'Özel Antet';
            } else if (ANTET_TEMPLATES[activeSelectedAntetKey]) {
                antetSrc = ANTET_TEMPLATES[activeSelectedAntetKey].src;
                antetName = ANTET_TEMPLATES[activeSelectedAntetKey].name;
            }

            if (!antetSrc) {
                showToast('Lütfen bir antet seçin.', 'warning');
                return;
            }

            applyAntetToEditor({
                type: 'image',
                src: antetSrc,
                name: antetName
            });

            if (chkAntetSaveDefault && chkAntetSaveDefault.checked) {
                try {
                    localStorage.setItem('uki-active-antet', JSON.stringify({
                        type: 'image',
                        key: activeSelectedAntetKey,
                        src: antetSrc,
                        name: antetName
                    }));
                } catch (e) {
                    console.warn('LocalStorage kotası aşıldı, sadece oturum için uygulandı.');
                }
            }

            closeModal(modalAntetSetup);
            showToast(`"${antetName}" belgeye uygulandı.`, 'success');
        });
    }

    if (btnAntetRemove) {
        btnAntetRemove.addEventListener('click', () => {
            removeAntetFromEditor();
            localStorage.removeItem('uki-active-antet');
            closeModal(modalAntetSetup);
            showToast('Antet kaldırıldı.', 'info');
        });
    }

    function applyAntetToEditor(antetConfig) {
        if (!antetLayer) return;

        if (antetConfig.type === 'image') {
            antetLayer.innerHTML = `
                <img src="${antetConfig.src}" style="width: 100%; height: 100%; object-fit: fill; display: block; opacity: 0.98;" alt="Antet">
            `;
            antetLayer.style.display = 'block';
        } else if (antetConfig.type === 'lawyer_html') {
            antetLayer.innerHTML = antetConfig.html;
            antetLayer.style.display = 'block';
        }
        // Antet her sayfada yinelenir: sayfalama motoru kopyaları çizer
        if (typeof recalculatePagesAndThumbnails === 'function') recalculatePagesAndThumbnails();
    }

    function removeAntetFromEditor() {
        if (!antetLayer) return;
        antetLayer.innerHTML = '';
        antetLayer.style.display = 'none';
        if (typeof recalculatePagesAndThumbnails === 'function') recalculatePagesAndThumbnails();
    }

    // ----------------------------------------------------
    // AVUKAT ANTET HAZIRLAYICI (MODAL 9)
    // ----------------------------------------------------
    if (btnLawyerAntet) {
        btnLawyerAntet.addEventListener('click', openLawyerAntetBuilder);
    }
    if (btnOpenLawyerBuilderFromAntet) {
        btnOpenLawyerBuilderFromAntet.addEventListener('click', () => {
            closeModal(modalAntetSetup);
            openLawyerAntetBuilder();
        });
    }

    const lawyerNameInput = document.getElementById('lawyer-name');
    const lawyerSubNameInput = document.getElementById('lawyer-sub-name');
    const lawyerBaroInput = document.getElementById('lawyer-baro');
    const lawyerThemeSelect = document.getElementById('lawyer-theme-select');
    const lawyerLogoSelect = document.getElementById('lawyer-logo-select');
    const lawyerCustomLogoFile = document.getElementById('lawyer-custom-logo-file');
    const lawyerAddressInput = document.getElementById('lawyer-address');
    const lawyerPhoneInput = document.getElementById('lawyer-phone');
    const lawyerEmailWebInput = document.getElementById('lawyer-email-web');
    const lawyerUetsInput = document.getElementById('lawyer-uets');
    const chkLawyerSaveDefault = document.getElementById('chk-lawyer-save-default');
    const lawyerLivePreview = document.getElementById('lawyer-live-preview');
    const btnLawyerAntetApply = document.getElementById('btn-lawyer-antet-apply');
    const btnLawyerAntetDownload = document.getElementById('btn-lawyer-antet-download');

    let customLawyerLogoDataUrl = null;

    function openLawyerAntetBuilder() {
        loadSavedLawyerProfile();
        updateLawyerLivePreview();
        openModal(modalLawyerAntetBuilder);
    }

    function loadSavedLawyerProfile() {
        try {
            const raw = localStorage.getItem('uki-lawyer-profile');
            if (raw) {
                const data = JSON.parse(raw);
                if (lawyerNameInput && data.name) lawyerNameInput.value = data.name;
                if (lawyerSubNameInput && data.subName) lawyerSubNameInput.value = data.subName;
                if (lawyerBaroInput && data.baro) lawyerBaroInput.value = data.baro;
                if (lawyerThemeSelect && data.theme) lawyerThemeSelect.value = data.theme;
                if (lawyerLogoSelect && data.logo) lawyerLogoSelect.value = data.logo;
                if (lawyerAddressInput && data.address) lawyerAddressInput.value = data.address;
                if (lawyerPhoneInput && data.phone) lawyerPhoneInput.value = data.phone;
                if (lawyerEmailWebInput && data.emailWeb) lawyerEmailWebInput.value = data.emailWeb;
                if (lawyerUetsInput && data.uets) lawyerUetsInput.value = data.uets;
                if (data.customLogo) customLawyerLogoDataUrl = data.customLogo;
            }
        } catch (e) {}
    }

    // Form öğeleri değiştikçe canlı önizlemeyi yenile
    [lawyerNameInput, lawyerSubNameInput, lawyerBaroInput, lawyerThemeSelect, lawyerLogoSelect, lawyerAddressInput, lawyerPhoneInput, lawyerEmailWebInput, lawyerUetsInput].forEach(el => {
        if (el) {
            el.addEventListener('input', updateLawyerLivePreview);
            el.addEventListener('change', updateLawyerLivePreview);
        }
    });

    if (lawyerLogoSelect && lawyerCustomLogoFile) {
        lawyerLogoSelect.addEventListener('change', () => {
            if (lawyerLogoSelect.value === 'custom') {
                lawyerCustomLogoFile.click();
            }
        });
        lawyerCustomLogoFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                customLawyerLogoDataUrl = evt.target.result;
                updateLawyerLivePreview();
                showToast('Özel büro logosu yüklendi.', 'success');
            };
            reader.readAsDataURL(file);
        });
    }

    function getScalesSvg(color = '#b45309') {
        return `
            <svg width="42" height="42" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Direk ve Taban -->
                <line x1="24" y1="6" x2="24" y2="42" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M14 42H34" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
                <circle cx="24" cy="6" r="3" fill="${color}"/>
                <!-- Terazi Kolları -->
                <line x1="8" y1="14" x2="40" y2="14" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
                <!-- Sol Kefe -->
                <line x1="12" y1="14" x2="8" y2="26" stroke="${color}" stroke-width="1.2"/>
                <line x1="12" y1="14" x2="16" y2="26" stroke="${color}" stroke-width="1.2"/>
                <path d="M6 26C6 29 18 29 18 26H6Z" fill="${color}" opacity="0.85"/>
                <!-- Sağ Kefe -->
                <line x1="36" y1="14" x2="32" y2="26" stroke="${color}" stroke-width="1.2"/>
                <line x1="36" y1="14" x2="40" y2="26" stroke="${color}" stroke-width="1.2"/>
                <path d="M30 26C30 29 42 29 42 26H30Z" fill="${color}" opacity="0.85"/>
            </svg>
        `;
    }

    function buildLawyerAntetHtml(isLivePreview = false) {
        const name = (lawyerNameInput && lawyerNameInput.value) || 'DEMİR HUKUK & DANIŞMANLIK BÜROSU';
        const subName = (lawyerSubNameInput && lawyerSubNameInput.value) || 'Av. Selim DEMİR';
        const baro = (lawyerBaroInput && lawyerBaroInput.value) || 'Sakarya Barosu - Sicil: 1234';
        const theme = (lawyerThemeSelect && lawyerThemeSelect.value) || 'classic_gold';
        const logoChoice = (lawyerLogoSelect && lawyerLogoSelect.value) || 'scales_gold';
        const address = (lawyerAddressInput && lawyerAddressInput.value) || 'İstiklal Mah. Çark Cad. No: 42 Kat: 3 Adapazarı / SAKARYA';
        const phone = (lawyerPhoneInput && lawyerPhoneInput.value) || 'Tel: 0264 270 00 00';
        const emailWeb = (lawyerEmailWebInput && lawyerEmailWebInput.value) || 'av.selim@demirhukuk.av.tr';
        const uets = (lawyerUetsInput && lawyerUetsInput.value) || 'UETS: 15849-29104-58291';

        const logoColor = (theme === 'modern_navy') ? '#1e3a8a' : '#b45309';
        let logoHtml = '';

        if (logoChoice === 'custom' && customLawyerLogoDataUrl) {
            logoHtml = `<img src="${customLawyerLogoDataUrl}" style="max-height: 44px; max-width: 90px; object-fit: contain;">`;
        } else if (logoChoice === 'courthouse') {
            logoHtml = `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${logoColor}" stroke-width="1.8">
                    <path d="M2 20h20M4 20V10M8 20V10M12 20V10M16 20V10M20 20V10M12 3L2 9h20L12 3z"/>
                </svg>
            `;
        } else {
            logoHtml = getScalesSvg(logoColor);
        }

        if (theme === 'modern_navy') {
            return `
                <div class="lawyer-antet-container theme-modern-navy" style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: ${isLivePreview ? '8px 10px' : '24pt 28pt'}; box-sizing: border-box;">
                    <!-- Üst Başlık -->
                    <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: ${isLivePreview ? '4px' : '8pt'};">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${logoHtml}
                                <div>
                                    <div style="font-size: ${isLivePreview ? '11px' : '15pt'}; font-weight: 800; color: #1e3a8a; font-family: 'Times New Roman', serif; letter-spacing: 0.5px;">${escapeHtml(name)}</div>
                                    <div style="font-size: ${isLivePreview ? '8px' : '10pt'}; font-weight: 600; color: #475569; font-family: sans-serif;">${escapeHtml(subName)} • ${escapeHtml(baro)}</div>
                                </div>
                            </div>
                            <div style="text-align: right; font-size: ${isLivePreview ? '7px' : '8.5pt'}; color: #64748b; font-family: sans-serif;">
                                <div><b>TÜRKİYE BAROLAR BİRLİĞİ</b></div>
                                <div>HUKUK & DANIŞMANLIK</div>
                            </div>
                        </div>
                    </div>

                    <!-- Alt Bilgi -->
                    <div style="border-top: 1.5px solid #1e3a8a; padding-top: ${isLivePreview ? '4px' : '6pt'}; font-family: sans-serif; font-size: ${isLivePreview ? '6.5px' : '8pt'}; color: #334155; line-height: 1.4;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>📍 ${escapeHtml(address)}</span>
                            <span>📞 ${escapeHtml(phone)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 2px; color: #64748b;">
                            <span>✉️ ${escapeHtml(emailWeb)}</span>
                            <span>⚖️ ${escapeHtml(uets)}</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (theme === 'prestige_frame') {
            return `
                <div class="lawyer-antet-container theme-prestige-frame" style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: ${isLivePreview ? '6px' : '18pt'}; box-sizing: border-box;">
                    <!-- Çift Çizgili Prestij Çerçeve (Yargıtay Tipi) -->
                    <div style="position: absolute; top: ${isLivePreview ? '5px' : '14pt'}; left: ${isLivePreview ? '5px' : '14pt'}; right: ${isLivePreview ? '5px' : '14pt'}; bottom: ${isLivePreview ? '5px' : '14pt'}; border: 1.5px solid #b45309; pointer-events: none; border-radius: 2px;">
                        <div style="position: absolute; top: 2px; left: 2px; right: 2px; bottom: 2px; border: 0.75px solid #d97706; border-radius: 1px;"></div>
                    </div>

                    <!-- Üst Bölüm -->
                    <div style="text-align: center; margin-top: ${isLivePreview ? '4px' : '10pt'}; z-index: 1;">
                        <div style="display: inline-block;">${logoHtml}</div>
                        <div style="font-size: ${isLivePreview ? '10px' : '14pt'}; font-weight: 800; color: #78350f; font-family: 'Times New Roman', serif; letter-spacing: 1px; margin-top: 2px;">${escapeHtml(name)}</div>
                        <div style="font-size: ${isLivePreview ? '7.5px' : '9.5pt'}; font-weight: 600; color: #92400e; font-family: 'Times New Roman', serif;">${escapeHtml(subName)} • ${escapeHtml(baro)}</div>
                    </div>

                    <!-- Alt Bölüm -->
                    <div style="text-align: center; margin-bottom: ${isLivePreview ? '4px' : '8pt'}; z-index: 1; font-family: 'Times New Roman', serif; font-size: ${isLivePreview ? '6.5px' : '8pt'}; color: #78350f; line-height: 1.35;">
                        <div style="width: 70%; margin: 0 auto 4px auto; border-top: 0.75px solid #d97706;"></div>
                        <div><b>Adres:</b> ${escapeHtml(address)} | <b>İletişim:</b> ${escapeHtml(phone)}</div>
                        <div>${escapeHtml(emailWeb)} | ${escapeHtml(uets)}</div>
                    </div>
                </div>
            `;
        } else {
            // Varsayılan: Klasik Varak (Classic Gold Elegance)
            return `
                <div class="lawyer-antet-container theme-classic-gold" style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: ${isLivePreview ? '8px 10px' : '22pt 26pt'}; box-sizing: border-box;">
                    <!-- Üst Başlık -->
                    <div style="text-align: center;">
                        <div style="display: inline-block;">${logoHtml}</div>
                        <div style="font-size: ${isLivePreview ? '11px' : '15pt'}; font-weight: 800; color: #78350f; font-family: 'Times New Roman', serif; letter-spacing: 0.8px; margin-top: 2px;">${escapeHtml(name)}</div>
                        <div style="font-size: ${isLivePreview ? '8px' : '10pt'}; font-weight: 600; color: #92400e; font-family: 'Times New Roman', serif;">${escapeHtml(subName)} • ${escapeHtml(baro)}</div>
                        <div style="margin-top: ${isLivePreview ? '4px' : '6pt'}; border-bottom: 2px solid #b45309; height: 2px;"></div>
                        <div style="margin-top: 1.5px; border-bottom: 0.75px solid #d97706; height: 1px;"></div>
                    </div>

                    <!-- Alt Bilgi -->
                    <div style="border-top: 1px solid #b45309; padding-top: ${isLivePreview ? '4px' : '6pt'}; font-family: 'Times New Roman', serif; font-size: ${isLivePreview ? '6.8px' : '8.2pt'}; color: #451a03; line-height: 1.35;">
                        <div style="display: flex; justify-content: space-between;">
                            <div><b>Adres:</b> ${escapeHtml(address)}</div>
                            <div><b>İletişim:</b> ${escapeHtml(phone)}</div>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 2px; color: #78350f;">
                            <div><b>E-Posta:</b> ${escapeHtml(emailWeb)}</div>
                            <div><b>UETS:</b> ${escapeHtml(uets)}</div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    function updateLawyerLivePreview() {
        if (!lawyerLivePreview) return;
        lawyerLivePreview.innerHTML = buildLawyerAntetHtml(true);
    }

    if (btnLawyerAntetApply) {
        btnLawyerAntetApply.addEventListener('click', () => {
            const html = buildLawyerAntetHtml(false);
            applyAntetToEditor({
                type: 'lawyer_html',
                html: html
            });

            // Avukat Profilini ve Antetini LocalStorage'a kaydet
            const profileData = {
                name: lawyerNameInput ? lawyerNameInput.value : '',
                subName: lawyerSubNameInput ? lawyerSubNameInput.value : '',
                baro: lawyerBaroInput ? lawyerBaroInput.value : '',
                theme: lawyerThemeSelect ? lawyerThemeSelect.value : 'classic_gold',
                logo: lawyerLogoSelect ? lawyerLogoSelect.value : 'scales_gold',
                address: lawyerAddressInput ? lawyerAddressInput.value : '',
                phone: lawyerPhoneInput ? lawyerPhoneInput.value : '',
                emailWeb: lawyerEmailWebInput ? lawyerEmailWebInput.value : '',
                uets: lawyerUetsInput ? lawyerUetsInput.value : '',
                customLogo: customLawyerLogoDataUrl
            };

            try {
                localStorage.setItem('uki-lawyer-profile', JSON.stringify(profileData));
                if (chkLawyerSaveDefault && chkLawyerSaveDefault.checked) {
                    localStorage.setItem('uki-active-antet', JSON.stringify({
                        type: 'lawyer_html',
                        html: html,
                        data: profileData
                    }));
                }
            } catch (e) {
                console.warn('LocalStorage kotası aşıldı.');
            }

            closeModal(modalLawyerAntetBuilder);
            showToast('Avukat anteti başarıyla uygulandı ve tarayıcınıza kaydedildi.', 'success');
        });
    }

    if (btnLawyerAntetDownload) {
        btnLawyerAntetDownload.addEventListener('click', () => {
            showToast('Antet görseli hazırlanıyor...', 'info');
            // SVG verisi oluşturup indir
            const svgContent = `
                <svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123">
                    <rect width="794" height="1123" fill="#ffffff"/>
                    <foreignObject width="100%" height="100%">
                        <div xmlns="http://www.w3.org/1999/xhtml" style="width: 794px; height: 1123px;">
                            ${buildLawyerAntetHtml(false)}
                        </div>
                    </foreignObject>
                </svg>
            `;
            const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(lawyerNameInput && lawyerNameInput.value ? lawyerNameInput.value.replace(/\s+/g, '_') : 'Avukat')}_Antet.svg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Antet vektörel şablonu (SVG) indirildi.', 'success');
        });
    }

    function initSavedAntet() {
        try {
            const raw = localStorage.getItem('uki-active-antet');
            if (raw) {
                const config = JSON.parse(raw);
                if (config.type === 'image' && config.src) {
                    applyAntetToEditor(config);
                    activeSelectedAntetKey = config.key || 'yargitay';
                    selectAntetTemplate(activeSelectedAntetKey);
                } else if (config.type === 'lawyer_html' && config.html) {
                    applyAntetToEditor(config);
                }
            }
        } catch (e) {}
    }

    initSavedAntet();

    // ----------------------------------------------------
    // YAZI TİPİ İLETİŞİM KUTUSU (UYAP SCREENSHOT 9 İLE BİREBİR)
    // ----------------------------------------------------
    const btnFontDialog = document.getElementById('btn-font-dialog');
    const fontDialogNameInput = document.getElementById('font-dialog-name-input');
    const fontDialogFamilyList = document.getElementById('font-dialog-family-list');
    const fontDialogSizeInput = document.getElementById('font-dialog-size-input');
    const fontDialogSizeList = document.getElementById('font-dialog-size-list');
    const fontFxBold = document.getElementById('font-fx-bold');
    const fontFxItalic = document.getElementById('font-fx-italic');
    const fontFxUnderline = document.getElementById('font-fx-underline');
    const fontFxShadow = document.getElementById('font-fx-shadow');
    const fontFxSub = document.getElementById('font-fx-sub');
    const fontFxSup = document.getElementById('font-fx-sup');
    const fontFxStrike = document.getElementById('font-fx-strike');
    const fontDialogColor = document.getElementById('font-dialog-color');
    const fontDialogPreview = document.getElementById('font-dialog-preview');
    const btnFontDialogSave = document.getElementById('btn-font-dialog-save');

    function updateFontDialogPreview() {
        if (!fontDialogPreview) return;
        const fontName = fontDialogNameInput ? fontDialogNameInput.value : 'Times New Roman';
        const fontSize = parseInt(fontDialogSizeInput ? fontDialogSizeInput.value : 12, 10) || 12;
        const isBold = fontFxBold && fontFxBold.checked;
        const isItalic = fontFxItalic && fontFxItalic.checked;
        const isUnderline = fontFxUnderline && fontFxUnderline.checked;
        const isStrike = fontFxStrike && fontFxStrike.checked;
        const isShadow = fontFxShadow && fontFxShadow.checked;
        const color = fontDialogColor ? fontDialogColor.value : '#000000';

        fontDialogPreview.style.fontFamily = `"${fontName}", serif`;
        fontDialogPreview.style.fontSize = `${Math.min(32, Math.max(10, fontSize))}px`;
        fontDialogPreview.style.fontWeight = isBold ? '700' : '400';
        fontDialogPreview.style.fontStyle = isItalic ? 'italic' : 'normal';

        let deco = [];
        if (isUnderline) deco.push('underline');
        if (isStrike) deco.push('line-through');
        fontDialogPreview.style.textDecoration = deco.length > 0 ? deco.join(' ') : 'none';
        fontDialogPreview.style.textShadow = isShadow ? '1px 1px 2px rgba(0,0,0,0.45)' : 'none';
        fontDialogPreview.style.color = color;
    }

    if (fontDialogFamilyList) {
        fontDialogFamilyList.addEventListener('change', () => {
            if (fontDialogNameInput) fontDialogNameInput.value = fontDialogFamilyList.value;
            updateFontDialogPreview();
        });
    }

    if (fontDialogNameInput) {
        fontDialogNameInput.addEventListener('input', () => {
            if (fontDialogFamilyList) fontDialogFamilyList.value = fontDialogNameInput.value;
            updateFontDialogPreview();
        });
    }

    if (fontDialogSizeList) {
        fontDialogSizeList.addEventListener('change', () => {
            if (fontDialogSizeInput) fontDialogSizeInput.value = fontDialogSizeList.value;
            updateFontDialogPreview();
        });
    }

    if (fontDialogSizeInput) {
        fontDialogSizeInput.addEventListener('input', () => {
            if (fontDialogSizeList) fontDialogSizeList.value = fontDialogSizeInput.value;
            updateFontDialogPreview();
        });
    }

    [fontFxBold, fontFxItalic, fontFxUnderline, fontFxShadow, fontFxSub, fontFxSup, fontFxStrike, fontDialogColor].forEach(ctrl => {
        if (ctrl) {
            ctrl.addEventListener('change', updateFontDialogPreview);
            ctrl.addEventListener('input', updateFontDialogPreview);
        }
    });

    function openFontDialog() {
        if (fontSelect && fontDialogNameInput) {
            fontDialogNameInput.value = fontSelect.value;
            if (fontDialogFamilyList) fontDialogFamilyList.value = fontSelect.value;
        }
        if (sizeSelect && fontDialogSizeInput) {
            fontDialogSizeInput.value = sizeSelect.value;
            if (fontDialogSizeList) fontDialogSizeList.value = sizeSelect.value;
        }
        if (fontFxBold) fontFxBold.checked = document.queryCommandState('bold');
        if (fontFxItalic) fontFxItalic.checked = document.queryCommandState('italic');
        if (fontFxUnderline) fontFxUnderline.checked = document.queryCommandState('underline');
        if (fontFxStrike) fontFxStrike.checked = document.queryCommandState('strikeThrough');

        updateFontDialogPreview();
        openModal(modalFontSetup);
    }

    if (btnFontDialog) btnFontDialog.addEventListener('click', openFontDialog);

    // Ctrl+D kısayolu (Yazı Tipi Dialogu)
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
            e.preventDefault();
            openFontDialog();
        }
    });

    if (btnFontDialogSave) {
        btnFontDialogSave.addEventListener('click', () => {
            const fontName = fontDialogNameInput ? fontDialogNameInput.value : 'Times New Roman';
            const fontSize = parseInt(fontDialogSizeInput ? fontDialogSizeInput.value : 12, 10) || 12;
            const color = fontDialogColor ? fontDialogColor.value : '#000000';

            editor.setFontFamily(fontName);
            editor.setFontSize(fontSize);
            editor.setTextColor(color);

            if (fontSelect) fontSelect.value = fontName;
            if (sizeSelect) sizeSelect.value = fontSize;

            if (fontFxBold && fontFxBold.checked !== document.queryCommandState('bold')) {
                editor.format('bold');
            }
            if (fontFxItalic && fontFxItalic.checked !== document.queryCommandState('italic')) {
                editor.format('italic');
            }
            if (fontFxUnderline && fontFxUnderline.checked !== document.queryCommandState('underline')) {
                editor.format('underline');
            }
            if (fontFxStrike && fontFxStrike.checked !== document.queryCommandState('strikeThrough')) {
                editor.format('strikeThrough');
            }

            closeModal(modalFontSetup);
            showToast(`Yazı tipi uygulandı: ${fontName}, ${fontSize} pt`, 'success');
        });
    }

    // ----------------------------------------------------
    // UYAP YATAY CETVEL (HORIZONTAL RULER - SCREENSHOT 10)
    // ----------------------------------------------------
    const rulerScaleEl = document.getElementById('ruler-scale');
    const horizontalRulerEl = document.getElementById('horizontal-ruler');
    const btnToggleRuler = document.getElementById('btn-toggle-ruler');
    const rulerMarkerLeft = document.getElementById('ruler-marker-left');
    const rulerMarkerRight = document.getElementById('ruler-marker-right');

    const PX_PER_CM = 96 / 2.54;
    let rulerDrag = null;

    function renderRuler() {
        if (!rulerScaleEl || !horizontalRulerEl) return;
        const cs = getComputedStyle(editorEl);
        const W = editorEl.offsetWidth;
        const ml = parseFloat(cs.paddingLeft) || 0;
        const mr = parseFloat(cs.paddingRight) || 0;
        horizontalRulerEl.style.width = W + 'px';
        horizontalRulerEl.style.maxWidth = 'none';
        rulerScaleEl.innerHTML = '';

        const zoneL = document.createElement('div');
        zoneL.className = 'ruler-zone';
        zoneL.style.cssText = 'left:0;width:' + ml + 'px';
        const zoneR = document.createElement('div');
        zoneR.className = 'ruler-zone';
        zoneR.style.cssText = 'right:0;width:' + mr + 'px';
        rulerScaleEl.appendChild(zoneL);
        rulerScaleEl.appendChild(zoneR);

        // Sıfır noktası sol kenar boşluğudur (e-UDF ve Word gibi); solu eksi değerlerdir
        const minMm = -Math.floor(ml / PX_PER_CM * 2) / 2;
        const maxCm = (W - ml) / PX_PER_CM;
        for (let half = Math.ceil(minMm * 2); half <= Math.floor(maxCm * 2); half++) {
            const cm = half / 2;
            const x = ml + cm * PX_PER_CM;
            const isCm = Number.isInteger(cm);
            const tick = document.createElement('div');
            tick.className = 'ruler-cm-tick' + (isCm ? '' : ' half');
            tick.style.left = x + 'px';
            rulerScaleEl.appendChild(tick);
            if (isCm) {
                const num = document.createElement('div');
                num.className = 'ruler-cm-num';
                num.style.left = x + 'px';
                num.textContent = cm;
                rulerScaleEl.appendChild(num);
            }
        }
        if (rulerMarkerLeft) rulerMarkerLeft.style.left = ml + 'px';
        if (rulerMarkerRight) rulerMarkerRight.style.right = mr + 'px';
    }

    function updateRulerMarkers() { renderRuler(); }
    window.addEventListener('resize', renderRuler);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(renderRuler);

    // Kenar boşluğu tutamaklarını sürükleyerek ayarla
    function bindRulerDrag(marker, side) {
        if (!marker) return;
        marker.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            marker.setPointerCapture(e.pointerId);
            rulerDrag = { side, marker };
            marker.classList.add('dragging');
        });
        marker.addEventListener('pointermove', (e) => {
            if (!rulerDrag || rulerDrag.marker !== marker) return;
            const r = horizontalRulerEl.getBoundingClientRect();
            const sc = r.width / horizontalRulerEl.offsetWidth || 1;
            const x = (e.clientX - r.left) / sc;
            const W = editorEl.offsetWidth;
            const cur = getComputedStyle(editorEl);
            if (side === 'left') {
                const max = W - (parseFloat(cur.paddingRight) || 0) - 3 * PX_PER_CM;
                editorEl.style.paddingLeft = Math.max(0, Math.min(max, Math.round(x / PX_PER_CM * 10) / 10 * PX_PER_CM)) + 'px';
            } else {
                const max = W - (parseFloat(cur.paddingLeft) || 0) - 3 * PX_PER_CM;
                editorEl.style.paddingRight = Math.max(0, Math.min(max, Math.round((W - x) / PX_PER_CM * 10) / 10 * PX_PER_CM)) + 'px';
            }
            renderRuler();
        });
        const end = () => {
            if (!rulerDrag) return;
            marker.classList.remove('dragging');
            rulerDrag = null;
            const cs = getComputedStyle(editorEl);
            const leftCm = Math.round((parseFloat(cs.paddingLeft) / PX_PER_CM) * 10) / 10;
            const rightCm = Math.round((parseFloat(cs.paddingRight) / PX_PER_CM) * 10) / 10;
            if (marginLeftInput) marginLeftInput.value = leftCm;
            if (marginRightInput) marginRightInput.value = rightCm;
            const prev = (currentDocModel && currentDocModel.pageProperties) || {};
            currentDocModel = currentDocModel || { pageProperties: {} };
            currentDocModel.pageProperties = Object.assign({}, prev, {
                leftMargin: UkiCore.cmToPt(leftCm), rightMargin: UkiCore.cmToPt(rightCm),
                leftMarginCm: String(leftCm), rightMarginCm: String(rightCm)
            });
            if (statMarginsInfo) statMarginsInfo.textContent = 'Boşluklar: Sol ' + leftCm + ' cm, Sağ ' + rightCm + ' cm, Üst ' + (currentDocModel.pageProperties.topMarginCm || 2.5) + ' cm, Alt ' + (currentDocModel.pageProperties.bottomMarginCm || 2.5) + ' cm';
            recalculatePagesAndThumbnails();
        };
        marker.addEventListener('pointerup', end);
        marker.addEventListener('pointercancel', end);
    }
    bindRulerDrag(rulerMarkerLeft, 'left');
    bindRulerDrag(rulerMarkerRight, 'right');

    // ---- Cetvelden sekme durağı (tab stop) ----
    // Cetvele tıklayınca imlecin bulunduğu paragrafa sekme durağı eklenir; Tab tuşu bu durağa gider,
    // Enter ile açılan yeni paragraf durakları devralır (veri paragrafta data-tabset olarak tutulur).
    function selectedParagraphs() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !editorEl.contains(sel.anchorNode)) return [];
        const range = sel.getRangeAt(0);
        const all = Array.from(editorEl.querySelectorAll('p'));
        const hit = all.filter(p => range.intersectsNode(p));
        if (hit.length) return hit;
        let n = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
        const p = n && n.closest ? n.closest('p') : null;
        return p && editorEl.contains(p) ? [p] : [];
    }
    function parseStops(p) {
        return (p.getAttribute('data-tabset') || '').split(',').filter(Boolean).map(x => {
            const f = x.split(':');
            return { pos: parseFloat(f[0]), align: f[1] || '0', lead: f[2] || '0' };
        }).filter(st => !isNaN(st.pos));
    }
    function writeStops(p, stops) {
        stops.sort((a, b) => a.pos - b.pos);
        if (stops.length) p.setAttribute('data-tabset', stops.map(st => (Math.round(st.pos * 10) / 10) + ':' + st.align + ':' + st.lead).join(','));
        else p.removeAttribute('data-tabset');
    }
    function renderRulerStops() {
        if (!rulerScaleEl) return;
        rulerScaleEl.querySelectorAll('.ruler-tabstop').forEach(e => e.remove());
        const paras = selectedParagraphs();
        if (!paras.length) return;
        const ml = parseFloat(getComputedStyle(editorEl).paddingLeft) || 0;
        const curP = paras[0];
        parseStops(curP).forEach(st => {
            const el = document.createElement('div');
            el.className = 'ruler-tabstop align-' + st.align;
            el.style.left = (ml + st.pos * 0.98 * 96 / 72) + 'px';
            el.title = 'Sekme durağı (' + (Math.round(st.pos / 28.3465 * 100) / 100) + ' cm) — kaldırmak için çift tıklayın';
            el.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                selectedParagraphs().forEach(p => writeStops(p, parseStops(p).filter(x => Math.abs(x.pos - st.pos) > 0.05)));
                afterTabChange();
            });
            rulerScaleEl.appendChild(el);
        });

        // İlk satır ve asılı girinti işaretçilerini paragraf konumuna hizala
        const fliVal = parseFloat(curP.getAttribute('data-fli') || '0');
        const hangVal = parseFloat(curP.getAttribute('data-hanging') || '0');
        const liVal = parseFloat(curP.getAttribute('data-li') || '0');
        const firstIndentMarker = document.querySelector('.ruler-first-indent');
        const hangingIndentMarker = document.querySelector('.ruler-hanging-indent');
        if (firstIndentMarker) {
            const fliPx = (fliVal + liVal) * 0.98 * 96 / 72;
            firstIndentMarker.style.transform = `translateX(${fliPx}px)`;
        }
        if (hangingIndentMarker) {
            const hangPx = (hangVal + liVal) * 0.98 * 96 / 72;
            hangingIndentMarker.style.transform = `translateX(${hangPx}px)`;
        }
    }
    function afterTabChange() {
        if (UkiCore.layoutTabs) UkiCore.layoutTabs(editorEl);
        renderRulerStops();
        recalculatePagesAndThumbnails();
    }
    if (rulerScaleEl) {
        rulerScaleEl.addEventListener('mousedown', (e) => e.preventDefault()); // editör odağı kaybolmasın
        rulerScaleEl.addEventListener('click', (e) => {
            if (e.target.closest('.ruler-tabstop')) return;
            const paras = selectedParagraphs();
            if (!paras.length) { showToast('Sekme durağı için önce imleci bir paragrafa getirin.', 'info'); return; }
            const r = rulerScaleEl.getBoundingClientRect();
            const sc = r.width / rulerScaleEl.offsetWidth || 1;
            const ml = parseFloat(getComputedStyle(editorEl).paddingLeft) || 0;
            const rawPt = ((e.clientX - r.left) / sc - ml) * 72 / 96;
            const posPt = Math.round(rawPt / 2.83465) * 2.83465; // 1 mm adım
            if (posPt < 4) return;
            paras.forEach(p => {
                const stops = parseStops(p);
                if (!stops.some(x => Math.abs(x.pos - posPt) < 1)) stops.push({ pos: posPt, align: '0', lead: '0' });
                writeStops(p, stops);
            });
            afterTabChange();
        });
    }
    let stopRaf = null;
    document.addEventListener('selectionchange', () => {
        if (stopRaf) cancelAnimationFrame(stopRaf);
        stopRaf = requestAnimationFrame(renderRulerStops);
    });

    // Tab ve Enter tuşları yönetimi: sekme durağına gitme ve yeni paragrafta özellikleri devralma
    editorEl.addEventListener('keydown', (e) => {
        // Enter tuşu: Paragraf özelliklerini (girinti, satır aralığı, boşluklar, hizalama ve TabSet) sonraki paragrafa aktar
        if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const node = sel.anchorNode;
                const currentP = node ? (node.nodeType === Node.ELEMENT_NODE ? node.closest('p') : (node.parentElement ? node.parentElement.closest('p') : null)) : null;
                if (currentP && editorEl.contains(currentP)) {
                    const attrs = ['data-fli', 'data-hanging', 'data-li', 'data-ri', 'data-spaceabove', 'data-spacebelow', 'data-linespacing', 'data-tabset'];
                    const savedAttrs = {};
                    attrs.forEach(a => {
                        if (currentP.hasAttribute(a)) savedAttrs[a] = currentP.getAttribute(a);
                    });
                    const savedStyles = {
                        textAlign: currentP.style.textAlign,
                        textIndent: currentP.style.textIndent,
                        paddingLeft: currentP.style.paddingLeft,
                        paddingRight: currentP.style.paddingRight,
                        lineHeight: currentP.style.lineHeight,
                        margin: currentP.style.margin,
                        padding: currentP.style.padding
                    };

                    setTimeout(() => {
                        const s = window.getSelection();
                        if (!s || !s.rangeCount) return;
                        const nextNode = s.anchorNode;
                        const newP = nextNode ? (nextNode.nodeType === Node.ELEMENT_NODE ? nextNode.closest('p') : (nextNode.parentElement ? nextNode.parentElement.closest('p') : null)) : null;
                        if (newP && newP !== currentP && editorEl.contains(newP)) {
                            Object.entries(savedAttrs).forEach(([k, v]) => newP.setAttribute(k, v));
                            Object.entries(savedStyles).forEach(([k, v]) => {
                                if (v) newP.style[k] = v;
                            });
                            if (typeof UkiCore !== 'undefined' && UkiCore.layoutTabs) {
                                UkiCore.layoutTabs(editorEl);
                            }
                            if (typeof recalculatePagesAndThumbnails === 'function') {
                                recalculatePagesAndThumbnails();
                            }
                        }
                    }, 0);
                }
            }
            return;
        }

        if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        let node = sel.anchorNode;
        if (!node) return;
        const p = node.nodeType === Node.ELEMENT_NODE ? node.closest('p, td, th, div.udf-p, [contenteditable="true"]') : (node.parentElement ? node.parentElement.closest('p, td, th, div.udf-p, [contenteditable="true"]') : null);
        if (!p || !editorEl.contains(p) || (node.closest && node.closest('li'))) return;

        e.preventDefault();
        const range = sel.getRangeAt(0);
        range.deleteContents();

        // 1. Sekme öğesini oluştur (contenteditable=false, inline-block ve atomik boşluk)
        const tab = document.createElement('span');
        tab.className = 'udf-tab';
        tab.setAttribute('data-tab', '1');
        tab.setAttribute('contenteditable', 'false');
        tab.style.display = 'inline-block';
        tab.style.color = 'transparent';
        tab.textContent = '\u00A0';
        range.insertNode(tab);

        // 2. Sekme genişliğini ve durak hizasını hesapla (metni fiziksel olarak it)
        if (typeof UkiCore !== 'undefined' && UkiCore.layoutTabs) {
            UkiCore.layoutTabs(editorEl);
        }

        // 3. İmleci sekme durağının tam hizasına (tab sonrasına) taşı
        let nextTextNode = tab.nextSibling;
        if (!nextTextNode || nextTextNode.nodeType !== Node.TEXT_NODE || nextTextNode.length === 0) {
            nextTextNode = document.createTextNode('\u200B');
            tab.parentNode.insertBefore(nextTextNode, tab.nextSibling);
        }

        const afterRange = document.createRange();
        const offset = nextTextNode.nodeValue === '\u200B' ? 1 : 0;
        afterRange.setStart(nextTextNode, offset);
        afterRange.collapse(true);

        sel.removeAllRanges();
        sel.addRange(afterRange);
        editorEl.dispatchEvent(new Event('input', {bubbles:true}));

        // Sayfalama güncellemesi
        if (typeof recalculatePagesAndThumbnails === 'function') {
            recalculatePagesAndThumbnails();
        }
    });

    if (btnToggleRuler && horizontalRulerEl) {
        btnToggleRuler.addEventListener('click', () => {
            const isHidden = horizontalRulerEl.style.display === 'none';
            horizontalRulerEl.style.display = isHidden ? 'flex' : 'none';
            btnToggleRuler.classList.toggle('active', isHidden);
            showToast(isHidden ? 'Yatay cetvel gösteriliyor.' : 'Yatay cetvel gizlendi.', 'info');
        });
    }

    renderRuler();

    // ----------------------------------------------------
    // GÜVENLİK FİLİGRANI & ELEKTRONİK İMZA ROZETİ (SCREENSHOT 3)
    // ----------------------------------------------------
    let isWatermarkActive = true;
    const watermarkLayerEl = document.getElementById('watermark-layer');
    const btnToggleWatermark = document.getElementById('btn-toggle-watermark');
    const eSignSealBadgeEl = document.getElementById('e-sign-seal-badge');
    const sealNamesListEl = document.getElementById('seal-names-list');

    // Filigran metni: UDF'deki UYAP sicil numarası; sicil okunamayan UDF'de 657.com.tr; yeni belgede filigran yok
    function watermarkTextFor(model) {
        if (!model) return '';
        const sicil = model.docProperties && model.docProperties.uyapsicil;
        return sicil ? sicil : '657.com.tr';
    }

    function renderWatermark(text, show) {
        if (!watermarkLayerEl) return;
        if (!show || !text) {
            watermarkLayerEl.style.display = 'none';
            return;
        }
        const label = escapeHtml(text);
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='250' height='150'><text x='30' y='115' font-family='Arial, sans-serif' font-size='34' font-weight='700' fill='rgba(110, 110, 110, 0.16)' transform='rotate(-45 30 115)'>${label}</text></svg>`;
        watermarkLayerEl.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
        watermarkLayerEl.style.display = 'block';
    }

    // Bağımsız Yüzen E-İmza Rozeti (assets/js/uki-seal.js)
    if (window.UkiSeal) {
        window.UkiSeal.init({
            onClick: () => showSignaturesModal()
        });
    }

    function renderElectronicSeal(signatures) {
        if (window.UkiSeal) {
            window.UkiSeal.setSignatures(signatures);
        }
    }

    if (btnToggleWatermark) {
        btnToggleWatermark.addEventListener('click', () => {
            isWatermarkActive = !isWatermarkActive;
            renderWatermark(watermarkTextFor(currentDocModel && currentDocModel.docProperties ? currentDocModel : null), isWatermarkActive);
            recalculatePagesAndThumbnails(); // küçük önizlemeler de güncellensin
            btnToggleWatermark.classList.toggle('active', isWatermarkActive);
            showToast(isWatermarkActive ? 'Güvenlik filigranı açıldı.' : 'Güvenlik filigranı gizlendi.', 'info');
        });
    }

    // Yeni (boş) belgede filigran yoktur; sicil bilgisi yalnızca açılan UDF'den gelir
    renderWatermark('', true);

    // ----------------------------------------------------
    // ====================================================
    // RENK PALETLERİ VE HAZIR SEÇENEKLER (SAYFA / TUVAL / YAZI)
    // ====================================================
    let activeColorPopover = null;

    function closeColorPopover() {
        if (activeColorPopover && activeColorPopover.parentNode) {
            activeColorPopover.parentNode.removeChild(activeColorPopover);
            activeColorPopover = null;
        }
    }

    document.addEventListener('click', (e) => {
        if (activeColorPopover && !activeColorPopover.contains(e.target)) {
            closeColorPopover();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && activeColorPopover) {
            closeColorPopover();
        }
    });

    function isLightColor(hex) {
        if (!hex || typeof hex !== 'string') return true;
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const r = parseInt(c.substring(0, 2), 16) || 0;
        const g = parseInt(c.substring(2, 4), 16) || 0;
        const b = parseInt(c.substring(4, 6), 16) || 0;
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        return yiq >= 150;
    }

    function triggerNativeColorPicker(pickerId, ev) {
        closeColorPopover();
        const input = document.getElementById(pickerId);
        if (!input) return;

        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;
        const e = ev || window.event;
        if (e && typeof e.clientX === 'number' && (e.clientX > 0 || e.clientY > 0)) {
            x = e.clientX;
            y = e.clientY;
        }

        if (input.parentElement !== document.body) {
            document.body.appendChild(input);
        }

        input.style.setProperty('position', 'fixed', 'important');
        input.style.setProperty('left', `${Math.round(x)}px`, 'important');
        input.style.setProperty('top', `${Math.round(y)}px`, 'important');
        input.style.setProperty('width', '24px', 'important');
        input.style.setProperty('height', '24px', 'important');
        input.style.setProperty('opacity', '0.01', 'important');
        input.style.setProperty('pointer-events', 'auto', 'important');
        input.style.setProperty('z-index', '999999', 'important');
        input.style.removeProperty('display');

        setTimeout(() => {
            if (typeof input.showPicker === 'function') {
                try {
                    input.showPicker();
                    return;
                } catch (err) { /* fallback */ }
            }
            input.click();
        }, 15);
    }

        function updateEditorTextColorForBackground(bgHex) {
        if (!editorEl) return;
        const isLight = isLightColor(bgHex);
        if (!isLight) {
            editorEl.setAttribute('data-doc-theme', 'dark');
            editorEl.style.color = '#f8fafc';
        } else {
            editorEl.removeAttribute('data-doc-theme');
            editorEl.style.color = '#000000';
        }
    }
    window.updateEditorTextColorForBackground = updateEditorTextColorForBackground;

    function resetAllDesignToDefault() {
        if (editorEl) {
            editorEl.style.backgroundColor = '#ffffff';
            editorEl.removeAttribute('data-doc-theme');
            editorEl.style.color = '#000000';
        }
        localStorage.removeItem('uki-page-color');

        if (workspaceContainerEl) {
            workspaceContainerEl.style.backgroundColor = '#1f819a';
        }
        localStorage.removeItem('uki-canvas-color');

        const fontSel = document.getElementById('font-select');
        const sizeSel = document.getElementById('size-select');
        if (fontSel) fontSel.value = 'Times New Roman';
        if (sizeSel) sizeSel.value = '12';
        document.execCommand('fontName', false, 'Times New Roman');
        document.execCommand('fontSize', false, '3');
        document.execCommand('foreColor', false, '#000000');

        if (typeof removeAntetFromEditor === 'function') {
            removeAntetFromEditor();
        }

        if (typeof applyPagePropertiesToView === 'function') {
            applyPagePropertiesToView({
                mediaSizeName: '1',
                paperOrientation: 1,
                leftMarginCm: 2.0,
                rightMarginCm: 2.5,
                topMarginCm: 2.5,
                bottomMarginCm: 2.5
            });
        }

        if (typeof recalculatePagesAndThumbnails === 'function') {
            recalculatePagesAndThumbnails();
        }

        closeColorPopover();
        showToast('Tüm tasarım ayarları UYAP varsayılanlarına sıfırlandı.', 'success');
    }
    window.resetAllDesignToDefault = resetAllDesignToDefault;

function openColorPicker(pickerId, ev) {
        if (ev && typeof ev.stopPropagation === 'function') {
            ev.stopPropagation();
        }
        closeColorPopover();

        const input = document.getElementById(pickerId);
        if (!input) return;

        const presetsMap = {
            'page-color-picker': {
                title: 'Sayfa Rengi (Kâğıt)',
                getCurrent: () => (editorEl && editorEl.style.backgroundColor) || localStorage.getItem('uki-page-color') || '#ffffff',
                defaultColor: '#ffffff',
                apply: (c, label) => {
                    if (editorEl) {
                        editorEl.style.backgroundColor = c;
                        updateEditorTextColorForBackground(c);
                    }
                    if (c.toLowerCase() === '#ffffff') localStorage.removeItem('uki-page-color');
                    else localStorage.setItem('uki-page-color', c);
                    input.value = c;
                    showToast(`Sayfa Rengi: ${label}`, 'info');
                },
                colors: [
                    { hex: '#ffffff', name: 'Klasik Beyaz (Varsayılan)' },
                    { hex: '#faf8f5', name: 'Krem / Fildişi' },
                    { hex: '#fbf0d9', name: 'Kitap / Sıcak Sepya' },
                    { hex: '#f4ecd8', name: 'Parşömen' },
                    { hex: '#f0fdf4', name: 'Göz Dinlendirici Yeşil' },
                    { hex: '#eff6ff', name: 'Açık Mavi' },
                    { hex: '#f1f5f9', name: 'Mat Gri' },
                    { hex: '#1e293b', name: 'Koyu Gece Modu' },
                    { hex: '#0f172a', name: 'Derin Siyah' }
                ]
            },
            'canvas-color-picker': {
                title: 'Tuval Rengi (Masaüstü)',
                getCurrent: () => (workspaceContainerEl && workspaceContainerEl.style.backgroundColor) || localStorage.getItem('uki-canvas-color') || '#1f819a',
                defaultColor: '#1f819a',
                apply: (c, label) => {
                    if (workspaceContainerEl) workspaceContainerEl.style.backgroundColor = c;
                    localStorage.setItem('uki-canvas-color', c);
                    input.value = c;
                    showToast(`Tuval Rengi: ${label}`, 'info');
                },
                colors: [
                    { hex: '#1f819a', name: 'UYAP Turkuazı (Resmî)' },
                    { hex: '#0f172a', name: 'Koyu Gece / Slate' },
                    { hex: '#1e293b', name: 'Nötr Antrasit' },
                    { hex: '#c0c0c0', name: 'Klasik Windows Grisi' },
                    { hex: '#e2e8f0', name: 'Açık Duman Grisi' },
                    { hex: '#115e59', name: 'Adliye Zümrüt Yeşili' },
                    { hex: '#3f2e21', name: 'Ahşap Büro Kahvesi' },
                    { hex: '#1e3a8a', name: 'Resmî Lacivert' },
                    { hex: '#4c0519', name: 'Hüküm Bordosu' }
                ]
            },
            'text-color-picker': {
                title: 'Yazı Rengi',
                getCurrent: () => input.value || '#000000',
                defaultColor: '#000000',
                apply: (c, label) => {
                    if (editor && editor.setTextColor) editor.setTextColor(c);
                    input.value = c;
                    showToast(`Yazı Rengi: ${label}`, 'info');
                },
                colors: [
                    { hex: '#000000', name: 'Siyah' },
                    { hex: '#374151', name: 'Koyu Gri' },
                    { hex: '#6b7280', name: 'Orta Gri' },
                    { hex: '#dc2626', name: 'Kırmızı' },
                    { hex: '#1d4ed8', name: 'Mavi (UYAP Vurgusu)' },
                    { hex: '#16a34a', name: 'Yeşil' },
                    { hex: '#1e3a8a', name: 'Lacivert (Resmî)' },
                    { hex: '#7f1d1d', name: 'Bordo (Hüküm)' },
                    { hex: '#6b21a8', name: 'Mor' },
                    { hex: '#ea580c', name: 'Turuncu' },
                    { hex: '#78350f', name: 'Kahverengi' },
                    { hex: '#ffffff', name: 'Beyaz' }
                ]
            }
        };

        const config = presetsMap[pickerId];
        if (!config) {
            triggerNativeColorPicker(pickerId, ev);
            return;
        }

        // Popover DOM
        const popover = document.createElement('div');
        popover.className = 'uki-palette-popover';

        // Header
        const header = document.createElement('div');
        header.className = 'uki-palette-header';
        const title = document.createElement('span');
        title.className = 'uki-palette-title';
        title.textContent = config.title;
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'uki-palette-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.title = 'Kapat';
        closeBtn.onclick = (e) => { e.stopPropagation(); closeColorPopover(); };
        header.appendChild(title);
        header.appendChild(closeBtn);
        popover.appendChild(header);

        // Grid
        const grid = document.createElement('div');
        grid.className = 'uki-palette-grid';
        const curColor = config.getCurrent();

        config.colors.forEach(col => {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'uki-palette-swatch';
            swatch.style.backgroundColor = col.hex;
            swatch.title = col.name;

            const isLight = isLightColor(col.hex);
            if (isLight) swatch.classList.add('is-light');

            if (curColor && (curColor.toLowerCase() === col.hex.toLowerCase() || curColor === col.hex)) {
                swatch.classList.add('active');
            }

            swatch.onclick = (e) => {
                e.stopPropagation();
                config.apply(col.hex, col.name);
                closeColorPopover();
            };
            grid.appendChild(swatch);
        });
        popover.appendChild(grid);

        // Footer buttons
        const footer = document.createElement('div');
        footer.className = 'uki-palette-footer';

        const customBtn = document.createElement('button');
        customBtn.type = 'button';
        customBtn.className = 'uki-palette-btn';
        customBtn.textContent = '🎨 Özel Renk...';
        customBtn.title = 'Tüm renk skalasından özel renk seçin';
        customBtn.onclick = (e) => {
            e.stopPropagation();
            triggerNativeColorPicker(pickerId, ev);
        };

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'uki-palette-btn';
        resetBtn.textContent = '↺ Sıfırla';
        resetBtn.title = 'Varsayılan renge dön';
        resetBtn.onclick = (e) => {
            e.stopPropagation();
            config.apply(config.defaultColor, 'Varsayılan');
            closeColorPopover();
        };

        footer.appendChild(customBtn);
        footer.appendChild(resetBtn);

        const resetAllBtn = document.createElement('button');
        resetAllBtn.type = 'button';
        resetAllBtn.className = 'uki-palette-btn';
        resetAllBtn.style.color = '#ef4444';
        resetAllBtn.textContent = '⚙️ Tümünü Sıfırla';
        resetAllBtn.title = 'Tüm tasarım ayarlarını (kâğıt, tuval, yazı, marjin) UYAP varsayılanına döndürür';
        resetAllBtn.onclick = (e) => {
            e.stopPropagation();
            resetAllDesignToDefault();
        };
        footer.appendChild(resetAllBtn);

        popover.appendChild(footer);

        document.body.appendChild(popover);
        activeColorPopover = popover;

        // Pozisyon hesaplama (Tıklanan butona veya menü öğesine tam oturma)
        let posX = window.innerWidth / 2 - 125;
        let posY = window.innerHeight / 2 - 100;

        const e = ev || window.event;
        if (e) {
            const target = e.currentTarget || e.target;
            if (target && typeof target.getBoundingClientRect === 'function') {
                const rect = target.getBoundingClientRect();
                if (rect.right + 260 <= window.innerWidth) {
                    posX = rect.right + 8;
                    posY = Math.max(12, rect.top - 10);
                } else if (rect.left - 260 >= 12) {
                    posX = rect.left - 260 - 8;
                    posY = Math.max(12, rect.top - 10);
                } else {
                    posX = Math.max(12, rect.left);
                    posY = rect.bottom + 8;
                }
            } else if (typeof e.clientX === 'number' && e.clientX > 0) {
                posX = e.clientX + 10;
                posY = e.clientY + 10;
            }
        }

        // Ekran taşma kontrolleri
        const popW = 250;
        const popH = popover.offsetHeight || 220;
        if (posX + popW > window.innerWidth - 12) posX = window.innerWidth - popW - 12;
        if (posX < 12) posX = 12;
        if (posY + popH > window.innerHeight - 12) {
            posY = Math.max(12, posY - popH - 45);
        }

        popover.style.left = `${Math.round(posX)}px`;
        popover.style.top = `${Math.round(posY)}px`;
    }
    window.openColorPicker = openColorPicker;

    const pageColorPicker = document.getElementById('page-color-picker');
    if (pageColorPicker) {
        pageColorPicker.addEventListener('input', () => {
            const color = pageColorPicker.value;
            editorEl.style.backgroundColor = color;
            localStorage.setItem('uki-page-color', color);
        });

        const savedPageColor = localStorage.getItem('uki-page-color');
        if (savedPageColor) {
            pageColorPicker.value = savedPageColor;
            editorEl.style.backgroundColor = savedPageColor;
            updateEditorTextColorForBackground(savedPageColor);
        }
    }

    const canvasColorPicker = document.getElementById('canvas-color-picker');
    const workspaceContainerEl = document.getElementById('workspace-container');
    if (canvasColorPicker && workspaceContainerEl) {
        canvasColorPicker.addEventListener('input', () => {
            const color = canvasColorPicker.value;
            workspaceContainerEl.style.backgroundColor = color;
            localStorage.setItem('uki-canvas-color', color);
        });

        const savedCanvasColor = localStorage.getItem('uki-canvas-color');
        if (savedCanvasColor) {
            canvasColorPicker.value = savedCanvasColor;
            workspaceContainerEl.style.backgroundColor = savedCanvasColor;
        }
    }

    // Tüm tasarımı ve renkleri varsayılan fabrika ayarlarına sıfırla
    function resetDesignToDefault() {
        // 1. Sayfa Rengi (Kağıt) -> Varsayılan Beyaz (#ffffff)
        localStorage.removeItem('uki-page-color');
        if (editorEl) {
            editorEl.style.backgroundColor = '#ffffff';
        }
        if (pageColorPicker) {
            pageColorPicker.value = '#ffffff';
        }

        // 2. Tuval / Masaüstü Rengi -> Varsayılan Tema Rengi (--ax-surface-canvas)
        localStorage.removeItem('uki-canvas-color');
        if (workspaceContainerEl) {
            workspaceContainerEl.style.backgroundColor = '';
        }
        if (canvasColorPicker) {
            canvasColorPicker.value = '#1f819a';
        }

        // 3. Belge Koyu Modu / Gece Okuma -> Kapat (Açık Kağıt)
        localStorage.removeItem('uki-doc-theme');
        document.documentElement.removeAttribute('data-doc-theme');
        if (typeof updateDocThemeButton === 'function') {
            updateDocThemeButton();
        }

        // 4. Kurum ve Avukat Antetleri -> Kaldır
        if (typeof removeAntetFromEditor === 'function') {
            removeAntetFromEditor();
        }
        localStorage.removeItem('uki-active-antet');

        // 5. Yakınlaştırma (Zoom) -> %100
        const zoomSelect = document.getElementById('zoom-select');
        const pageWrapper = document.getElementById('page-wrapper');
        if (zoomSelect) {
            zoomSelect.value = '100';
        }
        if (pageWrapper) {
            pageWrapper.style.transform = 'scale(1)';
            pageWrapper.style.transformOrigin = 'top center';
        }

        // 6. Standart UYAP Sayfa Düzeni ve Kenar Boşlukları (A4 Dikey, Sol: 2.0cm, Sağ/Üst/Alt: 2.5cm)
        const defaultPageProps = {
            mediaSizeName: '1',
            paperOrientation: 1,
            leftMargin: UkiCore.cmToPt(2.0),
            rightMargin: UkiCore.cmToPt(2.5),
            topMargin: UkiCore.cmToPt(2.5),
            bottomMargin: UkiCore.cmToPt(2.5),
            headerFOffset: UkiCore.cmToPt(0.529),
            footerFOffset: UkiCore.cmToPt(2.117),
            leftMarginCm: '2.0',
            rightMarginCm: '2.5',
            topMarginCm: '2.5',
            bottomMarginCm: '2.5',
            headerFOffsetCm: '0.529',
            footerFOffsetCm: '2.117'
        };
        if (currentDocModel) {
            currentDocModel.pageProperties = defaultPageProps;
        }
        if (typeof applyPagePropertiesToView === 'function') {
            applyPagePropertiesToView(defaultPageProps);
        }
        if (marginLeftInput) marginLeftInput.value = '2.0';
        if (marginRightInput) marginRightInput.value = '2.5';
        if (marginTopInput) marginTopInput.value = '2.5';
        if (marginBottomInput) marginBottomInput.value = '2.5';

        // 7. Cetvel ve Sayfa Sınırları & Küçük Önizlemeleri Yenile
        if (typeof updateRulerMarkers === 'function') {
            updateRulerMarkers(2.0, 2.5);
        }
        if (typeof recalculatePagesAndThumbnails === 'function') {
            recalculatePagesAndThumbnails();
        }

        showToast('Tüm sayfa tasarımı ve renkler varsayılana sıfırlandı.', 'success');
    }
    window.resetDesignToDefault = resetDesignToDefault;

    // ----------------------------------------------------
    // ÇOK SAYFALI DÖKÜMAN GEZİNTİSİ & SAYFA ÖNİZLEMELERİ
    // ----------------------------------------------------
    const thumbnailsSidebar = document.getElementById('thumbnails-sidebar');
    const btnToggleThumbnails = document.getElementById('btn-toggle-thumbnails');
    const btnCloseThumbnails = document.getElementById('btn-close-thumbnails');
    const thumbnailsList = document.getElementById('thumbnails-list');
    const thumbCountBadge = document.getElementById('thumb-count-badge');
    const pageBoundariesLayer = document.getElementById('page-boundaries-layer');
    const btnPagePrev = document.getElementById('btn-page-prev');
    const btnPageNext = document.getElementById('btn-page-next');
    const inputCurrentPage = document.getElementById('input-current-page');
    const statTotalPages = document.getElementById('stat-total-pages');
    const gotoPageInput = document.getElementById('goto-page-input');
    const gotoMaxPage = document.getElementById('goto-max-page');
    const btnGotoPageConfirm = document.getElementById('btn-goto-page-confirm');
    const workspaceContainer = document.getElementById('workspace-container');

    UkiPages.init(editorEl);
    UkiPages.onCopied = (t) => showToast('Doğrulama kodu kopyalandı: ' + t, 'success');
    const _origSetContent = editor.setContentHtml.bind(editor);
    editor.setContentHtml = (h) => {
        UkiPages.reset();
        const res = _origSetContent(h);
        if (window.UkiHistory && typeof window.UkiHistory.clear === 'function') {
            window.UkiHistory.clear();
        }
        return res;
    };
    let currentActivePage = 1;
    let totalDocPages = 1;
    let isThumbnailsVisible = true;
    let updateThumbnailsTimeout = null;

    function recalculatePagesAndThumbnails() {
        if (!editorEl) return;

        if (UkiCore.layoutTabs) UkiCore.layoutTabs(editorEl);
        totalDocPages = UkiPages.repaginate();

        if (statTotalPages) statTotalPages.textContent = totalDocPages;
        if (thumbCountBadge) thumbCountBadge.textContent = totalDocPages;
        if (gotoMaxPage) gotoMaxPage.textContent = totalDocPages;
        if (inputCurrentPage) inputCurrentPage.max = totalDocPages;

        // Küçük Önizleme Kartlarını (Thumbnails) çiz
        renderThumbnails(totalDocPages);

        // Aktif sayfa durumunu tazele
        updateActivePage(currentActivePage);
    }

    window.recalculatePagesAndThumbnails = recalculatePagesAndThumbnails;
    let documentDirty = false;
    let lastReminder = Date.now();
    function markChanged() {
        documentDirty = true;
        if (statStatus) statStatus.textContent = 'Kaydedilmemiş değişiklikler';
        if (docTitleInput) docTitleInput.setAttribute('data-unsaved', 'true');
    }
    window.UkiApp = {
        refresh: recalculatePagesAndThumbnails,
        markChanged,
        markSaved() {
            documentDirty = false;
            if (docTitleInput) docTitleInput.removeAttribute('data-unsaved');
            lastReminder = Date.now();
        },
        isDirty: () => documentDirty,
        text() {
            const copy = editorEl.cloneNode(true);
            copy.querySelectorAll('[contenteditable="false"],.pb-spacer').forEach(n => n.remove());
            return Array.from(copy.children).map(n => n.textContent).join('\n').replace(/\u200B/g, '');
        },
        replaceDocument(html, title, options = {}) {
            currentDocModel = null;
            currentFileName = title + '.udf';
            editor.setContentHtml(html);
            UkiPages.reset();
            removeAntetFromEditor();
            renderWatermark('', false);
            renderElectronicSeal([]);
            if (signatureBadge) signatureBadge.style.display = 'none';
            docTitleInput.value = title.replace(/\.udf$/i, '');
            recalculatePagesAndThumbnails();
            editorEl.dispatchEvent(new Event('input', {bubbles:true}));
            if (options.clean) this.markSaved(); else markChanged();
            if (window.UkiStats && options.source !== 'welcome') window.UkiStats.recordDocumentOpened({text:this.text(), source:options.source});
        }
    };
    editorEl.addEventListener('input', markChanged);
    docTitleInput.addEventListener('input', markChanged);
    document.addEventListener('uki-document-change', markChanged);
    window.addEventListener('beforeunload', e => { if (documentDirty) { e.preventDefault(); e.returnValue = ''; } });
    setInterval(() => {
        if (documentDirty && Date.now() - lastReminder > 120000) {
            showToast('Belgede kaydedilmemiş değişiklikler var. Ctrl+S ile UDF dosyanızı indirin.', 'info');
            lastReminder = Date.now();
        }
    }, 30000);

    function renderThumbnails(pageCount) {
        if (!thumbnailsList) return;
        thumbnailsList.innerHTML = '';
        const g = UkiPages.geometry();
        const frameW = 120;
        const sc = frameW / g.W;

        for (let p = 1; p <= pageCount; p++) {
            const card = document.createElement('div');
            card.className = 'thumbnail-card' + (p === currentActivePage ? ' active' : '');
            card.setAttribute('data-page', p);
            card.title = 'Sayfa ' + p + "'e git";

            const frame = document.createElement('div');
            frame.className = 'thumbnail-preview-frame';
            frame.style.height = Math.round(g.H * sc) + 'px';

            const mini = document.createElement('div');
            mini.className = 'thumb-mini-wrapper';
            mini.style.cssText = 'padding:0;width:' + g.W + 'px;height:' + g.H + 'px;transform:scale(' + sc + ');overflow:hidden;';

            const clone = editorEl.cloneNode(true);
            clone.removeAttribute('id');
            clone.removeAttribute('contenteditable');
            clone.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
            clone.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
            clone.style.cssText += ';position:absolute;left:0;margin:0;box-shadow:none;min-height:0;width:' + g.W + 'px;top:-' + ((p - 1) * g.S) + 'px;';
            mini.appendChild(clone);
            frame.appendChild(mini);

            const badgeEl = document.createElement('div');
            badgeEl.className = 'thumbnail-badge';
            badgeEl.textContent = 'Sayfa ' + p;

            card.appendChild(frame);
            card.appendChild(badgeEl);
            card.addEventListener('click', () => scrollToPage(p));
            thumbnailsList.appendChild(card);
        }
    }

    function scrollToPage(pageNumber) {
        const p = Math.max(1, Math.min(totalDocPages, pageNumber));
        currentActivePage = p;

        if (workspaceContainer) UkiPages.scrollTo(workspaceContainer, p);

        updateActivePage(p);
    }

    function updateActivePage(pageNumber) {
        currentActivePage = Math.max(1, Math.min(totalDocPages, pageNumber));

        if (inputCurrentPage) inputCurrentPage.value = currentActivePage;

        // Thumbnail aktiflik stilini güncelle
        if (thumbnailsList) {
            const cards = thumbnailsList.querySelectorAll('.thumbnail-card');
            cards.forEach(c => {
                const p = parseInt(c.getAttribute('data-page'), 10);
                if (p === currentActivePage) {
                    c.classList.add('active');
                    // scrollIntoView çalışma alanını da kaydırıp sayfaya gitmeyi bozuyordu: yalnızca küçük resim listesi kaydırılır
                    const lr = thumbnailsList.getBoundingClientRect();
                    const cr = c.getBoundingClientRect();
                    if (cr.top < lr.top) thumbnailsList.scrollTop -= (lr.top - cr.top + 8);
                    else if (cr.bottom > lr.bottom) thumbnailsList.scrollTop += (cr.bottom - lr.bottom + 8);
                } else {
                    c.classList.remove('active');
                }
            });
        }
    }

    // Çalışma alanı kaydırma dinleyicisi (Scroll Spy)
    if (workspaceContainer) {
        let scrollTimeout = null;
        workspaceContainer.addEventListener('scroll', () => {
            if (scrollTimeout) cancelAnimationFrame(scrollTimeout);
            scrollTimeout = requestAnimationFrame(() => {
                const detected = UkiPages.pageFromScroll(workspaceContainer);
                if (detected !== currentActivePage) {
                    updateActivePage(detected);
                }
            });
        }, { passive: true });
    }

    // Gezinme Düğmeleri
    if (btnPagePrev) {
        btnPagePrev.addEventListener('click', () => scrollToPage(currentActivePage - 1));
    }
    if (btnPageNext) {
        btnPageNext.addEventListener('click', () => scrollToPage(currentActivePage + 1));
    }
    if (inputCurrentPage) {
        inputCurrentPage.addEventListener('change', () => {
            const val = parseInt(inputCurrentPage.value, 10);
            if (!isNaN(val)) scrollToPage(val);
        });
        inputCurrentPage.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = parseInt(inputCurrentPage.value, 10);
                if (!isNaN(val)) scrollToPage(val);
            }
        });
    }

    // Gezinti Paneli Aç/Kapa
    function toggleThumbnails() {
        isThumbnailsVisible = !isThumbnailsVisible;
        if (thumbnailsSidebar) {
            thumbnailsSidebar.classList.toggle('collapsed', !isThumbnailsVisible);
        }
        if (btnToggleThumbnails) {
            btnToggleThumbnails.classList.toggle('active', isThumbnailsVisible);
        }
        showToast(isThumbnailsVisible ? 'Sayfa önizleme bölmesi açıldı.' : 'Sayfa önizleme bölmesi kapatıldı.', 'info');
    }

    if (btnToggleThumbnails) btnToggleThumbnails.addEventListener('click', toggleThumbnails);
    if (btnCloseThumbnails) btnCloseThumbnails.addEventListener('click', () => {
        isThumbnailsVisible = false;
        if (thumbnailsSidebar) thumbnailsSidebar.classList.add('collapsed');
        if (btnToggleThumbnails) btnToggleThumbnails.classList.remove('active');
    });

    // Sayfaya Git (Ctrl+G veya F5)
    function openGotoPageModal() {
        if (gotoPageInput) {
            gotoPageInput.value = currentActivePage;
            gotoPageInput.max = totalDocPages;
        }
        if (gotoMaxPage) gotoMaxPage.textContent = totalDocPages;
        openModal(modalGotoPage);
        setTimeout(() => {
            if (gotoPageInput) {
                gotoPageInput.focus();
                gotoPageInput.select();
            }
        }, 60);
    }

    if (btnGotoPageConfirm) {
        btnGotoPageConfirm.addEventListener('click', () => {
            const targetP = parseInt(gotoPageInput.value, 10);
            if (!isNaN(targetP)) {
                scrollToPage(targetP);
                closeModal(modalGotoPage);
            }
        });
    }
    if (gotoPageInput) {
        gotoPageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const targetP = parseInt(gotoPageInput.value, 10);
                if (!isNaN(targetP)) {
                    scrollToPage(targetP);
                    closeModal(modalGotoPage);
                }
            }
        });
    }

    // Klavye Kısayolları (Ctrl+G, Ctrl+PageUp, Ctrl+PageDown)
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'g' || e.key === 'G')) {
            // (Shift+Ctrl+G Elektronik İmzalar paneline aittir; Sayfaya Git yalnızca Ctrl+G)
            e.preventDefault();
            openGotoPageModal();
        } else if (e.key === 'F5') {
            e.preventDefault();
            openGotoPageModal();
        } else if ((e.ctrlKey || e.altKey) && e.key === 'PageUp') {
            e.preventDefault();
            scrollToPage(currentActivePage - 1);
        } else if ((e.ctrlKey || e.altKey) && e.key === 'PageDown') {
            e.preventDefault();
            scrollToPage(currentActivePage + 1);
        }
    });

    // Editör içerik değiştiğinde önizlemeleri debounced güncelle
    editorEl.addEventListener('input', () => {
        if (updateThumbnailsTimeout) clearTimeout(updateThumbnailsTimeout);
        updateThumbnailsTimeout = setTimeout(() => {
            recalculatePagesAndThumbnails();
        }, 300);
    });

    // Başlangıçta sayfaları hesapla
    setTimeout(() => {
        recalculatePagesAndThumbnails();
    }, 150);

    // ----------------------------------------------------
    // URL'DEN DOĞRUDAN DOKÜMAN YÜKLEME (linkac=URL / ?linkac=... / /linkac=...)
    // ----------------------------------------------------
    function extractRemoteDocumentUrl() {
        const fullHref = window.location.href;
        const pathname = window.location.pathname || '';
        const search = window.location.search || '';
        const hash = window.location.hash || '';

        let targetUrl = '';

        // 1. Path kontrolü: örn. /linkac=https://... veya /linkac=dosya.udf
        const pathMatch = pathname.match(/\/linkac[=:](.+)$/i);
        if (pathMatch && pathMatch[1]) {
            targetUrl = pathMatch[1];
        }

        // 2. Query parametresi: ?linkac=..., ?load=..., ?file=..., ?url=..., ?udf=...
        if (!targetUrl && search) {
            const sp = new URLSearchParams(search);
            targetUrl = sp.get('linkac') || sp.get('load') || sp.get('file') || sp.get('url') || sp.get('udf') || '';
        }

        // 3. Hash parametresi: #linkac=... veya #/linkac=...
        if (!targetUrl && hash) {
            const hashMatch = hash.match(/linkac[=:](.+)$/i) || hash.match(/[#&](?:linkac|load|file|url|udf)=([^&]+)/i);
            if (hashMatch && hashMatch[1]) {
                targetUrl = hashMatch[1];
            }
        }

        // 4. Ham URL araması: URL içinde "linkac=" geçiyorsa
        if (!targetUrl && fullHref.includes('linkac=')) {
            try {
                const parts = fullHref.split('linkac=');
                if (parts[1]) {
                    targetUrl = parts[1].split('&')[0].split('#')[0];
                }
            } catch (e) {}
        }

        if (!targetUrl) return null;

        try {
            targetUrl = decodeURIComponent(targetUrl.trim());
        } catch (e) {
            targetUrl = targetUrl.trim();
        }

        // Protokol eksikse ve alan adı içeriyorsa https:// ekle
        // (alan adı gibi görünmüyorsa, örn. "examples/belge.udf", aynı siteye göre göreli yol kalır)
        if (!/^https?:\/\//i.test(targetUrl) && /^[\w-]+(\.[\w-]+)+(\/|:|$)/.test(targetUrl) && !/\.udf$/i.test(targetUrl.split('/')[0])) {
            targetUrl = 'https://' + targetUrl;
        }

        return targetUrl;
    }

    async function fetchRemoteDocumentWithFallbacks(remoteUrl) {
        // 1. Doğrudan fetch denemesi
        try {
            setStatus('Uzak döküman kaynaktan indiriliyor...');
            const resp = await fetch(remoteUrl, { mode: 'cors' });
            if (resp.ok) {
                return await resp.blob();
            }
        } catch (err) {
            console.warn('Doğrudan indirme başarısız (büyük olasılıkla CORS):', err);
        }

        // Gizlilik: belge adresi üçüncü taraf "vekil" sitelere GÖNDERİLMEZ.
        throw new Error('Kaynak site, başka sitelerden doğrudan indirmeye izin vermiyor (CORS). Dosyayı indirip "Dosya > Bilgisayardan belge aç" ile açabilirsiniz; site sahibiyse Access-Control-Allow-Origin başlığını ekleyin.');
    }

    async function checkUrlParamsAndInit() {
        const remoteUrl = extractRemoteDocumentUrl();

        if (remoteUrl) {
            try {
                setStatus('Uzak UDF belgesi indiriliyor: ' + remoteUrl);
                showToast('Uzak bağlantıdan belge açılıyor...', 'info');

                const blob = await fetchRemoteDocumentWithFallbacks(remoteUrl);
                let fileName = 'indirilen_belge.udf';
                try {
                    const u = new URL(remoteUrl);
                    fileName = u.pathname.split('/').pop().split('?')[0] || fileName;
                } catch (e) {
                    fileName = remoteUrl.split('/').pop().split('?')[0] || fileName;
                }
                const suppliedTitle = new URLSearchParams(window.location.search).get('title');
                if (suppliedTitle) fileName = suppliedTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0,128);
                if (!fileName.toLowerCase().endsWith('.udf')) {
                    fileName += '.udf';
                }

                const file = new File([blob], fileName, { type: 'application/octet-stream' });
                await loadUdfFile(file);
                showToast(`"${fileName}" uzaktan başarıyla yüklendi.`, 'success');
                return;
            } catch (err) {
                console.error('Uzak dosya yüklenemedi:', err);
                setStatus('Hata');
                showToast('Uzak dosya yüklenemedi (CORS engeli olabilir): ' + err.message, 'error');
            }
        }

        // Eğer dosya yüklenmediyse ve ilk ziyaretse veya ?welcome=1 ise Sürüm Duyurusunu yükle
        const urlParams = new URLSearchParams(window.location.search);
        const visited = localStorage.getItem('uki-visited-v24');
        if (!visited || urlParams.get('welcome') === '1') {
            loadWhatsNewDocument();
            localStorage.setItem('uki-visited-v24', 'true');
        } else if (!editor.getContentHtml().trim() || editor.getContentHtml() === '<p><br></p>') {
            loadWhatsNewDocument();
        }
    }

    checkUrlParamsAndInit();
});
