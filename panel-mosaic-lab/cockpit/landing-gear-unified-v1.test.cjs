'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {core}=require('./landing-gear-unified-v1.js');

// The wheel stays within the actual black photo slot in all three detents.
assert.equal(core.VISUAL.height,248);
assert.equal(core.VISUAL.photoX,313);
assert.deepEqual(core.VISUAL.top,{UP:6,OFF:65,DN:125});
for(const p of ['UP','OFF','DN'])assert.equal(core.VISUAL.top[p]+core.VISUAL.artWheelY[p],core.VISUAL.wheelY[p]);
assert.ok(core.VISUAL.wheelY.UP>=0&&core.VISUAL.wheelY.DN<core.VISUAL.height);
for(const detent of ['UP','OFF','DN']){
  assert.ok(core.VISUAL.top[detent]>=0);
  assert.ok(core.VISUAL.top[detent]+core.VISUAL.artHeight<=core.VISUAL.height,
    `${detent} raster cannot escape landing gear slot`);
}
assert.equal(core.detentAtY(40),'UP');
assert.equal(core.detentAtY(125),'OFF');
assert.equal(core.detentAtY(210),'DN');
assert.equal(core.detentAtY(248),'DN');

const initial=core.initial();
assert.equal(initial.lever,'DN');
assert.deepEqual(initial.gear,{nose:'DOWN',left:'DOWN',right:'DOWN'});
for(const id of core.POS){
  assert.equal(core.lamps(initial).main[id].green,true);
  assert.equal(core.lamps(initial).main[id].red,false);
  assert.equal(core.lamps(initial).auxiliary[id],true);
}
assert.equal(core.select(initial,'UP',{onGround:true}).lastReject,'GROUND_SAFETY_INTERLOCK');
assert.equal(core.select(initial,'UP',{onGround:null}).lastReject,'GROUND_SAFETY_INTERLOCK');
assert.equal(core.select(initial,'UP',{onGround:true,lockOverride:true}).lever,'UP');
assert.equal(core.select(initial,'OFF',{onGround:true}).lever,'OFF');

const up=core.select(initial,'UP',{onGround:false});
assert.equal(core.step(up,2,0).gear.nose,'DOWN','no pressure must not move gear');
assert.equal(core.step(up,2,null).gear.left,'DOWN','missing hydraulic source must not move gear');
const transit=core.step(up,2,3000);
for(const id of core.POS){
  assert.equal(transit.gear[id],'TRANSIT');
  assert.equal(core.lamps(transit).main[id].green,false);
  assert.equal(core.lamps(transit).main[id].red,true);
  assert.equal(core.lamps(transit).auxiliary[id],false);
}
const hydLost=core.step(transit,2,1000);
assert.deepEqual(hydLost.gear,transit.gear,'pressure loss must freeze all three actuators');
const off=core.select(transit,'OFF',{onGround:false});
assert.deepEqual(core.step(off,99,3000).gear,transit.gear,'OFF must freeze transit');

const upDone=core.step(transit,8,3000);
for(const id of core.POS){
  assert.equal(upDone.gear[id],'UP');
  assert.equal(core.lamps(upDone).main[id].red,false);
  assert.equal(core.lamps(upDone).main[id].green,false);
}
const down=core.select(upDone,'DN',{onGround:false});
assert.deepEqual(core.step(down,1,3000).gear,{nose:'TRANSIT',left:'TRANSIT',right:'TRANSIT'});
const downDone=core.step(down,8,3000);
assert.deepEqual(downDone.gear,initial.gear);
assert.equal(downDone.lever,'DN');

const reversed=core.select(off,'DN',{onGround:false});
assert.equal(reversed.elapsed.nose,0,'direction reversal must reset timing');
assert.equal(reversed.elapsed.left,0);
assert.equal(reversed.progress.left,off.progress.left,'reversing must preserve actuator progress');
const reversing=core.step(reversed,2,3000);
assert.ok(reversing.progress.left>reversed.progress.left&&reversing.progress.left<1);
assert.deepEqual(core.step(core.select(transit,'OFF',{onGround:false}),20,3000).progress,transit.progress);
assert.equal(core.lamps(core.select(initial,'OFF',{onGround:false})).main.nose.red,true);
assert.equal(core.lamps(upDone,{onGround:false,radioAltitudeFt:500,thrustIdle:true}).main.nose.red,true);

const sprite=path.join(__dirname,'assets','landing-gear-classic-3state.webp');
const bytes=fs.readFileSync(sprite);
assert.ok(bytes.byteLength>1000&&bytes.byteLength<12500,'sprite must fit 100-kilobit ceiling');
assert.equal(bytes.toString('ascii',0,4),'RIFF');
assert.equal(bytes.toString('ascii',8,12),'WEBP');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
assert.match(html,/landing-gear-unified-v1\.js\?v=ATA32-GEAR-0004/);
console.log('ATA32 gear selector, hydraulics, red/green/aux lamps and assets PASS');
