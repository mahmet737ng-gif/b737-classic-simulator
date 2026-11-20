/* PEDESTAL FACEPLATES 0006
 * Layout registered against the existing RADIO / NAV / AUDIO / TRIM pedestal.
 * Upper: COMM CAPT | CARGO FIRE CONTROL | COMM FO.
 * Lower: NAV CAPT | one Transponder/TCAS | NAV FO.
 * Positions are native 1150 x 2273. Locked texture files remain unchanged.
 * This overlay changes only faceplates, not the underlying radio or audio systems.
 */
(function(root){
'use strict';
const VERSION='PEDESTAL-FACEPLATES-0006';
const scriptUrl=document.currentScript?.src||location.href;
const source=name=>new URL('../assets/locked/'+name,scriptUrl).href;
function loadFace(image,file){
 const href=source(file);
 if(root.B737ImageLoader?.assignPreview)root.B737ImageLoader.assignPreview(image,href,384);
 else image.src=href;
}

// Images were measured directly from the archived user-provided PNG files:
 // Cargo 1009x457; COMM 1799x815; NAV 1799x813; XPDR/TCAS 1799x699.
 // The assigned radio bays are wider/taller than these native ratios. Stretching
 // them vertically turned circular rotary apertures into obvious ellipses.
 // Keep holes circular. Cargo Fire REPLACES the 348 x 178 center COMM bay; its
 // photo is letterboxed within a full-size opaque mounting frame.
const SOURCE_DIMENSIONS=Object.freeze({
 'Cargo_Fire_Control_bare_faceplate.png':[1009,457],
 'VHF_COMM_bare_faceplate.png':[1799,815],
 'VHF_NAV_MANUAL_bare_faceplate.png':[1799,813],
 'Transponder_TCAS_bare_faceplate.png':[1799,699]
});
const BAYS=[
 {"id":"cargo-fire","label":"Cargo Fire Control","file":"Cargo_Fire_Control_bare_faceplate.png","x":418,"y":927,"w":348,"h":178,"bay":"RADIO CENTER TOP"},
 {"id":"vhf-comm-capt","label":"VHF COMM — Captain","file":"VHF_COMM_bare_faceplate.png","x":58,"y":927,"w":360,"h":178,"bay":"RADIO LEFT TOP"},
 {"id":"vhf-comm-fo","label":"VHF COMM — First Officer","file":"VHF_COMM_bare_faceplate.png","x":766,"y":927,"w":355,"h":178,"bay":"RADIO RIGHT TOP"},
 {"id":"vhf-nav-capt","label":"VHF NAV / MANUAL — Captain","file":"VHF_NAV_MANUAL_bare_faceplate.png","x":58,"y":1109,"w":360,"h":184,"bay":"RADIO LEFT SECOND ROW"},
 {"id":"transponder-tcas","label":"Transponder / TCAS","file":"Transponder_TCAS_bare_faceplate.png","x":418,"y":1109,"w":348,"h":184,"bay":"RADIO CENTER SECOND ROW"},
 {"id":"vhf-nav-fo","label":"VHF NAV / MANUAL — First Officer","file":"VHF_NAV_MANUAL_bare_faceplate.png","x":766,"y":1109,"w":355,"h":184,"bay":"RADIO RIGHT SECOND ROW"}
];
const PANELS=Object.freeze(BAYS.map(plate=>{
 const [pixelWidth,pixelHeight]=SOURCE_DIMENSIONS[plate.file];
 const photoHeight=plate.w*pixelHeight/pixelWidth;
 const fullBay=plate.id==='cargo-fire';
 return Object.freeze({...plate,y:fullBay?plate.y:plate.y+(plate.h-photoHeight)/2,
  h:fullBay?plate.h:photoHeight,photoHeight,
  sourceWidth:pixelWidth,sourceHeight:pixelHeight,
  bayY:plate.y,bayHeight:plate.h});
}));
function mount(){
 const native=document.querySelector('#region-pedestal .region-native');
 if(!native)return false;
 let layer=native.querySelector('#unified-pedestal-faceplates');
 const oldCargo=native.querySelector('#unified-pedestal-cargo-replacement');
 if(layer?.dataset.version===VERSION&&oldCargo?.dataset.version===VERSION)return true;
 // Replace a stale layout in the same SPA without leaving a duplicate top-left panel.
 if(layer)layer.remove();
 if(oldCargo)oldCargo.remove();
 // This raster layer never captures touches: existing radio, EFIS and engine controls remain accessible.
 layer=document.createElement('div');
 layer.id='unified-pedestal-faceplates';
 layer.dataset.version=VERSION;
 layer.style.cssText='position:absolute;inset:0;z-index:22;pointer-events:none;direction:ltr';
 for(const plate of PANELS){
   if(plate.id==='cargo-fire')continue; // this panel uses a separate topmost replacement
   const frame=document.createElement('div');
   frame.className='unified-pedestal-faceplate';
   frame.dataset.faceplate=plate.id;
   frame.dataset.bay=plate.bay;
   Object.assign(frame.style,{position:'absolute',left:plate.x+'px',top:plate.y+'px',
    width:plate.w+'px',height:plate.h+'px',pointerEvents:'none',lineHeight:'0',overflow:'hidden'});
   const img=document.createElement('img');
   img.alt=plate.label+' — empty authentic faceplate, no switches installed';
   img.decoding='async';img.draggable=false;
   Object.assign(img.style,{display:'block',width:'100%',height:'100%',maxWidth:'none',
    objectFit:'contain',userSelect:'none',pointerEvents:'none'});
   img.addEventListener('error',()=>{frame.hidden=true;console.warn('Missing pedestal faceplate:',plate.file);},{once:true});
   frame.append(img);layer.append(frame);
   // The live TCAS renderer reuses this image node and replaces its src.
   // Leave its source under TCAS ownership, including after the pilot zooms.
   if(plate.id==='transponder-tcas')img.src=source(plate.file);
   else loadFace(img,plate.file);
 }
 native.append(layer);
 // The original center LEFT MCDU/audio photograph is baked into the underlying
 // RADIO / AVIONICS texture. It must be completely occluded, not merely overlaid
 // by a smaller aspect-fitted PNG (which leaves old lettering at top and bottom).
 const cargo=PANELS.find(p=>p.id==='cargo-fire');
 const backing=document.createElement('div');
 backing.id='unified-pedestal-cargo-replacement';
 backing.dataset.version=VERSION;
 backing.dataset.faceplate=cargo.id;
 backing.dataset.bay=cargo.bay;
 Object.assign(backing.style,{
  position:'absolute',left:cargo.x+'px',top:cargo.y+'px',
  width:cargo.w+'px',height:cargo.h+'px',boxSizing:'border-box',
  // Full opaque coverage of original 348x178 bay; no transparent strips.
  background:'linear-gradient(180deg,#52565e,#626671 12%,#626671 88%,#52565e)',
  border:'1px solid #34373f',boxShadow:'inset 0 0 0 1px #7c838b',
  overflow:'hidden',lineHeight:'0',pointerEvents:'none',zIndex:'95'
 });
 const cargoImage=document.createElement('img');
 cargoImage.alt='Cargo Fire Control replaces the existing center COMM panel';
 cargoImage.decoding='async';cargoImage.draggable=false;
 Object.assign(cargoImage.style,{
  position:'absolute',left:'0',top:(cargo.h-cargo.photoHeight)/2+'px',
  width:cargo.w+'px',height:cargo.photoHeight+'px',maxWidth:'none',
  display:'block',objectFit:'contain',userSelect:'none',pointerEvents:'none'
 });
 cargoImage.addEventListener('error',()=>{
  console.warn('Unable to load Cargo Fire faceplate:',cargo.file);
 },{once:true});
 backing.append(cargoImage);
 loadFace(cargoImage,cargo.file);
 native.append(backing);
 // Existing rotary controls can remount if a stale faceplate library was replaced.
 root.B737UnifiedVHFDualV1?.mount?.();
 root.B737UnifiedMechanicalFrequencyV1?.mount?.();
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
