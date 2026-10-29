const test=require('node:test'),assert=require('node:assert/strict');
const LE=require('../engine/systems/le-devices-classic-v1.js');
const TE=require('../engine/systems/te-flap-actuator-v1.js');
// Owner's 2026-10-29 full-retract to FLAPS 15 sequence:
// 0-5s no LE movement; 5-6.5 LE flap transit;
// 6.5-8 SLAT transit to EXT; 8-32 hold EXT for 24s;
// 32-33.5 SLAT transit to FULL EXT.
function rig(command=15){
 let te=TE.apply(TE.initialState(),{type:'COMMAND',value:command});
 let le=LE.apply(LE.initialState(),{type:'START_LE_SEQUENCE'});
 le=LE.apply(le,{type:'FOLLOW_TE',position:0,command});
 let time=0;
 const advance=dt=>{
  te=TE.apply(te,{type:'TICK',seconds:dt});
  le=LE.apply(le,{type:'FOLLOW_TE',position:te.actual,command:te.command});
  le=LE.apply(le,{type:'TICK',seconds:dt,motionProfile:'TIMED',pressureFactor:1});
  time+=dt;
  return LE.evaluate(le);
 };
 return {advance,latest:()=>LE.evaluate(le),time:()=>time,actual:()=>te.actual,
   jam:id=>{le=LE.apply(le,{type:'JAM',device:id,value:true});}};
}
const lamp=(p,id,level)=>p.overhead.windows[id+'|'+level];
test('nominal UP to 15: initial LE deployment exactly matches sequential timing',()=>{
 const r=rig();
 let p=r.latest();
 assert.equal(p.leStage,'RETRACTED');
 for(const id of LE.DEVICES)assert.equal(p.indication[id],'RETRACTED');
 p=r.advance(4.999);
 for(const id of LE.DEVICES){
  assert.equal(p.indication[id],'RETRACTED');
  assert.equal(lamp(p,id,'TRANSIT'),false);
 }
 assert.equal(p.center.transit,false);assert.equal(p.center.extended,false);
 p=r.advance(.001);
 for(const id of LE.FLAPS)assert.equal(lamp(p,id,'TRANSIT'),true);
 for(const id of LE.SLATS)assert.equal(lamp(p,id,'TRANSIT'),false);
 p=r.advance(.75);
 for(const id of LE.FLAPS){
  assert.equal(lamp(p,id,'TRANSIT'),true);
  assert.equal(lamp(p,id,'FULL_EXT'),false);
 }
 p=r.advance(.75); // t=6.5
 for(const id of LE.FLAPS){
  assert.equal(lamp(p,id,'FULL_EXT'),true);
  assert.equal(lamp(p,id,'TRANSIT'),false);
 }
 for(const id of LE.SLATS){
  assert.equal(lamp(p,id,'TRANSIT'),true);
  assert.equal(lamp(p,id,'EXT'),false);
 }
 p=r.advance(.75);
 for(const id of LE.SLATS)assert.equal(lamp(p,id,'TRANSIT'),true);
 p=r.advance(.75); // t=8
 for(const id of LE.SLATS){
  assert.equal(lamp(p,id,'EXT'),true);
  assert.equal(lamp(p,id,'FULL_EXT'),false);
  assert.equal(lamp(p,id,'TRANSIT'),false);
 }
 assert.equal(p.center.extended,true);assert.equal(p.center.transit,false);
 p=r.advance(24); // t=32.0, full stage begins exactly after 24 s EXT hold
 for(const id of LE.SLATS){
  assert.equal(lamp(p,id,'EXT'),false);
  assert.equal(lamp(p,id,'TRANSIT'),true);
 }
 assert.equal(p.center.transit,true);assert.equal(p.center.extended,false);
 p=r.advance(.75);
 assert.equal(lamp(p,'SLAT_2','TRANSIT'),true);
 p=r.advance(.75); // t=33.5
 assert.equal(r.time(),33.5);
 for(const id of LE.SLATS){
  assert.equal(lamp(p,id,'FULL_EXT'),true);
  assert.equal(lamp(p,id,'TRANSIT'),false);
  assert.equal(lamp(p,id,'EXT'),false);
 }
 assert.equal(p.center.transit,false);assert.equal(p.center.extended,true);
 assert.ok(r.actual()>5&&r.actual()<15,'TE continues moving independently');
});
test('FLAPS 5 command stops at EXT; does not promote slats to FULL after hold',()=>{
 const r=rig(5);
 r.advance(40);
 const p=r.latest();
 assert.equal(p.leStage,'EXT');
 for(const id of LE.SLATS)assert.equal(lamp(p,id,'EXT'),true);
 assert.equal(p.center.transit,false);
});
test('jammed SLAT 2 remains amber while other devices reach FULL',()=>{
 const r=rig();
 r.advance(8);
 r.jam('SLAT_2');
 const p=r.advance(25.5);
 assert.equal(lamp(p,'SLAT_2','TRANSIT'),true);
 assert.equal(lamp(p,'SLAT_2','EXT'),false);
 assert.equal(lamp(p,'SLAT_2','FULL_EXT'),false);
 assert.equal(lamp(p,'SLAT_1','FULL_EXT'),true);
 assert.equal(p.center.transit,true);
});
test('instructor-command non-physical LE TICK remains backward compatible',()=>{
 let s=LE.apply(LE.initialState(),{type:'FLAP_LEVER',value:15});
 s=LE.apply(s,{type:'TICK',seconds:10});
 const p=LE.evaluate(s);
 assert.equal(p.position.SLAT_1,2);
 assert.equal(p.position.FLAP_1,1);
});
