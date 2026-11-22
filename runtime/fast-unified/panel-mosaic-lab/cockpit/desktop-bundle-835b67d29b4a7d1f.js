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
 let statusNode=null;
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
   for(const event of callouts){
    const key=Owner.keyFor(event.id,event.message);
    if(player.has(key))player.enqueue(key,.20);
    else diagnostics.missing.push(key);
   }
  }
  if(raQuality!=='VALID')status('RADIO ALTIMETER INPUT '+raQuality+' · NO CALLOUT');
  else if(dh!==null&&dh<0)status('RA '+Math.round(ra)+' FT · DH '+dh+' FT · MINIMUMS INHIBITED');
  else if(callouts.length)status('TRIGGERED · '+callouts.map(x=>x.message).join(' / '));
  else status('ARMED · RA '+Math.round(ra)+' FT · DH '+(dh===null?'N/A':dh+' FT'));
  lastDH=dh;
 }
 function getDiagnostics(){return JSON.parse(JSON.stringify({...diagnostics,lastStatus,missing:diagnostics.missing.slice(-12)}));}
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
/* ../../audio/stick-shaker-aural-logic-v1.js?v=SHKR-OWNER-0001 */
try{
/* Two independent stall-warning demand sources feeding one approved shaker sound.
 * Training adapter: speed-tape lower red band and AFT OH STALL WARN TEST 1/2.
 * FCOM-based test eligibility: ground + 115V AC (unknown AC is explicitly provisional).
 * No guessed stall/AoA law. Uses an already computed red-band threshold only.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ShakerAuralLogicV1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const isNum=x=>typeof x==='number'&&Number.isFinite(x);
 function evaluate(input={}){
  const onGround=input.onGround;
  const airValid=onGround===false;
  const speedValid=airValid&&isNum(input.iasKt)&&isNum(input.shakerBoundaryKt)&&input.shakerBoundaryKt>0;
  const speedDemand=speedValid&&input.iasKt<=input.shakerBoundaryKt;
  const explicitDemand=airValid&&input.flightStallDemand===true;
  const ac=input.ac115Available;
  const testEligible=onGround===true&&ac!==false;
  const channels={1:testEligible&&input.test1===true,2:testEligible&&input.test2===true};
  const active=speedDemand||explicitDemand||channels[1]||channels[2];
  return Object.freeze({active,realStall:speedDemand||explicitDemand,
   speedDemand,explicitDemand,groundTest:channels[1]||channels[2],channels,
   testEligible,testPowerUnverified:testEligible&&ac===null,
   speedValid,reason:active?speedDemand?'LOWER_RED_BAND':explicitDemand?'STALL_WARNING_SIGNAL':channels[1]&&channels[2]?'BOTH_TEST_CHANNELS':channels[1]?'TEST_1':'TEST_2':'OFF'});
 }
 return Object.freeze({evaluate});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./stick-shaker-audio-unified-v1.js?v=SHKR-OWNER-0001 */
try{
/* Unified owner-approved Stick Shaker audio driver. Original e.mp3 is imported locally,
 * never published to public GitHub. Uses attack / 75 ms overlapped sustain / natural release.
 * Distinct real-flight lower-red-band and AFT OH TEST 1/2 demands share one voice.
 */
(function(root){'use strict';
 if(!root?.document)return;
 const Logic=root.B737ShakerAuralLogicV1;
 const Bank=root.B737RealAudioBank?.RealAudioBank;
 if(!Logic||!Bank)return;
 const $=id=>root.document.getElementById(id);
 const realBank=new Bank();
 let context=null,buffer=null,player=null,ready=false,verifiedAudio=false,seenTest={1:false,2:false};
 let last=null,panel=null,armed=false,reported='',loadError='';
 const BUNDLED_SOURCE='../../audio-lab/assets/shaker-owner-v1.m4a';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const format=st=>st==null?'UNKNOWN':st?'ON':'OFF';
 class LoopPlayer{
  constructor(ctx,clip){
   this.ctx=ctx;this.clip=clip;this.playing=false;this.nodes=new Set();this.timer=null;this.next=0;
  }
  piece(start,end,when,fadeIn=0,fadeOut=0,level=.88){
   const ctx=this.ctx,src=ctx.createBufferSource(),g=ctx.createGain();
   src.buffer=this.clip;src.connect(g);g.connect(ctx.destination);
   const stop=Math.max(start+.04,Math.min(this.clip.duration,end)),duration=stop-start;
   g.gain.setValueAtTime(fadeIn?0:level,when);
   if(fadeIn)g.gain.linearRampToValueAtTime(level,when+fadeIn);
   if(fadeOut){g.gain.setValueAtTime(level,when+duration-fadeOut);g.gain.linearRampToValueAtTime(0,when+duration);}
   const item={src,g,when,end:when+duration};
   this.nodes.add(item);
   src.onended=()=>{this.nodes.delete(item);try{src.disconnect();g.disconnect()}catch(_){}};
   src.start(when,start,duration);
   return item;
  }
  pump(){
   if(!this.playing)return;
   const now=this.ctx.currentTime;
   while(this.next<now+.48){
    this.piece(.30,1.25,this.next,.075,.075);
    this.next+=.95-.075;
   }
  }
  start(){
   if(this.playing)return;
   this.halt();
   this.playing=true;
   const now=this.ctx.currentTime+.018;
   this.piece(0,1.25,now,0,.075);
   this.next=now+1.175;
   this.pump();
   this.timer=setInterval(()=>this.pump(),90);
  }
  halt(){
   this.playing=false;
   if(this.timer!=null){clearInterval(this.timer);this.timer=null;}
   const now=this.ctx.currentTime;
   for(const node of [...this.nodes]){
    const {src,g}=node;
    try{g.gain.cancelScheduledValues(now);g.gain.setTargetAtTime(0,now,.016);src.stop(now+.08)}catch(_){}
   }
  }
  stop(){
   if(!this.playing)return;
   this.halt();
   // Natural deceleration is only ever played when all stall/test sources clear.
   const now=this.ctx.currentTime+.022;
   this.piece(1.25,this.clip.duration,now,.035,0,.95);
  }
  destroy(){this.halt();}
 }
 async function unlock(){
  const AC=root.AudioContext||root.webkitAudioContext;
  if(!AC)throw Error('Web Audio is unavailable');
  if(!context)context=new AC();
  if(context.state==='suspended')await context.resume();
  armed=context.state==='running';
  draw();
 }
 async function load(file,persist=true){
  if(persist&&!ready)throw Error('Audio bank is not ready');
  if(!root.B737RealAudioBank.validAudioFile(file))throw Error('Invalid sample: use e.mp3 or supported audio');
  const AC=root.AudioContext||root.webkitAudioContext;
  if(!AC)throw Error('Audio decoder unavailable');
  const ctx=context||(context=new AC());
  const decoded=await ctx.decodeAudioData(await file.arrayBuffer());
  if(!decoded||decoded.duration<1.5||decoded.duration>5)throw Error('Expected an approximately 2 second approved shaker recording');
  if(player)player.destroy();
  buffer=decoded;player=new LoopPlayer(ctx,buffer);
  if(persist)await realBank.add('shaker',file);
  verifiedAudio=true;
  draw();
  refresh();
 }
 function avionics(topic){
  try{return root.B737UnifiedAvionicsNetworkV1?.getSignal?.(topic)||null;}catch(_){return null;}
 }
 function flightSnapshot(){
  let scene=null,diag=null;
  try{
   diag=root.B737UnifiedFlightScenarioV1?.getDiagnostics?.();
   if(diag?.active===true)scene=root.B737UnifiedFlightScenarioV1.getState?.()||null;
  }catch(_){}
  const ag=avionics('aircraft.airground'),tape=root.B737UnifiedSpeedTapeV1;
  const view=(()=>{try{return tape?.getView?.('CAPT')||null}catch(_){return null}})();
  const electrical=root.B737UnifiedElectricalLive?.snapshot?.();
  const knownGround=typeof scene?.airborne==='boolean'?!scene.airborne:
   ag?.quality==='VALID'&&typeof ag.value?.onGround==='boolean'?ag.value.onGround:
   typeof electrical?.controls?.onGround==='boolean'?electrical.controls.onGround:
   typeof view?.inFlight==='boolean'?!view.inFlight:null;
  let ias=null,boundary=null,origin='UNAVAILABLE';
  // Use EXACT lower-red-band boundary represented in the current CAPT speed tape.
  if(view&&['VALID','TRAINING'].includes(view.quality)&&finite(view.casKt)&&
     finite(view.marks?.stickShakerKt)){
   ias=view.casKt;boundary=view.marks.stickShakerKt;origin='CAPT_SPEED_TAPE';
  } else if(scene?.aeroEnvelope?.source==='INSTRUCTOR_AERO_PROXY_NOT_FCOM_DATA'&&
            finite(scene.iasKt)&&finite(scene.aeroEnvelope.stickShakerKt)){
   ias=scene.iasKt;boundary=scene.aeroEnvelope.stickShakerKt;origin='INSTRUCTOR_RED_BAND';
  }
  const bus=avionics('electrical.buses'),v=bus?.value;
  let ac=null;
  if(bus?.quality==='VALID'&&v){
   const candidates=['ac115Available','acBus1Powered','acBus2Powered','acBus1','acBus2','AC_BUS_1','AC_BUS_2'].map(k=>v[k]).filter(x=>x!==undefined&&x!==null);
   const flags=candidates.map(x=>typeof x==='boolean'?x:typeof x==='object'?x.powered===true?true:x.powered===false?false:null:
     ['ON','POWERED','ENERGIZED','AVAILABLE'].includes(String(x).toUpperCase())?true:
     ['OFF','UNPOWERED','DEENERGIZED'].includes(String(x).toUpperCase())?false:null).filter(x=>x!==null);
   if(flags.length)ac=flags.some(Boolean);
  }
  return {onGround:knownGround,iasKt:ias,shakerBoundaryKt:boundary,source:origin,ac115Available:ac};
 }
 function draw(){
  if(!panel)return;
  const s=last||{};
  $('shakerAudioStatus').textContent=
   (verifiedAudio?'OWNER e.mp3 AUDIO INSTALLED':'NO AUDIO'+(loadError?' · '+loadError:' · LOADING'))+
   ' | Audio '+(armed?'ARMED':'LOCKED — ENABLE AUDIO')+
   ' | State '+(s.reason||'OFF')+
   ' | Source '+(s.source||'UNAVAILABLE')+
   ' | Ground '+format(s.onGround)+' | AC '+format(s.ac115Available)+
   (s.groundTest&&s.testPowerUnverified?' | AC power is unverified (trainer only)':'');
  for(const ch of [1,2]){
   const b=$('shakerTest'+ch);
   if(b)b.setAttribute('aria-pressed',seenTest[ch]?'true':'false');
  }
 }
 function refresh(){
  const f=flightSnapshot();
  const st=Logic.evaluate({...f,test1:seenTest[1],test2:seenTest[2]});
  last={...st,source:f.source,onGround:f.onGround,ac115Available:f.ac115Available};
  if(player&&armed){
   if(st.active&&!player.playing)player.start();
   if(!st.active&&player.playing)player.stop();
  }
  const fingerprint=[st.reason,st.active,st.groundTest,f.source,verifiedAudio,armed].join('|');
  if(fingerprint!==reported){reported=fingerprint;draw();
   root.dispatchEvent(new CustomEvent('b737:stick-shaker-audio-state',{detail:{
    active:st.active,reason:st.reason,source:f.source,audioReady:verifiedAudio&&armed,
    channels:st.channels,redBandThresholdKt:f.shakerBoundaryKt,iasKt:f.iasKt
   }}));
  }
  return st;
 }
 function press(ch,value){
  if(ch!==1&&ch!==2)return;
  seenTest[ch]=Boolean(value);
  refresh();
 }
 async function loadBundled(){
   try{
     const response=await root.fetch(BUNDLED_SOURCE,{cache:'force-cache'});
     if(!response.ok)throw Error('HTTP_'+response.status);
     const blob=await response.blob();
     const file=new File([blob],'e.m4a',{type:'audio/mp4'});
     await load(file,false);
     loadError='';
   }catch(error){
     loadError='BUNDLED_FILE_UNAVAILABLE: '+error.message;
     root.console?.warn?.('Owner Stick Shaker automatic audio loading failed',error);
   }
   draw();refresh();
 }
 function mount(){
  if(panel||!$('inspector'))return;
  panel=root.document.createElement('section');
  panel.id='ownerStickShakerAudioV1';
  panel.style.cssText='border:1px solid #426179;border-radius:8px;padding:10px;background:#111f2a;color:#dceaf5;direction:ltr';
  panel.innerHTML='<h3 style="margin:0 0 7px">STALL WARNING · STICK SHAKER AUDIO</h3>'+
   '<p id="shakerAudioStatus" style="font-size:12px;line-height:1.4;margin:5px 0" role="status">LOADING AUDIO BANK</p>'+
   '<label style="display:block;font-size:12px">Approved source e.mp3 (manual fallback only) <input id="shakerFile" type="file" accept="audio/*,.mp3" style="max-width:100%;display:block;margin:4px 0 9px"></label>'+
   '<button id="shakerUnlock" type="button">ENABLE / REPAIR AUDIO</button>'+
   '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:9px 0">'+
   '<button id="shakerTest1" type="button" aria-pressed="false">AFT OH · STALL WARN TEST 1</button>'+
   '<button id="shakerTest2" type="button" aria-pressed="false">AFT OH · STALL WARN TEST 2</button></div>'+
   '<small style="display:block">Two independent momentary test channels (ground/AC) and automatic airborne lower red-band demand. Same sampled shaker; no generated sounds.</small>';
  $('inspector').append(panel);
  const attach=(button,ch)=>{
   if(!button)return;
   let down=false;
   const release=()=>{if(!down)return;down=false;press(ch,false)};
   button.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;
     down=true;unlock().then(()=>refresh()).catch(()=>{});press(ch,true);
     try{button.setPointerCapture(e.pointerId)}catch(_){}});
   for(const event of ['pointerup','pointercancel','lostpointercapture','blur'])button.addEventListener(event,release);
   button.addEventListener('keydown',e=>{if(!e.repeat&&(e.key===' '||e.key==='Enter')){e.preventDefault();down=true;unlock().then(refresh).catch(()=>{});press(ch,true)}});
   button.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter')release()});
  };
  attach($('shakerTest1'),1);attach($('shakerTest2'),2);
  $('shakerUnlock').addEventListener('click',()=>unlock().then(refresh).catch(e=>{$('shakerAudioStatus').textContent=e.message}));
  $('shakerFile').addEventListener('change',async e=>{
   const file=e.target.files?.[0];if(!file)return;
   try{await unlock();await load(file)}catch(error){$('shakerAudioStatus').textContent='ERROR: '+error.message;}
  });
  draw();
 }
 // Native pointer gestures in an overhead iframe do not bubble into parent.
 // Unlock/resume the one approved audio engine in the iframe's actual gesture.
 const gestureUnlock=()=>{
  if(verifiedAudio&&!armed)unlock().then(refresh).catch(error=>{
   loadError='AUDIO_UNLOCK_FAILED: '+error.message;draw();
  });
 };
 root.document.addEventListener('pointerdown',gestureUnlock,true);
 root.document.addEventListener('keydown',gestureUnlock,true);
 let boundOverhead=null;
 function bindOverheadUnlock(){
  const frame=$('overheadFrame');
  let doc=null;
  try{doc=frame?.contentDocument||null;}catch(_){}
  if(!doc||doc===boundOverhead)return false;
  boundOverhead=doc;
  doc.addEventListener('pointerdown',gestureUnlock,true);
  doc.addEventListener('keydown',gestureUnlock,true);
  return true;
 }
 root.addEventListener('message',event=>{
  if(event.origin!==root.location.origin||event.source!==$('overheadFrame')?.contentWindow)return;
  const d=event.data;
  if(d?.type!=='b737:cockpit-overhead')return;
  if(d.kind==='ready'){bindOverheadUnlock();return;}
  if(d.kind!=='stick-shaker-test'||![1,2].includes(d.channel)||typeof d.pressed!=='boolean')return;
  if(d.pressed)gestureUnlock();
  press(d.channel,d.pressed);
 });
 root.addEventListener('b737:cockpit-mounted',bindOverheadUnlock);
 const installGestureBinding=()=>{
  const frame=$('overheadFrame');
  frame?.addEventListener('load',bindOverheadUnlock);
  bindOverheadUnlock();
 };
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',installGestureBinding,{once:true});
 else installGestureBinding();
 for(const type of ['b737:flight-scenario-state','b737:flight-scenario-stopped','b737:avionics-data','b737:cockpit-mounted']){
  root.addEventListener(type,()=>refresh());
 }
 root.addEventListener('pagehide',()=>{press(1,false);press(2,false);player?.destroy();context?.close().catch(()=>{});});
 root.addEventListener('blur',()=>{press(1,false);press(2,false)});
 root.document.addEventListener('visibilitychange',()=>{if(root.document.hidden){press(1,false);press(2,false)}});
 const init=async()=>{
  mount();
  realBank.init().then(async()=>{
    ready=true;
    const item=realBank.get('shaker');
    if(item?.blob)await load(item.blob,false);
  }).catch(error=>root.console?.warn?.('Stick Shaker local storage unavailable',error));
  await loadBundled();
  draw();refresh();setInterval(refresh,125);
 };
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 root.B737UnifiedStickShakerAudioV1=Object.freeze({getState:()=>last,setTest:press,refresh,
  audioStatus:()=>({installed:verifiedAudio,armed,loadError,playing:Boolean(player?.playing)})});
})(typeof window==='object'?window:null);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
