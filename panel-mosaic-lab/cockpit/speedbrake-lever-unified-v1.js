/* SBK-0001 — photo-based B737 Classic speedbrake, independently overlaid on the pedestal. */
(function(){
'use strict';
const STOPS=Object.freeze([
 {key:'DOWN',t:0},{key:'ARMED',t:.11},{key:'QUARTER',t:.28},
 {key:'HALF',t:.48},{key:'THREE_QUARTER',t:.68},
 {key:'FLIGHT_DETENT',t:.84},{key:'UP',t:1}
]);
const ASSET='./assets/speedbrake-lever-v1.txt?v=SBK-0001';
const G={sourceX:306,sourceWidth:205,trackTop:75,trackBottom:410,sourceWindowX:20,sourceWindowWidth:1055};
let root=null,texture=null,lever=null,position=0,ready=false,drag=null;
const clamp=x=>Math.min(1,Math.max(0,Number.isFinite(x)?x:0));
const nearest=t=>STOPS.reduce((a,b)=>Math.abs(b.t-t)<Math.abs(a.t-t)?b:a,STOPS[0]);
const fromValue=v=>{
 if(typeof v==='string'){
  const key=v.trim().toUpperCase().replace(/[\s/-]+/g,'_');
  const aliases={FULL_EXTEND:'UP',FULL:'UP',EXTEND:'FLIGHT_DETENT',MID:'HALF',MID_POS:'HALF',ONE_QUARTER:'QUARTER',THREE_QUARTERS:'THREE_QUARTER'};
  const stop=STOPS.find(s=>s.key===(aliases[key]||key));
  if(stop)return stop.t;
 }
 const n=Number(v);return clamp(n>1?n/100:n);
};
function emit(source){
 const stop=nearest(position);
 document.dispatchEvent(new CustomEvent('b737:speedbrake-position',{detail:{
  source:source||'PEDESTAL',position,percent:Math.round(position*1000)/10,
  detent:stop.key,armed:stop.key==='ARMED',phase:'VISUAL',ready
 }}));
}
function render(){
 if(!lever)return;
 const y=G.trackTop+(G.trackBottom-G.trackTop)*position;
 const rot=-3+position*6;
 lever.style.top=y.toFixed(2)+'px';
 lever.style.transform='rotate('+rot.toFixed(2)+'deg)';
 lever.dataset.position=nearest(position).key;
 lever.setAttribute('aria-valuenow',String(Math.round(position*100)));
 lever.setAttribute('aria-valuetext',nearest(position).key.replace(/_/g,' '));
}
function set(v,source,snap){
 const t=fromValue(v);
 position=snap?nearest(t).t:t;
 render();
 if(source!=='quiet')emit(source);
 return position;
}
function step(delta){
 const i=STOPS.indexOf(nearest(position));
 set(STOPS[Math.max(0,Math.min(STOPS.length-1,i+delta))].t,'PEDESTAL',true);
}
function onDown(e){
 if(e.pointerType==='mouse'&&e.button!==0)return;
 if(e.ctrlKey||e.metaKey||e.shiftKey)return;
 e.preventDefault();e.stopPropagation();
 const ratio=root.getBoundingClientRect().height/root.offsetHeight||1;
 drag={pointer:e.pointerId,startY:e.clientY,start:position,ratio,moved:false};
 lever.setPointerCapture(e.pointerId);
 lever.classList.add('is-dragging');
}
function onMove(e){
 if(!drag||drag.pointer!==e.pointerId)return;
 e.preventDefault();e.stopPropagation();
 const nativeDelta=(e.clientY-drag.startY)/drag.ratio;
 if(Math.abs(nativeDelta)>2)drag.moved=true;
 if(drag.moved)set(clamp(drag.start+nativeDelta/(G.trackBottom-G.trackTop)),'drag',false);
}
function onUp(e){
 if(!drag||drag.pointer!==e.pointerId)return;
 e.preventDefault();e.stopPropagation();
 const moved=drag.moved;drag=null;lever.classList.remove('is-dragging');
 if(moved)set(position,'PEDESTAL',true);else step(1);
}
function bind(){
 lever.addEventListener('pointerdown',onDown);
 lever.addEventListener('pointermove',onMove);
 lever.addEventListener('pointerup',onUp);
 lever.addEventListener('pointercancel',()=>{drag=null;lever.classList.remove('is-dragging');set(position,'PEDESTAL',true);});
 lever.addEventListener('keydown',e=>{
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key))return;
  e.preventDefault();e.stopPropagation();
  if(e.key==='Home')return set(0,'PEDESTAL',true);
  if(e.key==='End')return set(1,'PEDESTAL',true);
  step(['ArrowDown','ArrowRight','PageDown'].includes(e.key)?1:-1);
 });
}
async function mount(){
 if(ready)return;
 root=document.querySelector('#region-pedestal .region-native');
 texture=root&&root.querySelector('[data-piece="throttle-quadrant"]');
 if(!root||!texture)return;
 // Never replace or change the locked throttle quadrant image.
 let code;
 try{
  const response=await fetch(ASSET,{cache:'force-cache'});
  if(!response.ok)throw Error('sprite HTTP '+response.status);
  code=(await response.text()).trim();
  if(!/^[A-Za-z0-9+/=]+$/.test(code))throw Error('invalid sprite payload');
  const probe=new Image();probe.src='data:image/webp;base64,'+code;
  await probe.decode();
  if(probe.naturalWidth!==120||probe.naturalHeight!==207)throw Error('sprite dimension mismatch');
 }catch(err){console.warn('SBK-0001 isolated speedbrake could not load; preserved original quadrant',err);return;}
 const unit=texture.offsetWidth/G.sourceWindowWidth;
 const x=texture.offsetLeft+(G.sourceX-G.sourceWindowX)*unit;
 const width=G.sourceWidth*unit;
 lever=document.createElement('img');
 lever.id='b737-speedbrake-lever';
 lever.className='speedbrake-photo-lever';
 lever.src='data:image/webp;base64,'+code;
 lever.alt='B737 Speed Brake lever';
 lever.draggable=false;lever.tabIndex=0;lever.setAttribute('role','slider');
 lever.setAttribute('aria-label','Speed brake lever');
 lever.setAttribute('aria-valuemin','0');lever.setAttribute('aria-valuemax','100');
 lever.setAttribute('aria-orientation','vertical');
 Object.assign(lever.style,{
  width:width.toFixed(2)+'px',height:(width*207/120).toFixed(2)+'px',
  left:(x-width*.82).toFixed(2)+'px'
 });
 root.append(lever);
 bind();ready=true;render();
 document.dispatchEvent(new CustomEvent('b737:speedbrake-ready',{detail:{source:'PEDESTAL',stops:STOPS.map(s=>s.key)}}));
 emit('mount');
}
window.addEventListener('b737:cockpit-mounted',mount);
document.addEventListener('DOMContentLoaded',mount,{once:true});
if(document.readyState!=='loading')mount();
document.addEventListener('b737:speedbrake-state',e=>{
 const d=e.detail||{};if(d.source==='PEDESTAL'||!ready)return;
 if(d.position!==undefined)set(d.position,'quiet',false);
 else if(d.percent!==undefined)set(d.percent,'quiet',false);
 else if(d.detent!==undefined)set(d.detent,'quiet',true);
});
window.B737SpeedbrakeLever=Object.freeze({
 get:()=>position,set:v=>set(v,'api',true),stops:STOPS,
 mounted:()=>ready,
 geometry:()=>Object.assign({},G),
 // Calibration changes only the independent sprite, never any approved source pixels.
 calibrate:patch=>{for(const k of ['sourceX','sourceWidth','trackTop','trackBottom'])if(Number.isFinite(patch?.[k]))G[k]=patch[k];if(lever&&texture){const unit=texture.offsetWidth/G.sourceWindowWidth,x=texture.offsetLeft+(G.sourceX-G.sourceWindowX)*unit,w=G.sourceWidth*unit;lever.style.width=w+'px';lever.style.height=w*207/120+'px';lever.style.left=x-w*.82+'px';render();}}
});
})();