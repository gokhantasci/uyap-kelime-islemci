/** TDK Yazım Kılavuzu esaslı, bağlamı kesin olmayan metni kendiliğinden değiştirmeyen kurallar. */
(function(window) {
    'use strict';
    const corrections = Object.freeze({
        'yanlız':'yalnız', 'yalnış':'yanlış', 'herkez':'herkes', 'birşey':'bir şey',
        'hiçbirşey':'hiçbir şey', 'pekçok':'pek çok', 'bir çok':'birçok', 'bir kaç':'birkaç',
        'hertürlü':'her türlü', 'şöför':'şoför', 'orjinal':'orijinal', 'döküman':'doküman',
        'dökümanın':'dokümanın', 'dökümanlar':'dokümanlar', 'süpriz':'sürpriz', 'idda':'iddia',
        'insiyatif':'inisiyatif', 'müvekil':'müvekkil', 'mütahit':'müteahhit'
    });
    const sources = [
        ['TDK Yazım Kılavuzu','https://yazim.tdk.gov.tr/'],
        ['Bağlaç olan de/da','https://tdk.gov.tr/icerik/yazim-kurallari/baglac-olan-da-denin-yazilisi/'],
        ['Bağlaç olan ki','https://tdk.gov.tr/icerik/yazim-kurallari/baglac-olan-kinin-yazilisi/'],
        ['Soru eki','https://tdk.gov.tr/icerik/yazim-kurallari/soru-eki-mi-mi-mu-munun-yazilisi/'],
        ['Noktalama','https://tdk.gov.tr/icerik/yazim-kurallari/noktalama-isaretleri-aciklamalar/']
    ];
    function suggest(word) { return corrections[String(word).toLocaleLowerCase('tr-TR')] || null; }
    function inspect(text) {
        const findings = [];
        const push = (re, message, replacement) => {
            for (const m of text.matchAll(re)) findings.push({index:m.index, text:m[0], message, replacement:typeof replacement==='function'?replacement(m):replacement});
        };
        push(/(?<!\p{L})(?:herkez|yanlız|yalnış|birşey|pekçok|şöför|orjinal|süpriz|insiyatif)(?!\p{L})/giu, 'Yerleşik yazım önerisi', m => suggest(m[0]));
        push(/(?<=\p{L})\s+[,;!?]/gu, 'Noktalama işaretinden önce boşluk bırakılmaz.', m => m[0].trim());
        push(/(?<=\p{L})[,;!?](?=\p{L})/gu, 'Noktalama işaretinden sonra boşluk bırakılır.', m => m[0]+' ');
        push(/(?<!\p{L})(?:bir çok|bir kaç|her hangi)(?!\p{L})/giu, 'Bu birleşik sözcüğün yazılışını kontrol edin.', m => ({'bir çok':'birçok','bir kaç':'birkaç','her hangi':'herhangi'})[m[0].toLocaleLowerCase('tr-TR')]);
        // de/da, ki ve soru ekini bütün son eklerde bölmek yanlış pozitif üretir.
        // Kullanıcıya kaynak kural gösterilir; anlamsal karar kullanıcıya aittir.
        return findings;
    }
    async function lookup(word) {
        if (!/^[\p{L}’'-]{1,64}$/u.test(word)) throw new Error('Yalnızca bir kelime seçin.');
        const endpoint = (window.UKI_SITE_CONFIG || {}).dictionaryApiUrl;
        const url = endpoint ? endpoint + encodeURIComponent(word) : 'https://sozluk.gov.tr/gts?ara=' + encodeURIComponent(word);
        const r = await fetch(url, {referrerPolicy:'no-referrer', signal:AbortSignal.timeout(10000)});
        if (!r.ok) throw new Error('Sözlük yanıt vermedi ('+r.status+').');
        const data = await r.json();
        if (!Array.isArray(data)) {
            if (data.entries) return data;
            if (data.error) return {found:false,entries:[]};
            throw new Error('Sözlük yanıtı tanınamadı.');
        }
        return {found:!!data.length, entries:data.map(e => ({word:e.madde,meanings:(e.anlamlarListe||[]).map(m=>m.anlam)}))};
    }
    let spellWorker = null, requestId = 0;
    const requests = new Map();
    function workerRequest(command, value) {
        if (!spellWorker) {
            spellWorker = new Worker(new URL('assets/js/uki-spell-worker.js', document.baseURI));
            spellWorker.onmessage = e => {
                const entry = requests.get(e.data.id); if (!entry) return;
                requests.delete(e.data.id); clearTimeout(entry.timer);
                if (e.data.error) entry.reject(new Error(e.data.error)); else entry.resolve(e.data.result);
            };
            spellWorker.onerror = () => {
                for (const entry of requests.values()) { clearTimeout(entry.timer); entry.reject(new Error('Yerel sözlük yüklenemedi.')); }
                requests.clear(); spellWorker.terminate(); spellWorker = null;
            };
        }
        return new Promise((resolve,reject) => {
            const id = ++requestId;
            const timer = setTimeout(() => { requests.delete(id); reject(new Error('Sözlük zaman aşımına uğradı.')); }, 30000);
            requests.set(id,{resolve,reject,timer}); spellWorker.postMessage({id,command,value});
        });
    }
    window.UkiWritingRules = {corrections, sources, suggest, inspect, lookup,
        checkWords: words => workerRequest('check', words),
        suggestWord: word => workerRequest('suggest', word)};
})(window);
