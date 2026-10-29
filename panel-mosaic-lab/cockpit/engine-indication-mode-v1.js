/* CKP ENGINE DISPLAY MODE — FLAP / AUTO BRAKE PHOTO REGISTRATION.
 * Only the optional owner Conventional PNG is presented on a separate
 * noninteractive photographic overlay. The five source placements and
 * all Owner18 / IRS red-zone assets remain unchanged.
 */
(function(){
'use strict';
const ROOT=document.documentElement;
const ASSET='./assets/conventional-engine-panel-owner-20261029.png?v=CONV-0002';
const VERSION='CONV-FIT-0004-PIXEL-CENTERS';
const W=1182,H=1330,FO_W=918,FO_H=1713;
// Pixel-center audit of the owner's original 1182x1330 PNG and the
// unchanged 918x1713 FO reference image. The independently installed
// FO flap needle pivot is at (95,291), within 2.5px of the photo center.
// Photo-derived AUTO BRAKE hole center is (101.5,889.5) in FO source.
// These source reference assets are read-only; only optional overlay moves.
const SOURCE=Object.freeze({flap:Object.freeze([1055.5,367.5]),auto:Object.freeze([1044.5,1117.5])});
const FO=Object.freeze({flap:Object.freeze([95,291]),auto:Object.freeze([101.5,889.5])});
let wrap=null,image=null,loaded=false,error=null,desired='EIS',geometry=null;
const store=()=>window.B737AircraftProfileStore;
const requested=()=>store()?.get()?.engineInstruments==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
function rect(node){if(!node)return null;const s=node.style;const r={x:parseFloat(s.left),y:parseFloat(s.top),w:parseFloat(s.width),h:parseFloat(s.height)};return Object.values(r).every(Number.isFinite)?r:null;}
function compute(engine,fo){
 if(!engine||!fo||fo.x<engine.x+engine.w-1||fo.x>engine.x+engine.w+1) return null;
 const sx=engine.w/W, foSX=fo.w/FO_W, foSY=fo.h/FO_H;
 const fx=fo.x+FO.flap[0]*foSX, fy=fo.y+FO.flap[1]*foSY;
 const ax=fo.x+FO.auto[0]*foSX, ay=fo.y+FO.auto[1]*foSY;
 const sy=(ay-fy)/(SOURCE.auto[1]-SOURCE.flap[1]);
 const skewX=(ax-fx-sx*(SOURCE.auto[0]-SOURCE.flap[0]))/(SOURCE.auto[1]-SOURCE.flap[1]);
 const translateX=fx-engine.x-sx*SOURCE.flap[0]-skewX*SOURCE.flap[1];
 const translateY=fy-engine.y-sy*SOURCE.flap[1];
 // The photographed flap/auto-brake column occupies only the left strip
 // of FO INNER. Stop before the separate landing-gear hardware.
 const left=engine.x,top=Math.min(engine.y,engine.y+translateY);
 const right=fo.x+fo.w*(.218),bottom=engine.y+engine.h;
 const matrix=[sx,0,skewX,sy,engine.x-left+translateX,engine.y-top+translateY];
 const map=(x,y)=>[left+matrix[0]*x+matrix[2]*y+matrix[4],top+matrix[3]*y+matrix[5]];
 const flap=map(...SOURCE.flap),auto=map(...SOURCE.auto);
 const errorPx=Math.max(Math.hypot(flap[0]-fx,flap[1]-fy),Math.hypot(auto[0]-ax,auto[1]-ay));
 return Object.freeze({version:VERSION,x:left,y:top,w:right-left,h:bottom-top,
  matrix:Object.freeze(matrix),cssMatrix:'matrix('+matrix.map(v=>Number(v.toFixed(8))).join(',')+')',
  anchors:Object.freeze({flap:Object.freeze(flap),auto:Object.freeze(auto)}),
  targets:Object.freeze({flap:Object.freeze([fx,fy]),auto:Object.freeze([ax,ay])}),
  errorPx:Number(errorPx.toFixed(8)),redZone:'NO_GUARD_OR_FO_ART_MODIFICATIONS'});
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
  image.onload=()=>{loaded=true;error=null;apply();};
  image.onerror=()=>{loaded=false;error='Conventional original PNG failed to load';apply();};
  image.src=new URL(ASSET,document.baseURI).href;
 }
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