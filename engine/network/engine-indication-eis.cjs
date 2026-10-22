'use strict';
/**
 * ISN-09, EP-FSI EIS primary+secondary (FCOM 7.10.3-11 pp1174-1182).
 * Values are observations, never synthetic N1/EGT/OIL/FF dynamics.
 * Source-derived static AFM limits from FCOM L.10.7 PDF86; installed
 * AFM 20K effectivity/performance-engine transient limits still pending.
 */
const SOURCE='FCOM-SEPEHRAN-1937';
const source=(section,pdfPage)=>({sourceId:SOURCE,section,pdfPage,configuration:'EIS FSI'});
const ENGINE_IDS=['1','2'];
const NAMES=['n1Pct','n2Pct','egtC','fuelFlowKgHr','oilPressurePsi','oilTempC','oilQtyPct','vibration'];
const PRIMARY=['n1Pct','egtC','n2Pct','fuelFlowKgHr'];
const SECONDARY=['oilPressurePsi','oilTempC','oilQtyPct','vibration'];
const RANGES={
 n1Pct:[0,120,'%',106,'7.10.3',1174],
 n2Pct:[0,120,'%',105,'7.10.5',1176],
 egtC:[-100,1300,'°C',930,'7.10.4-5',1175],
 fuelFlowKgHr:[0,20000,'kg/h',null,'7.10.6-7',1177],
 oilPressurePsi:[0,200,'psi',null,'7.10.9-10',1180],
 oilTempC:[-100,250,'°C',165,'7.10.10',1181],
 oilQtyPct:[0,100,'%FULL',null,'7.10.10-11',1181],
 vibration:[0,5,'VIB',null,'7.10.11',1182]
};
const LIMITS=Object.freeze({
 n1MaxPct:106,n2MaxPct:105,
 egtStartMaxC:725,egtContinuousMaxC:895,egtTakeoffMaxC:930,
 oilPressureMinPsi:13,oilTempContinuousMaxC:160,oilTempAbsoluteMaxC:165,
 oilHighTempMaxSeconds:900
});
function id(v){if(!ENGINE_IDS.includes(String(v)))throw new TypeError('invalid engine ID');return String(v);}
function key(v){if(!NAMES.includes(v))throw new TypeError('unknown instrument: '+String(v));return v;}
function numberOrNull(v,k){
 if(v===null)return null;
 const [min,max]=RANGES[k];
 if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new TypeError(k+' must be measured finite number within engineering input envelope, or null');
 return v;
}
function initializeIndications(){
 const channel=()=>Object.fromEntries(NAMES.map(k=>[k,{
   value:null,signal:'VALID',lossElapsedSeconds:0
 }]));
 const data=()=>({channels:channel(),fuelUsedKg:null,
   displayMode:'FLOW',modeRemainingSeconds:0,oilHighTempSeconds:0});
 return {schema:'b737cl-eis-fsi-v1',engines:{'1':data(),'2':data()}};
}
function instrumentAction(state,action){
 const k=key(action.instrument),s=state.engines[id(action.engine)];
 if(action.type==='SET_ENGINE_INDICATION'){
   // N2 and EGT are owned by the ISN-06/07 engine kernel to prevent
   // a second contradictory sensor source.
   if(k==='n2Pct'||k==='egtC')throw new Error(k+' must be changed using the authoritative engine sensor command');
   s.channels[k].value=numberOrNull(action.value,k);
 }else if(action.type==='SET_INSTRUMENT_SIGNAL'){
   if(!['VALID','SIGNAL_LOSS','INTERNAL_FAILURE'].includes(action.value))throw new TypeError('invalid EIS signal quality');
   if(s.channels[k].signal!==action.value){
     s.channels[k].signal=action.value;
     s.channels[k].lossElapsedSeconds=0;
   }
 }else throw new TypeError('unknown EIS command');
}
function panelButton(state,action){
 const s=state.engines[id(action.engine)];
 if(action.type==='PUSH_FUEL_USED'){
   s.displayMode='USED';s.modeRemainingSeconds=10;
 }else if(action.type==='RESET_FUEL_USED'){
   s.displayMode='RESET_PREVIEW';s.modeRemainingSeconds=1;
 }else throw new TypeError('invalid FF/FU control');
}
function advanceIndications(state,seconds,propulsion){
 if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<0||seconds>3600)throw new TypeError('invalid elapsed seconds');
 if(propulsion.mode!=='INTEGRATED')return;
 for(const side of ENGINE_IDS){
   const s=state.engines[side];
   for(const input of Object.values(s.channels)){
     if(input.signal==='SIGNAL_LOSS')input.lossElapsedSeconds+=seconds;
   }
   const flow=s.channels.fuelFlowKgHr;
   const valid=flow.signal==='VALID'&&flow.value!==null;
   // Fuel USED is an integration of VERIFIED FUEL FLOW observations,
   // not predicted from N2 or inferred pump source.
   if(s.fuelUsedKg!==null){
     s.fuelUsedKg=valid?s.fuelUsedKg+flow.value*seconds/3600:null;
   }
   const oil=s.channels.oilTempC;
   if(oil.signal==='VALID'&&oil.value!==null){
     s.oilHighTempSeconds=oil.value>160?s.oilHighTempSeconds+seconds:0;
   }else{s.oilHighTempSeconds=0;}
   if(s.modeRemainingSeconds>0){
     s.modeRemainingSeconds=Math.max(0,s.modeRemainingSeconds-seconds);
     if(s.modeRemainingSeconds===0){
       if(s.displayMode==='RESET_PREVIEW')s.fuelUsedKg=0;
       s.displayMode='FLOW';
     }
   }
 }
}
function reading(k,channel,realValue){
 let display='VALUE',quality='MEASURED_OR_KNOWN_STATE',value=realValue;
 if(channel.signal==='INTERNAL_FAILURE'){
   display='BLANK';value=null;quality='INTERNAL_DISPLAY_FAILURE_INJECTED';
 }else if(channel.signal==='SIGNAL_LOSS'){
   display=PRIMARY.includes(k)&&channel.lossElapsedSeconds<2?'LOWER_STOP':'DASHES';
   if(SECONDARY.includes(k))display='DASHES_OR_BLANK';
   value=null;quality='SIGNAL_FAILURE_INJECTED';
 }else if(realValue===null){
   display='NO_DATA';quality='MEASUREMENT_NOT_AVAILABLE';
 }
 return {value,display,quality,unit:RANGES[k][2],
   failureElapsedSeconds:channel.lossElapsedSeconds,
   source:source(RANGES[k][4],RANGES[k][5])};
}
function evaluateIndications(indications,propulsion,phase){
 if(!indications||indications.schema!=='b737cl-eis-fsi-v1')throw new TypeError('EIS state required');
 const result={schema:'b737cl-eis-fsi-v1',mode:propulsion.mode,units:'SOURCE_UNITS_SI',engines:{},limits:LIMITS,
   source:source('7.10.3-11;L.10.7',1174),
   geometry:'EIS_FSI_PRIMARY_SECONDARY_LAYOUT_LOGIC_ONLY'};
 if(propulsion.mode!=='INTEGRATED')return result;
 for(const id of ENGINE_IDS){
   const s=indications.engines[id],engine=propulsion.engines[id];
   const values={};
   for(const k of NAMES){
     const owner=k==='n2Pct'?'ISN06_START_N2':
       k==='egtC'?'ISN07_PROTECTION_EGT':'ISN09_OBSERVED_CHANNEL';
     const external=k==='n2Pct'?engine.n2Pct:
       k==='egtC'?propulsion.protection.engines[id].egtC:
         s.channels[k].value;
     const current=propulsion.mode==='INTEGRATED'?external:null;
     values[k]={...reading(k,s.channels[k],current),owner};
   }
   const current=k=>values[k].quality==='MEASURED_OR_KNOWN_STATE'?values[k].value:null;
   const n1=current('n1Pct'),n2=current('n2Pct'),egt=current('egtC');
   const oilP=current('oilPressurePsi'),oilT=current('oilTempC');
   const starting=engine.startLever==='IDLE' && engine.phase!=='RUNNING';
   const egtLimit=starting?725:engine.phase==='RUNNING'?930:null;
   const egtRegion=egt===null?'UNKNOWN':
     egtLimit===null?'UNKNOWN_THRUST_REGIME':
     egt>=egtLimit?'RED_LIMIT':
     !starting&&egt>=895?'CONTINUOUS_LIMIT_AMBIGUOUS':'NORMAL';
   const oilPressureLow=oilP===null?null:oilP<=13;
   const fuelFlow=values.fuelFlowKgHr;
   const ff=s.displayMode==='FLOW'?
     {mode:'FLOW',value:fuelFlow.value===null?null:fuelFlow.value/1000,
      unit:'1000 kg/h',quality:fuelFlow.quality}:
     {mode:s.displayMode,value:s.fuelUsedKg,
      unit:'kg',quality:s.fuelUsedKg===null?'UNKNOWN_INTEGRATION':'ACCUMULATED_VALID_FLOW',
      remainingSeconds:s.modeRemainingSeconds};
   result.engines[id]={
     phase:engine.phase,
     primary:{n1Pct:values.n1Pct,n2Pct:values.n2Pct,egtC:values.egtC,
       fuelFlowKgHr:values.fuelFlowKgHr,ffDigital:ff},
     secondary:{oilPressurePsi:values.oilPressurePsi,oilTempC:values.oilTempC,
       oilQtyPct:values.oilQtyPct,vibration:values.vibration},
     computed:{
       n1RedLimitDemand:n1===null?null:n1>=106,
       n2RedLimitDemand:n2===null?null:n2>=105,
       egtLimitDemand:egt===null||egtLimit===null?null:egt>=egtLimit,
       egtRegion,egtLimitC:egtLimit,
       egtStartAdvisoryFlash:starting && propulsion.protection.engines[id].egtDigitalFlashDemand,
       oilPressureLowLightDemand:oilPressureLow,
       oilTempZone:oilT===null?'UNKNOWN':oilT>=165?'AT_OR_ABOVE_MAX':
         oilT>160?'CAUTION_TIME_LIMITED':'NORMAL',
       oilTempHighSeconds:s.oilHighTempSeconds,
       oilTemp15MinExceeded:s.oilHighTempSeconds>900,
       oilPressureTakeoffYellowBand:'NOT_EVALUATED_TAKEOFF_THRUST_UNVERIFIED'
     },
     fuelUsedKg:s.fuelUsedKg,
     provenance:source('7.10.3-11;L.10.7',1180)
   };
 }
 return result;
}
const INSTRUMENT_COMMANDS=new Set(['SET_ENGINE_INDICATION','SET_INSTRUMENT_SIGNAL','PUSH_FUEL_USED','RESET_FUEL_USED']);
module.exports={initializeIndications,evaluateIndications,instrumentAction,panelButton,
 advanceIndications,INSTRUMENT_COMMANDS,LIMITS,INSTRUMENT_KEYS:NAMES};
