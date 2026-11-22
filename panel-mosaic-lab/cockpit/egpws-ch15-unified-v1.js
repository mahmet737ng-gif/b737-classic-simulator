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