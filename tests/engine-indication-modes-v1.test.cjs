'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, '..');
const profile = require('../engine/config/aircraft-profile-v1.js');
assert.equal(profile.DEFAULTS.engineInstruments, 'EIS', 'Fresh Unified session must begin in EIS');
const data = new Map(), storage = {
  getItem: key => data.has(key) ? data.get(key) : null,
  setItem: (key,value) => data.set(key,value)
};
const s = profile.createStore({storage});
assert.equal(s.resolve().engineInstruments.id, 'EIS');
s.set({engineInstruments:'CONVENTIONAL'});
assert.equal(profile.createStore({storage}).resolve().engineInstruments.id,'CONVENTIONAL',
  'User's Conventional choice must survive refresh');
s.set({engineInstruments:'EIS'});
assert.equal(profile.createStore({storage}).resolve().engineInstruments.id,'EIS');
const file = rel => fs.readFileSync(path.join(base,rel), 'utf8');
const svg=file('panel-mosaic-lab/cockpit/assets/conventional-engine-face-v1.svg');
assert.equal((svg.match(/data-conventional-red-lamp-socket="1"/g)||[]).length,6,
  'Three pairs of in-gauge red lamp holes (N1/EGT/N2)');
assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'),'Conventional face is standalone');
for(const id of ['N1','EGT','N2','FF','OIL PRESS','OIL TEMP','OIL QUANTITY','VIB'])
  assert.ok(svg.includes(id), 'Printed gauge dial missing: '+id);
const js=file('panel-mosaic-lab/cockpit/engine-indication-mode-v1.js');
const css=file('panel-mosaic-lab/cockpit/engine-indication-mode-v1.css');
const html=file('panel-mosaic-lab/cockpit/index.html');
assert.ok(js.includes('b737:aircraft-profile-change'),'Mode must follow Settings');
assert.ok(js.includes('b737:cockpit-mounted'),'Mount must wait for the full image assembly');
assert.ok(js.includes('engineInstruments:mode'),'No second competing state store');
assert.ok(css.includes('.conventional-engine-panel-v1'),'Isolated overlay missing');
assert.ok(css.includes('data-engine-indication="CONVENTIONAL"'),'Conventional CSS toggle missing');
assert.ok(html.includes('engine-indication-mode-v1.js'),'Unified JS not installed');
assert.ok(html.includes('engine-indication-mode-v1.css'),'Unified CSS not installed');
console.log('PASS: default EIS, user preference persists, SVG face with six lamp sockets, reversible isolated Unified mount');
