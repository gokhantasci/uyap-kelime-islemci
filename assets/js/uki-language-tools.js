/**
 * UYAP Kelime İşlemci (UKİ) - Gelişmiş Dil, Ses ve Yazım Araçları Paneli
 * Ekranı kilitlemeyen yüzen panel (floating dock).
 * Kullanıcı sesli dinleme yaparken editörde serbestçe yazabilir, yazım hatalarını düzeltebilir.
 * Piper TTS, Ema Lightning ve Web Speech API motorları ile TDK anlamsal sözlük denetimi içerir.
 */
(function(window, document) {
    'use strict';

    let selection = '', utterances = [], reading = false;
    let piperAudio = null;
    let currentSessionId = 0;

    const $ = id => document.getElementById(id);

    function remember() {
        const sel = window.getSelection();
        if (sel && sel.anchorNode && $('editor') && $('editor').contains(sel.anchorNode)) {
            selection = sel.toString();
        }
    }

    function stop() {
        reading = false;
        currentSessionId++;
        utterances = [];
        window._ukiActiveUtterance = null;
        if (window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch (_) {}
        }
        if (piperAudio) {
            try { piperAudio.pause(); } catch (_) {}
            piperAudio = null;
        }
        const status = $('speech-status');
        if (status) status.textContent = 'Okuma durduruldu.';
    }

    function getVoicesList() {
        if (!window.speechSynthesis || typeof window.speechSynthesis.getVoices !== 'function') return [];
        return window.speechSynthesis.getVoices() || [];
    }

    function resolveEngineVoice(engine, userChoice) {
        const all = getVoicesList();
        if (!all.length) return null;

        // Kullanıcı doğrudan belirli bir ses seçtiyse
        if (userChoice && userChoice !== 'auto') {
            const found = all.find(v => v.voiceURI === userChoice);
            if (found) return found;
        }

        const trVoices = all.filter(v => v.lang && (v.lang.toLowerCase().startsWith('tr') || v.lang.toLowerCase().includes('turkish')));

        if (engine === 'piper') {
            // Piper TTS: Doğal, oturaklı erkek / bariton Türkçe ses profili tercihi
            const malePatterns = /ahmet|tolga|cem|emre|yavuz|murat|can|hakan|mehmet|ali|erkek|male|baritone/i;
            const male = trVoices.find(v => malePatterns.test(v.name));
            if (male) return male;
            const femalePatterns = /emel|filiz|seda|gül|ayşe|fatma|zehra|zeynep|yelda|kadın|female/i;
            const nonFemale = trVoices.find(v => !femalePatterns.test(v.name));
            if (nonFemale) return nonFemale;
            if (trVoices.length > 0) return trVoices[0];
        } else if (engine === 'ema') {
            // Ema Lightning: Hızlı, çevik ve net kadın Türkçe ses profili tercihi
            const femalePatterns = /emel|filiz|seda|gül|ayşe|fatma|zehra|zeynep|yelda|kadın|female/i;
            const female = trVoices.find(v => femalePatterns.test(v.name));
            if (female) return female;
            const malePatterns = /ahmet|tolga|cem|emre|yavuz|murat|can|hakan|mehmet|ali|erkek|male|baritone/i;
            const nonMale = trVoices.find(v => !malePatterns.test(v.name));
            if (nonMale) return nonMale;
            if (trVoices.length > 0) return trVoices[0];
        }

        // Web Speech veya genel yedek: Türkçe ses
        if (trVoices.length > 0) return trVoices[0];

        // Sistemde Türkçe ses yoksa varsayılan ses
        return all.find(v => v.default) || all[0] || null;
    }

    function splitTextIntoChunks(rawText, maxLength = 160) {
        if (!rawText) return [];
        let clean = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
        if (!clean) return [];

        // Hukuki ve genel kısaltmalardaki noktaları geçici olarak koru (T.C., No., Av., vb.)
        clean = clean.replace(/\bT\.C\./gi, 'TC')
                     .replace(/\bNo\./gi, 'No')
                     .replace(/\bAv\./gi, 'Avukat')
                     .replace(/\bvd\./gi, 've diğerleri')
                     .replace(/\bvb\./gi, 've benzeri');

        // Cümle bitişleri ve satır sonlarına göre böler; Chrome 15 sn zaman aşımını engeller
        const rawChunks = clean.match(/[^.!?\n]+(?:[.!?]+|\n|$)/g) || [clean];
        const result = [];

        for (let c of rawChunks) {
            c = c.trim();
            if (!c || !/[\p{L}\p{N}]/u.test(c)) continue;
            if (c.length <= maxLength) {
                result.push(c);
            } else {
                // Uzun cümleleri virgül ve noktalı virgüllerden böl
                const sub = c.match(/[^,;]+(?:[,;]+|$)/g) || [c];
                for (let s of sub) {
                    s = s.trim();
                    if (s && /[\p{L}\p{N}]/u.test(s)) result.push(s);
                }
            }
        }
        return result.length > 0 ? result : [clean];
    }

    let localServerStatus = { piper: null, ema: null };

    // Gerçek Piper TTS: model 657.com.tr/modeller/piper/ altından indirilip tarayıcıda (Web Worker + WASM) çalışır.
    let piperWorker = null;
    let piperJobSeq = 0;
    let piperFailedAt = 0;
    let lastNeuralSource = '';

    function browserPiper(text, onProgress) {
        if (typeof Worker === 'undefined' || Date.now() - piperFailedAt < 60000) return Promise.resolve(null);
        return new Promise((resolve) => {
            let w = piperWorker;
            try {
                if (!w) {
                    w = piperWorker = new Worker(new URL('assets/js/piper-worker.js', document.baseURI).href);
                }
            } catch (_) { piperFailedAt = Date.now(); resolve(null); return; }
            const id = ++piperJobSeq;
            const cleanup = () => { w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); };
            const fail = () => { cleanup(); piperFailedAt = Date.now(); try { w.terminate(); } catch (_) {} if (piperWorker === w) piperWorker = null; resolve(null); };
            const onMsg = (ev) => {
                const d = ev.data || {};
                if (d.type === 'progress') { if (onProgress) onProgress(d.value); return; }
                if (d.id !== id) return;
                if (d.type === 'audio') {
                    cleanup();
                    const blob = d.wav instanceof Blob ? d.wav : new Blob([d.wav], { type: 'audio/wav' });
                    resolve(blob.size > 200 ? URL.createObjectURL(blob) : null);
                } else if (d.type === 'error') {
                    console.warn('Piper (tarayıcı) hatası:', d.message);
                    fail();
                }
            };
            const onErr = (e) => { console.warn('Piper çalışanı hata verdi:', e && e.message); fail(); };
            w.addEventListener('message', onMsg);
            w.addEventListener('error', onErr);
            w.postMessage({ id, text });
        });
    }

    async function tryLocalNeuralTts(engine, textChunk, onProgress) {
        lastNeuralSource = '';
        if (engine === 'piper') {
            const url = await browserPiper(textChunk, onProgress);
            if (url) { lastNeuralSource = 'browser'; return url; }
        }
        const fetchFn = (window && window.fetch) || (typeof fetch !== 'undefined' ? fetch : null);
        if (!fetchFn || localServerStatus[engine] === false) return null;

        const endpoint = engine === 'piper' ? 'http://127.0.0.1:5000/api/tts' : 'http://127.0.0.1:8000/tts';

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 150);
            const res = await fetchFn(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textChunk, lang: 'tr' }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                localServerStatus[engine] = endpoint;
                const blob = await res.blob();
                if (blob && blob.size > 200) {
                    return URL.createObjectURL(blob);
                }
            } else {
                localServerStatus[engine] = false;
            }
        } catch (_) {
            localServerStatus[engine] = false;
        }
        return null;
    }

    function speakViaWebSpeech(chunkText, engine, voice, userRate, progressLabel, sessionId, onDone) {
        if (!window.speechSynthesis) {
            if (window.showToast) window.showToast('Tarayıcınız sesli okumayı desteklemiyor.', 'warning');
            reading = false;
            return;
        }

        const UtteranceClass = window.SpeechSynthesisUtterance || (typeof SpeechSynthesisUtterance !== 'undefined' ? SpeechSynthesisUtterance : null);
        if (!UtteranceClass) return;
        const u = new UtteranceClass(chunkText);
        u.lang = 'tr-TR';

        // Chrome & Windows hatasını önlemek için açıkça atanır
        if (voice) {
            u.voice = voice;
        }

        // Motora özel akustik ve ton ayarı
        if (engine === 'piper') {
            u.pitch = 0.95; // Doğal, derin bariton tınısı
            u.rate = userRate * 0.98;
        } else if (engine === 'ema') {
            u.pitch = 1.08; // Çevik, enerjik ve net kadın tınısı
            u.rate = userRate * 1.12;
        } else {
            u.pitch = 1.0;
            u.rate = userRate;
        }

        const status = $('speech-status');
        const enginePrefix = engine === 'piper' ? '🎙️ Piper TTS' : (engine === 'ema' ? '⚡ Ema Lightning' : '🔊 Okunuyor');
        const voiceName = voice ? ` (${voice.name.replace(/\(.*?\)/g, '').trim()})` : '';

        if (status) status.textContent = `${enginePrefix}${voiceName}: ${progressLabel}`;

        u.onend = () => {
            if (!reading || sessionId !== currentSessionId) return;
            onDone();
        };

        u.onerror = (ev) => {
            if (ev && (ev.error === 'canceled' || ev.error === 'interrupted')) return;
            if (sessionId !== currentSessionId) return;
            reading = false;
            window._ukiActiveUtterance = null;
            if (status) {
                if (ev && ev.error === 'language-unavailable') {
                    status.textContent = '⚠️ Türkçe ses paketi bulunamadı. Lütfen işletim sistemi dil ayarlarından Türkçe ses ekleyin.';
                } else {
                    status.textContent = `Ses motoru durdu (${(ev && ev.error) || 'tamamlandı'}).`;
                }
            }
        };

        // Chrome GC koruması
        window._ukiActiveUtterance = u;
        utterances = [u];

        window.speechSynthesis.speak(u);
    }

    function read() {
        stop();
        const text = selection.trim() || (window.UkiApp && window.UkiApp.text ? window.UkiApp.text() : '');
        if (!text.trim()) {
            if (window.showToast) window.showToast('Okunacak metin bulunamadı.', 'warning');
            return;
        }

        const engine = ($('speech-engine') && $('speech-engine').value) || 'webspeech';
        const userVoiceChoice = $('speech-voice')?.value || 'auto';
        const userRate = Number($('speech-rate')?.value) || 1;

        const chunks = splitTextIntoChunks(text);
        if (!chunks.length) {
            if (window.showToast) window.showToast('Okunacak geçerli metin bulunamadı.', 'warning');
            return;
        }

        reading = true;
        const sessionId = ++currentSessionId;
        if (window.UkiStats) window.UkiStats.recordFeature('speech');

        const status = $('speech-status');
        const voice = resolveEngineVoice(engine, userVoiceChoice);
        let index = 0;

        const playNextChunk = async () => {
            if (!reading || sessionId !== currentSessionId) return;
            if (index >= chunks.length) {
                reading = false;
                window._ukiActiveUtterance = null;
                if (status) status.textContent = '✅ Okuma tamamlandı.';
                return;
            }

            const chunkText = chunks[index++];
            const progressLabel = `${index} / ${chunks.length}`;

            // 1. Yerel Piper veya Ema sunucusu varsa oradan çalmayı dene
            if (engine === 'piper' || engine === 'ema') {
                try {
                    if (engine === 'piper' && status && !piperWorker) status.textContent = '⬇ Piper sesi hazırlanıyor…';
                    const audioUrl = await tryLocalNeuralTts(engine, chunkText, (pct) => { if (status && reading) status.textContent = `⬇ Piper sesi indiriliyor (ilk kullanımda ~60 MB, sonra önbellekten): %${pct}`; });
                    if (audioUrl && reading && sessionId === currentSessionId) {
                        if (status) status.textContent = `🎙️ ${engine === 'piper' ? (lastNeuralSource === 'browser' ? 'Piper TTS (Fahrettin, tarayıcıda)' : 'Piper TTS (Yerel sunucu)') : 'Ema Lightning (Yerel sunucu)'}: ${progressLabel}`;
                        piperAudio = new Audio(audioUrl);
                        piperAudio.playbackRate = userRate;
                        piperAudio.onended = () => {
                            URL.revokeObjectURL(audioUrl);
                            piperAudio = null;
                            if (reading && sessionId === currentSessionId) playNextChunk();
                        };
                        piperAudio.onerror = () => {
                            URL.revokeObjectURL(audioUrl);
                            piperAudio = null;
                            if (reading && sessionId === currentSessionId) {
                                speakViaWebSpeech(chunkText, engine, voice, userRate, progressLabel, sessionId, playNextChunk);
                            }
                        };
                        piperAudio.play().catch(() => {
                            if (reading && sessionId === currentSessionId) {
                                speakViaWebSpeech(chunkText, engine, voice, userRate, progressLabel, sessionId, playNextChunk);
                            }
                        });
                        return;
                    }
                } catch (_) {
                    // Yerel akış yoksa devam et
                }
            }

            if (!reading || sessionId !== currentSessionId) return;
            // 2. Tarayıcı nöral ses profili ile seslendir
            speakViaWebSpeech(chunkText, engine, voice, userRate, progressLabel, sessionId, playNextChunk);
        };

        // Önceki ses kuyruğunu temizle ve küçük bir gecikmeyle başlat
        if (window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch (_) {}
        }
        setTimeout(() => {
            if (reading && sessionId === currentSessionId) playNextChunk();
        }, 50);
    }

    function updateVoiceDropdown() {
        const field = $('speech-voice');
        const label = $('lbl-speech-voice');
        if (!field) return;

        const engine = ($('speech-engine') && $('speech-engine').value) || 'webspeech';
        const all = getVoicesList();
        const trVoices = all.filter(v => v.lang && (v.lang.toLowerCase().startsWith('tr') || v.lang.toLowerCase().includes('turkish')));

        field.replaceChildren();

        if (engine === 'piper') {
            if (label) label.textContent = 'Piper Profili:';
            const autoOpt = document.createElement('option');
            autoOpt.value = 'auto';
            autoOpt.selected = true;
            autoOpt.textContent = '🎯 Fahrettin (Piper, tarayıcıda çalışır)';
            field.append(autoOpt);

            trVoices.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.voiceURI;
                opt.textContent = `🎙️ ${v.name} (${v.lang})`;
                field.append(opt);
            });
            field.value = 'auto';
        } else if (engine === 'ema') {
            if (label) label.textContent = 'Ema Profili:';
            const autoOpt = document.createElement('option');
            autoOpt.value = 'auto';
            autoOpt.selected = true;
            autoOpt.textContent = '⚡ Ema Lightning (yerel sunucu gerekir; yoksa sistem sesi)';
            field.append(autoOpt);

            trVoices.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.voiceURI;
                opt.textContent = `⚡ ${v.name} (${v.lang})`;
                field.append(opt);
            });
            field.value = 'auto';
        } else {
            if (label) label.textContent = 'Tarayıcı Sesi:';
            all.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.voiceURI;
                opt.textContent = `${v.name} (${v.lang})`;
                opt.selected = v.lang.toLowerCase().startsWith('tr');
                field.append(opt);
            });
            if (all.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Sistem varsayılan sesi';
                field.append(opt);
            }
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
                        <h4 style="margin:0; font-size:13px; font-weight:600; color:var(--ax-color-neutral-900, #0f172a);">Dil &amp; Ses Araçları (UKİ)</h4>
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
                            <option value="piper" selected>Piper TTS (Doğal Türkçe Nöral, tarayıcıda)</option>
                            <option value="ema">Ema Lightning (yerel sunucu gerekir)</option>
                            <option value="webspeech">Tarayıcı Yerel Sesi (Web Speech)</option>
                        </select>
                    </div>

                    <div class="lang-dock-row" id="row-native-voice">
                        <label for="speech-voice" id="lbl-speech-voice">Piper Profili:</label>
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
                        <div id="writing-results" style="font-size:11px; max-height:180px; overflow-y:auto; margin-top:8px;"></div>
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
                if (piperAudio) {
                    if (piperAudio.paused) {
                        piperAudio.play();
                        if ($('speech-status')) $('speech-status').textContent = 'Okuma devam ediyor...';
                    } else {
                        piperAudio.pause();
                        if ($('speech-status')) $('speech-status').textContent = 'Duraklatıldı.';
                    }
                    return;
                }
                if (!window.speechSynthesis) return;
                if (window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                    if ($('speech-status')) $('speech-status').textContent = 'Okuma devam ediyor...';
                } else if (window.speechSynthesis.speaking) {
                    window.speechSynthesis.pause();
                    if ($('speech-status')) $('speech-status').textContent = 'Duraklatıldı.';
                }
            };

            $('speech-engine').onchange = () => {
                updateVoiceDropdown();
            };

            if (window.speechSynthesis) {
                window.speechSynthesis.addEventListener('voiceschanged', updateVoiceDropdown);
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
                if (!text.trim()) {
                    out.innerHTML = '<div style="color:#64748b; font-size:11px; padding:4px 0;">İncelenecek metin bulunamadı.</div>';
                    return;
                }
                if (window.UkiWritingRules && window.UkiWritingRules.inspect) {
                    const findings = window.UkiWritingRules.inspect(text);
                    if (!findings.length) {
                        out.innerHTML = '<div style="color:#16a34a; font-weight:500; font-size:11px; padding:6px 0;">✅ Belgede yazım kuralı veya TDK hatası bulunamadı.</div>';
                        return;
                    }

                    const countHeader = document.createElement('div');
                    countHeader.style.cssText = 'font-size:11px; font-weight:600; color:#475569; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;';
                    countHeader.innerHTML = `<span>🔍 Bulunan Uyarılar (${findings.length})</span><span style="font-size:10px; color:#2563eb;">📍 Belgede görmek için tıklayın</span>`;
                    out.append(countHeader);

                    const list = document.createElement('div');
                    list.style.cssText = 'display:flex; flex-direction:column; gap:6px;';

                    const wordOccurrenceMap = {};
                    findings.slice(0, 50).forEach((f) => {
                        const key = f.text.toLocaleLowerCase('tr-TR');
                        f.occurrenceIndex = wordOccurrenceMap[key] || 0;
                        wordOccurrenceMap[key] = f.occurrenceIndex + 1;

                        const card = document.createElement('div');
                        card.className = 'writing-finding-card';
                        card.style.cssText = 'padding:6px 8px; border-radius:6px; border:1px solid #e2e8f0; background:#ffffff; cursor:pointer; transition:all 0.15s ease; box-shadow:0 1px 2px rgba(0,0,0,0.03); user-select:none;';

                        card.onmouseenter = () => {
                            if (!card.dataset.active) card.style.background = '#f8fafc';
                        };
                        card.onmouseleave = () => {
                            if (!card.dataset.active) card.style.background = '#ffffff';
                        };

                        const headerRow = document.createElement('div');
                        headerRow.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:4px;';

                        const wordsCol = document.createElement('div');
                        wordsCol.style.cssText = 'display:flex; align-items:center; gap:4px; flex-wrap:wrap;';
                        wordsCol.innerHTML = `
                            <span class="finding-orig" style="color:#b91c1c; font-weight:700; background:#fee2e2; padding:1px 5px; border-radius:4px; font-size:11px;">${f.text}</span>
                            <span style="color:#16a34a; font-weight:600; font-size:11px;">→ ${f.replacement || 'kontrol edin'}</span>
                        `;

                        const jumpBadge = document.createElement('span');
                        jumpBadge.style.cssText = 'font-size:10px; color:#2563eb; font-weight:500; display:flex; align-items:center; gap:2px;';
                        jumpBadge.innerHTML = '📍 Göster';
                        headerRow.append(wordsCol, jumpBadge);

                        const msgRow = document.createElement('div');
                        msgRow.style.cssText = 'font-size:10.5px; color:#64748b; margin-top:3px; line-height:1.3;';
                        msgRow.textContent = f.message;

                        card.append(headerRow, msgRow);

                        if (f.replacement && f.replacement !== f.text) {
                            const actionsRow = document.createElement('div');
                            actionsRow.style.cssText = 'margin-top:5px; display:flex; justify-content:flex-end; gap:6px;';

                            const btnFix = document.createElement('button');
                            btnFix.type = 'button';
                            btnFix.className = 'tool-btn-primary';
                            btnFix.style.cssText = 'padding:2px 8px; font-size:10px; border-radius:4px; background:#16a34a; border-color:#16a34a; color:#fff; cursor:pointer;';
                            btnFix.textContent = '✍️ Düzelt';

                            btnFix.onclick = (e) => {
                                e.stopPropagation();
                                replaceFindingInEditor(f, () => {
                                    const origSpan = card.querySelector('.finding-orig');
                                    if (origSpan) {
                                        origSpan.style.textDecoration = 'line-through';
                                        origSpan.style.opacity = '0.6';
                                    }
                                    btnFix.disabled = true;
                                    btnFix.style.background = '#94a3b8';
                                    btnFix.style.borderColor = '#94a3b8';
                                    btnFix.textContent = '✅ Düzeltildi';
                                });
                            };

                            actionsRow.append(btnFix);
                            card.append(actionsRow);
                        }

                        // Kart tıklandığında belgede ilgili kelimeyi göster ve odaklan
                        card.onclick = () => {
                            list.querySelectorAll('.writing-finding-card').forEach(c => {
                                delete c.dataset.active;
                                c.style.background = '#ffffff';
                                c.style.borderColor = '#e2e8f0';
                            });
                            card.dataset.active = 'true';
                            card.style.background = '#eff6ff';
                            card.style.borderColor = '#3b82f6';

                            const found = highlightFindingInEditor(f.text, f.occurrenceIndex);
                            if (found && window.showToast) {
                                window.showToast(`Belgede "${f.text}" kelimesine odaklanıldı.`, 'info');
                            }
                        };

                        list.append(card);
                    });
                    out.append(list);
                }
            };
        }

        dock.style.display = 'block';
        $('lang-dock-content').style.display = 'block';
        $('lang-dock-minimize').textContent = '−';
        if ($('tdk-word')) {
            $('tdk-word').value = /^[\p{L}’'-]{1,64}$/u.test(selection.trim()) ? selection.trim() : '';
        }
        updateVoiceDropdown();
    }

    function highlightFindingInEditor(targetText, occurrenceIndex = 0) {
        const editor = $('editor');
        if (!editor || !targetText) return false;

        const NF = window.NodeFilter || (typeof NodeFilter !== 'undefined' ? NodeFilter : { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 });
        const textNodes = [];
        const walker = document.createTreeWalker(editor, NF.SHOW_TEXT, {
            acceptNode: (n) => {
                if (!n || !n.nodeValue) return NF.FILTER_REJECT;
                if (n.parentElement && n.parentElement.closest('[contenteditable="false"], .pb-header, .pb-footer, .pb-spacer')) {
                    return NF.FILTER_REJECT;
                }
                return NF.FILTER_ACCEPT;
            }
        });

        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }
        if (!textNodes.length) return false;

        let fullText = '';
        const nodeRanges = [];
        for (const tn of textNodes) {
            const val = tn.nodeValue || '';
            const start = fullText.length;
            const end = start + val.length;
            nodeRanges.push({ node: tn, start, end });
            fullText += val;
        }

        const lowerFull = fullText.toLocaleLowerCase('tr-TR');
        const lowerTarget = targetText.toLocaleLowerCase('tr-TR');
        const occurrences = [];
        let pos = 0;
        while (pos < lowerFull.length) {
            const idx = lowerFull.indexOf(lowerTarget, pos);
            if (idx === -1) break;
            occurrences.push({ start: idx, end: idx + targetText.length });
            pos = idx + Math.max(1, targetText.length);
        }

        if (!occurrences.length) return false;

        const chosenIdx = Math.min(Math.max(0, occurrenceIndex || 0), occurrences.length - 1);
        const chosen = occurrences[chosenIdx];
        const matchStart = chosen.start;
        const matchEnd = chosen.end;

        let startNode = null, startOffset = 0;
        let endNode = null, endOffset = 0;

        for (const nr of nodeRanges) {
            if (!startNode && nr.end > matchStart && nr.start <= matchStart) {
                startNode = nr.node;
                startOffset = matchStart - nr.start;
            }
            if (nr.end >= matchEnd && nr.start < matchEnd) {
                endNode = nr.node;
                endOffset = matchEnd - nr.start;
                break;
            }
        }

        if (!startNode || !endNode) {
            const overlapping = nodeRanges.filter(nr => nr.end > matchStart && nr.start < matchEnd);
            if (overlapping.length > 0) {
                startNode = overlapping[0].node;
                startOffset = Math.max(0, matchStart - overlapping[0].start);
                endNode = overlapping[overlapping.length - 1].node;
                endOffset = Math.min(overlapping[overlapping.length - 1].node.nodeValue.length, matchEnd - overlapping[overlapping.length - 1].start);
            }
        }

        if (!startNode || !endNode) return false;

        try {
            const range = document.createRange();
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);

            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
            }

            const parentEl = startNode.parentElement || editor;
            if (parentEl && parentEl.scrollIntoView) {
                parentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            // Gözle takibi kolaylaştıran sarı odak animasyonu
            const prevBg = parentEl.style.backgroundColor;
            const prevTransition = parentEl.style.transition;
            parentEl.style.transition = 'background-color 0.25s ease';
            parentEl.style.backgroundColor = '#fef08a';
            setTimeout(() => {
                parentEl.style.backgroundColor = prevBg;
                setTimeout(() => { parentEl.style.transition = prevTransition; }, 300);
            }, 1400);

            return true;
        } catch (_) {
            return false;
        }
    }

    function replaceFindingInEditor(finding, onDone) {
        if (!finding || !finding.text || !finding.replacement) return false;
        const success = highlightFindingInEditor(finding.text, finding.occurrenceIndex || 0);
        if (!success) {
            if (window.showToast) window.showToast('Kelime belgede bulunamadı.', 'warning');
            return false;
        }

        try {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                const replacementNode = document.createTextNode(finding.replacement);
                range.insertNode(replacementNode);

                range.setStartAfter(replacementNode);
                range.setEndAfter(replacementNode);
                sel.removeAllRanges();
                sel.addRange(range);

                const editor = $('editor');
                if (editor) {
                    editor.dispatchEvent(new Event('input', { bubbles: true }));
                }

                if (window.showToast) {
                    window.showToast(`"${finding.text}" → "${finding.replacement}" olarak düzeltildi.`, 'success');
                }
                if (typeof onDone === 'function') onDone();
                return true;
            }
        } catch (_) {}
        return false;
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

    window.UkiLanguageTools = {
        open,
        stop,
        read,
        resolveEngineVoice,
        updateVoiceDropdown,
        splitTextIntoChunks,
        highlightFindingInEditor,
        replaceFindingInEditor
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document);
