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
 let last=null,panel=null,armed=false,reported='';
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
    this.piece(.44,1.32,this.next,.075,.075);
    this.next+=.88-.075;
   }
  }
  start(){
   if(this.playing)return;
   this.halt();
   this.playing=true;
   const now=this.ctx.currentTime+.018;
   this.piece(0,.52,now,0,.10);
   this.next=now+.44;
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
   this.piece(1.36,this.clip.duration,now,.035,0,.95);
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
 async function load(file){
  if(!ready)throw Error('Audio bank is not ready');
  if(!root.B737RealAudioBank.validAudioFile(file))throw Error('Invalid sample: use e.mp3 or supported audio');
  const AC=root.AudioContext||root.webkitAudioContext;
  if(!AC)throw Error('Audio decoder unavailable');
  const ctx=context||(context=new AC());
  const decoded=await ctx.decodeAudioData(await file.arrayBuffer());
  if(!decoded||decoded.duration<1.5||decoded.duration>5)throw Error('Expected an approximately 2 second approved shaker recording');
  if(player)player.destroy();
  buffer=decoded;player=new LoopPlayer(ctx,buffer);
  await realBank.add('shaker',file);
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
  const knownGround=typeof scene?.airborne==='boolean'?!scene.airborne:
   ag?.quality==='VALID'&&typeof ag.value?.onGround==='boolean'?ag.value.onGround:
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
   (verifiedAudio?'APPROVED e.mp3 INSTALLED':'NO AUDIO — IMPORT e.mp3')+
   ' | Audio '+(armed?'ARMED':'LOCKED — ENABLE AUDIO')+
   ' | State '+(s.reason||'OFF')+
   ' | Source '+(s.source||'UNAVAILABLE')+
   (s.groundTest&&s.testPowerUnverified?' | AC power is unverified (trainer only)':'');
  for(const ch of [1,2]){
   const b=$('shakerTest'+ch);
   if(b)b.setAttribute('aria-pressed',seenTest[ch]?'true':'false');
  }
 }
 function refresh(){
  const f=flightSnapshot();
  const st=Logic.evaluate({...f,test1:seenTest[1],test2:seenTest[2]});
  last={...st,source:f.source};
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
 function mount(){
  if(panel||!$('inspector'))return;
  panel=root.document.createElement('section');
  panel.id='ownerStickShakerAudioV1';
  panel.style.cssText='border:1px solid #426179;border-radius:8px;padding:10px;background:#111f2a;color:#dceaf5;direction:ltr';
  panel.innerHTML='<h3 style="margin:0 0 7px">STALL WARNING · STICK SHAKER AUDIO</h3>'+
   '<p id="shakerAudioStatus" style="font-size:12px;line-height:1.4;margin:5px 0" role="status">LOADING AUDIO BANK</p>'+
   '<label style="display:block;font-size:12px">Owner-approved source e.mp3 <input id="shakerFile" type="file" accept="audio/*,.mp3" style="max-width:100%;display:block;margin:4px 0 9px"></label>'+
   '<button id="shakerUnlock" type="button">ENABLE AUDIO</button>'+
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
 root.addEventListener('message',event=>{
  if(event.origin!==root.location.origin||event.source!==$('overheadFrame')?.contentWindow)return;
  const d=event.data;
  if(d?.type!=='b737:cockpit-overhead'||d.kind!=='stick-shaker-test')return;
  if(![1,2].includes(d.channel)||typeof d.pressed!=='boolean')return;
  press(d.channel,d.pressed);
 });
 for(const type of ['b737:flight-scenario-state','b737:flight-scenario-stopped','b737:avionics-data','b737:cockpit-mounted']){
  root.addEventListener(type,()=>refresh());
 }
 root.addEventListener('pagehide',()=>{press(1,false);press(2,false);player?.destroy();context?.close().catch(()=>{});});
 root.addEventListener('blur',()=>{press(1,false);press(2,false)});
 root.document.addEventListener('visibilitychange',()=>{if(root.document.hidden){press(1,false);press(2,false)}});
 const init=async()=>{
  mount();
  try{
   await realBank.init();ready=true;
   const item=realBank.get('shaker');
   if(item?.blob){const AC=root.AudioContext||root.webkitAudioContext;
    if(AC){context=new AC();buffer=await context.decodeAudioData(await item.blob.arrayBuffer());
      player=new LoopPlayer(context,buffer);verifiedAudio=true;}
   }
  }catch(error){root.console?.warn?.('Stick Shaker local sample unavailable',error)}
  draw();refresh();setInterval(refresh,125);
 };
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 root.B737UnifiedStickShakerAudioV1=Object.freeze({getState:()=>last,setTest:press,refresh,
  audioStatus:()=>({installed:verifiedAudio,armed,playing:Boolean(player?.playing)})});
})(typeof window==='object'?window:null);
