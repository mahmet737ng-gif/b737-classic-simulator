'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const calibration=require('../engine/instruments/photo-detent-calibration-v1.js');
const dots=require('../engine/instruments/eis-dot-digits-v1.js');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/n1-egt-precision-lab.html'),'utf8');
const js=fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/n1-egt-precision-lab-v1.js'),'utf8');
new Function(js);
assert.match(html,/n1-egt-precision-lab-v1\.js/);
assert.match(html,/photo-detent-calibration-v1\.js/);
assert.match(js,/p2-conventional-full-owner-20261030\.png/);
assert.match(js,/conventional-needle-photo-v1\.svg/);
assert.match(js,/photoScan\(frame,e\.signal,e\.engine\)/);
assert.match(js,/data-photo-pointer/);
assert.match(js,/data-photo-digits/);
assert.match(js,/data-calibration-marks/);
const cases=[{signal:'n1',maximum:120,step:10,precision:.05,decimals:1},
 {signal:'egt',maximum:1000,step:100,precision:.5,decimals:0}];
let total=0;
for(const item of cases)for(const engine of ['engine1','engine2']){
 const p=calibration.getProfile(item.signal,engine);
 assert.equal(p.values[0],0,'Absolute zero on first photographed white graduation');
 assert.equal(p.values.at(-1),item.maximum);
 assert.equal(p.values.length,item.maximum/item.step+1);
 const divisions=calibration.detents(item.signal,engine,8);
 assert.equal(divisions.length,(p.values.length-1)*8+1);
 let seed=119731;
 const samples=[...p.values,...divisions.map(d=>d.value)];
 for(let i=0;i<1000;i++){seed=(Math.imul(1664525,seed)+1013904223)>>>0;
  samples.push(item.maximum*seed/4294967296);}
 for(const val of samples){
  const theta=calibration.angle(item.signal,engine,val);
  const inverse=calibration.valueAt(item.signal,engine,theta);
  assert.ok(Math.abs(inverse-val)<1e-7,'Needle/inverse mapping drift '+item.signal);
  const shown=dots.format(val,{decimals:item.decimals,integerDigits:item.signal==='n1'?3:4});
  assert.ok(Math.abs(Number(shown)-val)<=item.precision+.000001,
   'Photo needle/digital rounding inconsistent '+item.signal+' '+val);
  total++;
 }
}
assert.equal(calibration.getProfile('n2','engine1').status,'OWNER_LOCKED');
assert.ok(total>4000);
console.log('N1_EGT_PRECISION_CORE_PASS '+JSON.stringify({checks:total,
 absoluteZero:true,allTickLines:true,intermediateDivisions:8,
 independentEngineRegistrations:true,originalPhoto:true,ownerApprovedN2Unchanged:true}));
