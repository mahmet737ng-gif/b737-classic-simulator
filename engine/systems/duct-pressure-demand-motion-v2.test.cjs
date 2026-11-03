'use strict';
const assert=require('node:assert/strict');
const d=require('./duct-pressure-live-v1.js');
const engine=(phase='OFF',n1Percent=0)=>({phase,n1Percent});
const ecu=(a=engine(),b=engine(),apu='OFF')=>({engines:{engine1:a,engine2:b},apu:{phase:apu}});
const bleed=(changes={})=>({engine1ValveOpen:false,engine2ValveOpen:false,
 apuBleedValveOpen:false,externalAirAttached:false,isolationOpen:false,...changes});
const both=ecu(engine('RUNNING',35),engine('RUNNING',35));
const bothBleeds=bleed({engine1ValveOpen:true,engine2ValveOpen:true});
const base=changes=>d.project({ecu:both,bleed:bothBleeds,controls:{'pack-l':'OFF','pack-r':'OFF'},...changes});
const empty=base();
const auto=base({controls:{'pack-l':'AUTO','pack-r':'AUTO'}});
const high=base({controls:{'pack-l':'HIGH','pack-r':'HIGH'}});
assert.ok(empty.L>auto.L&&auto.L>high.L,'PACK OFF -> AUTO -> HIGH increases air demand');
assert.ok(empty.R>auto.R&&auto.R>high.R);
const tripped=base({controls:{'pack-l':'HIGH'},pack:{L:{tripOff:true,operational:false}}});
assert.equal(tripped.L,empty.L,'PACK trip must stop its bleed consumption');
const autoHigh=base({controls:{'pack-l':'AUTO'},pack:{L:{flow:'HIGH',operational:true}}});
assert.equal(autoHigh.L,base({controls:{'pack-l':'HIGH'}}).L);
const ta1=base({antiIce:{engine1:'ON',engine2:'OFF',wing:'OFF'}});
assert.ok(ta1.L<empty.L&&ta1.R===empty.R,'Cowl 1 only affects left-source demand');
const ta2=base({antiIce:{engine1:'OFF',engine2:'ON',wing:'OFF'}});
assert.ok(ta2.R<empty.R&&ta2.L===empty.L);
const wing=base({antiIce:{wing:'ON'}});
assert.ok(wing.L<empty.L&&wing.R<empty.R,'WING TAI draws both sides');
const startLeft=base({starterValves:{L:true,R:false}});
const startRight=base({starterValves:{L:false,R:true}});
assert.ok(startLeft.L<empty.L-10&&startLeft.R===empty.R);
assert.ok(startRight.R<empty.R-10&&startRight.L===empty.L);
assert.equal(base({starterValves:{L:false,R:false}}).L,empty.L,'START selector alone never drains air');
const iso=base({bleed:{...bothBleeds,isolationOpen:true},controls:{'pack-l':'AUTO','pack-r':'AUTO'}});
assert.ok(iso.L>auto.L,'Dual live engine sources share pack demand over an open isolation valve');
assert.equal(iso.L,iso.R,'Manifold crossover equalizes the two indicators');
const leftOnlyIso=d.project({ecu:ecu(engine('RUNNING',32)),bleed:bleed({engine1ValveOpen:true,isolationOpen:true}),
 controls:{'pack-l':'AUTO','pack-r':'AUTO'}});
const leftOnlyIndependent=d.project({ecu:ecu(engine('RUNNING',32)),bleed:bleed({engine1ValveOpen:true,isolationOpen:false}),
 controls:{'pack-l':'AUTO','pack-r':'AUTO'}});
assert.ok(leftOnlyIso.L<leftOnlyIndependent.L,'One engine feeding two packs suffers extra demand');
assert.equal(leftOnlyIso.L,leftOnlyIso.R);
assert.equal(leftOnlyIndependent.R,0,'Closed isolation does not invent right air');
const noEngineTai=d.project({ecu:ecu(),bleed:bleed(),antiIce:{engine1:'ON',wing:'ON'}});
assert.equal(noEngineTai.L,0,'No engine/compressor must mean no pressure');
const sensor=base({sensors:{L:17.4,R:32.8},antiIce:{wing:'ON'},starterValves:{R:true}});
assert.equal(sensor.L,17.4);assert.equal(sensor.R,32.8);
assert.equal(sensor.quality,'EXPLICIT_SENSOR_HAS_PRIORITY');
const off=base({gaugePowered:false});
assert.equal(off.L,null);assert.equal(off.R,null);

const hz=60,dt=1000/hz,target={L:42,R:30};
let state=d.initialDynamics(),prevL=0,prevR=0;
let maxPerFrame=0;
for(let i=0;i<800;i++){
 state=d.advanceDynamics(state,target,dt);
 const values={L:state.L.value,R:state.R.value};
 for(const side of ['L','R']){
  assert.ok(values[side]>=-1e-6&&values[side]<=target[side]+1e-6,'No overshoot');
  maxPerFrame=Math.max(maxPerFrame,Math.abs(values[side]-(side==='L'?prevL:prevR)));
 }
 prevL=values.L;prevR=values.R;
}
assert.ok(d.settled(state,target),'Both needles settle within reasonable time');
assert.ok(maxPerFrame<=d.SETTINGS.maxFallPsiPerSec/hz+0.01,'No sudden per-frame movement');
assert.ok(Math.abs(state.L.value-42)<0.03&&Math.abs(state.R.value-30)<0.03);
const descending={L:0,R:0};let last=state.L.value;
for(let i=0;i<800;i++){
 state=d.advanceDynamics(state,descending,dt);
 assert.ok(state.L.value<=last+0.01,'Smooth depressurization without bounce');
 last=state.L.value;
}
assert.ok(d.settled(state,descending),'Both needles settle back at zero');
const afterSpike=d.advanceDynamics(d.initialDynamics(),{L:100,R:0},16);
assert.ok(afterSpike.L.value<0.3,'No 0-to-100 single-frame jump');
assert.throws(()=>d.advanceDynamics(state,descending,-1));
console.log('PASS: logical independent PACK AUTO/HIGH, trip, EAI 1/2, WAI, starter valve, isolation, sensor and bounded 60fps needle motion.');
