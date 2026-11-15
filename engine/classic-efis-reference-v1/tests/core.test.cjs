"use strict";
const assert=require("node:assert/strict");
const e=require("../core.js");
const valid=value=>({valid:true,value});
const base=()=>({powered:true,sgValid:true,mode:"MAP",rangeNm:40,signals:{
  attitude:valid({pitch:2,bank:5}),heading:valid(125),track:valid(132),
  airspeed:valid(240),selectedHeading:valid(140),position:valid({lat:0,lon:0}),
  route:valid({executed:false,points:[{name:"TEST"}]})
}});
function find(scene,id){const x=scene.segments.find(s=>s.id===id);assert.ok(x,id);return x;}
assert.equal(e.VERSION,"CLASSIC-EFIS-REFERENCE-V1");
assert.equal(e.orientation("PLAN"),"TRUE_NORTH");
assert.equal(e.orientation("FULL_VOR_ILS"),"HEADING_UP");
assert.equal(e.orientation("MAP"),"TRACK_UP");
assert.equal(e.wrap360(-15),345);
assert.equal(e.wrap360(375),15);
assert.equal(e.compileSeat("EADI",{}).segments.every(s=>s.state!=="READY"),true);
assert.equal(find(e.compileSeat("EADI",base()),"attitude-card").state,"READY");
assert.equal(find(e.compileSeat("EADI",base()),"flight-director").state,"HIDDEN");
assert.equal(find(e.compileSeat("EHSI",base()),"active-route").reason,"ROUTE_NOT_EXECUTED");
const exec=base();exec.signals.route=valid({executed:true,points:[]});
assert.equal(find(e.compileSeat("EHSI",exec),"active-route").state,"READY");
const vor=base();vor.mode="FULL_VOR_ILS";vor.signals.course=valid(210);
assert.equal(e.compileSeat("EHSI",vor).referenceDegrees,125);
assert.equal(find(e.compileSeat("EHSI",vor),"selected-course").state,"READY");
assert.equal(find(e.compileSeat("EHSI",vor),"active-route").reason,"MODE_EXCLUDED");
const plan=base();plan.mode="PLAN";
assert.equal(e.compileSeat("EHSI",plan).referenceDegrees,0);
assert.equal(find(e.compileSeat("EHSI",plan),"selected-heading-bug").state,"HIDDEN");
const bad=base();bad.sgValid=false;
assert.equal(find(e.compileSeat("EADI",bad),"attitude-card").state,"HIDDEN");
const flag=base();flag.flags.ATT=true;
assert.equal(find(e.compileSeat("EADI",flag),"attitude-failure-flag").state,"READY");
assert.equal(find(e.compileSeat("EADI",base()),"attitude-failure-flag").state,"HIDDEN");
const noHeading=base();noHeading.signals.heading={valid:false,value:200};
assert.equal(find(e.compileSeat("EHSI",noHeading),"compass-rose").state,"HIDDEN");
assert.equal(e.compileAircraft({seats:{CAPT:base(),FO:base()}}).FO.EHSI.mode,"MAP");
assert.ok(e.auditReport("EADI").length>=25);
assert.ok(e.auditReport("EHSI").length>=20);
assert.ok(e.auditReport().every(x=>x.acceptance==="NOT APPROVED"&&x.source));
const img=new Uint8ClampedArray([0,10,20,255,100,120,130,255]);
assert.equal(e.compareRGBA(img,img,2,1).meanAbsoluteError,0);
const altered=new Uint8ClampedArray([0,10,20,255,255,120,130,255]);
assert.equal(e.compareRGBA(img,altered,2,1,new Uint8Array([1,0])).comparedPixels,1);
assert.throws(()=>e.compareRGBA(img,img,3,1),/dimensions/);
console.log("Classic EFIS Reference Engine v1: all source and failure-gate tests passed");
