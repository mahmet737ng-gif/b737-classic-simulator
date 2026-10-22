'use strict';
const assert=require('node:assert/strict');
const {initialAircraftState:init,transitionAircraftState:step,
  replayAircraftActions:replay}=require('../engine/network/integrated-aircraft-kernel.cjs');
const cmd=(type,extra={})=>({type,...extra});
const run=(s,type,extra={})=>step(s,cmd(type,extra));
const cold=run(init(),'ENTER_COLD_DARK').state;
const readyCommands=[
 cmd('SET_APU_SWITCH',{value:'START'}),
 cmd('SET_APU_INLET_OPEN',{value:true}),
 cmd('CONFIRM_APU_READY'),
 cmd('SET_GENERATOR_SOURCE',{bus:'bus1',value:'APU'}),
 cmd('SET_GENERATOR_SOURCE',{bus:'bus2',value:'APU'}),
 cmd('SET_APU_BLEED',{value:true}),
 cmd('SET_DUCT_PSI',{value:35})
];
const start2=[
 cmd('SET_FUEL_PUMP_SWITCH',{pump:'MAIN2_AFT',value:true}),
 cmd('SET_ENGINE_START_SWITCH',{engine:2,value:'GRD'}),
 cmd('SET_ENGINE_N1_ROTATION',{engine:2,value:true}),
 cmd('SET_ENGINE_N2',{engine:2,value:25}),
 cmd('SET_ENGINE_START_LEVER',{engine:2,value:'IDLE'})
];
const lamp=(v,id)=>v.annunciation.lamps[id].logicalDemand;
let fixture=replay(cold,readyCommands),s=fixture.state,v=fixture.view;
let air=v.propulsion.pneumatic.distribution;
assert.equal(air.isolation.command,'OPEN');
assert.equal(air.isolation.nominalProjectedPosition,'OPEN');
assert.equal(air.engines['2'].source,'APU');
assert.equal(air.dualBleedLightDemand,true);
assert.equal(lamp(v,'DUAL_BLEED'),'ON');
assert.equal(lamp(v,'BLEED_TRIP_1'),'OFF');
// AUTO closes when both engine bleed and both packs are in AUTO/HIGH;
// APU BLEED ON does not alter AUTO position.
s=replay(s,[cmd('SET_PACK_SWITCH',{pack:'L',value:'AUTO'}),
  cmd('SET_PACK_SWITCH',{pack:'R',value:'AUTO'})]).state;
v=run(s,'SET_ISOLATION_SWITCH',{value:'AUTO'}).view;
assert.equal(v.propulsion.pneumatic.distribution.isolation.command,'CLOSE');
assert.equal(v.propulsion.pneumatic.distribution.engines['2'].access,'UNAVAILABLE');
// Any PACK OFF in AUTO opens the isolation valve.
s=run(s,'SET_PACK_SWITCH',{pack:'R',value:'OFF'}).state;
assert.equal(run(s,'SET_ISOLATION_SWITCH',{value:'AUTO'}).view.propulsion.pneumatic.distribution.isolation.command,'OPEN');
// Explicit close isolates No.2 starter from APU bleed with no invented
// duct pressure propagation across the closed valve.
s=run(s,'SET_ISOLATION_SWITCH',{value:'CLOSE'}).state;
v=run(s,'SET_ENGINE_START_SWITCH',{engine:2,value:'GRD'}).view;
assert.equal(v.propulsion.engines['2'].status,'AIR_NOT_CONFIRMED');
assert.equal(v.propulsion.engines['2'].air.available,false);
// APU overtemperature is a valve protection, NOT an auto APU shutdown.
let overtemp=run(fixture.state,'SET_APU_PROTECTION_SIGNAL',{fault:'BLEED_OVERTEMP',value:true});
assert.equal(overtemp.view.propulsion.apu.phase,'AVAILABLE');
assert.equal(overtemp.view.propulsion.pneumatic.distribution.apuBleedValve.projectedOpen,false);
assert.equal(overtemp.view.propulsion.protection.apu.overtemperatureBleedClosure,true);
assert.equal(overtemp.view.propulsion.pneumatic.distribution.engines['2'].access,'UNAVAILABLE');
overtemp=run(overtemp.state,'SET_APU_PROTECTION_SIGNAL',{fault:'BLEED_OVERTEMP',value:false});
assert.equal(overtemp.view.propulsion.pneumatic.distribution.apuBleedValve.projectedOpen,true);
// FCOM §7.30.3 lists these independent APU automatic shutdown triggers.
for(const fault of ['OVERSPEED','LOW_OIL_PRESSURE','HIGH_OIL_TEMPERATURE','FIRE','FCU_FAILURE']){
 const x=run(fixture.state,'SET_APU_PROTECTION_SIGNAL',{fault,value:true});
 assert.equal(x.view.propulsion.apu.phase,'OFF',fault);
 assert.equal(x.view.propulsion.apu.fault,'AUTO_SHUTDOWN_'+fault,fault);
 assert.equal(x.view.electrical.sourceAssignments.bus1,null);
 assert.equal(x.view.electrical.sourceAssignments.bus2,null);
}
// BLEED TRIP stays latched after the sensor condition clears until RESET.
let trip=run(fixture.state,'SET_BLEED_TRIP_CONDITION',{engine:1,value:true});
assert.equal(lamp(trip.view,'BLEED_TRIP_1'),'ON');
assert.equal(trip.view.propulsion.pneumatic.distribution.engineValves['1'].bleedTripLatched,true);
trip=run(trip.state,'PUSH_BLEED_TRIP_RESET');
assert.equal(lamp(trip.view,'BLEED_TRIP_1'),'ON');
trip=run(trip.state,'SET_BLEED_TRIP_CONDITION',{engine:1,value:false});
assert.equal(lamp(trip.view,'BLEED_TRIP_1'),'ON');
trip=run(trip.state,'PUSH_BLEED_TRIP_RESET');
assert.equal(lamp(trip.view,'BLEED_TRIP_1'),'OFF');
// EGT limit is observed, not synthesized. Source §7.20.7 documents
// 725 C display flash (not a generic red FIRE warning).
let egt=replay(fixture.state,start2);
assert.equal(egt.view.propulsion.engines['2'].status,'AWAITING_LIGHTOFF_CONFIRMATION');
egt=run(egt.state,'SET_ENGINE_EGT_C',{engine:2,value:725});
assert.equal(egt.view.propulsion.protection.engines['2'].egtDigitalFlashDemand,true);
assert.equal(lamp(egt.view,'ENG2_EGT_FLASH'),'ON');
assert.ok(egt.view.propulsion.protection.engines['2'].advisoryReasons.includes('EGT_AT_OR_ABOVE_725_C'));
assert.equal(egt.view.annunciation.audio.activeKeys.length,0);
let noRise=run(egt.state,'SET_ENGINE_EGT_RISE_CONFIRMED',{engine:2,value:false});
noRise=run(noRise.state,'ADVANCE_SECONDS',{value:10});
assert.ok(noRise.view.propulsion.protection.engines['2'].advisoryReasons.includes('NO_EGT_RISE_WITHIN_10_SECONDS'));
const unknownRise=run(egt.state,'ADVANCE_SECONDS',{value:10});
assert.equal(unknownRise.view.propulsion.protection.engines['2'].advisoryReasons.includes('NO_EGT_RISE_WITHIN_10_SECONDS'),false);
let stalled=replay(fixture.state,[...start2,
 cmd('SET_ENGINE_EGT_RISE_CONFIRMED',{engine:2,value:true}),
 cmd('SET_ENGINE_N2',{engine:2,value:33}),
 cmd('SET_ENGINE_N2_ACCELERATION',{engine:2,value:'SLOW'})
]);
assert.ok(stalled.view.propulsion.protection.engines['2'].advisoryReasons.includes('SLOW_N2_ACCELERATION_AFTER_EGT_RISE'));
// Two-minute starter usage is passive telemetry only, per owner's
// instruction; no fault, checklist trigger, automatic cutout or crew prompt.
let duty=run(fixture.state,'SET_ENGINE_START_SWITCH',{engine:1,value:'GRD'});
assert.equal(duty.view.propulsion.protection.engines['1'].attemptCount,1);
duty=run(duty.state,'ADVANCE_SECONDS',{value:121});
assert.equal(duty.view.propulsion.engines['1'].startSwitch,'GRD');
assert.equal(duty.view.propulsion.protection.engines['1'].starterElapsedSeconds,121);
assert.equal(duty.view.propulsion.protection.engines['1'].startFault,null);
assert.equal(duty.view.propulsion.protection.engines['1'].advisoryReasons.includes('STARTER_DUTY_LIMIT'),false);
assert.equal(duty.view.propulsion.protection.engines['1'].recommendedProcedure,'NONE_CONFIRMED');
duty=run(duty.state,'SET_ENGINE_START_SWITCH',{engine:1,value:'OFF'});
assert.equal(duty.view.propulsion.protection.engines['1'].cooldownRemainingSeconds,20);
assert.throws(()=>run(duty.state,'SET_ENGINE_START_SWITCH',{engine:1,value:'GRD'}),Error);
duty=run(duty.state,'ADVANCE_SECONDS',{value:20});
duty=run(duty.state,'SET_ENGINE_START_SWITCH',{engine:1,value:'GRD'});
assert.equal(duty.view.propulsion.protection.engines['1'].attemptCount,2);
duty=run(duty.state,'SET_ENGINE_START_SWITCH',{engine:1,value:'OFF'});
assert.equal(duty.view.propulsion.protection.engines['1'].cooldownRemainingSeconds,180);
assert.throws(()=>run(duty.state,'SET_ENGINE_START_SWITCH',{engine:1,value:'GRD'}),Error);
duty=run(duty.state,'ADVANCE_SECONDS',{value:180});
duty=run(duty.state,'SET_ENGINE_START_SWITCH',{engine:1,value:'GRD'});
assert.equal(duty.view.propulsion.protection.engines['1'].attemptCount,3);
// Premature GRD release with N2 >=20 blocks re-engagement until N2 falls.
let early=replay(fixture.state,[
 cmd('SET_ENGINE_START_SWITCH',{engine:1,value:'GRD'}),
 cmd('SET_ENGINE_N2',{engine:1,value:26}),
 cmd('SET_ENGINE_START_SWITCH',{engine:1,value:'OFF'}),
 cmd('ADVANCE_SECONDS',{value:20})
]);
assert.throws(()=>run(early.state,'SET_ENGINE_START_SWITCH',{engine:1,value:'GRD'}),/N2_BELOW_20/);
early=run(early.state,'SET_ENGINE_N2',{engine:1,value:19.5});
early=run(early.state,'SET_ENGINE_START_SWITCH',{engine:1,value:'GRD'});
assert.equal(early.view.propulsion.engines['1'].startSwitch,'GRD');
// CHECKLIST/alert are source-indexed recommendations. No assumed automatic
// shutdown or a fabricated master caution for an engine abnormal start.
assert.equal(egt.view.propulsion.protection.engines['2'].recommendedProcedure,'REVIEW_ABORTED_ENGINE_START');
assert.equal(egt.view.propulsion.protection.engines['2'].automaticEngineShutdown,false);
assert.equal(egt.view.annunciation.audio.activeKeys.length,0);
assert.throws(()=>run(fixture.state,'SET_APU_PROTECTION_SIGNAL',{fault:'SOME_GUESS',value:true}),TypeError);
assert.throws(()=>run(fixture.state,'SET_ENGINE_EGT_C',{engine:1,value:NaN}),TypeError);
assert.deepEqual(replay(cold,readyCommands),replay(cold,readyCommands));
console.log('ISN-07 pneumatic AUTO/DUAL BLEED, trip resets, APU protections, starter cooldown and abort advisories PASS');
