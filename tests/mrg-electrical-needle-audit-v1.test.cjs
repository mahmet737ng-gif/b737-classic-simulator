"use strict";
const {test}=require("node:test"),A=require("node:assert/strict");
const M=require("../engine/instruments/mrg-electrical-needle-audit-v1.js");
const E=require("../engine/systems/electrical-v7.js");
const base=()=>E.initialState();
const audit=(s,selector,observed={},drive=null)=>M.evaluate({selector,electrical:E.evaluate(s),observed,drive});
test("TR1 selected meter normal reading is DC BUS 1 voltage 24-30, not direct TR output",()=>{
 const a=audit(base(),"TR1",{dcVolts:27,dcAmps:22});
 A.equal(a.selectedVoltageSource,"DC_BUS_1_NOT_RAW_TR_OUTPUT");
 A.deepEqual(a.dcBusVoltageObserved.range,[24,30]);A.equal(a.dcBusVoltageObserved.status,"WITHIN_MRG_REFERENCE");
 A.deepEqual(a.selectedTRAmpsObserved.range,[20,25]);A.equal(a.selectedTRAmpsObserved.status,"WITHIN_MRG_REFERENCE");
 A.equal(a.targetAngleDeg,null);
});
test("TR2 selected DC bus and TR current are independently measured",()=>{
 const a=audit(base(),"TR2",{dcVolts:29,dcAmps:23});
 A.equal(a.selectedVoltageSource,"DC_BUS_2_NOT_RAW_TR_OUTPUT");
 A.equal(a.dcBusVoltageObserved.status,"WITHIN_MRG_REFERENCE");
 A.equal(a.selectedTRAmpsObserved.status,"WITHIN_MRG_REFERENCE");
});
test("TR3 current is 10-15 normal but its selected DC voltage bus source is unconfirmed",()=>{
 const a=audit(base(),"TR3",{dcVolts:27,dcAmps:12});
 A.deepEqual(a.selectedTRAmpsObserved.range,[10,15]);A.equal(a.selectedTRAmpsObserved.status,"WITHIN_MRG_REFERENCE");
 A.equal(a.dcBusVoltageObserved.status,"POWER_PATH_UNRESOLVED");
 A(a.qa.includes("TR3_DISPLAY_VOLTAGE_BUS_MAPPING_NOT_SOURCE_PROVEN"));
});
test("Battery nominal meter reading 22-30 V and 0 A is a reference, not simulated exact data",()=>{
 const a=audit(base(),"BATTERY",{dcVolts:25,dcAmps:0});
 A.equal(a.dcBusVoltageObserved.status,"WITHIN_MRG_REFERENCE");
 A.equal(a.selectedTRAmpsObserved.status,"WITHIN_MRG_REFERENCE");
 const noObs=audit(base(),"BATTERY");
 A.equal(noObs.dcBusVoltageObserved.status,"NO_OBSERVATION");
 A.equal(noObs.selectedTRAmpsObserved.status,"NO_OBSERVATION");
});
test("BAT BUS/STBY selector current is not indicated rather than zero",()=>{
 for(const selector of ["BAT_BUS","STBY_PWR"]){
  const a=audit(base(),selector,{dcAmps:0});
  A.equal(a.selectedTRAmpsObserved.status,"NOT_INDICATED");
  A.equal(a.standbyDcAmpsDisplayed,false);
 }
});
test("Failed TR1, preserved DC1 from backed TR2: volts can remain normal but TR1 amps = 0",()=>{
 let s=E.apply(base(),{type:"FAULT",id:"TR1_FAILED",active:true,instructor:true});
 const v=E.evaluate(s);A.equal(v.feed.tr.TR1,false);A.equal(v.bus.dc1,true);
 const a=audit(s,"TR1",{dcVolts:27,dcAmps:0});
 A.equal(a.dcBusVoltageObserved.status,"WITHIN_MRG_REFERENCE");
 A.deepEqual(a.selectedTRAmpsObserved.range,[0,0]);
 A.equal(a.selectedTRAmpsObserved.status,"WITHIN_MRG_REFERENCE");
 A(a.qa.some(x=>x.startsWith("TR_OPEN_BUT_DC_BUS_BACKFED")));
});
test("TR1 failure plus BUS TRANS tie isolation is not an invented 27V reading",()=>{
 let s=E.apply(base(),{type:"FAULT",id:"TR1_FAILED",active:true,instructor:true});
 s=E.apply(s,{type:"CONTROL",key:"glideslopeCaptured",value:true});
 const a=audit(s,"TR1",{dcVolts:27,dcAmps:0});
 A.equal(a.dcBusVoltageObserved.status,"POWER_PATH_UNRESOLVED");
 A.equal(a.selectedTRAmpsObserved.status,"WITHIN_MRG_REFERENCE");
});
test("TR1 current not nominal when TR failed even if other TR keeps system powered",()=>{
 const s=E.apply(base(),{type:"FAULT",id:"TR1_FAILED",active:true,instructor:true});
 A.equal(audit(s,"TR1",{dcVolts:27,dcAmps:22}).selectedTRAmpsObserved.status,"OUTSIDE_MRG_REFERENCE");
});
test("Classic STBY PWR OFF warning can be AC-only; DC meter remains separately assessed",()=>{
 let s=E.apply(base(),{type:"CONTROL",key:"standbySelector",value:"OFF"});
 const a=audit(s,"STBY_PWR",{dcVolts:25});
 A(a.qa.includes("CLASSIC_STANDBY_PWR_OFF_LAMP_PROVES_AC_STANDBY_OFF_ONLY; DC_STANDBY_MUST_BE_MEASURED"));
 A.equal(a.selectedTRAmpsObserved.status,"NOT_INDICATED");
});
test("Classic CSD high oil temp >157 C, low pressure <120 psi without NG IDG 182/165 thresholds",()=>{
 let a=audit(base(),"TR1",{}, {oilTempC:158,oilPressurePsi:119});
 A.equal(a.drive.highOilTemp,true);A.equal(a.drive.lowOilPressure,true);
 a=audit(base(),"TR1",{}, {oilTempC:157,oilPressurePsi:120});
 A.equal(a.drive.highOilTemp,false);A.equal(a.drive.lowOilPressure,false);
 A(M.OIL_LIMITS.ngValuesExcluded.includes("IDG 182degC"));
});
test("Unknown electric source does not fabricate gauge reading, angle or pivot",()=>{
 const a=M.evaluate({selector:"TR1",observed:{dcVolts:28,dcAmps:23}});
 A.equal(a.dcBusVoltageObserved.status,"POWER_PATH_UNRESOLVED");
 A.equal(a.selectedTRAmpsObserved.status,"POWER_PATH_UNRESOLVED");
 A.equal(a.targetAngleDeg,null);
});
test("OH10 documented unresolved pivots remain guarded",()=>{
 A(M.RISK.some(x=>x.id==="OH10_DC_AMPS_PIVOT"&&x.status==="CONFLICT_OPEN"));
 A(M.RISK.some(x=>x.id==="OH10_CPS_PIVOT"&&x.status==="CONFLICT_OPEN"));
});
test("Unrecognized selector and invalid electrical result rejected",()=>{
 A.throws(()=>M.evaluate({selector:"NG_TR"}),/Unsupported/);
 A.throws(()=>M.evaluate({selector:"TR1",electrical:{}}),/Electrical V7/);
});
test("Meter readings outside Classic MRG normal range are flagged, not clamped",()=>{
 const a=audit(base(),"TR2",{dcVolts:31,dcAmps:35});
 A.equal(a.dcBusVoltageObserved.status,"OUTSIDE_MRG_REFERENCE");
 A.equal(a.selectedTRAmpsObserved.status,"OUTSIDE_MRG_REFERENCE");
 A.equal(a.dcBusVoltageObserved.observed,31);
});
