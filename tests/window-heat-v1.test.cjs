'use strict';
// Node test: generic Window Heat core and physically named Classic CB compatibility.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const WH=require('../engine/systems/window-heat-v1.js');
const catalogText=fs.readFileSync(path.join(__dirname,'../cb-panel-lab/catalog.js'),'utf8');
const ctx={window:{}};vm.runInNewContext(catalogText,ctx);
const defs=ctx.window.CB_CATALOG.panels;
const breaker=(key)=>{
 const [panel,,position]=key.split('|'),p=defs.find(x=>x.id===panel);if(!p)return null;
 const found=String(p.breakers).split(';').map(t=>t.trim().split('|')).find(a=>a[0]?.split(':')[0]===position);
 return found?{label:found[1]}:null;
};
const bus=()=>Object.fromEntries(['generator1','generator2','main1','main2','dc1','dc2'].map(k=>[k,true]));
const sw=()=>Object.fromEntries(Object.values(WH.CHANNELS).map(x=>[x.switchId,'ON']));
const run=(s=WH.initialState(),input={},dt=1)=>WH.step(s,{switches:sw(),buses:bus(),...input},dt);
test('all ten CB positions exist and eight photo-derived names match',()=>{
 assert.equal(WH.ALL_CBS.length,10);
 for(const cb of WH.ALL_CBS)assert.ok(breaker(cb),'CB missing '+cb);
 for(const [id,label] of Object.entries(WH.PHOTO_CB))assert.equal(breaker(id).label,label,id);
});
test('cold-and-dark and four powered channels',()=>{
 const off=run(undefined,{buses:{}}).output;assert.ok(Object.values(off.channels).every(x=>!x.greenOn&&!x.heaterPower));
 const on=run().output;assert.ok(Object.values(on.channels).every(x=>x.greenOn&&x.heaterPower));
});
test('each heater breaker isolates its channel only',()=>{
 for(const [id,c] of Object.entries(WH.CHANNELS)){
  const out=run(undefined,{breakers:{[c.heaterCB]:false}}).output;
  assert.equal(out.channels[id].greenOn,false,id);
  for(const key of Object.keys(WH.CHANNELS))if(key!==id)assert.equal(out.channels[key].greenOn,true,key);
 }
});
test('each controller breaker isolates its channel only',()=>{
 for(const [id,c] of Object.entries(WH.CHANNELS)){
  const out=run(undefined,{breakers:{[c.controllerCB]:false}}).output;
  assert.equal(out.channels[id].controllerPower,false,id);
  for(const key of Object.keys(WH.CHANNELS))if(key!==id)assert.equal(out.channels[key].controllerPower,true,key);
 }
});
test('Generator 1, Generator 2, and DC 2 produce indexed failures',()=>{
 const g1=run(undefined,{buses:{...bus(),generator1:false}}).output;
 assert.equal(g1.channels.L_FWD.heaterPower,false);assert.equal(g1.channels.R_SIDE.heaterPower,false);
 assert.equal(g1.channels.L_SIDE.heaterPower,true);assert.equal(g1.aux.L45.heaterPower,false);
 const g2=run(undefined,{buses:{...bus(),generator2:false}}).output;
 assert.equal(g2.channels.R_FWD.heaterPower,false);assert.equal(g2.channels.L_SIDE.heaterPower,false);
 assert.equal(g2.aux.R45.heaterPower,false);
 const dc=run(undefined,{buses:{...bus(),dc2:false}}).output;
 assert.equal(dc.channels.L_SIDE.controllerPower,false);assert.equal(dc.channels.R_FWD.controllerPower,false);
});
test('Power test bypasses normal target but not power/CB/OVHT fault',()=>{
 const s=WH.initialState();s.channels.L_FWD.temp=40;
 assert.equal(run(s).output.channels.L_FWD.greenOn,false);
 assert.equal(run(s,{switches:{...sw(),'window-power-test':'PWR TEST'}}).output.channels.L_FWD.greenOn,true);
 assert.equal(run(s,{switches:{...sw(),'window-power-test':'PWR TEST'},breakers:{'P6-11|ALL|B9':false}}).output.channels.L_FWD.greenOn,false);
});
test('OVHT warning, 60-second indication, reset OFF→ON',()=>{
 let r=run(undefined,{switches:{...sw(),'window-power-test':'OVHT'}},0);
 assert.equal(r.output.annunciations.antiIceCaution,true);
 assert.equal(r.output.channels.L_FWD.overheatOn,true);
 r=run(r.state,{},61);
 assert.ok(Object.values(r.output.channels).every(x=>x.overheatOn&&!x.greenOn));
 r=run(r.state,{switches:{...sw(),'window-l-fwd':'OFF'}},0);
 r=run(r.state,{},1);
 assert.equal(r.output.channels.L_FWD.overheatOn,false);
 assert.equal(r.output.channels.L_SIDE.overheatOn,true);
});
test('Instructor heater, sensor and power-test failures',()=>{
 for(const fault of ['HEATER_FAIL','SENSOR_FAIL']){
  const q=WH.injectFault(WH.initialState(),'L_FWD',fault,true);
  assert.equal(run(q).output.channels.L_FWD.greenOn,false);
 }
 const s=WH.initialState();s.channels.L_FWD.temp=40;
 const q=WH.injectFault(s,'L_FWD','POWER_TEST_FAIL',true);
 assert.equal(run(q,{switches:{...sw(),'window-power-test':'PWR TEST'}}).output.channels.L_FWD.greenOn,false);
});
test('the two 4/5 CBs remain separate from forward windows',()=>{
 const a=run(undefined,{breakers:{'P6-11|ALL|B7':false}}).output;
 assert.equal(a.aux.L45.heaterPower,false);assert.equal(a.channels.L_FWD.greenOn,true);
 const b=run(undefined,{breakers:{'P6-12|ALL|B7':false}}).output;
 assert.equal(b.aux.R45.heaterPower,false);assert.equal(b.channels.R_FWD.greenOn,true);
});
