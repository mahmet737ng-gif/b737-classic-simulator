(async()=>{
;
/* ./radio-altimeter-audio-runtime-v1.js?v=RA-LIVE-0001 */
try{
/* Unified live Radio Altimeter callout bridge.
 * Uses the existing owner-supplied RA voice timeline; no synthetic or TTS audio.
 * Captain-side selected RA source and Captain EFIS DH drive the shared aural callouts.
 */
(function(root){
 'use strict';
 const Warning=root.B737WarningEngine?.WarningEngine;
 const Owner=root.B737OwnerRACallouts;
 if(typeof Warning!=='function'||!Owner?.Player){
  root.console?.error?.('Unified RA audio: WarningEngine / owner RA player missing');
  return;
 }
 const engine=new Warning({variant:'737-300'});
 const audioUrl=new URL('../../audio-lab/assets/owner-ra-callouts-v1.mp3',root.location.href).href;
 const player=new Owner.Player(audioUrl);
 let approachId=null,lastElapsed=null,lastDH=null,lastStatus='WAITING FOR FINAL APPROACH';
 let statusNode=null,egpwsCritical=false;
 const diagnostics={approachActive:false,raFt:null,raQuality:'UNKNOWN',dhFt:null,
  raSource:'CAPTAIN SELECTED RA',dhSource:'CAPTAIN EFIS DH',lastEvents:[],missing:[],audioError:null};
 function status(message){
  lastStatus=message;
  root.document.documentElement.dataset.radioAltAudio=message.split(' ')[0];
  if(statusNode)statusNode.textContent='RADIO ALTITUDE AUDIO · '+message;
  root.dispatchEvent(new CustomEvent('b737:radio-altimeter-audio-status',{
   detail:{status:message,diagnostics:getDiagnostics()}
  }));
 }
 function mountStatus(){
  const inspector=root.document.getElementById('inspector');
  if(!inspector||statusNode)return;
  const section=root.document.createElement('section');
  section.id='radioAltAudioDiagnostics';
  section.style.cssText='border:1px solid #536b79;border-radius:8px;padding:8px;margin:8px 0;background:#14232c;color:#dce9ef;font:11px/1.5 system-ui';
  const title=root.document.createElement('strong');title.textContent='RADIO ALTIMETER · AURAL CALLOUTS';
  const p=root.document.createElement('p');p.style.margin='5px 0';p.setAttribute('role','status');
  const note=root.document.createElement('small');note.textContent='Captain RA source · Captain DH · owner recording · no generated fallback';
  section.append(title,p,note);inspector.prepend(section);statusNode=p;status(lastStatus);
 }
 function stopAndReset(){
  engine.reset();player.stop();approachId=null;lastElapsed=null;lastDH=null;
  diagnostics.approachActive=false;diagnostics.lastEvents=[];diagnostics.missing=[];
  status('WAITING FOR FINAL APPROACH');
 }
 function process(scenario){
  if(!scenario)return;
  const flight=root.B737UnifiedFlightScenarioV1?.getDiagnostics?.();
  const approachActive=flight?.active===true&&scenario.phase==='FINAL_APPROACH'&&scenario.airborne===true;
  const identity=[scenario.icao,scenario.runway,scenario.preset].join('|');
  const elapsed=Number.isFinite(scenario.elapsedSec)?scenario.elapsedSec:null;
  if(!approachActive){
   if(approachId!==null)stopAndReset();
   diagnostics.approachActive=false;
   return;
  }
  if(approachId!==identity||(lastElapsed!==null&&elapsed!==null&&elapsed<lastElapsed)){
   engine.reset();player.stop();lastDH=null;approachId=identity;
   status('NEW APPROACH · WAITING FOR RADIO ALTITUDE CROSSING');
  }
  approachId=identity;lastElapsed=elapsed;
  let source=null,pedestal=null;
  try{source=root.B737UnifiedEfisSources?.project?.('CAPT')||null;}catch(_){}
  try{pedestal=root.B737UnifiedEFISPedestalV1?.getState?.('CAPT')||null;}catch(_){}
  const raQuality=source?.health?.radioAltQuality??'UNKNOWN';
  const ra=raQuality==='VALID'&&Number.isFinite(source?.ra?.heightFt)?source.ra.heightFt:null;
  const dh=Number.isFinite(pedestal?.dh)?pedestal.dh:null;
  diagnostics.approachActive=true;diagnostics.raFt=ra;diagnostics.raQuality=raQuality;
  diagnostics.dhFt=dh;diagnostics.audioError=player.lastError||null;

  // WarningEngine owns downward-crossing and one-shot rules:
  // APPROACHING MINIMUMS = DH + 100 ft; MINIMUMS = DH; DH < 0 inhibits both.
  const out=engine.update({
   onGround:false,approachActive:true,radioAltitudeFt:ra,minimumsRadioFt:dh,
   pressureAltitudeFt:0,selectedAltitudeFt:0,cabinAltitudeFt:0,
   flaps:0,gearDownLocked:true,thrustLever1Angle:45,thrustLever2Angle:45,
   iasKt:0,vmoKt:340,mach:0,mmo:.82,
   leadingEdgeTakeoff:true,speedbrakeDown:true,parkingBrakeSet:false,stabilizerTrimTakeoff:true,
   engine1Fire:false,engine2Fire:false,apuFire:false,wheelWellFire:false,cargoFire:false,
   stallWarning:false,glideslopeCaptured:false,autopilotEngaged:false,autothrottleEngaged:false,
   bankAngleDeg:0
  });
  const callouts=out.events.filter(event=>event.id==='radioAltitude'||event.id==='minimums');
  if(callouts.length){
   diagnostics.lastEvents=callouts.map(event=>({id:event.id,message:event.message,raFt:ra,dhFt:dh}));
   if(!egpwsCritical)for(const event of callouts){
    const key=Owner.keyFor(event.id,event.message);
    if(player.has(key))player.enqueue(key,.20);
    else diagnostics.missing.push(key);
   }
  }
  if(raQuality!=='VALID')status('RADIO ALTIMETER INPUT '+raQuality+' · NO CALLOUT');
  else if(dh!==null&&dh<0)status('RA '+Math.round(ra)+' FT · DH '+dh+' FT · MINIMUMS INHIBITED');
  else if(callouts.length&&egpwsCritical)status('SUPPRESSED BY CRITICAL EGPWS');
  else if(callouts.length)status('TRIGGERED · '+callouts.map(x=>x.message).join(' / '));
  else status('ARMED · RA '+Math.round(ra)+' FT · DH '+(dh===null?'N/A':dh+' FT'));
  lastDH=dh;
 }
 function getDiagnostics(){return JSON.parse(JSON.stringify({...diagnostics,lastStatus,missing:diagnostics.missing.slice(-12)}));}
 root.addEventListener('b737:egpws-ch15-state',event=>{
  egpwsCritical=event.detail?.critical===true;
  if(egpwsCritical)player.stop();
 });
 root.addEventListener('b737:flight-scenario-stopped',()=>{egpwsCritical=false;});
 root.addEventListener('b737:flight-scenario-state',event=>process(event.detail));
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',mountStatus,{once:true});
 else mountStatus();
 root.addEventListener('b737:cockpit-mounted',mountStatus);
 try{const initial=root.B737UnifiedFlightScenarioV1?.getState?.();if(initial)process(initial);}catch(_){}
 root.B737RadioAltimeterAudioV1=Object.freeze({
  stop:()=>{player.stop();status('STOPPED BY USER');},
  reset:stopAndReset,getStatus:()=>lastStatus,getDiagnostics,
  getConfig:()=>({approachPhase:'FINAL_APPROACH',raSource:'B737UnifiedEfisSources.project(CAPT).ra',
   dhSource:'B737UnifiedEFISPedestalV1.getState(CAPT).dh',approachingMinimumsOffsetFt:100,
   minimumsOffsetFt:0,negativeDhInhibitsBoth:true,audioAsset:'audio-lab/assets/owner-ra-callouts-v1.mp3',
   missingClipBehavior:'SILENT'})
 });
 status('WAITING FOR FINAL APPROACH');
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/egpws/classic-egpws-ch15-v1.js?v=EGPWS-CH15-0001 */
try{
/* B737-300/400/500 Sepehran FCOM Chapter 15 EGPWS training logic (not certified).
 * Source: D6-27370-300/400/500-SHI, 15.10.8-10, 15.20.10-15, 15.20.18-26.
 * All quantitative envelopes not explicitly printed in Chapter 15 are isolated
 * as TRAINING_APPROXIMATION values. NO synthetic terrain database is assumed.
 * Audio source keys refer ONLY to the owner's approved c.mp3 recordings.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ClassicEGPWSCh15V1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const APPROX=Object.freeze({
  // Trainer-only envelope tuning; these are NOT manufacturer thresholds.
  mode1CautionFpm:ra=>Math.max(1050,650+1.15*ra),
  mode1WarningFpm:ra=>Math.max(1600,1150+1.5*ra),
  mode2WarningClosureFpm:2500,
  mode2CautionClosureFpm:1500,
  mode3LossFt:peak=>Math.max(35,.09*peak),
  mode4LowSpeedKt:180,mode4UnsafeRadioFt:500,
  maxBasicGpwsRadioFt:2500,
  repeatMs:4200
});
const ALERTS=Object.freeze({
  REACTIVE_WINDSHEAR:{sample:'WINDSHEAR',priority:120,visual:'WINDSHEAR_RED',chapter:'15.20.23'},
  LOOKAHEAD_TERRAIN_WARNING:{sample:'TERRAIN_TERRAIN_PULL_UP',priority:110,visual:'TERRAIN_RED',chapter:'15.20.12, 15.20.19'},
  MODE1_PULL_UP:{sample:'SINK_RATE_PULL_UP',priority:100,visual:'PULL_UP_RED',chapter:'15.20.13-14'},
  MODE1_CONTINUED_PULL_UP:{sample:'PULL_UP',priority:99,visual:'PULL_UP_RED',chapter:'15.20.13'},
  MODE2_PULL_UP:{sample:'TERRAIN_PULL_UP',priority:98,visual:'PULL_UP_RED',chapter:'15.20.13'},
  MODE2_CONTINUED_PULL_UP:{sample:'PULL_UP',priority:97,visual:'PULL_UP_RED',chapter:'15.20.13'},
  MODE3_DONT_SINK_FIRST:{sample:'DONT_SINK_1',priority:86,visual:'PULL_UP_RED',chapter:'15.20.14'},
  MODE3_DONT_SINK_REPEAT:{sample:'DONT_SINK_2',priority:86,visual:'PULL_UP_RED',chapter:'15.20.14'},
  MODE4_TOO_LOW_TERRAIN:{sample:'TOO_LOW_TERRAIN',priority:80,visual:'PULL_UP_RED',chapter:'15.20.12, 15.20.15'},
  MODE4_TOO_LOW_GEAR:{sample:'TOO_LOW_GEAR',priority:74,visual:'PULL_UP_RED',chapter:'15.20.14'},
  MODE4_TOO_LOW_FLAPS:{sample:'TOO_LOW_FLAPS',priority:72,visual:'PULL_UP_RED',chapter:'15.20.14'},
  MODE5_GLIDESLOPE:{sample:'GLIDESLOPE',priority:55,visual:'BELOW_GS_AMBER',chapter:'15.10.8, 15.20.14'},
  LOOKAHEAD_TERRAIN_CAUTION:{sample:null,priority:54,visual:'TERRAIN_AMBER',chapter:'15.20.12, 15.20.19'},
  MODE1_SINK_RATE_CAUTION:{sample:null,priority:51,visual:'GPWS_CAUTION_AMBER',chapter:'15.20.14'},
  MODE2_TERRAIN_CAUTION:{sample:null,priority:50,visual:'GPWS_CAUTION_AMBER',chapter:'15.20.13'},
  PREDICTIVE_WINDSHEAR_AHEAD:{sample:null,priority:106,visual:'WINDSHEAR_RED',chapter:'15.20.24'},
  PREDICTIVE_WINDSHEAR_CAUTION:{sample:null,priority:45,visual:'WINDSHEAR_AMBER',chapter:'15.20.25'}
});
const SIGNALS=Object.freeze({
  reactiveWindshear:'requires independently validated reactive windshear detector/scenario signal; cannot derive from IAS',
  predictiveWindshear:'requires validated weather-radar windshear scenario; different unrecorded aural phrase',
  lookaheadTerrain:'requires validated terrain/obstacle prediction with time to projected impact; no terrain DB in this module',
  mode2Closure:'requires separately validated terrain closure rate; airport elevation surrogate cannot establish terrain closure',
  tcf:'TCF requires verified nearest-runway geometry and manufacturer envelope; not fabricated from airport elevation'
});
function hazards(input,ctx){
  const s=input||{},out=[],diag=[];
  const push=(id,why)=>out.push({id,...ALERTS[id],why});
  const ground=s.onGround===true, airborne=s.onGround===false;
  const ra=finite(s.raFt)?s.raFt:null,ias=finite(s.iasKt)?s.iasKt:null;
  const sink=finite(s.vsFpm)?-s.vsFpm:null;
  if(!airborne){diag.push('AIRBORNE_INVALID_OR_GROUND: basic EGPWS suppressed');return {out,diag};}
  if(ra===null||ra<0){diag.push('RA_INVALID: radio-height modes inhibited');}
  if(s.gpwsSystemAvailable===false){diag.push('EGPWS_INOP: all basic alerts inhibited');return {out,diag};}
  // FCOM 15.20.23: actual reactive windshear overrides look-ahead and basic alerts.
  if(s.reactiveWindshearValidated===true&&s.reactiveWindshearActive===true&&ra!==null&&ra<1500&&
    (s.phase==='INITIAL_CLIMB'||s.phase==='TAKEOFF'||s.phase==='GO_AROUND'||s.phase==='FINAL_APPROACH'||s.phase==='LANDING')){
    push('REACTIVE_WINDSHEAR','validated actual windshear below 1,500 ft RA');
    diag.push('REACTIVE_WINDSHEAR_SUPPRESSES_GPWS_AND_TERRAIN');
    return {out,diag};
  }
  // FCOM 15.20.24-26 predictive weather radar alerts have DIFFERENT audio;
  // no owner-approved WINDSHEAR AHEAD voice -> silent, visuals only.
  const pw=s.predictiveWindshear;
  if(pw?.validated===true && ra!==null && ra<1200){
    const takeoff=s.phase==='TAKEOFF'||s.phase==='INITIAL_CLIMB';
    const approach=s.phase==='FINAL_APPROACH'||s.phase==='LANDING';
    const inhibWarn=(s.onGround===true&&ias!==null&&ias>=100)||(airborne&&ra<50);
    const inhibCaut=(s.onGround===true&&ias!==null&&ias>=80)||(airborne&&ra<400);
    if((takeoff||approach)&&pw.warning===true&&!inhibWarn){
      push('PREDICTIVE_WINDSHEAR_AHEAD','radar predicted windshear; recording not supplied');
    }else if((takeoff||approach)&&pw.caution===true&&!inhibCaut){
      push('PREDICTIVE_WINDSHEAR_CAUTION','radar predicted windshear caution; recording not supplied');
    }
  }
  if(ra===null)return {out,diag};
  const terrain=s.lookaheadTerrain;
  if(s.terrainInhibit!==true&&terrain?.validated===true&&terrain?.kind==='TERRAIN'&&finite(terrain.timeToImpactSec)){
    if(terrain.timeToImpactSec<=30&&terrain.timeToImpactSec>=0)
      push('LOOKAHEAD_TERRAIN_WARNING','verified terrain projected impact <=30s (FCOM approximately 20-30s)');
    else if(terrain.timeToImpactSec<=60&&terrain.timeToImpactSec>30)
      push('LOOKAHEAD_TERRAIN_CAUTION','verified terrain projected impact 30-60s (FCOM approximately 40-60s)');
  }else if(terrain&&!terrain.validated){diag.push('LOOKAHEAD_TERRAIN_REQUIRES_VALIDATED_DATABASE');}
  if(ra<=APPROX.maxBasicGpwsRadioFt){
    // Mode 1: abnormal descent rate. The FCOM does NOT print an exact sink-rate envelope.
    if(sink!==null&&sink>0){
      if(sink>=APPROX.mode1WarningFpm(ra)){
        push('MODE1_PULL_UP','training approximate excessive descent warning');
      }else if(sink>=APPROX.mode1CautionFpm(ra)){
        push('MODE1_SINK_RATE_CAUTION','SINK RATE-only recording missing: silent visual caution');
      }
    }
    // Mode 2: no inference from radio altitude surrogate. Need independent closure.
    if(s.terrainClosureValidated===true&&finite(s.terrainClosureFpm)&&ra<=1800){
      if(s.terrainClosureFpm>=APPROX.mode2WarningClosureFpm)
        push('MODE2_PULL_UP','validated excessive terrain closure rate; training approximate threshold');
      else if(s.terrainClosureFpm>=APPROX.mode2CautionClosureFpm)
        push('MODE2_TERRAIN_CAUTION','TERRAIN-only recording missing: silent visual caution');
    }
  }
  // Mode 3: independent takeoff / go-around altitude-loss memory.
  const takeoffOrGA=s.phase==='INITIAL_CLIMB'||s.phase==='TAKEOFF'||s.phase==='GO_AROUND';
  if(takeoffOrGA&&ra<=1500&&ctx.mode3Armed===true&&finite(ctx.mode3PeakFt)){
    const loss=ctx.mode3PeakFt-ra;
    if(loss>=APPROX.mode3LossFt(ctx.mode3PeakFt)){
      push('MODE3_DONT_SINK_FIRST','altitude loss after takeoff/go-around; training threshold');
    }
  }
  // Mode 4: gear/flap inhibit switches affect only their respective warning.
  // At high speed an unsafe configuration demands TOO LOW TERRAIN instead.
  const gearKnown=typeof s.gearDownLocked==='boolean',flapsKnown=finite(s.flapsDeg);
  const landing=s.phase==='FINAL_APPROACH'||s.phase==='LANDING'||s.phase==='AIRBORNE';
  if(landing&&ra<=APPROX.mode4UnsafeRadioFt&&ias!==null&&gearKnown&&flapsKnown){
    const gearMissing=!s.gearDownLocked,flapMissing=s.flapsDeg<30;
    if(ias>=APPROX.mode4LowSpeedKt && (gearMissing||flapMissing) && s.terrainInhibit!==true){
      push('MODE4_TOO_LOW_TERRAIN','high IAS/unsafe landing configuration; training threshold');
    }else if(ias<APPROX.mode4LowSpeedKt){
      if(gearMissing&&s.gearInhibit!==true)
        push('MODE4_TOO_LOW_GEAR','low IAS/gear unsafe; training threshold');
      else if(!gearMissing&&flapMissing&&s.flapInhibit!==true)
        push('MODE4_TOO_LOW_FLAPS','low IAS/landing flap unsafe; training threshold');
    }
  }else if(landing&&ra<=APPROX.mode4UnsafeRadioFt){diag.push('MODE4_INPUTS_INVALID: IAS/GEAR/FLAPS required');}
  // Mode 5: 1.3 dots comes from actual FCOM chapter 15, unlike Mode 1/4 approximations.
  if(ra>=30&&ra<1000&&s.ilsValid===true&&s.glideslopeInhibit!==true&&
    finite(s.glideslopeBelowDots)&&s.glideslopeBelowDots>1.3&&
    s.phase==='FINAL_APPROACH')push('MODE5_GLIDESLOPE','valid ILS >1.3 dots below glideslope');
  return {out,diag};
}
class Engine{
 constructor(){this.reset();}
 reset(){this.lastId=null;this.lastPlayedAt=-Infinity;this.mode3PeakFt=null;this.mode3Armed=false;
   this.lastPhase=null;this.mode3Count=0;this.mode1Since=null;this.mode2Since=null;this.lastDiagnostics=[];this.lastSnapshot=null;}
 update(input={},nowMs=0){
   if(!finite(nowMs))throw Error('EGPWS_INVALID_TIME');
   const state=input;
   // FCOM Mode 3 takeoff/go-around altitude-loss memory persists only in matching phase.
   const mode3Phase=['INITIAL_CLIMB','TAKEOFF','GO_AROUND'].includes(state.phase);
   const ra=finite(state.raFt)?state.raFt:null;
   if(state.onGround===true||!mode3Phase||ra===null||ra>1500){this.mode3Armed=false;this.mode3PeakFt=null;this.mode3Count=0;}
   else {
     if(!this.mode3Armed){this.mode3Armed=true;this.mode3PeakFt=ra;this.mode3Count=0;}
     this.mode3PeakFt=Math.max(this.mode3PeakFt,ra);
   }
   const {out,diag}=hazards(state,this);
   out.sort((a,b)=>b.priority-a.priority);
   let top=out[0]||null;
   const mode1=out.find(x=>x.id==='MODE1_PULL_UP');
   const mode2=out.find(x=>x.id==='MODE2_PULL_UP');
   if(mode1){this.mode1Since??=nowMs;}
   else this.mode1Since=null;
   if(mode2){this.mode2Since??=nowMs;}
   else this.mode2Since=null;
   const shouldPlay=top?.sample&&(
     this.lastId!==top.id || nowMs-this.lastPlayedAt>=APPROX.repeatMs);
   let event=null;
   if(shouldPlay){
     let effective=top;
     // Standalone PULL UP recording is reserved for a *continued* severe event.
     if(top.id==='MODE1_PULL_UP'&&this.mode1Since!==null&&nowMs-this.mode1Since>=APPROX.repeatMs)
       effective={id:'MODE1_CONTINUED_PULL_UP',...ALERTS.MODE1_CONTINUED_PULL_UP,why:top.why};
     if(top.id==='MODE2_PULL_UP'&&this.mode2Since!==null&&nowMs-this.mode2Since>=APPROX.repeatMs)
       effective={id:'MODE2_CONTINUED_PULL_UP',...ALERTS.MODE2_CONTINUED_PULL_UP,why:top.why};
     if(top.id==='MODE3_DONT_SINK_FIRST'&&this.mode3Count>=1)
       effective={id:'MODE3_DONT_SINK_REPEAT',...ALERTS.MODE3_DONT_SINK_REPEAT,why:top.why};
     event={...effective,atMs:nowMs};
     if(top.id==='MODE3_DONT_SINK_FIRST')this.mode3Count++;
     this.lastPlayedAt=nowMs;
   }
   if(top?.id!==this.lastId && !shouldPlay)this.lastPlayedAt=-Infinity;
   this.lastId=top?.id||null;
   this.lastPhase=state.phase;
   this.lastDiagnostics=diag;
   this.lastSnapshot={active:out,top,event,diagnostics:diag,trainingApproximation:true,source:'FCOM_CH15_737CL'};
   return this.lastSnapshot;
 }
 getState(){return this.lastSnapshot;}
}
return Object.freeze({Engine,ALERTS,APPROX,SIGNALS,hazards});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
