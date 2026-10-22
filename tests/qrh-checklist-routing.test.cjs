'use strict';
const assert=require('node:assert/strict');
const {initialAircraftState:init,replayAircraftActions:replay,
  transitionAircraftState:step,TRAINING_SCENARIO_IDS,trainingScenarioActions}=
  require('../engine/network/integrated-aircraft-kernel.cjs');
const act=(s,type,extra={})=>step(s,{type,...extra});
const byId=(v,id)=>v.checklists.cases.find(x=>x.id===id);
assert.deepEqual(TRAINING_SCENARIO_IDS,[
 'APU_LOW_OIL','APU_OVERSPEED','APU_FIRE','APU_FCU_FAILURE',
 'BLEED_TRIP_1','ABORTED_START_2','ENGINE_FIRE_1']);
for(const id of TRAINING_SCENARIO_IDS) {
 const one=replay(init(),trainingScenarioActions(id));
 const two=replay(init(),trainingScenarioActions(id));
 assert.deepEqual(one,two,'not deterministic: '+id);
 assert.ok(one.view.checklists.activeCaseIds.length>0,id);
 assert.deepEqual(one.view.checklists.label,'REFERENCE_ONLY_TRAINING_NOT_FLIGHT_USE');
 assert.ok(one.events.some(e=>e.checklistChanges.activated.length>0),id);
}
const expected={
 APU_LOW_OIL:'APU_LOW_OIL_PRESSURE:APU',
 APU_OVERSPEED:'APU_OVERSPEED:APU',
 APU_FIRE:'APU_FIRE:APU',
 APU_FCU_FAILURE:'APU_FAULT:APU',
 BLEED_TRIP_1:'BLEED_TRIP_OFF:1',
 ABORTED_START_2:'ABORTED_ENGINE_START:2',
 ENGINE_FIRE_1:'ENGINE_FIRE:1'
};
for(const [scenario,caseId] of Object.entries(expected)){
 const {view}=replay(init(),trainingScenarioActions(scenario));
 assert.ok(view.checklists.activeCaseIds.includes(caseId),scenario+' missing '+caseId);
 const theCase=byId(view,caseId);
 assert.equal(theCase.source.sourceId,'QRH-SEPEHRAN-D6-27370-3-500-SEP-20161216');
 assert.ok(theCase.source.pdfPage>0);
 assert.equal(theCase.fullProcedureInRepository,false);
}
// APU low oil: automatic shutdown is a SYSTEM effect; QRH steps never
// automatically press the crew's APU OFF switch or claim completion.
let r=replay(init(),trainingScenarioActions('APU_LOW_OIL'));
assert.equal(r.view.propulsion.apu.phase,'OFF');
assert.equal(r.view.checklists.cases[0].completedCount,0);
assert.throws(()=>act(r.state,'CONFIRM_CHECKLIST_STEP',{stepId:'APU_SWITCH_OFF'}),Error);
r=act(r.state,'OPEN_CHECKLIST',{caseId:'APU_LOW_OIL_PRESSURE:APU'});
assert.equal(r.view.checklists.selected,'APU_LOW_OIL_PRESSURE:APU');
assert.equal(byId(r.view,'APU_LOW_OIL_PRESSURE:APU').steps[0].observed,true);
r=act(r.state,'CONFIRM_CHECKLIST_STEP',{caseId:'APU_LOW_OIL_PRESSURE:APU',stepId:'APU_SWITCH_OFF'});
assert.equal(byId(r.view,'APU_LOW_OIL_PRESSURE:APU').completedCount,1);
assert.equal(r.view.checklists.audit[0].verification,'OBSERVED');
assert.equal(r.view.propulsion.apu.phase,'OFF');
assert.equal(r.event.checklistChanges.confirmations.length,1);
assert.throws(()=>act(r.state,'CONFIRM_CHECKLIST_STEP',{caseId:'APU_LOW_OIL_PRESSURE:APU',stepId:'UNKNOWN'}),TypeError);
r=act(r.state,'RESET_CHECKLIST',{caseId:'APU_LOW_OIL_PRESSURE:APU'});
assert.equal(byId(r.view,'APU_LOW_OIL_PRESSURE:APU').completedCount,0);

// Aborted engine start: actual lever CUTOFF must be observed, not
// fabricated from a clicked checklist checkbox.
r=replay(init(),trainingScenarioActions('ABORTED_START_2'));
assert.equal(byId(r.view,'ABORTED_ENGINE_START:2').source.section,'7.1');
r=act(r.state,'OPEN_CHECKLIST',{caseId:'ABORTED_ENGINE_START:2'});
assert.throws(()=>act(r.state,'CONFIRM_CHECKLIST_STEP',{
 caseId:'ABORTED_ENGINE_START:2',stepId:'LEVER_CUTOFF'}),/Physical state/);
assert.throws(()=>act(r.state,'CONFIRM_CHECKLIST_STEP',{
 caseId:'ABORTED_ENGINE_START:2',stepId:'STARTER_BRANCH'}),/crew attestation/);
r=act(r.state,'CONFIRM_CHECKLIST_STEP',{
 caseId:'ABORTED_ENGINE_START:2',stepId:'STARTER_BRANCH',crewConfirmed:true});
assert.equal(r.view.checklists.audit[0].verification,'CREW_ATTESTED');
r=act(r.state,'SET_ENGINE_START_LEVER',{engine:2,value:'CUTOFF'});
assert.equal(byId(r.view,'ABORTED_ENGINE_START:2').status,'RESOLVED');
r=act(r.state,'CONFIRM_CHECKLIST_STEP',{
 caseId:'ABORTED_ENGINE_START:2',stepId:'LEVER_CUTOFF'});
assert.equal(byId(r.view,'ABORTED_ENGINE_START:2').completedCount,2);
assert.ok(!r.view.checklists.activeCaseIds.includes('ABORTED_ENGINE_START:2'));

// BLEED TRIP OFF remains active after fault input clears while latch remains;
// RESET with resolved condition clears it and checklist becomes RESOLVED.
r=replay(init(),trainingScenarioActions('BLEED_TRIP_1'));
r=act(r.state,'OPEN_CHECKLIST',{caseId:'BLEED_TRIP_OFF:1'});
assert.throws(()=>act(r.state,'CONFIRM_CHECKLIST_STEP',{
 caseId:'BLEED_TRIP_OFF:1',stepId:'TRIP_RESET',crewConfirmed:true}),/Physical state/);
r=act(r.state,'SET_BLEED_TRIP_CONDITION',{engine:1,value:false});
assert.ok(r.view.checklists.activeCaseIds.includes('BLEED_TRIP_OFF:1'));
r=act(r.state,'PUSH_BLEED_TRIP_RESET');
assert.equal(r.view.annunciation.lamps.BLEED_TRIP_1.logicalDemand,'OFF');
assert.equal(byId(r.view,'BLEED_TRIP_OFF:1').status,'RESOLVED');
r=act(r.state,'CONFIRM_CHECKLIST_STEP',{
 caseId:'BLEED_TRIP_OFF:1',stepId:'TRIP_RESET'});
assert.equal(r.view.checklists.audit[0].verification,'OBSERVED');

// Engine fire 1: no fabricated fire switch verification. Crew attestation
// never manipulates fuel shutoff or engine fire suppression on behalf of user.
r=replay(init(),trainingScenarioActions('ENGINE_FIRE_1'));
r=act(r.state,'OPEN_CHECKLIST',{caseId:'ENGINE_FIRE:1'});
assert.throws(()=>act(r.state,'CONFIRM_CHECKLIST_STEP',{
 caseId:'ENGINE_FIRE:1',stepId:'ENGINE_FIRE_SWITCH'}),/crew attestation/);
r=act(r.state,'CONFIRM_CHECKLIST_STEP',{
 caseId:'ENGINE_FIRE:1',stepId:'ENGINE_FIRE_SWITCH',crewConfirmed:true});
assert.equal(r.view.fireDetection.fireDetected,true);
assert.equal(r.view.propulsion.engines['1'].phase,'OFF');
assert.ok(r.view.annunciation.audio.activeKeys.includes('fireBell'));
// Two-minute starter elapsed threshold does NOT create a fault or checklist.
r=replay(init(),trainingScenarioActions('ABORTED_START_2'));
r=act(r.state,'SET_ENGINE_EGT_C',{engine:2,value:null});
r=act(r.state,'ADVANCE_SECONDS',{value:121});
assert.equal(r.view.propulsion.protection.engines['2'].startFault,null);
assert.ok(!r.view.checklists.activeCaseIds.includes('ABORTED_ENGINE_START:2'));
assert.throws(()=>trainingScenarioActions('INVALID'),TypeError);
assert.throws(()=>act(init(),'OPEN_CHECKLIST',{caseId:'ENGINE_FIRE:1'}),Error);
assert.throws(()=>act(init(),'OPEN_CHECKLIST',{caseId:'ENGINE_FIRE:2'}),TypeError);
console.log('ISN-08 QRH case routing, evidence/crew confirmation, source pages, fault replay and 2-min suppression PASS');
