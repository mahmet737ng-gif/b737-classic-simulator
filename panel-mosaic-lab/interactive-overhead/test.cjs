'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const model=require('./model.js'),registry=require('./registry.json'),layout=require('../all-overhead/atlas-layout.json');
assert.equal(model.validate(registry,layout),true);
assert.equal(registry.controls.length,58);
assert.deepEqual(Object.fromEntries(['toggle-2','toggle-3-vertical','toggle-3-horizontal'].map(t=>[t,registry.controls.filter(c=>c.type===t).length])),{'toggle-2':39,'toggle-3-vertical':16,'toggle-3-horizontal':3});
assert.equal(registry.visualStatus,'AWAITING_NEW_OWNER_REFERENCE');assert.deepEqual(registry.assets,{});assert.deepEqual(registry.approvedVisuals,[]);assert.equal('specialAssets' in registry,false);
const js=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
for(const marker of ['toggle-frame','toggle-art','toggle-socket-cleanup','backgroundImage:','B737TogglePoseMap','B737ToggleSocketCleanup'])assert.ok(!js.includes(marker),'Visual reference remains: '+marker);
const events=[],engine=model.controller(registry,{},e=>events.push(e));
engine.cycle('yaw-damper');assert.equal(engine.get('yaw-damper'),'OFF');
engine.cycle('yaw-damper');assert.equal(engine.get('yaw-damper'),'ON');
engine.step('vhf-nav',-1);assert.equal(engine.get('vhf-nav'),'BOTH ON 1');
engine.step('vhf-nav',1);assert.equal(engine.get('vhf-nav'),'NORMAL');
engine.step('vhf-nav',1);assert.equal(engine.get('vhf-nav'),'BOTH ON 2');
for(const id of ['alternate-flaps-position','window-power-test','gen-1','outflow-manual']){
 const c=registry.controls.find(x=>x.id===id);
 for(const [a,b] of Object.entries(c.springReturn)){engine.set(id,a);assert.equal(engine.get(id),a);engine.release(id);assert.equal(engine.get(id),b);}
}
engine.set('apu-start','START');engine.releaseAll();assert.equal(engine.get('apu-start'),'ON');
for(const c of registry.controls){const x=model.mapPoint(c,layout.placements.find(p=>p.id===c.placementId));assert.ok(x.diameter>0&&Number.isFinite(x.x+x.y));}
assert.ok(events.length>0);
console.log('PASS 58 controls preserved; no custom visual family, artwork, bezels or patch backgrounds mounted.');
