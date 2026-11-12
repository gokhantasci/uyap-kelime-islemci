/**
 * UYAP Kelime İşlemci (UKİ) - Sürüm Geçmişi & Yerel Zaman Makinesi (UkiVersions)
 * Geliştirici: Gökhan TAŞÇI (Sakarya Yazı İşleri Müdürü - Sicil: 139329)
 * 
 * Google Docs & MS Word Sürüm Geçmişi Paritesi:
 * - Düzenli aralıklarla yerel depolamada otomatik anlık görüntü (snapshot) alır.
 * - Adli katipler ve avukatlar için elektrik kesintisi veya yanlışlıkla silinmeye karşı %100 güvence.
 * - İsimlendirilmiş sürümler (örnek: 'Duruşma Öncesi Taslak').
 * - Tek tıkla eski sürüme geri yükleme (Restore).
 * - Eski sürüm ile mevcut belgeyi tek tıkla UkiDiff modülünde karşılaştırma.
 * - %100 Sıfır Sunucu (Zero-Server) Gizlilik Garantisi.
 */

(function (window, document) {
    'use strict';

    const LS_KEY = 'uki_doc_version_snapshots_v1';
    const MAX_SNAPSHOTS = 40;
    const AUTO_INTERVAL_MS = 2 * 60 * 1000; // 2 Dakika

    let lastSnapshotText = '';
    let autoTimer = null;

    function getSnapshots() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveSnapshots(list) {
        try {
            // En yeni 40 kaydı tut
            const trimmed = list.slice(0, MAX_SNAPSHOTS);
            localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
        } catch (e) {
            console.warn('Sürümler kaydedilemedi:', e);
        }
    }

    const UkiVersions = {
        init() {
            // İlk açılışta timer kur
            if (autoTimer) clearInterval(autoTimer);
            autoTimer = setInterval(() => {
                UkiVersions.createSnapshot(null, true);
            }, AUTO_INTERVAL_MS);
        },

        createSnapshot(customName = null, isAuto = false) {
            const editor = document.getElementById('editor');
            if (!editor) return;

            const text = (editor.innerText || editor.textContent || '').trim();
            if (!text || text.length < 5) return;

            // Eğer otomatikse ve son snapshot'tan beri metin değişmediyse kaydetme
            if (isAuto && text === lastSnapshotText) return;

            const html = editor.innerHTML;
            const words = text.split(/\s+/).filter(Boolean).length;
            const chars = text.length;
            const titleInput = document.getElementById('doc-title');
            const docTitle = titleInput ? titleInput.value : 'Belge';

            const snapshot = {
                id: 'ver_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                timestamp: Date.now(),
                dateStr: new Date().toLocaleString('tr-TR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                }),
                title: docTitle,
                name: customName || (isAuto ? 'Otomatik Kayıt' : 'Kullanıcı Kaydı'),
                isAuto: !!isAuto,
                wordCount: words,
                charCount: chars,
                text: text,
                html: html
            };

            const list = getSnapshots();
            list.unshift(snapshot);
            saveSnapshots(list);
            lastSnapshotText = text;

            if (!isAuto && typeof window.showToast === 'function') {
                window.showToast(`Sürüm kaydedildi: "${snapshot.name}"`, 'success');
            }
        },

        restoreSnapshot(snapshotId) {
            const list = getSnapshots();
            const item = list.find(s => s.id === snapshotId);
            if (!item) return;

            if (!confirm(`"${item.name}" (${item.dateStr}) sürümüne geri dönmek istediğinize emin misiniz? Mevcut düzenlemenizin üzerine yazılacaktır.`)) {
                return;
            }

            // Önce mevcut halin bir yedeğini al
            UkiVersions.createSnapshot('Geri Yükleme Öncesi Yedek', false);

            const editor = document.getElementById('editor');
            if (editor) {
                editor.innerHTML = item.html;
                if (window.UkiPages && typeof window.UkiPages.repaginate === 'function') {
                    window.UkiPages.repaginate();
                }
                if (typeof window.showToast === 'function') {
                    window.showToast(`Belge "${item.name}" sürümüne geri yüklendi!`, 'success');
                }
                UkiVersions.closeModal();
            }
        },

        diffWithCurrent(snapshotId) {
            const list = getSnapshots();
            const item = list.find(s => s.id === snapshotId);
            if (!item) return;

            UkiVersions.closeModal();
            if (window.UkiDiff && typeof window.UkiDiff.openDiffModal === 'function') {
                window.UkiDiff.openDiffModal(item.text, `Sürüm Karşılaştırması: ${item.name} (${item.dateStr})`);
            }
        },

        deleteSnapshot(snapshotId) {
            let list = getSnapshots();
            list = list.filter(s => s.id !== snapshotId);
            saveSnapshots(list);
            UkiVersions.renderSnapshotList();
        },

        clearAllSnapshots() {
            if (!confirm('Tüm geçmiş sürümleri silmek istediğinize emin misiniz?')) return;
            localStorage.removeItem(LS_KEY);
            UkiVersions.renderSnapshotList();
            if (typeof window.showToast === 'function') {
                window.showToast('Tüm sürüm geçmişi temizlendi.', 'info');
            }
        },

        renderSnapshotList() {
            const container = document.getElementById('version-history-list');
            if (!container) return;

            const list = getSnapshots();
            if (!list.length) {
                container.innerHTML = `
                    <div class="version-empty-state">
                        <div style="font-size: 2rem; margin-bottom: 8px;">⏳</div>
                        <strong>Henüz Kayıtlı Sürüm Yok</strong>
                        <p style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">
                            Siz çalıştıkça sistem her 2 dakikada bir otomatik anlık görüntü kaydeder.
                        </p>
                    </div>
                `;
                return;
            }

            container.innerHTML = list.map((item, idx) => `
                <div class="version-item-card" data-id="${item.id}">
                    <div class="version-card-header">
                        <div class="version-card-title">
                            <span class="version-badge ${item.isAuto ? 'version-badge-auto' : 'version-badge-user'}">
                                ${item.isAuto ? 'Otomatik' : 'Özel'}
                            </span>
                            <strong>${item.name}</strong>
                        </div>
                        <span class="version-card-time">${item.dateStr}</span>
                    </div>
                    <div class="version-card-meta">
                        <span>📝 ${item.wordCount} Kelime</span>
                        <span>•</span>
                        <span>🔤 ${item.charCount} Karakter</span>
                        <span>•</span>
                        <span>📄 ${item.title}</span>
                    </div>
                    <div class="version-card-snippet">
                        ${item.text.substring(0, 140).replace(/</g, '&lt;')}...
                    </div>
                    <div class="version-card-actions">
                        <button type="button" class="btn-version-action btn-version-restore" onclick="window.UkiVersions.restoreSnapshot('${item.id}')">
                            ↺ Bu Sürüme Dön
                        </button>
                        <button type="button" class="btn-version-action btn-version-diff" onclick="window.UkiVersions.diffWithCurrent('${item.id}')">
                            ⚖️ Farkı Gör (Diff)
                        </button>
                        <button type="button" class="btn-version-action btn-version-del" onclick="window.UkiVersions.deleteSnapshot('${item.id}')" title="Bu sürümü sil">
                            🗑️
                        </button>
                    </div>
                </div>
            `).join('');
        },

        openModal() {
            const modal = document.getElementById('modal-version-history');
            if (!modal) return;
            UkiVersions.renderSnapshotList();
            if (typeof window.openModal === 'function') {
                window.openModal(modal);
            } else {
                modal.classList.add('active');
            }
        },

        closeModal() {
            const modal = document.getElementById('modal-version-history');
            if (!modal) return;
            if (typeof window.closeModal === 'function') {
                window.closeModal(modal);
            } else {
                modal.classList.remove('active');
            }
        }
    };

    window.UkiVersions = UkiVersions;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UkiVersions.init());
    } else {
        UkiVersions.init();
    }

})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : {});
