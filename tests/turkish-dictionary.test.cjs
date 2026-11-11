const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Dağıtılan Türkçe sözlük kök ve çekimli kelimeleri cihazda denetler',()=>{
  const nspell=require('nspell');
  const engine=nspell(fs.readFileSync('assets/data/turkish/tr.aff'),fs.readFileSync('assets/data/turkish/tr.dic'));
  assert.equal(engine.correct('mahkeme'),true);
  assert.equal(engine.correct('kelimeler'),true);
  assert.equal(engine.correct('yalnış'),false);
  assert.equal(engine.correct('asdasdkelime'),false);
});
