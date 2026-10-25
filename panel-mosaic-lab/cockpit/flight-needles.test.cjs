'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('./flight-needles-model');
const assembly=JSON.parse(fs.readFileSync(path.join(__dirname,'assembly.json'),'utf8'));
const main=assembly.regions.find(region=>region.id==='main');
for(const source of Object.values(model.sources)){const piece=main.placements.find(item=>item.id===source.piece);assert.ok(piece);assert.deepEqual(assembly.assets[piece.asset].dimensions,[source.width,source.height]);for(const gauge of Object.values(source.gauges)){assert.ok(gauge.x>0&&gauge.x<source.width);assert.ok(gauge.y>0&&gauge.y<source.height);assert.ok(gauge.radius>0);}}
for(const [key,needle] of Object.entries(model.needles)){const asset=fs.readFileSync(path.join(__dirname,needle.asset),'utf8');if(key.startsWith('rmi')){assert.match(asset,/viewBox="0 0 435 436"/);if(key==='rmi1')assert.match(asset,/data:image\/png;base64,/);else assert.match(asset,/fill-rule="evenodd"/);}else{assert.match(asset,/viewBox="0 0 512 512"/);assert.match(asset,/fill="none"|fill="#f/);}}
const thin=fs.readFileSync(path.join(__dirname,model.needles.rmi1.asset),'utf8');
const hollow=fs.readFileSync(path.join(__dirname,model.needles.rmi2.asset),'utf8');
assert.match(thin,/owner reference/);assert.match(hollow,/owner reference/);
assert.equal(model.needles.rmi1.initialAngle,0);assert.equal(model.needles.rmi2.initialAngle,0);
assert.equal(model.angle(900),360);assert.throws(()=>model.angle(Infinity));
const ui=fs.readFileSync(path.join(__dirname,'flight-needles-unified.js'),'utf8');
assert.match(ui,/rmi2','rmi1/);assert.match(ui,/x:-rmi.referencePivot.x,y:-rmi.referencePivot.y/);assert.match(ui,/data-flight-needles/);
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
assert.match(html,/flight-needles-model.js\?v=FLN-0003/);
assert.match(html,/flight-needles-unified.js\?v=FLN-0003/);

// The original white RMI sprites are unchanged; verify registration and
// safe radial reach for the separately-sized captain and F/O dials.
const rmi=model.rmiRegistration;
assert.deepEqual(rmi.referencePivot,{x:216,y:218});
assert.equal(rmi.sourceWidth,435);
assert.equal(rmi.sourceHeight,436);
assert.ok(rmi.placementScale>0.5 && rmi.placementScale<0.65);
for(const source of [model.sources.captain,model.sources.firstOfficerInner]){
 const gauge=source.gauges.rmi;
 const scale=gauge.radius/rmi.sourceDialRadius*rmi.placementScale;
 const projectedTipMax=scale*rmi.sourceMaxTipRadius;
 // 0.45 of the gauge registration radius is the surveyed blank margin
 // before the dial numerals; preserve a slight clearance for both needles.
 assert.ok(projectedTipMax<=gauge.radius*0.45,
  'RMI tips must end at the inner edge, not on or past the numerals');
 assert.ok(projectedTipMax>=gauge.radius*0.42,
  'RMI tips must not look truncated or sit too far from the numeral band');
}
assert.match(ui,/const rmiScale=/);
assert.match(ui,/model.rmiRegistration/);

console.log('PASS: photographed ALT, VSI, clock, and RMI pointers registered at numeral inner edge mount on both stations.');
