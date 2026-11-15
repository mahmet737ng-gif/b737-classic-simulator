/* Unified pedestal photographic faceplate library. Existing cockpit controls and EFIS CP remain unchanged. */
(function(){
'use strict';
const base='../assets/locked/';
const plates=[
 ['Cargo Fire Control','Cargo_Fire_Control_bare_faceplate.png'],
 ['Transponder / TCAS','Transponder_TCAS_bare_faceplate.png'],
 ['VHF NAV / MANUAL','VHF_NAV_MANUAL_bare_faceplate.png'],
 ['VHF COMM','VHF_COMM_bare_faceplate.png']
];
function mount(){
 const region=document.querySelector('#region-pedestal');
 if(!region||region.querySelector('#unified-pedestal-faceplates'))return !!region;
 const wrap=document.createElement('div');wrap.id='unified-pedestal-faceplates';
 wrap.style.cssText='position:absolute;right:10px;bottom:10px;z-index:70;direction:ltr;pointer-events:auto';
 const toggle=document.createElement('button');toggle.type='button';toggle.textContent='RADIO / FIRE PANELS';toggle.setAttribute('aria-expanded','false');
 toggle.style.cssText='padding:7px 10px;background:#182b36;color:#f1f5f6;border:1px solid #78909b;border-radius:5px;cursor:pointer;font:700 12px Arial';
 const tray=document.createElement('div');tray.hidden=true;
 tray.style.cssText='position:absolute;right:0;bottom:36px;width:min(560px,80vw);max-height:65vh;overflow:auto;padding:10px;background:#101920f5;border:1px solid #71808b;border-radius:7px;box-shadow:0 8px 28px #000b;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px';
 for(const [label,file] of plates){
  const card=document.createElement('div');card.style.cssText='min-width:0;color:#fff;font:12px Arial';
  const img=document.createElement('img');img.src=new URL(base+file,document.currentScript?.src||location.href).href;
  img.alt=label;img.loading='lazy';img.style.cssText='display:block;width:100%;height:auto;object-fit:contain;background:#333';
  const caption=document.createElement('div');caption.textContent=label;caption.style.cssText='padding:4px 0';
  card.append(img,caption);tray.append(card);
 }
 tray.style.display='none';
 toggle.onclick=()=>{const open=tray.style.display==='none';tray.style.display=open?'grid':'none';toggle.setAttribute('aria-expanded',String(open));};
 wrap.append(toggle,tray);region.append(wrap);return true;
}
function retry(){if(mount())return;const observer=new MutationObserver(()=>{if(mount())observer.disconnect()});observer.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});else retry();
window.B737UnifiedPedestalFaceplates={plates:plates.map(([label,file])=>({label,file})),mount};
})();
