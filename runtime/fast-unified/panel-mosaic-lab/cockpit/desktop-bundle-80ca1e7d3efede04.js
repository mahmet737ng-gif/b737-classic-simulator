(async()=>{
;
/* ./egpws-ch15-unified-v1.js?v=EGPWS-CH15-0001 */
try{
/* Unified live EGPWS Chapter 15 trainer bridge. Model inputs and real owner audio are isolated.
 * Does not manufacture look-ahead terrain from airport elevation or predictive winds.
 */
(function(root){'use strict';
 if(!root?.document)return;
 const Lib=root.B737ClassicEGPWSCh15V1,Audio=root.B737OwnerEGPWSSamplesV1;
 if(!Lib?.Engine||!Audio?.Player){root.console?.error?.('EGPWS_CH15_MISSING_DEPENDENCIES');return;}
 const logic=new Lib.Engine(),player=new Audio.Player();
 const $=id=>root.document.getElementById(id);
 const valid=n=>typeof n==='number'&&Number.isFinite(n);
 const flight=()=>root.B737UnifiedFlightScenarioV1?.getState?.()||null;
 const state={enabled:true,alarm:null,diagnostics:[],sinceMs:null,lastInput:null,assetReady:false,clipCount:0,
  samplePlaying:null,lastError:null,suppressed:[],override:{},inhibits:{gear:false,flap:false,terrain:false,glideslope:false},
  timedByScenario:false};
 let panel=null,latestHash='',goAroundUntilMs=-Infinity,logicalClockMs=0,reportedAt=-Infinity,sequence=0,missionId=null,lastElapsed=null;
 const diag=()=>root.B737UnifiedFlightScenarioV1?.getDiagnostics?.()||{};
 const derive=s=>{
  const gear=root.B737LandingGearUnifiedV1?.getState?.();
  const gearDownLocked=gear?.gear&&['nose','left','right'].every(x=>gear.gear[x]==='DOWN')?true:
    gear?.gear&&['nose','left','right'].every(x=>['DOWN','UP','TRANSIT'].includes(gear.gear[x]))?false:null;
  let efis=null;try{efis=root.B737UnifiedEfisSources?.project?.('CAPT')||null;}catch(_){}
  const sensorRa=efis?.health?.radioAltQuality==='VALID'&&valid(efis?.ra?.heightFt)?efis.ra.heightFt:null;
  const raFt=sensorRa??(valid(s.radioAltitudeFt)?s.radioAltitudeFt:null);
  const trainingIls=['FINAL_5','FINAL_10'].includes(s.preset)&&
    ['TRAINING_ILS_PROXY','VERIFIED_INPUT'].includes(s.georefQuality);
  const ilsValid=Boolean(efis?.ils?.valid===true||trainingIls);
  const activeGA=Date.now()<goAroundUntilMs&&s.airborne===true&&raFt!==null&&raFt<1500;
  const phase=activeGA?'GO_AROUND':s.phase;
  const o=state.override;
  return {onGround:typeof s.airborne==='boolean'?!s.airborne:null,
   phase,raFt,iasKt:valid(s.iasKt)?s.iasKt:null,vsFpm:valid(s.vsFpm)?s.vsFpm:null,
   flapsDeg:valid(s.flapActual)?s.flapActual:null,gearDownLocked,
   ilsValid,glideslopeBelowDots:valid(s.glideslopeBelowDots)?s.glideslopeBelowDots:null,
   glideslopeInhibit:state.inhibits.glideslope,gearInhibit:state.inhibits.gear,
   flapInhibit:state.inhibits.flap,terrainInhibit:state.inhibits.terrain,
   gpwsSystemAvailable:o.inop===true?false:true,
   reactiveWindshearActive:o.reactiveWindshearActive===true,
   reactiveWindshearValidated:o.reactiveWindshearValidated===true,
   predictiveWindshear:o.predictiveWindshear||null,
   lookaheadTerrain:o.lookaheadTerrain||null,
   terrainClosureFpm:o.terrainClosureFpm,
   terrainClosureValidated:o.terrainClosureValidated===true,
   _raSource:sensorRa!==null?'CAPTAIN_RA_VALID':'TRAINING_AIRPORT_SURROGATE',
   _ilsSource:efis?.ils?.valid===true?'CAPTAIN_ILS':'TRAINING_ILS_PROXY'};
 };
 function ensureAudio(){
  player.init().then(n=>{state.assetReady=true;state.clipCount=n;state.lastError=null;paint();})
   .catch(e=>{state.lastError='EGPWS_AUDIO_DECODE_FAILED: '+e.message;paint();});
 }
 function unlock(){return player.enable().then(ok=>{paint();return ok;}).catch(e=>{state.lastError='AUDIO_LOCKED: '+e.message;paint();return false;});}
 function sound(event){
  const token=++sequence;
  if(!event?.sample){player.stop();state.samplePlaying=null;paint();return;}
  if(!state.enabled){player.stop();return;}
  if(!player.has(event.sample)){
   player.stop();state.lastError='NO_OWNER_APPROVED_SAMPLE_FOR_'+event.sample;return;
  }
  player.play(event.sample,.87,()=>token===sequence).then(()=>{
   if(token===sequence){state.samplePlaying=event.sample;state.lastError=null;paint();}
  }).catch(e=>{if(token===sequence){state.lastError='EGPWS_PLAY_ERROR: '+e.message;paint();}});
 }
 function publish(output,input){
   const top=output.top;
   state.alarm=top?{id:top.id,sample:top.sample,visual:top.visual,priority:top.priority,why:top.why}:null;
   state.diagnostics=output.diagnostics;
   state.lastInput=input;
   const critical=top?.visual==='PULL_UP_RED'||top?.visual==='WINDSHEAR_RED'||top?.visual==='TERRAIN_RED';
   root.document.documentElement.dataset.egpwsWarning=critical?'critical':top?'caution':'off';
   root.dispatchEvent(new CustomEvent('b737:egpws-ch15-state',{detail:{top:state.alarm,
     active:output.active.map(v=>({id:v.id,visual:v.visual,audio:v.sample})),
     critical,source:input._raSource,approximation:true,diagnostics:[...output.diagnostics]}}));
   // Critical EGPWS audio takes precedence over ordinary RA callouts in this training mixer.
   if(critical)root.dispatchEvent(new CustomEvent('b737:egpws-aural-preempt-ra',{detail:{critical:true,alert:top.id}}));
   paint();
 }
 function run(s){
   if(!s||typeof s!=='object')return;
   const d=diag();if(d?.active!==true)return;
   const identity=[s.icao,s.runway,s.preset].join('|');
   if(missionId!==identity||(valid(lastElapsed)&&valid(s.elapsedSec)&&s.elapsedSec<lastElapsed)){logic.reset();player.stop();++sequence;}
   missionId=identity;lastElapsed=s.elapsedSec;
   const input=derive(s);logicalClockMs=valid(s.elapsedSec)?s.elapsedSec*1000:Date.now();
   const previous=state.alarm?.id||null;
   const output=logic.update(input,logicalClockMs);
   publish(output,input);
   if(output.top?.id!==previous){++sequence;player.stop();state.samplePlaying=null;}
   if(output.event?.sample)sound(output.event);
 }
 function paint(){
   if(!panel)return;
   const s=state,p=player.state(),a=s.alarm;
   const raw=a?a.id+' / '+(a.sample||'NO APPROVED CLIP'):'NO ACTIVE ALERT';
   const lock=p.armed?'AUDIO ARMED':'TAP SCREEN TO ENABLE AUDIO';
   const text=(s.enabled?'ENABLED':'DISABLED')+' · '+(s.assetReady?s.clipCount+' OWNER CLIPS READY':'DECODING')+
     ' · '+lock+' · '+raw+(s.lastError?' · ERROR '+s.lastError:'')+
     (s.lastInput?' · RA '+(s.lastInput.raFt??'?')+' / '+s.lastInput._raSource:'');
   if(text!==latestHash){latestHash=text;$('egpwsCh15Status').textContent=text;}
   $('egpwsCh15Current').textContent=a?('ACTIVE '+a.visual+' · '+a.why):'NORMAL — no active GPWS/terrain warning';
   $('egpwsCh15Current').style.color=a?.visual?.includes('RED')?'#ff8f8f':a?'#e6cb83':'#a4dac5';
 }
 function mount(){
   if(panel)return;
   const host=$('inspector');if(!host)return;
   panel=root.document.createElement('section');panel.id='egpwsCh15Controls';
   panel.style.cssText='border:1px solid #587c6a;border-radius:10px;padding:10px;margin:9px 0;background:#142329;color:#e1f1e8;font:12px/1.5 system-ui;direction:ltr';
   panel.innerHTML='<b>EGPWS · FCOM CHAPTER 15 · OWNER AUDIO</b><p id="egpwsCh15Status" role="status">STARTING...</p>'+ 
     '<div id="egpwsCh15Current">NO ACTIVE ALERT</div>'+ 
     '<button id="egpwsCh15Enable" type="button">ENABLE AUDIO / TEST SPEAKER</button> '+
     '<button id="egpwsCh15Stop" type="button">STOP SOUND</button>'+ 
     '<details><summary>11 owner recordings · individual listening test</summary><div id="egpwsCh15Clips" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:9px"></div></details>'+ 
     '<small style="display:block;margin-top:8px">Requires actual flight-state/validated threat input. Terrain database and reactive windshear sensors are NOT fabricated. Training-only Mode 1/3/4 envelopes are labelled approximate. Radio Altimeter callouts remain separate.</small>';
   host.prepend(panel);
   $('egpwsCh15Enable').onclick=()=>unlock();
   $('egpwsCh15Stop').onclick=()=>{++sequence;player.stop();state.samplePlaying=null;paint();};
   const grid=$('egpwsCh15Clips');
   for(const clip of Audio.list()){
     const btn=root.document.createElement('button');btn.type='button';btn.textContent=clip.label;
     btn.style.cssText='font:11px/1.2 system-ui;padding:6px 8px;background:#274248;color:#fff;border:1px solid #5a8583;border-radius:5px;cursor:pointer';
     btn.onclick=async()=>{await unlock();sound({sample:clip.key});};grid.append(btn);
   }
   paint();
 }
 function setScenario(inputs={}){
   const allowed=['reactiveWindshearActive','reactiveWindshearValidated','predictiveWindshear','lookaheadTerrain',
     'terrainClosureFpm','terrainClosureValidated','inop'];
   for(const [key,value] of Object.entries(inputs)){if(!allowed.includes(key))throw Error('UNKNOWN_EGPWS_SIGNAL_'+key);state.override[key]=value;}
   const s=flight();if(s)run(s);return {override:{...state.override}};
 }
 function setInhibits(v={}){
  for(const [k,x] of Object.entries(v)){
   if(!Object.hasOwn(state.inhibits,k)||typeof x!=='boolean')throw Error('UNKNOWN_EGPWS_INHIBIT_'+k);
   state.inhibits[k]=x;
  }const s=flight();if(s)run(s);return {...state.inhibits};
 }
 function stop(){++sequence;logic.reset();missionId=null;lastElapsed=null;player.stop();state.alarm=null;state.samplePlaying=null;paint();}
 function init(){mount();ensureAudio();
   const s=flight();if(s)run(s);
   root.document.addEventListener('pointerdown',()=>{if(!player.state().armed)unlock();},{capture:true});
   root.document.addEventListener('keydown',()=>{if(!player.state().armed)unlock();},{capture:true});
 }
 root.addEventListener('b737:flight-scenario-state',e=>run(e.detail));
 root.addEventListener('b737:flight-scenario-stopped',stop);
 root.addEventListener('b737:toga-request',()=>{goAroundUntilMs=Date.now()+75000;});
 root.addEventListener('b737:egpws-scenario-input',e=>{try{setScenario(e.detail||{});}catch(error){state.lastError=error.message;paint();}});
 root.addEventListener('b737:egpws-inhibit-switches',e=>{try{setInhibits(e.detail||{});}catch(error){state.lastError=error.message;paint();}});
 root.addEventListener('pagehide',()=>{++sequence;player.stop();});
 root.B737UnifiedEGPWSCh15V1=Object.freeze({
   getState:()=>({enabled:state.enabled,assetReady:state.assetReady,clipCount:state.clipCount,
     alarm:state.alarm,lastInput:state.lastInput,lastError:state.lastError,
     diagnostics:[...state.diagnostics],playingKey:player.playingKey,inhibits:{...state.inhibits},
     sampleStatus:player.state(),approximation:true}),
   setScenario,setInhibits,clearScenario(){state.override={};logic.reset();run(flight());},
   playOwnerClip:key=>sound({sample:key}),stop,enable:unlock
 });
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window==='object'?window:null);
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
