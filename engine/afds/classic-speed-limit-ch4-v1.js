/* B737 Classic 300/400/500 SHI FCOM 4.10.3-5, 4.20.31-35.
 * Deterministic, evidence-gated speed-limit and reversion decision engine.
 * Does not invent a "slightly-before-limit" speed delta or certified data.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicSpeedLimitCh4V1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const SCHEMA='B737_CLASSIC_CH4_SPEED_LIMIT_V1';
 const GEAR_SPEED_LIMITS=Object.freeze({
  DOWN:Object.freeze({iasKt:320,mach:0.82}),
  EXTENDING:Object.freeze({iasKt:270,mach:0.82}),
  RETRACTING:Object.freeze({iasKt:235,mach:null})
 });
 const GEAR_STATES=['UP','DOWN','EXTENDING','RETRACTING'];
 const PITCH=['VS','VNAV_PTH','VNAV_SPD','LVL_CHG','ALT_HOLD','G/S','CWS','OTHER',null];
 const BOOL=['gearExtended','atArmed','atAvailable','atSpeedControl','thrustAtIdle',
  'afdsEngaged','afdsSpeedControl','apEngaged','gsCaptured','vnavLevelSegment',
  'vnavLevelCapture','climb','climbMaintainable','performanceInsufficient',
  'speedIncreasing','nearHighLimit','nearMinimum','cwsMode'];
 const NUM=['actualCasKt','selectedMcpCasKt','selectedFmcCasKt','minimumSpeedKt',
  'vmoMmoCasKt','gearPlacardKt','flapPlacardKt','flapsPosition'];
 const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=600;
 const initialState=()=>({schema:SCHEMA,revision:0,symbol:'NONE',
  previousSelectedKt:null,previousPitch:null,last:null});
 function verified(e){
  if(e?.type!=='FCC_SPEED_LIMIT'||e.confirmed!==true||
   !['SIMULATED_FCC','INSTRUCTOR_SCENARIO'].includes(e.source))
   throw Error('QUALIFIED_FCC_SPEED_LIMIT_REQUIRED');
  if(!PITCH.includes(e.pitchMode)||!['MCP','FMC',null].includes(e.commandSource))
   throw Error('INVALID_SPEED_MODE');
  for(const k of BOOL)if(e[k]!==undefined&&![true,false,null].includes(e[k]))
   throw Error('INVALID_CH4_FLAG_'+k);
  for(const k of NUM)if(e[k]!==undefined&&e[k]!==null&&!finite(e[k]))
   throw Error('INVALID_CH4_SPEED_'+k);
  if(e.flapsPosition>40)throw Error('INVALID_FLAPS');
  if(e.gearState!==undefined&&e.gearState!==null&&!GEAR_STATES.includes(e.gearState))
   throw Error('INVALID_GEAR_STATE');
  if(e.actualMach!==undefined&&e.actualMach!==null&&
     (typeof e.actualMach!=='number'||!Number.isFinite(e.actualMach)||e.actualMach<0||e.actualMach>1.5))
   throw Error('INVALID_ACTUAL_MACH');
  const x={...e};
  for(const k of [...BOOL,...NUM])if(x[k]===undefined)x[k]=null;
  if(x.actualMach===undefined)x.actualMach=null;
  x.gearState=x.gearState??(x.gearExtended===true?'DOWN':x.gearExtended===false?'UP':null);
  if((x.gearState==='UP'&&x.gearExtended===true)||(x.gearState==='DOWN'&&x.gearExtended===false))
   throw Error('CONFLICTING_GEAR_EVIDENCE');
  return x;
 }
 function transition(old,event){
  if(old?.schema!==SCHEMA)throw Error('INVALID_CH4_STATE');
  if(event?.type==='CLEAR')return initialState();
  const e=verified(event);
  const selected=e.commandSource==='MCP'?e.selectedMcpCasKt:
   e.commandSource==='FMC'?e.selectedFmcCasKt:null;
  const candidates=[];
  const gearLimit=GEAR_SPEED_LIMITS[e.gearState]??null;
  if(finite(e.vmoMmoCasKt))candidates.push({speed:e.vmoMmoCasKt,reason:'VMO_MMO'});
  if(gearLimit)candidates.push({speed:gearLimit.iasKt,reason:'GEAR_PLACARD'});
  if(e.flapsPosition!==null&&e.flapsPosition>0&&finite(e.flapPlacardKt))
   candidates.push({speed:e.flapPlacardKt,reason:'FLAP_PLACARD'});
  const complete=finite(e.vmoMmoCasKt)&&e.gearState!==null&&
   e.flapsPosition!==null&&(e.flapsPosition===0||finite(e.flapPlacardKt));
  const max=complete?candidates.reduce((a,b)=>a.speed<=b.speed?a:b):null;
  const min=finite(e.minimumSpeedKt)?e.minimumSpeedKt:null;
  const conflict=min!==null&&max!==null&&min>max.speed;
  const actual=finite(e.actualCasKt)?e.actualCasKt:null;
  const low=!conflict&&actual!==null&&min!==null&&
   (actual<=min||e.nearMinimum===true);
  const machExceeded=gearLimit?.mach!=null&&e.actualMach!==null&&
   e.actualMach>=gearLimit.mach;
  const highByCas=actual!==null&&max!==null&&
   (actual>=max.speed||e.nearHighLimit===true);
  const high=!conflict&&(highByCas||machExceeded);
  const perf=e.pitchMode==='VS'&&e.performanceInsufficient===true&&
   e.speedIncreasing===false&&actual!==null&&finite(e.selectedMcpCasKt)&&
   actual<e.selectedMcpCasKt-5;
  const speedChanged=selected!==null&&selected!==old.previousSelectedKt;
  const pitchChanged=old.previousPitch!==null&&e.pitchMode!==old.previousPitch;
  let symbol=old.symbol;
  if(symbol==='PERFORMANCE'&&(speedChanged||pitchChanged))symbol='NONE';
  if(symbol==='UNDERSPEED'&&min!==null&&
   ((actual!==null&&actual>=min+15)||(speedChanged&&selected>=min+15)))
   symbol='NONE';
  if(symbol==='OVERSPEED'&&max!==null&&speedChanged&&selected<=max.speed&&!high)
   symbol='NONE';
  if(actual===null||conflict)symbol='NONE';
  if(perf)symbol='PERFORMANCE';
  else if(low)symbol='UNDERSPEED';
  else if(high)symbol='OVERSPEED';
  let commanded=selected,clamp=null;
  if(commanded!==null&&!conflict){
   if(min!==null&&commanded<min){commanded=min;clamp='MINIMUM_SPEED';}
   if(max!==null&&commanded>max.speed){commanded=max.speed;clamp=max.reason;}
  }
  if(conflict)commanded=null;
  const inhibited=e.pitchMode==='ALT_HOLD'?'ALT_HOLD':
   e.gsCaptured===true||e.pitchMode==='G/S'?'GS_CAPTURED':
   e.pitchMode==='VNAV_PTH'&&e.vnavLevelSegment===true?'VNAV_LEVEL':
   e.pitchMode==='VNAV_PTH'&&e.vnavLevelCapture===true?'VNAV_CAPTURE':null;
  let reversion='NONE',reason=null;
  if(low&&!inhibited){
   if(e.pitchMode==='VS')reversion='LVL_CHG_MINIMUM';
   if(e.pitchMode==='VNAV_PTH'&&e.vnavLevelSegment===false&&
    e.vnavLevelCapture===false)reversion='LVL_CHG_MINIMUM';
   if(e.pitchMode==='LVL_CHG'&&e.climb===true&&e.climbMaintainable===false&&
    e.apEngaged===true)reversion='AP_DISENGAGE_FD_RETRACT';
   commanded=Math.max(commanded??(min+5),min+5);
   if(max!==null)commanded=Math.min(max.speed,commanded);
   reason='MINIMUM_SPEED';
  }else if(perf){
   reversion='LVL_CHG_PERFORMANCE';reason='VS_THRUST_INSUFFICIENT';
  }else if(high){
   reason=machExceeded&&!highByCas?'GEAR_MACH_LIMIT':max.reason;
   if(max.reason==='VMO_MMO'&&e.pitchMode==='VS'&&
    e.atSpeedControl===true&&e.thrustAtIdle===true)
    reversion='LVL_CHG_VMO';
   else if(e.atAvailable===false){
    if(max.reason==='VMO_MMO')reversion='AFDS_VMO_SPEED_CONTROL';
   }else if(e.atAvailable===true&&e.atArmed===true&&e.afdsEngaged===true&&
     e.afdsSpeedControl===false&&e.cwsMode===false&&e.atSpeedControl===false)
    reversion='AT_SPEED_PLACARD';
   else if(e.atSpeedControl===true||e.afdsSpeedControl===true)
    reversion='MAINTAIN_LIMIT';
  }
  if(conflict){symbol='NONE';reversion='NONE';reason='CONFLICTING_LIMITS';}
  const out={schema:SCHEMA,revision:old.revision+1,source:e.source,
   authorized:e.source==='SIMULATED_FCC',actualCasKt:actual,
   selectedCasKt:selected,minimumSpeedKt:min,maximumSpeedKt:max?.speed??null,
   gearState:e.gearState,gearOperatingLimitKt:gearLimit?.iasKt??null,
   gearOperatingLimitMach:gearLimit?.mach??null,actualMach:e.actualMach,
   gearMachLimitReached:machExceeded,
   maximumReason:max?.reason??null,upperLimitComplete:complete&&!conflict,
   conflictingLimits:conflict,effectiveCommandKt:commanded,
   clampReason:clamp,speedConditionSymbol:symbol,flashing:symbol!=='NONE',
   reversion,reversionReason:reason,minimumReversionInhibitedBy:inhibited,
   selectedOutOfEnvelope:selected!==null&&!conflict&&
    ((min!==null&&selected<min)||(max!==null&&selected>max.speed)),
   note:'FCC SIMULATOR DECISION; NO AUTOMATIC PHYSICAL SERVO'};
  return {schema:SCHEMA,revision:out.revision,symbol,previousSelectedKt:selected,
   previousPitch:e.pitchMode,last:out};
 }
 function view(s){if(s?.schema!==SCHEMA)throw Error('INVALID_CH4_STATE');
  return s.last?JSON.parse(JSON.stringify(s.last)):null;}
 return Object.freeze({VERSION:'SPEED-LIMIT-CH4-0002',SCHEMA,GEAR_SPEED_LIMITS,
  initialState,transition,view});
});