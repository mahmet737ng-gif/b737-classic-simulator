/* 737 Classic MRG IV.6 pp.182–188 indexed BUS→ITEM reference QA.
 * Accepts explicit MRG index; never certifies aircraft-specific EP-FSI wiring.
 * A documented upstream bus being energized does not prove device power.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.B737MRGClassicBusConsumerAudit=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";
const BUS_TO_V7=Object.freeze({generator1:"generator1",generator2:"generator2",main1:"main1",main2:"main2",transfer1:"transfer1",transfer2:"transfer2",dc1:"dc1",dc2:"dc2",battery:"battery",hotBattery:"hotBattery",switchedHotBattery:"switchedHotBattery",groundService:"groundService"});
const NEEDLE_REFERENCES=Object.freeze([
 ["oh.drive_oil.1","Engine 1 CSD Oil Temp Indication"],
 ["oh.drive_oil.2","Engine 2 CSD Oil Temp Indication"],
 ["oh.fuel.temperature","Fuel Temperature Indication"],
 ["eng.n1.1","Engines N1 Indication"],
 ["eng.n1.2","Engines N1 Indication"],
 ["eng.n2.1","Engines N2 Indication"],
 ["eng.n2.2","Engines N2 Indication"],
 ["eng.egt.1","Engines EGT Indication"],
 ["eng.egt.2","Engines EGT Indication"],
 ["eng.oil_pressure.1","Engine 1 Oil Pressure Indication"],
 ["eng.oil_pressure.2","Engine 2 Oil Pressure Indication"],
 ["eng.oil_temperature.1","Engine 1 Oil Temp Indication"],
 ["eng.oil_temperature.2","Engine 2 Oil Temp Indication"],
 ["eng.hyd_pressure.a","Hydraulic System A Press. Indication"],
 ["eng.hyd_pressure.b","Hydraulic System B Press Indication"],
 ["fo.hyd_brake_pressure","Brake Pressure Indicator"],
 ["oh.duct.pressure_lr","Pneumatic Duct Pressure Indication"]
].map(([id,item])=>Object.freeze({id,item})));
function validate(index){
 if(index?.schema!=="b737-classic.mrg-iv6.consumer-bus-index.v1"||index.rows?.length!==340)
 throw Error("B737 Classic MRG 340-row indexed evidence required");
 const ids=new Set(),page={};
 for(const row of index.rows){
  if(ids.has(row.id))throw Error("Duplicated source row "+row.id);ids.add(row.id);
  if(!(row.printedPage>=182&&row.printedPage<=188&&row.pdfPage===row.printedPage+9))throw Error("Bad MRG page provenance");
  if(!["28VAC","115VAC","28VDC"].includes(row.feedVoltage))throw Error("Unsupported electrical power class");
  if(row.epFsiWiringConfirmed!==false)throw Error("MRG reference must never imply EP-FSI feeder verification");
  page[row.printedPage]=(page[row.printedPage]||0)+1;
 }
 return {rows:index.rows.length,byPage:page,sourceConfidence:"CLASSIC_GENERAL_REFERENCE_ONLY",epFsiWiringVerified:0};
}
function variantRows(index,variant="DCPCS"){
 validate(index);
 if(!["CPCS","DCPCS"].includes(variant))throw Error("CPCS or DCPCS required");
 return index.rows.filter(x=>x.applicability!=="CPCS"&&x.applicability!=="DCPCS"||x.applicability===variant);
}
function busPath(bus,voltage,electrical){
 if(!electrical||electrical.schema!=="B737_ELECTRICAL_V7_RESULT")throw Error("Electrical V7 result required");
 const keys=bus.split("|");
 const mapped=keys.map(x=>{
  if(x==="standby")return voltage==="115VAC"?"acStandby":voltage==="28VDC"?"dcStandby":null;
  // Electronic bus converters and 28VAC transformer outputs are not modelled in V7.
  if(x.startsWith("electronic")||x==="external")return null;
  if(voltage==="28VAC")return null;
  return BUS_TO_V7[x]||null;
 });
 // Alternate/compound path topology is unverified, so do not fabricate AND/OR source state.
 if(mapped.length!==1||mapped[0]===null)return {v7Bus:null,observedSource:null,sourceStatus:"UNKNOWN_NOT_MODELLED"};
 const on=electrical.bus[mapped[0]];
 return {v7Bus:mapped[0],observedSource:on===true||on===false?on:null,
  sourceStatus:on===false?"REFERENCE_BUS_UNPOWERED":on===true?"REFERENCE_BUS_POWERED_DEVICE_UNKNOWN":"UNKNOWN"};
}
function project({index,electrical,variant="DCPCS",item=null}={}){
 const rows=variantRows(index,variant);
 const subset=item===null?rows:rows.filter(row=>row.item.toUpperCase()===String(item).toUpperCase());
 return {schema:"b737.mrg-classic-340-source-audit.v1",variant,rows:subset.map(row=>{
   const path=busPath(row.feedBus,row.feedVoltage,electrical);
   return {...row,...path,devicePowered:null,deviceStatus:"NOT_DETERMINED_GENERIC_CL_ONLY",noSystemMutation:true};
 }),qa:{sourceRows:rows.length,verifiedEpFsiWires:0,alert:"Do not propagate MRG generic source bus observation into installed-aircraft equipment power"}};
}
function needleSources(index,electrical,variant="DCPCS"){
 const refs=variantRows(index,variant);
 const output={};
 for(const needle of NEEDLE_REFERENCES){
  const matches=refs.filter(row=>row.item.toUpperCase()===needle.item.toUpperCase());
  output[needle.id]={
   needleId:needle.id,mrgLabel:needle.item,evidence:matches.map(row=>({
    id:row.id,printedPage:row.printedPage,feedBus:row.feedBus,feedVoltage:row.feedVoltage,
    ...busPath(row.feedBus,row.feedVoltage,electrical)})),
   gaugePower:null,
   status:matches.length?"CANDIDATE_CL_SOURCE_NOT_INSTALLED_WDM":"MRG_LABEL_NOT_FOUND",
   angleAffected:false
  };
 }
 return output;
}

const V8_ITEM_NAMES=Object.freeze({
 "dcpcs.controller1":"Pressuriz. Control Auto 1 (DCPCS)",
 "dcpcs.controller2":"Pressuriz. Control Auto 2 (DCPCS)",
 "fuel.main1FwdPump":"Fuel Boost Pump - Main Tank 1 Forward",
 "fuel.main1AftPump":"Fuel Boost Pump - Main Tank 1 Aft",
 "fuel.main2FwdPump":"Fuel Boost Pump - Main Tank 2 Forward",
 "fuel.main2AftPump":"Fuel Boost Pump - Main Tank 2 Aft",
 "fuel.centerLeftPump":"Fuel Boost Pump - Center Tank Left",
 "fuel.centerRightPump":"Fuel Boost Pump - Center Tank Right",
 "hyd.electricPumpA":"Electric Hydraulic Pump 2 Sys A",
 "hyd.electricPumpB":"Electric Hydraulic Pump 1 Sys B"
});
function v8CandidateSources(index,electrical,variant="DCPCS"){
 const rows=variantRows(index,variant),out={};
 for(const [id,item] of Object.entries(V8_ITEM_NAMES)){
  if(id.startsWith("dcpcs.")&&variant!=="DCPCS")continue;
  const found=rows.filter(x=>x.item.toUpperCase()===item.toUpperCase());
  out[id]={loadId:id,sourceItemName:item,
   references:found.map(row=>({id:row.id,page:row.printedPage,bus:row.feedBus,electricClass:row.feedVoltage,...busPath(row.feedBus,row.feedVoltage,electrical)})),
   assignedBus:null,powered:null,installedWiringConfirmed:false,
   sourceStatus:found.length?"GENERIC_CLASSIC_MRG_ONLY":"UNMATCHED_SOURCE_LABEL"};
 }
 return out;
}
return Object.freeze({BUS_TO_V7,NEEDLE_REFERENCES,V8_ITEM_NAMES,validate,variantRows,busPath,project,needleSources,v8CandidateSources});
});