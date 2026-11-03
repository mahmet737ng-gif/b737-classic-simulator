'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Cal=require('../engine/instruments/hydraulic-gauge-calibration-v2.js');
const cockpit=path.join(__dirname,'../panel-mosaic-lab/cockpit');
test('Three distinct gauge centers are registered to the correct real source photos',()=>{
 assert.equal(Cal.validate(),true);
 const a=Cal.gauge('A'),b=Cal.gauge('B'),c=Cal.gauge('BRAKE');
 assert.deepEqual(a.pivot,{x:982,y:991});
 assert.deepEqual(b.pivot,{x:1118,y:991});
 assert.deepEqual(c.pivot,{x:473,y:568});
 assert.equal(a.photoKind,'HYD_DUAL');assert.equal(b.photoKind,'HYD_DUAL');
 assert.equal(c.photoKind,'BRAKE');
 assert.ok(a.pivot.x>a.viewport.x&&a.pivot.x<a.viewport.x+a.viewport.w);
 assert.ok(b.pivot.x>b.viewport.x&&b.pivot.x<b.viewport.x+b.viewport.w);
 assert.ok(a.viewport.x+a.viewport.w<b.pivot.x,'A photo must not also show the B dial center');
 assert.ok(b.viewport.x>a.pivot.x,'B photo must not also show A dial center');
 assert.equal(Cal.local('A').x,75);assert.equal(Cal.local('B').x,75);
 assert.equal(Cal.local('BRAKE').x,88);assert.equal(Cal.local('BRAKE').y,88);
});
test('Accumulator 0 PSI points toward actual 3:30 mark, not the old wrong 5:30',()=>{
 const angle=Cal.angle('BRAKE',0);
 assert.ok(angle>=105&&angle<=115,'zero at approximately 3:30');
 const tip=Cal.polar(angle,Cal.gauge('BRAKE').needleLength);
 assert.ok(tip.dx>50&&tip.dy>15&&tip.dy<35,'zero must be right and slightly DOWN');
 const center=Cal.local('BRAKE');
 assert.ok(center.x+tip.dx>140&&center.y+tip.dy>100,'zero tip near printed lower-right tick');
 assert.equal(Cal.angle('BRAKE',1000),180);
 assert.equal(Cal.angle('BRAKE',2000),269);
 assert.equal(Cal.angle('BRAKE',3000),358);
 assert.equal(Cal.angle('BRAKE',4000),425);
});
test('A and B have five independent physical detents and true 0/3/4 needle sectors',()=>{
 for(const id of ['A','B']){
  const g=Cal.gauge(id);
  assert.deepEqual(g.detents.map(x=>x.psi),[0,1000,2000,3000,4000]);
  const zero=Cal.polar(Cal.angle(id,0),g.needleLength);
  assert.ok(zero.dx>0&&zero.dy>0,id+' zero must be LOWER RIGHT');
  const three=Cal.polar(Cal.angle(id,3000),g.needleLength);
  assert.ok(three.dx<0&&three.dy<0,id+' 3000 psi must be UPPER LEFT');
  const four=Cal.polar(Cal.angle(id,4000),g.needleLength);
  assert.ok(four.dx>0&&four.dy<0,id+' 4000 psi must be UPPER RIGHT');
  assert.ok(g.needleLength>=36&&g.needleLength<=43);
 }
 assert.notEqual(Cal.angle('A',0),Cal.angle('BRAKE',0),'brake uses its own map');
 assert.notEqual(Cal.angle('A',3000),Cal.angle('B',3000),'A and B individually calibrated');
});
test('No snapping or discontinuity across interpolation, and invalid source never fabricates a pointer',()=>{
 for(const id of ['A','B','BRAKE']){
  assert.equal(Cal.angle(id,-1000),Cal.angle(id,0));
  assert.equal(Cal.angle(id,9000),Cal.angle(id,4000));
  assert.equal(Cal.angle(id,null),null);
  assert.equal(Cal.angle(id,Number.NaN),null);
  for(let p=0;p<4000;p+=10){
   const before=Cal.angle(id,p),after=Cal.angle(id,p+10);
   assert.ok(after>=before&&after-before<=1.1,'smooth 10-psi step '+id+' / '+p);
  }
 }
});
test('Both native QTY digital readouts are precisely within their own real black windows',()=>{
 const a=Cal.qtyLocal('A'),b=Cal.qtyLocal('B');
 assert.deepEqual(a,{x:83,y:164});
 assert.deepEqual(b,{x:53,y:164});
 assert.equal(Cal.qtyLocal('BRAKE'),null);
 assert.equal(Cal.gauge('A').qtyWindow.y,1085);
 assert.equal(Cal.gauge('B').qtyWindow.y,1085);
});
test('Unified loads the separate calibration before the OH17 lab and retains real switch control routing',()=>{
 const html=fs.readFileSync(path.join(cockpit,'index.html'),'utf8');
 const js=fs.readFileSync(path.join(cockpit,'hydraulic-live-lab-v1.js'),'utf8');
 assert.ok(html.includes('hydraulic-gauge-calibration-v2.js'));
 assert.ok(html.indexOf('hydraulic-gauge-calibration-v2.js')<html.indexOf('hydraulic-live-lab-v1.js'));
 assert.ok(js.includes('Cal.angle(def.id,value)'));
 assert.ok(js.includes('rotor.style.transformOrigin'));
 assert.ok(js.includes('rotor.style.transition'));
 assert.ok(js.includes('data.hydQtyWindow')||js.includes('dataset.hydQtyWindow'));
 assert.ok(js.includes('B737OverheadToggles'));
 assert.ok(!js.includes('const PRESSURE_ANGLE='),'old generic nonphoto calibration removed');
 assert.ok(!js.includes('const angle=pressureAngle(value)+90'),'old 90-degree offset removed');
});
