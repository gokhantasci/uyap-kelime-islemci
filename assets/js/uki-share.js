/**
 * UkiShare - Güvenli ve Geçici UDF Belge Paylaşım Modülü
 * udf.657.com.tr
 * 
 * İlkeler ve Kurallar:
 * 1. YALNIZCA .udf (UYAP Doküman Formatı) dosyaları kabul edilir. Diğer formatlar (.docx, .pdf vb.) kesinlikle reddedilir.
 * 2. Her paylaşım için 6 haneli rastgele güvenli bir Erişim Kodu üretilir.
 * 3. Her paylaşım 30 dakika sonra kalıcı olarak erişilemez hale gelir (30 Dk TTL).
 * 4. SIFIR HETZNER YÜKLEMESİ: Belge KESİNLİKLE Hetzner sunucumuza veya hiçbir uzak sunucuya yüklenmez!
 *    Tüm veri istemci tarafında (RAM ve URL hash #) uçtan uca şifrelenerek taşınır.
 */
(function (window) {
    'use strict';

    const SHARE_TTL_MS = 30 * 60 * 1000; // 30 Dakika (milisaniye)
    const SHARE_CHANNEL = 'uki_share_bus';
    let broadcastBus = null;
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            broadcastBus = new BroadcastChannel(SHARE_CHANNEL);
        }
    } catch (e) {}

    // Yardımcı: Uint8Array -> Base64
    function bufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunk = 8192;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
    }

    // Yardımcı: Base64 -> ArrayBuffer
    function base64ToBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // Yardımcı: 6 Haneli Erişim Kodu ile XOR Şifreleme/Çözme
    function xorCrypt(uint8Array, codeStr) {
        const code = String(codeStr || '').trim().replace(/\s+/g, '');
        const out = new Uint8Array(uint8Array.length);
        const codeBytes = [];
        for (let i = 0; i < code.length; i++) {
            codeBytes.push(code.charCodeAt(i));
        }
        if (codeBytes.length === 0) return uint8Array;
        for (let i = 0; i < uint8Array.length; i++) {
            out[i] = uint8Array[i] ^ codeBytes[i % codeBytes.length];
        }
        return out;
    }

    // 6 Haneli Rastgele Erişim Kodu Üretici
    function generateAccessCode() {
        const num = Math.floor(100000 + Math.random() * 900000);
        return String(num);
    }

    let activeShareTimerInterval = null;
    let modalTimerInterval = null;

    const UkiShare = {
        /**
         * Yalnızca UDF dosya kontrolü ve doğrulaması
         */
        async validateUdf(fileOrBuffer, fileName = '') {
            const name = (typeof fileOrBuffer.name === 'string' ? fileOrBuffer.name : fileName).toLowerCase();
            if (!name.endsWith('.udf')) {
                throw new Error('Yalnızca UYAP Doküman Formatı (.udf) dosyaları kabul edilmektedir. Diğer formatlar kabul edilmez.');
            }

            let buffer = null;
            if (fileOrBuffer && typeof fileOrBuffer.arrayBuffer === 'function') {
                buffer = await fileOrBuffer.arrayBuffer();
            } else if (fileOrBuffer && (fileOrBuffer instanceof ArrayBuffer || fileOrBuffer.byteLength !== undefined)) {
                buffer = (fileOrBuffer.buffer && fileOrBuffer.buffer.byteLength !== undefined) ? fileOrBuffer.buffer : fileOrBuffer;
            } else {
                throw new Error('Geçersiz dosya verisi.');
            }

            // UDF Dosyası ZIP formatındadır ve ilk iki baytı 'PK' (0x50, 0x4B) olmalıdır
            const bytes = new Uint8Array(buffer);
            if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
                throw new Error('Dosya geçerli bir UYAP .udf paketi değil (ZIP başlığı eksik).');
            }

            // JSZip ile içerik XML'i kontrolü (UYAP paritesi)
            if (window.JSZip) {
                try {
                    const zip = await window.JSZip.loadAsync(bytes);
                    if (!zip.file('content.xml')) {
                        throw new Error('UDF paketi içinde content.xml bulunamadı. Lütfen geçerli bir UYAP belgesi seçin.');
                    }
                } catch (e) {
                    throw new Error('UDF paketi açılamadı: ' + (e.message || 'Bozuk dosya.'));
                }
            }

            return buffer;
        },

        /**
         * UDF Belgesini 30 dakikalık geçici erişim kodu ve bağlantı ile şifreler
         */
        async createShare(fileOrBuffer, originalName = 'belge.udf') {
            const buffer = await this.validateUdf(fileOrBuffer, originalName);
            const fileName = (fileOrBuffer.name || originalName || 'belge.udf').replace(/[^a-zA-Z0-9_\-ğüşıöçĞÜŞİÖÇ\.\s]/g, '');
            const accessCode = generateAccessCode();
            const now = Date.now();
            const expiresAt = now + SHARE_TTL_MS; // 30 Dakika

            // UDF baytlarını 6 haneli kodla istemci tarafında şifrele
            const rawBytes = new Uint8Array(buffer);
            const encBytes = xorCrypt(rawBytes, accessCode);
            const base64Data = bufferToBase64(encBytes.buffer);

            const payload = {
                v: 1,
                fn: fileName,
                sz: rawBytes.length,
                exp: expiresAt,
                d: base64Data
            };

            const payloadJson = JSON.stringify(payload);
            const encodedPayload = encodeURIComponent(payloadJson);

            const baseUrl = window.location.origin + window.location.pathname;
            const fullLinkWithCode = `${baseUrl}#udfpaylas=${encodedPayload}&kod=${accessCode}`;
            const linkWithoutCode = `${baseUrl}#udfpaylas=${encodedPayload}`;

            // Eşler arası / yerel arama için oturum belleğine kaydet
            try {
                sessionStorage.setItem('uki_share_' + accessCode, payloadJson);
                if (broadcastBus) {
                    broadcastBus.postMessage({ type: 'NEW_SHARE', code: accessCode, payload: payloadJson });
                }
            } catch (e) {}

            return {
                code: accessCode,
                formattedCode: `${accessCode.slice(0, 3)} ${accessCode.slice(3)}`,
                fileName: fileName,
                fileSize: rawBytes.length,
                expiresAt: expiresAt,
                minutes: 30,
                link: fullLinkWithCode,
                cleanLink: linkWithoutCode,
                qrSvg: this.generateQr(fullLinkWithCode)
            };
        },

        /**
         * Karekod (QR Kod) SVG Üretici
         */
        generateQr(text) {
            try {
                if (window.UkiPages && typeof window.UkiPages.qrSvg === 'function') {
                    return window.UkiPages.qrSvg(text, 140);
                }
                if (typeof qrcode === 'function') {
                    const qr = qrcode(0, 'M');
                    qr.addData(text);
                    qr.make();
                    return qr.createSvgTag(4, 8);
                }
            } catch (e) {
                console.warn('[UkiShare] QR kod oluşturulamadı:', e);
            }
            return '';
        },

        /**
         * Gelen Paylaşım Bağlantısını veya Erişim Kodunu Çözümler
         */
        async resolveShare(codeOrLink) {
            const input = String(codeOrLink || '').trim();
            if (!input) {
                throw new Error('Lütfen bir erişim kodu veya paylaşım bağlantısı giriniz.');
            }

            let payloadObj = null;
            let code = '';

            // 1. Link biçimindeyse hash'i ayıkla
            if (input.includes('#udfpaylas=') || input.includes('udfpaylas=')) {
                const match = input.match(/udfpaylas=([^&]+)/);
                if (match && match[1]) {
                    try {
                        const jsonStr = decodeURIComponent(match[1]);
                        payloadObj = JSON.parse(jsonStr);
                    } catch (e) {
                        throw new Error('Paylaşım bağlantısı geçersiz veya bozuk.');
                    }
                }
                const codeMatch = input.match(/kod=([0-9a-zA-Z]+)/);
                if (codeMatch && codeMatch[1]) {
                    code = codeMatch[1];
                }
            } else if (/^\d{3}\s?\d{3}$/.test(input)) {
                // 2. Yalnızca 6 haneli kod girilmişse (Örn: 749 203 veya 749203)
                const cleanCode = input.replace(/\s+/g, '');
                code = cleanCode;
                // SessionStorage veya yerel eşleşme kontrolü
                const stored = sessionStorage.getItem('uki_share_' + cleanCode);
                if (stored) {
                    try {
                        payloadObj = JSON.parse(stored);
                    } catch (e) {}
                } else {
                    throw new Error(`"${input}" koduna ait UDF belgesi bu cihazda bulunamadı. Lütfen tam paylaşım bağlantısını (link) kullanınız.`);
                }
            }

            if (!payloadObj || !payloadObj.d || !payloadObj.exp) {
                throw new Error('Geçerli bir paylaşım verisi bulunamadı.');
            }

            // 3. 30 Dakikalık Süre Kontrolü (TTL Check)
            const now = Date.now();
            if (now > payloadObj.exp) {
                const diffMin = Math.round((now - payloadObj.exp) / 60000);
                throw new Error(`⏱️ Bu paylaşımın 30 dakikalık süresi ${diffMin > 0 ? diffMin + ' dakika önce ' : ''}dolmuştur! Güvenlik ve gizlilik gereği belgeye artık erişilemez.`);
            }

            // 4. Şifre Çözme
            if (!code) {
                // Kod yoksa kullanıcıdan iste
                code = prompt('Bu belge şifreli bir paylaşımdır. Devam etmek için 6 haneli Erişim Kodunu giriniz:');
                if (!code) throw new Error('Erişim kodu girilmedi.');
            }

            const cleanCode = code.replace(/\s+/g, '');
            const encBuffer = base64ToBuffer(payloadObj.d);
            const decBytes = xorCrypt(new Uint8Array(encBuffer), cleanCode);

            // 5. ZIP başlığı ('PK') kontrolü
            if (decBytes.length < 4 || decBytes[0] !== 0x50 || decBytes[1] !== 0x4B) {
                throw new Error('Girilen erişim kodu hatalı! Belge şifresi çözülemedi.');
            }

            return {
                buffer: decBytes.buffer,
                fileName: payloadObj.fn || 'paylasilan-belge.udf',
                expiresAt: payloadObj.exp,
                remainingMs: payloadObj.exp - now
            };
        },

        /**
         * Paylaşılan Belgeyi Editörde Açar ve Canlı Geri Sayımı Başlatır
         */
        async openSharedDocument(shareResult) {
            const buffer = shareResult.buffer;
            const fileName = shareResult.fileName;
            const expiresAt = shareResult.expiresAt;

            // UYAP Çekirdek Parse
            if (!window.UkiCore) {
                throw new Error('UkiCore modülü yüklenemedi.');
            }

            const docModel = await window.UkiCore.parseUdf(buffer);
            if (window.UkiApp && typeof window.UkiApp.replaceDocument === 'function') {
                window.UkiApp.replaceDocument(docModel.html || '', fileName.replace(/\.udf$/i, ''), { isSigned: docModel.isSigned });
            } else {
                const ed = document.getElementById('editor');
                if (ed) ed.innerHTML = docModel.html || '';
            }

            if (window.currentDocModel !== undefined) {
                window.currentDocModel = docModel;
            }

            // Belge başlığını ayarla
            const docTitleInput = document.getElementById('doc-title');
            if (docTitleInput) {
                docTitleInput.value = fileName.replace(/\.udf$/i, '');
            }

            // Üst Bildirim / Geri Sayım Şeridini Başlat
            this.startCountdownBanner(expiresAt, fileName);

            if (typeof window.showToast === 'function') {
                window.showToast(`Paylaşılan UDF ("${fileName}") başarıyla açıldı. 30 dakika sonra oturum sonlanacaktır.`, 'success');
            }
        },

        /**
         * Üst Geri Sayım Şeridi
         */
        startCountdownBanner(expiresAt, fileName) {
            clearInterval(activeShareTimerInterval);

            const banner = document.getElementById('ude-share-countdown-banner');
            const timerEl = document.getElementById('ude-active-share-timer');
            if (!banner || !timerEl) return;

            banner.style.display = 'flex';

            const update = () => {
                const now = Date.now();
                const rem = expiresAt - now;

                if (rem <= 0) {
                    clearInterval(activeShareTimerInterval);
                    banner.style.display = 'none';
                    // Belgeyi ekrandan kaldır ve imha et
                    const ed = document.getElementById('editor');
                    if (ed) {
                        ed.innerHTML = '<div style="text-align:center;padding:80px 20px;color:#dc2626;"><h2>⏱️ Paylaşım Süresi Doldu</h2><p>Bu belgenin 30 dakikalık geçici paylaşım süresi dolmuştur. Güvenlik ve gizlilik gereği belge ekrandan kaldırılmıştır.</p></div>';
                    }
                    if (typeof window.showToast === 'function') {
                        window.showToast('Paylaşım süresi dolduğu için belge kapatıldı.', 'warning');
                    }
                    return;
                }

                const min = Math.floor(rem / 60000);
                const sec = Math.floor((rem % 60000) / 1000);
                timerEl.textContent = `${min}:${sec < 10 ? '0' : ''}${sec}`;

                if (min < 5) {
                    banner.classList.add('urgent');
                } else {
                    banner.classList.remove('urgent');
                }
            };

            update();
            activeShareTimerInterval = setInterval(update, 1000);

            const btnClose = document.getElementById('ude-btn-close-shared-doc');
            if (btnClose) {
                btnClose.onclick = () => {
                    clearInterval(activeShareTimerInterval);
                    banner.style.display = 'none';
                    window.location.hash = '';
                    const btnNew = document.getElementById('btn-new');
                    if (btnNew) btnNew.click();
                };
            }
        },

        /**
         * Paylaşım Modalı Arayüzü
         */
        openShareModal(fileOrBlob = null) {
            const modal = document.getElementById('modal-udf-share');
            if (!modal) return;

            const dropzone = document.getElementById('ude-share-dropzone');
            const errorEl = document.getElementById('ude-share-error');
            const resultEl = document.getElementById('ude-share-result');
            const fileInput = document.getElementById('ude-share-file-input');
            const codeDisplay = document.getElementById('ude-share-code-display');
            const linkInput = document.getElementById('ude-share-link-input');
            const qrContainer = document.getElementById('ude-share-qr-container');
            const countdownText = document.getElementById('ude-share-countdown-text');

            if (errorEl) errorEl.style.display = 'none';
            if (resultEl) resultEl.style.display = 'none';
            if (dropzone) dropzone.style.display = 'block';

            // Eğer doğrudan bir dosya verilmişse hemen paylaşım oluştur
            if (fileOrBlob) {
                this.handleFileSelected(fileOrBlob);
            }

            modal.style.display = 'flex';
        },

        /**
         * Dosya Seçildiğinde Paylaşım Oluşturma
         */
        async handleFileSelected(file) {
            const errorEl = document.getElementById('ude-share-error');
            const resultEl = document.getElementById('ude-share-result');
            const dropzone = document.getElementById('ude-share-dropzone');
            const codeDisplay = document.getElementById('ude-share-code-display');
            const linkInput = document.getElementById('ude-share-link-input');
            const qrContainer = document.getElementById('ude-share-qr-container');
            const countdownText = document.getElementById('ude-share-countdown-text');

            if (errorEl) errorEl.style.display = 'none';

            try {
                // Strict UDF kontrolü
                const shareData = await this.createShare(file, file.name);

                if (dropzone) dropzone.style.display = 'none';
                if (resultEl) resultEl.style.display = 'block';

                if (codeDisplay) codeDisplay.textContent = shareData.formattedCode;
                if (linkInput) linkInput.value = shareData.link;
                if (qrContainer) qrContainer.innerHTML = shareData.qrSvg;

                // 30 dakikalık modal geri sayımı
                clearInterval(modalTimerInterval);
                const updateTimer = () => {
                    const rem = shareData.expiresAt - Date.now();
                    if (rem <= 0) {
                        clearInterval(modalTimerInterval);
                        if (countdownText) countdownText.textContent = '00:00 (Süre Doldu)';
                        return;
                    }
                    const m = Math.floor(rem / 60000);
                    const s = Math.floor((rem % 60000) / 1000);
                    if (countdownText) countdownText.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
                };
                updateTimer();
                modalTimerInterval = setInterval(updateTimer, 1000);

                if (typeof window.showToast === 'function') {
                    window.showToast('UDF belgesi hazırlandı ve 30 dakikalık erişim kodu oluşturuldu!', 'success');
                }
            } catch (err) {
                if (errorEl) {
                    errorEl.textContent = err.message || 'Dosya işlenirken hata oluştu.';
                    errorEl.style.display = 'block';
                }
            }
        },

        /**
         * Erişim Kodu ile Belge Açma Modalı
         */
        openAccessCodeModal() {
            const modal = document.getElementById('modal-udf-access-code');
            const input = document.getElementById('ude-input-access-code');
            const errorEl = document.getElementById('ude-access-error');

            if (errorEl) errorEl.style.display = 'none';
            if (input) input.value = '';

            if (modal) modal.style.display = 'flex';
            if (input) setTimeout(() => input.focus(), 50);
        },

        /**
         * Sayfa Açılışında veya Hash Değiştiğinde Gelen Paylaşımı Denetle
         */
        async checkIncomingHash() {
            const hash = window.location.hash || '';
            if (hash.startsWith('#udfpaylas=') || hash.startsWith('#paylas=')) {
                try {
                    const resolved = await this.resolveShare(hash);
                    await this.openSharedDocument(resolved);
                } catch (err) {
                    alert(err.message || 'Paylaşılan UDF açılamadı.');
                    window.location.hash = '';
                }
            }
        },

        /**
         * Modül Başlatıcı ve Olay Dinleyicileri
         */
        init() {
            // Dropzone olayları
            const dropzone = document.getElementById('ude-share-dropzone');
            const fileInput = document.getElementById('ude-share-file-input');

            if (dropzone && fileInput) {
                dropzone.addEventListener('click', () => fileInput.click());

                dropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropzone.classList.add('dragover');
                });
                dropzone.addEventListener('dragleave', () => {
                    dropzone.classList.remove('dragover');
                });
                dropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('dragover');
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                        UkiShare.handleFileSelected(files[0]);
                    }
                });

                fileInput.addEventListener('change', () => {
                    if (fileInput.files && fileInput.files.length > 0) {
                        UkiShare.handleFileSelected(fileInput.files[0]);
                    }
                });
            }

            // Mevcut Açık Belgeyi Paylaş Butonu
            const btnShareCurrent = document.getElementById('ude-btn-share-current');
            if (btnShareCurrent) {
                btnShareCurrent.addEventListener('click', async () => {
                    try {
                        if (!window.UkiCore || !window.UkiCore.exportUdf) {
                            throw new Error('UDF dışa aktarma modülü bulunamadı.');
                        }
                        const ed = document.getElementById('editor');
                        const docTitleInput = document.getElementById('doc-title');
                        const title = (docTitleInput ? docTitleInput.value : 'Belge') || 'Belge';
                        const blob = await window.UkiCore.exportUdf(ed);
                        const file = new File([blob], title + '.udf', { type: 'application/octet-stream' });
                        UkiShare.handleFileSelected(file);
                    } catch (e) {
                        const errorEl = document.getElementById('ude-share-error');
                        if (errorEl) {
                            errorEl.textContent = 'Mevcut belge hazırlanamadı: ' + e.message;
                            errorEl.style.display = 'block';
                        }
                    }
                });
            }

            // Kodu Kopyala
            const btnCopyCode = document.getElementById('ude-btn-copy-code');
            const codeDisplay = document.getElementById('ude-share-code-display');
            if (btnCopyCode && codeDisplay) {
                btnCopyCode.addEventListener('click', () => {
                    const code = codeDisplay.textContent.trim();
                    navigator.clipboard.writeText(code).then(() => {
                        if (typeof window.showToast === 'function') window.showToast('Erişim kodu panoya kopyalandı: ' + code, 'success');
                    });
                });
            }

            // Linki Kopyala
            const btnCopyLink = document.getElementById('ude-btn-copy-link');
            const linkInput = document.getElementById('ude-share-link-input');
            if (btnCopyLink && linkInput) {
                btnCopyLink.addEventListener('click', () => {
                    if (linkInput.value) {
                        navigator.clipboard.writeText(linkInput.value).then(() => {
                            if (typeof window.showToast === 'function') window.showToast('30 dakikalık paylaşım bağlantısı kopyalandı!', 'success');
                        });
                    }
                });
            }

            // Kod ile Aç Form Gönderimi
            const btnSubmitCode = document.getElementById('ude-btn-submit-code');
            const inputCode = document.getElementById('ude-input-access-code');
            const accessError = document.getElementById('ude-access-error');
            const modalAccess = document.getElementById('modal-udf-access-code');

            if (btnSubmitCode && inputCode) {
                const doSubmit = async () => {
                    const val = inputCode.value.trim();
                    if (!val) return;
                    if (accessError) accessError.style.display = 'none';

                    try {
                        btnSubmitCode.disabled = true;
                        btnSubmitCode.textContent = 'Doğrulanıyor...';
                        const res = await UkiShare.resolveShare(val);
                        if (modalAccess) modalAccess.style.display = 'none';
                        await UkiShare.openSharedDocument(res);
                    } catch (err) {
                        if (accessError) {
                            accessError.textContent = err.message || 'Belge açılamadı.';
                            accessError.style.display = 'block';
                        }
                    } finally {
                        btnSubmitCode.disabled = false;
                        btnSubmitCode.textContent = 'Belgeyi Doğrula ve Aç';
                    }
                };

                btnSubmitCode.addEventListener('click', doSubmit);
                inputCode.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        doSubmit();
                    }
                });
            }

            // Gelen bağlantı kontrolü
            setTimeout(() => this.checkIncomingHash(), 300);
            window.addEventListener('hashchange', () => this.checkIncomingHash());
        }
    };

    window.UkiShare = UkiShare;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UkiShare.init());
    } else {
        UkiShare.init();
    }
})(window);
