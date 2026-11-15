/* PEDESTAL FACEPLATES 0004
 * Layout registered against the existing RADIO / NAV / AUDIO / TRIM pedestal.
 * Upper: COMM CAPT | existing audio (unchanged) | COMM FO.
 * Lower: NAV CAPT | one Transponder/TCAS | NAV FO.
 * Positions are native 1150 x 2273. Locked texture files remain unchanged.
 * This overlay changes only faceplates, not the underlying radio or audio systems.
 */
(function(root){
'use strict';
const VERSION='PEDESTAL-FACEPLATES-0004';
const scriptUrl=document.currentScript?.src||location.href;
const source=name=>new URL('../assets/locked/'+name,scriptUrl).href;
// Images were measured directly from the archived user-provided PNG files:
 // Cargo 1009x457; COMM 1799x815; NAV 1799x813; XPDR/TCAS 1799x699.
 // The assigned radio bays are wider/taller than these native ratios. Stretching
 // them vertically turned circular rotary apertures into obvious ellipses.
 // Fit each faceplate at natural aspect ratio and center it in its old bay.
const SOURCE_DIMENSIONS=Object.freeze({
 'Cargo_Fire_Control_bare_faceplate.png':[1009,457],
 'VHF_COMM_bare_faceplate.png':[1799,815],
 'VHF_NAV_MANUAL_bare_faceplate.png':[1799,813],
 'Transponder_TCAS_bare_faceplate.png':[1799,699]
});
const BAYS=[
 {"id":"cargo-fire","label":"Cargo Fire Control","file":"Cargo_Fire_Control_bare_faceplate.png","x":14,"y":145,"w":244,"h":111,"bay":"AUX LEFT"},
 {"id":"vhf-comm-capt","label":"VHF COMM — Captain","file":"VHF_COMM_bare_faceplate.png","x":58,"y":927,"w":360,"h":178,"bay":"RADIO LEFT TOP"},
 {"id":"vhf-comm-fo","label":"VHF COMM — First Officer","file":"VHF_COMM_bare_faceplate.png","x":766,"y":927,"w":355,"h":178,"bay":"RADIO RIGHT TOP"},
 {"id":"vhf-nav-capt","label":"VHF NAV / MANUAL — Captain","file":"VHF_NAV_MANUAL_bare_faceplate.png","x":58,"y":1109,"w":360,"h":184,"bay":"RADIO LEFT SECOND ROW"},
 {"id":"transponder-tcas","label":"Transponder / TCAS","file":"Transponder_TCAS_bare_faceplate.png","x":418,"y":1109,"w":348,"h":184,"bay":"RADIO CENTER SECOND ROW"},
 {"id":"vhf-nav-fo","label":"VHF NAV / MANUAL — First Officer","file":"VHF_NAV_MANUAL_bare_faceplate.png","x":766,"y":1109,"w":355,"h":184,"bay":"RADIO RIGHT SECOND ROW"}
];
const PANELS=Object.freeze(BAYS.map(plate=>{
 const [pixelWidth,pixelHeight]=SOURCE_DIMENSIONS[plate.file];
 const height=plate.w*pixelHeight/pixelWidth;
 return Object.freeze({...plate,y:plate.y+(plate.h-height)/2,h:height,
  sourceWidth:pixelWidth,sourceHeight:pixelHeight,
  bayY:plate.y,bayHeight:plate.h});
}));
function mount(){
 const native=document.querySelector('#region-pedestal .region-native');
 if(!native)return false;
 let layer=native.querySelector('#unified-pedestal-faceplates');
 if(layer)return true;
 // This raster layer never captures touches: existing radio, EFIS and engine controls remain accessible.
 layer=document.createElement('div');
 layer.id='unified-pedestal-faceplates';
 layer.dataset.version=VERSION;
 layer.style.cssText='position:absolute;inset:0;z-index:22;pointer-events:none;direction:ltr';
 for(const plate of PANELS){
   const frame=document.createElement('div');
   frame.className='unified-pedestal-faceplate';
   frame.dataset.faceplate=plate.id;
   frame.dataset.bay=plate.bay;
   Object.assign(frame.style,{position:'absolute',left:plate.x+'px',top:plate.y+'px',
    width:plate.w+'px',height:plate.h+'px',pointerEvents:'none',lineHeight:'0',overflow:'hidden'});
   const img=document.createElement('img');
   img.src=source(plate.file);
   img.alt=plate.label+' — empty authentic faceplate, no switches installed';
   img.decoding='async';img.draggable=false;
   Object.assign(img.style,{display:'block',width:'100%',height:'100%',maxWidth:'none',
    objectFit:'contain',userSelect:'none',pointerEvents:'none'});
   img.addEventListener('error',()=>{frame.hidden=true;console.warn('Missing pedestal faceplate:',plate.file);},{once:true});
   frame.append(img);layer.append(frame);
 }
 native.append(layer);
 root.dispatchEvent(new CustomEvent('b737:pedestal-faceplates-mounted',{detail:{version:VERSION,count:PANELS.length}}));
 return true;
}
function start(){
 if(mount())return;
 const observer=new MutationObserver(()=>{if(mount())observer.disconnect()});
 observer.observe(document.body,{childList:true,subtree:true});
}
root.addEventListener('b737:cockpit-mounted',mount);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
root.B737UnifiedPedestalFaceplates=Object.freeze({version:VERSION,
 panels:PANELS.map(p=>Object.freeze({...p,url:source(p.file)})),mount});
})(window);
