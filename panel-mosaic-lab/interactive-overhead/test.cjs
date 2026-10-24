'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const model=require('./model.js'),registry=JSON.parse(fs.readFileSync(path.join(__dirname,'registry.json'),'utf8'));
const layout=JSON.parse(fs.readFileSync(path.join(__dirname,'../all-overhead/atlas-layout.json'),'utf8'));
assert.equal(model.validate(registry,layout),true);
assert.equal(registry.controls.length,58);
assert.deepEqual(Object.fromEntries(['toggle-2','toggle-3-vertical','toggle-3-horizontal'].map(t=>[t,registry.controls.filter(c=>c.type===t).length])),{'toggle-2':41,'toggle-3-vertical':14,'toggle-3-horizontal':3});
assert.equal(registry.controls.some(c=>c.placementId==='UPPER'),false,'guide covers lower overhead only');
const events=[],engine=model.controller(registry,{},e=>events.push(e));
engine.cycle('yaw-damper');assert.equal(engine.get('yaw-damper'),'OFF');engine.cycle('yaw-damper');assert.equal(engine.get('yaw-damper'),'ON');
engine.step('vhf-nav',-1);assert.equal(engine.get('vhf-nav'),'BOTH ON 1');engine.step('vhf-nav',-1);assert.equal(engine.get('vhf-nav'),'BOTH ON 1','left stop clamps');
engine.step('vhf-nav',1);assert.equal(engine.get('vhf-nav'),'NORMAL');engine.step('vhf-nav',1);assert.equal(engine.get('vhf-nav'),'BOTH ON 2');
const before=events.length;assert.equal(engine.set('vhf-nav','UP'),false);assert.equal(events.length,before,'invalid vertical detent cannot enter horizontal selector');
for(const id of ['alternate-flaps-position','window-power-test','gen-1','outflow-manual']){
 const c=registry.controls.find(c=>c.id===id);for(const state of Object.keys(c.springReturn)){engine.set(id,state,'hold');assert.equal(engine.get(id),state);engine.release(id);assert.equal(engine.get(id),c.springReturn[state]);}
}
engine.set('apu-start','START');engine.releaseAll();assert.equal(engine.get('apu-start'),'ON','APU START returns to ON, not OFF');
engine.set('pack-l','HIGH');engine.releaseAll();assert.equal(engine.get('pack-l'),'HIGH','latched three-position switch stays selected');
const resumed=model.controller(registry,{...engine.snapshot(),'alternate-flaps-position':'UP','yaw-damper':'invalid'});
assert.equal(resumed.get('vhf-nav'),'BOTH ON 2');assert.equal(resumed.get('alternate-flaps-position'),'OFF','momentary direction is never restored held');assert.equal(resumed.get('yaw-damper'),'ON','invalid saved value uses registry default');
const nav=registry.controls.find(c=>c.id==='vhf-nav'),slot=layout.placements.find(p=>p.id==='OH08'),point=model.mapPoint(nav,slot);
assert.ok(point.y>=slot.y&&point.y<=slot.y+slot.h,'nav shared-source crop maps into OH08, not OH07');
const savedPoint={...point};engine.set('vhf-nav','NORMAL');assert.deepEqual(model.mapPoint(nav,slot),savedPoint,'socket pivot never moves with the detent');
for(const c of registry.controls){const p=model.mapPoint(c,layout.placements.find(p=>p.id===c.placementId));assert.ok(Number.isFinite(p.x+p.y+p.diameter)&&p.diameter>0);}
for(const a of Object.values(registry.assets)){const bytes=fs.readFileSync(path.resolve(__dirname,a.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256,'original approved toggle asset reused');}
engine.reset();for(const c of registry.controls)assert.equal(engine.get(c.id),c.default);
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');assert.ok(html.includes('<base href="../all-overhead/">'));assert.ok(html.includes('./stage.js?v=UPD-0012-OVH-measured-seams'),'frozen renderer reused unchanged');
console.log('PASS: 58 socket mappings; binary, horizontal and vertical detents; clamps; spring release; safe persistence; fixed pivots; six approved frame hashes; frozen renderer reuse.');
