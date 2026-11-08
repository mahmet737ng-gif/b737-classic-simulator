'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const m=require('./fo-proportional-scale-v1.js');
assert.equal(m.VERSION,'FO-PROPORTIONAL-SCALE-0003');
assert.equal(m.PROFILES.EIS.anchorX,1222);
assert.equal(m.PROFILES.CONVENTIONAL.anchorX,1374);
assert.equal(m.GPWS_IDS.length,3);
// EIS: the adjoining inner/outer native pieces share EXACTLY one seam.
const inner=m.mapRect(1222,127,372,694.156862745098);
const outer=m.mapRect(1594,225,475,592.1638468388246);
assert.ok(Math.abs(inner.x+inner.w-outer.x)<1e-8);
assert.ok(outer.x+outer.w<=2100);
assert.ok(Math.abs(inner.x-1222)<1e-10);
// Conventional: owner F/O photo abuts the engine panorama at x=1374
// and extends exactly to the right edge of the native main panel (2100).
const photo=m.mapRect(1374,127,695,695*1223/1286,'CONVENTIONAL');
assert.ok(Math.abs(photo.x-1374)<1e-10);
assert.ok(Math.abs(photo.x+photo.w-2100)<1e-8);
assert.ok(Math.abs(m.mapRect(1374,127,0,0,'CONVENTIONAL').x-1374)<1e-10);
// Single affine map: EADI, ALT, RMI, VSI, clock, photo and lamps.
// Owner's horizontal Paint reference: compare both framed CRT tops AND the
// internal zero-pitch horizon, not just the FO inner/outer horizontal seam.
const capitTop=218.20;
const foGlass=m.mapRect(1612.75,263.40,173.44,147.14);
assert.ok(Math.abs(m.EIS_OUTER_LIFT+49.974)<1e-9);
assert.ok(Math.abs(foGlass.y+m.EIS_OUTER_LIFT-capitTop)<1e-9);
const outerPanel=m.mapRect(1594,225,475,592.1638468388246);
assert.ok(outerPanel.y+m.EIS_OUTER_LIFT<outerPanel.y);
const captCanvasHorizon=352.6+(393-387)*1.139152;
const foCanvasHorizon=368.42016+(393-387)*1.26;
const captHorizon=capitTop+159.30*captCanvasHorizon/720;
const foHorizon=(foGlass.y+m.EIS_OUTER_LIFT)+foGlass.h*foCanvasHorizon/720;
assert.ok(Math.abs(captHorizon-foHorizon)<0.0001,
  'The visible pitch horizons must align within 0.0001 native panel unit');
const eadiSource=fs.readFileSync(__dirname+'/eadi-stage1-unified-v1.js','utf8');
assert.ok(eadiSource.includes('EADI-UNIFIED-STAGE1-0009-FO-HORIZON-REGISTERED'));
assert.ok(eadiSource.includes('c.translate(450,368.42016)'));
const eadi=m.mapRect(1612.75,263.4,173.44,147.14);
const eadiConventional=m.mapRect(1612.75,263.4,173.44,147.14,'CONVENTIONAL');
assert.ok(eadi.x>1612.75 && eadi.w>173.44);
assert.ok(eadiConventional.x>1612.75 && eadiConventional.w>173.44);
const mockGuard=id=>({
 matches:q=>q==='[data-guard-id],.owner18-guard-control',
 getAttribute:name=>name==='data-guard-id'?id:null
});
for(const id of m.GPWS_IDS){
 assert.equal(m.classification(mockGuard(id),{},'EIS'),'EIS');
 assert.equal(m.classification(mockGuard(id),{},'CONVENTIONAL'),'CONVENTIONAL');
}
assert.equal(m.classification(mockGuard('antiskid'),{},'EIS'),null);
assert.equal(m.classification(mockGuard('flight-control-a'),{},'CONVENTIONAL'),null);
// Independent CSS translate+scale must not replace protected GPWS mechanics
// (their existing transform and transformed switch sprite remain unmodified).
const source=fs.readFileSync(__dirname+'/fo-proportional-scale-v1.js','utf8');
assert.ok(source.includes('node.style.translate=tr'));
assert.ok(source.includes('node.style.scale=sc'));
assert.ok(!source.includes('node.style.transform='));
assert.ok(!source.includes('appendChild('));
const index=fs.readFileSync(__dirname+'/index.html','utf8');
assert.equal((index.match(/fo-proportional-scale-v1\.js/g)||[]).length,1);
assert.ok(index.includes('FO-PROPORTIONAL-SCALE-0004-CONV-CRT-ISOLATED'));
console.log('PASS: FO outer face and both EADI glass/horizon datums align; photo seams remain registered and 3 GPWS guards preserve their mechanics.');
