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

// Normal full-stroke cycle timing: nose first, left then right main, at 0.1s resolution.
const expected=core.NOMINAL_CYCLE_SEC;
assert.deepEqual(expected,{nose:4.5,left:5.1,right:5.8});
assert.equal(Number((expected.right-expected.left).toFixed(1)),0.7);
function cycleTimeline(initialState,command,goal){
  let s=core.select(initialState,command,{onGround:false}),clock=0;
  const locked={};
  for(let i=0;i<70;i++){
    s=core.step(s,0.1,3000);
    clock=Math.round((clock+0.1)*100)/100;
    for(const id of core.POS)if(s.gear[id]===goal&&locked[id]===undefined)locked[id]=clock;
  }
  return {s,locked};
}
const timedUp=cycleTimeline(core.initial(),'UP','UP');
assert.deepEqual(timedUp.locked,expected,'normal retraction locks nose/left/right at calibrated times');
const timedDown=cycleTimeline(timedUp.s,'DN','DOWN');
assert.deepEqual(timedDown.locked,expected,'normal extension matches retraction timings');
for(const id of core.POS){
  assert.equal(timedDown.s.gear[id],'DOWN');
  assert.equal(core.lamps(timedDown.s).main[id].green,true);
  assert.equal(core.lamps(timedUp.s).main[id].green,false);
}
assert.equal(core.step(core.select(core.initial(),'UP',{onGround:false}),1,0).gear.nose,'DOWN',
  'normal cycle must not advance without hydraulic pressure');
const halfway=core.step(core.select(core.initial(),'UP',{onGround:false}),2.2,3000);
const hold=core.select(halfway,'OFF',{onGround:false});
assert.deepEqual(core.step(hold,20,3000).progress,halfway.progress,'OFF freezes mid-cycle travel');
const recovered=core.step(core.select(hold,'UP',{onGround:false}),2.3,3000);
assert.equal(recovered.gear.nose,'UP','resuming restores remaining nose stroke, not a new full timer');
const interrupted=core.step(halfway,10,0);
assert.deepEqual(interrupted.progress,halfway.progress,'hydraulic fault pauses all actuators');

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
const reversing=core.step(reversed,1,3000);
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
assert.match(html,/landing-gear-unified-v1\.js\?v=ATA32-GEAR-0005/);
console.log('ATA32 gear selector, hydraulics, red/green/aux lamps and assets PASS');
