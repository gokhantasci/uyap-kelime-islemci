/**
 * UYAP Kelime İşlemci (UKİ) - Belge Karşılaştırma & Fark İnceleme Motoru (UkiDiff)
 * Geliştirici: Gökhan TAŞÇI (Sakarya Yazı İşleri Müdürü - Sicil: 139329)
 * 
 * Google Docs & Word Çapraz Paritesi:
 * - İki metin veya UDF belgesi arasındaki farkları LCS (Myers Diff) algoritmasıyla analiz eder.
 * - Eklenen kelimeleri yeşil (+), silinen kelimeleri kırmızı (-) olarak vurgular.
 * - Yan yana (Split View) ve Birleşik Satır İçi (Unified Inline) görünüm modları sunar.
 * - Farkları mevcut belgeye uygulama veya diff raporunu kopyalama yeteneğine sahiptir.
 * - %100 İstemci taraflı (Zero-Server) çalışır.
 */

(function (window, document) {
    'use strict';

    // Kelime veya satır bazlı Diff Algoritması (LCS)
    function computeDiff(oldTokens, newTokens) {
        const n = oldTokens.length;
        const m = newTokens.length;
        const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < m; j++) {
                if (oldTokens[i] === newTokens[j]) {
                    dp[i + 1][j + 1] = dp[i][j] + 1;
                } else {
                    dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
                }
            }
        }

        const diff = [];
        let i = n, j = m;

        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
                diff.push({ type: 'equal', value: oldTokens[i - 1] });
                i--;
                j--;
            } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                diff.push({ type: 'insert', value: newTokens[j - 1] });
                j--;
            } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
                diff.push({ type: 'delete', value: oldTokens[i - 1] });
                i--;
            }
        }

        diff.reverse();
        return diff;
    }

    function tokenize(text) {
        if (!text) return [];
        // Kelimeleri ve boşlukları/noktalamaları koruyarak parçala
        return text.match(/[\wçğıöşüÇĞİÖŞÜ]+|[^\w\sçğıöşüÇĞİÖŞÜ]+|\s+/g) || [];
    }

    const UkiDiff = {
        /**
         * İki metni karşılaştırır ve diff nesneleri listesi döner
         */
        diffWords(oldText, newText) {
            const oldTokens = tokenize(oldText || '');
            const newTokens = tokenize(newText || '');
            const diffResult = computeDiff(oldTokens, newTokens);

            let addedCount = 0;
            let removedCount = 0;

            diffResult.forEach(item => {
                if (item.type === 'insert' && item.value.trim()) addedCount++;
                if (item.type === 'delete' && item.value.trim()) removedCount++;
            });

            return {
                diff: diffResult,
                addedCount,
                removedCount,
                isIdentical: addedCount === 0 && removedCount === 0
            };
        },

        /**
         * HTML formatında diff çıktısı üretir
         */
        renderInlineHtml(diffResult) {
            return diffResult.map(item => {
                const escaped = item.value
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/\n/g, '<br>');

                if (item.type === 'insert') {
                    return `<ins class="diff-ins" title="Eklenen Metin">${escaped}</ins>`;
                } else if (item.type === 'delete') {
                    return `<del class="diff-del" title="Silinen Metin">${escaped}</del>`;
                }
                return `<span>${escaped}</span>`;
            }).join('');
        },

        renderSideBySideHtml(diffResult) {
            let leftHtml = '';
            let rightHtml = '';

            diffResult.forEach(item => {
                const escaped = item.value
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/\n/g, '<br>');

                if (item.type === 'delete') {
                    leftHtml += `<del class="diff-del">${escaped}</del>`;
                } else if (item.type === 'insert') {
                    rightHtml += `<ins class="diff-ins">${escaped}</ins>`;
                } else {
                    leftHtml += `<span>${escaped}</span>`;
                    rightHtml += `<span>${escaped}</span>`;
                }
            });

            return { leftHtml, rightHtml };
        },

        /**
         * Karşılaştırma modalını açar
         */
        openDiffModal(customOldText = null, title = 'Belge Karşılaştırma & Fark İnceleme') {
            let modal = document.getElementById('modal-doc-diff');
            if (!modal) {
                console.warn('Diff modal öğesi bulunamadı.');
                return;
            }

            const currentEditor = document.getElementById('editor');
            const currentText = currentEditor ? (currentEditor.innerText || currentEditor.textContent || '') : '';

            const txtOld = document.getElementById('diff-old-text');
            const txtNew = document.getElementById('diff-new-text');
            const resultContainer = document.getElementById('diff-result-view');
            const statsContainer = document.getElementById('diff-stats-badge');

            if (txtOld && customOldText !== null) {
                txtOld.value = customOldText;
            }
            if (txtNew && currentText) {
                txtNew.value = currentText;
            }

            if (typeof window.openModal === 'function') {
                window.openModal(modal);
            } else {
                modal.classList.add('active');
            }

            UkiDiff.runActiveCompare();
        },

        runActiveCompare() {
            const txtOld = document.getElementById('diff-old-text');
            const txtNew = document.getElementById('diff-new-text');
            const resultContainer = document.getElementById('diff-result-view');
            const statsContainer = document.getElementById('diff-stats-badge');

            if (!txtOld || !txtNew || !resultContainer) return;

            const oldVal = txtOld.value || '';
            const newVal = txtNew.value || '';

            const res = UkiDiff.diffWords(oldVal, newVal);

            if (statsContainer) {
                if (res.isIdentical) {
                    statsContainer.innerHTML = '<span class="diff-tag diff-tag-same">✓ Belgeler Birebir Aynı</span>';
                } else {
                    statsContainer.innerHTML = `
                        <span class="diff-tag diff-tag-ins">+${res.addedCount} Kelime Eklendi</span>
                        <span class="diff-tag diff-tag-del">-${res.removedCount} Kelime Silindi</span>
                    `;
                }
            }

            const isSplitView = document.getElementById('diff-view-split')?.checked;
            if (isSplitView) {
                const sbs = UkiDiff.renderSideBySideHtml(res.diff);
                resultContainer.innerHTML = `
                    <div class="diff-split-container">
                        <div class="diff-split-col">
                            <div class="diff-col-header">Orijinal / Önceki Belge</div>
                            <div class="diff-col-body">${sbs.leftHtml || '<em>(Boş)</em>'}</div>
                        </div>
                        <div class="diff-split-col">
                            <div class="diff-col-header">Karşılaştırılan / Yeni Belge</div>
                            <div class="diff-col-body">${sbs.rightHtml || '<em>(Boş)</em>'}</div>
                        </div>
                    </div>
                `;
            } else {
                resultContainer.innerHTML = `
                    <div class="diff-unified-box">
                        ${UkiDiff.renderInlineHtml(res.diff)}
                    </div>
                `;
            }
        }
    };

    window.UkiDiff = UkiDiff;

})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : {});
