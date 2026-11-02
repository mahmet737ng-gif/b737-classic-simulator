'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const model=require('./model.js'),registry=require('./registry.json'),layout=require('../all-overhead/atlas-layout.json');
assert.equal(model.validate(registry,layout),true);
assert.equal(registry.controls.length,59);
assert.deepEqual(Object.fromEntries(['toggle-2','toggle-3-vertical','toggle-3-horizontal'].map(t=>[t,registry.controls.filter(c=>c.type===t).length])),{'toggle-2':39,'toggle-3-vertical':17,'toggle-3-horizontal':3});
assert.equal(registry.version,'TGL-NEWREF-0002');assert.equal(registry.visualStatus,'USER_REFERENCE_INSTALLED');
const positions={'vertical-off':0,'vertical-center':1,'vertical-on':3,'horizontal-left':0,'horizontal-center':1,'horizontal-right':2};
assert.deepEqual(Object.fromEntries(Object.entries(registry.assets).map(([k,a])=>[k,a.frame])),positions);
const asset=path.resolve(__dirname,registry.assets['vertical-on'].url);
const bytes=fs.readFileSync(asset);
assert.equal(bytes.subarray(0,4).toString('ascii'),'RIFF');assert.equal(bytes.subarray(8,12).toString('ascii'),'WEBP');
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'3ad98aa39742d38caed990229efd7c5aa39d59ed9b1e5a2f967b5fcfec74ca55');
assert.equal(bytes.length,332822);
const downBytes=fs.readFileSync(path.resolve(__dirname,registry.assets['vertical-off'].url));
assert.equal(downBytes.subarray(0,4).toString('ascii'),'RIFF');
assert.equal(downBytes.subarray(8,12).toString('ascii'),'WEBP');
assert.equal(crypto.createHash('sha256').update(downBytes).digest('hex'),'3b71eb9632dd17a986e65f60d53fa468fbb34f1ebe02a635915aedde53fcc0b6');
assert.equal(downBytes.length,232570);
assert.deepEqual(registry.downPoseCalibration.targetNutCenter,[512,512]);
assert.deepEqual(registry.downPoseCalibration.targetDiameterPx,390);

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
assert.ok(page.includes('app.js?v=OH14-FIXED-RED-BOX-0016'));
assert.ok(!page.includes('socket-cleanup-v3.js'));
console.log('PASS 59 overhead controls with one explicitly owner-requested OH14 Small Silver actuator; other frozen toggles preserved.');

assert.ok(app.includes("const down=frame===4;"),'DOWN must use standalone aligned reference, not miscentered old atlas frame');
assert.ok(app.includes("sprite.style.backgroundSize=down?'100% 100%':'500% 100%'"),'other 4 poses remain unchanged');
console.log('PASS TGL-NEWREF-0002: DOWN aligned, 4 other poses preserved.');

const smallToggleIds=["alternate-flaps-position","yaw-damper","drive-temp-rise","galley","wing-anti-ice","window-l-side","window-l-fwd","window-r-fwd","window-r-side","window-power-test","pitot-a","pitot-b","recirc-fan","runway-turnoff-l","runway-turnoff-r","taxi","logo","strobe","anti-collision","wing-lights","wheel-well"];
assert.equal(registry.visualProfileVersion,'OVERHEAD-SMALL-001');
assert.equal(registry.visualFamilies.Small.name,'Small White');
assert.deepEqual(registry.visualFamilies.Small.frameOrder,['LEFT','CENTER','RIGHT','UP','DOWN']);
assert.equal(registry.controls.filter(c=>c.visualFamily==='Small').length,21);
for(const c of registry.controls)assert.equal(c.visualFamily||'Standard',c.id==='emergency-exit-lights'?'Small Silver':smallToggleIds.includes(c.id)?'Small':'Standard',c.id+' family');
const smallAtlas=fs.readFileSync(path.resolve(__dirname,registry.visualFamilies.Small.asset));
assert.equal(smallAtlas.subarray(0,4).toString('ascii'),'RIFF');
assert.equal(crypto.createHash('sha256').update(smallAtlas).digest('hex'),registry.visualFamilies.Small.sha256);
assert.ok(app.includes("if(c.visualFamily==='Small'||c.visualFamily==='Small Silver')"));
assert.ok(app.includes("sprite.style.backgroundSize='500% 100%'"));
console.log('PASS Small White: 21 selected toggles, remaining 37 Standard, unaltered calibrated pivots.');


const emergency=registry.controls.filter(c=>c.id==='emergency-exit-lights');
assert.equal(emergency.length,1,'OH14 must have exactly one registered interactive switch');
assert.equal(emergency[0].placementId,'OH14');
assert.deepEqual(emergency[0].states,['OFF','ARMED','ON']);
assert.equal(emergency[0].default,'ARMED');
assert.equal(emergency[0].visualFamily,'Small Silver');
assert.deepEqual(emergency[0].interactionSourceRect,[445,150,330,760]);
assert.ok(app.includes("const photoOnly=c.id==='emergency-exit-lights';"),'OH14 must have one transparent hit target');
assert.ok(app.includes('button.append(sprite);'),'All 59 toggle controls, including OH14, render their selected family sprite');
assert.ok(app.includes("../assets/locked/2026-10-23/Switches/Guarded/"),'OH14 uses owner-selected Guarded directory');
assert.ok(app.includes("holder.className='oh14-top-hinge-guard'"),'OH14 has one independent top-hinge cover');
assert.ok(app.includes("setCover(holder.dataset.cover!=='open')"),'OH14 black cover toggles without changing OFF/ARMED/ON detents');
assert.ok(!app.includes('oh14-original-toggle-occlusion'),'Never paint over the photographed OH14 shaft');
const silverAtlas=fs.readFileSync(path.resolve(__dirname,registry.visualFamilies['Small Silver'].asset));
assert.equal(crypto.createHash('sha256').update(silverAtlas).digest('hex'),registry.visualFamilies['Small Silver'].sha256);
assert.equal(silverAtlas.subarray(0,4).toString('ascii'),'RIFF');
engine.set('emergency-exit-lights','OFF');assert.equal(engine.get('emergency-exit-lights'),'OFF');
engine.cycle('emergency-exit-lights');assert.equal(engine.get('emergency-exit-lights'),'ARMED');
engine.cycle('emergency-exit-lights');assert.equal(engine.get('emergency-exit-lights'),'ON');
engine.cycle('emergency-exit-lights');assert.equal(engine.get('emergency-exit-lights'),'OFF');
console.log('PASS OH14 owner-selected Small Silver three-state toggle with independent top-hinged black guard.');
