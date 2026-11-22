(async()=>{
;
/* ../../audio/fire-bell-aural-gate-v1.js?v=FIREBELL-OWNER-0001 */
try{
/* B737 Classic fire-bell shared audio demand gate. ATA26 remains sole authority. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.B737FireBellAuralGateV1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SOURCES=Object.freeze(['aircraft','lab']);
  class FireBellGate{
    constructor(){this.demand={aircraft:false,lab:false};this.muted={aircraft:false,lab:false};}
    setDemand(source,enabled){
      if(!SOURCES.includes(source)||typeof enabled!=='boolean')throw Error('INVALID_FIRE_BELL_DEMAND');
      this.demand[source]=enabled;return this.snapshot();
    }
    setMuted(source,muted){
      if(!SOURCES.includes(source)||typeof muted!=='boolean')throw Error('INVALID_FIRE_BELL_MUTE');
      this.muted[source]=muted;return this.snapshot();
    }
    snapshot(){
      const active=SOURCES.filter(id=>this.demand[id]&&!this.muted[id]);
      return {active:active.length>0,sources:active,demand:{...this.demand},muted:{...this.muted}};
    }
    reset(){for(const source of SOURCES){this.demand[source]=false;this.muted[source]=false;}return this.snapshot();}
  }
  // Never derive a bell from a lamp, an overheat cue, or the entire fire state.
  // The ATA26 engine's FIRE_BELL output already applies power/CB, OVHT/FIRE
  // test, alert re-arm and BELL CUTOUT / fire-warning acknowledge logic.
  function fromATA26(derived){return derived?.indications?.FIRE_BELL===true;}
  return Object.freeze({FireBellGate,fromATA26,SOURCES});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./fire-bell-audio-unified-v1.js?v=FIREBELL-OWNER-0001 */
try{
/* B737 Classic owner's real fire-alarm.mp3 — one shared ENG1/ENG2/APU/fire-test bell.
 * Owner recording is stored locally in IndexedDB; no oscillator, TTS, or guessed fire logic.
 */
(function(root){'use strict';
  if(!root?.document)return;
  const Gate=root.B737FireBellAuralGateV1, Bank=root.B737RealAudioBank;
  if(!Gate||!Bank)return;
  const gate=new Gate.FireBellGate(),bank=new Bank.RealAudioBank();
  const $=id=>root.document.getElementById(id);
  let context=null,buffer=null,player=null,bankReady=false,assetReady=false,armed=false,panel=null;
  let latest='',loadError='';
  const BUNDLED_SOURCE='../../audio-lab/assets/fire-bell-owner-v1.m4a';
  class LoopPlayer{
    constructor(ctx,clip){this.ctx=ctx;this.clip=clip;this.playing=false;this.items=new Set();this.timer=null;this.next=0;}
    schedule(when,first){
      const ctx=this.ctx,clip=this.clip;
      const start=Math.min(.05,clip.duration/12),end=Math.max(start+.1,clip.duration-.05);
      const duration=end-start,fade=Math.min(.06,duration/10);
      const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=clip;
      src.connect(gain);gain.connect(ctx.destination);
      const level=.84;
      gain.gain.setValueAtTime(0,when);
      gain.gain.linearRampToValueAtTime(level,when+(first ? .014 : fade));
      gain.gain.setValueAtTime(level,when+duration-fade);
      gain.gain.linearRampToValueAtTime(0,when+duration);
      const item={src,gain};this.items.add(item);
      src.onended=()=>{this.items.delete(item);try{src.disconnect();gain.disconnect();}catch(_){}};
      src.start(when,start,duration);
      this.next=when+duration-fade;
    }
    pump(){
      if(!this.playing)return;
      while(this.next<this.ctx.currentTime+.45){this.schedule(this.next,false);}
    }
    start(){
      if(this.playing)return;
      this.playing=true;this.next=this.ctx.currentTime+.015;
      this.schedule(this.next,true);this.timer=setInterval(()=>this.pump(),90);
    }
    stop(){
      this.playing=false;
      if(this.timer!==null){clearInterval(this.timer);this.timer=null;}
      const now=this.ctx.currentTime;
      for(const {src,gain} of [...this.items]){
        try{gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime(0,now,.012);src.stop(now+.065);}catch(_){}
      }
    }
    destroy(){this.stop();}
  }
  function status(){
    if(!panel)return;
    const s=gate.snapshot();
    const text=!assetReady?'OWNER AUDIO NOT READY'+(loadError?' · '+loadError:' · LOADING AUDIO'): 
      !armed?'OWNER AUDIO INSTALLED · TAP COCKPIT TO ENABLE SOUND':'OWNER AUDIO READY · ARMED';
    const signature=[text,s.active,s.sources.join(','),Boolean(player?.playing),loadError].join('|');
    if(signature===latest)return;
    latest=signature;
    $('fireBellAudioStatus').textContent=text+' | FIRE BELL '+(s.active?'REQUESTED':'OFF')+
      (s.active?' ['+s.sources.join(' + ')+']':'') + (assetReady&&armed?' | '+(player?.playing?'PLAYING':'STANDBY'):'');
  }
  function sync(){
    const desired=gate.snapshot().active;
    if(assetReady&&armed&&player){
      if(desired&&!player.playing)player.start();
      else if(!desired&&player.playing)player.stop();
    } else if(player?.playing)player.stop();
    status();return gate.snapshot();
  }
  async function unlock(){
    const AC=root.AudioContext||root.webkitAudioContext;
    if(!AC)throw Error('WEB_AUDIO_UNAVAILABLE');
    if(!context)context=new AC();
    if(context.state==='suspended')await context.resume();
    armed=context.state==='running';sync();return armed;
  }
  async function useFile(file,save=true){
    if(!Bank.validAudioFile(file))throw Error('Please select the owner-approved fire-alarm.mp3');
    const AC=root.AudioContext||root.webkitAudioContext;if(!AC)throw Error('WEB_AUDIO_UNAVAILABLE');
    if(!context)context=new AC();
    const audio=await context.decodeAudioData(await file.arrayBuffer());
    if(!audio||audio.duration<1||audio.duration>12)throw Error('Invalid fire-bell sample duration');
    player?.destroy();buffer=audio;player=new LoopPlayer(context,buffer);
    if(save){if(!bankReady)throw Error('LOCAL_AUDIO_BANK_NOT_READY');await bank.add('fireBell',file);}
    assetReady=true;sync();return audio.duration;
  }
  async function loadBundled(){
    try{
      const response=await root.fetch(BUNDLED_SOURCE,{cache:'force-cache'});
      if(!response.ok)throw Error('HTTP_'+response.status);
      const blob=await response.blob();
      const file=new File([blob],'fire-alarm.m4a',{type:'audio/mp4'});
      await useFile(file,false);
      loadError='';
    }catch(error){
      loadError='BUNDLED_FILE_UNAVAILABLE: '+error.message;
      root.console?.warn?.('Owner Fire Bell automatic loading failed',error);
    }
    status();
  }
  function mount(){
    if(panel||!$('inspector'))return;
    panel=root.document.createElement('section');panel.id='ownerFireBellAudioV1';
    panel.style.cssText='border:1px solid #79534b;border-radius:8px;padding:10px;background:#271923;color:#f6e1dd;direction:ltr';
    panel.innerHTML='<h3 style="margin:0 0 7px">FIRE BELL · OWNER AUDIO</h3>'+
      '<p id="fireBellAudioStatus" role="status" style="font-size:12px;line-height:1.4">AUDIO INITIALIZING</p>'+
      '<label style="font-size:12px;display:block">Automatic owner Fire Bell (manual fallback only)'+
      '<input id="fireBellSource" type="file" accept="audio/mpeg,.mp3" style="display:block;max-width:100%;margin:5px 0 9px"></label>'+
      '<button id="fireBellEnable" type="button">ENABLE FIRE BELL AUDIO</button>'+
      '<small style="display:block;margin-top:7px">Owner audio loads automatically. Import manually only if it fails. One voice for ENG 1/2, APU and OVHT/FIRE test; BELL CUTOUT silences. Lamp/EXT test does not ring.</small>';
    $('inspector').append(panel);
    $('fireBellSource').addEventListener('change',async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try{await unlock();await useFile(file);}
      catch(error){$('fireBellAudioStatus').textContent='IMPORT ERROR: '+error.message;}
      e.target.value='';
    });
    $('fireBellEnable').addEventListener('click',()=>unlock().catch(error=>{$('fireBellAudioStatus').textContent=error.message;}));
    status();
  }
  // Browser gestures unlock autoplay. A missing approved recording stays silent.
  root.document.addEventListener('pointerdown',()=>{if(assetReady&&!armed)unlock().catch(()=>{});},{capture:true});
  root.document.addEventListener('keydown',()=>{if(assetReady&&!armed)unlock().catch(()=>{});},{capture:true});
  root.addEventListener('pagehide',()=>{gate.reset();player?.destroy();context?.close().catch(()=>{});});
  root.addEventListener('b737:ata26-panel-state',e=>{gate.setDemand('aircraft',Gate.fromATA26(e.detail?.derived));sync();});
  root.addEventListener('b737:fire-lab-visibility',e=>{
    gate.setMuted('aircraft',e.detail===true);
    if(e.detail===false)gate.setDemand('lab',false);
    sync();
  });
  function init(){
    mount();
    const existing=root.B737UnifiedFireLights?.evaluate?.();
    if(existing)gate.setDemand('aircraft',Gate.fromATA26(existing));
    bank.init().then(async()=>{
      bankReady=true;
      const imported=bank.get('fireBell');
      if(imported?.blob)await useFile(imported.blob,false);
      status();
    }).catch(error=>{root.console?.warn?.('Fire Bell local storage unavailable:',error);status();});
    // Always load the shipped owner recording when no browser sample exists.
    // Local storage failure must not disable audio playback.
    loadBundled();
  }
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  root.B737UnifiedFireBellAudioV1=Object.freeze({
    setDemand(source,on){const s=gate.setDemand(source,on);sync();return s;},
    setMuted(source,on){const s=gate.setMuted(source,on);sync();return s;},
    unlock,useFile,
    getState(){return {...gate.snapshot(),bankReady,assetReady,armed,loadError,playing:Boolean(player?.playing)};}
  });
})(typeof window==='object'?window:null);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./fire-hardware-unified.js?v=ATA26-0003-PERF-0001 */
try{
/* P8-1 hardware registered to the same fitted photo plane as all 11 lenses. */
(function(win){
'use strict';
const doc=win.document;
function createHardware(owner,openLab){
const controls=new Map(),handles=new Map(),held=new Map();
const handleRoot='../assets/locked/2026-10-23/Switches/Fire_Handles/';
const handleBounds={ENG1:[210,138,604,1274],APU:[254,117,517,1300],ENG2:[191,140,643,1278]};
let layer,feedback,lastState=null,visualTest=false,manualRelease=false,releaseButton;
function armRelease(armed){
 manualRelease=armed;
 releaseButton?.setAttribute('aria-pressed',String(armed));
}
function rect(el,x,y,w,h){
 Object.assign(el.style,{left:x/2172*100+'%',top:y/724*100+'%',width:w/2172*100+'%',height:h/724*100+'%'});
}
function button(label,cls){
 const el=doc.createElement('button');el.type='button';el.className=cls;
 el.title=label;el.setAttribute('aria-label',label);el.draggable=false;return el;
}
function command(cmd){
 const result=owner().dispatch(cmd);
 if(feedback&&!result.result.accepted)feedback.textContent=result.result.reason.replaceAll('_',' ');
 return result;
}
function touch(el,down,move,up){
 let id=null;
 el.addEventListener('pointerdown',e=>{
  if(e.button!==0||id!==null)return;
  e.preventDefault();e.stopPropagation();id=e.pointerId;el.setPointerCapture(id);down(e);
 });
 el.addEventListener('pointermove',e=>{if(e.pointerId===id&&move){e.preventDefault();e.stopPropagation();move(e);}});
 function release(e){if(e.pointerId!==id)return;id=null;up?.(e);}
 for(const name of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(name,release);
 el.addEventListener('click',e=>e.stopPropagation());
}
function switchAt(id,x,y,values,axis){
 const selector=id.startsWith('ENG'),isExt=id==='EXT',eventType=isExt?'EXT_TEST':'TEST';
 const label=selector?id+' OVHT DET':isExt?'EXT TEST':'Fire and overheat TEST';
 const sprite=doc.createElement('span');sprite.className='fire-toggle-silver';rect(sprite,x-85,y-85,170,170);
 layer.append(sprite);controls.set(id,{sprite,values,axis});
 function select(k){
  if(selector)command({type:'SELECT_LOOP',unit:id,value:values[k]});
  else if(k===1){held.delete(id);command({type:eventType,value:null});}
  else{held.set(id,eventType);command({type:eventType,value:values[k]});}
 }
 const center=button(label,'fire-touch');rect(center,x-42,y-39,84,78);layer.append(center);
 const indexFor=e=>{
  const r=center.getBoundingClientRect(),horizontal=axis==='x';
  const t=horizontal?(e.clientX-r.left)/r.width:(e.clientY-r.top)/r.height;
  return t<.36?0:t>.64?2:1;
 };
 touch(center,e=>select(indexFor(e)),e=>{const k=indexFor(e);if(values[k]!==currentValue())select(k);},
  ()=>{if(!selector)select(1);});
 function currentValue(){return selector?lastState?.selectors[id]:isExt?lastState?.extTest:lastState?.test;}
 center.onkeydown=e=>{
  const k={ArrowLeft:0,ArrowUp:0,Home:1,ArrowRight:2,ArrowDown:2}[e.key];
  if(k!==undefined){e.preventDefault();e.stopPropagation();if(!e.repeat)select(k);}
 };
 center.onkeyup=e=>{if(!selector&&e.key.startsWith('Arrow')){e.preventDefault();select(1);}};
 center.onblur=()=>{if(!selector&&held.has(id))select(1);};
 const zones=selector?[[x-98,y-34,52,68],[x-60,y+43,120,42],[x+45,y-34,55,68]]:
  isExt?[[x-112,y-62,65,60],null,[x-112,y+3,65,60]]:[[x-127,y-72,74,140],null,[x+55,y-72,78,140]];
 values.forEach((v,k)=>{
  if(!zones[k])return;
  const el=button(label+' '+v.replaceAll('_',' / '),'fire-touch fire-label-touch');rect(el,...zones[k]);layer.append(el);
  if(selector){el.addEventListener('pointerdown',e=>e.stopPropagation());el.onclick=e=>{e.stopPropagation();select(k);};}
  else{
   touch(el,()=>select(k),null,()=>select(1));
   el.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();if(!e.repeat)select(k);}};
   el.onkeyup=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();select(1);}};
   el.onblur=()=>{if(held.has(id))select(1);};
  }
 });
}
function handleAt(unit,x){
 const h=button(unit+' fire handle · pull / push, hold left or right to discharge','fire-handle-control');
 rect(h,x-92,143,184,428);h.dataset.unit=unit;
 const img=new Image();img.alt='';img.draggable=false;img.loading='eager';
 const source=handleRoot+'FIRE_HANDEL_'+unit+'_OFF.webp';
 if(win.B737ImageLoader)win.B737ImageLoader.assign(img,source);else img.src=source;
 const [cropX,cropY,w,height]=handleBounds[unit];
 Object.assign(img.style,{left:-cropX/w*100+'%',top:-cropY/height*100+'%',width:1024/w*100+'%',height:1536/height*100+'%'});
 h.append(img);layer.append(h);
 const handle=()=>owner().getState().handles[unit];
 const turn=angle=>command({type:'ROTATE',unit,angle});
 function pull(out){
  const released=out&&manualRelease;
  if(released){armRelease(false);command({type:'OVERRIDE',unit,enabled:true});}
  try{return command({type:'PULL',unit,pulled:out});}
  finally{if(released)command({type:'OVERRIDE',unit,enabled:false});}
 }
 let gesture=null;
 touch(h,e=>{
  const bounds=h.getBoundingClientRect();
  gesture={x:e.clientX,y:e.clientY,action:null,width:bounds.width,height:bounds.height,
   allowTurn:handle().pulled&&e.clientY<bounds.top+bounds.height/2};
 },e=>{
  if(!gesture)return;
  const dx=(e.clientX-gesture.x)/gesture.width,dy=(e.clientY-gesture.y)/gesture.height;
  if(gesture.allowTurn&&Math.abs(dx)>.23&&Math.abs(dx)>Math.abs(dy)){
   const angle=dx<0?-45:45;
   if(gesture.action!==angle){gesture.action=angle;turn(angle);}
  }else if(typeof gesture.action==='number'&&Math.abs(dx)<.12){
   gesture.action='center';turn(0);
  }else if(!gesture.action&&(Math.abs(dx)>.18||Math.abs(dy)>.18))gesture.action='drag';
 },e=>{
  if(!gesture)return;
  const tap=gesture.action===null&&e.type==='pointerup';gesture=null;
  if(handle().angle)turn(0);else if(tap)pull(!handle().pulled);
 });
 h.onclick=e=>{e.stopPropagation();if(e.detail===0)pull(!handle().pulled);};
 h.onkeydown=e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;
  e.preventDefault();e.stopPropagation();if(e.repeat)return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight')turn(e.key==='ArrowLeft'?-45:45);
  else if(e.key==='Home')turn(0);else pull(e.key==='ArrowUp');
 };
 h.onkeyup=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();turn(0);}};
 h.onblur=()=>{if(handle().angle)turn(0);};
 handles.set(unit,h);
}
function release(){
 armRelease(false);
 for(const [id,type] of held){held.delete(id);command({type,value:null});}
 if(!owner())return;
 for(const [id,h] of Object.entries(owner().getState().handles)){
  if(h.angle)command({type:'ROTATE',unit:id,angle:0});
  if(h.override)command({type:'OVERRIDE',unit:id,enabled:false});
 }
}
function paint(state,derived,allOn=false){
 if(!state||!derived)return;lastState=state;visualTest=allOn;
 for(const [id,c] of controls){
  const v=state.selectors[id]??(id==='EXT'?(state.extTest||state.test):state.test);
  const k=c.values.indexOf(v),pose=k===0?(c.axis==='x'?0:3):k===2?(c.axis==='x'?2:4):1;
  c.sprite.style.backgroundPositionX=pose*25+'%';c.sprite.dataset.detent=c.values[k]||'CENTER';
 }
 for(const [id,h] of handles){
  const st=state.handles[id],lit=allOn||derived.activeFire[id];
  h.style.transform='rotate('+st.angle+'deg)';
  h.dataset.pulled=String(st.pulled);h.dataset.angle=String(st.angle);h.dataset.lit=String(lit);
  h.setAttribute('aria-pressed',String(st.pulled));
 }
}
// Both P8 main panel and isolated lab request the same owner-approved bell voice.
// Synthesized two-tone oscillator is permanently retired.
const soundLane=openLab?'aircraft':'lab';
let bellWanted=false,bellMuted=false;
function playBell(){
  return win.B737UnifiedFireBellAudioV1?.unlock?.();
}
function bell(active){
  bellWanted=Boolean(active);
  win.B737UnifiedFireBellAudioV1?.setDemand?.(soundLane,bellWanted&&!bellMuted);
}
function mount(host){
 if(layer||!owner()||!host)return;
 layer=doc.createElement('div');layer.className='fire-hardware-layer';host.append(layer);
 if(openLab){
 const labTarget=button('Fire Protection Test Lab · triple click','fire-lab-target');
 labTarget.onclick=e=>{
  e.stopPropagation();
  if(e.detail===0||e.detail>=3)openLab();
 };
 layer.append(labTarget);
 }
 const patch=new Image();patch.className='fire-surface-patch';patch.src='./assets/pedestal-hardware/fire-blanking.webp';patch.alt='';patch.draggable=false;rect(patch,1205,424,299,186);layer.append(patch);
 switchAt('ENG1',305,222,['A','NORMAL','B'],'x');switchAt('ENG2',1359,222,['A','NORMAL','B'],'x');
 switchAt('TEST',305,519,['FAULT_INOP','CENTER','OVHT_FIRE'],'x');switchAt('EXT',2047,486,['EXT_1','CENTER','EXT_2'],'x');
 handleAt('ENG1',544);handleAt('APU',1090);handleAt('ENG2',1614);
 const bell=button('Fire warning bell cutout','fire-bell-cutout');bell.textContent='BELL CUTOUT';rect(bell,1001,71,178,29);
 bell.onpointerdown=e=>e.stopPropagation();bell.onclick=e=>{e.stopPropagation();command({type:'BELL_CUTOUT'});};layer.append(bell);
 releaseButton=button('Fire handle manual lock release · arm next pull','fire-override');
 rect(releaseButton,1314,476,64,64);armRelease(false);
 releaseButton.onpointerdown=e=>e.stopPropagation();
 releaseButton.onclick=e=>{e.stopPropagation();armRelease(!manualRelease);};
 layer.append(releaseButton);
 feedback=doc.createElement('span');feedback.className='fire-sr-status';feedback.setAttribute('role','status');layer.append(feedback);
 paint(owner().getState(),owner().evaluate(),visualTest);
}
return {mount,release,paint(state,derived,allOn){
 paint(state,derived,allOn);bell(derived.indications.FIRE_BELL);
},stopBell:()=>bell(false),muteBell:muted=>{bellMuted=muted;bell(bellWanted);},playBell};
}
win.B737FirePanelHardware=Object.freeze({create:createHardware});
const owner=()=>win.B737UnifiedFireLights;
const primary=createHardware(owner,()=>win.B737UnifiedFireLab?.open());
function mount(){
 primary.mount(doc.querySelector('#region-pedestal [data-piece="fire-protection"] .fire-lamps-mounted'));
}
doc.addEventListener('pointerdown',primary.playBell,{passive:true});
win.addEventListener('b737:ata26-panel-state',e=>primary.paint(e.detail.state,e.detail.derived,e.detail.visualTest));
win.addEventListener('b737:fire-lab-visibility',e=>primary.muteBell(e.detail));
win.addEventListener('b737:unified-fire-lamps-mounted',mount);
win.addEventListener('b737:cockpit-mounted',mount);
win.addEventListener('blur',primary.release);
doc.addEventListener('visibilitychange',()=>{if(doc.hidden)primary.release();});
win.addEventListener('b737:sixpack-fire-acknowledge',()=>owner()?.dispatch({type:'BELL_CUTOUT'}));
queueMicrotask(mount);
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../fire-protection-lab/thermal-trainer.js?v=P8-THERMAL-0001 */
try{
/* Independent, deterministic P8 equipment and compartment simulation. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.B737FireThermalTrainer=api;
})(globalThis,()=>{
'use strict';
// Bounded instructor training points. The selected Classic detector
// installation and its measured setpoints are not specified by the FCOM.
const thresholds=Object.freeze({overheat:180,fire:260,releaseMargin:10});
const cbNames=Object.freeze({
 'engine1.fireDetector':'P6-2 A24 · Engine 1 Fire Detection',
 'engine2.fireDetector':'P6-2 A22 · Engine 2 Fire Detection',
 'apu.fireDetector':'P6-2 A23 · APU Fire Detection',
 'fire.wheelWellDetector':'P6-2 B24 · Wheel-Well Detection',
 'warning.masterFireControl':'P6-2 B23 · Master Fire',
 'warning.aural':'P6-2 D22 · Aural Warning',
 'fire.extinguisherL':'P6-2 C24 · Left Bottle',
 'fire.extinguisherLAlternate':'P6-2 D24 · Left Bottle Alternate',
 'fire.extinguisherR':'P6-2 C22 · Right Bottle',
 'fire.extinguisherRAlternate':'P6-2 D23 · Right Bottle Alternate',
 'fire.extinguisherAPU':'P6-2 C23 · APU Bottle'
});
const initial={ENG1:{temperature:100,n1:85,n2:94,egt:560,oil:91},ENG2:{temperature:100,n1:85,n2:94,egt:560,oil:91},
 APU:{temperature:90,n1:100,n2:null,egt:410,oil:null}};
const toward=(value,target,rate,time)=>value+Math.sign(target-value)*Math.min(Math.abs(target-value),rate*time);
function level(celsius,prior){
 if(celsius>=thresholds.fire||prior==='FIRE'&&celsius>=thresholds.fire-thresholds.releaseMargin)return 'FIRE';
 if(celsius>=thresholds.overheat||prior!=='NORMAL'&&celsius>=thresholds.overheat-thresholds.releaseMargin)return 'OVHT';
 return 'NORMAL';
}
function create(Fire){
 const opened=new Set();
 const fire=Fire.createEngine(undefined,{available:key=>!opened.has(key)});
 let equipment,clearCaution=false,falseCue=null,falseAcknowledged=false;
 function reset(){
  opened.clear();fire.dispatch({type:'RESET'});clearCaution=false;falseCue=null;falseAcknowledged=false;
  equipment=Object.fromEntries(Object.entries(initial).map(([id,start])=>[id,{...start,target:start.temperature,stage:'NORMAL',stopped:false}]));
 }
 reset();
 function setTemperature(id,celsius){
  if(!Object.hasOwn(equipment,id)||!Number.isFinite(celsius)||celsius<20||celsius>650)return false;
  equipment[id].target=celsius;return true;
 }
 function faultCue(cue){
  if(![null,'HANDLE','OVERHEAT','BELL'].includes(cue))throw RangeError('Unknown warning cue');
  falseCue=cue;falseAcknowledged=false;
 }
 function setBreaker(key,closed){
  if(!Object.hasOwn(cbNames,key))throw RangeError('Unknown breaker');
  if(closed)opened.delete(key);else opened.add(key);
 }
 function evaluate(){
  const d=fire.evaluate();
  if(!falseCue)return d;
  const indications={...d.indications},activeFire={...d.activeFire};
  if(falseCue==='HANDLE')activeFire.ENG1=indications.ENG1_FIRE=fire.getState().power.batteryBus&&!opened.has('engine1.fireDetector');
  if(falseCue==='OVERHEAT'&&fire.getState().power.batteryBus&&!opened.has('engine1.fireDetector')){
   indications.ENG1_OVERHEAT=indications.OVHT_DET=indications.MASTER_CAUTION=true;
  }
  if(falseCue==='BELL'&&fire.getState().power.batteryBus&&!opened.has('warning.aural')&&!falseAcknowledged)indications.FIRE_BELL=true;
  return {...d,indications,activeFire};
 }
 function dispatch(command){
  const result=fire.dispatch(command);
  if(command.type==='BELL_CUTOUT')falseAcknowledged=true;
  return result;
 }
 function tick(seconds){
  const before=fire.getState();
  if(Object.values(before.pending).some(value=>value!==null)||Object.values(before.handles).some(h=>h.pulled&&h.angle))
   dispatch({type:'TICK',seconds});
  const state=fire.getState(),outputs=fire.evaluate().outputs;
  for(const [id,unit] of Object.entries(equipment)){
   const start=initial[id],isolated=outputs[id].fuelShutoff;
   if(isolated)unit.stopped=true;
   if(Object.keys(state.bottles).some(b=>state.bottles[b]&&!before.bottles[b]&&state.dischargedTo[b]===id))unit.target=start.temperature;
   unit.temperature=toward(unit.temperature,unit.target,unit.target>unit.temperature?36:47,seconds);
   const next=level(unit.temperature,unit.stage);
   if(next!==unit.stage){
    unit.stage=next;
    if(id!=='APU')dispatch({type:'SET_OVERHEAT',unit:id,active:next!=='NORMAL'});
    dispatch({type:'SET_FIRE',unit:id,active:next==='FIRE'});
   }
   const heat=Math.max(0,unit.temperature-start.temperature);
   const targetEGT=unit.stopped?Math.min(40+heat*.8,start.egt):start.egt+heat*.92;
   unit.egt=toward(unit.egt,targetEGT,unit.stopped?68:44,seconds);
   unit.n1=toward(unit.n1,unit.stopped?0:start.n1,unit.stopped?13:2,seconds);
   if(unit.n2!==null)unit.n2=toward(unit.n2,unit.stopped?0:start.n2,unit.stopped?11:2,seconds);
   if(unit.oil!==null)unit.oil=toward(unit.oil,unit.stopped?35:start.oil+heat*.08,2,seconds);
  }
  if(!evaluate().indications.MASTER_CAUTION)clearCaution=false;
 }
 function snapshot(){
  const derived=evaluate(),state=fire.getState();
  const indications=derived.indications;
  const cues=[indications.ENG1_FIRE,indications.ENG1_OVERHEAT,indications.FIRE_BELL];
  return {state,derived,equipment:Object.fromEntries(Object.entries(equipment).map(([id,row])=>[id,{...row}])),
   falseCue,cues,masterCaution:indications.MASTER_CAUTION&&!clearCaution};
 }
 return {dispatch,evaluate,getState:fire.getState,reset,tick,setTemperature,faultCue,setBreaker,snapshot,
  acknowledgeCaution:()=>{clearCaution=true;},recall:()=>{clearCaution=false;}};
}
return Object.freeze({thresholds,cbNames,create});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./fire-lab-unified.js?v=P8-TEST-0002 */
try{
/* Local P8 training aircraft. Unified supplies the artwork and controls only. */
(function(win){
'use strict';
const doc=win.document, model=win.B737FireThermalTrainer;
const scenarios={
 ENG1_FIRE:['Engine 1 compartment fire','Local heat rises through OVHT and FIRE. Compare the red handle, amber OVERHEAT lens and bell.',t=>t.setTemperature('ENG1',335)],
 ENG2_OVHT:['Engine 2 compartment overheat','Local heat crosses the OVHT threshold. It stays below the FIRE threshold.',t=>t.setTemperature('ENG2',225)],
 APU_FIRE:['APU compartment fire','At the FIRE threshold, the APU trips and its EGT and RPM decay.',t=>t.setTemperature('APU',328)],
 FALSE_HANDLE:['False fire handle light','A spurious handle light appears with normal compartment temperature and no corroborating OVERHEAT or bell.',t=>t.faultCue('HANDLE')],
 FALSE_OVHT:['False OVERHEAT light','An isolated indication fault illuminates ENG 1 OVERHEAT. The compartment remains normal.',t=>t.faultCue('OVERHEAT')],
 FALSE_BELL:['False fire bell','The aural fault sounds the bell with both engine handle and overheat lenses dark.',t=>t.faultCue('BELL')],
 WHEEL:['Main wheel-well fire','Open AC TRANSFER BUS 1 or the wheel-well breaker to interrupt the detector.',t=>t.dispatch({type:'SET_WHEEL_FIRE',active:true})],
 ENG1_LOOP:['Engine 1 loop A open','Select A and hold OVHT/FIRE to check the failed path. NORMAL can still use loop B.',t=>t.dispatch({type:'SET_LOOP',unit:'ENG1',loop:'A',healthy:false})],
 APU_DET:['APU detector inoperative','Check the APU DET INOP lens, OVHT/DET and both MASTER CAUTION lights.',t=>t.dispatch({type:'SET_APU_DETECTOR',healthy:false})],
 BOTTLE:['Left bottle squib 1 open','Compare all three green lenses in EXT TEST 1 and EXT TEST 2.',t=>t.dispatch({type:'SET_CIRCUIT',bottle:'L',channel:1,healthy:false})]
};
const buses={batteryBus:'BATTERY BUS · 28V DC',hotBatteryBus:'HOT BATTERY BUS · 28V DC',acTransfer1:'AC TRANSFER BUS 1 · 115V AC'};
const equipmentNames={ENG1:'ENG 1',ENG2:'ENG 2',APU:'APU'};
const columns=['Equipment','Phase','N1 / RPM','N2','EGT','Compartment temp','Detector stage','Oil temp','Fuel valve','Bleed valve','Hydraulic shutoff','Generator'];
let dialog,trainer,hardware,timer,recallHeld=false;
const lenses=new Map();
const by=id=>dialog.querySelector('#'+id);
const degrees=v=>Number.isFinite(v)?v.toFixed(1)+' °C':'—';
const percent=v=>Number.isFinite(v)?v.toFixed(1)+'%':'—';
function paint(){
 if(!dialog?.open)return;
 const {state,derived,equipment,masterCaution}=trainer.snapshot();
 const lamps=derived.indications;
 for(const [id,node] of lenses)node.dataset.illuminated=String(!!(lamps[id]||derived.testLamps[id]));
 hardware.paint(state,derived);
 for(const node of dialog.querySelectorAll('[data-caution]')){
  const code=node.dataset.caution.split('.')[1];
  const lit=code==='MASTER CAUTION'?masterCaution:code==='FIRE WARN'?lamps.MASTER_FIRE_WARN:
   recallHeld||code==='OVHT/DET'&&masterCaution&&lamps.OVHT_DET;
  node.dataset.on=node.dataset.lit=String(lit);
  if(node.tagName==='BUTTON')node.setAttribute('aria-pressed',String(lit));
 }
 for(const input of by('p8-lab-power').querySelectorAll('input'))input.checked=!!state.power[input.value];
 by('p8-lab-bottles').textContent=Object.entries(state.bottles).map(([id,empty])=>id+' '+(empty?'DISCHARGED':state.pending[id]!==null?'DISCHARGING':state.pressureLow[id]?'PRESSURE LOW':'READY')).join('  ·  ');
 for(const [id,unit] of Object.entries(equipment)){
  const command=derived.outputs[id],running=!unit.stopped;
  const values=[running?'RUNNING':unit.n1>0?'SPOOLING DOWN':'STOPPED',percent(unit.n1),percent(unit.n2),degrees(unit.egt),
   degrees(unit.temperature),unit.stage,degrees(unit.oil),running?'OPEN':'CLOSED',running&&!command.bleedShutoff?'OPEN':'CLOSED',
   id==='APU'?'—':command.hydraulicShutoff?'CLOSED':'OPEN',command.generatorTrip?'TRIPPED':!running?'OFF':id==='APU'?'AVAILABLE':'ON BUS'];
  dialog.querySelectorAll('[data-readout="'+id+'"]').forEach((cell,i)=>{cell.textContent=values[i];});
 }
 for(const id of ['ENG1','ENG2']){
  const cues=[lamps[id+'_FIRE'],lamps[id+'_OVERHEAT'],lamps.FIRE_BELL];
  const names=['FIRE HANDLE','OVERHEAT','BELL'];
  by('p8-lab-cues-'+id).textContent=equipmentNames[id]+' · '+cues.map((cue,i)=>names[i]+' '+(cue?'ON':'OFF')).join('  /  ');
 }
}
function mountPanel(original){
 const panel=doc.createElement('div');panel.className='p8-lab-docked';
 const base=new Image();base.src='./assets/fire-v6/FIRE_PANEL_BARE.webp';base.alt=original.getAttribute('aria-label')||'Fire protection panel';panel.append(base);
 const layer=doc.createElement('div');layer.className='fire-lamps-mounted';panel.append(layer);by('p8-lab-board').append(panel);
 const geometry=win.B737UnifiedFireLampModel;
 for(const slot of geometry.SLOTS){
  const node=doc.createElement('span');node.className='fire-lamp';
  node.dataset.fireLamp=slot.id;node.dataset.kind=slot.type;node.dataset.color=slot.color;
  Object.assign(node.style,geometry.percent(slot));
  for(const text of slot.lines){const line=doc.createElement('span');line.textContent=text;node.append(line);}
  layer.append(node);lenses.set(slot.id,node);
 }
 hardware=win.B737FirePanelHardware.create(()=>({
  ...trainer,dispatch(command){const result=trainer.dispatch(command);paint();return result;}
 }));
 hardware.mount(layer);
}
function mountAnnunciators(){
 const grid=by('p8-lab-cautions');
 for(const side of ['CAPT','FO']){
  const cockpit=doc.querySelector('#region-main [data-sixpack-seat="'+side+'"]');
  if(!cockpit)continue;
  const panel=cockpit.cloneNode(true);
  for(const node of panel.querySelectorAll('[data-sixpack]')){
   node.dataset.caution=node.dataset.sixpack;
   delete node.dataset.sixpack;
   const code=node.dataset.caution.split('.')[1];
   if(code==='MASTER CAUTION')node.onclick=()=>{trainer.acknowledgeCaution();paint();};
   if(code==='FIRE WARN')node.onclick=()=>{trainer.dispatch({type:'BELL_CUTOUT'});paint();};
  }
  const rack=panel.querySelector('.b737-sp-rack');
  const press=()=>{recallHeld=true;paint();};
  const release=()=>{recallHeld=false;trainer.recall();paint();};
  rack.onpointerdown=e=>{if(e.button===0){rack.setPointerCapture(e.pointerId);press();}};
  rack.onpointerup=rack.onpointercancel=rack.onlostpointercapture=release;
  rack.onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();press();}};
  rack.onkeyup=e=>{if(e.key===' '||e.key==='Enter')release();};
  rack.onblur=()=>{if(recallHeld)release();};
  grid.append(panel);
 }
}
function build(original){
 dialog=doc.createElement('dialog');dialog.id='unifiedFireLab';dialog.className='p8-lab';dialog.setAttribute('aria-labelledby','p8-lab-title');
 dialog.innerHTML=`<header><h2 id="p8-lab-title">Fire Protection Test Lab</h2><button type="button" id="p8-lab-close">Close</button></header>
 <div id="p8-lab-board"></div>
 <section aria-label="Master caution and fire warning" id="p8-lab-cautions"></section>
 <section class="p8-lab-scenario"><label>Scenario <select id="p8-lab-scenario"></select></label>
 <button type="button" id="p8-lab-apply">Apply Scenario</button><button type="button" id="p8-lab-clear">Reset Lab</button>
 <p id="p8-lab-reason"></p><output id="p8-lab-result" role="status"></output></section>
 <form id="p8-lab-temperature"><label>Compartment <select name="unit"><option value="ENG1">ENG 1</option><option value="ENG2">ENG 2</option><option value="APU">APU</option></select></label>
 <label>Target °C <input name="temperature" type="number" min="20" max="650" value="100" required></label>
 <button type="submit">Set Temperature</button>
 <small>Training thresholds · OVHT ${model.thresholds.overheat} °C · FIRE ${model.thresholds.fire} °C</small></form>
 <fieldset id="p8-lab-power"><legend>Lab Power</legend>${Object.entries(buses).map(([id,label])=>'<label><input type="checkbox" value="'+id+'"> '+label+'</label>').join('')}</fieldset>
 <details><summary>Circuit Breakers</summary><fieldset id="p8-lab-breakers" aria-label="Closed circuit breakers">${Object.entries(model.cbNames).map(([id,label])=>'<label><input type="checkbox" value="'+id+'" checked> '+label+'</label>').join('')}</fieldset></details>
 <section aria-label="Aircraft readings">
 <p id="p8-lab-bottles"></p><div id="p8-lab-cues-ENG1"></div><div id="p8-lab-cues-ENG2"></div>
 <div class="p8-lab-table"><table><caption>Independent training equipment</caption><thead><tr>${columns.map(label=>'<th scope="col">'+label+'</th>').join('')}</tr></thead>
 <tbody>${Object.entries(equipmentNames).map(([id,label])=>'<tr><th scope="row">'+label+'</th>'+('<td data-readout="'+id+'">—</td>').repeat(columns.length-1)+'</tr>').join('')}</tbody></table></div></section>`;
 doc.body.append(dialog);mountPanel(original);mountAnnunciators();
 for(const [key,[label]] of Object.entries(scenarios))by('p8-lab-scenario').append(new Option(label,key));
 function showReason(){by('p8-lab-reason').textContent=scenarios[by('p8-lab-scenario').value][1];}
 function reset(){
  trainer.reset();recallHeld=false;
  for(const input of by('p8-lab-breakers').querySelectorAll('input'))input.checked=true;
  hardware.release();paint();
 }
 by('p8-lab-scenario').onchange=showReason;showReason();
 by('p8-lab-apply').onclick=()=>{reset();const [label,,apply]=scenarios[by('p8-lab-scenario').value];apply(trainer);by('p8-lab-result').textContent=label+' active';paint();};
 by('p8-lab-clear').onclick=()=>{reset();by('p8-lab-result').textContent='Lab reset';};
 by('p8-lab-close').onclick=()=>dialog.close();
 by('p8-lab-temperature').onsubmit=e=>{
  e.preventDefault();const {unit,temperature}=e.currentTarget.elements;
  trainer.setTemperature(unit.value,Number(temperature.value));paint();
 };
 by('p8-lab-power').onchange=e=>{trainer.dispatch({type:'SET_POWER',bus:e.target.value,active:e.target.checked});paint();};
 by('p8-lab-breakers').onchange=e=>{trainer.setBreaker(e.target.value,e.target.checked);paint();};
 dialog.addEventListener('pointerdown',hardware.playBell,{passive:true});
 dialog.addEventListener('close',()=>{clearInterval(timer);hardware.release();hardware.stopBell();win.dispatchEvent(new CustomEvent('b737:fire-lab-visibility',{detail:false}));});
}
function open(){
 if(dialog?.open||!model||!win.B737FireProtection)return false;
 const original=doc.querySelector('#region-pedestal [data-piece="fire-protection"]');if(!original)return false;
 if(!dialog){trainer=model.create(win.B737FireProtection);build(original);}
 win.dispatchEvent(new CustomEvent('b737:fire-lab-visibility',{detail:true}));
 dialog.showModal();paint();
 let last=performance.now();
 timer=setInterval(()=>{const now=performance.now();trainer.tick(Math.min(.25,(now-last)/1000));last=now;paint();},100);
 return true;
}
win.B737UnifiedFireLab=Object.freeze({open,snapshot:()=>trainer?.snapshot()});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
