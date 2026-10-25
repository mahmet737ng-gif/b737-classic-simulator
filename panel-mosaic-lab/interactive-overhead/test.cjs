'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const model=require('./model.js'),registry=require('./registry.json'),layout=require('../all-overhead/atlas-layout.json');
assert.equal(model.validate(registry,layout),true);
assert.equal(registry.controls.length,58);
assert.deepEqual(Object.fromEntries(['toggle-2','toggle-3-vertical','toggle-3-horizontal'].map(t=>[t,registry.controls.filter(c=>c.type===t).length])),{'toggle-2':39,'toggle-3-vertical':16,'toggle-3-horizontal':3});
assert.equal(registry.version,'TGL-NEWREF-0001');assert.equal(registry.visualStatus,'USER_REFERENCE_INSTALLED');
const positions={'vertical-off':4,'vertical-center':1,'vertical-on':3,'horizontal-left':0,'horizontal-center':1,'horizontal-right':2};
assert.deepEqual(Object.fromEntries(Object.entries(registry.assets).map(([k,a])=>[k,a.frame])),positions);
const asset=path.resolve(__dirname,registry.assets['vertical-on'].url);
const bytes=fs.readFileSync(asset);
assert.equal(bytes.subarray(0,4).toString('ascii'),'RIFF');assert.equal(bytes.subarray(8,12).toString('ascii'),'WEBP');
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'3ad98aa39742d38caed990229efd7c5aa39d59ed9b1e5a2f967b5fcfec74ca55');
assert.equal(bytes.length,332822);
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
for(const marker of ['B737ToggleSocketCleanup','toggle-socket-cleanup','toggle-pose-v1','background-repair'])assert.ok(!app.includes(marker),'Previous artwork or repair must not return: '+marker);
assert.ok(app.includes("const poseFrames=c=>c.axis==='horizontal'?[0,1,2]:(c.states.length===2?[3,4]:[3,1,4])"));
assert.ok(app.includes("button.append(sprite)"));
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
for(const c of registry.controls){const p=model.mapPoint(c,layout.placements.find(x=>x.id===c.placementId));assert.ok(p.diameter>0&&Number.isFinite(p.x+p.y));}
assert.ok(events.length>0);
const page=fs.readFileSync(path.join(__dirname,'../cockpit/overhead-stage.html'),'utf8');
assert.ok(page.includes('app.js?v=TGL-NEWREF-0001'));
assert.ok(!page.includes('socket-cleanup-v3.js'));
console.log('PASS 58 overhead controls, five user reference sprites, centered bezel pivot and no repair masks.');
