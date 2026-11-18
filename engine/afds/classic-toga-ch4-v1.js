/* Boeing 737 Classic Chapter 4 TO/GA — instructor-only flight-mode state machine.
 * Source: Sepehran FCOM D6-27370-300/400/500-SHI 4.20.14-16,
 * 4.20.24-27 (2023). Airframe effectivity can choose HDG SEL takeoff roll.
 * This is not a certified FCC or AFM N1 performance model.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ClassicTogaCH4V1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='TOGA-CH4-SHI-0001';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const safe=(x,defaultValue)=>finite(x)?x:defaultValue;
 const initial=()=>({version:VERSION,phase:'OFF',presses:0,elapsedSec:0,liftoffSec:null,
  initialSpeedKt:null,fdPitchDeg:0,fdRollTrackDeg:null,thrustDemand:'NONE',
  atMode:'',pitchMode:'',rollMode:'',afdsMode:'',apDisengage:false,
  targetSpeedKt:null,atLimit:'NONE',throttleFraction:0,reason:'NOT_ENGAGED',
  singleEngine:false,engineFailureAfterEngagement:false,gaFullReady:false});
 function engineCount(c){return Number(c.engine1Running===true)+Number(c.engine2Running===true);}
 function engage(previous,ctx={}){
  if(!['OFF','TO','GA'].includes(previous?.phase))throw Error('Invalid TOGA previous state');
  const airborne=ctx.airborne===true;
  const engines=engineCount(ctx);
  const fd=ctx.fdLeft===true&&ctx.fdRight===true;
  const at=ctx.atArmed===true;
  const altitude=safe(ctx.radioAltitudeFt,Infinity),postTouchdown=ctx.touchedDown===true;
  const canGA=(airborne&&altitude<2000&&ctx.isTakeoffMode!==true)||
   (postTouchdown&&safe(ctx.sinceTouchdownSec,Infinity)<=2);
  if(!airborne&&ctx.groundReady!==true&&!postTouchdown)return {...previous,reason:'GROUND_TAKEOFF_NOT_ARMED'};
  if(airborne&&!canGA)return {...previous,reason:'GA_NOT_AVAILABLE'};
  if(!fd&&(!airborne||ctx.fdLeft===false&&ctx.fdRight===false)&&ctx.allowFdAutoEngage!==true)
   return {...previous,reason:'BOTH_FD_REQUIRED'};
  // FCOM 4.20.24: only dual A/P with FLARE armed retains A/P for GA.
  const dual=ctx.apChannels===2&&ctx.flareArmed===true&&!postTouchdown;
  const phase=airborne||postTouchdown?'GA':'TO';
  const target=safe(ctx.iasKt,0);
  const approachTarget=safe(ctx.selectedSpeedKt,target);
  const single=engines===1;
  return {...initial(),phase,presses:1,initialSpeedKt:target,
   fdPitchDeg:phase==='TO'?-10:single?13:15,
   fdRollTrackDeg:safe(ctx.groundTrackDeg,0),
   thrustDemand:at&&engines>0?(phase==='TO'?'TAKEOFF_LIMIT':'GA_REDUCED'):'NONE',
   atMode:at&&engines>0?(phase==='TO'?'N1':'GA'):'',
   pitchMode:'TO/GA',rollMode:phase==='TO'&&ctx.takeoffRollHdGSel===true?'HDG SEL':'',
   afdsMode:dual?'CMD':'FD',apDisengage:(ctx.apChannels??0)>0&&!dual,
   targetSpeedKt:single?Math.max(safe(ctx.v2Kt,0),approachTarget):approachTarget,
   atLimit:phase==='TO'?'TO':'G/A',singleEngine:single,gaFullReady:false,
   // First GA press is reduced GA; first TO press selects FMC takeoff N1.
   throttleFraction:at&&engines>0?(phase==='TO'?1:.86):0,
   reason:phase==='TO'?'TAKEOFF_FD':'GO_AROUND_FD'};
 }
 function press(previous,ctx={}){
  if(previous.phase!=='GA'||previous.presses<1)return engage(previous,ctx);
  if(ctx.atArmed!==true||engineCount(ctx)<1)return {...previous,reason:'GA_AUTOTHROTTLE_NOT_AVAILABLE'};
  if(previous.gaFullReady!==true)return {...previous,reason:'WAIT_REDUCED_GA_N1'};
  return {...previous,presses:2,thrustDemand:'GA_FULL',throttleFraction:1,
   reason:'FULL_GO_AROUND_N1'};
 }
 function advance(previous,ctx={},dtSec=0){
  if(!finite(dtSec)||dtSec<0||dtSec>10)throw RangeError('Invalid TOGA dt');
  if(previous.phase==='OFF')return previous;
  const elapsed=previous.elapsedSec+dtSec,ias=safe(ctx.iasKt,0),ra=safe(ctx.radioAltitudeFt,0);
  let next={...previous,elapsedSec:elapsed};
  const observedEngines=typeof ctx.engine1Running==='boolean'&&
    typeof ctx.engine2Running==='boolean'?engineCount(ctx):null;
  if(observedEngines===1&&!previous.singleEngine){
   const v2=safe(ctx.v2Kt,0);
   if(previous.phase==='GA'){
    // FCOM 4.20.27: failure before 10 seconds uses selected approach
    // speed; after 10 seconds, speed at GA engagement if current IAS is
    // within 5 kt, otherwise current IAS. Never command below V2.
    const target=elapsed<10?safe(ctx.selectedSpeedKt,ias):
     Math.abs(ias-previous.initialSpeedKt)<=5?previous.initialSpeedKt:ias;
    next={...next,singleEngine:true,engineFailureAfterEngagement:true,
     targetSpeedKt:Math.max(v2,target),reason:'ENGINE_FAILURE_AFTER_GA'};
   }else{
    // FCOM 4.20.15: engine-out takeoff target is clamped V2..V2+20.
    next={...next,singleEngine:true,engineFailureAfterEngagement:true,
     targetSpeedKt:v2>0?Math.max(v2,Math.min(v2+20,ias)):safe(ctx.selectedSpeedKt,ias),
     reason:'ENGINE_FAILURE_DURING_TAKEOFF'};
   }
  }
  if(previous.phase==='TO'){
   // Takeoff-specific FCOM phases: -10° until 60 kt; 15° after 60;
   // 84 kt disconnects thrust servo while TAKEOFF remains selected.
   next.fdPitchDeg=ias<60?-10:15;
   if(ias>=84&&next.atMode==='N1'){next.atMode='THR HLD';next.thrustDemand='THR_HOLD';}
   if(ctx.airborne===true&&previous.liftoffSec===null)next.liftoffSec=elapsed;
   if(ctx.airborne===true&&next.liftoffSec!==null){
    const after=elapsed-next.liftoffSec;
    if(ra>=400&&after>=18&&next.atMode==='THR HLD'){next.atMode='ARM';next.thrustDemand='ARM';}
    if(ctx.autopilotEngaged===true&&ra>=400){
     next={...next,afdsMode:'CMD',pitchMode:'MCP SPD',
      rollMode:ctx.otherRollMode||next.rollMode,reason:'CMD_AFTER_TAKEOFF'};
    }
   }
  }
  if(previous.phase==='GA'){
   // Reduced GA has to be achieved before a second TOGA press can ask full N1.
   next.gaFullReady=ctx.reducedGaN1Reached===true||previous.gaFullReady;
   next.fdPitchDeg=next.singleEngine?13:15;
   if(next.singleEngine){
    const v2=safe(ctx.v2Kt,0);
    const selected=safe(ctx.selectedSpeedKt,next.targetSpeedKt);
    // After failure, only a HIGHER MCP selection can command acceleration.
    next.targetSpeedKt=Math.max(v2,next.targetSpeedKt,
     selected>next.targetSpeedKt?selected:next.targetSpeedKt);
   }
  }
  return next;
 }
 function fma(s){
  return {at:s.atMode,pitch:s.pitchMode,roll:s.rollMode,afds:s.afdsMode,
   fdPitch:s.fdPitchDeg,targetSpeedKt:s.targetSpeedKt,thrust:s.thrustDemand};
 }
 return Object.freeze({VERSION,initial,engage,press,advance,fma});
});
