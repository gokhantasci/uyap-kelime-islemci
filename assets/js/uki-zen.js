/**
 * UYAP Kelime İşlemci (UKİ) - Zen / Odaklanma Modu ve Daktilo Deneyimi (UkiZen)
 * Geliştirici: Gökhan TAŞÇI (Sakarya Yazı İşleri Müdürü - Sicil: 139329)
 * 
 * iA Writer, Ulysses & FocusWriter Çapraz Paritesi:
 * - F11 veya tek tıkla tüm menüleri, araç çubuklarını ve kenar çubuklarını gizler.
 * - Sadece tertemiz sayfa ve yazı kalır; dikkat dağıtıcı tüm unsurları sıfırlar.
 * - Daktilo Modu (Typewriter Scrolling): Yazarken imleç daima dikey merkezde kalır.
 * - Web Audio API ile gerçek zamanlı mekanik daktilo tuş sesi ve Enter satır başı zili (Ding!).
 */

(function (window, document) {
    'use strict';

    let isZenActive = false;
    let isTypewriterActive = false;
    let topBarEl = null;

    function playDingSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const now = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(1760, now); // A6 (Daktilo çan sesi)
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.4);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.5);
        } catch (e) {}
    }

    function createZenTopBar() {
        if (topBarEl) return topBarEl;
        topBarEl = document.createElement('div');
        topBarEl.id = 'zen-mode-top-bar';
        topBarEl.className = 'zen-mode-top-bar';
        topBarEl.innerHTML = `
            <div class="zen-top-content">
                <div class="zen-brand">
                    <span style="font-size: 1.1rem;">🧘</span>
                    <strong>Odak Modu (Zen)</strong>
                    <span class="zen-hint">Farenizi yukarı getirdiğinizde bu çubuk görünür</span>
                </div>
                <div class="zen-controls">
                    <label class="zen-control-item" title="Yazarken aktif satırı daima ekranın ortasında tutar">
                        <input type="checkbox" id="zen-chk-typewriter">
                        <span>Daktilo Kaydırma</span>
                    </label>
                    <label class="zen-control-item" title="Yazarken mekanik daktilo tuş sesleri ve satır sonu zili çalar">
                        <input type="checkbox" id="zen-chk-sound">
                        <span>Daktilo Sesi</span>
                    </label>
                    <button type="button" class="btn-zen-exit" id="btn-zen-exit" title="Odak Modundan Çık (Esc)">
                        ✕ Odaktan Çık (Esc)
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(topBarEl);

        const chkTypewriter = document.getElementById('zen-chk-typewriter');
        if (chkTypewriter) {
            chkTypewriter.addEventListener('change', (e) => {
                isTypewriterActive = e.target.checked;
            });
        }

        const chkSound = document.getElementById('zen-chk-sound');
        if (chkSound) {
            const currentSound = localStorage.getItem('uki-keyboard-sound') === 'true';
            chkSound.checked = currentSound;
            chkSound.addEventListener('change', (e) => {
                localStorage.setItem('uki-keyboard-sound', e.target.checked ? 'true' : 'false');
            });
        }

        const btnExit = document.getElementById('btn-zen-exit');
        if (btnExit) {
            btnExit.addEventListener('click', () => UkiZen.exit());
        }

        return topBarEl;
    }

    function keepCursorInCenter() {
        if (!isTypewriterActive || !isZenActive) return;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        const range = sel.getRangeAt(0).cloneRange();
        range.collapse(true);
        const rects = range.getClientRects();
        if (rects.length > 0) {
            const caretY = rects[0].top;
            const targetY = window.innerHeight * 0.45;
            const diff = caretY - targetY;
            if (Math.abs(diff) > 20) {
                window.scrollBy({ top: diff, behavior: 'smooth' });
            }
        }
    }

    const UkiZen = {
        init() {
            window.addEventListener('keydown', (e) => {
                if (e.key === 'F11') {
                    e.preventDefault();
                    UkiZen.toggle();
                } else if (e.key === 'Escape' && isZenActive) {
                    UkiZen.exit();
                } else if (e.key === 'Enter' && isZenActive) {
                    const soundEnabled = localStorage.getItem('uki-keyboard-sound') === 'true';
                    if (soundEnabled) playDingSound();
                }
            });

            const editor = document.getElementById('editor');
            if (editor) {
                editor.addEventListener('keyup', keepCursorInCenter);
                editor.addEventListener('click', keepCursorInCenter);
            }
        },

        enter() {
            createZenTopBar();
            document.body.classList.add('zen-mode-active');
            isZenActive = true;
            if (typeof window.showToast === 'function') {
                window.showToast('Odak Modu devrede (Çıkmak için Esc veya F11)', 'info');
            }
        },

        exit() {
            document.body.classList.remove('zen-mode-active');
            isZenActive = false;
        },

        toggle() {
            if (isZenActive) {
                UkiZen.exit();
            } else {
                UkiZen.enter();
            }
        },

        isActive() {
            return isZenActive;
        }
    };

    window.UkiZen = UkiZen;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UkiZen.init());
    } else {
        UkiZen.init();
    }

})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : {});

