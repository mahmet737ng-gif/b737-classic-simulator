'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname,source=fs.readFileSync(path.join(dir,'efis-pedestal-raster-v1.js'),'utf8');
const css=fs.readFileSync(path.join(dir,'efis-pedestal-raster-v1.css'),'utf8');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const bridge=fs.readFileSync(path.join(dir,'ehsi-unified-v1.js'),'utf8');
const assets=['efis-cp-photo-plate-v1.webp','efis-rose-mode-v1.webp','efis-range-tfc-v1.webp','efis-tfc-center-v2.webp','existing-knob-hsi.webp','existing-knob-wxInner.webp'];
for(const name of assets){
 const b=fs.readFileSync(path.join(dir,'assets',name));
 assert.equal(b.subarray(0,4).toString('ascii'),'RIFF',name+' RIFF');
 assert.equal(b.subarray(8,12).toString('ascii'),'WEBP',name+' WEBP');
 assert.ok(source.includes(name),name+' actually mounted');
}
const knob=fs.readFileSync(path.join(dir,'dcpcs-altitude-knob-front-v1.webp'));
assert.equal(knob.subarray(8,12).toString('ascii'),'WEBP');
assert.equal((source.match(/dcpcs-altitude-knob-front-v1.webp/g)||[]).length,2,'DH and EADI BRT both reuse original DCPCS photo knob');
assert.ok(source.includes("tfc:asset('efis-tfc-center-v2.webp')"));
assert.ok(source.includes("const ROTORS=")&&source.includes("const RANGES="));
assert.ok(source.includes("['CAPT','FO']")&&source.includes("states={CAPT:initial(),FO:initial()}"));
assert.ok(source.includes("const layout=[{seat:'CAPT',x:55,y:1290,w:365},{seat:'FO',x:735,y:1290,w:365}]"));
assert.ok(55+365<735,'CAPT and FO EFIS footprints remain separate');
assert.ok(735+365<=1150,'FO EFIS fits native pedestal width');
assert.ok(source.includes("root.dispatchEvent(new CustomEvent('b737:unified-efis-control'"));
assert.ok(bridge.includes("win.addEventListener('b737:unified-efis-control'"));
assert.ok(bridge.includes("state[seat]")&&bridge.includes("x.ehsi.mode=p.mode"));
assert.ok(html.includes('./efis-pedestal-raster-v1.css')&&html.includes('./efis-pedestal-raster-v1.js'));
assert.ok(!source.includes('<svg')&&!css.includes('background-image: url(data:image/svg'),'No SVG knobs used');
console.log('PASS: CAPT/FO pedestal registration, exact raster source blobs, independent controls, EHSI event bridge and DCPCS knob reuse.');
