"use strict";
const assert=require("node:assert/strict");
const {WarningEngine}=require("../audio/warning-engine.js");
const Owner=require("../audio-lab/owner-ra-callouts-v1.js");
const engine=new WarningEngine({variant:"737-300"});
const base={onGround:false,approachActive:true,minimumsRadioFt:200,pressureAltitudeFt:0,selectedAltitudeFt:0,
 cabinAltitudeFt:0,flaps:0,gearDownLocked:true,thrustLever1Angle:45,thrustLever2Angle:45,
 iasKt:0,vmoKt:340,mach:0,mmo:.82,leadingEdgeTakeoff:true,speedbrakeDown:true,
 parkingBrakeSet:false,stabilizerTrimTakeoff:true,engine1Fire:false,engine2Fire:false,
 apuFire:false,wheelWellFire:false,cargoFire:false,stallWarning:false,glideslopeCaptured:false};
const step=radioAltitudeFt=>engine.update({...base,radioAltitudeFt});
const triggered=[];
step(1200);
for(const ra of [999,499,299,199,99,49,39,29,19,9]){
 const out=step(ra);
 for(const event of out.events.filter(x=>x.id==="radioAltitude"||x.id==="minimums")){
  const key=Owner.keyFor(event.id,event.message);
  triggered.push(key);
  assert.ok(Owner.TIMELINE[key], "No owner recording for "+key);
 }
}
assert.deepEqual(triggered,[
 "radioAltitude|ONE THOUSAND","radioAltitude|500",
 "minimums|APPROACHING MINIMUMS","minimums|MINIMUMS",
 "radioAltitude|100","radioAltitude|50","radioAltitude|40",
 "radioAltitude|30","radioAltitude|20","radioAltitude|10"
]);
assert.equal(Owner.TIMELINE["radioAltitude|2500"],undefined);
const negative=new WarningEngine();
const noMin={...base,minimumsRadioFt:-20};
negative.update({...noMin,radioAltitudeFt:1200});
const muted=negative.update({...noMin,radioAltitudeFt:0});
assert.equal(muted.events.some(x=>x.id==="minimums"),false);
console.log("Unified RA audio integration mapping and DH inhibit tests passed");
