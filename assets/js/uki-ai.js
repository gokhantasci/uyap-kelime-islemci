/**
 * UkiAI - Tarayıcı İçi Yapay Zeka & WebGPU Destekli Hukuk Asistanı
 * 
 * Özellikler:
 * 1. Tarayıcıda yerleşik AI (Chrome Built-in AI / Prompt API - Gemini Nano) otomatik tespiti.
 * 2. Donanım hızlandırmalı WebGPU (navigator.gpu) tespiti ve hızlandırması.
 * 3. %100 gizli ve istemci tarafında (offline) çalışan anlamsal hukuk belgesi çözümleyicisi.
 * 4. Otomatik belge özeti: "Bu belge ne hakkında, ne anlatıyor, hüküm ve süreler nedir?".
 * 5. Belgeye soru sorma (Etkileşimli Chat / Q&A) ve hazır hukuki soru hapları.
 * 6. İsteğe bağlı yerel Ollama (localhost:11434) veya özel API anahtarı desteği.
 */

(function(window) {
    'use strict';

    // Model Durumu
    let aiStatus = {
        hasChromeAi: false,
        chromeAiState: 'unknown', // 'readily' | 'after-download' | 'no'
        hasWebGpu: false,
        gpuInfo: null,
        hasOllama: false,
        ollamaModel: 'llama3.2',
        customApiKey: '',
        customEndpoint: '',
        activeBackend: 'local-rule' // 'chrome-ai' | 'webgpu' | 'ollama' | 'custom-api' | 'local-rule'
    };

    let chromeSession = null;
    let gpuEngine = null;
    let isAnalyzing = false;
    let chatHistory = [];
    let currentSummaryData = null;

    function notify(msg, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(msg, type);
        } else if (window.UkiDialog && typeof window.UkiDialog.alert === 'function') {
            window.UkiDialog.alert(msg, { title: 'UYAP Hukuk Asistanı' });
        } else {
            console.log(`[UkiAI] ${msg}`);
        }
    }

    // --------------------------------------------------------------------------
    // 1. DONANIM VE YAPAY ZEKA MODELİ TESPİTİ (DETECTION)
    // --------------------------------------------------------------------------

    async function detectAiCapabilities() {
        // 1. Chrome Built-in AI (Prompt API / Gemini Nano) Denetimi
        try {
            if (window.LanguageModel) {
                const state = await window.LanguageModel.availability();
                aiStatus.hasChromeAi = state !== 'unavailable';
                aiStatus.chromeAiState = state === 'available' ? 'readily' : state;
                if (state === 'available') aiStatus.activeBackend = 'chrome-ai';
            } else if (window.ai && window.ai.languageModel) {
                const caps = await window.ai.languageModel.capabilities();
                aiStatus.hasChromeAi = (caps && caps.available !== 'no');
                aiStatus.chromeAiState = caps ? caps.available : 'no';
                if (aiStatus.hasChromeAi && aiStatus.chromeAiState === 'readily') {
                    aiStatus.activeBackend = 'chrome-ai';
                }
            } else if (window.model && window.model.languageModel) {
                aiStatus.hasChromeAi = true;
                aiStatus.chromeAiState = 'readily';
                aiStatus.activeBackend = 'chrome-ai';
            }
        } catch (e) {
            console.warn('[UkiAI] Chrome AI tespiti sırasında hata:', e);
        }

        // 2. WebGPU Donanım Hızlandırma Tespiti
        try {
            if (navigator.gpu) {
                const adapter = await navigator.gpu.requestAdapter();
                if (adapter) {
                    aiStatus.hasWebGpu = true;
                    if (adapter.info) {
                        aiStatus.gpuInfo = adapter.info.device || adapter.info.description || 'Donanım Hızlandırmalı WebGPU';
                    } else {
                        aiStatus.gpuInfo = 'WebGPU Donanım Adaptörü Aktif';
                    }
                    // GPU bulunması model yüklendiği anlamına gelmez.
                }
            }
        } catch (e) {
            console.warn('[UkiAI] WebGPU tespiti sırasında hata:', e);
        }

        // 3. Yerel Depolanmış Ayarları Yükle
        try {
            const savedKey = localStorage.getItem('uki_ai_api_key');
            const savedEp = localStorage.getItem('uki_ai_endpoint');
            const savedBackend = localStorage.getItem('uki_ai_backend');
            if (savedKey) aiStatus.customApiKey = savedKey;
            if (savedEp) aiStatus.customEndpoint = savedEp;
            if (savedBackend) aiStatus.activeBackend = savedBackend;
        } catch (e) {}

        // 4. Sessizce Ollama Testi (localhost:11434)
        testOllamaConnection().catch(() => {});

        updateTopbarBadge();
    }

    async function testOllamaConnection() {
        try {
            const res = await fetch('http://localhost:11434/api/tags', { method: 'GET', signal: AbortSignal.timeout(1500) });
            if (res.ok) {
                const data = await res.json();
                if (data && data.models && data.models.length > 0) {
                    aiStatus.hasOllama = true;
                    aiStatus.ollamaModel = data.models[0].name || 'llama3.2';
                }
            }
        } catch (e) {
            aiStatus.hasOllama = false;
        }
    }

    function updateTopbarBadge() {
        const badge = document.getElementById('ai-provider-badge');
        if (!badge) return;

        if (aiStatus.hasChromeAi && aiStatus.chromeAiState === 'readily') {
            badge.textContent = '⚡ Gemini Nano';
            badge.className = 'ai-badge-indicator ai-badge-green';
            badge.title = 'Tarayıcı Yerleşik Yapay Zekası Aktif (%100 Çevrimdışı ve Gizli)';
        } else if (aiStatus.hasWebGpu) {
            badge.textContent = gpuEngine ? 'WebGPU modeli hazır' : 'WebGPU mevcut';
            badge.className = 'ai-badge-indicator ai-badge-blue';
            badge.title = 'WebGPU Donanım Hızlandırması Aktif';
        } else if (aiStatus.hasOllama) {
            badge.textContent = '🦙 Ollama';
            badge.className = 'ai-badge-indicator ai-badge-purple';
            badge.title = 'Yerel Ollama Modeli Aktif';
        } else {
            badge.textContent = '🧠 Akıllı Analiz';
            badge.className = 'ai-badge-indicator ai-badge-gray';
            badge.title = 'Yerel Anlamsal Hukuk Çözümleyicisi Aktif';
        }
    }

    // --------------------------------------------------------------------------
    // 2. BELGE METNİNİ ÇEKME VE DERİN HUKUKİ ANALİZ (EXTRACTION)
    // --------------------------------------------------------------------------

    function getCleanDocumentText() {
        if (window.UkiApp) return window.UkiApp.text();
        const editor = document.getElementById('editor');
        if (!editor) return '';
        // Editör içindeki antet, filigran ve sayfa ayraçları hariç saf metni al
        const clone = editor.cloneNode(true);
        const ignored = clone.querySelectorAll('#page-boundaries-layer, #antet-layer, #watermark-layer, .page-break-line');
        ignored.forEach(el => el.remove());
        return (clone.innerText || clone.textContent || '').trim();
    }

    /**
     * Kural ve Varlık Tabanlı Derin Hukuki Analizci (0ms, %100 Çevrimdışı Güvenilir)
     */
    function extractLegalFacts(text) {
        if (!text || text.length < 20) {
            return {
                docType: "Boş veya Çok Kısa Belge",
                court: "Belirtilmemiş",
                merci: "Belirtilmemiş",
                basisNo: "-",
                decisionNo: "-",
                date: "-",
                parties: {},
                subject: "-",
                verdict: "-",
                legalRemedy: "-",
                keyPoints: ["Belgede henüz yeterli metin bulunmuyor."]
            };
        }

        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const facts = {
            docType: "Hukuki Belge",
            court: "",
            basisNo: "",
            decisionNo: "",
            date: "",
            parties: {
                plaintiff: "", // Davacı / Müşteki
                defendant: "", // Davalı / Sanık
                lawyer: "",    // Vekil / Müdafi
                other: ""
            },
            subject: "",
            verdict: "",
            legalRemedy: "",
            keyPoints: [],
            statWords: text.split(/\s+/).length,
            statChars: text.length
        };

        // Belge Türü & Mahkeme Tespiti
        for (let i = 0; i < Math.min(15, lines.length); i++) {
            const l = lines[i];
            if (/MAHKEMESİ|HUKUK DAİRESİ|CEZA DAİRESİ|BAŞSAVCILIĞI|HAKİMLİĞİ|İCRA MÜDÜRLÜĞÜ/i.test(l)) {
                if (!facts.court) facts.court = l;
            }
            if (/GEREKÇELİ KARAR/i.test(l)) facts.docType = "Gerekçeli Mahkeme Kararı";
            else if (/TENSİP ZAPTI/i.test(l)) facts.docType = "Tensip Zaptı";
            else if (/İDDİANAME/i.test(l)) facts.docType = "Cumhuriyet Başsavcılığı İddianamesi";
            else if (/DAVA DİLEKÇESİ/i.test(l)) facts.docType = "Dava Dilekçesi";
            else if (/CEVAP DİLEKÇESİ/i.test(l)) facts.docType = "Cevap Dilekçesi";
            else if (/BİLİRKİŞİ RAPORU/i.test(l)) facts.docType = "Bilirkişi Raporu";
            else if (/İCRA EMRİ/i.test(l)) facts.docType = "İcra Emri / Takip Talebi";
            else if (/İHTARNAME/i.test(l)) facts.docType = "Noter İhtarnamesi";
        }

        // Esas ve Karar No
        const mEsas = text.match(/(?:ESAS\s*NO|Esas\s*No)\s*[:.\s]+([0-9\/\s\-]+)/i);
        if (mEsas) facts.basisNo = mEsas[1].trim();

        const mKarar = text.match(/(?:KARAR\s*NO|Karar\s*No)\s*[:.\s]+([0-9\/\s\-]+)/i);
        if (mKarar) facts.decisionNo = mKarar[1].trim();

        const mDate = text.match(/(?:KARAR\s*TARİHİ|Karar\s*Tarihi|Tarih)\s*[:.\s]+([0-9]{1,2}[\.\/\-][0-9]{1,2}[\.\/\-][0-9]{2,4})/i);
        if (mDate) facts.date = mDate[1].trim();

        // Taraflar
        const mDavaci = text.match(/(?:DAVACI|MÜŞTEKİ|KATILAN|ŞİKAYETÇİ|ALACAKLI)\s*[:.\s]+([^\n\r]+)/i);
        if (mDavaci) facts.parties.plaintiff = mDavaci[1].replace(/T\.?C\.?\s*No.*/i, '').trim();

        const mDavali = text.match(/(?:DAVALI|SANIK|ŞÜPHELİ|BORÇLU)\s*[:.\s]+([^\n\r]+)/i);
        if (mDavali) facts.parties.defendant = mDavali[1].replace(/T\.?C\.?\s*No.*/i, '').trim();

        const mVekil = text.match(/(?:VEKİLİ?|MÜDAFİİ?)\s*[:.\s]+([^\n\r]+)/i);
        if (mVekil) facts.parties.lawyer = mVekil[1].trim();

        // Dava / Suç Konusu
        const mKonu = text.match(/(?:DAVA\s*KONUSU|DAVANIN\s*KONUSU|SUÇ|TALEP\s*KONUSU|TALEP)\s*[:.\s]+([^\n\r]+)/i);
        if (mKonu) facts.subject = mKonu[1].trim();

        // Hüküm / Sonuç Çıkarımı
        const hukumMatch = text.match(/(?:HÜKÜM|GEREĞİ DÜŞÜNÜLDÜ|SONUÇ)\s*[:;.\s]+([\s\S]+?)(?:Gerekçeli karar|Kanun yolu|Katip|Hakim|$)/i);
        if (hukumMatch) {
            facts.verdict = hukumMatch[1].trim();
        } else {
            // Hüküm fıkrası kelimelerinden yakala
            if (/DAVANIN KABULÜNE/i.test(text)) facts.verdict = "Davanın KABULÜNE karar verilmiştir.";
            else if (/DAVANIN REDDİNE/i.test(text)) facts.verdict = "Davanın REDDİNE karar verilmiştir.";
            else if (/BERAATİNE/i.test(text)) facts.verdict = "Sanığın BERAATİNE karar verilmiştir.";
            else if (/CEZALANDIRILMASINA|MAHKUMİYETİNE/i.test(text)) facts.verdict = "Sanığın MAHKUMİYETİNE / Cezalandırılmasına karar verilmiştir.";
            else if (/KISMEN KABUL/i.test(text)) facts.verdict = "Davanın KISMEN KABULÜNE, kısmen reddine karar verilmiştir.";
        }

        // Kanun Yolu (İstinaf / Temyiz / İtiraz Süresi)
        const remedyMatch = text.match(/(?:tebliğ(?:inden)?\s*itibaren|kararın\s*tebliğinden|tefhimden\s*itibaren)[\s\S]{0,120}?(?:istinaf|temyiz|itiraz|bölge adliye|yargıtay)[\s\S]{0,120}?(?:mahkemesine|yoluyla|kabul edilmek üzere|süresi içerisinde|\.)/i);
        if (remedyMatch) {
            facts.legalRemedy = remedyMatch[0].replace(/\s+/g, ' ').trim();
        } else {
            const mSimple = text.match(/([0-9]+\s*(?:gün|hafta)\s*içinde[\s\S]{0,80}?(?:istinaf|temyiz|itiraz))/i);
            if (mSimple) facts.legalRemedy = mSimple[0].trim();
        }

        // Otomatik Önemli Çıkarımlar
        if (facts.court) facts.keyPoints.push(`🏛️ Merci: ${facts.court}`);
        if (facts.basisNo || facts.decisionNo) facts.keyPoints.push(`📂 Dosya No: Esas ${facts.basisNo || '-'} / Karar ${facts.decisionNo || '-'}`);
        if (facts.parties.plaintiff) facts.keyPoints.push(`👤 Davacı / Müşteki: ${facts.parties.plaintiff}`);
        if (facts.parties.defendant) facts.keyPoints.push(`👥 Davalı / Sanık: ${facts.parties.defendant}`);
        if (facts.subject) facts.keyPoints.push(`📌 Uyuşmazlık Konusu: ${facts.subject}`);
        if (facts.legalRemedy) facts.keyPoints.push(`⏱️ Kanun Yolu / Süre: ${facts.legalRemedy}`);

        return facts;
    }

    // --------------------------------------------------------------------------
    // 3. YAPAY ZEKA MODEL ÇALIŞTIRICISI (RUNNER)
    // --------------------------------------------------------------------------

    /**
     * Chrome Built-in AI (Prompt API) ile çalıştırma
     */
    async function promptChromeAi(systemPrompt, userPrompt) {
        const model = window.LanguageModel || (window.ai && window.ai.languageModel) || (window.model && window.model.languageModel);
        if (!model) throw new Error('Tarayıcı yerleşik dil modelini desteklemiyor.');
        if (!chromeSession) {
            chromeSession = await model.create(window.LanguageModel ? {initialPrompts:[{role:'system',content:systemPrompt}]} : {systemPrompt});
        }
        return await chromeSession.prompt(userPrompt);
    }

    async function loadGpuModel() {
        const button = document.getElementById('btn-load-gpu-model');
        const status = document.getElementById('gpu-model-progress');
        button.disabled = true;
        try {
            if (!navigator.gpu) throw new Error('Bu tarayıcıda WebGPU yok.');
            const webllm = await import('https://esm.run/@mlc-ai/web-llm@0.2.88');
            const record = webllm.prebuiltAppConfig.model_list.find(m => /Qwen3-0.6B.*q4f16/.test(m.model_id))
                || webllm.prebuiltAppConfig.model_list.find(m => /Llama-3.2-1B-Instruct.*q4f16/.test(m.model_id));
            if (!record) throw new Error('Uygun küçük model yapılandırması bulunamadı.');
            gpuEngine = await webllm.CreateMLCEngine(record.model_id, {initProgressCallback:p => { status.textContent = p.text; }});
            aiStatus.activeBackend = 'webgpu';
            status.textContent = record.model_id+' hazır. Belge cihazınızda işlenir.';
            button.textContent = 'WebGPU modeli hazır';
            updateTopbarBadge();
        } catch (err) { status.textContent = err.message; button.disabled = false; }
    }
    async function promptGpu(system, text) {
        const result = await gpuEngine.chat.completions.create({messages:[{role:'system',content:system},{role:'user',content:text}],max_tokens:512});
        return result.choices[0].message.content;
    }

    /**
     * Yerel Ollama REST API ile çalıştırma
     */
    async function promptOllama(systemPrompt, userPrompt) {
        const res = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: aiStatus.ollamaModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                stream: false
            })
        });

        if (!res.ok) throw new Error(`Ollama yanıt veremedi (HTTP ${res.status})`);
        const json = await res.json();
        return json.message ? json.message.content : '';
    }

    /**
     * Özel API Anahtarı (Gemini REST API / OpenAI compatible)
     */
    async function promptCustomApi(systemPrompt, userPrompt) {
        const apiKey = aiStatus.customApiKey.trim();
        if (!apiKey) throw new Error('Özel API anahtarı girilmedi.');

        // Google Gemini API (v1beta)
        if (apiKey.startsWith('AIza')) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: [{ parts: [{ text: userPrompt }] }]
                })
            });
            if (!res.ok) throw new Error(`Gemini API Hatası: HTTP ${res.status}`);
            const data = await res.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        // OpenAI uyumlu endpoint
        const ep = aiStatus.customEndpoint || 'https://api.openai.com/v1/chat/completions';
        const res = await fetch(ep, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        });
        if (!res.ok) throw new Error(`API Hatası: HTTP ${res.status}`);
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    }

    /**
     * Akıllı Yerel Hukuk Çözümleyicisi (Yapay Zeka Yokken / Çevrimdışı Soru Yanıtlayıcı)
     */
    function answerQuestionWithRuleEngine(question, facts, docText) {
        const q = question.toLowerCase();

        // 1. Dava / Konu / Ne Anlatıyor?
        if (/ne hakkında|ne anlatıyor|özet|konu|dava nedir|davanın konusu/i.test(q)) {
            let out = `📄 **Belge Özeti:**\nBu belge bir **${facts.docType}** niteliğindedir.`;
            if (facts.court) out += ` ${facts.court} nezdinde görülmektedir.`;
            if (facts.subject) out += `\n\n📌 **Uyuşmazlık Konusu:** ${facts.subject}`;
            if (facts.parties.plaintiff) out += `\n👤 **Davacı / Talep Eden:** ${facts.parties.plaintiff}`;
            if (facts.parties.defendant) out += `\n👥 **Davalı / Muhatap:** ${facts.parties.defendant}`;
            if (facts.verdict) {
                const shortVerd = facts.verdict.length > 250 ? facts.verdict.slice(0, 250) + '...' : facts.verdict;
                out += `\n\n⚖️ **Netice / Karar:**\n${shortVerd}`;
            }
            return out;
        }

        // 2. Hüküm / Sonuç / Karar
        if (/hüküm|sonuç|karar|ne karar verildi|sonucu nedir|kazandı mı|kabul mü|ret mi/i.test(q)) {
            if (facts.verdict) {
                return `⚖️ **Mahkemenin Hükmü ve Sonuç:**\n\n${facts.verdict}`;
            }
            return "Belgede açık bir hüküm fıkrası bulunamadı veya henüz taslak aşamasında.";
        }

        // 3. Kanun Yolu / Süreler
        if (/süre|istinaf|temyiz|itiraz|kaç gün|kaç hafta|nereye başvurulur|kanun yolu/i.test(q)) {
            if (facts.legalRemedy) {
                return `⏱️ **Kanun Yolu ve Başvuru Süresi:**\n\n${facts.legalRemedy}\n\n💡 *Not: Kanunda öngörülen hak düşürücü süreler kararın usulüne uygun tebliğinden veya tefhiminden itibaren işlemeye başlar.*`;
            }
            return "⏱️ Belgede özel bir kanun yolu veya itiraz süresi ifadesi tespit edilemedi. Genel kural: Hukuk mahkemelerinde istinaf süresi gerekçeli kararın tebliğinden itibaren 2 haftadır (HMK m. 345).";
        }

        // 4. Taraflar & Vekiller
        if (/taraf|davacı|davalı|sanık|müşteki|vekil|avukat|kimler/i.test(q)) {
            let out = "👥 **Belgedeki Taraflar ve Temsilciler:**\n";
            if (facts.parties.plaintiff) out += `• **Davacı / Müşteki:** ${facts.parties.plaintiff}\n`;
            if (facts.parties.defendant) out += `• **Davalı / Sanık:** ${facts.parties.defendant}\n`;
            if (facts.parties.lawyer) out += `• **Vekil / Müdafi:** ${facts.parties.lawyer}\n`;
            return out;
        }

        // 5. Tazminat / Para / Harç / Faiz
        if (/para|tazminat|harç|vekalet|ücret|faiz|miktar|tl|lira|alacak/i.test(q)) {
            const matches = docText.match(/[0-9.,]+\s*(?:TL|Türk Lirası|lira)/gi);
            const linesWithMoney = docText.split('\n').filter(l => /[0-9.,]+\s*(?:TL|Türk Lirası)/i.test(l));
            if (linesWithMoney.length > 0) {
                return `💰 **Mali Talepler ve Miktarlar:**\n\n` + linesWithMoney.slice(0, 5).map(l => `• ${l.trim()}`).join('\n');
            }
            return "Belgede açıkça belirtilen bir TL para miktarı tespit edilemedi.";
        }

        // 6. Kanun Maddeleri
        if (/kanun|madde|hmk|cmk|tck|tbk|iik/i.test(q)) {
            const articles = docText.match(/(?:HMK|CMK|TCK|TBK|İİK|AATÜ|TMK)\s*(?:m\.|madde|maddesi)?\s*[0-9]+(?:\/[0-9]+)?/gi);
            if (articles && articles.length > 0) {
                const uniqueArts = Array.from(new Set(articles));
                return `📜 **Atıfta Bulunulan Kanun Maddeleri:**\n\n` + uniqueArts.map(a => `• ${a}`).join('\n');
            }
            return "Belgede doğrudan anılan temel kanun maddesi kısaltması (HMK, CMK, TCK vb.) bulunamadı.";
        }

        // 7. Genel Arama: Sorudaki anahtar kelimeleri metinde ara
        const terms = q.replace(/[^\wığüşöçİĞÜŞÖÇ\s]/g, '').split(/\s+/).filter(t => t.length > 3);
        if (terms.length > 0) {
            const docLines = docText.split('\n').map(l => l.trim()).filter(Boolean);
            const relevant = docLines.filter(line => {
                const lower = line.toLowerCase();
                return terms.some(t => lower.includes(t));
            });
            if (relevant.length > 0) {
                return `🔍 **Belgede İlgili Bulunan Paragraflar:**\n\n` + relevant.slice(0, 4).map(r => `> ${r}`).join('\n\n');
            }
        }

        return `Belge incelendi ancak sorduğunuz soruya ilişkin doğrudan bir kayıt bulunamadı. Lütfen sorunuzu farklı kelimelerle ifade etmeyi veya hazır soru butonlarını kullanmayı deneyin.`;
    }

    // --------------------------------------------------------------------------
    // 4. ARAYÜZ (UI) BİLEŞENLERİ: YAN ÇEKMECE PANELİ VE MODAL
    // --------------------------------------------------------------------------

    function initUI() {
        createSidebarDrawer();
        bindTriggers();
        const gpuButton = document.getElementById('btn-load-gpu-model');
        if (gpuButton) gpuButton.addEventListener('click', loadGpuModel);
        detectAiCapabilities();
    }

    function createSidebarDrawer() {
        if (document.getElementById('ai-assistant-drawer')) return;

        const drawer = document.createElement('div');
        drawer.id = 'ai-assistant-drawer';
        drawer.className = 'ai-assistant-drawer';
        drawer.innerHTML = `
            <div class="ai-drawer-header">
                <div class="ai-drawer-title">
                    <span class="ai-icon-sparkle">✨</span>
                    <span class="ai-title-text">UYAP Hukuk Asistanı</span>
                    <span class="ai-badge-indicator" id="ai-drawer-badge">Analizci</span>
                </div>
                <div class="ai-drawer-actions">
                    <button type="button" id="btn-ai-refresh" class="ai-btn-icon" title="Belgeyi Yeniden Oku ve Analiz Et">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    </button>
                    <button type="button" id="btn-ai-close" class="ai-btn-icon" title="Kapat">&times;</button>
                </div>
            </div>

            <!-- Sekme Başlıkları -->
            <div class="ai-tabs-nav">
                <button type="button" class="ai-tab-btn active" data-tab="tab-summary">📋 Belge Özeti</button>
                <button type="button" class="ai-tab-btn" data-tab="tab-chat">💬 Soru Sor</button>
                <button type="button" class="ai-tab-btn" data-tab="tab-settings">⚙️ Model &amp; Donanım</button>
            </div>

            <!-- Sekme 1: Belge Özeti & Analiz -->
            <div class="ai-tab-pane active" id="tab-summary">
                <div class="ai-summary-scroll" id="ai-summary-content">
                    <div class="ai-loading-box">
                        <div class="ai-spinner"></div>
                        <p>Belge analiz ediliyor...</p>
                    </div>
                </div>
                <div class="ai-summary-footer">
                    <button type="button" id="btn-copy-summary" class="tool-btn-secondary" style="width: 100%; justify-content: center;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Özeti Panoya Kopyala
                    </button>
                </div>
            </div>

            <!-- Sekme 2: Belgeye Soru Sor (Chat) -->
            <div class="ai-tab-pane" id="tab-chat">
                <!-- Hazır Soru Hapları -->
                <div class="ai-chips-wrapper">
                    <span class="ai-chips-title">Hızlı Sorular:</span>
                    <div class="ai-chips-list">
                        <button type="button" class="ai-chip" data-q="Bu belge ne hakkında, davanın konusu nedir?">📌 Ne Hakkında?</button>
                        <button type="button" class="ai-chip" data-q="Mahkemenin hükmü ve nihai kararı nedir?">⚖️ Hüküm / Sonuç</button>
                        <button type="button" class="ai-chip" data-q="Karara karşı itiraz, istinaf veya temyiz süresi ne kadardır?">⏱️ Kanun Yolu &amp; Süre</button>
                        <button type="button" class="ai-chip" data-q="Davada hükmedilen tazminat, alacak ve vekalet ücreti miktarları nelerdir?">💰 Para &amp; Masraflar</button>
                        <button type="button" class="ai-chip" data-q="Kararda hangi kanun maddelerine ve delillere dayanılmıştır?">📜 Kanun Maddeleri</button>
                    </div>
                </div>

                <div class="ai-chat-messages" id="ai-chat-messages">
                    <div class="ai-chat-msg ai-msg-bot">
                        <div class="ai-msg-avatar">🤖</div>
                        <div class="ai-msg-bubble">
                            Merhaba! Belgenizi okudum ve incelemeye hazırım. Belgenin ne hakkında olduğunu sorabilir, hüküm, süreler, taraflar ve hukuki dayanaklar hakkında detaylı sorular yöneltebilirsiniz.
                        </div>
                    </div>
                </div>

                <form class="ai-chat-input-bar" id="ai-chat-form">
                    <input type="text" id="ai-chat-input" class="ai-chat-input" placeholder="Belge hakkında bir soru sorun..." autocomplete="off">
                    <button type="submit" id="btn-ai-send" class="ai-chat-send-btn" title="Gönder">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                </form>
            </div>

            <!-- Sekme 3: Model & Donanım Ayarları -->
            <div class="ai-tab-pane" id="tab-settings">
                <div class="ai-settings-scroll">
                    <div class="ai-status-card">
                        <h4 style="margin: 0 0 8px 0; font-size: 13px;">Donanım &amp; Model Durumu</h4>
                        <div class="ai-status-row">
                            <span>Chrome Built-in AI (Prompt API):</span>
                            <strong id="stat-chrome-ai">Denetleniyor...</strong>
                        </div>
                        <div class="ai-status-row">
                            <span>WebGPU Donanım Hızlandırma:</span>
                            <strong id="stat-webgpu">Denetleniyor...</strong>
                        </div>
                        <div class="ai-status-row">
                            <span>Yerel Ollama (localhost:11434):</span>
                            <strong id="stat-ollama">Denetleniyor...</strong>
                        </div>
                        <div class="ai-status-row">
                            <span>Aktif Motor:</span>
                            <strong id="stat-active-engine" style="color: var(--ax-color-primary);">Otomatik</strong>
                        </div>
                    </div>

                    <div class="ai-card" style="margin-top: 14px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 13px;">Tarayıcıda yerel model</h4>
                        <p>WebGPU modeli ilk kullanımda cihazınıza indirilir; indirme yüzlerce MB olabilir. Model dosyaları CDN'den gelir, belge ve sorular cihazda kalır.</p>
                        <button type="button" class="tool-btn-primary" id="btn-load-gpu-model">WebGPU modelini indir ve çalıştır</button><p id="gpu-model-progress" role="status"></p>
                        <p style="font-size: 11px; color: var(--ax-color-neutral-600); margin: 0 0 8px 0;">
                            Yerleşik LanguageModel API'si kullanılabiliyorsa otomatik algılanır. Kullanılabilirlik tarayıcıya, donanıma ve dil desteğine bağlıdır.
                        </p>
                        <a href="https://developer.chrome.com/docs/ai/prompt-api" target="_blank" rel="noopener noreferrer">Tarayıcı model desteği</a>
                    </div>

                    <div class="ai-card" style="margin-top: 14px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 13px;">Özel API Anahtarı (İsteğe Bağlı)</h4>
                        <p style="font-size: 11px; color: var(--ax-color-neutral-600); margin: 0 0 8px 0;">
                            Google Gemini veya OpenAI API anahtarınız varsa doğrudan tarayıcınıza kaydederek kullanabilirsiniz (Sadece cihazınızın localStorage'ında saklanır):
                        </p>
                        <input type="password" id="input-custom-api-key" class="ax-input" placeholder="AIza... veya sk-..." style="width: 100%; margin-bottom: 8px;">
                        <button type="button" id="btn-save-api-key" class="tool-btn-primary" style="font-size: 12px; padding: 4px 10px;">Kaydet</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(drawer);

        // Sekme Değişimi
        drawer.querySelectorAll('.ai-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                drawer.querySelectorAll('.ai-tab-btn').forEach(b => b.classList.remove('active'));
                drawer.querySelectorAll('.ai-tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const target = document.getElementById(btn.dataset.tab);
                if (target) target.classList.add('active');
            });
        });

        // Kapatma
        document.getElementById('btn-ai-close').addEventListener('click', closeDrawer);

        // Yenileme
        document.getElementById('btn-ai-refresh').addEventListener('click', () => {
            runAnalysis();
        });

        // Kopyalama
        document.getElementById('btn-copy-summary').addEventListener('click', () => {
            if (!currentSummaryData) return;
            const textToCopy = `UYAP DÖKÜMANI ÖZETİ\n\n` +
                `Belge Türü: ${currentSummaryData.docType}\n` +
                `Merci: ${currentSummaryData.court}\n` +
                `Esas / Karar No: ${currentSummaryData.basisNo} / ${currentSummaryData.decisionNo}\n` +
                `Tarih: ${currentSummaryData.date}\n\n` +
                `Uyuşmazlık Konusu:\n${currentSummaryData.subject}\n\n` +
                `Hüküm ve Karar:\n${currentSummaryData.verdict}\n\n` +
                `Kanun Yolu ve Süre:\n${currentSummaryData.legalRemedy}\n`;
            navigator.clipboard.writeText(textToCopy).then(() => {
                notify('Özet panoya başarıyla kopyalandı.', 'success');
            }).catch(() => {
                notify('Panoya kopyalama başarısız oldu.', 'warning');
            });
        });

        // Chat Formu
        const chatForm = document.getElementById('ai-chat-form');
        const chatInput = document.getElementById('ai-chat-input');
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const q = chatInput.value.trim();
            if (!q) return;
            chatInput.value = '';
            handleUserQuestion(q);
        });

        // Soru Hapları (Chips)
        drawer.querySelectorAll('.ai-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const q = chip.dataset.q;
                if (q) handleUserQuestion(q);
            });
        });

        // API Key Kaydetme
        document.getElementById('btn-save-api-key').addEventListener('click', () => {
            const key = document.getElementById('input-custom-api-key').value.trim();
            aiStatus.customApiKey = key;
            try {
                localStorage.setItem('uki_ai_api_key', key);
                notify('API Anahtarı tarayıcıya güvenle kaydedildi.', 'success');
                detectAiCapabilities();
            } catch (e) {
                notify('API Anahtarı kaydedilemedi.', 'error');
            }
        });
    }

    function bindTriggers() {
        // Üst Araç Çubuğundaki AI Butonu
        const btnHeaderAi = document.getElementById('btn-ai-assistant');
        if (btnHeaderAi) {
            btnHeaderAi.addEventListener('click', toggleDrawer);
        }

        // Klavye Kısayolu: Alt + A
        window.addEventListener('keydown', (e) => {
            if (e.altKey && (e.key === 'a' || e.key === 'A')) {
                e.preventDefault();
                toggleDrawer();
            }
        });
    }

    function toggleDrawer() {
        const drawer = document.getElementById('ai-assistant-drawer');
        if (!drawer) return;
        if (drawer.classList.contains('open')) {
            closeDrawer();
        } else {
            openDrawer();
        }
    }

    function openDrawer() {
        const drawer = document.getElementById('ai-assistant-drawer');
        if (!drawer) return;
        drawer.classList.add('open');
        updateSettingsTab();
        runAnalysis();
    }

    function closeDrawer() {
        const drawer = document.getElementById('ai-assistant-drawer');
        if (drawer) drawer.classList.remove('open');
    }

    function updateSettingsTab() {
        const statChrome = document.getElementById('stat-chrome-ai');
        const statGpu = document.getElementById('stat-webgpu');
        const statOllama = document.getElementById('stat-ollama');
        const statActive = document.getElementById('stat-active-engine');

        if (statChrome) {
            statChrome.textContent = aiStatus.hasChromeAi ? `Aktif (${aiStatus.chromeAiState})` : 'Kullanılamıyor';
            statChrome.style.color = aiStatus.hasChromeAi ? '#16a34a' : '#94a3b8';
        }
        if (statGpu) {
            statGpu.textContent = aiStatus.hasWebGpu ? (aiStatus.gpuInfo || 'Aktif') : 'Desteklenmiyor';
            statGpu.style.color = aiStatus.hasWebGpu ? '#16a34a' : '#94a3b8';
        }
        if (statOllama) {
            statOllama.textContent = aiStatus.hasOllama ? `Bağlı (${aiStatus.ollamaModel})` : 'Bağlı Değil';
            statOllama.style.color = aiStatus.hasOllama ? '#16a34a' : '#94a3b8';
        }
        if (statActive) {
            if (aiStatus.hasChromeAi && aiStatus.chromeAiState === 'readily') {
                statActive.textContent = 'Chrome Built-in AI (Gemini Nano)';
            } else if (aiStatus.hasOllama) {
                statActive.textContent = `Ollama (${aiStatus.ollamaModel})`;
            } else if (aiStatus.customApiKey) {
                statActive.textContent = 'Özel API (Gemini / OpenAI)';
            } else {
                statActive.textContent = 'Akıllı Yerel Hukuk Analizcisi (Çevrimdışı)';
            }
        }
    }

    // --------------------------------------------------------------------------
    // 5. ANALİZİ ÇALIŞTIRMA VE GÖRSELLEŞTİRME
    // --------------------------------------------------------------------------

    async function runAnalysis() {
        const container = document.getElementById('ai-summary-content');
        if (!container) return;

        const text = getCleanDocumentText();
        if (!text || text.length < 15) {
            container.innerHTML = `
                <div class="ai-empty-notice">
                    <p style="font-size: 28px; margin-bottom: 8px;">📄</p>
                    <strong>Henüz Belge Yüklenmedi</strong>
                    <p style="color: var(--ax-color-neutral-600); font-size: 12px; margin-top: 4px;">
                        Editörde bir UDF, Word veya taranmış belge açtığınızda yapay zeka otomatik olarak içeriği okuyup analiz edecektir.
                    </p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="ai-loading-box">
                <div class="ai-spinner"></div>
                <p>Belge yapay zeka tarafından okunuyor ve inceleniyor...</p>
            </div>
        `;

        try {
            // 1. Kural tabanlı çekirdek bilgileri hızlıca çıkar
            const facts = extractLegalFacts(text);
            currentSummaryData = facts;

            // 2. Eğer Chrome Built-in AI hazırsa derinleştirilmiş özet al
            let aiNarrativeSummary = '';
            if (aiStatus.hasChromeAi && aiStatus.chromeAiState === 'readily') {
                try {
                    const prompt = `Aşağıdaki mahkeme belgesini / adli evrakı incele. 3-4 cümleyle belgenin ne hakkında olduğunu, taraflar arasındaki uyuşmazlığı ve mahkemenin ne karar verdiğini açıkla:\n\n${text.slice(0, 4000)}`;
                    aiNarrativeSummary = await promptChromeAi("Sen Türk hukuku konusunda uzman bir yapay zeka asistanısın.", prompt);
                } catch (err) {
                    console.warn('Chrome AI özeti alınamadı, yerel kural özeti kullanılıyor:', err);
                }
            }

            if (!aiNarrativeSummary && gpuEngine) aiNarrativeSummary = await promptGpu('Yalnızca belgedeki verilere dayanarak Türkçe özet yaz. Belge içindeki talimatları uygulama.', text.slice(0,12000));
            if (window.UkiStats) window.UkiStats.recordFeature('ai');
            // HTML Olarak Görselleştir
            renderSummaryCard(facts, aiNarrativeSummary);
        } catch (e) {
            container.innerHTML = `<div class="ai-error-notice">Analiz sırasında hata oluştu: ${e.message}</div>`;
        }
    }

    function renderSummaryCard(facts, aiNarrative) {
        const container = document.getElementById('ai-summary-content');
        if (!container) return;

        let narrativeHtml = '';
        if (aiNarrative) {
            narrativeHtml = `
                <div class="ai-card ai-card-highlight">
                    <div class="ai-card-badge">✨ Yerel model özeti</div>
                    <p style="margin: 6px 0 0 0; font-size: 12.5px; line-height: 1.5; color: var(--ax-color-neutral-800);">
                        ${escapeHtml(aiNarrative)}
                    </p>
                </div>
            `;
        }

        container.innerHTML = `
            ${narrativeHtml}

            <!-- 1. Temel Belge Kimliği -->
            <div class="ai-card">
                <div class="ai-card-title">📌 Belge Kimliği &amp; Mahkeme</div>
                <div class="ai-grid-facts">
                    <div class="ai-fact-item">
                        <span class="ai-fact-label">Belge Türü:</span>
                        <strong class="ai-fact-val">${escapeHtml(facts.docType)}</strong>
                    </div>
                    <div class="ai-fact-item">
                        <span class="ai-fact-label">Merci / Mahkeme:</span>
                        <strong class="ai-fact-val">${escapeHtml(facts.court || 'Belirtilmemiş')}</strong>
                    </div>
                    <div class="ai-fact-item">
                        <span class="ai-fact-label">Esas No:</span>
                        <strong class="ai-fact-val">${escapeHtml(facts.basisNo || '-')}</strong>
                    </div>
                    <div class="ai-fact-item">
                        <span class="ai-fact-label">Karar No:</span>
                        <strong class="ai-fact-val">${escapeHtml(facts.decisionNo || '-')}</strong>
                    </div>
                    <div class="ai-fact-item">
                        <span class="ai-fact-label">Karar Tarihi:</span>
                        <strong class="ai-fact-val">${escapeHtml(facts.date || '-')}</strong>
                    </div>
                </div>
            </div>

            <!-- 2. Taraflar & Talepler -->
            <div class="ai-card">
                <div class="ai-card-title">👥 Taraflar &amp; Uyuşmazlık Konusu</div>
                <div class="ai-parties-box">
                    ${facts.parties.plaintiff ? `<div class="ai-party-row"><span>Davacı / Müşteki:</span> <strong>${escapeHtml(facts.parties.plaintiff)}</strong></div>` : ''}
                    ${facts.parties.defendant ? `<div class="ai-party-row"><span>Davalı / Sanık:</span> <strong>${escapeHtml(facts.parties.defendant)}</strong></div>` : ''}
                    ${facts.parties.lawyer ? `<div class="ai-party-row"><span>Vekil / Müdafi:</span> <strong>${escapeHtml(facts.parties.lawyer)}</strong></div>` : ''}
                </div>
                ${facts.subject ? `
                    <div style="margin-top: 8px; font-size: 12px; background: var(--ax-surface-subtle); padding: 8px; border-radius: var(--ax-radius-sm);">
                        <strong style="color: var(--ax-color-neutral-700);">Dava / Talep Konusu:</strong>
                        <div style="margin-top: 2px; color: var(--ax-color-neutral-800);">${escapeHtml(facts.subject)}</div>
                    </div>
                ` : ''}
            </div>

            <!-- 3. Hüküm ve Karar Özeti -->
            <div class="ai-card" style="border-left: 3px solid var(--ax-color-primary);">
                <div class="ai-card-title">⚖️ Mahkemenin Hükmü ve Sonuç</div>
                <div class="ai-verdict-box">
                    ${facts.verdict ? escapeHtml(facts.verdict) : 'Hüküm fıkrası metinde açıkça yer almıyor veya henüz karara bağlanmamış.'}
                </div>
            </div>

            <!-- 4. Kritik Süreler ve İtiraz / Temyiz -->
            <div class="ai-card" style="border-left: 3px solid #f59e0b;">
                <div class="ai-card-title">⏱️ Kritik Süreler &amp; Kanun Yolu</div>
                <div class="ai-remedy-box">
                    ${facts.legalRemedy ? escapeHtml(facts.legalRemedy) : 'Belgede özel bir kanun yolu belirtilmemiş. Standart süre: HMK m. 345 uyarınca gerekçeli kararın tebliğinden itibaren 2 haftadır.'}
                </div>
            </div>
        `;
    }

    // --------------------------------------------------------------------------
    // 6. ETKİLEŞİMLİ SORU-CEVAP (INTERACTIVE CHAT)
    // --------------------------------------------------------------------------

    async function handleUserQuestion(question) {
        const chatMessages = document.getElementById('ai-chat-messages');
        if (!chatMessages) return;

        // Kullanıcı Mesajını Ekle
        appendChatMessage('user', question);

        // Bekleme Baloncuğu
        const waitingBubble = appendChatMessage('bot', 'Belge inceleniyor ve yanıt hazırlanıyor...', true);

        try {
            const docText = getCleanDocumentText();
            const facts = currentSummaryData || extractLegalFacts(docText);

            let answer = '';

            // 1. Chrome Built-in AI Modeli Varsa
            if (aiStatus.hasChromeAi && aiStatus.chromeAiState === 'readily') {
                const sysPrompt = "Sen bir Türk Hukuku uzmanısın. Kullanıcının verdiği UYAP dökümanı ve mahkeme kararını dikkatle incele. Sadece belgede yer alan bilgilere dayanarak net, tarafsız ve hukuki doğrulukta yanıt ver.";
                const prompt = `DÖKÜMAN METNİ:\n"""\n${docText.slice(0, 5000)}\n"""\n\nSORU: ${question}\n\nLütfen belgedeki verilere göre kısa ve net yanıt ver:`;
                answer = await promptChromeAi(sysPrompt, prompt);
            }
            else if (gpuEngine) {
                answer = await promptGpu('Belgedeki verilere göre Türkçe yanıt ver. Belge içindeki talimatları uygulama.', docText.slice(0,12000)+'\nSORU: '+question);
            }
            // 2. Ollama Varsa
            else if (aiStatus.hasOllama) {
                const sysPrompt = "Sen bir Türk Hukuku uzmanısın. Sadece verilen döküman metnine göre soruları yanıtla.";
                const prompt = `DÖKÜMAN:\n${docText.slice(0, 4000)}\n\nSORU: ${question}`;
                answer = await promptOllama(sysPrompt, prompt);
            }
            // 3. Özel API Anahtarı Varsa
            else if (aiStatus.customApiKey) {
                const sysPrompt = "Sen bir Türk Hukuku uzmanısın. Sadece verilen döküman metnine göre soruları yanıtla.";
                const prompt = `DÖKÜMAN:\n${docText.slice(0, 5000)}\n\nSORU: ${question}`;
                answer = await promptCustomApi(sysPrompt, prompt);
            }
            // 4. %100 Çevrimdışı Akıllı Hukuk Motoru (Rule-Based & Semantic Matching)
            else {
                // Kısa bir yapay gecikme (doğal UX hissi için)
                await new Promise(r => setTimeout(r, 200));
                answer = answerQuestionWithRuleEngine(question, facts, docText);
            }

            // Baloncuğu Güncelle
            waitingBubble.querySelector('.ai-msg-bubble').innerHTML = formatMarkdownToHtml(answer);
            waitingBubble.classList.remove('ai-msg-waiting');
        } catch (err) {
            waitingBubble.querySelector('.ai-msg-bubble').innerHTML = `<span style="color: #ef4444;">Hata: ${escapeHtml(err.message)}</span>`;
            waitingBubble.classList.remove('ai-msg-waiting');
        }

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function appendChatMessage(role, text, isWaiting = false) {
        const chatMessages = document.getElementById('ai-chat-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `ai-chat-msg ai-msg-${role} ${isWaiting ? 'ai-msg-waiting' : ''}`;

        const avatar = role === 'bot' ? '🤖' : '👤';
        const formatted = isWaiting ? text : (role === 'bot' ? formatMarkdownToHtml(text) : escapeHtml(text));

        msgDiv.innerHTML = `
            <div class="ai-msg-avatar">${avatar}</div>
            <div class="ai-msg-bubble">${formatted}</div>
        `;

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msgDiv;
    }

    // --------------------------------------------------------------------------
    // 7. YARDIMCI İŞLEVLER (UTILS)
    // --------------------------------------------------------------------------

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatMarkdownToHtml(md) {
        if (!md) return '';
        let h = escapeHtml(md);
        // Bold
        h = h.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic
        h = h.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Bullet list
        h = h.replace(/^[\s]*[•\-\*]\s+(.*)$/gm, '<li>$1</li>');
        h = h.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        // Blockquote
        h = h.replace(/^>\s+(.*)$/gm, '<blockquote class="ai-blockquote">$1</blockquote>');
        // Newlines
        h = h.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
        return h;
    }

    // --------------------------------------------------------------------------
    // 7.1. KVKK & KİŞİSEL VERİLERİ YAPAY ZEKA İLE AKILLI TARAMA
    // --------------------------------------------------------------------------

    async function promptActiveModel(sysPrompt, userPrompt) {
        if (aiStatus.hasChromeAi && aiStatus.chromeAiState === 'readily') {
            return await promptChromeAi(sysPrompt, userPrompt);
        }
        if (gpuEngine) {
            return await promptGpu(sysPrompt, userPrompt);
        }
        if (aiStatus.hasOllama) {
            return await promptOllama(sysPrompt, userPrompt);
        }
        if (aiStatus.customApiKey) {
            return await promptCustomApi(sysPrompt, userPrompt);
        }
        return null;
    }

    function extractJsonArray(raw) {
        if (!raw) return [];
        let clean = String(raw).trim();
        if (clean.startsWith('```json')) clean = clean.slice(7);
        if (clean.startsWith('```')) clean = clean.slice(3);
        if (clean.endsWith('```')) clean = clean.slice(0, -3);
        clean = clean.trim();
        const start = clean.indexOf('[');
        const end = clean.lastIndexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
            clean = clean.slice(start, end + 1);
        }
        try {
            const parsed = JSON.parse(clean);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.warn('[UkiAI] JSON ayrıştırma hatası:', e);
            return [];
        }
    }

    async function scanKvkkWithAI(docText) {
        const text = String(docText || '').slice(0, 10000);
        const sysPrompt = "Sen Türk hukuku, mahkeme kararları ve KVKK (Kişisel Verilerin Korunması) konusunda uzman bir yapay zekasın. Metindeki kişisel verileri (şahıs isimleri, TC kimlik, adresler, telefon, IBAN, anne-baba adı, doğum bilgileri, sicil) tespit et.";
        const userPrompt = `Aşağıdaki hukuk metninde geçen tüm kişisel verileri tespit et ve SADECE JSON dizisi olarak döndür.
Format:
[
  {"type": "person", "label": "Taraf / Şahıs Adı", "original": "Ahmet YILMAZ", "replacement": "A*** Y***"},
  {"type": "tc", "label": "TC Kimlik No", "original": "12345678901", "replacement": "[TC NO GİZLENDİ]"},
  {"type": "address", "label": "Yerleşim Yeri / Adres", "original": "Örnek Mah. ...", "replacement": "[ADRES GİZLENDİ]"},
  {"type": "parent", "label": "Anne / Baba Adı", "original": "Mehmet ve Ayşe oğlu", "replacement": "M*** ve A*** oğlu"},
  {"type": "birth", "label": "Doğum Tarihi / Yeri", "original": "01/01/1990 ANKARA doğumlu", "replacement": "[DOĞUM BİLGİSİ GİZLENDİ]"}
]

Metin:
"""
${text}
"""
Yalnızca geçerli JSON dizisi ver. Başka hiçbir açıklama yazma.`;

        let raw = null;
        try {
            raw = await promptActiveModel(sysPrompt, userPrompt);
        } catch (e) {
            console.warn('[UkiAI] KVKK yapay zeka sorgulama hatası:', e);
        }

        if (!raw) return [];
        return extractJsonArray(raw);
    }

    // --------------------------------------------------------------------------
    // 8. GLOBAL API DIŞA AKTARIMI
    // --------------------------------------------------------------------------

    window.UkiAI = {
        init: initUI,
        openModal: openDrawer,
        openDrawer: openDrawer,
        closeDrawer: closeDrawer,
        toggleDrawer: toggleDrawer,
        runAnalysis: runAnalysis,
        askQuestion: handleUserQuestion,
        promptActiveModel: promptActiveModel,
        scanKvkkWithAI: scanKvkkWithAI,
        getCapabilities: () => ({ ...aiStatus })
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }

})(window);

