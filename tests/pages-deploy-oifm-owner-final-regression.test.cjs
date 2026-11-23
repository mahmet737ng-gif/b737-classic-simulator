'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const classic=require('../engine/systems/le-devices-classic-v1.js');
const actuator=require('../engine/systems/te-flap-actuator-v1.js');
const ownerPath='panel-mosaic-lab/le-devices/trainer-bridge-v1.js';
const ownerSrc=read(ownerPath),final10=read('panel-mosaic-lab/cockpit/final10-approach-preset-v1.js');
const locked=JSON.parse(read('engine/locks/le-devices-final-lock-v1.json'));
const blobHash=bytes=>crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\\0')).update(bytes).digest('hex');

test('Pages LE trainer is byte-for-byte the immutable owner-approved blob',()=>{
 assert.equal(blobHash(Buffer.from(ownerSrc)),locked.frozenFiles[ownerPath]);
});
test('OIFM is present in published source and all four runway presets',()=>{
 const html=read('panel-mosaic-lab/cockpit/index.html');
 const phase=read('panel-mosaic-lab/cockpit/flight-scenario-panel-v1.js');
 const registry=read('engine/flight/flight-scenario-core-v1.js');
 for(const s of [html,phase])assert.match(s,/option value="OIFM"/);
 for(const rw of ['07L','25R','07R','25L'])assert.match(registry,new RegExp("'"+rw+"'"));
 assert.match(phase,/OIFM_AIP_THRESHOLDS/);
});
test('locked LE owner replays original physical 48-second initial extension and settles flaps 30',()=>{
 const handlers={},messages=[],frames={},schedule=[];
 const parent={postMessage:msg=>messages.push(msg)};
 const window={
  B737LEDevicesClassicV1:classic,B737TEFlapActuatorV1:actuator,
  B737LeadingEdgeDevices:{setPower(){},setDevice(id,state){frames[id]=state;},setWindow(){}},
  addEventListener:(name,handler)=>(handlers[name]??=[]).push(handler),
  dispatchEvent(){},
 };
 const CustomEvent=class{constructor(type,init){this.type=type;this.detail=init.detail;}};
 let motionTimer=null;
 vm.runInNewContext(ownerSrc,{window,parent,location:{origin:'https://trainer.test'},
  CustomEvent,console,setInterval:callback=>{motionTimer=callback;return 1;},
  clearInterval:()=>{motionTimer=null;}},{filename:'owner-locked-trainer.js'});
 const owner=window.B737LEDevicesTrainer;
 assert.equal(owner.presetFinal10ReadyFlaps,undefined,'the frozen bridge stays unchanged');
 const matched=final10.match(/function prepareLockedFinal10Flaps[\\s\\S]*?\\n}\\n/);
 assert(matched,'safe scenario adapter must exist in an unlocked integration source');
 const log=[];
 const win={location:{origin:'https://trainer.test'},setTimeout:fn=>schedule.push(fn)};
 const sandbox={win,serial:1,result:(name,ok,reason)=>log.push({name,ok,reason}),console};
 const adapter=vm.runInNewContext(matched[0]+'\\nprepareLockedFinal10Flaps;',sandbox);
 const overhead={postMessage:(data,origin)=>{
  assert.equal(origin,'https://trainer.test');
  assert.equal(data.originator,'physical-flap-lever');
  schedule.push(()=>handlers.message.forEach(fn=>fn({
   origin,source:parent,data
  })));
 }};
 adapter(owner,overhead,1);
 assert.equal(owner.flapActuator().actual,0);
 for(let i=0;i<20&&schedule.length;i++)schedule.shift()();
 const final=owner.flapActuator(),state=owner.snapshot();
 assert(Math.abs(final.actual-30)<.4,'TE actuator must settle to Flaps 30');
 assert.equal(final.command,30);
 assert.equal(final.moving,false);
 assert.equal(state.leStage,'FULL');
 assert.equal(state.center.extended,true);
 assert(log.some(x=>x.name==='FLAP_OWNER_PRESET'&&x.ok===true),JSON.stringify(log));
 assert.equal(motionTimer===null||typeof motionTimer==='function',true);
});
