const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
test('Üretim JavaScript dosyalarının tamamı ayrıştırılır', () => {
  for (const name of fs.readdirSync('assets/js').filter(n => n.endsWith('.js'))) {
    const r = spawnSync(process.execPath, ['--check', 'assets/js/'+name], {encoding:'utf8'});
    assert.equal(r.status, 0, name+': '+r.stderr);
  }
});
