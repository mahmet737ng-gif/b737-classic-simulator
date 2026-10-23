'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const hashes = {
  'assets/fonts/boeing-cdu/BoeingCDU-Large.ttf': '6df71c5dc38105240f80c94f39a3daa075d4fdc6f33ccda7ce1bb48470ed0626',
  'assets/fonts/boeing-cdu/BoeingCDU-Small.ttf': 'f6576ace4558b0a611920d28664fed3462b66a246dc393f7fcbd8e04a8563db1'
};
for (const [file, sha] of Object.entries(hashes)) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
  assert.equal(actual, sha, 'Locked CDU font changed: ' + file);
}

const css = read('assets/fonts/boeing-cdu/cdu-screen.css');
for (const [family, asset] of [
  ['BoeingCDULarge', 'BoeingCDU-Large.ttf'],
  ['BoeingCDUSmall', 'BoeingCDU-Small.ttf']
]) {
  assert.ok(css.includes('font-family: "' + family + '"'), family + ' must remain mapped');
  assert.ok(css.includes('url("./' + asset + '")'), asset + ' must remain the single bundled source');
}
assert.match(css, /\.fmc-screen\s+\.fmc-lines/);
assert.match(css, /\.fmc-small/);

for (const html of [
  'cdu-standalone/index.html',
  'cdu-standalone-v3/index.html',
  'cdu-standalone-v5/index.html',
  'cdu-standalone-v6/index.html',
  'engine/ch11/physical-cdu/index.html'
]) {
  const source=read(html);
  const link=html.startsWith('engine/') ?
    '../../../assets/fonts/boeing-cdu/cdu-screen.css' :
    '../assets/fonts/boeing-cdu/cdu-screen.css';
  assert.ok(source.includes('href="' + link + '"'), html + ' must link the locked CDU font policy');
  assert.ok(source.indexOf('href="' + link + '"') > source.indexOf('href="style.css"'),
    html + ' must load locked font CSS after original layout CSS');
}
for (const js of [
  'cdu-standalone/app.js',
  'cdu-standalone-v3/app.js',
  'cdu-standalone-v5/app.js',
  'cdu-standalone-v6/app.js'
]) {
  assert.ok(read(js).includes('fmc-small'), js + ' must classify smaller CDU label rows');
}
console.log('PASS: original CDU Large/Small binary fonts, family mappings and 5 CDU entry points are locked.');
