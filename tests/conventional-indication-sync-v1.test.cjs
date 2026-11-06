'use strict';
/* End-to-end value contract, actual backend, 16 photo profiles, failure/CB
 * recovery and deterministically synchronized needle/dot numerical outputs.
 */
const assert=require('node:assert/strict');
const sync=require('../engine/instruments/conventional-indication-sync-v1.js');
const photo=require('../engine/instruments/photo-detent-calibration-v1.js');
const engine=require('../engine/instruments/engine-indication-backend-v1.js');
const db=require('../engine/instruments/engine-indication-technical-db-v1.json');
const font=require('../engine/instruments/eis-dot-digits-v1.js');
const signalKeys=Object.keys(sync.SIGNALS);
const points=new Map(),numbers=new Map(),writes=[];
const angle=(signal,side,value)=>photo.angle(signal,side,value);
angle.profile=(signal,side)=>photo.getProfile(signal,side);
angle.inverse=(signal,side,theta)=>photo.valueAt(signal,side,theta);
const ui=sync.create({angleFor:angle,
 needle:{setReading:(engine,signal,value,source)=>{
  const id=signal+'_'+engine.at(-1);
  points.set(id,{value,source,theta:value===null?photo.angle(signal,engine,photo.getProfile(signal,engine).values[0]):
   photo.angle(signal,engine,value)});
  writes.push(['pointer',id,value,source]);
 }},
 digits:{setReading:(engine,signal,value,source)=>{
  const id=signal+'_'+engine.at(-1);
  numbers.set(id,{value,source});writes.push(['digit',id,value,source]);
 }}});
const buses={bus:{battery:true,dcStandby:true,dc1:true,dc2:true,transfer1:true,transfer2:true}};
const ecu={quality:'TRAINING_SIMULATION_ONLY',timeMs:1000,engines:{
 engine1:{n1Percent:91.3,n2Percent:95.8,egtC:687,fuelFlowKgHr:2200,
  oil:{pressurePsi:76,temperatureC:92,quantityPct:83}},
 engine2:{n1Percent:22.0,n2Percent:60.0,egtC:445,fuelFlowKgHr:720,
  oil:{pressurePsi:53,temperatureC:71,quantityPct:78}}
}};
assert.equal(engine.validate(db),true);
const observed=engine.fromEcu(ecu);
function result(power=buses,override=observed,options={}){
 return engine.calculate(db,{mode:'CONVENTIONAL',electrical:power,
  observed:override,dtMs:200,previous:options.previous||null,fuelMode:options.fuelMode||'RATE'});
}
let frame=result();
assert.equal(frame.engines.engine1.indications.n1.status,'VALID');
assert.equal(frame.engines.engine1.indications.n1.value,91.3);
assert.equal(frame.engines.engine2.indications.n1.value,22);
ui.intake(frame);
let state=ui.snapshot();
assert.equal(Object.keys(state.channels).length,16,'All 8 photographed gauges × 2 engines');
for(const side of ['engine1','engine2'])for(const signal of signalKeys){
 const name=sync.SIGNALS[signal].needle+'_'+side.at(-1);
 const p=points.get(name),ch=state.channels[name];
 assert.ok(p&&ch,signal+' needle missing');
 assert.equal(p.source,'ENGINE_INDICATION_SYNC_V1');
 assert.equal(p.value,ch.value,signal+' indicated value differs from synced physical pointer');
 if(ch.value!==null){
  assert.ok(Math.abs(photo.valueAt(p?signal==='oilTemperature'?'oilTemp':signal==='oilQuantity'?'oilQty':
   signal==='vibration'?'vib':signal:signal,side,p.theta)-p.value)<1e-6,
   name+' photo degree / numeric value mismatch');
 }
 if(sync.DIGIT_SIGNALS.includes(signal)){
  assert.equal(numbers.get(signal+'_'+side.at(-1))?.value,ch.value,signal+' digit / pointer not atomic');
  assert.equal(numbers.get(signal+'_'+side.at(-1))?.source,'ENGINE_INDICATION_SYNC_V1');
 }
}
assert.equal(numbers.get('n1_1').value,91.3);
assert.equal(points.get('n1_1').value,91.3);
assert.equal(numbers.get('n1_2').value,22.0);
assert.equal(points.get('n1_2').value,22.0);
let audit=ui.audit({angle,random:256});
assert.ok(audit.pass,'All photo zero/major/minor/random detent positions must invert');
assert.ok(audit.checks>4000,'Every gauge receives 256 deterministic random samples');
let quantCount=0,seed=20261107;
for(const signal of signalKeys)for(const side of ['engine1','engine2']){
 const p=photo.getProfile(sync.SIGNALS[signal].needle,side);
 for(const line of photo.detents(sync.SIGNALS[signal].needle,side,8)){
  const a=photo.angle(sync.SIGNALS[signal].needle,side,line.value);
  assert.ok(Math.abs(a-line.angle)<1e-9,'Tick mapping drift '+signal);
 }
 for(let k=0;k<192;k++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const v=p.values[0]+seed/4294967296*(p.values.at(-1)-p.values[0]);
  const a=photo.angle(sync.SIGNALS[signal].needle,side,v);
  const inverse=photo.valueAt(sync.SIGNALS[signal].needle,side,a);
  assert.ok(Math.abs(inverse-v)<1e-6,'Random major/minor scale mismatch');
  if(['n1','egt','n2','fuelFlow'].includes(signal)){
   const spec=signal==='egt'?{integerDigits:4,decimals:0}:
    signal==='fuelFlow'?{integerDigits:2,decimals:2,divisor:1000}:
    {integerDigits:3,decimals:1};
   const digit=font.format(v,spec);
   assert.ok(Number.isFinite(Number(digit)),'Rolling digits overflow native photo scale');
   const error=Math.abs(Number(digit)*(spec.divisor||1)-v);
   const epsilon=signal==='egt'?.501:signal==='fuelFlow'?5.001:.051;
   assert.ok(error<=epsilon,'Raw ECU vs digit disagreement '+signal);
  }
  quantCount++;
 }
}
// Move a running engine 91 -> 15 with a time-based shared displayed value.
const lower=engine.fromEcu({...ecu,engines:{...ecu.engines,engine1:{
 ...ecu.engines.engine1,n1Percent:15.0,egtC:390}}});
ui.intake(result(buses,lower,{previous:frame}));
const atStart=ui.snapshot().channels.n1_1.value;
assert.equal(atStart,91.3,'No instantaneous needle jump before motion begins');
let previous=atStart,steps=0;
for(let i=0;i<60;i++){
 const moving=ui.advance(1/30),v=ui.snapshot().channels.n1_1.value;
 assert.ok(v<=previous+1e-7,'Pointer must move monotonically toward lower N1');
 assert.equal(points.get('n1_1').value,v);
 assert.equal(numbers.get('n1_1').value,v,'Same display-frame value for numeric and needle');
 previous=v;steps++;
 if(!moving)break;
}
assert.ok(Math.abs(points.get('n1_1').value-15)<1e-5,'Rate-limited engine motion must settle');
assert.ok(steps>1,'No instant jumps at ordinary power changes');
// A shorted/open N1 indication CB must NOT leave a live ECU numeric value
// on screen while pointer is parked at zero.
const before=globalThis.B737UnifiedCB;
globalThis.B737UnifiedCB={available:key=>key!=='engine1.n1Indicator'};
const cbLost=result(buses);
assert.equal(cbLost.engines.engine1.indications.n1.status,'POWER_LOSS');
assert.equal(cbLost.engines.engine2.indications.n1.status,'VALID');
ui.intake(cbLost);
assert.equal(points.get('n1_1').value,null,'CB-open pointer should be marked invalid');
assert.equal(numbers.get('n1_1').value,null,'CB-open digit should not still show 91.3');
assert.equal(ui.snapshot().channels.n1_1.state,'BLANK');
assert.equal(ui.snapshot().channels.n1_1.reason,'PROTECTED_CIRCUIT_CB_OPEN');
assert.equal(numbers.get('n1_2').value,22,'CB on engine 1 must not disable engine 2');
if(before===undefined)delete globalThis.B737UnifiedCB;else globalThis.B737UnifiedCB=before;
// Distinct sensor fault/other bus-failure path.
const bad=engine.fromEcu(ecu);bad.engine1.egt={valid:false,reason:'TEST_SENSOR_FAIL'};
const fault=result(buses,bad);
assert.equal(fault.engines.engine1.indications.egt.status,'SENSOR_FAILED');
ui.intake(fault);
assert.equal(points.get('egt_1').value,null);
assert.equal(numbers.get('egt_1').value,null);
const lost=result({bus:{...buses.bus,battery:false}});
ui.intake(lost);
assert.equal(points.get('n1_1').value,null);
assert.equal(numbers.get('n1_1').value,null);
assert.equal(ui.snapshot().channels.n1_1.power,'OFF');
// Power + sensor + CB recovered: needle and digital both resume normal values.
ui.intake(frame);
assert.equal(points.get('n1_1').value,91.3);
assert.equal(numbers.get('n1_1').value,91.3);
// Fuel USED is an explicit and documented exception to pointer/digit equality.
const used=result(buses,observed,{fuelMode:'USED'});
ui.intake(used,{fuelMode:'USED'});
assert.notEqual(points.get('fuelFlow_1').value,numbers.get('fuelFlow_1').value);
assert.equal(points.get('fuelFlow_1').value,2200);
assert.equal(numbers.get('fuelFlow_1').value,used.engines.engine1.indications.fuelFlow.digitalValue);
// N2 photo scale remains physically and logically owner-approved.
assert.deepEqual([...photo.getProfile('n2','engine1').angles],[45,90,135,180,225,270,315]);
ui.setActive(false);
ui.intake(frame);
assert.equal(ui.snapshot().active,false);
ui.setActive(true);
assert.equal(ui.snapshot().active,true);
console.log('UNIFIED_CONVENTIONAL_PARITY_PASS',JSON.stringify({
 gauges:16,randomScaleChecks:quantCount,interpolated:steps,CB:true,power:true,sensor:true,
 coldDark:true,rateAndUsed:true,n2Locked:true,auditChecks:audit.checks
}));
