'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const Model=require('../engine/instruments/flight-dynamics-gauge-model-v1.js');
const Flight=require('../engine/flight/flight-scenario-core-v1.js');
const source=fs.readFileSync(path.resolve(__dirname,'../panel-mosaic-lab/cockpit/flight-instrument-dynamics-v1.js'),'utf8');
function rig(){
 const listeners={},calls={pointer:[],airspeed:[],standby:[]};
 let angles={captain:{altimeter:15,verticalSpeed:-90},firstOfficer:{altimeter:12,verticalSpeed:-87}};
 let speeds={captain:{airspeedKts:120},firstOfficer:{airspeedKts:121}};
 const fn={setContinuousAngle(seat,key,angle){angles[seat][key]=angle;calls.pointer.push({seat,key,angle});},
  setAngle(seat,key,angle){angles[seat][key]=angle;},
  getAngles:()=>JSON.parse(JSON.stringify(angles))};
 const asi={setAirspeedKts(value,seat){speeds[seat].airspeedKts=value;calls.airspeed.push({seat,value});},
  getValues:()=>JSON.parse(JSON.stringify(speeds))};
 const document={readyState:'loading',getElementById:()=>null,addEventListener(){}};
 const win={document,B737FlightDynamicsGaugesV1:Model,B737UnifiedFlightNeedles:fn,B737UnifiedAirspeedPointers:asi,
  addEventListener(k,handler){listeners[k]=handler;},dispatchEvent(e){if(e.type==='b737:standby-altimeter-sample')calls.standby.push(e.detail);},
  requestAnimationFrame:handler=>handler(),console};
 class CustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail;}}
 vm.runInNewContext(source,{window:win,CustomEvent,console});
 return {calls,angles,speeds,api:win.B737UnifiedFlightGaugeBridgeV1,
  emit:(type,detail)=>listeners[type]({detail})};
}
const frame=altitudeFt=>Flight.newScenario({airport:'OIII',preset:'MANUAL',airborne:true,
 altitudeFt,speedKt:200,headingDeg:290,vsFpm:1500});
test('same flight data drives captain and FO analog altimeter IVSI and ASI',()=>{
 const r=rig();r.emit('b737:flight-scenario-state',frame(12450));
 assert.equal(r.calls.pointer.filter(p=>p.key==='altimeter').length,2);
 assert.equal(r.calls.pointer.filter(p=>p.key==='verticalSpeed').length,2);
 assert.equal(r.calls.airspeed.length,2);assert.equal(r.angles.captain.altimeter,162);
 assert.equal(r.angles.firstOfficer.altimeter,162);
 assert.ok(r.angles.firstOfficer.verticalSpeed> -90);
 assert.equal(r.calls.standby.at(-1).altitudeFt,12450);
});
test('1000-ft altitude hand transition advances smoothly, not one reverse revolution',()=>{
 const r=rig();r.emit('b737:flight-scenario-state',frame(10999));
 const old=r.angles.captain.altimeter;
 r.emit('b737:flight-scenario-state',{...frame(11001),revision:2});
 assert.ok(r.angles.captain.altimeter>old);
 assert.ok(r.angles.captain.altimeter-old<2);
});
test('source stop restores previous manual needles and invalidates standby source',()=>{
 const r=rig();r.emit('b737:flight-scenario-state',frame(12000));
 r.emit('b737:flight-scenario-stopped',{});
 assert.equal(r.angles.captain.altimeter,15);
 assert.equal(r.angles.firstOfficer.altimeter,12);
 assert.equal(r.speeds.captain.airspeedKts,120);
 assert.equal(r.speeds.firstOfficer.airspeedKts,121);
 assert.equal(r.calls.standby.at(-1).quality,'UNKNOWN');
 assert.equal(r.api.getState().active,false);
});
test('untrusted samples lacking proper schema do not drive indicators',()=>{
 const r=rig();r.emit('b737:flight-scenario-state',{schema:'OTHER',altitudeFt:10000,iasKt:200,vsFpm:0});
 assert.equal(r.calls.pointer.length,0);assert.equal(r.calls.airspeed.length,0);
});
