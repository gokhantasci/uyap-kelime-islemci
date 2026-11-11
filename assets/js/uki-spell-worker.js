/* Türkçe sözlük tamamen cihazda çalışır; belge kelimeleri ağa gönderilmez. */
importScripts('../vendor/nspell.js');
let dictionary;
async function ready() {
    if (!dictionary) dictionary = Promise.all([
        fetch('../data/turkish/tr.aff').then(r => {if(!r.ok)throw Error('Türkçe ek kuralları yüklenemedi.');return r.text();}),
        fetch('../data/turkish/tr.dic').then(r => {if(!r.ok)throw Error('Türkçe kelime sözlüğü yüklenemedi.');return r.text();})
    ]).then(([aff,dic]) => new UkiNSpell(aff,dic));
    return dictionary;
}
self.onmessage = async e => {
    const {id,command,value} = e.data;
    try {
        const spell = await ready();
        const result = command === 'check'
            ? Object.fromEntries(value.map(word => [word,spell.correct(word)]))
            : spell.suggest(value).slice(0,8);
        self.postMessage({id,result});
    } catch (err) { self.postMessage({id,error:err.message}); }
};
