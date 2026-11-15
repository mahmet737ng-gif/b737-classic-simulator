/* PEDESTAL FACEPLATES 0002
 * Four source-verified owner's PNG assets mounted on the native Unified pedestal.
 * No locked textures are modified. All positions are native 1150 x 2273 coordinates.
 * Radio plates cover matching radio slots; cargo/TCAS use clear auxiliary side bays
 * pending owner-approved final aviation-specific location. Noninteractive stage.
 */
(function(root){
'use strict';
const VERSION='PEDESTAL-FACEPLATES-0002';
const scriptUrl=document.currentScript?.src||location.href;
const source=name=>new URL('../assets/locked/'+name,scriptUrl).href;
const PANELS=Object.freeze([
 {id:'cargo-fire',label:'Cargo Fire Control',file:'Cargo_Fire_Control_bare_faceplate.png',x:14,y:145,w:244,h:111,bay:'AUX LEFT'},
 {id:'transponder-tcas',label:'Transponder / TCAS',file:'Transponder_TCAS_bare_faceplate.png',x:892,y:145,w:244,h:95,bay:'AUX RIGHT'},
 {id:'vhf-comm',label:'VHF COMM',file:'VHF_COMM_bare_faceplate.png',x:58,y:927,w:360,h:163,bay:'RADIO LEFT TOP'},
 {id:'vhf-nav',label:'VHF NAV / MANUAL',file:'VHF_NAV_MANUAL_bare_faceplate.png',x:766,y:1128,w:355,h:160,bay:'RADIO RIGHT MIDDLE'}
]);
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
    objectFit:'fill',userSelect:'none',pointerEvents:'none'});
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
