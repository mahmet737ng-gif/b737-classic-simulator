'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const m=require('./rotary-guards-model.js'),toggles=require('./model.js'),mechanics=require('../../flight-controls-panel/fcom-control-mechanics.js');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,p),'utf8')),reg=read('rotary-guards.json'),layout=read('../all-overhead/atlas-layout.json');
assert.equal(m.validate(reg,layout,toggles.mapPoint),true);assert.equal(reg.rotaries.length,18);assert.equal(reg.guards.length,11);assert.ok(reg.guards.some(g=>g.id==='bus-transfer'),'BUS TRANSFER is an interactive guard on OH12');
const events=[],e=m.controller(reg,{},v=>events.push(v),mechanics);
for(const id of ['dc-meter','ac-meter','wiper','engine-start-1','engine-start-2']){
 const c=reg.rotaries.find(r=>r.id===id);assert.ok(c?.panelPivot&&c.panelMarks,id+' calibrated on actual legends');
 const rays=m.detentAngles(c);assert.equal(rays.length,c.states.length);
 for(let i=0;i<rays.length;i++)assert.ok(Math.abs(rays[i]-c.angles[i])<.002,id+' detent '+c.states[i]);
}
const ac=reg.rotaries.find(r=>r.id==='ac-meter');
assert.deepEqual(ac.states,['STBY PWR','GRD PWR','GEN 1','APU GEN','GEN 2','INV','TEST'],'GALLEY and RESID VOLTS are separate controls, not AC selector detents');
for(const id of ['dc-meter','ac-meter','wiper','engine-start-1','engine-start-2']){
 const c=reg.rotaries.find(r=>r.id===id),slot=layout.placements.find(p=>p.id===c.placementId);
 const areas=m.legendHotspots(c,slot,toggles.mapPoint);
 assert.deepEqual(areas.map(v=>v.state),c.states,id+' individually mapped legends');
 for(let i=0;i<areas.length;i++){
  assert.ok(areas[i].width>1&&areas[i].height>1&&areas[i].clipPath.startsWith('polygon('),id+' responsive polygon');
  for(let j=i+1;j<areas.length;j++)assert.equal(m.outlinesOverlap(areas[i].points,areas[j].points),false,id+' '+areas[i].state+' / '+areas[j].state+' hitboxes never overlap');
 }
}
const bad=JSON.parse(JSON.stringify(reg));bad.rotaries.find(r=>r.id==='ac-meter').legendAreas.TEST=bad.rotaries.find(r=>r.id==='ac-meter').legendAreas.INV;
assert.throws(()=>m.validate(bad,layout,toggles.mapPoint),/Overlapping legend hitboxes/,'Never silently accept competing click regions');
assert.equal(reg.rotaries.find(r=>r.id==='crossfeed').asset,'rotary-crossfeed','Use approved front-on crossfeed artwork');
e.setRotary('engine-start-1','FLT');assert.equal(e.stepRotary('engine-start-1',1),false,'FLT is the right-hand hard stop');
e.setRotary('engine-start-1','GRD');assert.equal(e.stepRotary('engine-start-1',-1),false,'GRD is the left-hand hard stop');
e.setRotary('engine-start-1','OFF');
e.stepRotary('dc-meter',1);assert.equal(e.rotary('dc-meter'),'TR1');assert.ok(Math.abs(e.angle('dc-meter')-46.488)<.002);
e.setRotary('ac-meter','TEST','legend-tap');assert.equal(e.rotary('ac-meter'),'TEST');assert.ok(Math.abs(e.angle('ac-meter')-132.852)<.002);
e.setRotary('ac-meter','GRD PWR','legend-tap');assert.equal(e.rotary('ac-meter'),'GRD PWR');assert.ok(Math.abs(e.angle('ac-meter')+89.449)<.002);assert.equal(events.at(-1).reason,'legend-tap');
e.turnRotary('crossfeed',85);assert.equal(e.rotary('crossfeed'),'OPEN');e.turnRotary('crossfeed',-200);assert.equal(e.rotary('crossfeed'),'CLOSED');
e.setRotary('panel-brightness',1000);assert.equal(e.rotary('panel-brightness'),100);e.stepRotary('panel-brightness',1);assert.equal(e.rotary('panel-brightness'),100);
e.setRotary('flight-alt',355);e.stepRotary('flight-alt',1);assert.equal(e.rotary('flight-alt'),0);e.stepRotary('flight-alt',-1);assert.equal(e.rotary('flight-alt'),355);
assert.equal(e.setRotary('wiper','INVALID'),false);assert.equal(e.setRotary('flight-alt',NaN),false);
for(const c of reg.guards){
 const initial=e.guard(c.id);assert.equal(e.guardAction(c.id,'set',c.states[0]).reason,'GUARD_CLOSED');assert.deepEqual(e.guard(c.id),initial);
 assert.equal(e.guardAction(c.id,'open').ok,true);for(const value of c.states){assert.equal(e.guardAction(c.id,'set',value).ok,true);assert.equal(e.guard(c.id).value,value);}
 assert.equal(e.guardAction(c.id,'close').ok,true);assert.equal(e.guard(c.id).guard,'closed');assert.equal(e.guard(c.id).value,c.closePolicy.force||c.states.at(-1));
}
assert.equal(e.guard('generator-disconnect-1').value,'disconnect','closing disconnect guard preserves disconnect, never silently reconnects');
assert.equal(e.guard('flight-control-a').value,'on');assert.equal(e.guard('alternate-flaps-master').value,'off');assert.equal(e.guard('emergency-exit-lights').value,'armed');assert.equal(e.guard('standby-power').value,'auto');
const tr=read('registry.json');let enabled=false;const te=toggles.controller(tr,{},()=>{},id=>id!=='alternate-flaps-position'||enabled);
assert.equal(te.set('alternate-flaps-position','UP','hold'),false);enabled=true;te.set('alternate-flaps-position','UP','hold');assert.equal(te.get('alternate-flaps-position'),'UP');enabled=false;te.release('alternate-flaps-position');assert.equal(te.get('alternate-flaps-position'),'OFF','safety return remains possible after disarm');
const saved=e.snapshot();saved.guards['alternate-flaps-master']={guard:'closed',value:'arm'};saved.rotaries['dc-meter']='BOGUS';const restored=m.controller(reg,saved,()=>{},mechanics);assert.equal(restored.guard('alternate-flaps-master').value,'off');assert.equal(restored.rotary('dc-meter'),'APU BAT');
for(const a of Object.values(reg.assets)){const bytes=fs.readFileSync(path.resolve(__dirname,a.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256);}
e.reset();for(const c of reg.rotaries)assert.equal(e.rotary(c.id),c.default);for(const c of reg.guards)assert.deepEqual(e.guard(c.id),c.default);
console.log('PASS: 18 fixed-pivot rotaries, ranges/wrap/detents; 11 lower overhead guards, closed gating and per-control close policies; Alternate Flaps interlock; safe restore; 9 approved asset hashes.');

const smallRotaryIds=['engine-start-1','engine-start-2','ignition-source'];
for(const c of reg.rotaries){
 assert.equal(c.visualSize||'Standard',smallRotaryIds.includes(c.id)?'Small':'Standard',c.id+' rotary size');
 if(smallRotaryIds.includes(c.id))assert.ok(c.renderScale>0&&c.renderScale<1,c.id+' compact picture');
}
const rotaryView=fs.readFileSync(path.join(__dirname,'rotary-guards.js'),'utf8');
assert.ok(rotaryView.includes('*(c.renderScale||1)'),'Small rotary images must honor render scale');
console.log('PASS Small rotary art for both engine start selectors and ignition, detents unchanged.');

/* OH11 owner screenshot aperture checks. Run three independent geometry passes;
   numbers are screenshot-calibrated, not real-world millimetres. */
const geometryCases=[
 ['generator-disconnect-1',[154,334,200,418],132,281],
 ['generator-disconnect-2',[847,334,200,418],132,281],
 ['standby-power',[391,232,421,184],280,123]
];
for(let pass=1;pass<=3;pass++){
 for(const [id,rect,expectedWidth,expectedHeight] of geometryCases){
  const c=reg.guards.find(item=>item.id===id),p=layout.placements.find(item=>item.id===c.placementId);
  assert.deepEqual(c.mountingRectSource,rect,'pass '+pass+' source rectangle '+id);
  const [x,y,w,h]=rect;
  const a=toggles.mapPoint({...c,sourcePoint:[x,y],bezelSourceDiameter:0},p);
  const b=toggles.mapPoint({...c,sourcePoint:[x+w,y+h],bezelSourceDiameter:0},p);
  const sourceRatio=w/h,screenRatio=(b.x-a.x)/(b.y-a.y);
  assert.ok(Math.abs(screenRatio/sourceRatio-1)<.02,'only locked atlas plate stretch allowed '+id);
  assert.ok(Math.abs((b.x-a.x)*1.61-expectedWidth)<4,'screenshot aperture width '+id);
  assert.ok(Math.abs((b.y-a.y)*1.61-expectedHeight)<5,'screenshot aperture height '+id);
 }
 const cases=geometryCases.map(([id,r])=>({id,r}));
 for(let i=0;i<cases.length;i++)for(let j=i+1;j<cases.length;j++){
  const a=cases[i].r,b=cases[j].r;
  assert.ok(a[0]+a[2]<=b[0]||b[0]+b[2]<=a[0]||a[1]+a[3]<=b[1]||b[1]+b[3]<=a[1],'guard recess overlap '+cases[i].id+' '+cases[j].id);
 }
}
const calibratedSource=fs.readFileSync(path.join(__dirname,'rotary-guards.js'),'utf8');
const calibratedStyles=fs.readFileSync(path.join(__dirname,'rotary-guards.css'),'utf8');
assert.match(calibratedSource,/guarded\(c,p,placements.get\(c.placementId\)\)/);
assert.match(calibratedSource,/calibrated-horizontal-standby/);
assert.match(calibratedStyles,/guard-housing--horizontal/);
assert.equal(reg.guards.find(c=>c.id==='standby-power').rotation,0,'wide switch is not a -90° rotated narrow sprite');
console.log('PASS: three independent OH11 aperture-mapping geometry checks; no recess overlaps; source assets unchanged.');
