/* SBK-0002 — four physical speed-brake positions on the active owner bare quadrant.
 * Independent lever overlay only. No panel/background/guarded-switch assets changed.
 */
(function(){
'use strict';
const STOPS=Object.freeze([
 {key:'DOWN',t:0},
 {key:'ARMED',t:67/428},
 {key:'FLIGHT_DETENT',t:245/428},
 {key:'UP',t:1}
].map(s=>Object.freeze(s)));
const ASSET='./assets/speedbrake-lever-v1.txt?v=SBK-0001';
/* Source-pixel registration on throttle-quadrant-bare-owner-20261104.webp:
 * the grip reference passes the printed DOWN, ARMED, FLIGHT DETENT and UP marks.
 * The shaft, not the grip, is registered to the black speedbrake slot (x=163).
 */
const G={sourceX:163,sourceWidth:146,trackTop:250,trackBottom:678,
 sourceWindowX:0,sourceWindowY:0,sourceWindowWidth:800,sourceWindowHeight:978.1990521327015,
 gripAnchorX:.43,gripAnchorY:.215,shaftAnchorX:.84};
let root=null,texture=null,lever=null,position=0,ready=false,drag=null;
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
  if(system.getState?.()?.inputs?.speedBrakeArmedIndication!==indication){
   system.setInputs({speedBrakeArmedIndication:indication});
  }
 }catch(err){console.warn('SBK-0002 SPEED BRAKE ARMED indication sync',err);}
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
 const sx=texture.offsetWidth/G.sourceWindowWidth;
 const sy=texture.offsetHeight/G.sourceWindowHeight;
 const width=G.sourceWidth*sx;
 const height=width*207/120;
 return {sx,sy,width,height,left:texture.offsetLeft+
  (G.sourceX-G.sourceWindowX)*sx-G.shaftAnchorX*width};
}
function render(){
 if(!lever||!texture)return;
 const m=measure();
 const markerSourceY=G.trackTop+(G.trackBottom-G.trackTop)*position;
 const top=texture.offsetTop+(markerSourceY-G.sourceWindowY)*m.sy-G.gripAnchorY*m.height;
 lever.style.left=m.left.toFixed(2)+'px';
 lever.style.width=m.width.toFixed(2)+'px';
 lever.style.height=m.height.toFixed(2)+'px';
 lever.style.top=top.toFixed(2)+'px';
 lever.style.transform='rotate('+(-1+position*2).toFixed(2)+'deg)';
 lever.dataset.position=nearest(position).key;
 lever.setAttribute('aria-valuenow',String(Math.round(position*100)));
 lever.setAttribute('aria-valuetext',nearest(position).key.replace(/_/g,' '));
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
function onDown(e){
 if(e.pointerType==='mouse'&&e.button!==0)return;
 if(e.ctrlKey||e.metaKey||e.shiftKey)return;
 e.preventDefault();e.stopPropagation();
 const ratio=root.getBoundingClientRect().height/root.offsetHeight||1;
 drag={pointer:e.pointerId,startY:e.clientY,start:position,ratio,moved:false};
 try{lever.setPointerCapture(e.pointerId);}catch(_){}
 lever.classList.add('is-dragging');
}
function onMove(e){
 if(!drag||drag.pointer!==e.pointerId)return;
 e.preventDefault();e.stopPropagation();
 const delta=(e.clientY-drag.startY)/drag.ratio;
 if(Math.abs(delta)>2)drag.moved=true;
 if(drag.moved){
  const nativeTravel=(G.trackBottom-G.trackTop)*(texture.offsetHeight/G.sourceWindowHeight);
  position=clamp(drag.start+delta/nativeTravel);
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
  const initial=drag.start;drag=null;lever.classList.remove('is-dragging');
  set(initial,'PEDESTAL',true);
 });
 lever.addEventListener('keydown',e=>{
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key))return;
  e.preventDefault();e.stopPropagation();
  if(e.key==='Home')return set('DOWN','PEDESTAL',true);
  if(e.key==='End')return set('UP','PEDESTAL',true);
  step(['ArrowDown','ArrowRight','PageDown'].includes(e.key)?1:-1);
 });
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
 }catch(err){console.warn('SBK-0002 isolated lever unavailable; bare panel preserved',err);return;}
 lever=document.createElement('img');
 lever.id='b737-speedbrake-lever';
 lever.className='speedbrake-photo-lever';
 lever.src='data:image/webp;base64,'+code;
 lever.alt='B737 Speed Brake lever';
 lever.draggable=false;lever.tabIndex=0;lever.setAttribute('role','slider');
 lever.setAttribute('aria-label','Speed brake lever');
 lever.setAttribute('aria-valuemin','0');lever.setAttribute('aria-valuemax','100');
 lever.setAttribute('aria-orientation','vertical');
 root.append(lever);
 bind();ready=true;render();
 document.dispatchEvent(new CustomEvent('b737:speedbrake-ready',{detail:{
  source:'PEDESTAL',stops:STOPS.map(s=>s.key)
 }}));
 emit('mount');
}
window.addEventListener('b737:cockpit-mounted',mount);
document.addEventListener('DOMContentLoaded',mount,{once:true});
if(document.readyState!=='loading')mount();
window.addEventListener('b737:cockpit-lights-ready',syncArmed);
document.addEventListener('b737:speedbrake-state',e=>{
 const d=e.detail||{};if(d.source==='PEDESTAL'||!ready)return;
 if(d.detent!==undefined)set(d.detent,'quiet',true);
 else if(d.position!==undefined)set(d.position,'quiet',true);
 else if(d.percent!==undefined)set(d.percent,'quiet',true);
 syncArmed();
});
window.B737SpeedbrakeLever=Object.freeze({
 get:()=>position,set:v=>set(v,'api',true),stops:STOPS,
 mounted:()=>ready,geometry:()=>Object.assign({},G),
 calibrate:patch=>{
  for(const k of ['sourceX','sourceWidth','trackTop','trackBottom']){
   if(Number.isFinite(patch?.[k]))G[k]=patch[k];
  }
  render();
 }
});
})();
