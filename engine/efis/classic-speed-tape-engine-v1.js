/* B737 Classic EFIS Speed Tape — FCOM 10.30.13-15 / 10.40.6-8,
 * AFDS FCOM 4.10.3-6 / 4.20.32-35. Pure, event-driven training model.
 * No assumed ADC readings, performance tables, aircraft limits or certified logic.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicSpeedTapeEngineV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='SPEED-TAPE-FCOM-0001',SCHEMA='B737_CLASSIC_SPEED_TAPE_STATE_V1';
 const LIMIT_KEYS=['vmoMmoCasKt','gearPlacardKt','flapPlacardKt','minimumManeuverKt',
  'stickShakerKt','minimumAfdsKt','highSpeedBuffetKt','nextFlapPlacardKt',
  'flapRetractionKt','flapsUpManeuverKt'];
 const REF_KEYS=['v1Kt','vrKt','selectedVrefKt','landingFlaps'];
 const blankFields=keys=>Object.fromEntries(keys.map(k=>[k,null]));
 const clone=v=>JSON.parse(JSON.stringify(v));
 const isNum=v=>typeof v==='number'&&Number.isFinite(v);
 const required=(v,lo,hi,name)=>{if(!isNum(v)||v<lo||v>hi)throw Error('INVALID_'+name);return v;};
 const optional=(v,lo,hi,name)=>v===null?null:required(v,lo,hi,name);
 const within=(v)=>isNum(v)&&v>=0&&v<=600;
 function initialState(seat='CAPT'){
  if(!['CAPT','FO'].includes(seat))throw Error('INVALID_SEAT');
  return {schema:SCHEMA,version:VERSION,seat,revision:0,adc:{quality:'UNKNOWN',casKt:null,
   pressureAltitudeFt:null,lastMs:null,previousCasKt:null,accelerationKtS:null,trendVisible:false},
   mcp:{powered:null,displayBlank:true,selectedCasKt:null,speedDisplayMode:'IAS',source:'MCP'},
   fmc:{valid:false,commandCasKt:null,grossWeightAvailable:false,...blankFields(REF_KEYS)},
   config:{flapsPosition:null,gearExtended:null,inFlight:null,phase:null,flapsRetracting:null},
   limits:{valid:false,...blankFields(LIMIT_KEYS)},
   failures:{speed:false,selectedSpeed:false,v1:false,speedLimit:false,mach:false}};
 }
 function transition(old,event){
  if(old?.schema!==SCHEMA||!event||typeof event.type!=='string')throw Error('INVALID_TAPE_EVENT');
  const s=clone(old),e=event;
  if(e.type==='ADC'){
   if(typeof e.valid!=='boolean')throw Error('ADC_VALIDITY_REQUIRED');
   if(e.valid){
    const cas=required(e.casKt,0,600,'CAS_KT'),ms=required(e.timeMs,0,1e15,'TIMESTAMP');
    if(s.adc.lastMs!==null&&ms<=s.adc.lastMs)throw Error('STALE_ADC_SAMPLE');
    const previous=s.adc;
    const deltaTime=previous.lastMs===null?null:(ms-previous.lastMs)/1000;
    const acceleration=previous.quality==='VALID'&&deltaTime>=0.1&&deltaTime<=10?
     (cas-previous.casKt)/deltaTime:null;
    const difference=acceleration===null?0:10*acceleration;
    const visible=acceleration!==null&&
     (previous.trendVisible?Math.abs(difference)>=3:Math.abs(difference)>4);
    s.adc={quality:'VALID',casKt:cas,pressureAltitudeFt:e.pressureAltitudeFt==null?null:
     required(e.pressureAltitudeFt,-2000,70000,'PRESSURE_ALTITUDE'),
     lastMs:ms,previousCasKt:previous.casKt,accelerationKtS:acceleration,trendVisible:visible};
   }else{
    s.adc={quality:'INVALID',casKt:null,pressureAltitudeFt:null,lastMs:null,
     previousCasKt:null,accelerationKtS:null,trendVisible:false};
   }
  }else if(e.type==='ADC_TIMEOUT'){
   const now=required(e.nowMs,0,1e15,'TIMESTAMP');
   if(s.adc.lastMs!==null&&now-s.adc.lastMs>2000)
    s.adc={quality:'UNKNOWN',casKt:null,pressureAltitudeFt:null,lastMs:null,
     previousCasKt:null,accelerationKtS:null,trendVisible:false};
  }else if(e.type==='MCP'){
   if(![true,false,null].includes(e.powered)||typeof e.displayBlank!=='boolean'||
      !['IAS','MACH'].includes(e.speedDisplayMode))throw Error('INVALID_MCP_EVIDENCE');
   s.mcp={powered:e.powered,displayBlank:e.displayBlank,
    selectedCasKt:e.selectedCasKt==null?null:required(e.selectedCasKt,0,600,'MCP_CAS'),
    speedDisplayMode:e.speedDisplayMode,source:'MCP'};
  }else if(e.type==='FMC'){
   if(typeof e.valid!=='boolean')throw Error('INVALID_FMC_EVIDENCE');
   if(!e.valid)s.fmc={valid:false,commandCasKt:null,grossWeightAvailable:false,...blankFields(REF_KEYS)};
   else{
    if(typeof e.grossWeightAvailable!=='boolean')throw Error('FMC_WEIGHT_EVIDENCE_REQUIRED');
    const f={valid:true,grossWeightAvailable:e.grossWeightAvailable,
     commandCasKt:e.commandCasKt==null?null:required(e.commandCasKt,0,600,'FMC_COMMAND')};
    for(const k of REF_KEYS)f[k]=e[k]==null?null:
     required(e[k],0,k==='landingFlaps'?40:600,'FMC_'+k);
    s.fmc=f;
   }
  }else if(e.type==='CONFIG'){
   const config={...s.config};
   if(Object.hasOwn(e,'flapsPosition'))config.flapsPosition=optional(e.flapsPosition,0,40,'FLAPS');
   for(const k of ['gearExtended','inFlight','flapsRetracting']){
    if(Object.hasOwn(e,k)){
     if(![true,false,null].includes(e[k]))throw Error('INVALID_'+k);
     config[k]=e[k];
    }
   }
   if(Object.hasOwn(e,'phase')){
    if(![null,'GROUND','TAKEOFF','CLIMB','CRUISE','DESCENT','APPROACH','LANDING','GO_AROUND'].includes(e.phase))
     throw Error('INVALID_FLIGHT_PHASE');
    config.phase=e.phase;
   }
   s.config=config;
  }else if(e.type==='LIMITS'){
   if(typeof e.valid!=='boolean')throw Error('LIMIT_VALIDITY_REQUIRED');
   if(!e.valid)s.limits={valid:false,...blankFields(LIMIT_KEYS)};
   else{
    const o={valid:true};
    for(const k of LIMIT_KEYS)o[k]=e[k]==null?null:required(e[k],0,600,'LIMIT_'+k);
    s.limits=o;
   }
  }else if(e.type==='FAILURES'){
   for(const k of Object.keys(s.failures)){
    if(Object.hasOwn(e,k)){
     if(typeof e[k]!=='boolean')throw Error('INVALID_FAILURE_'+k);
     s.failures[k]=e[k];
    }
   }
  }else throw Error('UNKNOWN_TAPE_EVENT_'+e.type);
  s.revision+=1;return s;
 }
 function view(s){
  if(s?.schema!==SCHEMA)throw Error('INVALID_TAPE_STATE');
  const adcValid=s.adc.quality==='VALID'&&!s.failures.speed&&within(s.adc.casKt);
  const cas=adcValid?s.adc.casKt:null;
  // The ADC has a 45 kt low-speed default. Rolling digits are not displayed
  // at/below 45 kt even when a valid simulator sensor reports less.
  const tapeCenterKt=adcValid?Math.max(45,Math.min(420,cas)):null;
  const window=42;
  const range=tapeCenterKt===null?null:{minKt:tapeCenterKt-window,maxKt:tapeCenterKt+window};
  const validLimits=s.limits.valid&&!s.failures.speedLimit;
  const lim=validLimits?s.limits:blankFields(LIMIT_KEYS);
  const config=s.config;
  const maximumCandidates=[];
  if(within(lim.vmoMmoCasKt))maximumCandidates.push({reason:'VMO_MMO',speedKt:lim.vmoMmoCasKt});
  if(config.gearExtended===true&&within(lim.gearPlacardKt))
   maximumCandidates.push({reason:'GEAR',speedKt:lim.gearPlacardKt});
  if(config.flapsPosition!==null&&config.flapsPosition>0&&within(lim.flapPlacardKt))
   maximumCandidates.push({reason:'FLAPS',speedKt:lim.flapPlacardKt});
  // Unknown gear/flap configuration or an applicable missing placard must
  // never be presented as a verified safe maximum speed.
  const maxCoverage=within(lim.vmoMmoCasKt)&&
   (config.gearExtended===false||(config.gearExtended===true&&within(lim.gearPlacardKt)))&&
   (config.flapsPosition===0||(config.flapsPosition!==null&&within(lim.flapPlacardKt)));
  const limiting=maxCoverage&&maximumCandidates.length?
   maximumCandidates.reduce((a,b)=>a.speedKt<=b.speedKt?a:b):null;
  const f=s.fmc;
  const preferFmc=s.mcp.displayBlank===true;
  const commanded=f.valid&&preferFmc&&within(f.commandCasKt)?
   {source:'FMC',speedKt:f.commandCasKt}:
   !preferFmc&&s.mcp.powered===true&&within(s.mcp.selectedCasKt)?
   {source:'MCP',speedKt:s.mcp.selectedCasKt}:null;
  const command=!s.failures.selectedSpeed?commanded:null;
  let commandedPosition=null;
  if(command&&range)commandedPosition=command.speedKt>range.maxKt?'ABOVE':
   command.speedKt<range.minKt?'BELOW':'ON_TAPE';
  const validFmc=f.valid;
  const reference=(key)=>validFmc&&within(f[key])?f[key]:null;
  const marks={
   v1Kt:s.failures.v1?null:reference('v1Kt'),
   vrKt:reference('vrKt'),vrefKt:reference('selectedVrefKt'),
   flapsUpKt:config.flapsPosition===0?lim.flapsUpManeuverKt:null,
   retractKt:config.inFlight===true&&config.flapsPosition!==null&&config.flapsPosition>0&&
    ['TAKEOFF','GO_AROUND'].includes(config.phase)?lim.flapRetractionKt:null,
   nextFlapPlacardKt:config.inFlight===true&&config.flapsPosition!==null&&config.flapsPosition>0&&
    config.flapsRetracting===false&&f.valid===true&&f.landingFlaps!==null&&
    f.landingFlaps!==config.flapsPosition?
    lim.nextFlapPlacardKt:null,
   minimumManeuverKt:lim.minimumManeuverKt,stickShakerKt:lim.stickShakerKt,
   highSpeedBuffetKt:s.adc.pressureAltitudeFt!==null&&s.adc.pressureAltitudeFt>25000&&
    f.grossWeightAvailable===true?lim.highSpeedBuffetKt:null,
   maximumOperatingKt:limiting?.speedKt??null
  };
  // A confirmed SPD or SPD LIM failure does not masquerade as a dead EADI.
  // No source connected (UNKNOWN) is not itself a hardware failure.
  const flags={SPD:s.failures.speed||s.adc.quality==='INVALID',
   SEL_SPD_INOP:s.failures.selectedSpeed,V1_INOP:s.failures.v1,
   SPD_LIM:s.failures.speedLimit,MACH:s.failures.mach};
  const trend=adcValid&&s.adc.trendVisible&&s.adc.accelerationKtS!==null?
   {delta10Kt:s.adc.accelerationKtS*10,
    predictedKt:cas+s.adc.accelerationKtS*10}:null;
  let effectiveTargetKt=command?.speedKt??null,limitReason=null;
  if(effectiveTargetKt!==null&&validLimits){
   if(within(lim.minimumAfdsKt)&&effectiveTargetKt<lim.minimumAfdsKt){
    effectiveTargetKt=lim.minimumAfdsKt;limitReason='MINIMUM_AFDS_SPEED';
   }
   if(limiting&&effectiveTargetKt>limiting.speedKt){
    effectiveTargetKt=limiting.speedKt;limitReason=limiting.reason;
   }
  }
  return {schema:'B737_CLASSIC_SPEED_TAPE_VIEW_V1',version:VERSION,seat:s.seat,
   revision:s.revision,quality:s.adc.quality,casKt:cas,tapeCenterKt,range,
   rollingDigitsVisible:adcValid&&cas>45,trend,command,commandedPosition,
   effectiveTargetKt,limitReason,marks,flags,
   maxLimitReason:limiting?.reason??null,
   coverage:{vmo:within(lim.vmoMmoCasKt),
    gear:config.gearExtended===false||(config.gearExtended===true&&within(lim.gearPlacardKt)),
    flaps:config.flapsPosition===0||(config.flapsPosition!==null&&within(lim.flapPlacardKt)),
    complete:maxCoverage}};
 }
 return Object.freeze({VERSION,SCHEMA,initialState,transition,view,LIMIT_KEYS,REF_KEYS});
});