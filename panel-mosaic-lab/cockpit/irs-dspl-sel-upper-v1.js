/* IRS UPPER DSPL SEL / INNER BRT, visual frontend v1.
 * Exactly five clockwise modes specified by owner:
 * TEST, TK/GS, PPOS, WIND, HDG/STS.
 * Outer selector and smaller coaxial brightness knob are independent.
 * SOURCE OH01-06: fixed bore centroid (471.48,368.69) on 1731x909 image.
 * Lower SYS DSPL L/R is OWNER LOCKED; this module does NOT reference, touch,
 * resize, re-center, re-label, or replace any of its approved assets/elements.
 * Frontend only: no fictitious power/IRS attitude/nav backend operations.
 */
(function(root){
 'use strict';
 const MODES=Object.freeze(['TEST','TK/GS','PPOS','WIND','HDG/STS']);
 // Angles are degrees clockwise from the 12-o'clock pointing direction.
 // Five white stops are explicitly registered to the upper switch arc.
 const DETENTS=Object.freeze([-79,-46,-10,27,61]);
 const SOURCE=Object.freeze({x:471.48,y:368.69,w:1731,h:909});
 const ATLAS=Object.freeze({x:3,y:3,w:2214,h:1019});
 const SIZE=Object.freeze({width:88,height:88});
 const CENTER=Object.freeze({x:ATLAS.x+SOURCE.x*ATLAS.w/SOURCE.w,y:ATLAS.y+SOURCE.y*ATLAS.h/SOURCE.h});
 const POSITION=Object.freeze({left:CENTER.x-SIZE.width/2,top:CENTER.y-SIZE.height/2});
 const GEOMETRY=Object.freeze({
  schema:'irs.upper-dual-concentric.frontend.v1',
  upperSourceCenter:SOURCE,canvasCenter:CENTER,position:POSITION,size:SIZE,
  detentAngles:DETENTS,modes:MODES,
  outerVisual:'irs-upper-outer-photo-v2.avif',
  innerVisual:'irs-upper-inner-photo-v2.avif',
  lockedLowerSelectorPreserved:true
 });
 let mount=null,mode='PPOS',brightness=78,tracking=null,suppressClick=false;
 function clamp(value){return Math.max(0,Math.min(100,Math.round(value)));}
 function publish(type,source){
  root.dispatchEvent(new CustomEvent('b737:irs-upper-visual-change',{
   detail:{type,mode,brightness,frontendOnly:true,source}
  }));
 }
 function refresh(){
  if(!mount)return;
  const outer=mount.querySelector('.irs-upper-outer');
  const brightnessButton=mount.querySelector('.irs-upper-brt');
  const angle=DETENTS[MODES.indexOf(mode)];
  mount.dataset.mode=mode;
  mount.dataset.brightness=String(brightness);
  if(outer){
   outer.setAttribute('aria-label','IRS display selector '+mode);
   outer.setAttribute('aria-valuenow',String(MODES.indexOf(mode)));
   outer.setAttribute('aria-valuetext',mode);
   outer.setAttribute('title','DSPL SEL · '+mode);
   outer.style.setProperty('--outer-rotation',angle+'deg');
  }
  if(brightnessButton){
   brightnessButton.setAttribute('aria-valuenow',String(brightness));
   brightnessButton.setAttribute('aria-valuetext',brightness+'%');
   brightnessButton.setAttribute('title','IRS BRT · '+brightness+'%');
   brightnessButton.style.setProperty('--inner-rotation',(-122+2.44*brightness)+'deg');
  }
  const region=document.getElementById('region-overhead');
  if(region)region.style.setProperty('--irs-brt-level',String(brightness/100));
  // Existing ISDU mock display is a frontend-only preview. Do not generate
  // fictitious numeric aircraft data here.
  const demo=document.querySelector('#irsIsduDialog .irs-isdu-unit');
  if(demo)demo.style.setProperty('--isdu-brightness',String(Math.max(.08,brightness/100)));
  const demoSlider=document.querySelector('#irsIsduDialog .irs-isdu-brightness');
  if(demoSlider)demoSlider.value=String(Math.max(10,brightness));
 }
 function setMode(value,source='ui'){
  if(!MODES.includes(value))throw new RangeError('Invalid IRS DSPL SEL mode: '+value);
  const changed=value!==mode;
  mode=value;refresh();
  if(changed)publish('mode',source);
  return mode;
 }
 function setBrightness(value,source='ui'){
  if(!Number.isFinite(value))throw new TypeError('Invalid IRS BRT value');
  const next=clamp(value),changed=next!==brightness;
  brightness=next;refresh();
  if(changed)publish('brightness',source);
  return brightness;
 }
 function stepMode(delta,source){
  setMode(MODES[Math.min(4,Math.max(0,MODES.indexOf(mode)+delta))],source);
 }
 function stop(event){event.preventDefault?.();event.stopPropagation?.();}
 function onOuterDown(event){
  if(event.button!==0&&event.pointerType==='mouse')return;
  tracking={type:'outer',id:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false};
  event.currentTarget.setPointerCapture?.(event.pointerId);event.stopPropagation?.();
 }
 function nearestDetent(angle){
  let best=0;
  for(let i=1;i<DETENTS.length;i++)
   if(Math.abs(DETENTS[i]-angle)<Math.abs(DETENTS[best]-angle))best=i;
  return MODES[best];
 }
 function onOuterMove(event){
  if(!tracking||tracking.type!=='outer'||event.pointerId!==tracking.id)return;
  if(Math.hypot(event.clientX-tracking.startX,event.clientY-tracking.startY)>8)tracking.moved=true;
  if(!tracking.moved)return;
  const bounds=event.currentTarget.getBoundingClientRect();
  const dx=event.clientX-(bounds.left+bounds.width/2);
  const dy=event.clientY-(bounds.top+bounds.height/2);
  const angle=Math.atan2(dx,-dy)*180/Math.PI;
  setMode(nearestDetent(angle),'drag');
  event.stopPropagation?.();
 }
 function onOuterUp(event){
  if(!tracking||tracking.type!=='outer'||event.pointerId!==tracking.id)return;
  if(tracking.moved)suppressClick=true;
  tracking=null;event.stopPropagation?.();
 }
 function onOuterClick(event){
  event.stopPropagation?.();
  if(suppressClick){suppressClick=false;return;}
  setMode(MODES[(MODES.indexOf(mode)+1)%MODES.length],'click');
 }
 function onInnerDown(event){
  if(event.button!==0&&event.pointerType==='mouse')return;
  tracking={type:'inner',id:event.pointerId,startX:event.clientX,startY:event.clientY,startBrightness:brightness,moved:false};
  event.currentTarget.setPointerCapture?.(event.pointerId);event.stopPropagation?.();
 }
 function onInnerMove(event){
  if(!tracking||tracking.type!=='inner'||event.pointerId!==tracking.id)return;
  const dy=tracking.startY-event.clientY;
  if(Math.abs(dy)>4)tracking.moved=true;
  if(tracking.moved)setBrightness(tracking.startBrightness+dy*1.3,'drag-inner');
  event.stopPropagation?.();
 }
 function onInnerUp(event){
  if(!tracking||tracking.type!=='inner'||event.pointerId!==tracking.id)return;
  if(tracking.moved)suppressClick=true;
  tracking=null;event.stopPropagation?.();
 }
 function onInnerClick(event){
  event.stopPropagation?.();
  if(suppressClick){suppressClick=false;return;}
  setBrightness(brightness>=100?0:brightness+10,'click-inner');
 }
 function mountUpper(){
  const region=document.getElementById('region-overhead');
  if(!region)return null;
  let found=region.querySelector('#irsUpperDsplSelMounted');
  if(found){mount=found;refresh();return mount;}
  mount=document.createElement('div');
  mount.id='irsUpperDsplSelMounted';
  mount.className='irs-upper-selector-mount';
  mount.dataset.frontendOnly='true';
  mount.dataset.module='IRS-UPPER-DSPL-SEL-BRT-V2-PHOTO';
  Object.assign(mount.style,{left:POSITION.left+'px',top:POSITION.top+'px',width:SIZE.width+'px',height:SIZE.height+'px'});
  for(const [index,angle] of DETENTS.entries()){
   const tick=document.createElement('span');
   tick.className='irs-upper-mode-tick';
   tick.dataset.mode=MODES[index];
   tick.setAttribute('aria-hidden','true');
   const rad=angle*Math.PI/180;
   const radius=44;
   Object.assign(tick.style,{
    left:(SIZE.width/2+Math.sin(rad)*radius)+'px',
    top:(SIZE.height/2-Math.cos(rad)*radius)+'px',
    transform:'translate(-50%,-50%) rotate('+angle+'deg)'
   });
   mount.append(tick);
  }
  const outer=document.createElement('button');
  outer.type='button';outer.className='irs-upper-outer';outer.setAttribute('role','slider');
  outer.setAttribute('aria-valuemin','0');outer.setAttribute('aria-valuemax','4');
  outer.addEventListener('pointerdown',onOuterDown);
  outer.addEventListener('pointermove',onOuterMove);
  outer.addEventListener('pointerup',onOuterUp);
  outer.addEventListener('pointercancel',onOuterUp);
  outer.addEventListener('click',onOuterClick);
  outer.addEventListener('wheel',e=>{stop(e);stepMode(e.deltaY>0?1:-1,'wheel');},{passive:false});
  outer.addEventListener('keydown',e=>{
   if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(e.key)){
    stop(e);
    if(e.key==='Home')setMode(MODES[0],'keyboard');
    else if(e.key==='End')setMode(MODES[4],'keyboard');
    else stepMode(['ArrowRight','ArrowDown'].includes(e.key)?1:-1,'keyboard');
   }
  });
  const outerImg=document.createElement('img');
  outerImg.src='./assets/irs-upper-outer-photo-v2.avif';outerImg.alt='';outerImg.draggable=false;outerImg.setAttribute('aria-hidden','true');
  outer.append(outerImg);
  const inner=document.createElement('button');
  inner.type='button';inner.className='irs-upper-brt';inner.setAttribute('role','slider');
  inner.setAttribute('aria-label','IRS display and indication brightness');
  inner.setAttribute('aria-valuemin','0');inner.setAttribute('aria-valuemax','100');
  inner.addEventListener('pointerdown',onInnerDown);
  inner.addEventListener('pointermove',onInnerMove);
  inner.addEventListener('pointerup',onInnerUp);
  inner.addEventListener('pointercancel',onInnerUp);
  inner.addEventListener('click',onInnerClick);
  inner.addEventListener('wheel',e=>{stop(e);setBrightness(brightness+(e.deltaY<0?5:-5),'wheel-inner');},{passive:false});
  inner.addEventListener('keydown',e=>{
   if(['ArrowUp','ArrowDown','ArrowRight','ArrowLeft','Home','End'].includes(e.key)){
    stop(e);
    const next=e.key==='Home'?0:e.key==='End'?100:brightness+(['ArrowUp','ArrowRight'].includes(e.key)?5:-5);
    setBrightness(next,'keyboard-inner');
   }
  });
  const innerImg=document.createElement('img');
  innerImg.src='./assets/irs-upper-inner-photo-v2.avif';innerImg.alt='';innerImg.draggable=false;innerImg.setAttribute('aria-hidden','true');
  inner.append(innerImg);
  mount.append(outer,inner);
  region.append(mount);
  refresh();
  return mount;
 }
 function boot(){
  if(!mountUpper()){
   const observer=new MutationObserver(()=>{if(mountUpper())observer.disconnect();});
   observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  root.addEventListener('b737:cockpit-mounted',mountUpper);
 }
 root.B737IRSUpperSelector=Object.freeze({
  mount:mountUpper,setMode,setBrightness,getMode:()=>mode,getBrightness:()=>brightness,
  getElement:()=>mount,geometry:GEOMETRY
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
})(window);
