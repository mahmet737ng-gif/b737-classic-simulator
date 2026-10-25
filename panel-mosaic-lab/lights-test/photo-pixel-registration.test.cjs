'use strict';
// Keep signed-off lamp positions distinguishable from photographs that are only visually plausible.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const read=p=>JSON.parse(fs.readFileSync(path.resolve(root,p),'utf8'));
const registry=read('photo-pixel-registration-2026-10-26.json');
const original=read('phase1-geometry-audit.json');
const oh=read('../interactive-overhead/lights.json');
const main=read('../cockpit/lights.json');
const code=new Map([...oh.lights,...main.lights].map(x=>[x.id,x]));
const audit=new Map(original.instances.map(x=>[x.id,x]));
assert.equal(registry.summary.total,142);
assert.equal(registry.records.length,142);
assert.equal(new Set(registry.records.map(x=>x.id)).size,142);
assert.equal(oh.lights.length,112);
assert.equal(main.lights.length,30);
assert.equal(registry.summary.originalPhotos,19);
assert.equal(registry.summary.lockedImageChanges,0);
assert.equal(registry.summary.sourceRectsChanged,0);
let accepted=0,pending=0;
for(const record of registry.records){
 const prior=audit.get(record.id),source=code.get(record.id);
 assert.ok(prior&&source,record.id);
 assert.deepEqual(record.sourceRect,prior.sourceRect,record.id);
 assert.deepEqual(record.sourceRect,source.sourceRect,record.id);
 assert.deepEqual(record.sourceCenter,prior.sourceCenter,record.id);
 assert.equal(record.reviewedOriginalContactSheet,true);
 assert.equal(record.sourceRectChanged,false);
 const independentlyVerified=record.pixelEdgeTest==='AUTO_CENTRE_MATCH'
                         ||record.pixelComponentTest==='PHOTO_COMPONENT_CENTRED';
 assert.equal(record.pixelCentreVerdict,
   independentlyVerified?'PHOTO_PIXEL_CENTRE_VERIFIED_3PX':'PHOTO_VISUAL_REVIEW_PIXEL_PRECISION_UNRESOLVED',
   record.id);
 if(independentlyVerified)accepted++;else pending++;
}
assert.equal(accepted,110);
assert.equal(pending,32);
assert.equal(registry.summary.unionPixelVerified,accepted);
assert.equal(registry.summary.pixelPrecisionUnresolved,pending);
console.log('PASS: 142 photo-reviewed source rectangles, 110 pixel-centre verified, 32 unresolved; originals and locked backgrounds remain unchanged.');
