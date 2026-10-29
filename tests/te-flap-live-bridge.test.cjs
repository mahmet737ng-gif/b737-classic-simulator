const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const classic=require('../engine/systems/le-devices-classic-v1.js');
const actuator=require('../engine/systems/te-flap-actuator-v1.js');
const bridge=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/le-devices/trainer-bridge-v1.js'),'utf8');
function setup(){
 const callbacks={},frames={},messages=[];
 let timer=null;
 const parent={postMessage:(msg)=>messages.push(msg)};
 const window={
  B737LEDevicesClassicV1:classic,
  B737TEFlapActuatorV1:actuator,
  B737LeadingEdgeDevices:{setPower(){},setDevice(id,v){frames[id]=v;},setWindow(){}},
  addEventListener:(name,fn)=>{(callbacks[name]??=[]).push(fn);},
  dispatchEvent:()=>{}
 };
 const CustomEvent=class{constructor(type,o){this.type=type;this.detail=o.detail;}};
 const interval=(cb,delay)=>{assert.equal(delay,200);timer=cb;return 1;};
 const sandbox={window,parent,location:{origin:'https://cockpit.test'},CustomEvent,
  console,setInterval:interval,clearInterval:()=>{timer=null;}};
 vm.runInNewContext(bridge,sandbox,{filename:'le-bridge'});
 const message=(command)=>callbacks.message.forEach(fn=>fn({
  origin:'https://cockpit.test',source:parent,
  data:{type:'b737:cockpit-command',action:'le-devices',
   originator:'physical-flap-lever',command}
 }));
 return {messages,frames,trainer:window.B737LEDevicesTrainer,
  message,ticks:n=>{for(let i=0;i<n;i++){const step=timer;if(!step)break;step();}},
  isRunning:()=>!!timer};
}
test('physical lever 0->1 moves actual TE smoothly over eleven seconds',()=>{
 const s=setup();
 s.message({type:'FLAP_LEVER',value:1});
 assert.equal(s.trainer.flapActuator().command,1);
 assert.equal(s.trainer.flapActuator().actual,0);
 s.ticks(50); // ten of eleven seconds
 assert.ok(Math.abs(s.trainer.flapActuator().actual-10/11)<.0002);
 assert.equal(s.frames.FLAP_1,'FULL_EXT','leading-edge flaps finish first-stage extension in about ten seconds');
 s.ticks(5);
 assert.ok(Math.abs(s.trainer.flapActuator().actual-1)<.0002);
 assert.equal(s.frames.FLAP_1,'FULL_EXT');
 const payload=s.messages.at(-1);
 assert.equal(payload.projection.teTarget,1);
 assert.ok(Math.abs(payload.projection.tePosition-1)<.0002);
});
test('lower pressure slows the same actuator without resetting its actual position',()=>{
 const s=setup();s.message({type:'FLAP_LEVER',value:1});
 s.ticks(25);assert.ok(Math.abs(s.trainer.flapActuator().actual-5/11)<.0002);
 s.trainer.setHydraulicPressure(1500);
 s.ticks(25);assert.ok(Math.abs(s.trainer.flapActuator().actual-7.5/11)<.0002);
 s.message({type:'HYDRAULIC',system:'B',value:false});
 s.ticks(3);
 assert.ok(Math.abs(s.trainer.flapActuator().actual-7.5/11)<.0002);
 s.message({type:'HYDRAULIC',system:'B',value:true});
 s.ticks(35);assert.ok(Math.abs(s.trainer.flapActuator().actual-1)<.0002);
});

test('Unified real lever UP -> 15 honors delayed sequential LE windows and forward lamps',()=>{
 const s=setup();
 s.message({type:'FLAP_LEVER',value:15});
 s.ticks(24); // t=4.8
 assert.equal(s.frames.FLAP_1,'RETRACTED');
 assert.equal(s.frames.SLAT_1,'RETRACTED');
 assert.equal(s.messages.at(-1).projection.center.transit,false);
 s.ticks(1); // t=5
 assert.equal(s.frames.FLAP_1,'TRANSIT');
 assert.equal(s.frames.SLAT_1,'RETRACTED');
 s.ticks(8); // t=6.6
 assert.equal(s.frames.FLAP_1,'FULL_EXT');
 assert.equal(s.frames.SLAT_1,'TRANSIT');
 s.ticks(7); // t=8
 assert.equal(s.frames.SLAT_1,'EXT');
 assert.equal(s.messages.at(-1).projection.center.transit,false);
 assert.equal(s.messages.at(-1).projection.center.extended,true);
 s.ticks(119); // t=31.8
 assert.equal(s.frames.SLAT_1,'EXT');
 s.ticks(1); // t=32 exactly, 24 s EXT hold complete
 assert.equal(s.frames.SLAT_1,'TRANSIT');
 assert.equal(s.messages.at(-1).projection.center.transit,true);
 s.ticks(8); // t=33.6, full after 1.5 s (200ms clock)
 assert.equal(s.frames.SLAT_1,'FULL_EXT');
 assert.equal(s.messages.at(-1).projection.center.transit,false);
 assert.equal(s.messages.at(-1).projection.center.extended,true);
 assert.ok(s.trainer.flapActuator().actual<15,'TE still advances on its independent time base');
});
