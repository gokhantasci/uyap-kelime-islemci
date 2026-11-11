/**
 * UYAP Kelime İşlemci (UKİ) - Yazma Hızı (WPM / DKB) ve Mekanik Klavye Sesi Modülü
 * 
 * 1. Türkçe Kelime Sayımı (DKB - Dakika Başına Kelime): Gerçek Türkçe kelime sınırlarına göre hesaplanır.
 * 2. Olimpiyat / Intersteno Standardı: Uluslararası Klavye Şampiyonası kuralı (5 vuruş = 1 kelime).
 * 3. Web Audio API Mekanik Klavye Sesi: Harici dosya indirmeden gerçek zamanlı sentezlenen Cherry MX tactile anahtar sesi.
 */
(function (window) {
    'use strict';

    let audioCtx = null;
    let isSoundEnabled = false;

    try {
        isSoundEnabled = localStorage.getItem('uki-keyboard-sound') === 'true';
    } catch (e) {}

    // Web Audio API ile Mekanik Klavye Sesi Sentezleyici
    function playMechanicalClick() {
        if (!isSoundEnabled) return;
        try {
            if (!audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                audioCtx = new AudioContext();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const now = audioCtx.currentTime;

            // 1. Üst Frekans 'Tık' Sesi (Bandpass gürültü patlaması)
            const bufferSize = audioCtx.sampleRate * 0.025; // 25ms
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
            }

            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;

            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(3200 + Math.random() * 600, now);
            filter.Q.setValueAtTime(3, now);

            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            noise.start(now);

            // 2. Alt Frekans Gövde Vuruşu (Tok Ses)
            const osc = audioCtx.createOscillator();
            const oscGain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(140 + Math.random() * 40, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.035);

            oscGain.gain.setValueAtTime(0.22, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

            osc.connect(oscGain);
            oscGain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.04);
        } catch (e) {}
    }

    // WPM Takip Durumu
    let startTime = null;
    let totalCharsTyped = 0;
    let totalWordsTyped = 0;
    let lastKeyTime = 0;
    let activeTypingMs = 0;

    const UkiTyping = {
        init(editorEl) {
            if (!editorEl) return;

            editorEl.addEventListener('keydown', (e) => {
                // Yalnızca karakter tuşlarında ses çal ve ölç
                if (e.key && e.key.length === 1) {
                    playMechanicalClick();
                    UkiTyping.recordKeystroke(e.key);
                } else if (e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Tab') {
                    playMechanicalClick();
                }
            });

            UkiTyping.updateUi();
        },

        recordKeystroke(char) {
            const now = Date.now();
            if (!startTime) {
                startTime = now;
                lastKeyTime = now;
            }

            // 3 saniyeden fazla duraklama varsa aktif yazma süresine ekleme yapma
            const delta = now - lastKeyTime;
            if (delta < 3000) {
                activeTypingMs += delta;
            } else {
                activeTypingMs += 500; // duraklama sonrası yeniden başlama toleransı
            }
            lastKeyTime = now;

            totalCharsTyped++;
            if (/\s/.test(char)) {
                totalWordsTyped++;
            }

            UkiTyping.updateUi();
        },

        getStats() {
            const minutes = Math.max(0.1, activeTypingMs / 60000);
            
            // 1. Türkçe Kelime Bazlı WPM (DKB)
            const turkishWpm = Math.round(totalWordsTyped / minutes);

            // 2. Uluslararası Olimpiyat / Intersteno Standardı (5 vuruş = 1 kelime)
            const olympicWpm = Math.round((totalCharsTyped / 5) / minutes);

            // 3. Karakter / Vuruş Hızı (CPM - Vuruş/dk)
            const cpm = Math.round(totalCharsTyped / minutes);

            return {
                turkishWpm: isNaN(turkishWpm) ? 0 : turkishWpm,
                olympicWpm: isNaN(olympicWpm) ? 0 : olympicWpm,
                cpm: isNaN(cpm) ? 0 : cpm,
                totalChars: totalCharsTyped,
                totalWords: totalWordsTyped,
                isSoundEnabled
            };
        },

        toggleSound() {
            isSoundEnabled = !isSoundEnabled;
            try {
                localStorage.setItem('uki-keyboard-sound', isSoundEnabled ? 'true' : 'false');
            } catch (e) {}
            if (isSoundEnabled) playMechanicalClick();
            UkiTyping.updateUi();
            if (typeof window.showToast === 'function') {
                window.showToast(isSoundEnabled ? '🔊 Mekanik klavye sesi açıldı.' : '🔈 Klavye sesi kapatıldı.', 'info');
            }
            return isSoundEnabled;
        },

        resetStats() {
            startTime = null;
            lastKeyTime = 0;
            totalCharsTyped = 0;
            totalWordsTyped = 0;
            activeTypingMs = 0;
            UkiTyping.updateUi();
        },

        updateUi() {
            const widget = document.getElementById('status-wpm-widget');
            if (!widget) return;
            const stats = UkiTyping.getStats();
            const soundIcon = isSoundEnabled ? '🔊' : '🔈';

            widget.innerHTML = `<span title="Yazma Hızı: Türkçe Dakika Başına Kelime ve Dünya Klavye Olimpiyatı (Intersteno) Ölçümü">⚡ <b>${stats.turkishWpm}</b> WPM (TR) | <b>${stats.olympicWpm}</b> WPM (Olimpiyat)</span> <button type="button" id="btn-toggle-keysound" class="wpm-sound-btn" title="Mekanik Klavye Sesini Aç/Kapat" style="background:none;border:none;cursor:pointer;font-size:12px;padding:0 4px;">${soundIcon}</button>`;

            const soundBtn = document.getElementById('btn-toggle-keysound');
            if (soundBtn) {
                soundBtn.onclick = (e) => {
                    e.stopPropagation();
                    UkiTyping.toggleSound();
                };
            }
        }
    };

    window.UkiTyping = UkiTyping;
})(window);
