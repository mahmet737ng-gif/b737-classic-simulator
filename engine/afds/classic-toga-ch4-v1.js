/* Boeing 737 Classic Chapter 4 TO/GA — instructor-only flight-mode state machine.
 * Source: Sepehran FCOM D6-27370-300/400/500-SHI 4.20.14-16,
 * 4.20.24-27 (2023). Airframe effectivity can choose HDG SEL takeoff roll.
 * This is not a certified FCC or AFM N1 performance model.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ClassicTogaCH4V1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='TOGA-CH4-SHI-0001';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const safe=(x,defaultValue)=>finite(x)?x:defaultValue;
 const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
 const FCOM_TAKEOFF_INCREMENT_KT=20;
 const trainerIncrement=c=>c.takeoffSpeedIncrementKt===15?15:FCOM_TAKEOFF_INCREMENT_KT;
 function eligibleTakeoffFdPopUp(c){
  // SHI 4.20.14: OFF-switch pop-up only after 80 KIAS,
  // below 2000ft AGL, and less than 150s since lift-off.
  return safe(c.iasKt,0)>80&&safe(c.radioAltitudeFt,Infinity)<2000&&
   safe(c.sinceLiftoffSec,0)<150;
 }
 function speedPitch(state,c,dt){
  const ias=safe(c.iasKt,state.previousIasKt??0);
  const accel=finite(c.iasAccelerationKtSec)?c.iasAccelerationKtSec:
   dt>=.05&&finite(state.previousIasKt)?(ias-state.previousIasKt)/dt:0;
  const acceleration=clamp(accel,-5,5);
  const error=ias+2*acceleration-safe(state.targetSpeedKt,ias);
  const n1=safe(c.availableN1Percent,85),vs=safe(c.vsFpm,1500);
  const massKg=safe(c.massKg,60000),flapDeg=safe(c.flapActualDeg,5);
  // Classroom surrogate: NOT Boeing-published FCC gains.
  const equilibrium=clamp(9+.07*(n1-85)+clamp((vs-1500)/1500,-1,1)+
   clamp((massKg-60000)/1000,-25,20)*.035-
   clamp(flapDeg,0,40)*.025,6,12);
  let demand=clamp(equilibrium+.30*error-.25*safe(c.pitchRateDegSec,0),1,15);
  if(ias<safe(state.targetSpeedKt,ias)-20)demand=Math.min(demand,7);
  const current=safe(state.fdPitchDeg,15);
  return {pitch:clamp(current+clamp(demand-current,-3*dt,3*dt),1,15),
   acceleration,raw:demand};
 }
 const initial=()=>({version:VERSION,phase:'OFF',presses:0,elapsedSec:0,liftoffSec:null,
  initialSpeedKt:null,fdPitchDeg:0,fdRollTrackDeg:null,thrustDemand:'NONE',
  atMode:'',pitchMode:'',rollMode:'',afdsMode:'',apDisengage:false,
  targetSpeedKt:null,atLimit:'NONE',throttleFraction:0,reason:'NOT_ENGAGED',
  singleEngine:false,engineFailureAfterEngagement:false,gaFullReady:false,
  fdAutoPopUp:false,takeoffV2Kt:null,takeoffIncrementKt:FCOM_TAKEOFF_INCREMENT_KT,
  speedGuidanceActive:false,climbQualifiedSec:0,previousIasKt:null,
  previousPitchDeg:null,n1SelectedAfterArm:false,
  accelerationKtSec:0,pitchDemandRawDeg:null});
 function engineCount(c){return Number(c.engine1Running===true)+Number(c.engine2Running===true);}
 function engage(previous,ctx={}){
  if(!['OFF','TO','GA'].includes(previous?.phase))throw Error('Invalid TOGA previous state');
  const airborne=ctx.airborne===true;
  const engines=engineCount(ctx);
  const fdSelected=ctx.fdLeft===true||ctx.fdRight===true;
  const at=ctx.atArmed===true;
  const altitude=safe(ctx.radioAltitudeFt,Infinity),postTouchdown=ctx.touchedDown===true;
  const canGA=(airborne&&altitude<2000&&ctx.isTakeoffMode!==true)||
   (postTouchdown&&safe(ctx.sinceTouchdownSec,Infinity)<=2);
  if(!airborne&&ctx.groundReady!==true&&!postTouchdown)return {...previous,reason:'GROUND_TAKEOFF_NOT_ARMED'};
  if(airborne&&!canGA)return {...previous,reason:'GA_NOT_AVAILABLE'};
  const phase=airborne||postTouchdown?'GA':'TO';
  const autoPop=phase==='TO'?eligibleTakeoffFdPopUp(ctx):
   ctx.allowFdAutoEngage===true&&altitude<2000;
  // Pressing TO/GA on the runway is permitted with BOTH FD switches OFF.
  // Command bars are a separate indication and pop up when qualified.
  if(phase==='GA'&&!fdSelected&&!autoPop)
   return {...previous,reason:'GO_AROUND_FD_CONDITION_NOT_MET'};
  // FCOM 4.20.24: only dual A/P with FLARE armed retains A/P for GA.
  const dual=ctx.apChannels===2&&ctx.flareArmed===true&&!postTouchdown;
  const target=safe(ctx.iasKt,0);
  const approachTarget=safe(ctx.selectedSpeedKt,target);
  const single=engines===1;
  const v2=safe(ctx.selectedSpeedKt,safe(ctx.v2Kt,target));
  const increment=trainerIncrement(ctx);
  return {...initial(),phase,presses:1,initialSpeedKt:target,
   fdAutoPopUp:!fdSelected&&autoPop,takeoffV2Kt:phase==='TO'?v2:null,
   takeoffIncrementKt:increment,previousIasKt:target,
   fdPitchDeg:phase==='TO'?(target<60?-10:15):single?13:15,
   fdRollTrackDeg:safe(ctx.groundTrackDeg,0),
   thrustDemand:at&&engines>0?(phase==='TO'?'TAKEOFF_LIMIT':'GA_REDUCED'):'NONE',
   atMode:at&&engines>0?(phase==='TO'?'N1':'GA'):'',
   pitchMode:'TO/GA',rollMode:phase==='TO'&&ctx.takeoffRollHdGSel===true?'HDG SEL':'',
   afdsMode:dual?'CMD':'FD',apDisengage:(ctx.apChannels??0)>0&&!dual,
   targetSpeedKt:phase==='TO'?(single?Math.max(safe(ctx.v2Kt,v2),v2):v2+increment):
    single?Math.max(safe(ctx.v2Kt,0),approachTarget):approachTarget,
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
  // An OFF-switch ground TO/GA starts immediately; the two FD bars
  // automatically appear only after the documented 80 KIAS threshold.
  if(previous.phase==='TO'&&ctx.fdLeft!==true&&ctx.fdRight!==true)
   next.fdAutoPopUp=previous.fdAutoPopUp||eligibleTakeoffFdPopUp(ctx);
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
    // MCP takeoff V2 is retained even when separate takeoff-data is absent.
    const takeoffV2=safe(previous.takeoffV2Kt,safe(ctx.selectedSpeedKt,v2));
    next={...next,singleEngine:true,engineFailureAfterEngagement:true,
     targetSpeedKt:takeoffV2>0?Math.max(takeoffV2,Math.min(takeoffV2+20,ias)):
      safe(ctx.selectedSpeedKt,ias),
     reason:'ENGINE_FAILURE_DURING_TAKEOFF'};
   }
  }
  if(previous.phase==='TO'){
   // Fixed ground-roll cue, then a predictive IAS director after positive
   // climb is established. MCP V2 stays the speed reference for this mode.
   if(!next.singleEngine&&finite(ctx.selectedSpeedKt)){
    next.takeoffV2Kt=ctx.selectedSpeedKt;
    next.targetSpeedKt=ctx.selectedSpeedKt+next.takeoffIncrementKt;
   }
   if(ctx.airborne===true&&previous.liftoffSec===null)next.liftoffSec=elapsed;
   if(ctx.airborne===true){
    next.climbQualifiedSec=safe(ctx.vsFpm,0)>=300?
     previous.climbQualifiedSec+dtSec:0;
    next.speedGuidanceActive=previous.speedGuidanceActive||
     next.climbQualifiedSec>=.75;
   }
   if(next.speedGuidanceActive&&ctx.airborne===true){
    const actualPitchRate=dtSec>=.05&&finite(previous.previousPitchDeg)&&
     finite(ctx.pitchDeg)?clamp((ctx.pitchDeg-previous.previousPitchDeg)/dtSec,-6,6):0;
    const cue=speedPitch({...previous,targetSpeedKt:next.targetSpeedKt},
     {...ctx,pitchRateDegSec:actualPitchRate},dtSec);
    next.fdPitchDeg=cue.pitch;
    next.accelerationKtSec=cue.acceleration;
    next.pitchDemandRawDeg=cue.raw;
   }else{
    next.fdPitchDeg=ias<60?-10:15;
    next.pitchDemandRawDeg=next.fdPitchDeg;
   }
   next.previousIasKt=ias;
   next.previousPitchDeg=safe(ctx.pitchDeg,previous.previousPitchDeg);
   if(ias>=84&&next.atMode==='N1'&&!next.n1SelectedAfterArm){next.atMode='THR HLD';next.thrustDemand='THR_HOLD';}
   if(ctx.airborne===true&&next.liftoffSec!==null){
    const after=elapsed-next.liftoffSec;
    // Unified instructor schedule: THR HLD -> ARM at 400 ft AGL; N1
    // may then be explicitly reselected from the real MCP pushbutton.
    if(ra>=400&&next.atMode==='THR HLD'){next.atMode='ARM';next.thrustDemand='ARM';}
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
 function selectN1(previous,ctx={}){
  if(previous?.phase!=='TO')return {...previous,reason:'N1_RESELECT_REQUIRES_TAKEOFF'};
  if(safe(ctx.radioAltitudeFt,0)<400)return {...previous,reason:'N1_BELOW_400_RA'};
  if(ctx.atArmed!==true||engineCount(ctx)<1)
   return {...previous,reason:'N1_REQUIRES_ARMED_RUNNING_ENGINE'};
  if(previous.atMode!=='ARM')return {...previous,reason:'WAIT_THR_HLD_TO_ARM'};
  return {...previous,atMode:'N1',thrustDemand:'TAKEOFF_LIMIT',
   throttleFraction:1,n1SelectedAfterArm:true,reason:'N1_SELECTED_AFTER_400_RA'};
 }
 function fma(s){
  return {at:s.atMode,pitch:s.pitchMode,roll:s.rollMode,afds:s.afdsMode,
   fdPitch:s.fdPitchDeg,targetSpeedKt:s.targetSpeedKt,thrust:s.thrustDemand};
 }
 return Object.freeze({VERSION,FCOM_TAKEOFF_INCREMENT_KT,eligibleTakeoffFdPopUp,
  initial,engage,press,advance,selectN1,fma});
});
