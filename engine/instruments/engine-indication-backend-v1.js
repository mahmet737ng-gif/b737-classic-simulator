/* Source-indexed B737 Classic engine indication read model. Training only, no visual mutations. */
(function(root,factory){"use strict";const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.B737EngineIndicationsV1=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){"use strict";
 const schema="b737classic.engine-indications/1";
 const validMode=new Set(["EIS","CONVENTIONAL"]);
 const finite=x=>typeof x==="number"&&Number.isFinite(x);
 const copy=x=>JSON.parse(JSON.stringify(x));
 function validate(database){
  if(database?.schema!=="b737classic.engine-indication-technical-data/1"||!database.instruments)throw Error("Technical database required");
  for(const [name,rec] of Object.entries(database.instruments)){
   for(const mode of validMode)for(const side of [1,2]){
    if(typeof rec.wiring?.[mode]?.[side]?.bus!=="string")throw Error("Missing bus map "+name);
   }
  }return true;
 }
 function busPower(electrical,bus){
  const map=electrical?.bus||electrical;
  return typeof map?.[bus]==="boolean"?map[bus]:null;
 }
 function sensor(observed,side,param,unit){
  const s=observed?.["engine"+side]?.[param];
  if(s===undefined||s===null)return {valid:null,value:null,reason:"MISSING"};
  if(s.valid===false)return {valid:false,value:null,reason:s.reason||"SENSOR_INVALID"};
  if(s.valid!==true||!finite(s.value)||s.unit!==unit||typeof s.origin!=="string"||!s.origin)
   return {valid:false,value:null,reason:"BAD_SENSOR_ENVELOPE"};
  return {valid:true,value:s.value,origin:s.origin,quality:s.quality||"UNVERIFIED"};
 }
 function indicatedValue(param,mode,v,db){
  return mode==="CONVENTIONAL"&&param==="oilQuantity"?
   Number((v*db.laws.oilQuantityConversion.conventionalFullUSGApprox/100).toFixed(3)):v;
 }
 function resolve({param,mode,reading,feed,unitFault,channelFault,previous,dtMs,db,electrical}){
  const pow=busPower(electrical,feed.bus);
  const old=previous||{};
  const res={status:"UNKNOWN",unit:db.instruments[param].displayUnits[mode],
   inputValue:reading.valid===true?reading.value:null,value:null,
   pointer:"UNKNOWN",digital:"UNKNOWN",powerBus:feed.bus,
   power:pow===null?"UNKNOWN":pow?"ON":"OFF",
   feedQuality:feed.quality,origin:reading.origin||null,
   lastValue:finite(old.lastValue)?old.lastValue:null,invalidElapsedMs:0,reason:null};
  if(mode==="EIS"&&unitFault)return {...res,status:"UNIT_FAILED",pointer:"BLANK",digital:"BLANK"};
  if(pow===false){
   if(mode==="EIS"&&feed.quality!=="MRG_FUNCTIONAL_CHANNEL")
    return {...res,status:"POWER_EFFECT_UNVERIFIED",reason:"Secondary EIS unit pin / AVM feed not confirmed"};
   if(mode==="CONVENTIONAL"&&param==="oilPressure")
    return {...res,status:"POWER_LOSS",pointer:"HOLD_LAST",digital:"N_A",value:res.lastValue};
   return {...res,status:"POWER_LOSS",pointer:mode==="EIS"?"BLANK":"OFF_SCALE",digital:"BLANK"};
  }
  if(pow===null)return {...res,status:"POWER_UNKNOWN"};
  if(channelFault||reading.valid===false){
   const elapsed=(old.status==="SENSOR_FAILURE_TRANSIENT"?old.invalidElapsedMs:0)+dtMs;
   if(mode==="EIS"&&db.instruments[param].section==="primary"&&elapsed<db.eis.primaryFailureHoldMs)
    return {...res,status:"SENSOR_FAILURE_TRANSIENT",pointer:"LOW_STOP",digital:"LOW_STOP",value:0,invalidElapsedMs:elapsed};
   return {...res,status:"SENSOR_FAILED",pointer:mode==="EIS"?"HIDDEN":"OFF_SCALE",
    digital:mode==="EIS"?"DASHES":"BLANK",invalidElapsedMs:elapsed};
  }
  if(reading.valid===null)return {...res,status:"NO_SENSOR_DATA"};
  const value=indicatedValue(param,mode,reading.value,db);
  const digital=mode==="EIS"||["n1","n2","fuelFlow"].includes(param)?"VALUE":"N_A";
  return {...res,status:"VALID",value,lastValue:value,pointer:"TRACKING",digital};
 }
 function lamp(input,bus,electrical){
  const powered=busPower(electrical,bus);
  return {state:powered===null?"POWER_UNKNOWN":!powered?"UNPOWERED":input===null?"UNKNOWN":input?"ON":"OFF",
   requestedOn:input,powerBus:bus};
 }
 function hysteresis(psi,prior,law){
  if(!finite(psi))return null;
  if(psi<=law.onAtOrBelowPsi)return true;
  if(psi>=law.offAtOrAbovePsi)return false;
  return typeof prior==="boolean"?prior:null;
 }
 function approvedLimit(limits,param,side){
  const raw=limits?.[param]?.[side]??limits?.[param];
  return raw?.valid===true&&finite(raw.value)&&typeof raw.origin==="string"&&raw.origin?
    {value:raw.value,origin:raw.origin}:null;
 }
 function calculate(database,{mode="EIS",electrical=null,observed={},faults={},previous=null,dtMs=0,
  limits={},fuelMode="RATE",resetFuelUsed=false,filterBypassThresholdPsid=null}={}){
  validate(database);
  if(!validMode.has(mode))throw Error("Unsupported instrument mode");
  if(!Number.isInteger(dtMs)||dtMs<0||dtMs>60000)throw Error("Invalid timestep");
  if(!["RATE","USED"].includes(fuelMode))throw Error("Unsupported fuel display mode");
  const result={schema,revision:database.revision,mode,engines:{},fuelUsedKg:{},bite:{},
   quality:"SOURCE_INDEXED_TRAINING_NOT_WDM_CERTIFIED"};
  for(const side of [1,2]){
   const id="engine"+side,prior=previous?.engines?.[id]||{},indications={},warning={};
   for(const [param,rec] of Object.entries(database.instruments)){
    const input=sensor(observed,side,param,rec.unit),feed=rec.wiring[mode][side];
    const unitFault=Boolean(faults[mode==="EIS"?(rec.section==="primary"?"eisPrimary":"eisSecondary"):"none"]);
    indications[param]=resolve({param,mode,reading:input,feed,unitFault,
      channelFault:Boolean(faults[param+"."+side]),previous:prior.indications?.[param],dtMs,db:database,electrical});
   }
   let used=resetFuelUsed?0:finite(previous?.fuelUsedKg?.[id])?previous.fuelUsedKg[id]:0;
   const flow=sensor(observed,side,"fuelFlow","kg/h");
   if(!resetFuelUsed&&flow.valid===true&&flow.value>=0)used+=flow.value*dtMs/3600000;
   result.fuelUsedKg[id]=Number(used.toFixed(5));
   indications.fuelFlow.fuelMode=fuelMode;
   indications.fuelFlow.fuelUsedKg=result.fuelUsedKg[id];
   indications.fuelFlow.digitalValue=indications.fuelFlow.status==="VALID"?
     (fuelMode==="USED"?result.fuelUsedKg[id]:flow.value):null;
   const oil=sensor(observed,side,"oilPressure","psi");
   warning.lowOilPressure=lamp(hysteresis(oil.value,prior.warnings?.lowOilPressure?.requestedOn,
    database.laws.oilPressureLamp),"battery",electrical);
   const extra=observed?.[id]||{};
   const pressureDrop=extra.oilFilterDeltaPsid;
   warning.oilFilterBypass=lamp(finite(pressureDrop)&&finite(filterBypassThresholdPsid)?
    pressureDrop>=filterBypassThresholdPsid:null,"battery",electrical);
   warning.startValveOpen=lamp(typeof extra.startValveOpen==="boolean"?extra.startValveOpen:null,"battery",electrical);
   warning.reverserUnlocked=lamp(typeof extra.reverserUnlocked==="boolean"?extra.reverserUnlocked:null,"battery",electrical);
   for(const p of ["n1","n2","egt","oilTemperature"]){
    const threshold=approvedLimit(limits,p,side),r=indications[p];
    const exceeded=threshold&&r.status==="VALID"?r.inputValue>=threshold.value:null;
    warning[p+"Overlimit"]={...lamp(exceeded,r.powerBus,electrical),limit:threshold,
      limitQuality:threshold?"EXPLICIT_LIMIT":"UNKNOWN_EFFECTIVITY"};
   }
   result.engines[id]={indications,warnings:warning};
  }
  if(mode==="EIS"){
   const check=(param,limit)=>[1,2].every(side=>{
    const r=result.engines["engine"+side].indications[param];
    return r.status==="VALID"&&r.inputValue<limit;
   });
   result.bite={primaryEligible:check("n1",database.eis.primaryBiteBothN1Below),
    secondaryEligible:check("oilPressure",database.eis.secondaryBiteBothOilPsiBelow)};
  }
  return result;
 }
 function fromEcu(snapshot){
  const result={engine1:{},engine2:{}};
  if(snapshot?.quality!=="TRAINING_SIMULATION_ONLY")return result;
  const map={n1:["n1Percent","%"],n2:["n2Percent","%"],egt:["egtC","°C"],
   fuelFlow:["fuelFlowKgHr","kg/h"],oilPressure:["oil.pressurePsi","psi"],
   oilTemperature:["oil.temperatureC","°C"],oilQuantity:["oil.quantityPct","%FULL"]};
  for(const id of Object.keys(result)){
   const entry=snapshot.engines?.[id];if(!entry)continue;
   for(const [param,[path,unit]] of Object.entries(map)){
    const val=path.split(".").reduce((obj,k)=>obj?.[k],entry);
    if(finite(val))result[id][param]={value:val,unit,valid:true,origin:"ISN13_18_ECU",quality:"TRAINING_SIMULATION_ONLY"};
   }
   if(typeof entry.startValveOpen==="boolean")result[id].startValveOpen=entry.startValveOpen;
  }
  return result;
 }
 return Object.freeze({schema,validate,busPower,sensor,calculate,fromEcu});
});
