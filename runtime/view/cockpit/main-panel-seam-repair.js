/* Main-panel ENGINE → F/O INNER edge restoration.
 * Keeps BOTH locked source photographs and the original atlas placements
 * byte-for-byte untouched. The 2026-10-26 owner screenshot shows a redundant
 * right-hand painted margin of the ENGINE/standby photograph at this join.
 * This is a purely visual/transparent-to-input in-situ plate-face repair,
 * NOT a new geometry transform or instrument-position calibration.
 */
(function(root,factory){'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737MainSeamRepairV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(root){'use strict';
 const VERSION='MAIN-SEAM-0001';
 const LEFT='engine',RIGHT='fo-inner';
 // All dimensions are in UNIFIED NATIVE MAIN-PANEL units, before canvas zoom.
 // The engine lamp row reaches the top portion of the source image, so its
 // complete bezel is protected; only the narrow outermost pixels are patched.
 const STRIPS=Object.freeze([
  Object.freeze({id:'upper',insetFromJoin:8,overshoot:2,offsetY:0,heightFromEngineTop:94}),
  Object.freeze({id:'lower',insetFromJoin:24,overshoot:2,offsetY:94,heightToEngineBottom:true})
 ]);
 const num=(n)=>typeof n==='number'&&Number.isFinite(n);
 function geometry(source){
  const main=source?.regions?.find(r=>r.id==='main');
  if(!main)throw Error('Main region absent');
  const left=main.placements.find(p=>p.id===LEFT),right=main.placements.find(p=>p.id===RIGHT);
  if(!left||!right)throw Error('Engine / F/O inner source missing');
  const join=left.x+left.w;
  if(![left.x,left.y,left.w,left.h,right.x,right.y,right.w,right.h].every(num)||
     Math.abs(right.x-join)>.1||Math.abs(right.y-left.y)>.1)
   throw Error('Unexpected atlas geometry: main seam repair MUST NOT move either panel');
  const repairs=STRIPS.map(p=>{
   const y=left.y+p.offsetY;
   const h=p.heightToEngineBottom?left.h-p.offsetY:p.heightFromEngineTop;
   const x=join-p.insetFromJoin,w=p.insetFromJoin+p.overshoot;
   if(h<=0||x<left.x||x+w>right.x+4||y+h>left.y+left.h+.01)
    throw Error('Repair would cross calibrated instrument area');
   return Object.freeze({id:p.id,x,y,w,h});
  });
  return Object.freeze({schema:'b737-main-panel-seam/1',version:VERSION,join,engine:{...left},
   foInner:{...right},repairs,sourceInvariant:'NO_PLACEMENT_OR_LOCKED_ASSET_CHANGES'});
 }
 function fromDOM(doc){
  const native=doc?.querySelector('#region-main .region-native');
  if(!native)return null;
  const left=native.querySelector('.texture-piece[data-piece="engine"]');
  const right=native.querySelector('.texture-piece[data-piece="fo-inner"]');
  if(!left||!right)return null;
  const leftBox={id:LEFT,x:parseFloat(left.style.left),y:parseFloat(left.style.top),
   w:parseFloat(left.style.width),h:parseFloat(left.style.height)};
  const rightBox={id:RIGHT,x:parseFloat(right.style.left),y:parseFloat(right.style.top),
   w:parseFloat(right.style.width),h:parseFloat(right.style.height)};
  return {native,info:geometry({regions:[{id:'main',placements:[leftBox,rightBox]}]})};
 }
 function mount(doc=root?.document){
  const current=fromDOM(doc);if(!current)return false;
  const {native,info}=current;
  if(native.querySelector('[data-seam-repair="MAIN-SEAM-0001"]'))return true;
  const layer=doc.createElement('div');
  layer.className='main-panel-seam-repair';layer.dataset.seamRepair=VERSION;
  layer.dataset.left=LEFT;layer.dataset.right=RIGHT;
  layer.setAttribute('aria-hidden','true');
  for(const pos of info.repairs){
   const strip=doc.createElement('span');
   strip.className='main-panel-seam-strip main-panel-seam-'+pos.id;
   strip.dataset.seamStrip=pos.id;
   Object.assign(strip.style,{left:pos.x+'px',top:pos.y+'px',
    width:pos.w+'px',height:pos.h+'px'});
   layer.append(strip);
  }
  native.append(layer);
  // Alert only diagnostic consumers. Do not mutate geometry/needle positions.
  if(typeof root?.CustomEvent==='function')
   root.dispatchEvent(new CustomEvent('b737:main-seam-repair',{detail:{version:VERSION,
    join:info.join,repairBoxes:info.repairs.map(r=>({...r}))}}));
  return true;
 }
 if(root?.document&&root.MutationObserver){
  const doc=root.document;
  const observer=new MutationObserver(()=>{if(mount(doc))observer.disconnect();});
  const start=()=>{
   if(mount(doc))return;
   const scene=doc.getElementById('scene');
   if(scene)observer.observe(scene,{childList:true,subtree:true});
  };
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
 }
 return Object.freeze({VERSION,geometry,fromDOM,mount});
});
