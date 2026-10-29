/* CKP ENGINE DISPLAY MODE V1
 * Additive view-only bridge; never edits locked source photography or owner
 * switch/lamp registries. EIS is the unmodified Unified source appearance.
 * Conventional has its own overlaid face, ready for separately sourced instruments.
 */
(function(){
'use strict';
const ROOT=document.documentElement;
const ENGINE_PIECE='#region-main .texture-piece[data-piece="engine"]';
const ASSET='./assets/conventional-engine-face-v1.svg?v=CONV-0001';
let image=null,loaded=false,error=null,desired='EIS';
const store=()=>window.B737AircraftProfileStore;
const requested=()=>store()?.get()?.engineInstruments==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
function mount(){
 const host=document.querySelector(ENGINE_PIECE);
 if(!host)return false;
 if(image?.parentNode===host)return true;
 if(!image){
  image=document.createElement('img');
  image.className='conventional-engine-panel-v1';
  image.alt='';
  image.setAttribute('aria-hidden','true');
  image.decoding='async';
  image.draggable=false;
  image.onload=()=>{loaded=true;error=null;apply();};
  image.onerror=()=>{loaded=false;error='Conventional panel SVG failed to load';apply();};
  image.src=new URL(ASSET,document.baseURI).href;
 }
 host.appendChild(image);
 return true;
}
function apply(){
 desired=requested();
 mount();
 const display=desired==='CONVENTIONAL'&&loaded?'CONVENTIONAL':'EIS';
 ROOT.dataset.engineIndication=display;
 ROOT.dataset.engineIndicationRequested=desired;
 const host=document.querySelector(ENGINE_PIECE);
 if(host)host.dataset.engineFace=display;
 const status=document.getElementById('activeProfileStatus');
 if(status&&error&&desired==='CONVENTIONAL')
  status.textContent='Engine display: Conventional image unavailable; EIS remains visible safely. '+error;
 window.dispatchEvent(new CustomEvent('b737:engine-indication-view',{detail:{requested:desired,display,assetLoaded:loaded,error}}));
}
window.addEventListener('b737:aircraft-profile-change',apply);
window.addEventListener('b737:cockpit-mounted',apply);
window.addEventListener('DOMContentLoaded',apply,{once:true});
window.B737EngineIndicationModeV1=Object.freeze({
 status:()=>Object.freeze({requested:desired,display:ROOT.dataset.engineIndication||'EIS',assetLoaded:loaded,error}),
 setMode(mode){if(mode!=='EIS'&&mode!=='CONVENTIONAL')throw Error('Unsupported engine indication');const s=store();if(!s)throw Error('Settings registry not initialized');s.set({engineInstruments:mode});apply();}
});
apply();
})();