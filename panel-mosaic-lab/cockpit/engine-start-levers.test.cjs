'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const model=require('./engine-start-lever-model.js');
const assembly=require('./assembly.json');
const pedestal=assembly.regions.find(r=>r.id==='pedestal');
const throttle=pedestal.placements.find(p=>p.id==='throttle-quadrant');
const png=fs.readFileSync(path.join(root,'../..',throttle.asset));
assert.equal(png.subarray(1,4).toString(),'PNG');
assert.equal(png.readUInt32BE(16),model.SOURCE.width);
assert.equal(png.readUInt32BE(20),model.SOURCE.height);
assert.deepEqual(throttle.sourceWindow,model.SOURCE.window);
const plate={x:throttle.x,y:throttle.y,w:throttle.w,h:throttle.h};
for(const device of ['engine1','engine2']){
 const rest=model.placement(plate,device,'CUTOFF');
 const active=model.placement(plate,device,'IDLE');
 for(const spot of [rest,active]){
  assert.ok(spot.left>=plate.x&&spot.left+spot.width<=plate.x+plate.w);
  assert.ok(spot.top>=plate.y&&spot.top+spot.height<=plate.y+plate.h);
 }
 assert.ok(active.top<rest.top,'moving start lever forward to IDLE');
 assert.ok(rest.top-active.top>50&&rest.top-active.top<100,'observable physical detent travel');
}
const first=model.placement(plate,'engine1','CUTOFF');
const second=model.placement(plate,'engine2','CUTOFF');
assert.ok(first.left+first.width<second.left,'Engine 1 and 2 handles cannot overlap');
assert.throws(()=>model.placement(plate,'engine3','IDLE'));
assert.throws(()=>model.placement({...plate,w:900},'engine1','IDLE'),/crop/);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const host=fs.readFileSync(path.join(root,'isn-cockpit.js'),'utf8');
const handles=fs.readFileSync(path.join(root,'engine-start-levers.js'),'utf8');
for(const file of ['engine-start-lever-model.js','engine-start-levers.js','engine-start-levers.css'])assert.ok(html.includes(file));
assert.ok(host.includes('b737:engine-start-lever-command'));
assert.ok(host.includes('b737:engine-start-lever-state'));
assert.ok(handles.includes("source:'PEDESTAL_PHYSICAL'"));
assert.ok(!host.includes('data-start-lever='),'no disconnected engine lever simulation buttons');
console.log('PASS: two independently positioned physical Engine Start Levers, exact crop, non-overlapping click targets and ISN-03 state coupling.');
