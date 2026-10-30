/* CKP ENGINE DISPLAY MODE — FLAP / AUTO BRAKE PHOTO REGISTRATION.
 * Only the optional owner Conventional PNG is presented on a separate
 * noninteractive photographic overlay. The five source placements and
 * all Owner18 / IRS red-zone assets remain unchanged.
 */
(function(){
'use strict';
const ROOT=document.documentElement;
const ASSET='./assets/p2-conventional-full-owner-20261030.png?v=CONV-FULL-0001';
const VERSION='CONV-FULL-0001';
const W=1463,H=1075,FO_W=918,FO_H=1713;
// Full owner panorama, installed only when Conventional is selected.
let wrap=null,image=null,loaded=false,error=null,desired='EIS',geometry=null;
const store=()=>window.B737AircraftProfileStore;
const requested=()=>store()?.get()?.engineInstruments==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
function rect(node){if(!node)return null;const s=node.style;const r={x:parseFloat(s.left),y:parseFloat(s.top),w:parseFloat(s.width),h:parseFloat(s.height)};return Object.values(r).every(Number.isFinite)?r:null;}
function compute(engine,fo){
 if(!engine||!fo||fo.x<engine.x+engine.w-1||fo.x>engine.x+engine.w+1) return null;
 // Complete owner panorama: fuel quantity through landing gear, ending exactly
 // at the separately approved F/O flight panel. No guard control is moved.
 const left=engine.x,top=engine.y,right=1374,bottom=engine.y+engine.h;
 const sx=(right-left)/W,sy=(bottom-top)/H;
 const matrix=[sx,0,0,sy,0,0];
 return Object.freeze({version:VERSION,x:left,y:top,w:right-left,h:bottom-top,
  sourceWidth:W,sourceHeight:H,matrix:Object.freeze(matrix),
  cssMatrix:'matrix('+matrix.map(v=>Number(v.toFixed(8))).join(',')+')',
  redZone:'NO_GUARD_CONTROL_MODIFICATIONS'});
}
function mount(){
 const native=document.querySelector('#region-main .region-native');
 const e=native?.querySelector('.texture-piece[data-piece="engine"]');
 const fo=native?.querySelector('.texture-piece[data-piece="fo-inner"]');
 if(!native||!e||!fo)return false;
 const next=compute(rect(e),rect(fo));
 if(!next) {error='Engine and FO reference geometry not contiguous';return false;}
 geometry=next;
 if(!wrap){
  wrap=document.createElement('div');wrap.className='conventional-engine-photo-wrap-v1';
  wrap.setAttribute('aria-hidden','true');wrap.dataset.version=VERSION;
 }
 Object.assign(wrap.style,{left:next.x+'px',top:next.y+'px',width:next.w+'px',height:next.h+'px'});
 if(!image){
  image=document.createElement('img');image.className='conventional-engine-panel-v1';
  image.alt='';image.decoding='async';image.draggable=false;
  image.onload=()=>{loaded=true;error=null;window.B737ConventionalFullPaintV1?.apply(image);apply();};
  image.onerror=()=>{loaded=false;error='Conventional original PNG failed to load';apply();};
  image.src=new URL(ASSET,document.baseURI).href;
 }
 image.style.width=W+'px';image.style.height=H+'px';
 image.style.transform=next.cssMatrix;
 if(image.parentNode!==wrap)wrap.insertBefore(image,wrap.firstChild);
 if(wrap.parentNode!==native)native.appendChild(wrap);
 return true;
}
function apply(){
 desired=requested();
 const mounted=mount();
 const display=desired==='CONVENTIONAL'&&loaded&&mounted?'CONVENTIONAL':'EIS';
 ROOT.dataset.engineIndication=display;
 ROOT.dataset.engineIndicationRequested=desired;
 const engine=document.querySelector('#region-main .texture-piece[data-piece="engine"]');
 if(engine)engine.dataset.engineFace=display;
 const status=document.getElementById('activeProfileStatus');
 if(status&&error&&desired==='CONVENTIONAL')status.textContent='Engine display: Conventional image unavailable; EIS remains visible safely. '+error;
 window.dispatchEvent(new CustomEvent('b737:engine-indication-view',{detail:{requested:desired,display,assetLoaded:loaded,error,layout:geometry?.version||null}}));
}
window.addEventListener('b737:aircraft-profile-change',apply);
window.addEventListener('b737:cockpit-mounted',apply);
window.addEventListener('DOMContentLoaded',apply,{once:true});
window.B737EngineIndicationModeV1=Object.freeze({
 status:()=>Object.freeze({requested:desired,display:ROOT.dataset.engineIndication||'EIS',assetLoaded:loaded,
 asset:image?.src||null,version:VERSION,error,layout:geometry}),
 layout:()=>geometry,
 wrap:()=>wrap,
 setMode(mode){if(mode!=='EIS'&&mode!=='CONVENTIONAL')throw Error('Unsupported engine indication');
  const s=store();if(!s)throw Error('Settings registry not initialized');s.set({engineInstruments:mode});apply();}
});
apply();
})();