'use strict';
const assert=require('node:assert/strict');
const Pneumatics=require('./pneumatics-v6.js');
const Duct=require('./duct-pressure-live-v1.js');
const inactive=()=>({phase:'OFF',n1Percent:0});
const ecu=(phase='READY')=>({engines:{engine1:inactive(),engine2:inactive()},apu:{phase,rpmPct:95.5}});
function state(apuRunning=true,bleedControl='ON',isolation='AUTO'){
 let s=Pneumatics.initial();
 for(const [key,value] of Object.entries({
  engine1Running:false,engine2Running:false,apuRunning
 }))s=Pneumatics.apply(s,{type:'SENSOR',key,value});
 for(const [key,value] of Object.entries({
  apuBleed:bleedControl,isolation,engineBleed1:'ON',engineBleed2:'ON',packL:'AUTO',packR:'AUTO'
 }))s=Pneumatics.apply(s,{type:'CONTROL',key,value});
 return s;
}
function pressure(s,phase='READY'){
 const n=Pneumatics.derive(s);
 return {n,out:Duct.project({ecu:ecu(phase),bleed:n.bleed,controls:s.controls,
  pack:n.pack,sensors:{L:s.inputs.ductLeftPsi,R:s.inputs.ductRightPsi},
  gaugePowered:s.inputs.ductGaugeAcPower})};
}
let healthy=pressure(state());
assert.equal(healthy.n.bleed.apuBleedValveOpen,true,'Source and valve physically established');
assert.equal(healthy.out.apuSource,35);
assert.ok(healthy.out.L>25&&healthy.out.L<36,'APU must show on left needle');
assert.equal(healthy.out.R,0,'AUTO with both engine bleeds and packs selected closes isolation');
assert.equal(healthy.out.apuValveOpen,true);

// Same independently observed running pneumatic source, even if ECU display
// phase has not synchronized yet. Phase cannot be a second air-source gate.
const stalePhase=pressure(state(),'STARTING');
assert.equal(stalePhase.out.apuSource,35);
assert.equal(stalePhase.out.L,healthy.out.L);
const disconnected=pressure(state(true,'OFF'));
assert.equal(disconnected.out.apuSource,0);
assert.equal(disconnected.out.L,0);
const stopped=pressure(state(false,'ON'));
assert.equal(stopped.n.bleed.apuBleedValveOpen,false);
assert.equal(stopped.out.L,0);
const crossover=pressure(state(true,'ON','OPEN'));
assert.ok(crossover.out.L>20&&crossover.out.R>20);
assert.equal(crossover.out.L,crossover.out.R);
const sensorState=Pneumatics.apply(state(),{type:'SENSOR',key:'ductLeftPsi',value:19.25});
assert.equal(pressure(sensorState).out.L,19.25);
const poweredOff=Pneumatics.apply(state(),{type:'SENSOR',key:'ductGaugeAcPower',value:false});
assert.equal(pressure(poweredOff).out.L,null);
// APU running with BLEED actually closed must not create pressure when no
// engine bleeds are available.
assert.equal(pressure(state(true,'OFF','OPEN')).out.R,0);

console.log('PASS: observed APU BLEED ON gives ~33 PSI L; crossover feeds R; stale phase does not suppress; BLEED OFF, APU OFF, sensor and power gates.');
