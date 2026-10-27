/* B737 Classic Unified — temporary empty guarded-switch apertures.
 * Original owner-locked atlas image binaries stay byte-identical.
 * This contains no prior guarded switch artwork or behavior; only geometries for hiding
 * guard-cover pixels already embedded in those original source photographs.
 * Remove this layer when new owner-designed switch assets have been installed.
 */
(function(){
'use strict';
const scriptUrl=new URL(document.currentScript.src);
const rootUrl=p=>new URL(p,scriptUrl).href;
const slots=[
 ['flight-control-a','OH07',156,144,78,175],
 ['flight-control-b','OH07',347,144,78,175],
 ['spoiler-a','OH07',156,693,78,175],
 ['spoiler-b','OH07',347,693,78,175],
 ['alternate-flaps-master','OH07',550,468,72,142],
 ['battery-master','OH10',222,1174,75,145],
 ['generator-disconnect-1','OH11',172,382,164,320],
 ['generator-disconnect-2','OH11',866,382,164,320],
 ['standby-power','OH11',419,257,366,132],
 ['emergency-exit-lights','OH14',477,295,235,510],
 ['bus-transfer','OH12',350,483,320,105],
 ['passenger-oxygen','UPPER',1262,543,68,135],
 ['flight-recorder-test','UPPER',1371,445,101,20]
];
const erased=new Set();
const errors=[];
const preserveReferencePixels=true;
const report=()=>{
 const result={mode:'GUARDS_REMOVED_PENDING_REPLACEMENT',activeGuardWidgets:document.querySelectorAll('.guard-node').length,
   emptyApertures:erased.size,expectedApertures:slots.length,sourcePhotographsUntouched:preserveReferencePixels,
   missing:slots.filter(x=>!erased.has(x[0])).map(x=>x[0]),errors:errors.slice()};
 window.B737EmptyGuardSockets=result;
 document.documentElement.dataset.oldGuardApertures=String(erased.size);
 document.documentElement.dataset.oldGuardVisualsRemoved=String(erased.size===slots.length&&result.activeGuardWidgets===0);
};
function project(place,x,y){
 const mapper=window.B737OverheadToggleModel;
 if(!mapper?.mapPoint)throw new Error('Atlas mapper unavailable');
 const p=mapper.mapPoint({id:'empty-original-photo-guard',sourcePoint:[x,y],bezelSourceDiameter:0},place);
 return {x:p.x-place.x,y:p.y-place.y};
}
function mount(place){
 const frame=[...document.querySelectorAll('#atlasAbsolute .atlas-piece')].find(el=>el.dataset.key===place.id);
 const target=frame?.querySelector('.atlas-image-window');
 if(!target)return;
 for(const [id,pid,x,y,w,h] of slots){
  if(pid!==place.id||erased.has(id))continue;
  try{
   const a=project(place,x,y),b=project(place,x+w,y+h);
   const mask=document.createElement('div');
   mask.className='b737-removed-old-guard';
   mask.dataset.retiredGuardLocation=id;
   mask.setAttribute('aria-hidden','true');
   mask.style.left=a.x+'px';mask.style.top=a.y+'px';
   mask.style.width=(b.x-a.x)+'px';mask.style.height=(b.y-a.y)+'px';
   // Mask only the control hardware, not nearby wording, lamps or panel fasteners.
   // The permanently locked photographic image is never edited or overwritten.
   target.append(mask);
   erased.add(id);
  }catch(e){errors.push(id+': '+String(e))}
 }
}
async function start(){
 try{
  const r=await fetch(rootUrl('../all-overhead/atlas-layout.json'),{cache:'no-store'});
  if(!r.ok)throw Error('Cannot read original source-to-atlas placement mapping');
  const layout=await r.json();
  const mountAll=()=>{for(const place of layout.placements)mount(place);report();return erased.size===slots.length};
  if(mountAll())return;
  const root=document.getElementById('atlasAbsolute');
  if(!root)throw Error('Missing atlas root');
  const observer=new MutationObserver(()=>{if(mountAll())observer.disconnect()});
  observer.observe(root,{subtree:true,childList:true});
 }catch(e){errors.push(String(e));report();console.error('Empty guard socket overlay',e)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
