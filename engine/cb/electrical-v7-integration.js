/* CB → electrical V7 → subsystem projection (B737 Classic, source-located).
 * This module intentionally does NOT infer bus-to-CB connections.
 * MRG page 136 identifies protected equipment; FCOM covers upstream buses.
 * Open CB always opens that protection circuit, but equipment availability is
 * "UNKNOWN" if redundancy/effectivity or upstream bus has not been verified.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.B737CBSystemsBridge=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const SOURCE=Object.freeze({mrg:"B737 MRG Classic electrical CB index, printed p.136 (PDF p.145)",fcom:"Sepehran 737 Classic FCOM 6.20.1–12 (PDF pp.1150–1161)"});
const ALLOCATIONS=Object.freeze([
  {key:"P6-3|ALL|B3",load:"fuel.rightFwd",label:"RIGHT MAIN FWD BOOST PUMP",bus:null,location:"MRG p.136 Fuel Boost Pumps Forward P6-3 B3/B7; photograph P6-3 B3"},
  {key:"P6-3|ALL|B7",load:"fuel.leftFwd",label:"LEFT MAIN FWD BOOST PUMP",bus:null,location:"MRG p.136 Fuel Boost Pumps Forward P6-3 B3/B7; photograph P6-3 B7"},
  {key:"P6-3|ALL|C3",load:"fuel.rightAft",label:"RIGHT MAIN AFT BOOST PUMP",bus:null,location:"MRG p.136 Fuel Boost Pumps Aft P6-3 C3/C7; photograph P6-3 C3"},
  {key:"P6-3|ALL|C7",load:"fuel.leftAft",label:"LEFT MAIN AFT BOOST PUMP",bus:null,location:"MRG p.136 Fuel Boost Pumps Aft P6-3 C3/C7; photograph P6-3 C7"},
  {key:"P6-3|ALL|D5",load:"fuel.centerRight",label:"RIGHT CENTER BOOST PUMP",bus:null,location:"MRG p.136 Fuel Boost Pumps Center P6-3 D5/E5; photograph P6-3 D5"},
  {key:"P6-3|ALL|E5",load:"fuel.centerLeft",label:"LEFT CENTER BOOST PUMP",bus:null,location:"MRG p.136 Fuel Boost Pumps Center P6-3 D5/E5; photograph P6-3 E5"},
  {key:"P18-2|ALL|D12",load:"com.vhf1",label:"VHF COM 1",bus:null,location:"MRG p.135 VHF 1 P18-2 D12; photograph P18-2 D12"},
  {key:"P6-1|ALL|C2",load:"com.vhf2",label:"VHF COM 2",bus:null,location:"MRG p.135 VHF 2 P6-1 C2; photograph P6-1 C2"},
  {key:"P18-1|ALL|A1",load:"nav.vorloc1",label:"VOR/LOC 1",bus:null,location:"MRG p.135 VOR/LOC 1 P18-1 A1; photograph P18-1 A1"}
]);
const CATALOG_WARNING="The photographed CB label and MRG equipment index establish functional association only; individual bus feed and alternate/backup power path have not been validated for EP-FSI.";
function assertNetwork(net){if(!net||typeof net.state!=="function")throw Error("CB network required");}
function protectedCircuits(net,electricalResult){
 assertNetwork(net);
 if(!electricalResult||electricalResult.schema!=="B737_ELECTRICAL_V7_RESULT")throw Error("Electrical V7 evaluation required");
 return ALLOCATIONS.map(def=>{
   const b=net.state(def.key);
   if(!b)throw Error("Missing protected CB "+def.key);
   const open=Boolean(b.pulled||b.tripped);
   return {key:def.key,load:def.load,label:def.label,rating:b.rating,protectionCircuit:open?"OPEN":"CLOSED",
     electricalBus:"UNKNOWN_UNTRACED",devicePower:open?false:null,
     effect:open?"PROTECTED_CIRCUIT_INTERRUPTED":"EQUIPMENT_UPSTREAM_UNVERIFIED",
     confidence:"MRG_EQUIPMENT_ASSOCIATION_ONLY",source:SOURCE.mrg,sourceDetail:def.location};
 });
}
function project({cbNetwork,electricalV7Result,trainerResult=null}){
 const results=protectedCircuits(cbNetwork,electricalV7Result);
 const circuits=Object.fromEntries(results.map(x=>[x.load,x]));
 const overlay={fuel:{},com:{},nav:{},bus:electricalV7Result.bus,rectifiers:electricalV7Result.feed.tr,annunciations:{},powerAssumptions:"NONE_ADDED"};
 for(const c of results){
  const [domain,id]=c.load.split(".");
  if(domain==="fuel"){
   if(trainerResult&&trainerResult.fuel&&trainerResult.fuel[id]){
    const raw=trainerResult.fuel[id];
    // This is a dedicated, clearly labeled trainer projection: open circuit
    // inhibits the simulated pump, no change to source state or other loads.
    const interrupted=c.protectionCircuit==="OPEN";
    const surrogateBus=(id==="rightFwd"||id==="rightAft"||id==="centerRight")?"transfer2":"transfer1";
    const trainingBusPower=electricalV7Result.bus[surrogateBus];
    const operational=interrupted?false:trainingBusPower===null?null:Boolean(raw.operational&&trainingBusPower);
    overlay.fuel[id]={selected:raw.switchOn,operational,
      lowPressure:interrupted?(id.startsWith("center")?Boolean(raw.switchOn):true):operational===null?null:(id.startsWith("center")?Boolean(raw.switchOn)&&!operational:!operational),
      cbOpen:interrupted,surrogateBus,trainingBusPower,upstreamTrainingAssumption:"TRAINER_SURROGATE_NOT_EP_FSI_WIRING",
      effectClassification:interrupted?"TRAINING_CIRCUIT_ISOLATION":"TRAINING_SURROGATE_V7_FEED"};
   }else{
    overlay.fuel[id]={operational:null,cbOpen:c.protectionCircuit==="OPEN",
      effectClassification:c.effect};
   }
  }else overlay[domain][id]={operational:null,cbOpen:c.protectionCircuit==="OPEN",effectClassification:c.effect};
 }
 if(trainerResult&&trainerResult.fuel){
  const F=overlay.fuel;
  const pair=(a,b)=>Boolean(F[a]&&F[a].lowPressure&&F[b]&&F[b].lowPressure);
  const center=Boolean((F.centerLeft&&F.centerLeft.lowPressure&&F.centerLeft.selected)||(F.centerRight&&F.centerRight.lowPressure&&F.centerRight.selected));
  overlay.annunciations.fuelCautionTraining=pair("leftFwd","leftAft")||pair("rightFwd","rightAft")||center;
  overlay.annunciations.status="DERIVED_TRAINING_ONLY_NOT_QRH_CERTIFIED";
 }
 return {schema:"B737_CB_SYSTEM_EFFECT_V1",source:SOURCE,claims:CATALOG_WARNING,linkedEquipment:results.length,
   circuits,overlay,originalV7BusesUnmodified:true};
}
return Object.freeze({SOURCE,ALLOCATIONS,project,protectedCircuits});
});