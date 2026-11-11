/**
 * UkiOCR - Optik Karakter Tanıma ve Belge Tarayıcı Modülü
 * Taranmış adli evrakları, fotoğrafları, dilekçeleri ve ekran alıntılarını (PNG, JPG, TIFF, BMP, WebP)
 * tarayıcıda %100 yerel olarak okur, hukuki mizanpaj kurallarıyla UDF belgesine dönüştürür ve editörde açar.
 */
(function(window) {
    'use strict';

    let isTesseractLoaded = false;
    let tesseractWorker = null;
    let activeImageFile = null;
    let activeImageDataUrl = null;
    let isProcessing = false;

    /**
     * Tesseract.js kütüphanesini dinamik ve güvenli yükler (Yerel vendor veya CDN)
     */
    async function ensureTesseract() {
        if (window.Tesseract) {
            isTesseractLoaded = true;
            return true;
        }

        return new Promise((resolve) => {
            // Önce yerel vendor dosyasını dene
            const script = document.createElement('script');
            script.src = 'assets/vendor/tesseract.min.js';
            script.onload = () => {
                isTesseractLoaded = true;
                resolve(true);
            };
            script.onerror = () => {
                // Yerel dosya başarısız olursa CDN yedeğini çağır
                const cdnScript = document.createElement('script');
                cdnScript.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
                cdnScript.onload = () => {
                    isTesseractLoaded = true;
                    resolve(true);
                };
                cdnScript.onerror = () => {
                    console.error('Tesseract.js yüklenemedi.');
                    resolve(false);
                };
                document.head.appendChild(cdnScript);
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Taranmış belgenin kontrastını artırıp siyah-beyaz optimizasyonu yapar (Canvas)
     */
    function preprocessImage(imageElement, enhanceContrast = true) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const w = imageElement.naturalWidth || imageElement.width;
        const h = imageElement.naturalHeight || imageElement.height;
        if (!w || !h) throw new Error('Görsel henüz çözümlenmedi.');
        const scale = Math.min(2, 2600 / Math.max(w, h));
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
        if (!enhanceContrast) return canvas.toDataURL('image/png');

        try {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = imgData.data;

            // Gri tonlama ve kontrast gerdirme
            for (let i = 0; i < d.length; i += 4) {
                // Parlaklık hesabı
                const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                // Yüksek kontrast: hafif gri zeminleri beyaz yap, koyu yazıları siyahlaştır
                let adjusted = gray;
                if (adjusted > 185) {
                    adjusted = 255;
                } else if (adjusted < 110) {
                    adjusted = adjusted * 0.7;
                } else {
                    adjusted = ((adjusted - 110) / (185 - 110)) * 255;
                }

                d[i] = adjusted;
                d[i + 1] = adjusted;
                d[i + 2] = adjusted;
            }
            ctx.putImageData(imgData, 0, 0);
            return canvas.toDataURL('image/png');
        } catch (e) {
            console.warn('Canvas görüntü işleme kısıtlandı, orijinal görsel kullanılıyor:', e);
            return canvas.toDataURL('image/png');
        }
    }

    /**
     * Ham OCR metnini resmî UYAP belgesi yapısına dönüştürür
     */
    function structureOcrTextToUdfHtml(rawText) {
        if (!rawText) return '<p class="udf-p"><br></p>';

        const lines = rawText.replace(/\r\n/g, '\n').split('\n');
        let html = '';
        let currentPara = [];

        // Hukuki Başlık Kalıpları
        const COURT_HEADER_REGEX = /^(?:T\.?\s*C\.?|.*MAHKEMES[İI]|.*BAŞSAVCILIĞI|.*İCRA DA[İI]RES[İI]|.*DURUŞMA TUTANAĞI|.*GEREKÇEL[İI] KARAR|.*İDD[İI]ANAME|.*DAVA D[İI]LEKÇES[İI]|.*CEVAP D[İI]LEKÇES[İI]|.*B[İI]L[İI]RK[İI]Ş[İI] RAPORU)/i;
        const CASE_METADATA_REGEX = /^(?:ESAS NO|KARAR NO|SORUŞTURMA NO|DAVACI|DAVALI|VEKİLİ|ŞÜPHELİ|SANIK|MÜŞTEKİ|MAĞDUR|KATILAN|SUÇ|SUÇ TARİHİ|KONU|TEBLİĞ TARİHİ)\s*[:]/i;
        const DECISION_SECTION_REGEX = /^(?:HÜKÜM|GEREĞİ DÜŞÜNÜLDÜ|SONUÇ VE İSTEM|TALEP|AÇIKLAMALAR|HUKUKİ SEBEPLER|DELİLLER)\s*[:]?$/i;

        function flushParagraph() {
            if (currentPara.length === 0) return;
            const text = currentPara.join(' ').replace(/\s+/g, ' ').trim();
            currentPara = [];
            if (!text) return;

            // 1. Mahkeme ve Resmî Başlıklar (Ortalı ve 14pt Bold)
            if (COURT_HEADER_REGEX.test(text) && text.length < 80) {
                html += `<p class="udf-p" style="font-size: 14pt; font-weight: bold; text-align: center; margin: 10pt 0 4pt; font-family: 'Times New Roman', serif;">${escapeHtml(text)}</p>\n`;
                return;
            }

            // 2. Hüküm / Gerekçe / Dava Başlıkları (Ortalı veya Sola Dayalı Bold)
            if (DECISION_SECTION_REGEX.test(text)) {
                html += `<p class="udf-p" style="font-size: 12.5pt; font-weight: bold; text-align: center; text-decoration: underline; margin: 12pt 0 6pt; font-family: 'Times New Roman', serif;">${escapeHtml(text)}</p>\n`;
                return;
            }

            // 3. Taraf ve Dava Bilgileri (ESAS NO, DAVACI vb.)
            if (CASE_METADATA_REGEX.test(text)) {
                const parts = text.split(':');
                const label = parts[0] + ':';
                const val = parts.slice(1).join(':').trim();
                html += `<p class="udf-p" style="margin-bottom: 4pt; line-height: 1.2; font-family: 'Times New Roman', serif; font-size: 12pt;"><strong>${escapeHtml(label)}</strong> ${escapeHtml(val)}</p>\n`;
                return;
            }

            // 4. Standart UYAP Gövde Paragrafı (1 cm Girinti, İki Yana Yaslı)
            html += `<p class="udf-p" style="margin-bottom: 6pt; text-align: justify; text-indent: 28pt; line-height: 1.15; font-family: 'Times New Roman', serif; font-size: 12pt;">${escapeHtml(text)}</p>\n`;
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!line) {
                flushParagraph();
                continue;
            }

            // Başlık veya metaveri ise hemen paragrafı tamamla
            if (COURT_HEADER_REGEX.test(line) || CASE_METADATA_REGEX.test(line) || DECISION_SECTION_REGEX.test(line)) {
                flushParagraph();
                currentPara.push(line);
                flushParagraph();
                continue;
            }

            // Liste maddesi mi?
            if (/^[•\-\*]\s+/.test(line) || /^\d+[\.\)]\s+/.test(line)) {
                flushParagraph();
                html += `<p class="udf-p" style="margin-left: 28pt; text-indent: -14pt; margin-bottom: 3pt; font-family: 'Times New Roman', serif; font-size: 12pt;">${escapeHtml(line)}</p>\n`;
                continue;
            }

            currentPara.push(line);
            // Satır sonu nokta, soru işareti veya ünlemle bitiyorsa paragrafı bitir
            if (/[.:!?]$/.test(line)) {
                flushParagraph();
            }
        }

        flushParagraph();
        return html;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Görüntü üzerinde OCR İşlemini Başlatır
     */
    async function runOcr(imageSource, options = {}, progressCallback = null) {
        const loaded = await ensureTesseract();
        if (!loaded || !window.Tesseract) {
            throw new Error('Tesseract OCR kütüphanesi yüklenemedi. Lütfen internet bağlantınızı kontrol edin.');
        }

        const lang = options.lang || 'tur';
        if (progressCallback) progressCallback(5, 'OCR motoru başlatılıyor...');

        const worker = await window.Tesseract.createWorker(lang, 1, {
            workerPath: new URL('assets/vendor/ocr/worker.min.js', document.baseURI).href,
            corePath: new URL('assets/vendor/ocr/', document.baseURI).href,
            langPath: new URL('assets/vendor/ocr/', document.baseURI).href,
            gzip: false,
            logger: (m) => {
                if (progressCallback && m.status === 'recognizing text') {
                    const pct = Math.round((m.progress || 0) * 85) + 10;
                    progressCallback(pct, `Metin taranıyor: %${Math.round((m.progress || 0) * 100)}`);
                }
            }
        });

        if (progressCallback) progressCallback(15, 'Görüntü analiz ediliyor...');

        // Tanıma
        let result;
        try {
            await worker.setParameters({preserve_interword_spaces: '1', user_defined_dpi: '300'});
            result = await worker.recognize(imageSource, {}, {blocks: true, text: true, hocr: true});
            if (options.alternateSource && result.data.confidence < 90) {
                if (progressCallback) progressCallback(90, 'Özgün görselle karşılaştırılıyor…');
                const original = await worker.recognize(options.alternateSource, {}, {blocks:true,text:true,hocr:true});
                if (original.data.confidence > result.data.confidence) result = original;
            }
        } finally { await worker.terminate(); }

        if (progressCallback) progressCallback(98, 'Hukuki mizanpaj oluşturuluyor...');

        const rawText = result.data.text || '';
        const confidence = Math.round(result.data.confidence || 0);
        const structuredHtml = structureOcrLayout(result.data) || structureOcrTextToUdfHtml(rawText);

        if (progressCallback) progressCallback(100, 'Tamamlandı!');

        return {
            rawText: rawText,
            structuredHtml: structuredHtml,
            confidence: confidence,
            wordsCount: result.data.words ? result.data.words.length : 0
        };
    }

    function structureOcrLayout(data) {
        const paragraphs = (data.blocks || []).flatMap(b => b.paragraphs || []);
        const lines = paragraphs.flatMap(p => p.lines || []);
        if (!lines.length) return '';
        const heights = lines.map(l => l.bbox.y1-l.bbox.y0).filter(h => h > 0).sort((a,b) => a-b);
        const median = heights[Math.floor(heights.length/2)] || 16;
        const left = Math.min(...lines.map(l => l.bbox.x0));
        const right = Math.max(...lines.map(l => l.bbox.x1));
        const ratio = 12 / median;
        return paragraphs.map(p => {
            const words = (p.lines || []).flatMap(l => l.words || []);
            const box = p.bbox || (p.lines[0] || {}).bbox;
            if (!box || !words.length) return '';
            const center = Math.abs((box.x0+box.x1)-(left+right)) < (right-left)*.08 && box.x1-box.x0 < (right-left)*.85;
            const indent = Math.max(0, Math.min(100, (box.x0-left)*ratio));
            const body = words.map(w => {
                const size = Math.max(8, Math.min(24, (w.bbox.y1-w.bbox.y0)*ratio));
                const weight = w.is_bold || /bold/i.test(w.font_name || '') ? 'bold' : 'normal';
                const italic = w.is_italic || /italic/i.test(w.font_name || '') ? 'italic' : 'normal';
                return '<span style="font-size:'+size.toFixed(1)+'pt;font-weight:'+weight+';font-style:'+italic+'">'+escapeHtml(w.text)+'</span>';
            }).join(' ');
            return '<p class="udf-p" style="font-family:Times New Roman;font-size:12pt;margin:0 0 6pt;line-height:1.17;text-align:'+(center?'center':'left')+';margin-left:'+indent.toFixed(1)+'pt">'+body+'</p>';
        }).join('');
    }

    /**
     * OCR MODALI VE KULLANICI ARAYÜZÜ (OCR SCANNER DIALOG)
     */
    let ocrModalEl = null;
    let lastOcrResult = null;

    function createOcrModal() {
        if (ocrModalEl) return;
        ocrModalEl = document.createElement('div');
        ocrModalEl.id = 'modal-ocr-scanner';
        ocrModalEl.className = 'ax-modal-backdrop';
        ocrModalEl.style.display = 'none';

        ocrModalEl.innerHTML = `
            <div class="ax-modal-dialog" style="max-width: 820px;">
                <div class="ax-modal-header">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        <h3>Belge Tara &amp; OCR (Görselden UDF'e Dönüştürücü)</h3>
                    </div>
                    <button type="button" class="ax-modal-close" onclick="window.UkiOCR.closeModal()">&times;</button>
                </div>
                <div class="ax-modal-body" style="padding: 16px;">
                    <!-- Üst Bilgi Çubuğu -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="file" id="ocr-file-input" accept="image/*" style="display: none;">
                            <button type="button" class="tool-btn-primary" onclick="document.getElementById('ocr-file-input').click()">
                                📂 Belge / Görsel Seç
                            </button>
                            <span style="font-size: 11.5px; color: var(--ax-color-neutral-600);">PNG, JPG, TIFF, BMP, WebP veya Ekran Alıntısı (Ctrl+V)</span>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <label for="ocr-lang-select" style="font-size: 11.5px; font-weight: 600; color: var(--ax-color-neutral-700);">Tarama Dili:</label>
                            <select id="ocr-lang-select" class="tool-select" style="height: 28px; font-size: 11.5px;">
                                <option value="tur" selected>Türkçe (Hukuk &amp; Adli Metinler)</option>
                                <option value="tur+eng">Türkçe + İngilizce</option>
                                <option value="eng">İngilizce</option>
                            </select>
                            <label style="display: flex; align-items: center; gap: 4px; font-size: 11.5px; cursor: pointer;">
                                <input type="checkbox" id="ocr-enhance-contrast" checked>
                                <span>Kontrast İyileştirme</span>
                            </label>
                        </div>
                    </div>

                    <!-- İki Kolonlu Çalışma Alanı (Sol: Görsel Önizleme / Sağ: OCR Çıktısı) -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; min-height: 260px;">
                        <!-- Sol: Görsel Önizleme -->
                        <div style="border: 1px dashed var(--ax-border-default); border-radius: 8px; background: var(--ax-surface-subtle); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px; position: relative; overflow: hidden; min-height: 240px;" id="ocr-drop-zone">
                            <img id="ocr-preview-img" style="max-width: 100%; max-height: 240px; object-fit: contain; display: none; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" alt="Önizleme">
                            <div id="ocr-empty-hint" style="text-align: center; color: var(--ax-color-neutral-500); padding: 20px;">
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; opacity: 0.7;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                <p style="font-size: 12px; margin: 0 0 4px;">Bir görsel yükleyin veya buraya sürükleyin</p>
                                <span style="font-size: 10.5px; opacity: 0.8;">Ekran görüntüsü aldıysanız doğrudan <strong>Ctrl+V</strong> yapabilirsiniz</span>
                            </div>
                        </div>

                        <!-- Sağ: Metin & Mizanpaj Çıktısı -->
                        <div style="display: flex; flex-direction: column;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-size: 11.5px; font-weight: 600; color: var(--ax-color-neutral-700);">Tanınan Metin (biçim tahminidir, kontrol edin):</span>
                                <span id="ocr-confidence-badge" style="font-size: 10.5px; font-weight: 700; color: #166534; background: #dcfce7; padding: 1px 6px; border-radius: 10px; display: none;">%95 Güven</span>
                            </div>
                            <textarea id="ocr-result-text" rows="11" class="ax-input" style="width: 100%; flex: 1; text-align: left; font-family: 'Times New Roman', serif; font-size: 12px; padding: 8px; box-sizing: border-box; resize: none;" placeholder="Tarama başlatıldığında ayıklanan hukuki metin burada görünecektir..."></textarea>
                        </div>
                    </div>

                    <!-- İlerleme Çubuğu -->
                    <div id="ocr-progress-container" style="margin-top: 12px; display: none;">
                        <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 4px; color: var(--ax-color-neutral-700);">
                            <span id="ocr-progress-label">İşleniyor...</span>
                            <span id="ocr-progress-pct">0%</span>
                        </div>
                        <div style="width: 100%; height: 6px; background: var(--ax-surface-subtle); border-radius: 3px; overflow: hidden;">
                            <div id="ocr-progress-bar" style="width: 0%; height: 100%; background: #2563eb; transition: width 0.2s ease;"></div>
                        </div>
                    </div>
                </div>

                <div class="ax-modal-footer" style="justify-content: space-between;">
                    <div style="font-size: 11.5px; color: var(--ax-color-neutral-600); display: flex; align-items: center; gap: 6px;">
                        <span>🔒 <strong>%100 Yerel:</strong> Taranan görseller sunucuya aktarılmaz, cihazınızda işlenir.</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" id="btn-ocr-start" class="tool-btn-primary" style="display: none;">
                            ⚡ Taramayı Başlat (OCR)
                        </button>
                        <button type="button" id="btn-ocr-apply-editor" class="tool-btn-primary" style="display: none;">
                            Editörde UDF Olarak Aç
                        </button>
                        <button type="button" id="btn-ocr-download-udf" class="tool-btn-secondary" style="display: none;">
                            Doğrudan .udf İndir
                        </button>
                        <button type="button" id="btn-ocr-copy" class="tool-btn-secondary" style="display: none;">
                            Metni Kopyala
                        </button>
                        <button type="button" class="tool-btn-secondary" onclick="window.UkiOCR.closeModal()">Kapat</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(ocrModalEl);

        // Olay Dinleyicileri
        const fileInput = document.getElementById('ocr-file-input');
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleSelectedImage(e.target.files[0]);
            }
        });

        // Sürükle Bırak
        const dropZone = document.getElementById('ocr-drop-zone');
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#2563eb';
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.style.borderColor = 'var(--ax-border-default)';
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--ax-border-default)';
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleSelectedImage(e.dataTransfer.files[0]);
            }
        });

        // Pano Yapıştırma (Ctrl + V)
        window.addEventListener('paste', (e) => {
            if (ocrModalEl.style.display !== 'none' && e.clipboardData && e.clipboardData.items) {
                for (let i = 0; i < e.clipboardData.items.length; i++) {
                    const item = e.clipboardData.items[i];
                    if (item.type.indexOf('image') !== -1) {
                        const blob = item.getAsFile();
                        handleSelectedImage(blob);
                        break;
                    }
                }
            }
        });

        // Taramayı Başlat Butonu
        document.getElementById('btn-ocr-start').addEventListener('click', () => triggerOcrProcess());

        // Editörde Aç Butonu
        document.getElementById('btn-ocr-apply-editor').addEventListener('click', () => {
            if (!lastOcrResult || !lastOcrResult.structuredHtml) return;
            const name = activeImageFile ? activeImageFile.name.replace(/\.[^/.]+$/, '') : 'taranan_belge';
            const edited = document.getElementById('ocr-result-text').value;
            const html = edited === lastOcrResult.rawText ? lastOcrResult.structuredHtml : structureOcrTextToUdfHtml(edited);
            if (window.UkiApp && typeof window.UkiApp.replaceDocument === 'function') {
                window.UkiApp.replaceDocument(html, name + '_ocr', {source:'ocr'});
            }
            if (window.UkiPages) {
                if (typeof window.UkiPages.repaginate === 'function') window.UkiPages.repaginate();
                if (typeof window.UkiPages.updatePages === 'function') window.UkiPages.updatePages();
            }
            if (typeof window.recalculatePagesAndThumbnails === 'function') {
                window.recalculatePagesAndThumbnails();
            }
            closeModal();
            if (window.showToast) window.showToast('OCR ile taranan metin UDF şablonuna dönüştürüldü ve editöre aktarıldı.', 'success');
        });

        // UDF Olarak İndir Butonu
        document.getElementById('btn-ocr-download-udf').addEventListener('click', async () => {
            if (!lastOcrResult || !lastOcrResult.structuredHtml || !window.UkiCore) return;

            const tempDiv = document.createElement('div');
            const edited = document.getElementById('ocr-result-text').value;
            tempDiv.innerHTML = edited === lastOcrResult.rawText ? lastOcrResult.structuredHtml : structureOcrTextToUdfHtml(edited);

            try {
                const blob = await window.UkiCore.exportUdfBlob(tempDiv);
                const name = activeImageFile ? activeImageFile.name.replace(/\.[^/.]+$/, "") : "taranan_belge";
                const filename = `${name}_ocr.udf`;

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);

                if (window.showToast) window.showToast(`UDF belgesi "${filename}" olarak indirildi.`, 'success');
            } catch (err) {
                console.error('UDF indirme hatası:', err);
            }
        });

        // Kopyala Butonu
        document.getElementById('btn-ocr-copy').addEventListener('click', () => {
            const txt = document.getElementById('ocr-result-text').value;
            if (!txt) return;
            navigator.clipboard.writeText(txt).then(() => {
                if (window.showToast) window.showToast('Taranan metin panoya kopyalandı.', 'success');
            });
        });
    }

    function handleSelectedImage(file) {
        if (!file || (!file.type.startsWith('image/') && !file.name.match(/\.(png|jpe?g|bmp|tiff?|webp)$/i))) {
            if (window.showToast) window.showToast('Lütfen geçerli bir görsel dosyası seçin (PNG, JPG, TIFF, BMP).', 'warning');
            return;
        }

        activeImageFile = file;
        const reader = new FileReader();
        reader.onload = async (e) => {
            activeImageDataUrl = e.target.result;
            const previewImg = document.getElementById('ocr-preview-img');
            const emptyHint = document.getElementById('ocr-empty-hint');
            const btnStart = document.getElementById('btn-ocr-start');

            previewImg.src = activeImageDataUrl;
            previewImg.style.display = 'block';
            emptyHint.style.display = 'none';
            btnStart.style.display = 'inline-flex';

            // Resim decode edilmeden naturalWidth sıfır olabilir.
            try { await previewImg.decode(); await triggerOcrProcess(); }
            catch (err) { if (window.showToast) window.showToast('Görsel okunamadı: ' + err.message, 'error'); }
        };
        reader.readAsDataURL(file);
    }

    async function triggerOcrProcess() {
        if (!activeImageDataUrl || isProcessing) return;
        isProcessing = true;

        const progressContainer = document.getElementById('ocr-progress-container');
        const progressBar = document.getElementById('ocr-progress-bar');
        const progressLabel = document.getElementById('ocr-progress-label');
        const progressPct = document.getElementById('ocr-progress-pct');
        const btnStart = document.getElementById('btn-ocr-start');
        const btnApply = document.getElementById('btn-ocr-apply-editor');
        const btnDownload = document.getElementById('btn-ocr-download-udf');
        const btnCopy = document.getElementById('btn-ocr-copy');
        const confidenceBadge = document.getElementById('ocr-confidence-badge');
        const resultTextarea = document.getElementById('ocr-result-text');

        progressContainer.style.display = 'block';
        btnStart.style.display = 'none';
        btnApply.style.display = 'none';
        btnDownload.style.display = 'none';
        btnCopy.style.display = 'none';
        confidenceBadge.style.display = 'none';
        resultTextarea.value = 'Belge taranıyor, lütfen bekleyin...';

        const langSelect = document.getElementById('ocr-lang-select');
        const lang = langSelect ? langSelect.value : 'tur';
        const enhance = document.getElementById('ocr-enhance-contrast')?.checked ?? true;

        const previewImg = document.getElementById('ocr-preview-img');
        try {
            const processedImageSrc = preprocessImage(previewImg, enhance);
            const res = await runOcr(processedImageSrc, { lang: lang, alternateSource: enhance ? activeImageDataUrl : null }, (pct, label) => {
                progressBar.style.width = `${pct}%`;
                progressPct.textContent = `${pct}%`;
                progressLabel.textContent = label;
            });

            lastOcrResult = res;
            if (window.UkiStats) window.UkiStats.recordFeature('ocr');
            isProcessing = false;

            resultTextarea.value = res.rawText;
            confidenceBadge.textContent = `%${res.confidence} motor güveni`;
            confidenceBadge.style.display = 'inline-block';

            btnApply.style.display = 'inline-flex';
            btnDownload.style.display = 'inline-flex';
            btnCopy.style.display = 'inline-flex';

            if (window.showToast) {
                window.showToast(`OCR tamamlandı (%${res.confidence} motor güveni). UDF olarak açabilir veya indirebilirsiniz.`, 'success');
            }
        } catch (err) {
            isProcessing = false;
            console.error('OCR Hatası:', err);
            resultTextarea.value = `Tarama sırasında bir hata oluştu:\n${err.message}`;
            btnStart.style.display = 'inline-flex';
            if (window.showToast) {
                window.showToast('OCR işlemi sırasında hata oluştu: ' + err.message, 'error');
            }
        }
    }

    function openModal(imageFile = null) {
        createOcrModal();
        ocrModalEl.style.display = 'flex';
        if (imageFile) {
            handleSelectedImage(imageFile);
        }
    }

    function closeModal() {
        if (ocrModalEl) {
            ocrModalEl.style.display = 'none';
        }
    }

    window.UkiOCR = {
        openModal: openModal,
        closeModal: closeModal,
        runOcr: runOcr,
        structureOcrLayout,
        preprocessImage,
        structureOcrTextToUdfHtml: structureOcrTextToUdfHtml,
        handleSelectedImage: handleSelectedImage
    };

})(window);

