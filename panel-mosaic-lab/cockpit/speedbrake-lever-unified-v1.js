/* SBK-0004 — measured L-groove and direct-click detents; bare quadrant artwork immutable. */
(function(){
'use strict';
/* Coordinate system: native 800 × 1000 owner-approved throttle photograph.
 * The bent section is an independent overlay, NOT a modification of the photo.
 * Stop markers refer to the existing painted DOWN/ARMED/FLIGHT DETENT/UP legends.
 */
const STOP_Y=Object.freeze({DOWN:255,ARMED:284,FLIGHT_DETENT:475,UP:616});
const STOPS=Object.freeze(Object.entries(STOP_Y).map(([key,y])=>Object.freeze({
 key,y,t:(y-STOP_Y.DOWN)/(STOP_Y.UP-STOP_Y.DOWN)
})));
const HIT_TARGETS=Object.freeze([
 Object.freeze({key:'DOWN',x:212,y:252,w:54,h:26}),
 Object.freeze({key:'ARMED',x:209,y:298,w:62,h:29}),
 Object.freeze({key:'FLIGHT_DETENT',x:221,y:461,w:50,h:54}),
 Object.freeze({key:'UP',x:222,y:617,w:46,h:30})
]);
/* Centerline joins the existing black groove (x≈194, y≈321).
 * At DOWN it turns left toward the neighboring STAB TRIM scale. */
const GROOVE_PATH='M 154 253 L 154 265 Q 156 279 168 293 L 190 317 Q 194 322 194 333 L 194 618';
const GUIDE=Object.freeze([{x:154,y:253},{x:154,y:265},{x:168,y:293},{x:194,y:326},{x:194,y:618}].map(p=>Object.freeze(p)));
const ASSET='./assets/speedbrake-lever-v1.txt?v=SBK-0001';
const G={sourceX:194,sourceWidth:116,trackTop:STOP_Y.DOWN,trackBottom:STOP_Y.UP,
 sourceWindowX:0,sourceWindowY:0,sourceWindowWidth:800,sourceWindowHeight:978.1990521327015,
 gripAnchorX:.43,gripAnchorY:.215,shaftAnchorX:.84};
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
 }catch(err){console.warn('SBK-0004 SPEED BRAKE ARMED indication sync',err);}
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
 const top=texture.offsetTop+(y-G.sourceWindowY)*m.sy-G.gripAnchorY*m.height;
 const left=texture.offsetLeft+(G.sourceX-G.sourceWindowX)*m.sx-G.shaftAnchorX*m.width;
 lever.style.left=left.toFixed(2)+'px';
 lever.style.top=top.toFixed(2)+'px';
 lever.style.width=m.width.toFixed(2)+'px';
 lever.style.height=m.height.toFixed(2)+'px';
 const panelSlotEnd=texture.offsetTop+(642-G.sourceWindowY)*m.sy;
 const lastVisible=Math.max(panelSlotEnd,top+m.height*.43);
 const lowerMask=Math.max(0,top+m.height-lastVisible);
 lever.style.clipPath='inset(0px 0px '+lowerMask.toFixed(2)+'px 0px)';
 lever.style.transform='rotate('+(-2+position*3).toFixed(2)+'deg)';
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
 const y=G.trackTop+(G.trackBottom-G.trackTop)*clamp(t);
 if(y<=265)return{x:154,y};
 if(y<=293)return{x:154+(y-265)*14/28,y};
 if(y<=326)return{x:168+(y-293)*26/33,y};
 return{x:194,y};
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
 /* Native SVG follows the existing photograph's piece transform at any zoom.
  * No locked pixels or other pedestal regions are modified. */
 const ns='http://www.w3.org/2000/svg';
 groove=document.createElementNS(ns,'svg');
 groove.id='b737-speedbrake-groove';
 groove.classList.add('speedbrake-slot-extension');
 groove.setAttribute('viewBox','0 0 800 978.1990521327015');
 groove.setAttribute('preserveAspectRatio','none');
 Object.assign(groove.style,{left:texture.offsetLeft+'px',top:texture.offsetTop+'px',
  width:texture.offsetWidth+'px',height:texture.offsetHeight+'px'});
 for(const [width,color] of [[19,'#8895a1'],[15,'#263440'],[10,'#080d12']]){
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
 let code;
 try{
  const response=await fetch(ASSET,{cache:'force-cache'});
  if(!response.ok)throw Error('sprite HTTP '+response.status);
  code=(await response.text()).trim();
  if(!/^[A-Za-z0-9+/=]+$/.test(code))throw Error('invalid sprite payload');
  const probe=new Image();probe.src='data:image/webp;base64,'+code;
  await probe.decode();
  if(probe.naturalWidth!==120||probe.naturalHeight!==207)throw Error('sprite dimension mismatch');
 }catch(err){console.warn('SBK-0004 isolated sprite unavailable; preserved owner quadrant',err);return;}
 mountGroove();
 lever=document.createElement('img');
 lever.id='b737-speedbrake-lever';
 lever.className='speedbrake-photo-lever';
 lever.src='data:image/webp;base64,'+code;
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
