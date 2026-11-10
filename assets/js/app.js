/**
 * UYAP Kelime İşlemci (UKİ) - Ana Uygulama Mantığı (Web App Controller)
 */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const editorEl = document.getElementById('editor');
    const fileInput = document.getElementById('file-input');
    const docTitleInput = document.getElementById('doc-title');
    const signatureBadge = document.getElementById('signature-badge');

    // Durum Çubuğu Öğeleri
    const statPages = document.getElementById('stat-pages');
    const statWords = document.getElementById('stat-words');
    const statChars = document.getElementById('stat-chars');
    const statStatus = document.getElementById('stat-status');

    let currentFileName = 'adsiz_belge.udf';
    let isSignedDoc = false;

    // Editör Motoru Başlatma
    const editor = new UkiEditor(editorEl, {
        onStatsChange: (stats) => {
            if (statPages) statPages.textContent = `Sayfa: ${stats.pages}`;
            if (statWords) statWords.textContent = `Kelime: ${stats.words}`;
            if (statChars) statChars.textContent = `Karakter: ${stats.chars}`;
        }
    });

    // ----------------------------------------------------
    // KLAVYE KISAYOLLARI (SHORTCUTS)
    // ----------------------------------------------------
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            triggerSave();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
            e.preventDefault();
            fileInput.click();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
            e.preventDefault();
            window.print();
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

    // Yazı Tipi (Font Family)
    const fontSelect = document.getElementById('font-family-select');
    if (fontSelect) {
        fontSelect.addEventListener('change', () => {
            editor.setFontFamily(fontSelect.value);
        });
    }

    // Yazı Boyutu (Font Size)
    const sizeSelect = document.getElementById('font-size-select');
    if (sizeSelect) {
        sizeSelect.addEventListener('change', () => {
            editor.setFontSize(parseInt(sizeSelect.value, 10));
        });
    }

    // Renk Seçiciler
    const colorPicker = document.getElementById('text-color-picker');
    if (colorPicker) {
        colorPicker.addEventListener('input', () => {
            editor.setTextColor(colorPicker.value);
        });
    }

    // Yakınlaştırma (Zoom)
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

    // Sürükle ve Bırak Desteği
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

            // Başlık ayarla
            currentFileName = file.name;
            const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
            if (docTitleInput) docTitleInput.value = cleanTitle;

            // Marjinleri uygula
            if (udfModel.pageProperties) {
                const props = udfModel.pageProperties;
                editorEl.style.padding = `${props.topMargin}pt ${props.rightMargin}pt ${props.bottomMargin}pt ${props.leftMargin}pt`;
            }

            // HTML'e çevir ve editöre yükle
            const html = UkiCore.udfModelToHtml(udfModel);
            editor.setContentHtml(html);

            // E-İmza kontrolü
            isSignedDoc = udfModel.isSigned;
            if (signatureBadge) {
                if (isSignedDoc) {
                    signatureBadge.style.display = 'inline-flex';
                    signatureBadge.title = 'Bu belge orijinalinde e-imza taşımaktadır.';
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
            const blob = await UkiCore.exportUdfBlob(editorEl);

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
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }

    // ----------------------------------------------------
    // YENİ BELGE
    // ----------------------------------------------------
    const newBtn = document.getElementById('btn-new');
    if (newBtn) {
        newBtn.addEventListener('click', () => {
            if (confirm('Yeni bir belge açmak istediğinize emin misiniz? Kaydedilmemiş değişiklikler kaybolabilir.')) {
                editor.clear();
                if (docTitleInput) docTitleInput.value = 'Yeni Belge';
                currentFileName = 'Yeni Belge.udf';
                if (signatureBadge) signatureBadge.style.display = 'none';
                showToast('Yeni boş belge oluşturuldu.', 'info');
            }
        });
    }

    // ----------------------------------------------------
    // TABLO EKLEME
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
    // SAYFA SONU EKLEME
    // ----------------------------------------------------
    const pageBreakBtn = document.getElementById('btn-page-break');
    if (pageBreakBtn) {
        pageBreakBtn.addEventListener('click', () => {
            editor.insertPageBreak();
        });
    }

    // ----------------------------------------------------
    // HAZIR ŞABLONLAR & ÖRNEK BELGE
    // ----------------------------------------------------
    const templateSelect = document.getElementById('template-select');
    if (templateSelect) {
        templateSelect.addEventListener('change', async () => {
            const val = templateSelect.value;
            if (!val) return;

            if (val === 'ornek_karar') {
                // examples/örnek karar.udf dosyasını yükle
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

    // ----------------------------------------------------
    // YARDIMCI BİLDİRİM VE DURUM FONKSİYONLARI
    // ----------------------------------------------------
    function setStatus(text) {
        if (statStatus) statStatus.textContent = text;
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `uki-toast uki-toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // Başlangıçta örnek bir karşılama metni yükle
    if (!editor.getContentHtml().trim() || editor.getContentHtml() === '<p><br></p>') {
        editor.setContentHtml(`
            <p style="text-align: center;"><span style="font-weight: bold; font-size: 14pt; color: #1a365d;">UYAP WEB KELİME İŞLEMCİ</span></p>
            <p style="text-align: center;"><span style="font-size: 10pt; color: #4a5568;">Bağımsız, Açık Kaynak UDF (.udf) Doküman Editörü</span></p>
            <p style="text-align: center;"><br></p>
            <p style="text-align: justify; text-indent: 20px;">Bu web editörü, Adalet Bakanlığı UYAP sisteminde kullanılan <span style="font-weight: bold;">.udf</span> uzantılı dokümanları doğrudan tarayıcı üzerinden açmanızı, düzenlemenizi ve tekrar resmi standartlara uygun UDF formatında kaydetmenizi sağlar.</p>
            <p style="text-align: justify; text-indent: 20px;"><span style="font-weight: bold;">Özellikler:</span></p>
            <p style="text-align: left; margin-left: 20px;">• <span style="font-weight: bold;">Java veya Kurulum Gerektirmez:</span> 100% istemci tarafında (tarayıcınızda) çalışır.</p>
            <p style="text-align: left; margin-left: 20px;">• <span style="font-weight: bold;">Gizlilik Dostu:</span> Belgeleriniz hiçbir sunucuya yüklenmez, cihazınızda işlenir.</p>
            <p style="text-align: left; margin-left: 20px;">• <span style="font-weight: bold;">Sürükle & Bırak:</span> Bilgisayarınızdaki herhangi bir .udf dosyasını bu sayfaya sürükleyerek anında görüntüleyebilirsiniz.</p>
            <p style="text-align: left; margin-left: 20px;">• <span style="font-weight: bold;">Tam UDF Dışa Aktarma:</span> Yaptığınız değişiklikleri doğrudan <span style="font-style: italic;">UDF Kaydet</span> butonuyla UYAP uyumlu dosya olarak indirebilirsiniz.</p>
            <p style="text-align: left;"><br></p>
            <p style="text-align: right;"><span style="font-weight: bold; font-family: 'Times New Roman';">UYAP Web Editör Ekibi</span></p>
        `);
    }
});
