'use strict';
// EFIS FULL ALIGN must be the *actual initial condition*, not just a lit UI
// button. The crew can still choose COLD & DARK or AIRCRAFT after startup.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,
 '../panel-mosaic-lab/cockpit/efis-training-presets-v1.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,
 '../panel-mosaic-lab/cockpit/index.html'),'utf8');

function harness({blocked=null,readyState='interactive'}={}){
 const callbacks=new Map();
 const buttons=['FULL_ALIGN','COLD_DARK','LIVE'].map(preset=>({
  dataset:{efisPreset:preset},attributes:{},
  addEventListener(type,cb){this.onclick=type==='click'?cb:null;},
  setAttribute(key,val){this.attributes[key]=val;},
  getAttribute(key){return this.attributes[key];}
 }));
 const status={textContent:''};
 const doc={
  readyState,
  getElementById(key){return key==='unifiedEfisPresetStatus'?status:null;},
  querySelectorAll(selector){return selector==='[data-efis-preset]'?buttons:[];},
  addEventListener(type,fn){callbacks.set(type,fn);}
 };
 const data={units:{L:{mode:'OFF',positionValid:false},R:{mode:'OFF',positionValid:false}},motionSource:null};
 let power='AIRCRAFT',preset='LIVE',positionCalls=0;
 const irs={
  getState(){return structuredClone(data);},
  setPowerMode(mode){power=mode;},
  setMode(side,mode){data.units[side].mode=mode;if(mode==='OFF')data.units[side].positionValid=false;},
  setFmcPosition(_pos,_reference){
   positionCalls++;
   for(const side of ['L','R'])data.units[side].positionValid=true;
  },
  setBenchMotion(sample){data.motionSource='BENCH_SIM';data.motion=sample;},
  stopMotion(){data.motionSource=null;data.motion=null;}
 };
 const sources={
  getPreset(){return preset;},
  setPreset(p){preset=p;}
 };
 const root={document:doc,B737IRSTrainerUnified:irs,
  B737IRSTrainerCoreV1:{
   parseFmcPosition(text){return text;},
   trainingAlignmentReference(position,heading){return {position,heading};}
  },B737UnifiedEfisSources:sources,
  B737UnifiedCB:{irsPower(side){return side!==blocked;}}
 };
 const sandbox=vm.createContext(root);
 vm.runInContext(source,sandbox,{filename:'efis-training-presets-v1.js'});
 return {root,buttons,status,irs,boot:()=>callbacks.get('DOMContentLoaded')?.(),
  snapshot:()=>({preset,power,positionCalls,state:structuredClone(data)}),
  click:(preset)=>buttons.find(b=>b.dataset.efisPreset===preset).onclick()};
}

test('Unified initial control and asset revision declare FULL ALIGN',()=>{
 assert.match(html,/data-efis-preset="FULL_ALIGN" aria-pressed="true"/);
 assert.match(html,/data-efis-preset="LIVE" aria-pressed="false"/);
 assert.match(html,/efis-training-presets-v1\.js\?v=EFIS-PRESETS-DEFAULT-FULL-0002/);
});

test('DOMContentLoaded automatically aligns BOTH IRS without a pilot click',()=>{
 const h=harness();
 assert.equal(h.snapshot().preset,'LIVE','Do not fake state before real initialization');
 h.boot();
 const state=h.snapshot();
 assert.equal(state.preset,'FULL_ALIGN');
 assert.equal(state.power,'BENCH');
 assert.equal(state.positionCalls,1,'One common FMC position applies to both IRS');
 assert.equal(state.state.units.L.mode,'NAV');
 assert.equal(state.state.units.R.mode,'NAV');
 assert.equal(state.state.units.L.positionValid,true);
 assert.equal(state.state.units.R.positionValid,true);
 assert.equal(state.state.motionSource,'BENCH_SIM');
 assert.equal(h.buttons[0].getAttribute('aria-pressed'),'true');
 assert.equal(h.buttons[1].getAttribute('aria-pressed'),'false');
 assert.equal(h.buttons[2].getAttribute('aria-pressed'),'false');
 assert.match(h.status.textContent,/IRS L\/R aligned/);
 h.click('COLD_DARK');
 assert.equal(h.snapshot().preset,'COLD_DARK');
 assert.equal(h.snapshot().power,'AIRCRAFT');
 assert.equal(h.snapshot().state.units.L.mode,'OFF');
 assert.equal(h.snapshot().state.units.R.mode,'OFF');
 assert.equal(h.buttons[1].getAttribute('aria-pressed'),'true');
 h.click('FULL_ALIGN');
 assert.equal(h.snapshot().preset,'FULL_ALIGN');
 assert.equal(h.snapshot().state.units.L.positionValid,true);
 h.click('LIVE');
 assert.equal(h.snapshot().preset,'LIVE');
 assert.equal(h.snapshot().power,'AIRCRAFT');
 assert.equal(h.buttons[2].getAttribute('aria-pressed'),'true');
});

test('Manual selection before bootstrap is never overwritten',()=>{
 const h=harness();
 h.click('COLD_DARK');h.boot();
 assert.equal(h.snapshot().preset,'COLD_DARK');
 assert.equal(h.snapshot().positionCalls,0);
});

test('An unavailable IRS feed blocks auto alignment rather than inventing NAV validity',()=>{
 const h=harness({blocked:'R'});
 h.boot();
 assert.notEqual(h.snapshot().preset,'FULL_ALIGN');
 assert.equal(h.snapshot().state.units.L.positionValid,false);
 assert.equal(h.snapshot().state.units.R.positionValid,false);
 assert.match(h.status.textContent,/FULL ALIGN NOT READY.*IRS R/);
});

test('Complete document loads may initialize immediately',()=>{
 const h=harness({readyState:'complete'});
 const state=h.snapshot();
 assert.equal(state.preset,'FULL_ALIGN');
 assert.equal(state.state.units.L.positionValid,true);
 assert.equal(state.state.units.R.positionValid,true);
});
