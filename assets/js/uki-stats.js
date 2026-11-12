/**
 * UYAP Kelime İşlemci (UKİ) - İstatistik & Sayaç Yönetim Modülü (UkiStats)
 * Geliştirici: Gökhan TAŞÇI - Sakarya Yazı İşleri Müdürü (Sicil: 139329)
 * 
 * 657astro Sayaç Entegrasyonu ve İstemci Taraflı Kullanım Analitiği:
 * - Açılan evrak, kelime, satır, karakter istatistikleri
 * - İndirilen evrak (UDF / DOCX / PDF) sayaçları
 * - Yazdırma ve e-imza denetim sayaçları
 * - %100 İstemci taraflı gizlilik güvencesi (Belge içeriği ASLA sunucuya gitmez)
 */

(function (window) {
    'use strict';

    const STORAGE_KEY = 'uki_usage_statistics_v1';
    // Anonim kullanım sayacı yalnızca site ayar dosyasında (assets/js/site-config.js) adres verilirse çalışır; varsayılan: kapalı
    const API_657_COUNT = (window.UKI_SITE_CONFIG && window.UKI_SITE_CONFIG.usagePingUrl) || '';

    // Varsayılan İstatistik Yapısı
    function getDefaultStats() {
        return {
            featureUsage: {ocr:0,speech:0,ai:0},
            totalDocumentsOpened: 0,
            totalDocumentsDownloaded: 0,
            totalUdfDownloaded: 0,
            totalDocxDownloaded: 0,
            totalPdfDownloaded: 0,
            totalWordsRead: 0,
            totalCharsRead: 0,
            totalLinesRead: 0,
            totalPrintCount: 0,
            totalSignaturesChecked: 0,
            firstUsed: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            session: {
                documentsOpened: 0,
                documentsDownloaded: 0,
                wordsRead: 0,
                charsRead: 0,
                linesRead: 0
            }
        };
    }

    class UkiStatsManager {
        constructor() {
            this.stats = this.loadStats();
            // Oturumu sıfırla
            this.stats.session = {
                documentsOpened: 0,
                documentsDownloaded: 0,
                wordsRead: 0,
                charsRead: 0,
                linesRead: 0
            };
            this.saveStats();
        }

        loadStats() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    return { ...getDefaultStats(), ...parsed };
                }
            } catch (e) {
                console.warn('İstatistikler yüklenemedi:', e);
            }
            return getDefaultStats();
        }

        saveStats() {
            try {
                this.stats.lastUsed = new Date().toISOString();
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
                this.updateUIBadges();
            } catch (e) {
                console.warn('İstatistikler kaydedilemedi:', e);
            }
        }

        /**
         * Yeni bir doküman açıldığında veya okunduğunda istatistiğe işler
         * @param {Object} data { text, words, chars, lines, fileName, source }
         */
        recordDocumentOpened(data = {}) {
            let words = Number(data.words) || 0;
            let chars = Number(data.chars) || 0;
            let lines = Number(data.lines) || 0;

            if (data.text && (!words || !chars)) {
                const cleanText = data.text.trim();
                words = cleanText ? cleanText.split(/\s+/).length : 0;
                chars = cleanText.length;
                lines = cleanText ? cleanText.split(/\r\n|\r|\n/).length : 0;
            }

            this.stats.totalDocumentsOpened += 1;
            this.stats.totalWordsRead += words;
            this.stats.totalCharsRead += chars;
            this.stats.totalLinesRead += lines;

            this.stats.session.documentsOpened += 1;
            this.stats.session.wordsRead += words;
            this.stats.session.charsRead += chars;
            this.stats.session.linesRead += lines;

            this.saveStats();
            this.pulse657('udf-editor');
            this.sendMetrics({documents:1, words, characters:chars, lines});
        }

        /**
         * Doküman indirildiğinde (UDF, DOCX, PDF) sayacı artırır
         * @param {string} format 'udf' | 'docx' | 'pdf'
         */
        recordDocumentDownloaded(format = 'udf') {
            const fmt = (format || '').toLowerCase();
            this.stats.totalDocumentsDownloaded += 1;
            this.stats.session.documentsDownloaded += 1;

            if (fmt === 'udf') {
                this.stats.totalUdfDownloaded += 1;
            } else if (fmt === 'docx') {
                this.stats.totalDocxDownloaded += 1;
            } else if (fmt === 'pdf') {
                this.stats.totalPdfDownloaded += 1;
            }

            this.saveStats();
            this.sendMetrics({downloads:1, ...(['udf','docx','markdown'].includes(fmt) ? {[fmt]:1} : {})});
        }

        /**
         * Yazdırma işlemi sayacı
         */
        recordPrint() {
            this.stats.totalPrintCount += 1;
            this.saveStats();
            this.sendMetrics({prints:1});
        }

        /**
         * E-İmza inceleme işlemi sayacı
         */
        recordSignatureCheck() {
            this.stats.totalSignaturesChecked += 1;
            this.sendMetrics({signatures:1});
            this.saveStats();
        }

        /**
         * D:\657astro sayacına anonim kullanım darbesi (pulse) gönderir
         * ÖNEMLİ: ASLA belge içeriği, dosya adı, tutar veya kişi bilgisi gönderilmez!
         * Yalnızca kayıtlı araç anahtarı (tur: 'udf-editor') ve rastgele işlem kimliği iletilir.
         */
        sendMetrics(metrics) {
            const url = (window.UKI_SITE_CONFIG || {}).usageDetailsUrl;
            if (!url || !crypto.randomUUID) return;
            fetch(url, {method:'POST',headers:{'Content-Type':'application/json'},
                body:JSON.stringify({istekId:crypto.randomUUID(), metrics}),keepalive:true,
                referrerPolicy:'no-referrer',signal:AbortSignal.timeout(5000)}).catch(() => {});
        }
        recordFeature(name) {
            if (['ocr','speech','ai'].includes(name)) {
                this.stats.featureUsage = this.stats.featureUsage || {};
                this.stats.featureUsage[name] = (this.stats.featureUsage[name] || 0) + 1;
                this.saveStats();
                this.sendMetrics({[name]:1});
            }
        }

        pulse657(tur = 'udf-editor') {
            if (!API_657_COUNT) return; // ayar dosyasında adres yoksa dışarıya hiçbir istek yapılmaz
            try {
                if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                    const body = JSON.stringify({
                        tur: tur,
                        istekId: crypto.randomUUID()
                    });

                    // Tarayıcı arka planında güvenli, sessiz ping
                    fetch(API_657_COUNT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: body,
                        keepalive: true,
                        referrerPolicy: 'no-referrer',
                        signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined
                    }).catch(() => {
                        // Çevrimdışıysa veya CORS kısıtlaması varsa sessizce geç
                    });
                }
            } catch (e) {
                // Hata vermeden devam et
            }
        }

        /**
         * Durum çubuğundaki ve başlık rozetlerini günceller
         */
        updateUIBadges() {
            const badge = document.getElementById('stat-doc-count-badge');
            if (badge) {
                badge.textContent = `Evrak: ${this.stats.totalDocumentsOpened.toLocaleString('tr-TR')}`;
            }
        }

        /**
         * Aktif belgenin ayrıntılı adli metriklerini hesaplar (MS Word & Google Docs paritesi)
         */
        getCurrentDocMetrics() {
            const editor = document.getElementById('editor');
            const text = editor ? (editor.innerText || editor.textContent || '').trim() : '';
            if (!text) {
                return {
                    words: 0,
                    charsWithSpaces: 0,
                    charsNoSpaces: 0,
                    paragraphs: 0,
                    sentences: 0,
                    hearingReadingTimeStr: '0 dk',
                    silentReadingTimeStr: '0 dk'
                };
            }

            const words = text.split(/\s+/).filter(Boolean).length;
            const charsWithSpaces = text.length;
            const charsNoSpaces = text.replace(/\s+/g, '').length;
            const paragraphs = text.split(/\r\n|\r|\n+/).filter(p => p.trim().length > 0).length;
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

            // Duruşmada sesli okuma hızı (Katipler/Hakimler için ortalama 130 kelime/dakika)
            const hearingMinutes = words / 130;
            const hMin = Math.floor(hearingMinutes);
            const hSec = Math.round((hearingMinutes - hMin) * 60);
            const hearingReadingTimeStr = hMin > 0 ? `${hMin} dk ${hSec} sn` : `${hSec} sn`;

            // Sessiz okuma hızı (~220 kelime/dakika)
            const silentMinutes = words / 220;
            const sMin = Math.floor(silentMinutes);
            const sSec = Math.round((silentMinutes - sMin) * 60);
            const silentReadingTimeStr = sMin > 0 ? `${sMin} dk ${sSec} sn` : `${sSec} sn`;

            return {
                words,
                charsWithSpaces,
                charsNoSpaces,
                paragraphs,
                sentences,
                hearingReadingTimeStr,
                silentReadingTimeStr
            };
        }

        /**
         * İstatistikler modalını doldurur
         */
        populateModal() {
            const s = this.stats;
            const fmt = (n) => (Number(n) || 0).toLocaleString('tr-TR');

            const setEl = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            };

            setEl('stat-total-docs-opened', fmt(s.totalDocumentsOpened));
            setEl('stat-session-docs-opened', fmt(s.session.documentsOpened));
            setEl('stat-total-words-read', fmt(s.totalWordsRead));
            setEl('stat-session-words-read', fmt(s.session.wordsRead));
            setEl('stat-total-chars-read', fmt(s.totalCharsRead));
            setEl('stat-total-lines-read', fmt(s.totalLinesRead));

            setEl('stat-total-downloads', fmt(s.totalDocumentsDownloaded));
            setEl('stat-udf-downloads', fmt(s.totalUdfDownloaded));
            setEl('stat-docx-downloads', fmt(s.totalDocxDownloaded));
            setEl('stat-pdf-downloads', fmt(s.totalPdfDownloaded));

            setEl('stat-print-count', fmt(s.totalPrintCount));
            setEl('stat-signatures-count', fmt(s.totalSignaturesChecked));

            if (s.firstUsed) {
                try {
                    const d = new Date(s.firstUsed);
                    setEl('stat-first-used-date', d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }));
                } catch (e) {}
            }
        }

        /**
         * İstatistikleri sıfırlar (Kullanıcı onayıyla)
         */
        async resetStats() {
            const ok = window.UkiDialog
                ? await window.UkiDialog.confirm('Tüm yerel okuma, evrak ve indirme sayaçlarınız sıfırlansın mı? Bu işlem geri alınamaz.', { title: 'Sayaçları sıfırla', okText: 'Sıfırla', danger: true })
                : false;
            if (ok) {
                this.stats = getDefaultStats();
                this.saveStats();
                this.populateModal();
                if (window.showToast) {
                    window.showToast('İstatistikler sıfırlandı.', 'info');
                }
            }
        }
    }

    window.UkiStats = new UkiStatsManager();

})(window);

