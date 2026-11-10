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
    const modalSignatures = document.getElementById('modal-signatures');
    const modalParaSetup = document.getElementById('modal-paragraph-setup');
    const modalFindReplace = document.getElementById('modal-find-replace');

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

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.ax-modal-backdrop').forEach(m => closeModal(m));
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            triggerSave();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
            e.preventDefault();
            fileInput.click();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
            e.preventDefault();
            window.print();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            openModal(modalFindReplace);
        }
    });

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
            updatePreviewBoxOrientation('landscape');
        } else {
            if (orientPortrait) orientPortrait.checked = true;
            updatePreviewBoxOrientation('portrait');
        }

        if (pageMediaSelect) pageMediaSelect.value = props.mediaSizeName || '1';
    }

    function updatePreviewBoxOrientation(orient) {
        if (!pagePreviewBox) return;
        if (orient === 'landscape') {
            pagePreviewBox.className = 'page-preview-box orientation-landscape';
        } else {
            pagePreviewBox.className = 'page-preview-box orientation-portrait';
        }
    }

    if (orientPortrait) orientPortrait.addEventListener('change', () => updatePreviewBoxOrientation('portrait'));
    if (orientLandscape) orientLandscape.addEventListener('change', () => updatePreviewBoxOrientation('landscape'));

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

    function applyPagePropertiesToView(props) {
        if (!props) return;

        // Kağıt yönelimi (Dikey: 595pt x 842pt, Yatay: 842pt x 595pt)
        if (props.paperOrientation === 2) {
            editorEl.classList.add('orientation-landscape');
        } else {
            editorEl.classList.remove('orientation-landscape');
        }

        // Marjinleri doğrudan pt cinsinden padding olarak uygula
        editorEl.style.padding = `${props.topMargin}pt ${props.rightMargin}pt ${props.bottomMargin}pt ${props.leftMargin}pt`;

        // Durum çubuğunu güncelle
        if (statMarginsInfo) {
            statMarginsInfo.textContent = `Boşluklar: Sol ${props.leftMarginCm} cm, Sağ ${props.rightMarginCm} cm, Üst ${props.topMarginCm} cm, Alt ${props.bottomMarginCm} cm`;
        }
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

        const props = currentDocModel.docProperties || {};
        if (koduEl) koduEl.textContent = props.uyapdogrulamakodu || 'Mevcut';
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
    // PARAGRAF DÜZENLEME MODALI
    // ----------------------------------------------------
    const btnParaSetup = document.getElementById('btn-para-setup');
    if (btnParaSetup) {
        btnParaSetup.addEventListener('click', () => openModal(modalParaSetup));
    }

    const btnParaSave = document.getElementById('btn-para-save');
    if (btnParaSave) {
        btnParaSave.addEventListener('click', () => {
            const spacing = document.getElementById('para-line-spacing').value;
            const indent = document.getElementById('para-first-indent').value;
            const above = document.getElementById('para-space-above').value;
            const below = document.getElementById('para-space-below').value;

            // Seçili veya tüm paragraflara uygula
            const selection = window.getSelection();
            let targetP = null;
            if (selection.rangeCount > 0) {
                const node = selection.getRangeAt(0).startContainer;
                targetP = node.nodeType === Node.ELEMENT_NODE ? node.closest('p') : node.parentElement.closest('p');
            }

            if (targetP && targetP.parentElement === editorEl) {
                applyParaStyles(targetP, spacing, indent, above, below);
                showToast('Seçili paragraf güncellendi.', 'success');
            } else {
                // Seçim yoksa editördeki tüm paragraflara uygula
                editorEl.querySelectorAll('p').forEach(p => applyParaStyles(p, spacing, indent, above, below));
                showToast('Tüm paragraflar güncellendi.', 'success');
            }

            closeModal(modalParaSetup);
        });
    }

    function applyParaStyles(p, spacing, indent, above, below) {
        p.style.lineHeight = spacing;
        p.style.textIndent = `${indent}pt`;
        p.style.marginTop = `${above}pt`;
        p.style.marginBottom = `${below}pt`;
    }

    // ----------------------------------------------------
    // BUL VE DEĞİŞTİR
    // ----------------------------------------------------
    const btnFindReplace = document.getElementById('btn-find-replace');
    if (btnFindReplace) {
        btnFindReplace.addEventListener('click', () => openModal(modalFindReplace));
    }

    const btnFindNext = document.getElementById('btn-find-next');
    const findInput = document.getElementById('find-input');
    const replaceInput = document.getElementById('replace-input');

    if (btnFindNext) {
        btnFindNext.addEventListener('click', () => {
            const query = findInput.value;
            if (!query) return;
            if (window.find) {
                const found = window.find(query, false, false, true, false, false, false);
                if (!found) showToast('Arama sonuna ulaşıldı.', 'info');
            }
        });
    }

    const btnReplaceAll = document.getElementById('btn-replace-all');
    if (btnReplaceAll) {
        btnReplaceAll.addEventListener('click', () => {
            const q = findInput.value;
            const r = replaceInput.value;
            if (!q) return;

            const text = editorEl.innerHTML;
            const regex = new RegExp(escapeRegExp(q), 'g');
            editorEl.innerHTML = text.replace(regex, r);
            showToast(`"${q}" değerleri "${r}" ile değiştirildi.`, 'success');
            closeModal(modalFindReplace);
        });
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        await loadUdfFile(file);
        fileInput.value = '';
    });

    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.name.toLowerCase().endsWith('.udf')) {
                await loadUdfFile(file);
            } else {
                showToast('Lütfen sadece .udf uzantılı UYAP dokümanı bırakın.', 'warning');
            }
        }
    });

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

            // E-İmza kontrolü ve rozeti
            if (signatureBadge) {
                if (udfModel.isSigned) {
                    const count = udfModel.signatures.length || 1;
                    signatureBadge.style.display = 'inline-flex';
                    if (signatureBadgeText) signatureBadgeText.textContent = `E-İmzalı (${count})`;
                } else {
                    signatureBadge.style.display = 'none';
                }
            }

            setStatus('Hazır');
            showToast(`"${file.name}" başarıyla açıldı.`, 'success');
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

    async function triggerSave() {
        try {
            setStatus('UDF oluşturuluyor...');
            const pageProps = currentDocModel ? currentDocModel.pageProperties : {};
            const origZip = currentDocModel ? currentDocModel.zipInstance : null;

            const blob = await UkiCore.exportUdfBlob(editorEl, pageProps, origZip);

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

            setStatus('Kaydedildi');
            showToast(`"${filename}" başarıyla indirildi.`, 'success');
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
        printBtn.addEventListener('click', () => window.print());
    }

    // ----------------------------------------------------
    // YENİ BELGE
    // ----------------------------------------------------
    const newBtn = document.getElementById('btn-new');
    if (newBtn) {
        newBtn.addEventListener('click', () => {
            if (confirm('Yeni bir belge açmak istediğinize emin misiniz?')) {
                editor.clear();
                if (docTitleInput) docTitleInput.value = 'Yeni Belge';
                currentFileName = 'Yeni Belge.udf';
                currentDocModel = null;
                if (signatureBadge) signatureBadge.style.display = 'none';
                showToast('Yeni boş belge oluşturuldu.', 'info');
            }
        });
    }

    // ----------------------------------------------------
    // TABLO İŞLEMLERİ
    // ----------------------------------------------------
    const insertTableBtn = document.getElementById('btn-insert-table');
    if (insertTableBtn) {
        insertTableBtn.addEventListener('click', () => {
            const rows = prompt('Satır sayısı:', '3');
            if (!rows) return;
            const cols = prompt('Sütun sayısı:', '3');
            if (!cols) return;
            editor.insertTable(parseInt(rows, 10) || 3, parseInt(cols, 10) || 3);
        });
    }

    // ----------------------------------------------------
    // ŞABLONLAR VE HIZLI TEST
    // ----------------------------------------------------
    const templateSelect = document.getElementById('template-select');
    if (templateSelect) {
        templateSelect.addEventListener('change', async () => {
            const val = templateSelect.value;
            if (!val) return;

            if (val === 'ornek_karar') {
                try {
                    setStatus('Örnek karar yükleniyor...');
                    const resp = await fetch('examples/örnek karar.udf');
                    if (!resp.ok) throw new Error('Örnek dosya okunamadı: ' + resp.statusText);
                    const blob = await resp.blob();
                    const file = new File([blob], 'örnek karar.udf', { type: 'application/octet-stream' });
                    await loadUdfFile(file);
                } catch (e) {
                    showToast('Örnek dosya yüklenemedi: ' + e.message, 'error');
                }
            } else {
                loadTemplate(val);
            }
            templateSelect.value = '';
        });
    }

    function loadTemplate(type) {
        if (!confirm('Seçilen şablon yüklenecek, devam edilsin mi?')) return;
        let content = '';
        if (type === 'dilekce') {
            content = `
                <p style="text-align: center;"><span style="font-weight: bold; font-size: 13pt;">KURUM / MAHKEME BAŞKANLIĞI'NA</span></p>
                <p style="text-align: center;"><br></p>
                <p style="text-align: left;"><span style="font-weight: bold;">TALEP EDEN:</span> Ad Soyad</p>
                <p style="text-align: left;"><span style="font-weight: bold;">VEKİLİ:</span> Av. Ad Soyad</p>
                <p style="text-align: left;"><span style="font-weight: bold;">KONU:</span> Genel talep ve açıklamalardan ibarettir.</p>
                <p style="text-align: left;"><br></p>
                <p style="text-align: justify; text-indent: 20px;">Açıklamalar ve talep maddeleri buraya yazılacaktır.</p>
                <p style="text-align: right;"><br><span style="font-weight: bold;">İsim Soyisim</span><br>İmza</p>
            `;
            if (docTitleInput) docTitleInput.value = 'Ornek_Dilekce';
        } else if (type === 'bilirkisi') {
            content = `
                <p style="text-align: center;"><span style="font-weight: bold; font-size: 13pt;">İLGİLİ BİRİM / MAHKEME HAKİMLİĞİ'NE</span></p>
                <p style="text-align: center;"><br></p>
                <p style="text-align: left;"><span style="font-weight: bold;">DOSYA NO:</span> 2026/001</p>
                <p style="text-align: left;"><span style="font-weight: bold;">UZMAN / BİLİRKİŞİ:</span> Ad Soyad</p>
                <p style="text-align: left;"><span style="font-weight: bold;">KONU:</span> İnceleme Raporu</p>
                <p style="text-align: left;"><br></p>
                <p style="text-align: justify; text-indent: 20px;">İnceleme neticesinde elde edilen tespitler burada yer alacaktır.</p>
                <p style="text-align: right;"><br><span style="font-weight: bold;">Uzman / Raportör</span><br>Ad Soyad</p>
            `;
            if (docTitleInput) docTitleInput.value = 'Ornek_Rapor';
        }

        editor.setContentHtml(content);
        showToast('Şablon yüklendi.', 'success');
    }

    function setStatus(text) {
        if (statStatus) statStatus.textContent = text;
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `uki-toast uki-toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // Başlangıç Karşılama Metni
    if (!editor.getContentHtml().trim() || editor.getContentHtml() === '<p><br></p>') {
        editor.setContentHtml(`
            <p style="text-align: center;"><span style="font-weight: bold; font-size: 14pt; color: #1a365d;">UYAP WEB KELİME İŞLEMCİ</span></p>
            <p style="text-align: center;"><span style="font-size: 10pt; color: #4a5568;">Bağımsız, Açık Kaynak UDF (.udf) Doküman Editörü</span></p>
            <p style="text-align: center;"><br></p>
            <p style="text-align: justify; text-indent: 20px;">Bu web editörü, Adalet Bakanlığı UYAP sisteminde kullanılan <span style="font-weight: bold;">.udf</span> uzantılı dokümanları doğrudan tarayıcı üzerinden açmanızı, düzenlemenizi ve tekrar resmi standartlara uygun UDF formatında kaydetmenizi sağlar.</p>
            <p style="text-align: justify; text-indent: 20px;"><span style="font-weight: bold;">Özellikler:</span></p>
            <p style="text-align: left; margin-left: 20px;">• <span style="font-weight: bold;">Sayfa Düzenleme & Kenar Boşlukları:</span> Resmî UYAP editöründeki gibi Sol, Sağ, Üst, Alt marjinlerini cm bazında ayarlayabilirsiniz.</p>
            <p style="text-align: left; margin-left: 20px;">• <span style="font-weight: bold;">Elektronik İmza İnceleme:</span> Belgedeki tüm e-imza sahiplerini, sertifika kurumlarını (Kamu SM) ve zaman damgalarını detaylı görebilirsiniz.</p>
            <p style="text-align: left; margin-left: 20px;">• <span style="font-weight: bold;">Sürükle & Bırak:</span> Bilgisayarınızdaki herhangi bir .udf dosyasını bu sayfaya sürükleyerek anında görüntüleyebilirsiniz.</p>
            <p style="text-align: left;"><br></p>
            <p style="text-align: right;"><span style="font-weight: bold; font-family: 'Times New Roman';">UYAP Web Editör Ekibi</span></p>
        `);
    }
});
