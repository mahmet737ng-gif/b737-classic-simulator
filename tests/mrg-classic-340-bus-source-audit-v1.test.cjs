"use strict";
const {test}=require("node:test"),a=require("node:assert/strict");
const E=require("../engine/systems/electrical-v7.js");
const M=require("../engine/systems/mrg-classic-consumer-bus-qa-v1.js");
const INDEX=require("../engine/systems/mrg-classic-340-consumer-bus-index-v1.json");
const FAILURES=require("../engine/systems/mrg-classic-bus-failure-effects-v1.json");
const LoadsV8=require("../engine/systems/electrical-loads-v8.js");
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

test("Classic MRG failure table has 35 page-cited non-zero-forcing INOP effects",()=>{
 a.equal(FAILURES.effects.length,35);
 a(FAILURES.effects.every(f=>f.epFsiInstalledConfirmation===false&&f.impact==="INOP_NOT_FORCED_ZERO"));
 a(FAILURES.effects.every(f=>f.printedPage>=162&&f.printedPage<=167&&f.pdfPage===f.printedPage+9));
});
test("DC BUS 1/2 faults isolate drive oil temperature needles by side",()=>{
 const f=FAILURES.effects;
 a(f.some(e=>e.bus==="dc1"&&e.systemIndicator==="oh.drive_oil.1"&&e.effect==="ENGINE_1_CSD_OIL_TEMP_INDICATION_INOP"));
 a(f.some(e=>e.bus==="dc2"&&e.systemIndicator==="oh.drive_oil.2"&&e.effect==="ENGINE_2_CSD_OIL_TEMP_INDICATION_INOP"));
 a(!f.some(e=>e.bus==="dc1"&&e.systemIndicator==="oh.drive_oil.2"));
});
test("Transfer 1 and 2 loss correspond to distinct engine oil pressure/temperature groups",()=>{
 const f=FAILURES.effects;
 for(const n of [1,2]){
  a(f.some(e=>e.bus==="transfer"+n&&e.systemIndicator==="eng.oil_pressure."+n));
  a(f.some(e=>e.bus==="transfer"+n&&e.systemIndicator==="eng.oil_temperature."+n));
 }
});
test("Special instrument effects distinguish non-EIS N2 and CPCS/DCPCS channels",()=>{
 const f=FAILURES.effects;
 a(f.some(e=>e.systemIndicator==="eng.n2.1"&&e.variant==="NON_EIS_ONLY"));
 a(f.some(e=>e.systemIndicator==="air.cpcs.manualAC"&&e.variant==="CPCS_ONLY"));
 a(f.some(e=>e.systemIndicator==="air.dcpcs.auto2"&&e.variant==="DCPCS_ONLY"));
});
test("Duplicated OCR source index row is quarantined rather than duplicated in installed loads",()=>{
 const duplicates=INDEX.rows.filter(x=>x.item==="Fuel Pump Control - Main Tank 1 Fwd"&&x.feedBus==="dc2");
 a.equal(duplicates.length,2);
 a(duplicates.every(x=>x.sourceConfidence==="DUPLICATED_LABEL_REQUIRES_PAGE_PHOTO_REVIEW"));
});

test("V8 opt-in exposes ten source-indexed Classic candidates but no installed bus assignments",()=>{
 const p=LoadsV8.project(electrical(),{mrgIndex:INDEX,mrgAudit:M,variant:"DCPCS"});
 a.equal(Object.keys(p.genericClCandidateFeeds).length,10);
 a.equal(p.coverage.loadsKnownBus,0);
 a(Object.values(p.loads).every(x=>x.assignedBus===null));
 a(Object.values(p.genericClCandidateFeeds).every(x=>x.assignedBus===null&&x.powered===null&&x.installedWiringConfirmed===false));
 a.equal(p.genericClCandidateFeeds["fuel.centerLeftPump"].references[0].bus,"main2");
 a.equal(p.genericClCandidateFeeds["hyd.electricPumpA"].references[0].bus,"generator2");
});
test("V8 default projection is unchanged in source-gated mode; CPCS omits DCPCS candidates",()=>{
 const d=LoadsV8.project(electrical());
 a.equal(d.genericClCandidateFeeds,null);
 const c=LoadsV8.project(electrical(),{mrgIndex:INDEX,mrgAudit:M,variant:"CPCS"});
 a.equal(Object.keys(c.genericClCandidateFeeds).length,8);
 a.equal(c.genericClCandidateFeeds["dcpcs.controller1"],undefined);
 a.equal(c.loads["dcpcs.controller1"].assignedBus,null);
});
