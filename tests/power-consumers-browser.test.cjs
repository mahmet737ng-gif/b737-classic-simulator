'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=require('../engine/network/integrated-aircraft-kernel.cjs');
const browserSource=fs.readFileSync(path.join(root,'power-consumers-lab/runtime.js'),'utf8');
const context=vm.createContext({globalThis:{}});
new vm.Script(browserSource,{filename:'power-consumers-lab/runtime.js'}).runInContext(context);
const browser=context.globalThis.B737PowerNetwork;
assert.equal(typeof browser.initialAircraftState,'function');
assert.equal(typeof browser.transitionAircraftState,'function');
const snap=x=>JSON.parse(JSON.stringify(x));
const actions=[
  {type:'SET_GENERATOR_AVAILABLE',generator:'GEN1',value:false},
  {type:'ACK_MASTER_CAUTION'},
  {type:'SET_GENERATOR_AVAILABLE',generator:'GEN1',value:true},
  {type:'SET_FUEL_PUMP_HEALTH',pump:'MAIN2_AFT',value:false},
  {type:'SET_FUEL_PUMP_HEALTH',pump:'MAIN2_FWD',value:false},
  {type:'SET_WARNING_RECALL',value:true},
  {type:'SET_BUS_TRANSFER',value:'OFF'},
  {type:'SET_HYD_ELECTRIC_SWITCH',system:'A',value:false},
  {type:'SET_ENGINE_RUNNING',system:'A',value:false},
  {type:'SET_SENSOR_MODE',sensor:'FUEL.CTR_RIGHT',value:'STUCK_LOW'},
  {type:'SET_SENSOR_MODE',sensor:'HYD.A.SYSTEM',value:'OPEN_CIRCUIT'},
  {type:'SET_SENSOR_MODE',sensor:'FUEL.CTR_RIGHT',value:'INTERMITTENT'},
  {type:'SET_SENSOR_SAMPLE',sensor:'FUEL.CTR_RIGHT',value:'DROPOUT'},
  {type:'SET_SENSOR_SETTLING',sensor:'FUEL.CTR_RIGHT',value:true},
  {type:'SET_SENSOR_SETTLING',sensor:'FUEL.CTR_RIGHT',value:false}
];
const initialSource=source.initialAircraftState();
const initialBrowser=browser.initialAircraftState();
assert.deepEqual(snap(initialBrowser),snap(initialSource));
let a=initialSource,b=initialBrowser;
for(const action of actions){
  const stepA=source.transitionAircraftState(a,action);
  const stepB=browser.transitionAircraftState(b,action);
  assert.deepEqual(snap(stepB.view),snap(stepA.view),'browser deviated at '+action.type);
  assert.deepEqual(snap(stepB.event),snap(stepA.event),'event deviated at '+action.type);
  a=stepA.state;b=stepB.state;
}
assert.deepEqual(snap(browser.replayAircraftActions(initialBrowser,actions).view),
 snap(source.replayAircraftActions(initialSource,actions).view));
// Assert browser and Node use exactly the same Cold/Dark -> APU -> source transitions.
const startActions=[
  {type:'ENTER_COLD_DARK'},
  {type:'SET_APU_SWITCH',value:'START'},
  {type:'SET_APU_INLET_OPEN',value:true},
  {type:'CONFIRM_APU_READY'},
  {type:'SET_GENERATOR_SOURCE',bus:'bus1',value:'APU'},
  {type:'SET_GENERATOR_SOURCE',bus:'bus2',value:'APU'},
  {type:'SET_APU_BLEED',value:true},
  {type:'SET_DUCT_PSI',value:35},
  {type:'SET_FUEL_PUMP_SWITCH',pump:'MAIN2_AFT',value:true},
  {type:'SET_ENGINE_START_SWITCH',engine:2,value:'GRD'},
  {type:'SET_ENGINE_N1_ROTATION',engine:2,value:true},
  {type:'SET_ENGINE_N2',engine:2,value:25},
  {type:'SET_ENGINE_START_LEVER',engine:2,value:'IDLE'},
  {type:'CONFIRM_ENGINE_LIGHTOFF',engine:2},
  {type:'SET_ENGINE_N2',engine:2,value:46},
  {type:'CONFIRM_ENGINE_IDLE',engine:2},
  {type:'SET_GENERATOR_SOURCE',bus:'bus2',value:'GEN2'}
];
assert.deepEqual(snap(browser.replayAircraftActions(browser.initialAircraftState(),startActions)),
 snap(source.replayAircraftActions(source.initialAircraftState(),startActions)));
// ISN-07 source fidelity: pneumatic isolation, bleed latches, APU overtemp,
// observed EGT/start timer and cooldown states must be identical in browser.
const protectionActions=[
 {type:'ENTER_COLD_DARK'},
 {type:'SET_APU_SWITCH',value:'START'},
 {type:'SET_APU_INLET_OPEN',value:true},
 {type:'CONFIRM_APU_READY'},
 {type:'SET_GENERATOR_SOURCE',bus:'bus1',value:'APU'},
 {type:'SET_GENERATOR_SOURCE',bus:'bus2',value:'APU'},
 {type:'SET_APU_BLEED',value:true},
 {type:'SET_PACK_SWITCH',pack:'L',value:'AUTO'},
 {type:'SET_PACK_SWITCH',pack:'R',value:'AUTO'},
 {type:'SET_ISOLATION_SWITCH',value:'AUTO'},
 {type:'SET_PACK_SWITCH',pack:'R',value:'OFF'},
 {type:'SET_BLEED_TRIP_CONDITION',engine:1,value:true},
 {type:'SET_BLEED_TRIP_CONDITION',engine:1,value:false},
 {type:'PUSH_BLEED_TRIP_RESET'},
 {type:'SET_APU_PROTECTION_SIGNAL',fault:'BLEED_OVERTEMP',value:true},
 {type:'SET_APU_PROTECTION_SIGNAL',fault:'BLEED_OVERTEMP',value:false},
 {type:'SET_ENGINE_START_SWITCH',engine:1,value:'GRD'},
 {type:'SET_ENGINE_EGT_C',engine:1,value:725},
 {type:'ADVANCE_SECONDS',value:121}
];
assert.deepEqual(snap(browser.replayAircraftActions(browser.initialAircraftState(),protectionActions)),
 snap(source.replayAircraftActions(source.initialAircraftState(),protectionActions)));
// Exact source parity for every training fault, QRH trigger and confirmed step.
for(const id of source.TRAINING_SCENARIO_IDS){
  const commands=source.trainingScenarioActions(id);
  assert.deepEqual(snap(browser.trainingScenarioActions(id)),snap(commands));
  assert.deepEqual(
    snap(browser.replayAircraftActions(browser.initialAircraftState(),commands)),
    snap(source.replayAircraftActions(source.initialAircraftState(),commands)),
    'QRH scenario parity mismatch: '+id);
}
const checklistCommands=[
 ...source.trainingScenarioActions('APU_LOW_OIL'),
 {type:'OPEN_CHECKLIST',caseId:'APU_LOW_OIL_PRESSURE:APU'},
 {type:'CONFIRM_CHECKLIST_STEP',caseId:'APU_LOW_OIL_PRESSURE:APU',stepId:'APU_SWITCH_OFF'}
];
assert.deepEqual(
 snap(browser.replayAircraftActions(browser.initialAircraftState(),checklistCommands)),
 snap(source.replayAircraftActions(source.initialAircraftState(),checklistCommands)));
// EIS commands use the same FF/FU, sensor-failure and signal timer in Node and browser.
const eisActions=[
 {type:'ENTER_COLD_DARK'},
 {type:'SET_ENGINE_N2',engine:1,value:25},
 {type:'SET_ENGINE_EGT_C',engine:1,value:700},
 {type:'SET_ENGINE_INDICATION',engine:1,instrument:'n1Pct',value:53},
 {type:'SET_N1_FMC_REFERENCE',engine:1,value:93.5},
 {type:'SET_N1_MANUAL_REFERENCE',value:96.2},
 {type:'SET_N1_REFERENCE_MODE',value:'MANUAL'},
 {type:'SET_N1_REFERENCE_MODE',value:'FMC'},
 {type:'SET_ENGINE_INDICATION',engine:2,instrument:'fuelFlowKgHr',value:3600},
 {type:'RESET_FUEL_USED',engine:2},
 {type:'ADVANCE_SECONDS',value:1},
 {type:'ADVANCE_SECONDS',value:10},
 {type:'PUSH_FUEL_USED',engine:2},
 {type:'SET_INSTRUMENT_SIGNAL',engine:1,instrument:'n1Pct',value:'SIGNAL_LOSS'},
 {type:'ADVANCE_SECONDS',value:2}
];
assert.deepEqual(
 snap(browser.replayAircraftActions(browser.initialAircraftState(),eisActions)),
 snap(source.replayAircraftActions(source.initialAircraftState(),eisActions)));
// Performance input gate and bounded observed four-channel replay are identical
// in the Node and browser builds, including stop/reclaim sensor authority.
const sampleTrack={
 aircraft:{registration:'EP-FSI',msn:29340,engine:'CFM56-3B-1',ratingLbf:20000},
 sourceType:'OBSERVED_TELEMETRY',sourceId:'QA_TRACK_SOURCE_ONLY',
 samples:[
  {timeSec:0,n1Pct:5,n2Pct:20,egtC:100,fuelFlowKgHr:0},
  {timeSec:10,n1Pct:25,n2Pct:40,egtC:400,fuelFlowKgHr:3600},
  {timeSec:20,n1Pct:55,n2Pct:60,egtC:600,fuelFlowKgHr:7200}
 ]
};
const performanceActions=[
 {type:'ENTER_COLD_DARK'},
 {type:'SET_ENGINE_THRUST_COMMAND',engine:1,value:50},
 {type:'LOAD_ENGINE_OBSERVED_TRACK',engine:1,track:sampleTrack},
 {type:'RESET_FUEL_USED',engine:1},
 {type:'ADVANCE_SECONDS',value:1},
 {type:'ADVANCE_SECONDS',value:9},
 {type:'ADVANCE_SECONDS',value:10},
 {type:'ADVANCE_SECONDS',value:1},
 {type:'STOP_ENGINE_OBSERVED_TRACK',engine:1}
];
assert.deepEqual(
 snap(browser.replayAircraftActions(browser.initialAircraftState(),performanceActions)),
 snap(source.replayAircraftActions(source.initialAircraftState(),performanceActions)));
const html=fs.readFileSync(path.join(root,'power-consumers-lab/index.html'),'utf8');
assert.match(html,/<script src="\.\/runtime\.js"><\/script>/);
assert.match(html,/data-scenario="gen1"/);
assert.match(html,/data-scenario="gen2"/);
assert.match(html,/data-action="ack"/);
assert.match(html,/data-action="injectSensor"/);
assert.match(html,/id="sensorTable"/);
assert.match(html,/STUCK_NORMAL/);
assert.match(html,/data-action="sampleDrop"/);
assert.match(html,/data-fireloop="A"/);
assert.match(html,/data-fireloop="B"/);
assert.match(html,/data-action="fireAck"/);
assert.match(html,/data-powertrain="cold"/);
assert.match(html,/data-powertrain="apuStart"/);
assert.match(html,/data-powertrain="apuGen"/);
assert.match(html,/data-powertrain="lightoff"/);
assert.match(html,/data-powertrain="stable"/);
assert.match(html,/id="powertrainStatus"/);
assert.match(html,/data-protection="isolation"/);
assert.match(html,/data-protection="trip1"/);
assert.match(html,/data-protection="tripReset"/);
assert.match(html,/data-protection="apuFault"/);
assert.match(html,/data-protection="egt"/);
assert.match(html,/id="protectionStatus"/);
assert.match(html,/data-checklist-action="load"/);
assert.match(html,/data-checklist-action="open"/);
assert.match(html,/data-checklist-action="reset"/);
assert.match(html,/id="qrhCases"/);
assert.match(html,/id="qrhSteps"/);
assert.match(html,/data-eis-action="observe"/);
assert.match(html,/data-eis-action="signal"/);
assert.match(html,/data-eis-action="used"/);
assert.match(html,/data-eis-action="resetUsed"/);
assert.match(html,/id="eisPanels"/);
assert.match(html,/id="eisKnob"/);
assert.match(html,/id="isn10Lab"/);
assert.match(html,/data-perf-action="load"/);
assert.match(html,/data-perf-action="tick5"/);
assert.match(html,/data-perf-action="stop"/);
assert.match(html,/id="performanceTrackInput"/);
assert.match(html,/data-eis-action="n1Mode"/);
assert.match(html,/data-eis-action="setFmcRef"/);
assert.doesNotMatch(html,/data-protection="starterReset"/);

assert.match(html,/data-action="enableAudio"/);
assert.match(html,/id="annunciatorLamps"/);
assert.match(html,/<script src="\.\.\/audio\/policy\/phrase-selector-v4\.js"><\/script>/);

const inline=/\<script\>([\s\S]*?)\<\/script\>\s*\<\/body\>/m.exec(html);
assert.ok(inline,'interactive inline script missing');
new vm.Script(inline[1],{filename:'power-consumers-lab/index.html:inline'});
console.log('Browser bundle parity, scenario event replay and UI syntax checks PASS');
