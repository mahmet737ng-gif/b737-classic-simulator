'use strict';
const assert=require('node:assert/strict');
const Electrical=require('../engine/systems/electrical-v7');
const Loads=require('../engine/systems/electrical-loads-v8');
const TrainerCore=require('../engine/trainer/core');
const {WarningEngine}=require('../audio/warning-engine');
const Pneumatics=require('../engine/systems/pneumatics-v6');
const ElectricalPack=require('../engine/integration/isn-electrical-pack-v1');
const EngineAPU=require('../engine/integration/isn-engine-apu-v1');
const Start=require('../engine/integration/isn-start-sequence-v1');
const make=()=>new Start.Session({EngineAPU,ElectricalPack,Electrical,Loads,TrainerCore,WarningEngine,Pneumatics});
const fb=(device,key,value)=>({type:'FEEDBACK',device,key,value,origin:'INSTRUCTOR_OBSERVATION',instructor:true});
const power=(key,value)=>({type:'POWER_FEEDBACK',key,value,origin:'INSTRUCTOR_OBSERVATION',instructor:true});
const run=(device,running)=>({type:'SOURCE_OBSERVATION',device,running,origin:'INSTRUCTOR_OBSERVATION',instructor:true});
const es=(device,position)=>({type:'ENGINE_START_SWITCH',device,position});
const s=make();
let r=s.get();
assert.equal(r.observation.engine1.rules.starter.startValveOpenCommand,null,'No inferred battery bus from legacy electrical defaults');
assert.equal(r.observation.apu.rules.prerequisitesSatisfied,null,'No inferred APU fire handle state');
assert.equal(r.network.electrical,null);
s.send(es('engine1','GRD'));
r=s.get();
assert.equal(r.observation.engine1.rules.starter.startValveOpenCommand,null);
assert.equal(r.observation.engine1.rules.starter.motorDrivePossible,null);
s.send(power('batteryBusPowered',true));
assert.equal(s.get().observation.engine1.rules.starter.startValveOpenCommand,true);
assert.equal(s.get().observation.engine1.rules.starter.engineBleedForcedClosedCommand,true);
s.send(fb('engine1','startValveOpen',true));
assert.equal(s.get().observation.engine1.rules.starter.startValveOpenAmberLamp,true);
assert.equal(s.get().observation.engine1.rules.starter.motorDrivePossible,null,'No start air sample yet');
s.send(fb('engine1','startAirAvailable',true));
assert.equal(s.get().observation.engine1.rules.starter.motorDrivePossible,true);
assert.equal(s.get().observation.engine1.running,null,'Air + valve is not a running source');

s.send({type:'IGNITION_SELECTOR',position:'IGN_R'});
s.send(fb('engine1','fuelStartLever','IDLE'));
r=s.get().observation.engine1.rules;
assert.equal(r.ignition.demand.left,false);
assert.equal(r.ignition.demand.right,true);
assert.equal(r.ignition.supplyEligible.right,null);
s.send(power('acStandbyBusPowered',true));
assert.equal(s.get().observation.engine1.rules.ignition.supplyEligible.right,true);
s.send(power('acTransferBusPowered',false));
s.send(es('engine1','FLT'));
r=s.get().observation.engine1.rules;
assert.equal(r.ignition.demand.left,true,'FLT bypasses selector IGN_R');
assert.equal(r.ignition.demand.right,true);
assert.equal(r.ignition.supplyEligible.left,false,'Igniter remains power-dependent');
assert.equal(r.ignition.supplyEligible.right,true);
s.send(fb('engine1','fuelStartLever','CUTOFF'));
assert.equal(s.get().observation.engine1.rules.ignition.demand.right,false);
assert.equal(s.get().observation.engine1.rules.fuel.wingFuelValveOpenCommand,false);
s.send(fb('engine1','fuelStartLever','IDLE'));
s.send(es('engine1','CONT'));
assert.equal(s.get().observation.engine1.rules.ignition.demand.right,true);
s.send(es('engine1','OFF'));
assert.equal(s.get().observation.engine1.rules.ignition.demand.right,false);

// NP.21.34: N1 rotation AND 25% N2, OR max motoring >=20% N2.
s.send(fb('engine2','n2Percent',24.9));
s.send(fb('engine2','n1RotationObserved',true));
assert.equal(s.get().observation.engine2.rules.fuel.recommendMovingLeverToIdle,null,'Unknown max motoring is retained');
s.send(fb('engine2','maxMotoringObserved',false));
assert.equal(s.get().observation.engine2.rules.fuel.recommendMovingLeverToIdle,false);
s.send(fb('engine2','n2Percent',25));
assert.equal(s.get().observation.engine2.rules.fuel.recommendMovingLeverToIdle,true);
s.send(fb('engine2','n2Percent',20));
s.send(fb('engine2','maxMotoringObserved',true));
assert.equal(s.get().observation.engine2.rules.fuel.recommendMovingLeverToIdle,true);
s.send(fb('engine2','n2Percent',19.9));
assert.equal(s.get().observation.engine2.rules.fuel.recommendMovingLeverToIdle,false);
s.send(fb('engine2','n1RotationObserved',false));
s.send(fb('engine2','n2Percent',26));
assert.equal(s.get().observation.engine2.rules.fuel.recommendMovingLeverToIdle,false);

// 46% cutout is a discrete model switch release; physical valve stays evidence-gated.
s.send(es('engine1','GRD'));
s.send(fb('engine1','n2Percent',45.99));
assert.equal(s.get().controls.engine1.startSwitch,'GRD');
s.send(fb('engine1','n2Percent',46));
r=s.get();
assert.equal(r.controls.engine1.startSwitch,'OFF');
assert.equal(r.observation.engine1.rules.starter.cutoutAtApprox46N2,true);
assert.equal(r.observation.engine1.rules.starter.startValveOpenCommand,false);
assert.equal(r.observation.engine1.rules.starter.engineBleedForcedClosedCommand,false);
assert.equal(r.observation.engine1.feedback.startValveOpen.value,true,'Command must not overwrite observed hardware feedback');
assert.equal(r.observation.engine1.running,null);

// Abnormal-start 725C advisory criterion is NOT a fire-bell alarm.
s.send(fb('engine1','n2Percent',0));
s.send(es('engine1','GRD'));
s.send(fb('engine1','egtC',724.9));
assert.equal(s.get().observation.engine1.rules.advisory.egt725Latched,false);
s.send(fb('engine1','egtC',725));
assert.equal(s.get().observation.engine1.rules.advisory.egt725Latched,true);
s.send(fb('engine1','egtC',700));
assert.equal(s.get().observation.engine1.rules.advisory.egt725Latched,true,'Advisory latches until reset');
s.send(fb('engine1','fuelFlowKgHr',0));
assert.equal(s.get().observation.engine1.rules.advisory.egt725Latched,false,'FCOM zero fuel flow auto-reset');
assert.throws(()=>s.send({type:'EGT_ADVISORY_RESET',device:'engine1'}));
s.send(fb('engine1','fuelFlowKgHr',90));
s.send(fb('engine1','egtC',725));
s.send({type:'EGT_ADVISORY_RESET',device:'engine1',normalStartObserved:true,instructor:true});
assert.equal(s.get().observation.engine1.rules.advisory.egt725Latched,false);

// APU start needs two handles IN, battery switch ON and positive battery power.
s.send({type:'APU_SWITCH',position:'START'});
r=s.get();
assert.equal(r.controls.apu.switchPosition,'ON','APU START is momentary');
assert.equal(r.observation.apu.rules.inletDoorOpenCommand,null);
s.send(fb('apu','cockpitFireHandleIn',true));
s.send(fb('apu','groundFireHandleIn',true));
s.send(power('batterySwitchOn',false));
assert.equal(s.get().observation.apu.rules.prerequisitesSatisfied,false);
s.send(power('batterySwitchOn',true));
assert.equal(s.get().observation.apu.rules.inletDoorOpenCommand,true);
assert.equal(s.get().observation.apu.rules.sequenceAfterDoorOpenEligible,null);
s.send(fb('apu','inletDoorOpen',true));
assert.equal(s.get().observation.apu.rules.sequenceAfterDoorOpenEligible,true);
s.send(fb('apu','rpmPercent',100));
assert.equal(s.get().observation.apu.running,null,'Even 100% APU RPM does not auto-confirm running');

// OFF removes only selected APU generators, APU BLEED, not engine GEN2.
s.send(run('engine1',false));s.send(run('engine2',true));s.send(run('apu',true));
s.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',source:'APU',side:1}});
s.send({type:'PNEUMATIC',action:{type:'CONTROL',key:'apuBleed',value:'ON'}});
assert.equal(s.get().network.electrical.source[1],'APU');
assert.equal(s.get().network.pneumatics.bleed.apuBleedValveOpen,true);
s.send({type:'APU_SWITCH',position:'OFF'});
r=s.get();
assert.equal(r.network.electrical.source[1],null);
assert.equal(r.network.electrical.source[2],'GEN2');
assert.equal(r.network.pneumatics.bleed.apuBleedValveOpen,false);
assert.equal(r.observation.apu.running,true,'OFF command is not immediate physical stop observation');

const batteryShutdown=make();
batteryShutdown.send(power('batteryBusPowered',true));
batteryShutdown.send(power('batterySwitchOn',true));
batteryShutdown.send(power('onGround',true));
batteryShutdown.send(fb('apu','cockpitFireHandleIn',true));
batteryShutdown.send(fb('apu','groundFireHandleIn',true));
batteryShutdown.send({type:'APU_SWITCH',position:'START'});
batteryShutdown.send(run('engine1',false));
batteryShutdown.send(run('engine2',false));
batteryShutdown.send(run('apu',true));
batteryShutdown.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',source:'APU',side:1}});
batteryShutdown.send(power('batterySwitchOn',false));
assert.equal(batteryShutdown.get().network.requests.apu,'SHUTDOWN');
assert.equal(batteryShutdown.get().network.electrical.source[1],null);
assert.equal(batteryShutdown.get().observation.apu.rules.batteryOffGroundShutdownCondition,true);
assert.equal(batteryShutdown.get().observation.apu.running,true);

const fireShutdown=make();
fireShutdown.send({type:'APU_SWITCH',position:'START'});
fireShutdown.send(fb('apu','cockpitFireHandleIn',false));
assert.equal(fireShutdown.get().network.requests.apu,'SHUTDOWN');
assert.equal(fireShutdown.get().observation.apu.rules.cockpitFireHandleShutdownCondition,true);

for (const bad of [
 {type:'ENGINE_START_SWITCH',device:'apu',position:'GRD'},
 {type:'ENGINE_START_SWITCH',device:'engine1',position:'IGN L'},
 {type:'IGNITION_SELECTOR',position:'FLIGHT'},
 {type:'APU_SWITCH',position:'GRD'},
 power('wrongPower',true),power('batteryBusPowered',1),
 {type:'POWER_FEEDBACK',key:'batteryBusPowered',value:true,origin:'INSTRUCTOR_OBSERVATION'}
])assert.throws(()=>s.send(bad));

const scenario=[power('batteryBusPowered',true),es('engine1','GRD'),
 fb('engine1','n2Percent',26),fb('engine1','fuelStartLever','IDLE'),
 fb('engine1','n2Percent',46),run('engine1',true),run('engine2',false),run('apu',false)];
assert.deepEqual(make().replay(scenario),make().replay(scenario),'Source-backed replay deterministic');
console.log('PASS ISN-03 FCOM source rules: start valve + ignition power, N2 cutout, 725C advisory, APU prerequisites + shutdown, unknown preservation and replay.');
