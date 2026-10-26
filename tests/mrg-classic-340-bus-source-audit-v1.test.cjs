"use strict";
const {test}=require("node:test"),a=require("node:assert/strict");
const E=require("../engine/systems/electrical-v7.js");
const M=require("../engine/systems/mrg-classic-consumer-bus-qa-v1.js");
const INDEX=require("../engine/systems/mrg-classic-340-consumer-bus-index-v1.json");
const electrical=()=>E.evaluate(E.initialState());
const find=(text)=>INDEX.rows.find(x=>x.item===text);
test("MRG Classic source index has 340 cited records across 182-188",()=>{
 const p=M.validate(INDEX);a.equal(p.rows,340);a.equal(p.epFsiWiringVerified,0);
 a.deepEqual(p.byPage,{"182":48,"183":52,"184":55,"185":45,"186":49,"187":48,"188":43});
});
test("All indexed rows are source general and never installed EP-FSI WDM",()=>{
 a(INDEX.rows.every(r=>r.epFsiWiringConfirmed===false&&r.pdfPage===r.printedPage+9));
 a(INDEX.rows.every(r=>["115VAC","28VAC","28VDC"].includes(r.feedVoltage)));
});
test("Two variant pressurization branches never co-activate",()=>{
 const c=M.variantRows(INDEX,"CPCS"),d=M.variantRows(INDEX,"DCPCS");
 a(!c.some(x=>x.applicability==="DCPCS"));a(!d.some(x=>x.applicability==="CPCS"));
 a(c.some(x=>x.item==="Pressuriz. Control Auto (CPCS)"));
 a(d.some(x=>x.item==="Pressuriz. Control Auto 2 (DCPCS)"));
 a.equal(M.variantRows(INDEX,"CPCS").length-M.variantRows(INDEX,"DCPCS").length,3);
});
test("Generator hydraulic pump motors and their DC control feeds are separate",()=>{
 a.equal(find("Electric Hydraulic Pump 1 Sys B").feedBus,"generator1");
 a.equal(find("Electric Hydraulic Pump 2 Sys A").feedBus,"generator2");
 a.equal(find("Engine 1 Electric Hydraulic Pump Control").feedBus,"dc2");
 a.equal(find("Engine 2 Electric Hydraulic Pump Control").feedBus,"dc1");
});
test("Fuel motor power and independent DC controls preserve asymmetry",()=>{
 a.equal(find("Fuel Boost Pump - Center Tank Left").feedBus,"main2");
 a.equal(find("Fuel Boost Pump - Center Tank Right").feedBus,"main1");
 a.equal(find("Fuel Pump Control - Center Tank Left").feedBus,"dc1");
 a.equal(find("Fuel Pump Control - Center Tank Right").feedBus,"dc2");
 a.equal(find("Fuel Boost Pump - Main Tank 1 Aft").feedBus,"transfer1");
 a.equal(find("Fuel Boost Pump - Main Tank 2 Aft").feedBus,"transfer2");
});
test("CSD drive oil temperature 1/2 needle feeds are DC BUS 1/2",()=>{
 const n=M.needleSources(INDEX,electrical());
 a.equal(n["oh.drive_oil.1"].evidence[0].feedBus,"dc1");
 a.equal(n["oh.drive_oil.2"].evidence[0].feedBus,"dc2");
 a.equal(n["oh.drive_oil.1"].gaugePower,null);
 a.equal(n["oh.drive_oil.2"].angleAffected,false);
});
test("Classic oil pressure and temperature engine 1 and 2 are 28VAC transfer channels",()=>{
 const n=M.needleSources(INDEX,electrical());
 for(const [id,bus] of [["eng.oil_pressure.1","transfer1"],["eng.oil_pressure.2","transfer2"],["eng.oil_temperature.1","transfer1"],["eng.oil_temperature.2","transfer2"]]){
  a.equal(n[id].evidence[0].feedBus,bus);
  a.equal(n[id].evidence[0].feedVoltage,"28VAC");
  a.equal(n[id].evidence[0].sourceStatus,"UNKNOWN_NOT_MODELLED");
 }
});
test("N1 battery, N2 and EGT standby 28VDC separated in 54-gauge source audit",()=>{
 const n=M.needleSources(INDEX,electrical());
 a.equal(n["eng.n1.1"].evidence[0].feedBus,"battery");
 a.equal(n["eng.n2.1"].evidence[0].feedBus,"standby");
 a.equal(n["eng.egt.1"].evidence[0].feedBus,"standby");
 a.equal(n["eng.n1.1"].gaugePower,null);
});
test("Fuel temperature indicator source on MAIN 2 28VAC not DC BUS2",()=>{
 const n=M.needleSources(INDEX,electrical());
 a.equal(n["oh.fuel.temperature"].evidence[0].feedBus,"main2");
 a.equal(n["oh.fuel.temperature"].evidence[0].feedVoltage,"28VAC");
 a.equal(n["oh.fuel.temperature"].evidence[0].observedSource,null);
});
test("Hydraulic A/B pressure needles require distinct 28VAC transfer feeds",()=>{
 const n=M.needleSources(INDEX,electrical());
 a.equal(n["eng.hyd_pressure.a"].evidence[0].feedBus,"transfer2");
 a.equal(n["eng.hyd_pressure.b"].evidence[0].feedBus,"transfer1");
});
test("Electronic bus voltage is not a fabricated electrical V7 bus",()=>{
 const r=find("MCP (DC)"),p=M.busPath(r.feedBus,r.feedVoltage,electrical());
 a.equal(r.feedBus,"electronic1");a.equal(p.v7Bus,null);a.equal(p.observedSource,null);
});
test("Unavailable known AC source may be flagged in generic row but device remains unknown",()=>{
 let s=E.initialState();s=E.apply(s,{type:"FAULT",id:"GEN1_FAILED",active:true,instructor:true});
 const out=M.project({index:INDEX,electrical:E.evaluate(s),variant:"DCPCS",item:"Electric Hydraulic Pump 1 Sys B"});
 a.equal(out.rows.length,1);a.equal(out.rows[0].observedSource,false);
 a.equal(out.rows[0].devicePowered,null);a.equal(out.rows[0].noSystemMutation,true);
});
test("Generator 1 healthy bus source never proves hydraulic pump physical operation",()=>{
 const out=M.project({index:INDEX,electrical:electrical(),item:"Electric Hydraulic Pump 1 Sys B"});
 a.equal(out.rows[0].observedSource,true);
 a.equal(out.rows[0].devicePowered,null);
});
test("28VAC transformer state is not equivalent to 28VDC bus boolean",()=>{
 const n=M.needleSources(INDEX,electrical());
 a.equal(n["eng.oil_pressure.1"].evidence[0].observedSource,null);
 a.equal(n["eng.oil_pressure.1"].evidence[0].sourceStatus,"UNKNOWN_NOT_MODELLED");
});
test("Standby AC and standby DC are distinct V7 signal paths",()=>{
 const e=electrical();
 a.equal(M.busPath("standby","115VAC",e).v7Bus,"acStandby");
 a.equal(M.busPath("standby","28VDC",e).v7Bus,"dcStandby");
});
test("Composite/multi-bus records preserve topology unknown not logical AND",()=>{
 const x=find("FMC");
 a.equal(x.feedBus,"electronic1|electronic2");
 a.equal(M.busPath(x.feedBus,x.feedVoltage,electrical()).observedSource,null);
});
test("Does not infer physically installed sensor power or 54 gauge angle from general CL index",()=>{
 const n=M.needleSources(INDEX,electrical());
 a.equal(Object.keys(n).length,17);
 a(Object.values(n).every(x=>x.gaugePower===null&&x.angleAffected===false));
});
test("Reject NG/test-only and malformed indices",()=>{
 a.throws(()=>M.variantRows(INDEX,"NG"),/CPCS or DCPCS/);
 a.throws(()=>M.validate({rows:[]}),/340-row/);
});
