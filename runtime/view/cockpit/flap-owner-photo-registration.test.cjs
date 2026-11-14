'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const a=JSON.parse(fs.readFileSync(__dirname+'/assembly.json','utf8'));
const f=JSON.parse(fs.readFileSync(__dirname+'/flap-lever-test.json','utf8'));
const p=a.regions.find(x=>x.id==='pedestal').placements.find(x=>x.id==='throttle-quadrant');
const target=f.backgroundCalibrations[p.asset]?.targets;
assert.ok(target,'active throttle quadrant must have its own detent calibration');
const expected={0:352,1:425,2:475,5:526,10:573,15:623,25:670,30:715,40:769};
assert.deepEqual(Object.keys(target),Object.keys(expected));
for(const [key,y]of Object.entries(expected)){
 assert.equal(target[key].x,597,'tooth and hit target should reach the white tick: '+key);
 assert.equal(target[key].y,y,'photo-measured native source Y: '+key);
}
assert.ok(Object.keys(expected).every((k,i,arr)=>i===0||target[k].y>target[arr[i-1]].y));
console.log('PASS: active owner FLAP ticks agree with image-based nine-position registration.');
