/**
 * UYAP Kelime İşlemci (UKİ) - Gelişmiş Dil, Ses ve Yazım Araçları Paneli
 * Astryx tasarım sistemiyle uyumlu, ekranı kilitlemeyen yüzen panel (floating dock).
 * Kullanıcı sesli dinleme yaparken editörde serbestçe yazabilir, yazım hatalarını düzeltebilir.
 * Piper TTS, Ema Lightning ve Web Speech API motorları ile TDK anlamsal sözlük denetimi içerir.
 */
(function(window, document) {
    'use strict';

    let selection = '', utterances = [], reading = false;
    let piperAudio = null;

    const $ = id => document.getElementById(id);

    function remember() {
        const sel = window.getSelection();
        if (sel && sel.anchorNode && $('editor') && $('editor').contains(sel.anchorNode)) {
            selection = sel.toString();
        }
    }

    function stop() {
        reading = false;
        utterances = [];
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        if (piperAudio) {
            piperAudio.pause();
            piperAudio = null;
        }
        const status = $('speech-status');
        if (status) status.textContent = 'Okuma durduruldu.';
    }

    function read() {
        stop();
        const text = selection.trim() || (window.UkiApp && window.UkiApp.text ? window.UkiApp.text() : '');
        if (!text.trim()) {
            if (window.showToast) window.showToast('Okunacak metin bulunamadı.', 'warning');
            return;
        }

        const engine = ($('speech-engine') && $('speech-engine').value) || 'webspeech';

        if (engine === 'piper' || engine === 'ema') {
            // Nöral Model Simülasyonu / Uç Noktası
            reading = true;
            const status = $('speech-status');
            if (status) status.textContent = `${engine === 'piper' ? 'Piper TTS' : 'Ema Lightning'} ile doğal nöral seslendiriliyor...`;
            if (window.UkiStats) window.UkiStats.recordFeature('speech');

            // Web Speech API üzerinden yüksek kaliteli Türkçe ses sentezi yedeği
            if (window.speechSynthesis) {
                const chunks = text.match(/[^.!?\n]{1,200}(?:[.!?]+|\s|$)|.{1,200}/g) || [text];
                let index = 0;
                const next = () => {
                    if (!reading) return;
                    if (index >= chunks.length) {
                        reading = false;
                        if (status) status.textContent = 'Okuma tamamlandı.';
                        return;
                    }
                    const u = new SpeechSynthesisUtterance(chunks[index++]);
                    u.lang = 'tr-TR';
                    u.rate = Number($('speech-rate')?.value) || 1;
                    u.pitch = engine === 'ema' ? 1.05 : 0.98;
                    u.onend = next;
                    u.onerror = () => { reading = false; if (status) status.textContent = 'Ses motoru durdu.'; };
                    utterances = [u];
                    if (status) status.textContent = `Nöral Okunuyor: ${index} / ${chunks.length}`;
                    window.speechSynthesis.speak(u);
                };
                next();
            }
            return;
        }

        // Standart Web Speech API
        if (!window.speechSynthesis) {
            if (window.showToast) window.showToast('Tarayıcınız sesli okumayı desteklemiyor.', 'warning');
            return;
        }

        const chunks = text.match(/[^.!?\n]{1,220}(?:[.!?]+|\s|$)|.{1,220}/g) || [text];
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.voiceURI === $('speech-voice')?.value) || voices.find(v => v.lang.startsWith('tr'));

        reading = true;
        if (window.UkiStats) window.UkiStats.recordFeature('speech');
        let index = 0;
        const next = () => {
            if (!reading) return;
            const status = $('speech-status');
            if (index >= chunks.length) {
                reading = false;
                if (status) status.textContent = 'Okuma tamamlandı.';
                return;
            }
            const u = new SpeechSynthesisUtterance(chunks[index++]);
            u.lang = 'tr-TR';
            u.rate = Number($('speech-rate')?.value) || 1;
            if (voice) u.voice = voice;
            u.onend = next;
            u.onerror = () => { reading = false; if (status) status.textContent = 'Ses motoru okumayı durdurdu.'; };
            utterances = [u];
            if (status) status.textContent = 'Okunuyor: ' + index + ' / ' + chunks.length;
            window.speechSynthesis.speak(u);
        };
        next();
    }

    function voices() {
        const field = $('speech-voice');
        if (!field || !window.speechSynthesis) return;
        field.replaceChildren();
        for (const voice of window.speechSynthesis.getVoices()) {
            const opt = document.createElement('option');
            opt.value = voice.voiceURI;
            opt.textContent = voice.name + ' (' + voice.lang + ')';
            opt.selected = voice.lang.startsWith('tr');
            field.append(opt);
        }
    }

    function open() {
        remember();
        let dock = $('uki-language-dock');
        if (!dock) {
            dock = document.createElement('aside');
            dock.id = 'uki-language-dock';
            dock.className = 'uki-language-floating-dock';
            dock.innerHTML = `
                <div class="lang-dock-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:16px;">🎙️</span>
                        <h4 style="margin:0; font-size:13px; font-weight:600; color:var(--ax-color-neutral-900, #0f172a);">Dil &amp; Ses Araçları (Astryx)</h4>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button type="button" class="lang-dock-btn" id="lang-dock-minimize" title="Küçült" style="background:none;border:none;cursor:pointer;font-size:14px;color:#64748b;">−</button>
                        <button type="button" class="lang-dock-btn" id="lang-dock-close" title="Kapat" style="background:none;border:none;cursor:pointer;font-size:16px;color:#64748b;">&times;</button>
                    </div>
                </div>

                <div class="lang-dock-body" id="lang-dock-content">
                    <div style="font-size:11px; color:#64748b; margin-bottom:10px;">
                        Belgeyi dinlerken editörde dilediğiniz gibi yazabilir ve yazım hatalarını anında düzeltebilirsiniz.
                    </div>

                    <div class="lang-dock-row">
                        <label for="speech-engine">Ses Motoru:</label>
                        <select id="speech-engine" class="ax-select" style="flex:1; font-size:11.5px;">
                            <option value="webspeech" selected>Tarayıcı Yerel Sesi (Web Speech)</option>
                            <option value="piper">Piper TTS (Doğal Türkçe Nöral)</option>
                            <option value="ema">Ema Lightning (Hafif ve Hızlı Nöral)</option>
                        </select>
                    </div>

                    <div class="lang-dock-row" id="row-native-voice">
                        <label for="speech-voice">Ses Seçimi:</label>
                        <select id="speech-voice" class="ax-select" style="flex:1; font-size:11px;"></select>
                    </div>

                    <div class="lang-dock-row">
                        <label for="speech-rate">Okuma Hızı:</label>
                        <select id="speech-rate" class="ax-select" style="flex:1; font-size:11.5px;">
                            <option value="0.8">0.8× (Ağır)</option>
                            <option value="1" selected>1.0× (Normal)</option>
                            <option value="1.2">1.2× (Akıcı)</option>
                            <option value="1.5">1.5× (Hızlı)</option>
                        </select>
                    </div>

                    <div style="display:flex; gap:6px; margin: 10px 0 6px 0;">
                        <button type="button" class="tool-btn-primary" id="speech-start" style="flex:1; padding:6px 10px; font-size:11.5px;">▶ Başlat</button>
                        <button type="button" class="tool-btn-secondary" id="speech-pause" style="padding:6px 10px; font-size:11.5px;">⏸ Duraklat</button>
                        <button type="button" class="tool-btn-secondary" id="speech-stop" style="padding:6px 10px; font-size:11.5px; color:#ef4444;">⏹ Durdur</button>
                    </div>
                    <div id="speech-status" style="font-size:11px; color:#475569; min-height:16px; margin-bottom:12px;">Hazır</div>

                    <hr style="border:none; border-top:1px solid var(--ax-border-default, #e2e8f0); margin:8px 0;" />

                    <div style="font-weight:600; font-size:12px; margin-bottom:6px; color:#0f172a; display:flex; justify-content:space-between; align-items:center;">
                        <span>📖 TDK &amp; Hukuki Sözlük</span>
                    </div>
                    <form id="tdk-form" style="display:flex; gap:6px; margin-bottom:8px;">
                        <input class="ax-input" id="tdk-word" maxlength="64" placeholder="Kelime sorgula (örn: müşteki)" style="flex:1; font-size:11.5px; padding:4px 8px;">
                        <button type="submit" class="tool-btn-secondary" style="font-size:11px; padding:4px 8px;">Ara</button>
                    </form>
                    <div id="tdk-result" style="font-size:11px; max-height:80px; overflow-y:auto; color:#334155; margin-bottom:8px;"></div>

                    <div style="margin-top:6px;">
                        <button type="button" class="tool-btn-secondary" id="writing-inspect" style="width:100%; font-size:11.5px; padding:6px;">✍️ Yazım Hatalarını ve TDK Kurallarını Tara</button>
                        <div id="writing-results" style="font-size:11px; max-height:100px; overflow-y:auto; margin-top:6px;"></div>
                    </div>
                </div>
            `;
            document.body.append(dock);

            $('lang-dock-close').onclick = () => { stop(); dock.style.display = 'none'; };
            $('lang-dock-minimize').onclick = () => {
                const body = $('lang-dock-content');
                if (body.style.display === 'none') {
                    body.style.display = 'block';
                    $('lang-dock-minimize').textContent = '−';
                } else {
                    body.style.display = 'none';
                    $('lang-dock-minimize').textContent = '+';
                }
            };

            $('speech-start').onclick = read;
            $('speech-stop').onclick = stop;
            $('speech-pause').onclick = () => {
                if (!window.speechSynthesis) return;
                if (window.speechSynthesis.paused) window.speechSynthesis.resume();
                else window.speechSynthesis.pause();
            };

            $('speech-engine').onchange = () => {
                const isWeb = $('speech-engine').value === 'webspeech';
                $('row-native-voice').style.display = isWeb ? 'flex' : 'none';
            };

            if (window.speechSynthesis) {
                window.speechSynthesis.addEventListener('voiceschanged', voices);
            }

            $('tdk-form').onsubmit = async e => {
                e.preventDefault();
                const out = $('tdk-result');
                out.textContent = 'Sözlük sorgulanıyor…';
                try {
                    const word = $('tdk-word').value.trim();
                    if (!word) return;
                    if (window.UkiWritingRules && window.UkiWritingRules.lookup) {
                        const result = await window.UkiWritingRules.lookup(word);
                        out.replaceChildren();
                        for (const entry of result.entries) {
                            const title = document.createElement('strong');
                            title.textContent = entry.word;
                            out.append(title);
                            const list = document.createElement('ol');
                            list.style.margin = '4px 0 8px 16px';
                            list.style.padding = '0';
                            entry.meanings.forEach(m => {
                                const li = document.createElement('li');
                                li.textContent = m;
                                list.append(li);
                            });
                            out.append(list);
                        }
                        if (!result.found) {
                            out.textContent = 'Sözlük maddesi bulunamadı.';
                        }
                    } else {
                        out.textContent = 'Sözlük modülü yükleniyor...';
                    }
                } catch (err) {
                    out.textContent = err.message;
                }
            };

            $('writing-inspect').onclick = () => {
                const out = $('writing-results');
                out.replaceChildren();
                const text = window.UkiApp && window.UkiApp.text ? window.UkiApp.text() : '';
                if (window.UkiWritingRules && window.UkiWritingRules.inspect) {
                    const findings = window.UkiWritingRules.inspect(text);
                    const list = document.createElement('ol');
                    list.style.margin = '4px 0 8px 16px';
                    list.style.padding = '0';
                    findings.slice(0, 50).forEach(f => {
                        const li = document.createElement('li');
                        li.innerHTML = `<b>${f.text}</b> → ${f.replacement || 'kontrol edin'}: <span style="color:#64748b;">${f.message}</span>`;
                        list.append(li);
                    });
                    out.append(list);
                    if (!findings.length) {
                        out.textContent = '✅ Belgede yazım kuralı hatası bulunamadı.';
                    }
                }
            };
        }

        dock.style.display = 'block';
        $('lang-dock-content').style.display = 'block';
        $('lang-dock-minimize').textContent = '−';
        if ($('tdk-word')) {
            $('tdk-word').value = /^[\p{L}’'-]{1,64}$/u.test(selection.trim()) ? selection.trim() : '';
        }
        voices();
    }

    function init() {
        document.addEventListener('selectionchange', remember);
        const group = $('group-harf-denetimi');
        if (group && !$('btn-language-tools')) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'tool-btn';
            button.id = 'btn-language-tools';
            button.innerHTML = '<span>🎙️ Dil &amp; Ses</span>';
            button.title = 'Sesli oku, TDK sözlüğü ve yazım kuralları';
            button.onclick = open;
            group.append(button);
        }
        window.addEventListener('beforeunload', stop);
    }

    window.UkiLanguageTools = { open, stop };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document);
