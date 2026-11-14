/* B737 Classic: source-indexed circuit-protection projection to Electrical V7.
 * An opened CB proves only its protected circuit is disconnected, NEVER that
 * the entire equipment is dead or that an undocumented bus is unpowered.
 * FCOM supports upstream buses; MRG Classic index supplies CB/equipment names.
 * No airframe-specific WDM wire is invented.
 */
(function(root,factory){
"use strict";
const idx=typeof module==="object"&&module.exports?require("./classic-mrg-index.v2.js"):root&&root.B737ClassicMRGCBIndex;
const api=factory(idx);
if(typeof module==="object"&&module.exports)module.exports=api;
if(root)root.B737CBSystemsBridge=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(idx){"use strict";
const SOURCE=Object.freeze({mrg:"B737 Classic MRG electrical CB index, printed pp.134-136 (PDF pp.143-145)",fcom:"Sepehran B737 Classic FCOM 6.20.1-12 (PDF pp.1150-1161)"});
const BASE=Object.freeze([
 {key:"P6-3|ALL|B3",load:"fuel.rightFwd",label:"RIGHT MAIN FWD BOOST PUMP",bus:null,location:"MRG p.136 Forward P6-3 B3/B7"},
 {key:"P6-3|ALL|B7",load:"fuel.leftFwd",label:"LEFT MAIN FWD BOOST PUMP",bus:null,location:"MRG p.136 Forward P6-3 B3/B7"},
 {key:"P6-3|ALL|C3",load:"fuel.rightAft",label:"RIGHT MAIN AFT BOOST PUMP",bus:null,location:"MRG p.136 Aft P6-3 C3/C7"},
 {key:"P6-3|ALL|C7",load:"fuel.leftAft",label:"LEFT MAIN AFT BOOST PUMP",bus:null,location:"MRG p.136 Aft P6-3 C3/C7"},
 {key:"P6-3|ALL|D5",load:"fuel.centerRight",label:"RIGHT CENTER BOOST PUMP",bus:null,location:"MRG p.136 Center P6-3 D5/E5"},
 {key:"P6-3|ALL|E5",load:"fuel.centerLeft",label:"LEFT CENTER BOOST PUMP",bus:null,location:"MRG p.136 Center P6-3 D5/E5"},
 {key:"P18-2|ALL|D12",load:"com.vhf1",label:"VHF COM 1",bus:null,location:"MRG p.135 VHF 1 P18-2 D12"},
 {key:"P6-1|ALL|C2",load:"com.vhf2",label:"VHF COM 2",bus:null,location:"MRG p.135 VHF 2 P6-1 C2; HF 2 index collision - quarantine"},
 {key:"P18-1|ALL|A1",load:"nav.vorloc1",label:"VOR/LOC 1",bus:null,location:"MRG p.135 VOR/LOC 1 P18-1 A1"},
 {key:"P6-12|ALL|C2",load:"hyd.elecA",label:"HYD SYS A ELECTRIC PUMP",bus:"generator2",location:"MRG p.136 A Electric Pump P6-12 C2; p.330 Classic opposite GEN BUS"},
 {key:"P6-11|ALL|C2",load:"hyd.elecB",label:"HYD SYS B ELECTRIC PUMP",bus:"generator1",location:"MRG p.136 B Electric Pump P6-11 C2; p.330 Classic opposite GEN BUS"}
]);
const QUARANTINED=Object.freeze([...(idx&&idx.DISPUTES||[]),
 ...(idx&&idx.ASSOCIATIONS||[]).filter(a=>a.review!=="CLASSIC_MRG_INDEX_AND_CATALOG_MATCH").map(a=>({id:a.id,reason:a.review,status:"QUARANTINED_NO_AUTOMATIC_WIRING"}))]);
const excluded=new Set(QUARANTINED.map(x=>x.id));
const ALLOCATIONS=Object.freeze([
 ...BASE.filter(a=>!excluded.has(a.key)),
 ...(idx&&idx.ASSOCIATIONS||[]).filter(a=>a.review==="CLASSIC_MRG_INDEX_AND_CATALOG_MATCH").map(a=>({
 key:a.id,load:a.load,label:a.label,role:a.role,bus:a.upstreamBus,
 location:"MRG p."+a.printedPage+" Classic CB index; photo "+a.photoMatch,
 photoMatch:a.photoMatch,review:a.review}))
]);
const CATALOG_WARNING="MRG shows circuit-to-equipment association; no complete EP-FSI wire, bypass, backfeed, contactor or downstream electronics mapped.";
function protectedCircuits(net,v7){
 if(!net||typeof net.state!=="function")throw Error("CB network required");
 if(!v7||v7.schema!=="B737_ELECTRICAL_V7_RESULT")throw Error("Electrical V7 evaluation required");
 return ALLOCATIONS.flatMap(def=>{
  const cb=net.state(def.key);if(!cb)throw Error("Missing CB "+def.key);
  if(typeof net.isActive==="function"&&!net.isActive(cb))return [];
  if(def.photoMatch&&cb.label.trim().toUpperCase()!==def.photoMatch.trim().toUpperCase())return [];
  const opened=Boolean(cb.pulled||cb.tripped);
  return [{key:def.key,load:def.load,label:def.label,rating:cb.rating,
   protectionCircuit:opened?"OPEN":"CLOSED",protectedCircuitPower:opened?false:null,
   // Opening a control or indication CB does NOT prove whole-equipment loss.
   devicePower:null,electricalBus:def.bus||"UNKNOWN_UNTRACED",
   role:def.role||"CIRCUIT_ONLY",effect:opened?"PROTECTED_CIRCUIT_INTERRUPTED":"EQUIPMENT_UPSTREAM_UNVERIFIED",
   confidence:"MRG_EQUIPMENT_ASSOCIATION_ONLY",source:SOURCE.mrg,sourceDetail:def.location}];
 });
}
function project({cbNetwork,electricalV7Result,trainerResult=null,trainerState=null}){
 const results=protectedCircuits(cbNetwork,electricalV7Result);
 const circuits=Object.fromEntries(results.map(x=>[x.load,x]));
 const overlay={fuel:{},hyd:{},systemHyd:{A:null,B:null},com:{},nav:{},
 bus:electricalV7Result.bus,rectifiers:electricalV7Result.feed.tr,annunciations:{},
 powerAssumptions:"FUEL_TRAINER_SURROGATE; HYD_CLASSIC_MRG_GEN_BUS_GENERIC_NOT_EP_FSI"};
 for(const c of results){
  const dot=c.load.indexOf("."),domain=c.load.slice(0,dot),id=c.load.slice(dot+1),open=c.protectionCircuit==="OPEN";
  if(domain==="fuel"&&trainerResult&&trainerResult.fuel&&trainerResult.fuel[id]){
   const raw=trainerResult.fuel[id];
   const bus=(id==="rightFwd"||id==="rightAft"||id==="centerRight")?"transfer2":"transfer1";
   const v=electricalV7Result.bus[bus],operational=open?false:v===null?null:Boolean(raw.operational&&v);
   overlay.fuel[id]={selected:raw.switchOn,operational,
    lowPressure:open?(id.startsWith("center")?Boolean(raw.switchOn):true):operational===null?null:id.startsWith("center")?Boolean(raw.switchOn)&&!operational:!operational,
    cbOpen:open,surrogateBus:bus,trainingBusPower:v,upstreamTrainingAssumption:"TRAINER_SURROGATE_NOT_EP_FSI_WIRING",
    effectClassification:open?"TRAINING_CIRCUIT_ISOLATION":"TRAINING_SURROGATE_V7_FEED"};
  }else if(domain==="hyd"&&(id==="elecA"||id==="elecB")){
   const bus=id==="elecA"?"generator2":"generator1";
   const v=electricalV7Result.bus[bus],raw=trainerResult&&trainerResult.hyd&&trainerResult.hyd[id];
   const faults=trainerState&&trainerState.faults||{};
   const failed=Boolean(faults[id+"Failed"]||faults[id+"Overheat"]);
   const running=open?false:v===null?null:!v?false:raw?Boolean(raw.switchOn&&!raw.overheat&&!failed&&v):null;
   overlay.hyd[id]={operating:running,lowPressure:running===null?null:!running,cbOpen:open,feedBus:bus,
    source:"CLASSIC_MRG_P330_GENERIC; EP_FSI_EFFECTIVITY_UNVERIFIED",
    effectClassification:open?"PROTECTED_ELECTRIC_PUMP_CIRCUIT_OPEN":"GENERATOR_BUS_SUPPLY_TEST"};
  }else{
   if(!overlay[domain])overlay[domain]={};
   overlay[domain][id]={operational:null,cbOpen:open,effectClassification:c.effect,
    affectedPart:c.role,devicePower:"UNKNOWN",sourceScope:"INDEX_NOT_FULL_EQUIPMENT_FAILURE"};
  }
 }
 if(trainerState&&trainerState.controls&&trainerState.controls.engineHyd){
  const ctrl=trainerState.controls,ha=overlay.hyd.elecA,hb=overlay.hyd.elecB;
  overlay.systemHyd.A=Boolean(ctrl.engineHyd.A&&ctrl.engine1Running)?true:ha?.operating??null;
  overlay.systemHyd.B=Boolean(ctrl.engineHyd.B&&ctrl.engine2Running)?true:hb?.operating??null;
  overlay.systemHydStatus="TRAINING_ENGINE_DRIVEN_OR_ELECTRIC_PUMP";
 }
 if(trainerResult&&trainerResult.fuel){
  const f=overlay.fuel;
  const low=(a,b)=>Boolean(f[a]?.lowPressure&&f[b]?.lowPressure);
  const ctr=Boolean((f.centerLeft?.lowPressure&&f.centerLeft?.selected)||(f.centerRight?.lowPressure&&f.centerRight?.selected));
  const caution=low("leftFwd","leftAft")||low("rightFwd","rightAft")||ctr;
  const lamp=circuits["warning.fuelLamp"];
  overlay.annunciations.fuelCautionTraining=caution;
  overlay.annunciations.fuelLampTraining=lamp?.protectionCircuit==="OPEN"?false:caution;
  overlay.annunciations.fuelLampPowerEvidence="TRAINING INDICATION ONLY; OPEN CB SUPPRESSES DISPLAY, NOT UNDERLYING LOW PRESSURE";
  overlay.annunciations.status="DERIVED_TRAINING_ONLY_NOT_QRH_CERTIFIED";
 }
 return {schema:"B737_CB_SYSTEM_EFFECT_V1",source:SOURCE,claims:CATALOG_WARNING,
  linkedEquipment:results.length,quarantined:QUARANTINED.length,circuits,overlay,originalV7BusesUnmodified:true};
}
return Object.freeze({SOURCE,BASE,ALLOCATIONS,QUARANTINED,project,protectedCircuits});
});