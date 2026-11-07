'use strict';
/* ATA 77 physical instrument feed regression: MRG IV.6 pp.183-184,
 * Lufthansa LAN ATA31-42 p.220, ATA77-10 pp.231/235,
 * ATA77-20 p.239, ATA77-30 p.243, FCOM 7.10 / 7.20.
 * This is training functional wiring, not an EP-FSI WDM pin certification.
 */
const assert=require('node:assert/strict');
const Electrical=require('../engine/systems/electrical-v7.js');
const Instruments=require('../engine/instruments/engine-indication-backend-v1.js');
const DB=require('../engine/instruments/engine-indication-technical-db-v1.json');
const read=require('node:fs').readFileSync;
const path=require('node:path');

assert.equal(Instruments.validate(DB),true);
assert.equal(DB.revision,2);
assert.equal(DB.eisUnitPower.primary.originPanel,'P6-2');
assert.equal(DB.eisUnitPower.secondary.exactSupplyBus,null);
const expected={
 n1:{CONVENTIONAL:['battery','battery','28VDC'],EIS:['battery','battery','28VDC']},
 egt:{CONVENTIONAL:['dcStandby','dcStandby','28VDC'],EIS:['dcStandby','dcStandby','28VDC']},
 n2:{CONVENTIONAL:['dc1','dc2','28VDC'],EIS:['dcStandby','dcStandby','28VDC']},
 fuelFlow:{CONVENTIONAL:['dc1','dc2','28VDC'],EIS:['battery','battery','28VDC']},
 oilPressure:{CONVENTIONAL:['transfer1','transfer2','28VAC'],EIS:['transfer1','transfer2','28VAC']},
 oilTemperature:{CONVENTIONAL:['transfer1','transfer2','28VAC'],EIS:['transfer1','transfer2','28VAC']},
 oilQuantity:{CONVENTIONAL:['transfer1','transfer2','115VAC'],EIS:['transfer1','transfer2','115VAC']},
 vibration:{CONVENTIONAL:['transfer1','transfer1','28VAC'],EIS:['transfer1','transfer1','28VAC']}
};
for(const [signal,modes] of Object.entries(expected))
 for(const [mode,feeds] of Object.entries(modes))
  for(const side of [1,2]){
   const wire=DB.instruments[signal].wiring[mode][side];
   assert.equal(wire.bus,feeds[side-1],mode+' '+signal+' E'+side+' bus');
   assert.equal(wire.voltage,feeds[2],mode+' '+signal+' E'+side+' voltage');
   assert.ok(wire.sourceEvidence,mode+' '+signal+' source trace');
  }
assert.equal(DB.instruments.vibration.additionalSupplies.signalConditioner.voltage,'115VAC');
assert.equal(DB.instruments.vibration.additionalSupplies.indication.voltage,'28VAC');

const observed=Object.fromEntries([1,2].map(n=>['engine'+n,{}]));
const units={n1:'%',n2:'%',egt:'°C',fuelFlow:'kg/h',oilPressure:'psi',
 oilTemperature:'°C',oilQuantity:'%FULL',vibration:'units'};
for(const side of [1,2])
 for(const [signal,unit] of Object.entries(units))
  observed['engine'+side][signal]={value:signal==='vibration'?1:signal==='oilQuantity'?80:55,
   valid:true,unit,origin:'ATA77_TEST_SENSOR'};
const base=()=>Electrical.initialState({coldDark:false});
const calc=(s,mode='CONVENTIONAL',previous=null)=>Instruments.calculate(DB,{
 mode,previous,electrical:Electrical.evaluate(s),observed});
const c=calc(base()),e=calc(base(),'EIS');
for(const mode of [c,e])
 for(const side of [1,2])
  for(const signal of Object.keys(expected)){
   const x=mode.engines['engine'+side].indications[signal];
   assert.equal(x.status,'VALID',mode.mode+' '+signal+' engine'+side);
   assert.ok(x.sourceEvidence&&x.nominalVoltage,'wire trace must remain live');
  }

// BAT OFF on the ground while engine generators remain connected: N1 feed
// disappears, while DC STBY survives normal Transfer 1 via AUTO.
let batOff=Electrical.apply(base(),{type:'CONTROL',key:'batterySwitch',value:false});
const batE=calc(batOff,'EIS'),batC=calc(batOff);
assert.equal(Electrical.evaluate(batOff).bus.battery,false);
assert.equal(Electrical.evaluate(batOff).bus.dcStandby,true);
assert.equal(batE.engines.engine1.indications.n1.status,'POWER_LOSS');
assert.equal(batE.engines.engine2.indications.fuelFlow.status,'POWER_LOSS');
assert.equal(batE.engines.engine1.indications.n2.status,'VALID');
assert.equal(batC.engines.engine1.indications.fuelFlow.status,'VALID');
assert.equal(batC.engines.engine2.indications.n1.status,'POWER_LOSS');

// STBY OFF disables EGT and EIS N2 even with healthy main DC1/DC2.
const stbyOff=Electrical.apply(base(),{type:'CONTROL',key:'standbySelector',value:'OFF'});
const stbyE=calc(stbyOff,'EIS'),stbyC=calc(stbyOff);
assert.equal(stbyE.engines.engine1.indications.n2.status,'POWER_LOSS');
assert.equal(stbyE.engines.engine2.indications.egt.status,'POWER_LOSS');
assert.equal(stbyC.engines.engine1.indications.n2.status,'VALID');
assert.equal(stbyC.engines.engine2.indications.egt.status,'POWER_LOSS');

// One generator unselected; BUS TRANSFER AUTO backs up Transfer Bus 1 from
// the opposite engine. Do not tie instrument feed to GEN 1 OFF BUS lamp.
const backup=Electrical.apply(base(),{type:'SELECT_SOURCE',side:1,source:'OFF'});
const buses=Electrical.evaluate(backup);
assert.equal(buses.bus.transfer1,true);
assert.equal(buses.lamps.genOffBus1,true);
assert.equal(calc(backup).engines.engine1.indications.oilQuantity.status,'VALID');
const isolated=Electrical.apply(backup,{type:'CONTROL',key:'busTransferAuto',value:false});
const iso=calc(isolated,'CONVENTIONAL',c);
assert.equal(Electrical.evaluate(isolated).bus.transfer1,false);
assert.equal(iso.engines.engine1.indications.oilPressure.status,'POWER_LOSS');
assert.equal(iso.engines.engine1.indications.oilPressure.pointer,'HOLD_LAST');
assert.equal(iso.engines.engine2.indications.oilPressure.status,'VALID');
assert.equal(iso.engines.engine1.indications.vibration.status,'POWER_LOSS');
assert.equal(iso.engines.engine2.indications.vibration.status,'POWER_LOSS');
assert.equal(calc(isolated,'EIS').engines.engine1.indications.oilPressure.status,'POWER_EFFECT_UNVERIFIED');

// A single CB removes only its mapped channel (shared AVM CB affects both).
const cbOpen=new Set(['engine1.n2Indicator']);
globalThis.B737UnifiedCB={available:circuit=>cbOpen.has(circuit)?false:true};
try{
 const q=calc(base());
 assert.equal(q.engines.engine1.indications.n2.status,'POWER_LOSS');
 assert.equal(q.engines.engine1.indications.n2.reason,'PROTECTED_CIRCUIT_CB_OPEN');
 assert.equal(q.engines.engine1.indications.n2.circuitBreaker.state,'OPEN');
 assert.equal(q.engines.engine2.indications.n2.status,'VALID');
 cbOpen.add('engine.vibrationIndicator');
 const v=calc(base());
 assert.equal(v.engines.engine1.indications.vibration.status,'POWER_LOSS');
 assert.equal(v.engines.engine2.indications.vibration.status,'POWER_LOSS');
} finally { delete globalThis.B737UnifiedCB; }

const ui=read(path.join(__dirname,'../panel-mosaic-lab/cockpit/engine-indication-live-v2.js'),'utf8');
const eis=read(path.join(__dirname,'../panel-mosaic-lab/cockpit/eis-dot-readouts-v1.js'),'utf8');
const pointers=read(path.join(__dirname,'../panel-mosaic-lab/cockpit/isn-engine-gauges.js'),'utf8');
assert.match(ui,/b737:cb-state-change/);
assert.match(ui,/b737:electrical-v7-state/);
assert.match(ui,/data-feed-id/);
assert.match(ui,/ownsPresentation:\(\)=>!!db/);
assert.match(eis,/ownsPresentation\?\.\(\)/);
assert.match(pointers,/ownsPresentation\?\.\(\)/);
console.log('PASS ATA77 32 engine indication feed records / backfeed / STBY / BAT / shared AVM / CB / renderer authority');
