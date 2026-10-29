'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../engine/systems/tat-probe-v1.js');
const source=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/tat-probe-unified-v1.js'),'utf8');
function boot(trainingPreference='0'){
 const sent=[],listeners={},timers=[],storage=new Map();
 if(trainingPreference!==null)storage.set('b737.tat-probe.training-power.v1',trainingPreference);
 let onGround=true,main2=true,dc1=true,pressed=false;
 const sw={'pitot-a':'OFF'};
 const faces=['ON','OFF'].map(frame=>({dataset:{frame},active:false,classList:{toggle(name,active){if(name==='active')this.active=!!active;}}}));
 const lamp={dataset:{},faces,querySelectorAll(sel){return sel==='.light-face'?faces:[];},
 setAttribute(name,value){this[name]=value;}};
 const frameWindow={B737OverheadToggles:{getState:()=>({...sw})},
  B737OverheadLights:{getState:()=>({lampTest:false})},
  addEventListener(type,callback){this['on_'+type]=callback;},
  postMessage(message){sent.push(message);}};
 const frame={contentWindow:frameWindow,contentDocument:{
  documentElement:{classList:{contains:()=>false}},
  querySelector(sel){return sel.includes('probe-temp')?lamp:null;}},
  addEventListener(type,cb){this['on_'+type]=cb;}};
 const el={id:'overheadFrame',...frame};
 const document={readyState:'complete',
  getElementById(id){return id==='overheadFrame'?el:null;}};
 const window={B737TATProbeV1:core,
  B737ISNCockpitV1:{getStartState:()=>({electrical:{main2,dc1},runningEnvelope:{onGround}})},
  addEventListener(type,cb){listeners[type]=cb;}};
 const location={origin:'https://test.example'};
 const ctx={window,document,localStorage:{getItem:key=>storage.get(key)||null,setItem:(k,v)=>storage.set(k,v)},
  location,console,setInterval:fn=>{timers.push(fn);return 1;}};
 vm.runInNewContext(source,ctx,{filename:'tat-probe-unified-v1.js'});
 const api=window.B737TATProbeUnifiedV1;
 return {api,faces,sent,lamp,storage,listeners,timers,sw,
  setMain2:v=>{main2=v;api.evaluate();},setDC1:v=>{dc1=v;api.evaluate();},setGround:v=>{onGround=v;api.evaluate();},
  setSwitch:value=>{sw['pitot-a']=value;api.evaluate();},
  button(value,override={}){
   listeners.message({origin:override.origin||location.origin,
    source:override.source||frameWindow,
    data:{type:'b737:cockpit-overhead',kind:'recessed-button',id:'pitot-static-tat-test',pressed:value}});
  }
 };
}
test('Unified TAT bridge emits TEMP PROBE ON lamp when test released',()=>{
 const h=boot();assert.equal(h.api.getOutput().amberOn,true);
 assert.equal(h.lamp.dataset.frame,'ON');
 assert.ok(h.sent.some(x=>x.action==='tat-probe-projection'&&x.lamps['probe-temp']===true));
});
test('Existing OH15 recessed PRESS turns heater on and TEMP PROBE amber OFF, RELEASE restores amber',()=>{
 const h=boot();h.button(true);
 assert.equal(h.api.getOutput().heaterPower,true);
 assert.equal(h.api.getOutput().amberOn,false);
 assert.equal(h.lamp.dataset.frame,'OFF');
 h.button(false);
 assert.equal(h.api.getOutput().amberOn,true);
 assert.equal(h.lamp.dataset.frame,'ON');
});
test('CB Panel Lab P18-3 C5 pull blocks TAT TEST and push restores it',()=>{
 const h=boot();h.button(true);
 h.storage.set('b737classic.cb.v1',JSON.stringify({breakers:[{id:core.CB_ID,pulled:true}]}));
 h.api.evaluate();assert.equal(h.api.getOutput().heaterPower,false);assert.equal(h.api.getOutput().amberOn,true);
 h.storage.set('b737classic.cb.v1',JSON.stringify({breakers:[{id:core.CB_ID,pulled:false}]}));
 h.api.evaluate();assert.equal(h.api.getOutput().amberOn,false);
});
test('Real MAIN2 bus shutdown prevents ground TAT test, instructor power is opt-in',()=>{
 const h=boot();h.button(true);h.setMain2(false);
 assert.equal(h.api.getOutput().heaterPower,false);
 h.api.setTrainingPower(true);
 assert.equal(h.api.getOutput().heaterPower,true);
 h.api.setTrainingPower(false);
 assert.equal(h.api.getOutput().heaterPower,false);
});
test('Instructor failure injection is reflected in existing TEMP PROBE annunciator',()=>{
 const h=boot();h.button(true);assert.equal(h.api.getOutput().amberOn,false);
 h.api.injectFault('CURRENT_SENSE_FAIL',true);
 assert.equal(h.api.getOutput().amberOn,true);
 h.api.injectFault('CURRENT_SENSE_FAIL',false);
 assert.equal(h.api.getOutput().amberOn,false);
});
test('Foreign iframe messages cannot manipulate live TAT button',()=>{
 const h=boot();h.button(true,{origin:'https://foreign.example'});
 assert.equal(h.api.getOutput().testPressed,false);
 h.button(true,{source:{}});
 assert.equal(h.api.getOutput().testPressed,false);
});
test('Air/ground gating matches TAT TEST on-ground only',()=>{
 const h=boot();h.setGround(false);h.button(true);
 assert.equal(h.api.getOutput().heaterPower,false);
 h.setSwitch('ON');
 assert.equal(h.api.getOutput().heaterPower,true);
});

test('Screenshot regression: on GROUND, changing PITOT HEAT A OFF to ON extinguishes TEMP PROBE without heating TAT',()=>{
 const h=boot();
 assert.equal(h.api.getOutput().amberOn,true,'ground A OFF -> TEMP PROBE amber');
 h.setSwitch('ON');
 assert.equal(h.api.getOutput().amberOn,false,'ground A ON -> TEMP PROBE dark');
 assert.equal(h.api.getOutput().heaterPower,false,'TAT heater inhibited on the ground');
 assert.equal(h.api.getOutput().groundIndicationBypass,true);
 h.setSwitch('OFF');
 assert.equal(h.api.getOutput().amberOn,true,'A OFF returns indicator amber');
});
test('With A ON, TAT TEST must still test actual current and reveal a pulled heater CB',()=>{
 const h=boot();h.setSwitch('ON');h.button(true);
 assert.equal(h.api.getOutput().heaterPower,true);
 assert.equal(h.api.getOutput().amberOn,false);
 h.storage.set('b737classic.cb.v1',JSON.stringify({breakers:[{id:core.CB_ID,pulled:true}]}));
 h.api.evaluate();
 assert.equal(h.api.getOutput().amberOn,true,'during test, current failure overrides A-ON bypass');
 h.button(false);
 assert.equal(h.api.getOutput().amberOn,false,'ground A-ON bypass restored after test release');
});
test('Isolated training TAT feed defaults ON in a cold-dark Unified cockpit, without aircraft electrical changes',()=>{
 const h=boot(null);
 h.setMain2(false);h.setDC1(false);
 assert.equal(h.api.getOutput().trainingPower,true);
 assert.equal(h.api.getOutput().lampPower,true);
 assert.equal(h.api.getOutput().amberOn,true,'ground A OFF -> amber in classroom mode');
 h.button(true);
 assert.equal(h.api.getOutput().heaterPower,true);
 assert.equal(h.api.getOutput().amberOn,false,'ground TAT press succeeds in classroom mode');
 h.api.setTrainingPower(false);
 assert.equal(h.api.getOutput().heaterPower,false);
 assert.equal(h.api.getOutput().amberOn,false,'unpowered real DC indicator must stay dark');
});
test('Real-mode unpowered DC1 keeps the TEMP PROBE annunciator dark even while heater demand fails',()=>{
 const h=boot();
 h.setDC1(false);h.setMain2(false);
 assert.equal(h.api.getOutput().lampPower,false);
 assert.equal(h.lamp.dataset.frame,'OFF');
 assert.equal(h.api.getOutput().amberDemand,true);
});
