'use strict';
const assert=require('node:assert/strict');
const {initialAircraftState:init,deriveAircraftState:derive,
  transitionAircraftState:step,replayAircraftActions:replay}=
  require('../engine/network/integrated-aircraft-kernel.cjs');
const {AUDIO}=require('../audio/warning-engine.js');
const {PhraseSelector,DIRECT}=require('../audio/policy/phrase-selector-v4.js');

const cmd=(type,extra={})=>({type,...extra});
const change=(s,type,extra={})=>step(s,cmd(type,extra));
const base=init();
let normal=derive(base);
const lamp=(view,id)=>view.annunciation.lamps[id];
assert.equal(normal.annunciation.schema,'b737cl-annunciation-isn05-v0.1');
assert.equal(lamp(normal,'MASTER_CAUTION_CAPT').logicalDemand,'OFF');
assert.equal(lamp(normal,'ANNUN_FUEL').logicalDemand,'OFF');
assert.equal(lamp(normal,'ANNUN_ELEC').logicalDemand,'UNKNOWN');
assert.equal(lamp(normal,'FUEL.CTR_RIGHT_LOW'),undefined);
assert.equal(lamp(normal,'FUEL_CTR_RIGHT_LOW').logicalDemand,'OFF');
assert.deepEqual(normal.annunciation.audio.activeKeys,[]);
assert.equal(normal.fireDetection.fireDetected,false);
assert.equal(lamp(normal,'MASTER_FIRE_WARN_CAPT').logicalDemand,'OFF');

// GEN1 removes center-right fuel and hydraulic B electric. Pump local LOW
// remains illuminated logically after ACK, while master/system annunciators reset.
let a=change(base,'SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:false});
let v=a.view;
assert.equal(lamp(v,'MASTER_CAUTION_CAPT').logicalDemand,'ON');
assert.equal(lamp(v,'MASTER_CAUTION_FO').logicalDemand,'ON');
assert.equal(lamp(v,'ANNUN_FUEL').logicalDemand,'ON');
assert.equal(lamp(v,'FUEL_CTR_RIGHT_LOW').logicalDemand,'ON');
assert.equal(lamp(v,'HYD_B_ELEC_LOW').logicalDemand,'ON');
assert.equal(lamp(v,'ANNUN_HYD').logicalDemand,'UNKNOWN'); // single electric pump not total hydraulics
assert.ok(a.event.annunciationChanges.lamps.some(x=>x.id==='MASTER_CAUTION_CAPT'));
assert.deepEqual(a.event.annunciationChanges.audio.start,[]); // no caution horn invented
a=change(a.state,'ACK_MASTER_CAUTION');
v=a.view;
assert.equal(lamp(v,'MASTER_CAUTION_CAPT').logicalDemand,'OFF');
assert.equal(lamp(v,'ANNUN_FUEL').logicalDemand,'OFF');
assert.equal(lamp(v,'FUEL_CTR_RIGHT_LOW').logicalDemand,'ON');
assert.equal(lamp(v,'HYD_B_ELEC_LOW').logicalDemand,'ON');
assert.deepEqual(v.annunciation.audio.activeKeys,[]);
a=change(a.state,'SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:true});
assert.equal(lamp(a.view,'FUEL_CTR_RIGHT_LOW').logicalDemand,'OFF');
a=change(a.state,'SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:false});
assert.equal(lamp(a.view,'MASTER_CAUTION_CAPT').logicalDemand,'ON');

// A single main pump fault is recall-only, not an immediate master caution;
// physical local LOW indication persists independently.
a=change(base,'SET_FUEL_PUMP_HEALTH',{pump:'MAIN1_FWD',value:false});
assert.equal(lamp(a.view,'FUEL_MAIN1_FWD_LOW').logicalDemand,'ON');
assert.equal(lamp(a.view,'ANNUN_FUEL').logicalDemand,'OFF');
assert.equal(lamp(a.view,'MASTER_CAUTION_CAPT').logicalDemand,'OFF');
a=change(a.state,'SET_WARNING_RECALL',{value:true});
assert.equal(lamp(a.view,'ANNUN_FUEL').logicalDemand,'ON');

// sensor cable fault -> UNKNOWN rather than spurious cockpit lamp.
a=change(base,'SET_SENSOR_MODE',{sensor:'FUEL.CTR_LEFT',value:'OPEN_CIRCUIT'});
assert.equal(lamp(a.view,'FUEL_CTR_LEFT_LOW').logicalDemand,'UNKNOWN');
assert.equal(lamp(a.view,'MASTER_CAUTION_CAPT').logicalDemand,'OFF');

// A true total hydraulic system low pressure gives FLT CONT and HYD system
// annunciation but no unsupported fireBell.
a=replay(base,[
  cmd('SET_HYD_ELECTRIC_SWITCH',{system:'A',value:false}),
  cmd('SET_ENGINE_RUNNING',{system:'A',value:false})
]);
assert.equal(lamp(a.view,'FLT_CONT_A_LOW').logicalDemand,'ON');
assert.equal(lamp(a.view,'ANNUN_FLT_CONT').logicalDemand,'ON');
assert.equal(lamp(a.view,'ANNUN_HYD').logicalDemand,'ON');
assert.deepEqual(a.view.annunciation.audio.activeKeys,[]);

// In blackout lamp circuit power is unverified; normal logical caution
// is kept separate from physical visibility.
a=replay(base,[
  cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:false}),
  cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN2',value:false})
]);
assert.equal(lamp(a.view,'MASTER_CAUTION_CAPT').logicalDemand,'ON');
assert.equal(lamp(a.view,'MASTER_CAUTION_CAPT').projectedVisibility,'UNKNOWN');
assert.equal(lamp(a.view,'FUEL_CTR_LEFT_LOW').projectedVisibility,'UNKNOWN');

// FIRE: both loops sense engine 1 fire. Independent fire warn RED,
 // detector-fed amber OVHT caution, and fireBell audio intent.
a=replay(base,[
  cmd('SET_FIRE_LOOP',{loop:'A',field:'fire',value:true}),
  cmd('SET_FIRE_LOOP',{loop:'B',field:'fire',value:true})
]);
let firing=a.view;
assert.equal(firing.fireDetection.fireDetected,true);
assert.equal(lamp(firing,'ENG1_FIRE_SWITCH').logicalDemand,'ON');
assert.equal(lamp(firing,'MASTER_FIRE_WARN_CAPT').logicalDemand,'ON');
assert.equal(lamp(firing,'MASTER_CAUTION_CAPT').logicalDemand,'ON');
assert.equal(lamp(firing,'ANNUN_OVHT_DET').logicalDemand,'ON');
assert.deepEqual(firing.annunciation.audio.activeKeys,['fireBell']);
assert.ok(a.events.some(e=>e.annunciationChanges.audio.start.some(x=>x.key==='fireBell')));
assert.equal(AUDIO.fireBell.priority,95);
assert.equal(DIRECT.fireBell,'fire-alarm.mp3');
const phrases=new PhraseSelector();
assert.equal(phrases.asset('fireBell'),'audio/original/fire-alarm.mp3');
assert.deepEqual(phrases.update({active:[{key:'fireBell'}]}).play.map(x=>x.key),['fireBell']);
assert.deepEqual(phrases.update({active:[{key:'fireBell'}]}).hold.map(x=>x.key),['fireBell']);
assert.deepEqual(phrases.update({active:[]}).stop.map(x=>x.key),['fireBell']);
a=change(a.state,'ACK_FIRE_WARN');
assert.equal(lamp(a.view,'MASTER_FIRE_WARN_CAPT').logicalDemand,'OFF');
assert.equal(lamp(a.view,'ENG1_FIRE_SWITCH').logicalDemand,'ON');
assert.equal(a.view.annunciation.audio.activeKeys.length,0);
assert.ok(a.event.annunciationChanges.audio.stop.some(x=>x.key==='fireBell'));
assert.equal(lamp(a.view,'MASTER_CAUTION_CAPT').logicalDemand,'ON');
// Master fire cutout does NOT automatically acknowledge master caution.
a=change(a.state,'ACK_MASTER_CAUTION');
assert.equal(lamp(a.view,'MASTER_CAUTION_CAPT').logicalDemand,'OFF');
assert.equal(lamp(a.view,'ENG1_FIRE_SWITCH').logicalDemand,'ON');
a=replay(a.state,[
  cmd('SET_FIRE_LOOP',{loop:'A',field:'fire',value:false}),
  cmd('SET_FIRE_LOOP',{loop:'B',field:'fire',value:false}),
  cmd('SET_FIRE_LOOP',{loop:'A',field:'fire',value:true}),
  cmd('SET_FIRE_LOOP',{loop:'B',field:'fire',value:true})
]);
assert.equal(lamp(a.view,'MASTER_FIRE_WARN_CAPT').logicalDemand,'ON');
assert.deepEqual(a.view.annunciation.audio.activeKeys,['fireBell']);

// Only one healthy sensor loop: configured degraded detector still responds.
// If BAT bus is dead, detector output is unknown; audio must not start.
a=replay(base,[
  cmd('SET_FIRE_LOOP',{loop:'B',field:'healthy',value:false}),
  cmd('SET_FIRE_LOOP',{loop:'A',field:'fire',value:true})
]);
assert.equal(a.view.fireDetection.fireDetected,true);
assert.equal(a.view.fireDetection.sensorStatus,'DEGRADED');
a=replay(base,[
  cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:false}),
  cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN2',value:false}),
  cmd('SET_BATTERY_USABLE',{value:false}),
  cmd('SET_FIRE_LOOP',{loop:'A',field:'fire',value:true}),
  cmd('SET_FIRE_LOOP',{loop:'B',field:'fire',value:true})
]);
assert.equal(a.view.fireDetection.fireDetected,null);
assert.equal(lamp(a.view,'MASTER_FIRE_WARN_CAPT').logicalDemand,'UNKNOWN');
assert.deepEqual(a.view.annunciation.audio.activeKeys,[]);
assert.deepEqual(a.view.annunciation.audio.unresolvedKeys,['fireBell']);

assert.throws(()=>change(base,'SET_FIRE_SELECTOR',{value:'INVALID'}),TypeError);
assert.throws(()=>change(base,'SET_FIRE_LOOP',{loop:'C',field:'fire',value:true}),TypeError);
assert.throws(()=>change(base,'SET_FIRE_LOOP',{loop:'A',field:'fire',value:1}),TypeError);
assert.deepEqual(replay(base,[cmd('SET_FIRE_LOOP',{loop:'A',field:'fire',value:true})]),
  replay(base,[cmd('SET_FIRE_LOOP',{loop:'A',field:'fire',value:true})]));
assert.equal(base.fire.loops.A.fire,false);
console.log('ISN-05 lamps/master caution/recall, fire bell intents and source-traced cutout PASS');
