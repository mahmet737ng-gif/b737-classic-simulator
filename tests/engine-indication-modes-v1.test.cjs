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
  "User's Conventional choice must survive refresh");
s.set({engineInstruments:'EIS'});
assert.equal(profile.createStore({storage}).resolve().engineInstruments.id,'EIS');
const file = rel => fs.readFileSync(path.join(base,rel), 'utf8');
const svg=file('panel-mosaic-lab/cockpit/assets/conventional-engine-face-v1.svg');
assert.equal((svg.match(/data-conventional-red-lamp-socket="1"/g)||[]).length,6,
  'Three pairs of in-gauge red lamp holes (N1/EGT/N2)');
assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'),'Conventional face is standalone');
for(const id of ['N1','EGT','N2','FF','OIL','PRESS','TEMP','QUANTITY','VIB'])
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

// Exercise the actual mount: a drawn legacy SVG must never be requested.
const vm=require('node:vm');
const crypto=require('node:crypto');
const png=fs.readFileSync(path.join(base,'panel-mosaic-lab/cockpit/assets/conventional-engine-panel-owner-20261029.png'));
assert.equal(png.subarray(1,4).toString(),'PNG');
assert.equal(png.readUInt32BE(16),1182);
assert.equal(png.readUInt32BE(20),1330);
assert.equal(crypto.createHash('sha256').update(png).digest('hex'),
 'd4ae225cddfe7697dec4c73b0f59aa3cd51ccc1234c63e6dc8323ce84c45f710',
 'The final owner image must be published byte for byte');
let mountedImage=null;
const host={dataset:{},appendChild(el){el.parentNode=this;mountedImage=el;}};
const root={dataset:{}};
const document={documentElement:root,baseURI:'https://example.test/panel-mosaic-lab/cockpit/',
 querySelector:()=>host,getElementById:()=>null,
 createElement:()=>({setAttribute(){}})};
const window={B737AircraftProfileStore:s,addEventListener(){},dispatchEvent(){}};
vm.runInNewContext(js,{document,window,URL,CustomEvent:class {constructor(type,init){this.type=type;this.detail=init.detail;}}});
const api=window.B737EngineIndicationModeV1;
assert.ok(mountedImage.src.endsWith('/assets/conventional-engine-panel-owner-20261029.png?v=CONV-0002'));
assert.equal(api.status().display,'EIS');
api.setMode('CONVENTIONAL');
assert.equal(api.status().display,'EIS','Do not show a broken panel while image is loading');
mountedImage.onload();
assert.equal(api.status().display,'CONVENTIONAL');
assert.equal(host.dataset.engineFace,'CONVENTIONAL');
assert.equal(api.status().version,'CONV-0002');
mountedImage.onerror();
assert.equal(api.status().display,'EIS','Image load failure must fall back safely');
mountedImage.onload();
assert.equal(api.status().display,'CONVENTIONAL');
api.setMode('EIS');
assert.equal(api.status().display,'EIS');
assert.ok(html.includes('engine-indication-mode-v1.js?v=CONV-0002'));
assert.ok(html.includes('conventional-engine-needles-v1.js?v=CONV-NEEDLE-0002'));
console.log('PASS: final original PNG, versioned Unified mount, EIS/Conventional switching and load-failure fallback.');
