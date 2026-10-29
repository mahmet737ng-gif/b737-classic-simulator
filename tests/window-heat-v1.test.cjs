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
test('OVHT test clears after 60 seconds; individual OFF cancels its channel immediately',()=>{
 let r=run(undefined,{switches:{...sw(),'window-power-test':'OVHT'}},0);
 assert.equal(r.output.annunciations.antiIceCaution,true);
 assert.ok(Object.values(r.output.channels).every(x=>x.overheatOn&&x.greenOn));
 r=run(r.state,{},59);
 assert.ok(Object.values(r.output.channels).every(x=>x.overheatOn&&x.greenOn));
 r=run(r.state,{},1);
 assert.ok(Object.values(r.output.channels).every(x=>!x.overheatOn&&x.greenOn));
 assert.equal(r.output.annunciations.antiIceCaution,false);
 r=run(r.state,{switches:{...sw(),'window-power-test':'OVHT'}},0);
 r=run(r.state,{switches:{...sw(),'window-power-test':'OFF','window-l-fwd':'OFF'}},0);
 assert.equal(r.output.channels.L_FWD.overheatOn,false);
 r=run(r.state,{switches:{...sw(),'window-l-fwd':'ON'}},0);
 assert.equal(r.output.channels.L_FWD.overheatOn,false,'ON must not re-trigger a test');
 assert.ok(Object.entries(r.output.channels).filter(([id])=>id!=='L_FWD').every(([,x])=>x.overheatOn),'other channels keep their test');
});
test('Power/controller/CB loss does not falsely light OVERHEAT',()=>{
 const r=run(undefined,{breakers:{'P6-11|ALL|B9':false}},0);
 assert.equal(r.output.channels.L_FWD.greenOn,false);
 assert.equal(r.output.channels.L_FWD.overheatOn,false);
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

test('PWR TEST illuminates every healthy green ON lamp with all window switches OFF',()=>{
 const allOff=Object.fromEntries(Object.values(WH.CHANNELS).map(c=>[c.switchId,'OFF']));
 const r=run(undefined,{switches:{...allOff,'window-power-test':'PWR TEST'}},0).output;
 assert.ok(Object.values(r.channels).every(x=>x.greenOn),'all four healthy ON lamps must illuminate');
 assert.ok(Object.values(r.channels).every(x=>!x.selected),'PWR TEST must not turn the window switches ON');
 assert.ok(Object.values(r.channels).every(x=>!x.heaterPower),'PWR TEST must not energize heaters whose switches are OFF');
 assert.ok(Object.values(r.channels).every(x=>!x.overheatOn),'PWR TEST must not trigger OVERHEAT');
});
test('PWR TEST leaves failed channels dark while healthy channels illuminate',()=>{
 const allOff=Object.fromEntries(Object.values(WH.CHANNELS).map(c=>[c.switchId,'OFF']));
 const switches={...allOff,'window-power-test':'PWR TEST'};
 const breaks={'P6-11|ALL|B9':false};
 const r=run(undefined,{switches,breakers:breaks},0).output;
 assert.equal(r.channels.L_FWD.greenOn,false,'open heater CB must fail its ON lamp test');
 assert.ok(Object.entries(r.channels).filter(([id])=>id!=='L_FWD').every(([,x])=>x.greenOn));
 let failed=WH.injectFault(WH.initialState(),'R_SIDE','POWER_TEST_FAIL',true);
 const q=run(failed,{switches},0).output;
 assert.equal(q.channels.R_SIDE.greenOn,false,'failed power-test circuit stays dark');
 assert.ok(Object.entries(q.channels).filter(([id])=>id!=='R_SIDE').every(([,x])=>x.greenOn));
});
test('Every lost electrical bus extinguishes BOTH green ON and amber OVERHEAT on only affected channels',()=>{
 for(const busKey of Object.keys(bus())){
  const active=run(undefined,{switches:{...sw(),'window-power-test':'OVHT'}},0);
  const outage=run(active.state,{buses:{...bus(),[busKey]:false}},1).output;
  for(const [id,c] of Object.entries(WH.CHANNELS)){
   const affected=[c.controllerAC,c.controllerDC,c.heaterBus].includes(busKey);
   assert.equal(outage.channels[id].indicationPowered,!affected,id+' '+busKey+' indication');
   assert.equal(outage.channels[id].overheatOn,!affected,id+' '+busKey+' OVERHEAT');
   assert.equal(outage.channels[id].greenOn,!affected,id+' '+busKey+' green ON');
   if(affected)assert.equal(outage.channels[id].heaterPower,false,id+' '+busKey+' heat');
  }
 }
});
test('Each heater and controller CB pull cancels that channel OVERHEAT test, not the other three',()=>{
 for(const [id,c] of Object.entries(WH.CHANNELS))for(const breakerId of [c.heaterCB,c.controllerCB]){
  const testRunning=run(undefined,{switches:{...sw(),'window-power-test':'OVHT'}},0);
  const pulled=run(testRunning.state,{breakers:{[breakerId]:false}},1).output;
  assert.equal(pulled.channels[id].indicationPowered,false,id+' '+breakerId);
  assert.equal(pulled.channels[id].greenOn,false,id+' '+breakerId);
  assert.equal(pulled.channels[id].overheatOn,false,id+' '+breakerId);
  for(const other of Object.keys(WH.CHANNELS).filter(key=>key!==id))
   assert.equal(pulled.channels[other].overheatOn,true,other+' must keep its test');
 }
});
test('Returning power does not relight an abandoned OVHT test or invent new OVERHEAT',()=>{
 let r=run(undefined,{switches:{...sw(),'window-power-test':'OVHT'}},0);
 assert.equal(r.output.channels.L_FWD.overheatOn,true);
 r=run(r.state,{buses:{...bus(),main1:false}},10);
 assert.equal(r.output.channels.L_FWD.overheatOn,false);
 assert.equal(r.state.channels.L_FWD.ovhtTestLatched,false);
 assert.equal(r.output.channels.L_SIDE.overheatOn,true);
 r=run(r.state,{buses:bus()},1);
 assert.equal(r.output.channels.L_FWD.overheatOn,false);
 assert.equal(r.output.channels.R_SIDE.overheatOn,false);
 assert.equal(r.output.channels.L_FWD.greenOn,true);
 assert.equal(r.output.channels.L_SIDE.overheatOn,true);
});
test('True thermal overheat is retained unlit while unpowered and reappears only when power is restored',()=>{
 const initial=WH.initialState();
 initial.channels.L_FWD.temp=65;
 let r=run(initial,{},0);
 assert.equal(r.output.channels.L_FWD.overheatOn,true);
 assert.equal(r.output.channels.L_FWD.heaterPower,false);
 r=run(r.state,{buses:{...bus(),main1:false}},1);
 assert.equal(r.output.channels.L_FWD.overheatOn,false);
 assert.equal(r.state.channels.L_FWD.overheat,true,'actual hot temperature state remains');
 r=run(r.state,{buses:bus()},1);
 assert.equal(r.output.channels.L_FWD.overheatOn,true,'true thermal condition may illuminate only when supplied');
});
test('A stuck-overheat training fault never illuminates an electrically dead annunciator',()=>{
 const fault=WH.injectFault(WH.initialState(),'R_FWD','STUCK_OVERHEAT',true);
 let r=run(fault,{},0);
 assert.equal(r.output.channels.R_FWD.overheatOn,true);
 r=run(r.state,{breakers:{[WH.CHANNELS.R_FWD.controllerCB]:false}},0);
 assert.equal(r.output.channels.R_FWD.overheatOn,false);
 assert.equal(r.output.channels.R_FWD.greenOn,false);
});
