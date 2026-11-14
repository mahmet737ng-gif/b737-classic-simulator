/* SBK-0005 — owner redline: straight narrow slot; pivot-to-stencil detents; scalable photo-style sprite. */
(function(){
'use strict';
/* Coordinate system: native 800 × 1000 owner-approved throttle photograph.
 * The bent section is an independent overlay, NOT a modification of the photo.
 * Stop markers refer to the existing painted DOWN/ARMED/FLIGHT DETENT/UP legends.
 */
const STOP_Y=Object.freeze({DOWN:262,ARMED:288,FLIGHT_DETENT:478,UP:619});
const STOPS=Object.freeze(Object.entries(STOP_Y).map(([key,y])=>Object.freeze({
 key,y,t:(y-STOP_Y.DOWN)/(STOP_Y.UP-STOP_Y.DOWN)
})));
const HIT_TARGETS=Object.freeze([
 Object.freeze({key:'DOWN',x:211,y:247,w:58,h:27}),
 Object.freeze({key:'ARMED',x:211,y:297,w:58,h:27}),
 Object.freeze({key:'FLIGHT_DETENT',x:220,y:453,w:39,h:40}),
 Object.freeze({key:'UP',x:218,y:619,w:40,h:28})
]);
/* Fixed 13-pixel-width straight groove centered on user's red rectangle x=171.
 * Original photographic groove x=188..201 is masked at runtime, never edited on disk. */
const GROOVE_PATH='M 171 257 L 171 632';
const GUIDE=Object.freeze([{x:171,y:257},{x:171,y:632}].map(p=>Object.freeze(p)));
const ASSET='./assets/speedbrake-lever-hires-v2.svg?v=SBK-0005';
const G={sourceX:171,sourceWidth:124,trackTop:STOP_Y.DOWN,trackBottom:STOP_Y.UP,
 sourceWindowX:0,sourceWindowY:0,sourceWindowWidth:800,sourceWindowHeight:978.1990521327015,
 baseAnchorX:102/120,baseAnchorY:181/207};
let root=null,texture=null,lever=null,groove=null,position=0,ready=false,drag=null;
const buttons=new Map();
const clamp=x=>Math.min(1,Math.max(0,Number.isFinite(x)?x:0));
const nearest=t=>STOPS.reduce((a,b)=>Math.abs(b.t-t)<Math.abs(a.t-t)?b:a,STOPS[0]);
const fromValue=v=>{
 if(typeof v==='string'){
  const key=v.trim().toUpperCase().replace(/[\s/-]+/g,'_');
  const alias={FULL_EXTEND:'UP',FULL:'UP',EXTEND:'FLIGHT_DETENT',MID:'FLIGHT_DETENT',
    HALF:'FLIGHT_DETENT',QUARTER:'ARMED',THREE_QUARTER:'FLIGHT_DETENT'};
  const stop=STOPS.find(s=>s.key===(alias[key]||key));
  if(stop)return stop.t;
 }
 const n=Number(v);return clamp(n>1?n/100:n);
};
function syncArmed(){
 const indication=nearest(position).key==='ARMED';
 const system=window.B737CockpitLights;
 if(!system?.setInputs)return;
 try{
  if(system.getState?.()?.inputs?.speedBrakeArmedIndication!==indication)
   system.setInputs({speedBrakeArmedIndication:indication});
 }catch(err){console.warn('SBK-0005 SPEED BRAKE ARMED indication sync',err);}
}
function emit(source){
 const stop=nearest(position);
 document.dispatchEvent(new CustomEvent('b737:speedbrake-position',{detail:{
  source:source||'PEDESTAL',position,percent:Math.round(position*1000)/10,
  detent:stop.key,armed:stop.key==='ARMED',phase:'VISUAL',ready
 }}));
 syncArmed();
}
function measure(){
 const sx=texture.offsetWidth/G.sourceWindowWidth,sy=texture.offsetHeight/G.sourceWindowHeight;
 const width=G.sourceWidth*sx,height=width*207/120;
 return {sx,sy,width,height};
}
/* The sprite already includes the real angled upper arm. Register its vertical
 * shaft to the photographed black slot, not to the white grip's left edge.
 * The raised, curved branch is visible behind the upper part of the lever. */
function render(){
 if(!lever||!texture)return;
 const m=measure();
 const y=G.trackTop+(G.trackBottom-G.trackTop)*position;
 // Register the steel pivot/base to the actual printed detent, never the grip.
 const top=texture.offsetTop+(y-G.sourceWindowY)*m.sy-G.baseAnchorY*m.height;
 const left=texture.offsetLeft+(G.sourceX-G.sourceWindowX)*m.sx-G.baseAnchorX*m.width;
 lever.style.left=left.toFixed(2)+'px';
 lever.style.top=top.toFixed(2)+'px';
 lever.style.width=m.width.toFixed(2)+'px';
 lever.style.height=m.height.toFixed(2)+'px';
 const panelSlotEnd=texture.offsetTop+(642-G.sourceWindowY)*m.sy;
 const lastVisible=Math.max(panelSlotEnd,top+m.height*.43);
 const lowerMask=Math.max(0,top+m.height-lastVisible);
 lever.style.clipPath='inset(0px 0px '+lowerMask.toFixed(2)+'px 0px)';
 lever.style.transform='rotate('+(-1+position*2).toFixed(2)+'deg)';
 lever.dataset.position=nearest(position).key;
 lever.setAttribute('aria-valuenow',String(Math.round(position*100)));
 lever.setAttribute('aria-valuetext',nearest(position).key.replace(/_/g,' '));
 for(const [key,button] of buttons){
  const active=key===nearest(position).key;
  button.dataset.active=String(active);
  button.setAttribute('aria-pressed',String(active));
 }
}
function set(v,source='PEDESTAL',snap=true){
 const t=fromValue(v);
 position=snap?nearest(t).t:t;
 render();
 if(source!=='quiet')emit(source);
 return position;
}
function step(delta){
 const i=STOPS.indexOf(nearest(position));
 return set(STOPS[Math.max(0,Math.min(STOPS.length-1,i+delta))].t,'PEDESTAL',true);
}
function pathPoint(t){
 return {x:171,y:G.trackTop+(G.trackBottom-G.trackTop)*clamp(t)};
}
function closestPoint(x,y){
 let best={distance:Infinity,position:0};
 for(let i=1;i<GUIDE.length;i++){
  const a=GUIDE[i-1],b=GUIDE[i],vx=b.x-a.x,vy=b.y-a.y;
  const d=vx*vx+vy*vy;
  const t=clamp(((x-a.x)*vx+(y-a.y)*vy)/d);
  const px=a.x+vx*t,py=a.y+vy*t,dist=(px-x)**2+(py-y)**2;
  if(dist<best.distance)best={distance:dist,position:clamp((py-G.trackTop)/(G.trackBottom-G.trackTop))};
 }
 return best.position;
}
function onDown(e){
 if(e.pointerType==='mouse'&&e.button!==0)return;
 if(e.ctrlKey||e.metaKey||e.shiftKey)return;
 e.preventDefault();e.stopPropagation();
 drag={pointer:e.pointerId,startX:e.clientX,startY:e.clientY,start:position,moved:false};
 try{lever.setPointerCapture(e.pointerId);}catch(_){}
 lever.classList.add('is-dragging');
}
function onMove(e){
 if(!drag||drag.pointer!==e.pointerId)return;
 e.preventDefault();e.stopPropagation();
 const rect=root.getBoundingClientRect(),m=measure();
 const scaleX=rect.width/root.offsetWidth||1,scaleY=rect.height/root.offsetHeight||1;
 const dx=(e.clientX-drag.startX)/scaleX/m.sx;
 const dy=(e.clientY-drag.startY)/scaleY/m.sy;
 if(Math.hypot(dx,dy)>3)drag.moved=true;
 if(drag.moved){
  const point=pathPoint(drag.start);
  position=closestPoint(point.x+dx,point.y+dy);
  render();
 }
}
function onUp(e){
 if(!drag||drag.pointer!==e.pointerId)return;
 e.preventDefault();e.stopPropagation();
 const moved=drag.moved;drag=null;lever.classList.remove('is-dragging');
 if(moved)set(position,'PEDESTAL',true);
 else step(1);
}
function bind(){
 lever.addEventListener('pointerdown',onDown);
 lever.addEventListener('pointermove',onMove);
 lever.addEventListener('pointerup',onUp);
 lever.addEventListener('pointercancel',()=>{
  if(!drag)return;
  const before=drag.start;drag=null;lever.classList.remove('is-dragging');
  set(before,'PEDESTAL',true);
 });
 lever.addEventListener('keydown',e=>{
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key))return;
  e.preventDefault();e.stopPropagation();
  if(e.key==='Home')return set('DOWN','PEDESTAL',true);
  if(e.key==='End')return set('UP','PEDESTAL',true);
  step(['ArrowDown','ArrowRight','PageDown'].includes(e.key)?1:-1);
 });
}
function mountGroove(){
 /* Repaint ONLY the old slot by reusing a neighboring strip from the exact
  * immutable background photo. No source file changes, no invented text. */
 const photo=texture.querySelector('img');
 if(photo){
  const cover=document.createElement('canvas');
  cover.className='speedbrake-old-slot-cover';
  cover.width=19;cover.height=313;
  const sx=texture.offsetWidth/G.sourceWindowWidth;
  const sy=texture.offsetHeight/G.sourceWindowHeight;
  Object.assign(cover.style,{
   left:(texture.offsetLeft+186*sx)+'px',
   top:(texture.offsetTop+318*sy)+'px',
   width:(19*sx)+'px',height:(313*sy)+'px'
  });
  const paint=()=>{
   if(!photo.naturalWidth)return;
   const ctx=cover.getContext('2d');
   if(ctx){ctx.imageSmoothingEnabled=true;
    ctx.drawImage(photo,175,318,8,313,0,0,19,313);}
  };
  if(photo.complete&&photo.naturalWidth)paint();
  else photo.addEventListener('load',paint,{once:true});
  root.append(cover);
 }
 const ns='http://www.w3.org/2000/svg';
 groove=document.createElementNS(ns,'svg');
 groove.id='b737-speedbrake-groove';
 groove.classList.add('speedbrake-slot-extension');
 groove.setAttribute('viewBox','0 0 800 978.1990521327015');
 groove.setAttribute('preserveAspectRatio','none');
 Object.assign(groove.style,{left:texture.offsetLeft+'px',top:texture.offsetTop+'px',
  width:texture.offsetWidth+'px',height:texture.offsetHeight+'px'});
 for(const [width,color] of [[16,'#8d99a5'],[13,'#35424b'],[10,'#05080b']]){
  const line=document.createElementNS(ns,'path');
  line.setAttribute('d',GROOVE_PATH);
  line.setAttribute('fill','none');
  line.setAttribute('stroke',color);
  line.setAttribute('stroke-width',String(width));
  line.setAttribute('stroke-linecap','round');
  line.setAttribute('stroke-linejoin','round');
  groove.appendChild(line);
 }
 root.append(groove);
}
function mountHitTargets(){
 const m=measure();
 for(const hit of HIT_TARGETS){
  const b=document.createElement('button');
  b.type='button';b.className='speedbrake-detent-hit';
  b.dataset.detent=hit.key;
  b.title='SPEED BRAKE '+hit.key.replace(/_/g,' ');
  b.setAttribute('aria-label','Set SPEED BRAKE '+hit.key.replace(/_/g,' '));
  Object.assign(b.style,{
   left:(texture.offsetLeft+(hit.x-hit.w/2-G.sourceWindowX)*m.sx)+'px',
   top:(texture.offsetTop+(hit.y-hit.h/2-G.sourceWindowY)*m.sy)+'px',
   width:(hit.w*m.sx)+'px',height:(hit.h*m.sy)+'px'
  });
  b.addEventListener('pointerdown',e=>e.stopPropagation());
  b.addEventListener('pointerup',e=>e.stopPropagation());
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();set(hit.key,'PEDESTAL_DETENT_CLICK',true);});
  root.append(b);buttons.set(hit.key,b);
 }
}
async function mount(){
 if(ready)return;
 root=document.querySelector('#region-pedestal .region-native');
 texture=root&&root.querySelector('[data-piece="throttle-quadrant"]');
 if(!root||!texture)return;
 mountGroove();
 lever=document.createElement('img');
 lever.id='b737-speedbrake-lever';
 lever.className='speedbrake-photo-lever';
 lever.src=ASSET;
 lever.addEventListener('error',()=>console.warn('SBK-0005 high-resolution speedbrake image failed to load'));
 lever.alt='B737 Speed Brake lever';lever.draggable=false;lever.tabIndex=0;
 lever.setAttribute('role','slider');lever.setAttribute('aria-label','Speed brake lever');
 lever.setAttribute('aria-valuemin','0');lever.setAttribute('aria-valuemax','100');
 lever.setAttribute('aria-orientation','vertical');
 root.append(lever);
 mountHitTargets();
 bind();ready=true;render();
 document.dispatchEvent(new CustomEvent('b737:speedbrake-ready',{detail:{
  source:'PEDESTAL',stops:STOPS.map(s=>s.key),clickableDetents:true
 }}));
 emit('mount');
}
window.addEventListener('b737:cockpit-mounted',mount);
document.addEventListener('DOMContentLoaded',mount,{once:true});
if(document.readyState!=='loading')mount();
window.addEventListener('b737:cockpit-lights-ready',syncArmed);
document.addEventListener('b737:speedbrake-state',e=>{
 const d=e.detail||{};if(d.source==='PEDESTAL'||d.source==='PEDESTAL_DETENT_CLICK'||!ready)return;
 if(d.detent!==undefined)set(d.detent,'quiet',true);
 else if(d.position!==undefined)set(d.position,'quiet',true);
 else if(d.percent!==undefined)set(d.percent,'quiet',true);
 syncArmed();
});
window.B737SpeedbrakeLever=Object.freeze({
 get:()=>position,set:v=>set(v,'api',true),stops:STOPS,
 mounted:()=>ready,geometry:()=>Object.assign({},G),
 path:()=>({d:GROOVE_PATH,guide:GUIDE.map(p=>({...p}))}),
 hitTargets:()=>HIT_TARGETS.map(h=>({...h})),
 calibrate:patch=>{
  for(const k of ['sourceWidth','trackTop','trackBottom']){
   if(Number.isFinite(patch?.[k]))G[k]=patch[k];
  }
  render();
 }
});
})();
