'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const E=require('../../engine/efis/classic-speed-tape-engine-v1.js');
const R=require('./eadi-speed-tape-v1.js');
const Trainer=require('./speed-tape-unified-training-v1.js');
const Flap=require('../../engine/efis/classic-flap-speed-profile-v1.js');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
assert.match(html,/eadi-speed-tape-v1\.js\?v=EADI-SPEED-TAPE-UNIFIED-0006/);
assert.match(html,/speed-tape-unified-training-v1\.js\?v=SPEED-TAPE-TRAINING-0003/);
let s=E.initialState('CAPT');
s=E.transition(s,{type:'TRAINING_CAS',origin:'TRAINING_SCENARIO',casKt:180,timeMs:1000});
assert.equal(E.view(s).casKt,180);
assert.equal(E.view(s).provenance,'TRAINING_SCENARIO');
assert.equal(E.view(s).quality,'TRAINING');
assert.throws(()=>E.transition(s,{type:'TRAINING_CAS',origin:'SIMULATOR_TELEMETRY',casKt:180,timeMs:1200}),/TRAINING_SOURCE_REQUIRED/);
s=E.transition(s,{type:'ADC',valid:true,casKt:185,timeMs:900});
assert.equal(E.view(s).quality,'VALID','real ADC must replace the training source');
assert.equal(E.view(s).provenance,'SIMULATOR_ADC');
s=E.transition(s,{type:'TRAINING_CLEAR'});
assert.equal(E.view(s).casKt,185,'clearing a trainer never blanks a real ADC');
const lines=[];
const ctx=new Proxy({}, {get:(o,k)=>k in o?o[k]:(...a)=>{if(k==='fillText')lines.push(String(a[0]));},set:(o,k,v)=>{o[k]=v;return true}});
const training=E.transition(E.initialState('CAPT'),{type:'TRAINING_CAS',origin:'TRAINING_SCENARIO',casKt:190,timeMs:1200});
R.draw(ctx,E.view(training));
assert.ok(lines.includes('TRN'),'Training provenance must remain visible on EADI glass');
const listeners={},documentListeners={};
const state={CAPT:E.initialState('CAPT'),FO:E.initialState('FO')};
let adcSignal={quality:'UNKNOWN',value:null};
const root={
 B737ClassicFlapSpeedProfileV1:Flap,
 B737UnifiedSpeedTapeV1:{observe(seat,e){state[seat]=E.transition(state[seat],e);return E.view(state[seat]);},getState(seat){return state[seat]}},
 B737UnifiedAvionicsNetworkV1:{getSignal(topic){
  if(topic==='flightcontext.state')return {quality:'VALID',origin:'TRAINING_SCENARIO',
   value:{iasKt:180,pressureAltitudeFt:5000}};
  return adcSignal;
 }},
 addEventListener(type,cb){(listeners[type]||=[]).push(cb)},
 document:{readyState:'loading',addEventListener(type,cb){
  (documentListeners[type]||=[]).push(cb);
 }}
};
assert.equal(Trainer.bind(root),true);
assert.equal(state.CAPT.adc.quality,'TRAINING');
assert.equal(state.FO.adc.quality,'TRAINING');
assert.equal((documentListeners['b737:flap-detent-visual-test']||[]).length,1,
 'non-bubbling pedestal event must be observed on document');
assert.equal((listeners['b737:flap-detent-visual-test']||[]).length,0);
documentListeners['b737:flap-detent-visual-test'][0]({detail:{visualOnly:true,detent:30}});
for(const seat of ['CAPT','FO']){
 assert.equal(E.view(state[seat]).marks.trainingFlapLimit.maximumKt,180);
 assert.equal(E.view(state[seat]).marks.flapBuffer.lowerKt,155);
 assert.equal(E.view(state[seat]).marks.maximumOperatingKt,null,
  'visual-only flap selection cannot create certified speed limit');
}
assert.equal(Trainer.snapshot().lastVisualFlapDetent,30);
Trainer.setFlap30MaximumKt(185);
assert.equal(E.view(state.FO).marks.flapBuffer.lowerKt,160);
Trainer.setFlap30MaximumKt(180);
documentListeners['b737:flap-detent-visual-test'][0]({detail:{visualOnly:true,detent:40}});
assert.equal(E.view(state.CAPT).marks.trainingFlapLimit.maximumKt,158);
assert.equal(E.view(state.CAPT).marks.flapBuffer.bufferKt,0);
documentListeners['b737:flap-detent-visual-test'][0]({detail:{visualOnly:true,detent:0}});
assert.equal(E.view(state.CAPT).marks.trainingFlapLimit,null);

Trainer.setIAS(230);
assert.equal(E.view(state.CAPT).casKt,230);
Trainer.setEnabled(false);
assert.equal(E.view(state.CAPT).casKt,null);
Trainer.setEnabled(true);
adcSignal={quality:'VALID',origin:'SIMULATOR_TELEMETRY',value:{casKt:245,sensorValid:true}};
Trainer.sync();
assert.equal(Trainer.snapshot().realAdcSeen.CAPT,true);
assert.equal(Trainer.snapshot().realAdcSeen.FO,true);
assert.equal(E.view(state.CAPT).casKt,230,'trainer cannot silently overwrite real source; actual ADC adapter owns switchover');
assert.equal(Trainer.snapshot().sourceLabel,'TRAINING_SCENARIO_NOT_ADC');
console.log('PASS — Unified Speed Tape has separate visibly labelled trainer, real ADC priority, independent seats and main glass integration');
