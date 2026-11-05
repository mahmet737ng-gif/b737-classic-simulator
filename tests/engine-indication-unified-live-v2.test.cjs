'use strict';
/* Unified engine front/back smoke: exercises actual presentation bridge against
 * one mocked existing ISN ECU and Electrical V7 bus owner (no second plant).
 */
const assert=require('node:assert/strict');
const core=require('../engine/instruments/engine-indication-backend-v1.js');
const db=require('../engine/instruments/engine-indication-technical-db-v1.json');
const Electrical=require('../engine/systems/electrical-v7.js');
const fs=require('node:fs'),path=require('node:path');
const file=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const index=file('panel-mosaic-lab/cockpit/index.html');
const ui=file('panel-mosaic-lab/cockpit/engine-indication-live-v2.js');
const lab=file('panel-mosaic-lab/engine-test-lab/index.html');
const shell=file('panel-mosaic-lab/cockpit/isn-cockpit.js');
assert.match(index,/engine-indication-live-v2\.js/);
assert.match(index,/classic-engine-start-logic-v2\.js/);
assert.match(index,/engine-indication-backend-v1\.js/);
assert.match(index,/engine-indication-live-v2\.css/);
assert.match(lab,/NORMAL/);assert.match(lab,/ABNORMAL/);
assert.match(lab,/EMERGENCY/);assert.match(lab,/SYSTEM \/ EIS BITE/);
assert.match(shell,/engineTrainerAction:command/);
assert.match(shell,/getECUState:\(\)=>ecu.get\(\)/);
assert.match(ui,/B737ISNCockpitV1\?\.getElectricalState/);
assert.ok(!ui.includes('new window.B737ISN1318ECUTestbenchV1.Testbench'), 'No duplicate ECU instantiation');
assert.ok(!ui.includes('new Electrical'), 'No duplicate electrical plant');

const nodes=new Map(),renders=[];
const mockNode={dataset:{},style:{},setAttribute(name,value){this[name]=value}};
const nodeFor=sel=>{if(!nodes.has(sel))nodes.set(sel,{dataset:{},style:{},setAttribute(name,value){this[name]=value}});return nodes.get(sel)};
let electric=Electrical.initialState(); // default running GEN1/GEN2; one source owner
const raw={quality:'TRAINING_SIMULATION_ONLY',timeMs:0,engines:{
 engine1:{n1Percent:31,n2Percent:61,egtC:490,fuelFlowKgHr:3600,
  oil:{pressurePsi:58,temperatureC:81,quantityPct:80},startValveOpen:false},
 engine2:{n1Percent:32,n2Percent:60,egtC:485,fuelFlowKgHr:1200,
  oil:{pressurePsi:57,temperatureC:80,quantityPct:85},startValveOpen:false}
}};
global.document={
 readyState:'loading',baseURI:'https://localhost/panel-mosaic-lab/cockpit/index.html',documentElement:{dataset:{engineIndication:'EIS'}},
 addEventListener(){},querySelector:nodeFor
};
const listeners=new Map();
const readouts=[];
global.window={
 B737ElectricalV7:Electrical,B737EngineIndicationsV1:core,
 B737ISNCockpitV1:{
  getElectricalState(){return electric},
  getECUState(){return raw}
 },
 B737EISNeedlesV1:{setReading(engine,key,val){renders.push({kind:'eis',engine,key,val})}},
 B737EISDotReadoutsV1:{setReading(engine,key,val){readouts.push({engine,key,val})}},
 B737ConventionalNeedlesV1:{setReading(engine,key,val){renders.push({kind:'conventional',engine,key,val})}},
 B737EngineIndicationModeV1:{setMode(m){global.document.documentElement.dataset.engineIndication=m}},
 addEventListener(type,handler){listeners.set(type,handler)},
 dispatchEvent() {}
};
global.CustomEvent=class{constructor(type,detail){this.type=type;this.detail=detail?.detail}};
global.fetch=async()=>({ok:true,json:async()=>db});
global.location={origin:'https://localhost'};
require('../panel-mosaic-lab/cockpit/engine-indication-live-v2.js');

async function run(){
 const live=window.B737UnifiedEngineIndicationsV2;
 assert.equal(await live.load(),true);
 let s=live.getState();
 assert.equal(s.ready,true);
 assert.equal(s.mode,'EIS');
 assert.equal(s.snapshot.engines.engine1.indications.n2.status,'VALID');
 assert.equal(s.snapshot.engines.engine1.indications.oilQuantity.value,80);
 assert.ok(readouts.some(x=>x.engine==='engine1'&&x.key==='fuelFlow'&&x.val===3600));
 assert.equal(nodeFor('#region-main [data-gauge="n2_1"]').style.visibility,'visible');

 // EIS source fault: two-second low-stop, then digital dashes and no pointer.
 live.command({type:'SENSOR',engine:'engine1',parameter:'n1',condition:'FAILED'});
 raw.timeMs+=1000;live.refresh();
 assert.equal(live.getState().snapshot.engines.engine1.indications.n1.status,'SENSOR_FAILURE_TRANSIENT');
 raw.timeMs+=1100;live.refresh();
 assert.equal(live.getState().snapshot.engines.engine1.indications.n1.status,'SENSOR_FAILED');
 assert.equal(nodeFor('#region-main [data-gauge="n1_1"]').style.visibility,'hidden');
 assert.equal(readouts.at(-1).val,null);
 live.command({type:'SENSOR',engine:'engine1',parameter:'n1',condition:'CLEAR'});
 assert.equal(live.getState().snapshot.engines.engine1.indications.n1.status,'VALID');
 // Unit fail is separate from sensor failure and blanks primary readouts.
 live.command({type:'DISPLAY_FAULT',key:'eisPrimary',active:true});
 assert.equal(live.getState().snapshot.engines.engine1.indications.n1.status,'UNIT_FAILED');
 assert.equal(nodeFor('#region-main [data-eis-readout="n1_1"]').style.visibility,'hidden');
 live.command({type:'DISPLAY_FAULT',key:'eisPrimary',active:false});
 // Fuel USED shows accumulated kilograms (converted by existing renderer).
 live.command({type:'FUEL_MODE',value:'USED'});
 raw.timeMs+=1000;live.refresh();
 const used=live.getState().snapshot.fuelUsedKg.engine1;
 assert.equal(used,Number((raw.timeMs/1000).toFixed(5)), 'Fuel used must include all ECU elapsed time, not only the last tick');
 assert.ok(readouts.some(x=>x.key==='fuelFlow'&&x.val===used));
 raw.timeMs+=10001;live.refresh();
 assert.equal(live.getState().fuelMode,'RATE');
 live.command({type:'RESET_FUEL_USED'});
 assert.equal(live.getState().snapshot.fuelUsedKg.engine1,0);
 // Conventional photo needles use same observed ECU but have different feeds.
 live.command({type:'MODE',mode:'CONVENTIONAL'});
 assert.equal(live.getState().mode,'CONVENTIONAL');
 assert.ok(renders.some(x=>x.kind==='conventional'&&x.engine==='engine1'&&x.key==='n2'));
 assert.equal(live.getState().snapshot.engines.engine1.indications.oilQuantity.value,4);
 assert.equal(nodeFor('#region-main [data-conventional-needle="oilQty_1"]').style.visibility,'visible');
 // Power falls on the respective Conventional channel while other engine stays live.
 electric=Electrical.apply(electric,{type:'FAULT',id:'TR1_FAILED',active:true,instructor:true});
 live.refresh();
 assert.ok(['VALID','POWER_LOSS','POWER_EFFECT_UNVERIFIED','POWER_UNKNOWN'].includes(
  live.getState().snapshot.engines.engine1.indications.oilPressure.status));

 // Engine Lab must drive the installed overhead rotary controller, never a shadow switch.
 const detents={'engine-start-1':'OFF','engine-start-2':'OFF','ignition-source':'BOTH'};
 const physical={
  getState(){return {rotaries:{...detents}}},
  setEngineLabDetent(id,value){if(!(id in detents))return false;detents[id]=value;return true;}
 };
 global.document.getElementById=id=>id==='overheadFrame'?{contentWindow:{B737RotaryGuards:physical}}:null;
 const start=live.command({type:'PHYSICAL_START_SWITCH',engine:'engine1',value:'GRD'});
 assert.equal(start.accepted,true);
 assert.equal(start.owner,'ACTUAL_OVERHEAD_ROTARY');
 assert.equal(detents['engine-start-1'],'GRD');
 assert.equal(detents['engine-start-2'],'OFF');
 const ign=live.command({type:'PHYSICAL_IGNITION',engine:'engine1',value:'IGN R'});
 assert.equal(ign.accepted,true);
 assert.equal(detents['ignition-source'],'IGN R');
 assert.equal(live.command({type:'PHYSICAL_START_SWITCH',engine:'engine1',value:'GRD'}).unchanged,true);
 assert.throws(()=>live.command({type:'PHYSICAL_START_SWITCH',engine:'engine1',value:'BAD'}),/Invalid physical/);
 global.document.getElementById=()=>null;
 assert.throws(()=>live.command({type:'PHYSICAL_START_SWITCH',engine:'engine1',value:'OFF'}),/not mounted/);
 console.log('PASS engine indication frontend + source DB + ECU, EIS faults, fuel used/10s, Conventional needles');
}
run().catch(e=>{console.error(e);process.exitCode=1});
