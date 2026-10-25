'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const src=path.join('panel-mosaic-lab','cockpit','assets');
const model=require(path.join(ROOT,'panel-mosaic-lab/cockpit/aircon-400-oh21-model.js'));
const a=model.packs;assert.equal(a.length,2);
assert.deepEqual(a.map(x=>x.side),['L','R']);
assert.ok(a.every(x=>x.rect[2]===180&&x.rect[3]===66));
for(const state of ['OFF','ON']){
 const original=read(path.join(src,'737-400-PACK_'+state+'.svg'));
 const derived=read(path.join(src,'737-400-PACK_FITTED_'+state+'.svg'));
 const glyphs=s=>[...s.matchAll(/<text\b[^>]*>.*?<\/text>/gs)].map(x=>x[0]);
 assert.deepEqual(glyphs(original),glyphs(derived),'Do not stretch PACK legends '+state);
 assert.match(derived,/viewBox="0 0 818\.181818 300"/);
 assert.match(derived,/data-fit="native-pack-aperture"/);
 assert.doesNotMatch(derived,/transform="scale\(/);
 assert.equal((818.181818/300).toFixed(6),(180/66).toFixed(6),'SVG viewBox must match each physical 737-400 PACK glass');
}
const runtime=read('panel-mosaic-lab/cockpit/aircon-400-oh21-overlay.js');
assert.match(runtime,/737-400-PACK_FITTED_/);
assert.ok(!runtime.includes("asset('737-400-PACK_'+state+'.svg')"));
console.log('PASS: 737-400 L/R PACK indicators preserve original letters, fit 180×66 source glass ratio, and mount both derived OFF/ON photo-normalized states.');
