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
