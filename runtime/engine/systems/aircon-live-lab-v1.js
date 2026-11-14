/* AIRCON-LIVE-LAB-0001: isolated OH21 B737 Classic pneumatic fault bench.
 * Uses exact existing Pneumatics V6 + Duct Pressure estimator and the shared
 * five-second OVHT qualifier. Not an aircraft-certified equipment test.
 * No commands ever leave this lab model for the operational Unified ECU.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737AirconLiveLabV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const FAMILIES=Object.freeze(['B737-300-500','B737-400']);
 const GROUPS=Object.freeze([
  Object.freeze({name:'WING–BODY DETECTION & TEST',family:'BOTH',entries:Object.freeze([
   ['wingBodyLLeakDetected','L WING–BODY duct leak / real overheat','SENSOR'],
   ['wingBodyRLeakDetected','R WING–BODY duct leak / real overheat','SENSOR'],
   ['wingBodyLDetectorFailed','L OVHT TEST detector circuit open','SENSOR'],
   ['wingBodyRDetectorFailed','R OVHT TEST detector circuit open','SENSOR']
  ])}),
  Object.freeze({name:'BLEED AIR & VALVES',family:'BOTH',entries:Object.freeze([
   ['bleed1Overlimit','ENG 1 BLEED overpressure / overtemperature','SENSOR'],
   ['bleed2Overlimit','ENG 2 BLEED overpressure / overtemperature','SENSOR'],
   ['engineBleed1ValveFailed','ENG 1 BLEED valve fail closed','FAULT'],
   ['engineBleed2ValveFailed','ENG 2 BLEED valve fail closed','FAULT'],
   ['apuBleedValveFailed','APU BLEED valve fail','FAULT'],
   ['isolationJammedOpen','ISOLATION valve jammed OPEN','FAULT'],
   ['isolationJammedClosed','ISOLATION valve jammed CLOSED','FAULT'],
   ['bleedValveControlPower','BLEED VALVE control supply lost','INVERTED_SENSOR'],
   ['isolationAcPower','ISOLATION AC power lost','INVERTED_SENSOR']
  ])}),
  Object.freeze({name:'PACKS & DUCT',family:'BOTH',entries:Object.freeze([
   ['packLOverheat','L PACK overheat / PACK TRIP','SENSOR'],
   ['packROverheat','R PACK overheat / PACK TRIP','SENSOR'],
   ['packLValveFailed','L PACK valve stuck / failed','FAULT'],
   ['packRValveFailed','R PACK valve stuck / failed','FAULT'],
   ['ductGaugeAcPower','DUCT PRESSURE indicator AC supply lost','INVERTED_SENSOR']
  ])}),
  Object.freeze({name:'DUCT OVERHEAT · 737-300/500',family:'B737-300-500',entries:Object.freeze([
   ['ductLOverheat','L DUCT OVERHEAT · FULL COLD','SENSOR'],
   ['ductROverheat','R DUCT OVERHEAT · FULL COLD','SENSOR']
  ])}),
  Object.freeze({name:'PACK CONTROLLERS · 737-400',family:'B737-400',entries:Object.freeze([
   ['packLPrimaryControlFailed','L PACK primary controller fail · RECALL','SENSOR'],
   ['packLStandbyControlFailed','L PACK standby controller fail · RECALL','SENSOR'],
   ['packRPrimaryControlFailed','R PACK primary controller fail · RECALL','SENSOR'],
   ['packRStandbyControlFailed','R PACK standby controller fail · RECALL','SENSOR']
  ])}),
  Object.freeze({name:'ZONE TEMPERATURE · 737-400',family:'B737-400',entries:Object.freeze([
   ['zoneContOverheat','CONT CAB ZONE TEMP overheat','SENSOR'],
   ['zoneFwdOverheat','FWD CAB ZONE TEMP overheat','SENSOR'],
   ['zoneAftOverheat','AFT CAB ZONE TEMP overheat','SENSOR'],
   ['contPrimaryTempControlFailed','CONT CAB primary controller fail · RECALL','SENSOR'],
   ['contStandbyTempControlFailed','CONT CAB standby controller fail · RECALL','SENSOR'],
   ['fwdTempControlFailed','FWD CAB temperature controller fail · RECALL','SENSOR'],
   ['aftTempControlFailed','AFT CAB temperature controller fail · RECALL','SENSOR']
  ])}),
  Object.freeze({name:'RECIRC FANS · CONTROL POWER',family:'BOTH',entries:Object.freeze([
   ['recircFanFailed','Single RECIRC fan failure · 300/500','FAULT'],
   ['recircFanLFailed','L RECIRC fan failure · 400','FAULT'],
   ['recircFanRFailed','R RECIRC fan failure · 400','FAULT'],
   ['recircAcPower','RECIRC AC supply lost','INVERTED_SENSOR']
  ])})
 ]);
 const SOURCES=Object.freeze([
  ['engine1Running','ENG 1 bleed source running'],
  ['engine2Running','ENG 2 bleed source running'],
  ['apuRunning','APU air source running'],
  ['externalAirAvailable','Ground pneumatic air cart attached']
 ]);
 const LAMP_IDS=Object.freeze(['wing-body-overheat-l','wing-body-overheat-r',
  'bleed-trip-l','bleed-trip-r','pack-trip-l','pack-trip-r',
  'duct-overheat-l','duct-overheat-r','dual-bleed']);
 const LAMP_MODES=Object.freeze(['NORMAL','LAMP_OPEN','LAMP_STUCK_ON','DIM_LAMP']);
 const SCENARIOS=Object.freeze([
  ['healthy','NORMAL / RESET ALL',[]],
  ['wing-l','L WING–BODY OVHT',[['wingBodyLLeakDetected',true]]],
  ['wing-r','R WING–BODY OVHT',[['wingBodyRLeakDetected',true]]],
  ['ovht-l-detector','L OVHT DETECTOR OPEN',[['wingBodyLDetectorFailed',true]]],
  ['ovht-r-detector','R OVHT DETECTOR OPEN',[['wingBodyRDetectorFailed',true]]],
  ['bleed-l','L BLEED TRIP OFF',[['bleed1Overlimit',true]]],
  ['bleed-r','R BLEED TRIP OFF',[['bleed2Overlimit',true]]],
  ['pack-l','L PACK TRIP',[['packLOverheat',true]]],
  ['pack-r','R PACK TRIP',[['packROverheat',true]]],
  ['duct-l','L DUCT OVERHEAT',[['ductLOverheat',true]]],
  ['duct-r','R DUCT OVERHEAT',[['ductROverheat',true]]],
  ['400-cont','400 CONT CAB ZONE TEMP',[['zoneContOverheat',true]]],
  ['400-fwd','400 FWD CAB ZONE TEMP',[['zoneFwdOverheat',true]]],
  ['400-aft','400 AFT CAB ZONE TEMP',[['zoneAftOverheat',true]]],
  ['400-pack-l-primary','400 L PACK PRIMARY FAIL · RECALL',[['packLPrimaryControlFailed',true]]],
  ['400-pack-l-dual','400 L PACK BOTH CONTROLLERS',[['packLPrimaryControlFailed',true],['packLStandbyControlFailed',true]]],
  ['both-wing','BOTH WING–BODY DETECTORS',[['wingBodyLLeakDetected',true],['wingBodyRLeakDetected',true]]],
  ['apu-valve','APU BLEED VALVE FAILED',[['apuBleedValveFailed',true]]],
  ['left-pack-valve','L PACK VALVE FAILED',[['packLValveFailed',true]]],
  ['isolation-stuck','ISOLATION STUCK CLOSED',[['isolationJammedClosed',true]]]
 ]);
 const catalog=Object.freeze(Object.fromEntries(GROUPS.flatMap(g=>g.entries.map(([id,label,kind])=>[id,{id,label,kind,family:g.family}]))));
 function create({P,pressure,qualification,clock=()=>performance.now(),
  schedule=(f,ms)=>setTimeout(f,ms),cancel=id=>clearTimeout(id),onChange=()=>{}}={}){
  if(!P?.apply||!P?.derive||!qualification?.create)throw Error('Pneumatics V6 and OVHT timing kernel required');
  let state=P.initial(),lampFaults={},lastPreset='healthy';
  const apply=command=>{state=P.apply(state,command);onChange();return state};
  const qualifier=qualification.create({
   clock,schedule,cancel,
   onQualified:()=>apply({type:'SENSOR',key:'wingBodyTestHeld',value:true}),
   onReleased:()=>apply({type:'SENSOR',key:'wingBodyTestHeld',value:false})
  });
  function setFamily(value){
   if(!FAMILIES.includes(value))throw Error('Invalid Classic panel variant');
   if(state.controls.aircraftFamily!==value)apply({type:'CONTROL',key:'aircraftFamily',value});
   return value;
  }
  function inject(id,active){
   const item=catalog[id];
   if(!item||typeof active!=='boolean')throw Error('Unknown air-conditioning failure');
   const type=item.kind;
   if(type==='FAULT')apply({type:'FAULT',id,active,instructor:true});
   else apply({type:'SENSOR',key:id,value:type==='INVERTED_SENSOR'?!active:active});
   return active;
  }
  function selected(id){
   const entry=catalog[id];if(!entry)return false;
   return entry.kind==='FAULT'?state.faults[id]===true:
    entry.kind==='INVERTED_SENSOR'?state.inputs[id]===false:state.inputs[id]===true;
  }
  function source(id,active){
   if(!SOURCES.some(([key])=>key===id)||typeof active!=='boolean')throw Error('Unknown air source');
   if(state.inputs[id]!==active)apply({type:'SENSOR',key:id,value:active});
  }
  function control(id,value){
   if(!P.CONTROL_TYPES[id]?.includes(value))throw Error('Unsupported pneumatic switch/detent');
   if(state.controls[id]!==value)apply({type:'CONTROL',key:id,value});
  }
  function reset(){
   qualifier.release();
   const family=state.controls.aircraftFamily;
   state=P.initial();
   if(family!==state.controls.aircraftFamily)state=P.apply(state,{type:'CONTROL',key:'aircraftFamily',value:family});
   lampFaults={};lastPreset='healthy';onChange();
  }
  function preset(id){
   const entry=SCENARIOS.find(s=>s[0]===id);
   if(!entry)throw Error('Unknown air-conditioning failure preset');
   reset();
   for(const [key,active] of entry[2])inject(key,active);
   lastPreset=id;onChange();
  }
  function lamp(id,mode){
   if(!LAMP_IDS.includes(id)||!LAMP_MODES.includes(mode))throw Error('Invalid lamp failure');
   if(mode==='NORMAL')delete lampFaults[id];
   else lampFaults[id]=mode;
   onChange();
  }
  function testPress(){return qualifier.press()}
  function testRelease(){return qualifier.release()}
  function tripReset(){return apply({type:'TRIP_RESET'})}
  function snapshot(){
   const d=P.derive(state);
   const modeledLamps=Object.entries(d.lamps).map(([id,on])=>({id,on}));
   const immediate=d.lamps.wingBodyOverheatL||d.lamps.wingBodyOverheatR||
    d.lamps.bleedTrip1||d.lamps.bleedTrip2||d.lamps.packTripL||d.lamps.packTripR||
    d.lamps.ductOverheatL||d.lamps.ductOverheatR||
    (state.controls.aircraftFamily==='B737-400'&&
     Object.values(d.zoneTemp400).some(z=>z.immediate));
   const recall=state.controls.aircraftFamily==='B737-400'&&(
    Object.values(d.pack400).some(p=>p.recallOnly)||
    Object.values(d.zoneTemp400).some(z=>z.recallOnly));
   let pressures=null;
   if(pressure?.project){
    try{const ecu={engines:{
      engine1:{phase:state.inputs.engine1Running?'RUNNING':'OFF',n1Percent:32},
      engine2:{phase:state.inputs.engine2Running?'RUNNING':'OFF',n1Percent:32}},
     apu:{phase:state.inputs.apuRunning?'READY':'OFF'}};
     pressures=pressure.project({ecu,bleed:d.bleed,controls:state.controls,pack:d.pack,
      sensors:{L:state.inputs.ductLeftPsi,R:state.inputs.ductRightPsi},
      gaugePowered:state.inputs.ductGaugeAcPower});
    }catch{pressures=null}
   }
   return {state,derived:d,test:qualifier.snapshot(),faults:Object.fromEntries(
    Object.keys(catalog).map(id=>[id,selected(id)])),
    lamps:modeledLamps,lampFaults:{...lampFaults},immediateCaution:!!immediate,
    recallOnly:!!recall,pressures,preset:lastPreset};
  }
  return Object.freeze({setFamily,inject,selected,source,control,reset,preset,lamp,
   testPress,testRelease,tripReset,snapshot});
 }
 return Object.freeze({FAMILIES,GROUPS,SOURCES,LAMP_IDS,LAMP_MODES,SCENARIOS,catalog,create});
});
