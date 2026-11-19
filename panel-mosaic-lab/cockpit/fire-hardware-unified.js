/* P8-1 hardware registered to the same fitted photo plane as all 11 lenses. */
(function(win){
'use strict';
const doc=win.document, owner=()=>win.B737UnifiedFireLights;
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
 img.src=handleRoot+'FIRE_HANDEL_'+unit+'_OFF.webp';
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
// The public training bell uses the two tones from the existing audio lab.
let audio=null,volume=null,bellTimer=0,bellWanted=false;
function playBell(){
 if(!bellWanted||bellTimer||win.navigator.userActivation?.hasBeenActive===false)return;
 const Engine=win.AudioContext||win.webkitAudioContext;if(!Engine)return;
 audio=audio||new Engine();if(audio.state!=='running')audio.resume().catch(()=>{});
 volume=audio.createGain();volume.gain.value=.16;volume.connect(audio.destination);
 function strike(){
  const t=audio.currentTime;
  for(const [hz,end,type] of [[950,800,'sine'],[1550,1300,'triangle']]){
   const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;
   osc.frequency.setValueAtTime(hz,t);osc.frequency.exponentialRampToValueAtTime(end,t+.4);
   gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(.45,t+.009);
   gain.gain.exponentialRampToValueAtTime(.001,t+.45);
   osc.connect(gain);gain.connect(volume);osc.start(t);osc.stop(t+.47);
   osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
 }
 strike();bellTimer=setInterval(strike,600);
}
function bell(active){
 bellWanted=active;
 if(active){playBell();return;}
 if(bellTimer){clearInterval(bellTimer);bellTimer=0;volume.disconnect();}
}
doc.addEventListener('pointerdown',playBell,{passive:true});
win.addEventListener('b737:ata26-panel-state',e=>bell(e.detail.derived.indications.FIRE_BELL));
function mount(){
 if(layer||!owner())return;
 const host=doc.querySelector('[data-piece="fire-protection"] .fire-lamps-mounted');if(!host)return;
 layer=doc.createElement('div');layer.className='fire-hardware-layer';host.append(layer);
 const labTarget=button('Fire Protection Test Lab · triple click','fire-lab-target');
 labTarget.onclick=e=>{
  e.stopPropagation();
  if(e.detail===0||e.detail>=3)win.B737UnifiedFireLab?.open();
 };
 layer.append(labTarget);
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
win.addEventListener('b737:ata26-panel-state',e=>paint(e.detail.state,e.detail.derived,e.detail.visualTest));
win.addEventListener('b737:unified-fire-lamps-mounted',mount);win.addEventListener('b737:cockpit-mounted',mount);
win.addEventListener('blur',release);doc.addEventListener('visibilitychange',()=>{if(doc.hidden)release();});
win.addEventListener('b737:sixpack-fire-acknowledge',()=>command({type:'BELL_CUTOUT'}));
queueMicrotask(mount);
})(window);
