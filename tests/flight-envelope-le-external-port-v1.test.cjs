'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const Ports=require('../engine/integrations/le-devices-external-ports-v1.js');
const read=file=>fs.readFileSync(path.resolve(__dirname,'../'+file),'utf8');
test('flight envelope forwards ground/autoslat transitions through authenticated LE iframe',()=>{
 const callbacks={},out=[],child={postMessage:(payload,origin)=>out.push({payload,origin})};
 const win={
  document:{getElementById:id=>id==='overheadFrame'?{contentWindow:child}:null},
  location:{origin:'https://trainer.test'},addEventListener:(key,fn)=>{(callbacks[key]??=[]).push(fn)},
  B737LEDevicesUnifiedLink:{getState:()=>({lever:5})}
 };
 vm.runInNewContext(read('panel-mosaic-lab/cockpit/flight-envelope-le-bridge-v1.js'),{window:win});
 const send=(type,detail)=>{for(const fn of callbacks[type]||[])fn({detail})};
 const received=fn=>{for(const f of callbacks.message||[])f({
  origin:'https://trainer.test',source:child,
  data:{type:'b737:cockpit-overhead',kind:'ready'}})};
 send('b737:flight-scenario-state',{schema:'B737_FLIGHT_SCENARIO_STATE_V1',
  airborne:true,autoSlatRequest:true});
 assert.equal(out.length,0,'Cannot write to child until it is ready');
 received();
 assert.equal(out.length,1);
 assert.equal(out[0].payload.action,'le-aircraft-dynamics');
 assert.equal(out[0].payload.snapshot.autoslatRequested,true);
 assert.equal(out[0].payload.snapshot.onGround,false);
 send('b737:flight-scenario-state',{schema:'B737_FLIGHT_SCENARIO_STATE_V1',
  airborne:true,autoSlatRequest:true});
 assert.equal(out.length,1,'Deduplicate identical flight envelope state');
 send('b737:flight-scenario-stopped');
 assert.equal(out.length,2);
 assert.equal(out.at(-1).payload.snapshot.onGround,true);
 assert.equal(out.at(-1).payload.snapshot.autoslatRequested,false);
});
test('LE external port controls frozen trainer through approved public interface, rejecting unauthorised origin',()=>{
 const listeners={},dispatched=[],parent={},trainer={
  dispatch:x=>{dispatched.push(JSON.parse(JSON.stringify(x)));return x;},
  setHydraulicPressure(){},setElectricalSnapshot(){}
 };
 const win={parent,location:{origin:'https://trainer.test'},
  console:{warn(){},error(){}},B737LEIntegrationPortsV1:Ports,
  B737LEDevicesTrainer:trainer,addEventListener:(key,fn)=>{(listeners[key]??=[]).push(fn)}};
 vm.runInNewContext(read('panel-mosaic-lab/le-devices/flight-envelope-integration-v1.js'),
  {window:win});
 const post=(origin,s,src=parent)=>{
  for(const fn of listeners.message||[])fn({origin,source:src,data:{
   type:'b737:cockpit-command',action:'le-aircraft-dynamics',
   source:'INSTRUCTOR_LOW_SPEED_ENVELOPE_NOT_AOA',snapshot:s}});
 };
 post('https://attacker.test',{onGround:false,autoslatRequested:true});
 assert.equal(dispatched.length,0);
 post('https://trainer.test',{onGround:false,autoslatRequested:true});
 assert.deepEqual(dispatched,[{type:'GROUND',value:false},{type:'AUTOSLAT',value:true}]);
 post('https://trainer.test',{onGround:false,autoslatRequested:true});
 assert.equal(dispatched.length,2,'Repeated state cannot spam physical owner');
 post('https://trainer.test',{onGround:true,autoslatRequested:true});
 assert.deepEqual(dispatched.slice(-2),[{type:'GROUND',value:true},{type:'AUTOSLAT',value:false}]);
});
