'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const m=require('./rotary-guards-model.js'),toggles=require('./model.js'),mechanics=require('../../flight-controls-panel/fcom-control-mechanics.js');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,p),'utf8')),reg=read('rotary-guards.json'),layout=read('../all-overhead/atlas-layout.json');
assert.equal(m.validate(reg,layout,toggles.mapPoint),true);assert.equal(reg.rotaries.length,18);assert.equal(reg.guards.length,10);
const events=[],e=m.controller(reg,{},v=>events.push(v),mechanics);
e.stepRotary('dc-meter',1);assert.equal(e.rotary('dc-meter'),'TR1');assert.equal(e.angle('dc-meter'),45);
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
console.log('PASS: 18 fixed-pivot rotaries, ranges/wrap/detents; 10 guards, closed gating and per-control close policies; Alternate Flaps interlock; safe restore; 9 approved asset hashes.');
