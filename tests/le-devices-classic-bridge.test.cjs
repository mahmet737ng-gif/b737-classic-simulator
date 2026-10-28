const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const engine=require('../engine/systems/le-devices-classic-v1.js');
const bridgePath=path.resolve(__dirname,'../panel-mosaic-lab/le-devices/trainer-bridge-v1.js');
function setup(){
 const events={},windows={},states={},power=[];
 const panel={
  setPower(value){power.push(value);return true;},
  setDevice(id,value){states[id]=value;return true;},
  setWindow(id,level,value){windows[id+'|'+level]=value;return true;}
 };
 const app={B737LEDevicesClassicV1:engine,B737LeadingEdgeDevices:panel,
  dispatchEvent(evt){for(const listener of events[evt.type]||[])listener(evt);},
  addEventListener(type,listener){(events[type]??=[]).push(listener);}};
 const CustomEvent=class{constructor(type,args){this.type=type;this.detail=args.detail;}};
 const sandbox={window:app,CustomEvent,parent:{},location:{origin:'https://sim.test'},console};
 vm.runInNewContext(fs.readFileSync(bridgePath,'utf8'),sandbox,{filename:bridgePath});
 return {trainer:app.B737LEDevicesTrainer,windows,states,power};
}
test('slat jam at EXT after FLAPS 5 -> 15 projects amber only into actual panel',()=>{
 const {trainer,windows,states}=setup();
 trainer.dispatch({type:'FLAP_LEVER',value:5});trainer.advance(10);
 assert.equal(states.SLAT_2,'EXT');
 assert.equal(windows['SLAT_2|EXT'],true);
 trainer.dispatch({type:'JAM',device:'SLAT_2',value:true});
 trainer.dispatch({type:'FLAP_LEVER',value:15});
 assert.equal(trainer.snapshot().position.SLAT_2,1);
 assert.equal(states.SLAT_2,'TRANSIT');
 assert.equal(windows['SLAT_2|TRANSIT'],true);
 assert.equal(windows['SLAT_2|EXT'],false);
 assert.equal(windows['SLAT_2|FULL_EXT'],false);
 trainer.advance(5);
 assert.equal(states.SLAT_2,'TRANSIT');
 assert.equal(windows['SLAT_2|TRANSIT'],true);
 assert.equal(windows['SLAT_2|EXT'],false);
 assert.equal(windows['SLAT_2|FULL_EXT'],false);
 for(const id of engine.SLATS.filter(id=>id!=='SLAT_2')){
  assert.equal(states[id],'FULL_EXT');
  assert.equal(windows[id+'|FULL_EXT'],true);
  assert.equal(windows[id+'|TRANSIT'],false);
 }
 assert.equal(trainer.snapshot().center.transit,true);
});
test('after releasing the jam, only that slat continues towards FULL EXT',()=>{
 const {trainer,windows,states}=setup();
 for(const cmd of [{type:'FLAP_LEVER',value:5},{type:'TICK',seconds:10},{type:'JAM',device:'SLAT_2',value:true},{type:'FLAP_LEVER',value:15},{type:'TICK',seconds:5}])
  trainer.dispatch(cmd);
 trainer.dispatch({type:'JAM',device:'SLAT_2',value:false});
 assert.equal(states.SLAT_2,'TRANSIT');
 trainer.advance(2);
 assert.equal(states.SLAT_2,'TRANSIT');
 assert.equal(windows['SLAT_2|EXT'],false);
 trainer.advance(3);
 assert.equal(states.SLAT_2,'FULL_EXT');
 assert.equal(windows['SLAT_2|TRANSIT'],false);
 assert.equal(windows['SLAT_2|FULL_EXT'],true);
 assert.equal(trainer.snapshot().center.transit,false);
});
test('power loss gates overhead independently from the center indications',()=>{
 const {trainer,windows,power}=setup();
 trainer.dispatch({type:'FLAP_LEVER',value:1});trainer.advance(10);
 assert.equal(windows['SLAT_2|EXT'],true);
 trainer.dispatch({type:'POWER',bus:'transfer1',value:false});
 assert.equal(power.at(-1),false);
 assert.equal(windows['SLAT_2|EXT'],false);
 assert.equal(trainer.snapshot().center.extended,true);
});
