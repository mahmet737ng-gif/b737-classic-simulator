(async()=>{
;
/* ./main-panel-seam-repair.js?v=MAIN-SEAM-0001 */
try{
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

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./flap-lever-model.js?v=FLAP-BMP-0005 */
try{
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FlapLeverModel=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const DETENTS=Object.freeze([0,1,2,5,10,15,25,30,40]);
 const GATES=Object.freeze([1,15]);
 function indexOf(value){const i=DETENTS.indexOf(Number(value));if(i<0)throw Error('Unknown B737 FLAP detent '+value);return i;}
 function gatedTarget(current,requested){
  const from=indexOf(current),to=indexOf(requested);
  if(to===from)return DETENTS[from];
  if(to>from){for(const gate of GATES){const g=indexOf(gate);if(g>from&&g<to)return gate;}}
  else {for(const gate of [...GATES].reverse()){const g=indexOf(gate);if(g<from&&g>to)return gate;}}
  return DETENTS[to];
 }
 function sequence(current,requested){
  const last=gatedTarget(current,requested),a=indexOf(current),b=indexOf(last),inc=Math.sign(b-a),out=[];
  if(!inc)return out;
  for(let i=a+inc;inc>0?i<=b:i>=b;i+=inc)out.push(DETENTS[i]);
  return out;
 }
 function swipe(current,direction){
  const index=indexOf(current),dir=Math.sign(Number(direction));
  return DETENTS[Math.max(0,Math.min(DETENTS.length-1,index+dir))];
 }
 function draggedTarget(current,nativeDeltaY,texture,targets){
  indexOf(current);
  if(!Number.isFinite(nativeDeltaY))throw Error('Invalid FLAP drag');
  const reference=targets[String(current)];
  if(!reference)throw Error('Missing FLAP current detent calibration '+current);
  const projected=nativePoint(texture,reference).y+nativeDeltaY;
  return DETENTS.reduce((best,value)=>{
   const point=targets[String(value)];
   if(!point)throw Error('Missing FLAP detent calibration '+value);
   const delta=Math.abs(nativePoint(texture,point).y-projected);
   return delta<best.error?{value,error:delta}:best;
  },{value:DETENTS[0],error:Infinity}).value;
 }
 function nativePoint(texture,source){
  const win=texture.sourceWindow;
  const nx=texture.x+(source.x-win.x)*texture.w/win.w;
  const ny=texture.y+(source.y-win.y)*texture.h/win.h;
  return Object.freeze({x:nx,y:ny});
 }
 return Object.freeze({DETENTS,GATES,indexOf,gatedTarget,sequence,swipe,nativePoint,draggedTarget});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./flap-lever-test.js?v=FLAP-BMP-0006-PHOTO-FIT-FINAL10-READY-0001 */
try{
(function(){
 'use strict';
 // Owner BMP artwork is immutable; only nine-sprite UI and detent motion are controlled here.
 const root=document,model=window.B737FlapLeverModel;
 const byId=id=>root.getElementById(id);
 const VALUES=[0,1,2,5,10,15,25,30,40];
 let config=null,position=0,overlay=null,sprite=null,selector=null,status=null,busy=false,mounted=false;
 let texture=null,calibration=null;
 let pointer=null,queuedTimer=null,sourceImage=null;
 function output(message){if(status)status.textContent=message||'FLAP '+position+(position===0?' / UP':'');}
 function paint(){
   if(!config||!sprite)return;
   const detent=config.detents[model.indexOf(position)];
   const target=model.nativePoint(texture,calibration.targets[String(position)]);
   const scale=config.mount.scale;
   // The tooth tip, not the handle or the old fixed bounding box, is the snap anchor.
   overlay.style.left=(target.x-detent.toothTip.x*scale)+'px';
   overlay.style.top=(target.y-detent.toothTip.y*scale)+'px';
   sprite.style.left=(-detent.sourceRect.x*scale)+'px';
   if(selector)selector.value=String(model.indexOf(position));
   output();
   overlay.dataset.detent=String(position);overlay.setAttribute('aria-valuenow',String(position));
   overlay.setAttribute('aria-label','Flap lever currently '+position+(position===0?' UP':'')+'. Swipe to a marked flap detent; gates at 1 and 15 require another action.');
   root.dispatchEvent(new CustomEvent('b737:flap-detent-visual-test',{detail:{index:model.indexOf(position),detent:position,visualOnly:true}}));
 }
 function stepAnimation(sequence,done){
   if(!sequence.length){busy=false;paint();done?.();return;}
   busy=true;position=sequence.shift();paint();
   if(sequence.length){queuedTimer=setTimeout(()=>stepAnimation(sequence,done),90);}
   else {queuedTimer=setTimeout(()=>{queuedTimer=null;busy=false;done?.();},95);}
 }
 function request(target){
   if(!model)return false;
   if(busy){output('FLAP '+position+' • moving');return false;}
   const route=model.sequence(position,target);
   stepAnimation(route,()=>{const gate=Number(target)!==position&&(position===1||position===15);
      output(gate?'GATE '+position+' • tap again':'FLAP '+position+(position===0?' / UP':''));});
   return true;
 }
 // Scenario initialization only; normal pilot movement retains gate detents.
 function presetFinal10(){if(!mounted||!config||!overlay||!sprite)return false;
  if(queuedTimer!==null){clearTimeout(queuedTimer);queuedTimer=null;}
  busy=false;position=30;paint();return true;}
 function moveBySwipe(direction){
   if(!model||busy)return false;
   return request(model.swipe(position,direction));
 }
 function focusPedestal(){root.querySelector('[data-focus="pedestal"]')?.click();}
 function toolbarControls(){
   const toolbar=root.querySelector('.toolbar .tools:last-child')||root.querySelector('.toolbar');
   if(!toolbar||byId('flapTestControls'))return;
   const group=root.createElement('div');group.id='flapTestControls';group.className='flap-test-controls';group.dir='ltr';
   const prev=root.createElement('button');prev.type='button';prev.textContent='▲';prev.title='FLAP preceding detent';prev.setAttribute('aria-label','Previous FLAP detent');
   selector=root.createElement('select');selector.id='flapDetentSelect';selector.setAttribute('aria-label','FLAP target detent');
   for(const value of VALUES){const option=root.createElement('option');option.value=String(model.indexOf(value));option.textContent=value===0?'FLAP UP (0)':'FLAP '+value;selector.append(option);}
   const next=root.createElement('button');next.type='button';next.textContent='▼';next.title='FLAP next detent';next.setAttribute('aria-label','Next FLAP detent');
   status=root.createElement('output');status.id='flapDetentStatus';status.setAttribute('aria-live','polite');
   prev.addEventListener('click',e=>{e.stopPropagation();moveBySwipe(-1);focusPedestal();});
   next.addEventListener('click',e=>{e.stopPropagation();moveBySwipe(+1);focusPedestal();});
   selector.addEventListener('change',()=>{const selected=VALUES[Number(selector.value)];request(selected);focusPedestal();});
   group.append(prev,selector,next,status);toolbar.append(group);
 }
 function pedestalHitTargets(native){
   for(let i=0;i<VALUES.length;i++){
     const value=VALUES[i],point=model.nativePoint(texture,calibration.targets[String(value)]);
     const hit=root.createElement('button');
     hit.type='button';hit.className='flap-detent-hit';hit.dataset.detent=String(value);
     hit.title='FLAP '+(value===0?'UP / 0':value)+' — mechanical gates enforced';
     hit.setAttribute('aria-label','Move FLAP toward '+value+' degrees, stopping at mechanical gates');
     Object.assign(hit.style,{left:(point.x-14)+'px',top:(point.y-11)+'px',width:'28px',height:'22px'});
     hit.addEventListener('pointerdown',e=>e.stopPropagation());
     hit.addEventListener('pointermove',e=>e.stopPropagation());
     hit.addEventListener('pointerup',e=>e.stopPropagation());
     hit.addEventListener('click',e=>{e.stopPropagation();request(value);});
     native.append(hit);
   }
 }
 function applyBackgroundCorrections(native,asset){
   const corrections=calibration.cosmeticCorrections||[];
   if(!corrections.length)return;
   const background=new Image();
   const patchURL=window.B737ImageLoader.patchURL(asset.url,corrections[0].sourceRect);
   background.addEventListener('load',()=>{
     const win=texture.sourceWindow;
     const sx=texture.w/win.w,sy=texture.h/win.h;
     for(const correction of corrections){
       const source=correction.sourceRect,dest=correction.destinationRect;
       const at=model.nativePoint(texture,dest);
       const canvas=root.createElement('canvas');
       canvas.className='flap-background-correction';
       canvas.width=dest.w;canvas.height=dest.h;
       Object.assign(canvas.style,{left:at.x+'px',top:at.y+'px',width:(dest.w*sx)+'px',height:(dest.h*sy)+'px'});
       const context=canvas.getContext('2d');context.imageSmoothingEnabled=false;
       context.drawImage(background,patchURL?0:source.x,patchURL?0:source.y,source.w,source.h,0,0,dest.w,dest.h);
       native.append(canvas);
     }
   },{once:true});
   background.addEventListener('error',()=>console.error('FLAP: could not load background correction source'),{once:true});
   background.src=patchURL||window.B737ImageLoader.fullURL(asset.url);
 }
 function enableSwipe(){
   overlay.addEventListener('pointerdown',event=>{
     if(!event.isPrimary||event.button!==0)return;
     event.preventDefault();event.stopPropagation();
     pointer={id:event.pointerId,x:event.clientX,y:event.clientY};
     try{overlay.setPointerCapture(event.pointerId);}catch(_){}
   });
   overlay.addEventListener('pointermove',event=>{if(pointer?.id===event.pointerId){event.preventDefault();event.stopPropagation();}});
   overlay.addEventListener('pointerup',event=>{
     if(pointer?.id!==event.pointerId)return;
     event.preventDefault();event.stopPropagation();
     const dy=event.clientY-pointer.y,dx=event.clientX-pointer.x;pointer=null;
     if(Math.abs(dy)>13&&Math.abs(dy)>Math.abs(dx)*0.7){
       const native=root.querySelector('#region-pedestal .region-native');
       const ratio=native?.getBoundingClientRect().height/native?.offsetHeight||1;
       const target=model.draggedTarget(position,dy/ratio,texture,calibration.targets);
       request(target);
     }
   });
   overlay.addEventListener('pointercancel',()=>{pointer=null;});
   overlay.addEventListener('wheel',event=>{if(event.ctrlKey||event.metaKey)return;event.preventDefault();event.stopPropagation();moveBySwipe(event.deltaY>0?+1:-1);},{passive:false});
   overlay.addEventListener('keydown',event=>{
     if(event.key==='ArrowDown'||event.key==='ArrowUp'){
       event.preventDefault();event.stopPropagation();moveBySwipe(event.key==='ArrowDown'?+1:-1);
     }
   });
 }
 function mountingError(err){
   console.error('FLAP-BMP-0003: failed to mount FLAP sprite',err);
   mounted=false;
   const notice=byId('flapLoadStatus')||root.createElement('span');
   notice.id='flapLoadStatus';notice.className='flap-test-error';notice.setAttribute('role','alert');
   notice.textContent='FLAP not loaded: '+err.message;
   if(!notice.isConnected)(root.querySelector('.view-caption')||root.body).append(notice);
 }
 async function mount(){
   if(mounted)return;
   if(!model){mountingError(Error('Missing FLAP mechanical model'));return;}
   const native=root.querySelector('#region-pedestal .region-native');
   const piece=root.querySelector('#region-pedestal [data-piece="throttle-quadrant"]');
   if(!native||!piece){mountingError(Error('Pedestal not ready'));return;}
   mounted=true;
   try {
     const reply=await fetch('./flap-lever-test.json',{cache:'no-store'});
     if(!reply.ok)throw Error('Manifest HTTP '+reply.status);
     config=await reply.json();
     if(!config.detents||VALUES.some((v,i)=>config.detents[i]?.value!==v))throw Error('Invalid nine-detent FLAP registry');
     // Calibration belongs to the background asset. A replacement image must
     // provide its own measured target map instead of inheriting stale pixels.
     const r=await fetch('./assembly.json',{cache:'no-store'});
     if(!r.ok)throw Error('Assembly HTTP '+r.status);
     const a=await r.json();
     texture=a.regions.find(x=>x.id==='pedestal')?.placements.find(x=>x.id==='throttle-quadrant');
     if(!texture)throw Error('Throttle placement missing');
     calibration=config.backgroundCalibrations?.[texture.asset];
     if(!calibration||VALUES.some(v=>!calibration.targets[String(v)]))throw Error('No measured FLAP detent map for current throttle background');
     applyBackgroundCorrections(native,a.assets[texture.asset]);
     const source=new URL(config.source,document.baseURI).href;
     const assetScale=config.mount.scale,dimensions=config.image;
     overlay=root.createElement('div');overlay.id='flapLeverBmpOverlay';overlay.className='flap-bmp-overlay';
     Object.assign(overlay.style,{
       width:dimensions.frameWidth*assetScale+'px',
       height:dimensions.cropHeight*assetScale+'px'
     });
     overlay.tabIndex=0;overlay.setAttribute('role','slider');overlay.setAttribute('aria-orientation','vertical');
     overlay.setAttribute('aria-valuemin','0');overlay.setAttribute('aria-valuemax','40');
     overlay.setAttribute('aria-valuenow','0');
     sprite=root.createElement('img');sprite.className='flap-bmp-sprite';sprite.alt='';
     window.B737ImageLoader.assign(sprite,source);sprite.draggable=false;
     sprite.style.width=dimensions.width*assetScale+'px';sprite.style.height=dimensions.height*assetScale+'px';sprite.style.top='0';
     overlay.append(sprite);native.append(overlay);
     pedestalHitTargets(native);
     enableSwipe();toolbarControls();position=0;paint();
     root.dispatchEvent(new CustomEvent('b737:flap-ready',{detail:{position:0,detents:VALUES.slice()}}));
     window.B737FlapVisualTest=Object.freeze({
       get position(){return position;},
       request,select:request,
       presetFinal10,
       swipe:moveBySwipe,
       reset(){if(busy)return false;position=0;paint();return true;},
       positions:Object.freeze(VALUES.slice()),
       gates:Object.freeze([1,15])
     });
   } catch(error){overlay?.remove();overlay=null;mountingError(error);}
 }
 function beginMount(){if(byId('region-pedestal'))mount();}
 window.addEventListener('b737:cockpit-mounted',beginMount);
 // Also survive a mount event emitted before this deferred script was evaluated.
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',beginMount,{once:true});
 else beginMount();
 const observer=new MutationObserver(()=>{if(!mounted&&byId('region-pedestal')){observer.disconnect();beginMount();}});
 observer.observe(root.body,{childList:true,subtree:true});
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./engine-start-lever-model.js?v=START-LEVER-0008 */
try{
/* ISN-03: physical Engine 1/2 start-lever placement on the owner's active bare
 * throttle-quadrant photograph. Frozen source archive and other controls untouched.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737EngineStartLeverModel=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const SOURCE=Object.freeze({width:800,height:1000,window:{x:0,y:0,w:800,h:800*740.9857819905213/606}});
 const SLOTS=Object.freeze({engine1:Object.freeze({x:330.5,label:'1'}),engine2:Object.freeze({x:404.5,label:'2'})});
 const HANDLE=Object.freeze({w:74,h:46});
 // Measured black slot on the unchanged 800x1000 owner photograph.
 // IDLE grip center meets the upper slot stop; CUTOFF retains its lower stop.
 const SLOT_TRACK=Object.freeze({top:847,bottom:941});
 const DETENTS=Object.freeze({IDLE:SLOT_TRACK.top,CUTOFF:SLOT_TRACK.bottom-HANDLE.h/2});
 // Hidden shaft reference only; the owner requested straight arms and no top disk.
 const PIVOT=Object.freeze({y:843,outerOffset:34});
 const clamp=x=>Math.max(0,Math.min(1,x));
 function travel(position){if(!Object.hasOwn(DETENTS,position))throw Error('Invalid physical start lever');return position==='IDLE'?1:0;}
 function geometry(device,fraction){
  if(!SLOTS[device]||!Number.isFinite(fraction))throw Error('Invalid physical start lever');
  const t=clamp(fraction),x=SLOTS[device].x,y=DETENTS.CUTOFF+(DETENTS.IDLE-DETENTS.CUTOFF)*t;
  const side=device==='engine1'?-1:1;
  // Frontal projection shortens as the arm rotates out of the panel plane.
  return {travel:t,x,y,pivotX:x+side*PIVOT.outerOffset,pivotY:PIVOT.y,
   jointX:x+side*(HANDLE.w/2-3),jointY:y+8};
 }
 function placementAt(piece,device,fraction){
  const g=geometry(device,fraction);
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid throttle plate placement');
  const scale=piece.w/SOURCE.window.w;
  if(Math.abs(piece.h-SOURCE.window.h*scale)>.5)throw Error('Throttle quadrant crop has changed');
  const px=g.x,py=g.y;
  return {left:piece.x+(px-SOURCE.window.x-HANDLE.w/2)*scale,
   top:piece.y+(py-SOURCE.window.y-HANDLE.h/2)*scale,
   width:HANDLE.w*scale,height:HANDLE.h*scale};
 }
 function placement(piece,device,position){return placementAt(piece,device,travel(position));}
 function dragTravel(start,startY,currentY,screenTravel){
  if(![start,startY,currentY,screenTravel].every(Number.isFinite)||screenTravel<=0)throw Error('Invalid lever drag');
  return clamp(start+(startY-currentY)/screenTravel);
 }
 function detentAt(fraction){return fraction>=.995?'IDLE':fraction<=.005?'CUTOFF':null;}
 return Object.freeze({SOURCE,SLOTS,DETENTS,HANDLE,SLOT_TRACK,PIVOT,travel,geometry,placementAt,placement,dragTravel,detentAt});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./engine-start-levers.js?v=START-LEVER-0007&amp;bootart=2 */
try{
/* Independent photographic grips, fixed shafts and projected metal arms.
 * Travel is continuous; ONLY endpoint commands go to the existing ECU owner. */
(function(){
 'use strict';
 const model=window.B737EngineStartLeverModel,ns='http://www.w3.org/2000/svg';
 const positions={engine1:'CUTOFF',engine2:'CUTOFF'},controls=new Map();
 const master=new URL('./assets/engine-start-lever-reference-v2.png?v=START-LEVER-0007',document.baseURI).href;
 let art=null;
 const raf=window.requestAnimationFrame?.bind(window),caf=window.cancelAnimationFrame?.bind(window);
 function svg(parent,tag,attrs){const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs||{}))n.setAttribute(k,String(v));parent.append(n);return n;}
 function stop(entry){if(entry.ticket!=null)caf?.(entry.ticket);entry.ticket=null;}
 function paint(entry,fraction){
  const g=model.geometry(entry.device,fraction);entry.travel=g.travel;
  const p=model.placementAt(entry.piece,entry.device,g.travel),s=entry.scale;
  Object.assign(entry.button.style,{left:(entry.piece.x+(g.x-model.SOURCE.window.x-model.HANDLE.w/2)*s)+'px',top:(entry.piece.y+(g.y-model.SOURCE.window.y-model.HANDLE.h/2)*s)+'px',width:(model.HANDLE.w*s)+'px',height:(model.HANDLE.h*s)+'px',minWidth:(model.HANDLE.w*s)+'px',minHeight:(model.HANDLE.h*s)+'px',maxWidth:'none',padding:'0',margin:'0',boxSizing:'border-box',lineHeight:'0',fontSize:'0'});
    entry.cap.setAttribute('x',g.x-model.HANDLE.w/2);entry.cap.setAttribute('y',g.y-model.HANDLE.h/2);
  entry.button.dataset.travel=g.travel.toFixed(4);
  entry.button.dataset.position=positions[entry.device];
  entry.button.setAttribute('aria-valuenow',String(Math.round(g.travel*100)));
  entry.button.setAttribute('aria-valuetext',(model.detentAt(g.travel)||'IN TRANSIT')+' · '+Math.round(g.travel*100)+'%');
  entry.button.title='ENGINE '+model.SLOTS[entry.device].label+' START LEVER · '+(model.detentAt(g.travel)||'IN TRANSIT');
 }
 function settle(entry,target){
  stop(entry);const start=entry.travel;
  if(!raf||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||Math.abs(start-target)<.0001){paint(entry,target);return;}
  let began=null;
  function frame(now){if(began===null)began=now;const t=Math.min(1,(now-began)/180),ease=1-(1-t)**3;
   paint(entry,start+(target-start)*ease);entry.ticket=t<1?raf(frame):null;
  }
  entry.ticket=raf(frame);
 }
 function position(device,next){
  if(!model.SLOTS[device]||!['CUTOFF','IDLE'].includes(next))throw Error('Unknown physical start lever state');
  const changed=positions[device]!==next;positions[device]=next;
  const entry=controls.get(device);if(!entry)return;
  entry.button.dataset.position=next;
  if(!entry.drag&&!entry.keyboard&&changed)settle(entry,model.travel(next));
 }
 function request(device,next=positions[device]==='CUTOFF'?'IDLE':'CUTOFF'){
  if(!model.SLOTS[device]||!['CUTOFF','IDLE'].includes(next))throw Error('Unknown physical start lever state');
  const entry=controls.get(device);if(entry)entry.button.dataset.pending='true';
  window.dispatchEvent(new CustomEvent('b737:engine-start-lever-command',{detail:{device,position:next,source:'PEDESTAL_PHYSICAL'}}));
  if(entry){delete entry.button.dataset.pending;if(!entry.drag&&!entry.keyboard)settle(entry,model.travel(positions[device]));}
 }
 function endpoint(entry){const next=model.detentAt(entry.travel);
  if(next&&next!==positions[entry.device]&&entry.lastRequested!==next){entry.lastRequested=next;request(entry.device,next);}
  if(!next)entry.lastRequested=null;
 }
 function finish(entry,event,cancelled){
  const drag=entry.drag;if(!drag||drag.id!==event.pointerId)return;
  event.stopPropagation();entry.suppressClick=drag.moved;
  entry.drag=null;delete entry.button.dataset.dragging;
  if(entry.button.hasPointerCapture?.(drag.id))entry.button.releasePointerCapture(drag.id);
  if(drag.moved||cancelled)settle(entry,model.travel(positions[entry.device]));
 }
 function bind(entry){const b=entry.button;
  b.addEventListener('pointerdown',e=>{
   if(e.button!==0&&e.pointerType!=='touch')return;e.stopPropagation();stop(entry);
   entry.keyboard=false;entry.suppressClick=false;entry.lastRequested=null;
   const scale=b.getBoundingClientRect().width/model.HANDLE.w;
   entry.drag={id:e.pointerId,y:e.clientY,start:entry.travel,span:(model.DETENTS.CUTOFF-model.DETENTS.IDLE)*scale,moved:false};
   b.dataset.dragging='true';b.setPointerCapture(e.pointerId);
  });
  b.addEventListener('pointermove',e=>{
   const d=entry.drag;if(!d||d.id!==e.pointerId)return;e.stopPropagation();
   if(!d.moved&&Math.abs(e.clientY-d.y)<3)return;d.moved=true;e.preventDefault();
   paint(entry,model.dragTravel(d.start,d.y,e.clientY,d.span));endpoint(entry);
  });
  b.addEventListener('pointerup',e=>finish(entry,e,false));
  b.addEventListener('pointercancel',e=>finish(entry,e,true));
  b.addEventListener('lostpointercapture',e=>finish(entry,e,true));
  b.addEventListener('click',e=>{e.stopPropagation();if(entry.suppressClick){entry.suppressClick=false;return;}entry.keyboard=false;request(entry.device);});
  b.addEventListener('keydown',e=>{
   if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','Escape','Enter',' '].includes(e.key))return;
   e.preventDefault();e.stopPropagation();stop(entry);entry.lastRequested=null;
   if(e.key==='Escape'){entry.keyboard=false;settle(entry,model.travel(positions[entry.device]));return;}
   if(['Home','End','Enter',' '].includes(e.key)){entry.keyboard=false;request(entry.device,e.key==='Home'?'CUTOFF':e.key==='End'?'IDLE':undefined);return;}
   entry.keyboard=true;paint(entry,entry.travel+(['ArrowUp','ArrowRight'].includes(e.key)?.05:-.05));endpoint(entry);
  });
  b.addEventListener('blur',()=>{if(entry.keyboard){entry.keyboard=false;settle(entry,model.travel(positions[entry.device]));}});
 }
 function mount(){
  const native=document.querySelector('#region-pedestal .region-native'),texture=native?.querySelector('[data-piece="throttle-quadrant"]');
  if(!texture||!native)return;
  const region=document.querySelector('#region-pedestal');
  const piece={x:272,y:0,w:606,h:740.9857819905213};
  if(art){for(const entry of controls.values()){entry.piece=piece;paint(entry,entry.travel);}return;}
  model.placement(piece,'engine1','CUTOFF');
  art=svg(native,'svg',{class:'engine-start-lever-art',viewBox:'0 0 '+model.SOURCE.window.w+' '+model.SOURCE.window.h,
   'data-start-lever-art':'START-LEVER-0007','aria-hidden':'true'});
  Object.assign(art.style,{position:'absolute',left:piece.x+'px',top:piece.y+'px',width:piece.w+'px',height:piece.h+'px',transformOrigin:'0 0'});
  
  for(const device of ['engine1','engine2']){
   const group=svg(art,'g',{'data-start-lever-assembly':device});
   const sprite=window.B737GatewayBoot?.art?.[device];
   const original=()=>device==='engine1'?'420 340 655 365':'1095 340 655 365';
   const cap=svg(group,'svg',{width:model.HANDLE.w,height:model.HANDLE.h,
    viewBox:sprite?'0 0 655 365':original(),preserveAspectRatio:'none',overflow:'hidden'});
   const image=svg(cap,'image',sprite?
    {width:655,height:365}:{width:2172,height:724});
   image.addEventListener('load',()=>image.setAttribute('data-boot-ready','true'),{once:true});
   if(sprite)image.addEventListener('error',()=>{
    cap.setAttribute('viewBox',original());
    image.setAttribute('width','2172');image.setAttribute('height','724');
    image.setAttribute('href',master);
   },{once:true});
   image.setAttribute('href',sprite?.url||master);
   const button=document.createElement('button');button.type='button';button.className='engine-start-lever';
   button.dataset.device=device;button.setAttribute('role','slider');button.setAttribute('aria-orientation','vertical');
   button.setAttribute('aria-valuemin','0');button.setAttribute('aria-valuemax','100');
   button.setAttribute('aria-label','ENGINE '+model.SLOTS[device].label+' START LEVER');
   const entry={device,button,piece,scale:piece.w/model.SOURCE.window.w,cap,travel:model.travel(positions[device]),drag:null,ticket:null,keyboard:false,lastRequested:null};
   controls.set(device,entry);native.append(button);bind(entry);paint(entry,entry.travel);
  }
 }
 // The cockpit assembly is rendered asynchronously after this deferred module
 // loads. Mount immediately when available and observe the later assembly too.
 function beginMount(){if(document.querySelector('#region-pedestal .region-native'))mount();}
 window.addEventListener('b737:engine-start-lever-state',e=>{const feedback=e.detail?.levers;if(!feedback)return;
  for(const device of ['engine1','engine2'])if(['CUTOFF','IDLE'].includes(feedback[device]))position(device,feedback[device]);
 });
 window.addEventListener('b737:cockpit-mounted',beginMount);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',beginMount,{once:true});else beginMount();
 const observer=new MutationObserver(()=>{if(!art)beginMount();});
 observer.observe(document.body,{childList:true,subtree:true});
 window.B737EngineStartLevers=Object.freeze({getPosition:device=>positions[device],getTravel:device=>controls.get(device)?.travel??model.travel(positions[device]),request,
  positions:Object.freeze(['CUTOFF','IDLE'])});
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./throttle-levers.js?v=THROTTLE-SEAM-0002-WHEEL&amp;fit=0001 */
try{
/* Thrust quadrant, registered in pixels of the installed 800 × 1000 photo. */
(function(win){
'use strict';
const doc=win.document;
const STOPS=[0,25,50,75,100], NAMES=['idle','quarter','mid','three-quarter','full'];
const CENTER=(322+437)/2, SEAM=-4;
const FULL=184, IDLE=652;
const WHITE_WIDTH=[137,135,127,117,108];
const positions={1:0,2:0}, controls=new Map();
// Each photo has its own crop and perspective. Register its metal shaft and
// white handgrip independently. The last pair locates the recessed button.
const PHOTO={
 1:[[.725,.884,.782,.717,.690],[.725,.855,.825,.725,.721],
    [.773,.765,.934,.766,.535],[.702,.383,.819,.696,.627],[.503,.123,.541,.507,.266]],
 2:[[.275,.884,.783,.282,.690],[.277,.855,.840,.269,.724],
    [.267,.769,.900,.254,.575],[.296,.392,.835,.300,.627],[.503,.123,.541,.507,.266]]
};
const clamp=n=>Math.max(0,Math.min(100,n));
const closest=n=>Math.round(n/25);
let layer,ready=false,mounting=false;
function box(el,x,y,w,h){
 Object.assign(el.style,{left:x/8+'%',top:y/10+'%',width:w/8+'%',height:h/10+'%'});
}
function paint(engine){
 const c=controls.get(engine);if(!c)return;
 const pct=positions[engine],requested=closest(pct);
 const k=c.poses[requested]?requested:c.poses.reduce((best,p,i)=>p&&(best<0||Math.abs(i-requested)<Math.abs(best-requested))?i:best,-1);
 if(k<0)return;
 const pose=c.poses[k],anchor=PHOTO[engine][k];
 const gripY=IDLE+(FULL-IDLE)*pct/100, width=WHITE_WIDTH[k]/anchor[2];
 const height=width*(Number(pose.getAttribute('height'))||pose.naturalHeight)/(Number(pose.getAttribute('width'))||pose.naturalWidth);
 // The inner edges meet at the seam when throttle positions match.
 const gripCenterFraction=k===4?.5:engine===1?.484:.515;
 const gripX=CENTER+(engine===1?-1:1)*(WHITE_WIDTH[k]+SEAM)/2;
 const left=gripX-width*gripCenterFraction,top=gripY-height*anchor[1];
 if(c.stage!==k){
  if(c.stage!==undefined)c.poses[c.stage].style.display='none';
  pose.style.display='block';c.stage=k;
 }
 box(pose,left,top,width,height);
 const buttonX=left+width*anchor[3],buttonY=top+height*anchor[4];
 const btnSize=k<2?width*.134:18;
 box(c.toga,buttonX-btnSize*.78,buttonY-btnSize*.78,btnSize*1.56,btnSize*1.56);
 c.toga.classList.toggle('show-recess',k>=2);
 // The grip hit area travels with the handgrip, clear of the opposite lever.
 const hitWidth=WHITE_WIDTH[k]+SEAM/2;
 const hitLeft=engine===1?CENTER-hitWidth:CENTER;
 box(c.hit,hitLeft,gripY-24,hitWidth,48);
 c.hit.dataset.position=String(pct);c.hit.setAttribute('aria-valuenow',String(pct));
 c.hit.setAttribute('aria-valuetext',pct+' percent');
 if(c.select)c.select.value=STOPS.includes(pct)?String(pct):'';
}
function apply(engine,value,source){
 if(![1,2].includes(engine)||!Number.isFinite(value))return false;
 const pct=Math.round(clamp(value)*10)/10;positions[engine]=pct;paint(engine);
 if(source==='user')doc.dispatchEvent(new CustomEvent('b737:throttle-position',{
  detail:{engine,percent:pct,stage:NAMES[closest(pct)],source:'PEDESTAL'}}));
 return true;
}
function addControls(engine,poses){
 const hit=doc.createElement('div'),toga=doc.createElement('button');
 hit.className='throttle-sprite-hit';hit.tabIndex=0;hit.setAttribute('role','slider');
 hit.setAttribute('aria-label','Engine '+engine+' thrust lever');
 hit.setAttribute('aria-valuemin','0');hit.setAttribute('aria-valuemax','100');hit.setAttribute('aria-orientation','vertical');
 let drag=null;
 hit.onpointerdown=e=>{
  if(e.button!==0||drag)return;
  e.preventDefault();e.stopPropagation();const height=layer.getBoundingClientRect().height;
  if(height<=0)return;
  drag={id:e.pointerId,y:e.clientY,pct:positions[engine],travel:height*(IDLE-FULL)/1000};
  hit.setPointerCapture(e.pointerId);
 };
 hit.onpointermove=e=>{
  if(e.pointerId!==drag?.id)return;
  e.preventDefault();e.stopPropagation();
  apply(engine,drag.pct+(drag.y-e.clientY)*100/drag.travel,'user');
 };
 hit.onpointerup=hit.onpointercancel=hit.onlostpointercapture=e=>{if(e.pointerId===drag?.id)drag=null;};
 hit.onkeydown=e=>{
  const pct=positions[engine],value={Home:0,End:100,ArrowUp:pct+1,ArrowDown:pct-1,PageUp:pct+10,PageDown:pct-10}[e.key];
  if(value===undefined)return;e.preventDefault();e.stopPropagation();apply(engine,value,'user');
 };
 toga.type='button';toga.className='throttle-toga-push';toga.dataset.engine=String(engine);
 toga.setAttribute('aria-label','Press TO/GA switch on throttle '+engine);toga.title='TO/GA '+engine;
 toga.addEventListener('pointerdown',e=>e.stopPropagation());
 toga.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  win.dispatchEvent(new CustomEvent('b737:toga-request',{detail:{source:'THROTTLE_'+engine,engine}}));
 });
 layer.append(hit,toga);controls.set(engine,{poses,hit,toga});
}
function buildSelectors(){
 const bar=doc.querySelector('.toolbar .tools:last-child')||doc.querySelector('.toolbar');
 if(!bar||doc.getElementById('throttle-position-controls'))return;
 const holder=doc.createElement('div');holder.id='throttle-position-controls';holder.className='throttle-position-controls';holder.dir='ltr';
 for(const [engine,c] of controls){
  const label=doc.createElement('label'),select=doc.createElement('select');label.className='throttle-position-group';
  label.append('THR '+engine);select.setAttribute('aria-label','Engine '+engine+' throttle position');
  for(const pct of STOPS)select.add(new Option(pct===0?'IDLE':pct===100?'FULL':pct+'%',String(pct)));
  const continuous=new Option('—','');continuous.hidden=true;select.add(continuous);
  select.onchange=()=>apply(engine,Number(select.value),'user');label.append(select);holder.append(label);c.select=select;
 }
 bar.append(holder);
}
async function load(engine,k){
 const img=new Image();img.alt='';img.draggable=false;img.decoding='async';img.className='throttle-state-sprite';
 const source='../assets/throttle-levers/engine-'+engine+'-'+NAMES[k]+'.png';
 if(win.B737ImageLoader?.assignPreview)win.B737ImageLoader.assignPreview(img,source,384);
 else img.src=source;
 try{await img.decode();return img;}
 catch{
  if(!win.B737ImageLoader?.assignPreview)return null;
  img.src=source;
  try{await img.decode();return img;}catch{return null;}
 }
}
async function mount(){
 if(ready||mounting)return;
 const native=doc.querySelector('#region-pedestal .region-native'),plate=native?.querySelector('[data-piece="throttle-quadrant"]');
 if(!plate)return;mounting=true;
 try{
  const sets=await Promise.all([1,2].map(n=>Promise.all(STOPS.map((_,k)=>load(n,k)))));
  if(sets.some(set=>set.every(img=>!img))){native.dataset.throttleMount='missing-assets';return;}
  layer=doc.createElement('div');layer.className='throttle-quadrant-layer';
  const cover=doc.createElement('div');cover.className='throttle-plastic-cover';
  box(cover,346,170,67,515);layer.append(cover);plate.append(layer);
  sets.forEach((set,i)=>{for(const img of set)if(img){img.style.display='none';layer.append(img);}addControls(i+1,set);});
  buildSelectors();paint(1);paint(2);ready=true;
  native.dataset.throttleMount='ready';native.dataset.throttleMissingAssets=String(sets.flat().filter(img=>!img).length);
  native.dispatchEvent(new CustomEvent('b737:throttle-sprites-ready',{bubbles:true,detail:{engines:2,positions:STOPS.slice()}}));
 }finally{mounting=false;}
}
doc.addEventListener('b737:throttle-state',e=>apply(e.detail?.engine,e.detail?.percent,'sim'));
win.addEventListener('b737:manual-engine-throttle',e=>apply(e.detail?.engine,e.detail?.percent,'sim'));
win.addEventListener('b737:cockpit-mounted',mount);
win.addEventListener('load',mount,{once:true});queueMicrotask(mount);
for(const ms of [500,1800,5000])setTimeout(mount,ms);
win.B737ThrottlePositions=Object.freeze({get:engine=>positions[engine],set:(engine,pct)=>apply(engine,Number(pct),'user'),
 mounted:()=>ready,positions:STOPS,geometry:()=>({centers:{1:CENTER-WHITE_WIDTH[4]/2,2:CENTER+WHITE_WIDTH[4]/2},sourceWidth:800,gripWidthNative:WHITE_WIDTH[4]-1,fullY:FULL,idleY:IDLE,hasAddedTogaFace:false})});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./stabilizer-trim-quadrant.js?v=STAB-TRIM-0003 */
try{
/* Classic stabilizer authorities, FCOM 9.20.8–9.20.9, and P8 wheel/indicator projection. */
(function(win){
'use strict';
const ticks=[[0,520],[5,564],[10,607],[15,646],[17,651]];
function limits(source,flaps=0,variant='737-300'){
 if(source==='MAIN_ELECTRIC')return [flaps>0?.25:variant==='737-300'?2.5:2.8,12.5];
 if(source==='AUTOPILOT')return [.25,14];
 return [0,17];
}
function step(current,target,[low,high]){
 // Outside an electric limit, the actuator can only move back toward its range.
 if(target>current)return Math.max(current,Math.min(target,high));
 return Math.min(current,Math.max(target,low));
}
function indexY(value){
 const end=ticks.findIndex(([n])=>n>=value);
 if(end<=0)return ticks[0][1];
 const [a,y]=ticks[end-1],[b,z]=ticks[end];return y+(z-y)*(value-a)/(b-a);
}
if(typeof module==='object'&&module.exports)module.exports={limits,step,indexY};
if(!win?.document)return;

const doc=win.document, wheels=[];
const switches={MAIN_ELECTRIC:'NORMAL',AUTOPILOT:'NORMAL'};
let units=5,layer,held=null,drive=null,flightColumn=0,override=false,report;
let animation=0,paintQueued=false;
const send=(name,detail)=>win.dispatchEvent(new CustomEvent(name,{detail}));
const flapPosition=()=>{
 const reading=win.B737FlapNeedles?.getState?.();
 return reading?Math.max(reading.left,reading.right):0;
};
const variant=()=>win.B737AircraftProfileStore?.get?.()?.aircraftModel??'737-300';
function apEngaged(){return /^(CMD|CWS)_[AB]$/.test(win.B737McpAFDSBridgeV1?.getOutput?.().modes?.autopilot||'');}
function canDrive(source,direction){
 if(held||switches[source]!=='NORMAL'||(!override&&direction*flightColumn<0))return false;
 if(source==='AUTOPILOT'&&!apEngaged())return false;
 // Available aircraft AC/DC power. Airframe-specific motor feed and CB WDM are separate.
 const bus=win.B737ISNCockpitV1?.getState?.()?.state?.electrical?.bus;
 return (bus?.transfer1===true||bus?.transfer2===true)&&(bus?.dc1===true||bus?.dc2===true);
}
function paint(){
 paintQueued=false;
 for(const {wheel,index,rim,sign} of wheels){
  const phase=(units-5)*15*sign+(sign>0?.64:.36);
  const angle=(phase-.5)*2*Math.PI;
  const facing=Math.cos(angle);
  rim.style.setProperty('--stripe-position',50+48*Math.sin(angle)+'%');
  rim.style.setProperty('--stripe-depth',String(Math.max(0,facing)));
  rim.style.setProperty('--stripe-visible',facing>0?'1':'0');
  index.style.top=(indexY(units)/10)+'%';
  wheel.setAttribute('aria-valuenow',String(Math.round(units*100)/100));
  wheel.setAttribute('aria-valuetext',units.toFixed(2)+' units');
 }
 if(report){
  const flaps=flapPosition(),[low,high]=limits('MAIN_ELECTRIC',flaps,variant());
  report.textContent=`${units.toFixed(2)} UNITS · FLAPS ${flaps.toFixed(1)} · MAIN ELECT ${low}–${high} · A/P 0.25–14`;
 }
}
function set(target,source='MANUAL'){
 if(!Number.isFinite(target)||!['MANUAL','MAIN_ELECTRIC','AUTOPILOT'].includes(source))return false;
 if(source!=='MANUAL'&&!canDrive(source,Math.sign(target-units)))return false;
 const next=step(units,target,limits(source,flapPosition(),variant()));
 if(next===units)return true;
 units=next;
 if(!paintQueued){paintQueued=true;win.requestAnimationFrame(paint);}
 send('b737:stabilizer-trim-position',{units,source});
 return true;
}
function stopDrive(){
 drive=null;
 if(animation){win.cancelAnimationFrame(animation);animation=0;}
}
function beginDrive(source,direction,target=direction>0?17:0){
 if(!canDrive(source,direction))return false;
 stopDrive();
 if(source==='MAIN_ELECTRIC')send('b737:pilot-trim-command',{confirmed:true,source:'COCKPIT_HARDWARE'});
 drive={source,direction,target,last:win.performance.now()};
 function tick(now){
  if(!drive)return;
  const {source,direction,target,last}=drive,dt=Math.min(.1,Math.max(0,(now-last)/1000));
  drive.last=now;
  // LAN 27-40 speed ratios. Absolute rates are simulator calibration.
  const down=flapPosition()>.01,rate=source==='MAIN_ELECTRIC'?(down?.45:.15):(down?.15:.075);
  const next=direction>0?Math.min(target,units+rate*dt):Math.max(target,units-rate*dt);
  const before=units;
  if(!set(next,source)||(dt>0&&units===before)||units===target){stopDrive();return;}
  animation=win.requestAnimationFrame(tick);
 }
 animation=win.requestAnimationFrame(tick);
 return true;
}
function mountCutouts(plate){
 for(const [source,x,label] of [['MAIN_ELECTRIC',570,'MAIN ELECT'],['AUTOPILOT',663,'AUTOPILOT']]){
  const el=doc.createElement('button');
  el.type='button';el.className='pedestal-trim-cutout';el.style.left=x/8+'%';
  el.setAttribute('aria-label','Stabilizer trim '+label+' cutout');
  el.setAttribute('aria-pressed','false');
  el.onpointerdown=e=>e.stopPropagation();
  el.onclick=e=>{
   e.stopPropagation();
   const position=switches[source]==='NORMAL'?'CUTOUT':'NORMAL';
   switches[source]=position;el.dataset.position=position;
   el.setAttribute('aria-pressed',String(position==='CUTOUT'));
   if(drive?.source===source)stopDrive();
   if(source==='AUTOPILOT')send('b737:stab-trim-autopilot-cutout',{confirmed:true,position});
  };
  plate.append(el);
 }
}
function mountControls(){
 const parent=doc.getElementById('unifiedControlCenter');if(!parent)return;
 const detail=doc.createElement('details');detail.className='stab-trim-controls';
 const title=doc.createElement('summary');title.textContent='Stabilizer Trim';detail.append(title);
 report=doc.createElement('output');detail.append(report);
 for(const [source,title] of [['MAIN_ELECTRIC','MAIN ELECT'],['AUTOPILOT','A/P TEST']]){
  for(const [direction,label] of [[-1,'NOSE DOWN'],[1,'NOSE UP']]){
   const input=doc.createElement('button');input.type='button';input.textContent=title+' '+label;
   input.onpointerdown=e=>{if(e.button===0){input.setPointerCapture(e.pointerId);beginDrive(source,direction);}};
   input.onpointerup=input.onpointercancel=input.onlostpointercapture=input.onblur=stopDrive;
   input.onkeydown=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)beginDrive(source,direction);}};
   input.onkeyup=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();stopDrive();}};
   detail.append(input);
  }
 }
 parent.append(detail);
}
function mount(){
 if(layer)return;
 const plate=doc.querySelector('#region-pedestal [data-piece="throttle-quadrant"]');if(!plate)return;
 layer=doc.createElement('div');layer.className='pedestal-trim-layer';
 for(const [side,sign] of [['CAPT',1],['FO',-1]]){
  const wheel=doc.createElement('div'),rim=doc.createElement('div'),index=new Image();
  wheel.className='pedestal-trim-wheel';wheel.dataset.side=side;wheel.setAttribute('role','slider');wheel.tabIndex=0;
  wheel.setAttribute('aria-label',side+' manual stabilizer trim wheel');wheel.setAttribute('aria-valuemin','0');wheel.setAttribute('aria-valuemax','17');wheel.setAttribute('aria-orientation','vertical');
  rim.className='pedestal-trim-plane';
  index.src='./assets/pedestal-hardware/trim-index.webp?v=2';index.className='pedestal-trim-index';index.dataset.side=side;index.alt='';index.draggable=false;
  wheel.append(rim);layer.append(wheel,index);wheels.push({wheel,index,rim,sign});
  wheel.onpointerdown=e=>{
   if(held||e.button!==0)return;e.preventDefault();e.stopPropagation();stopDrive();
   held={wheel,id:e.pointerId,y:e.clientY,at:e.timeStamp,height:Math.max(1,wheel.getBoundingClientRect().height)};
   wheel.setPointerCapture(e.pointerId);
  };
  wheel.onpointermove=e=>{
   if(held?.wheel!==wheel||held.id!==e.pointerId)return;
   e.preventDefault();e.stopPropagation();
   const distance=(e.clientY-held.y)/held.height,dt=Math.max(8,e.timeStamp-held.at);
   const gain=1+Math.min(5,Math.abs(distance)*200/dt);
   set(units+distance*gain);
   held.y=e.clientY;held.at=e.timeStamp;
  };
  wheel.onlostpointercapture=wheel.onpointercancel=wheel.onpointerup=e=>{if(held?.id===e.pointerId)held=null;};
  wheel.addEventListener('wheel',e=>{
   e.preventDefault();e.stopPropagation();stopDrive();
   const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?240:1);
   set(units+Math.sign(pixels)*Math.min(1.2,Math.abs(pixels)/145));
  },{passive:false});
  wheel.onkeydown=e=>{
   const delta={ArrowDown:.1,ArrowUp:-.1,PageDown:1,PageUp:-1,Home:-17,End:17}[e.key];
   if(delta===undefined)return;e.preventDefault();e.stopPropagation();stopDrive();set(units+delta);
  };
 }
 mountCutouts(layer);plate.append(layer);mountControls();paint();
}
win.addEventListener('blur',()=>{held=null;stopDrive();});
win.addEventListener('b737:trailing-flaps',()=>{if(report)paint();});
win.addEventListener('b737:stabilizer-trim-drive',e=>{
 const data=e.detail;
 if(!data?.confirmed||!Number.isFinite(data.units)||!['MAIN_ELECTRIC','AUTOPILOT'].includes(data.source))return;
 const target=step(units,data.units,limits(data.source,flapPosition(),variant()));
 if(target!==units)beginDrive(data.source,Math.sign(target-units),target);
});
win.addEventListener('b737:stabilizer-column',e=>{
 if(!e.detail?.confirmed)return;
 flightColumn=Math.sign(e.detail.direction)||0;override=e.detail.override===true;
});
win.B737StabilizerTrim=Object.freeze({get:()=>units,set,
 limits:source=>limits(source,flapPosition(),variant()),getCutouts:()=>({...switches})});
win.addEventListener('b737:cockpit-mounted',mount);queueMicrotask(mount);
})(typeof window==='object'?window:null);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./speedbrake-lever-unified-v1.js?v=SBK-0005-STRAIGHT-BASE-HD */
try{
/* SBK-0005 — owner redline: straight narrow slot; pivot-to-stencil detents; scalable photo-style sprite. */
(function(){
'use strict';
/* Coordinate system: native 800 × 1000 owner-approved throttle photograph.
 * The bent section is an independent overlay, NOT a modification of the photo.
 * Stop markers refer to the existing painted DOWN/ARMED/FLIGHT DETENT/UP legends.
 */
const STOP_Y=Object.freeze({DOWN:262,ARMED:288,FLIGHT_DETENT:478,UP:619});
const STOPS=Object.freeze(Object.entries(STOP_Y).map(([key,y])=>Object.freeze({
 key,y,t:(y-STOP_Y.DOWN)/(STOP_Y.UP-STOP_Y.DOWN)
})));
const HIT_TARGETS=Object.freeze([
 Object.freeze({key:'DOWN',x:211,y:247,w:58,h:27}),
 Object.freeze({key:'ARMED',x:211,y:297,w:58,h:27}),
 Object.freeze({key:'FLIGHT_DETENT',x:220,y:453,w:39,h:40}),
 Object.freeze({key:'UP',x:218,y:619,w:40,h:28})
]);
/* Fixed 13-pixel-width straight groove centered on user's red rectangle x=171.
 * Original photographic groove x=188..201 is masked at runtime, never edited on disk. */
const GROOVE_PATH='M 171 257 L 171 632';
const GUIDE=Object.freeze([{x:171,y:257},{x:171,y:632}].map(p=>Object.freeze(p)));
const ASSET='./assets/speedbrake-lever-hires-v2.svg?v=SBK-0005';
const G={sourceX:171,sourceWidth:124,trackTop:STOP_Y.DOWN,trackBottom:STOP_Y.UP,
 sourceWindowX:0,sourceWindowY:0,sourceWindowWidth:800,sourceWindowHeight:978.1990521327015,
 baseAnchorX:102/120,baseAnchorY:181/207};
let root=null,texture=null,lever=null,groove=null,position=0,ready=false,drag=null;
const buttons=new Map();
const clamp=x=>Math.min(1,Math.max(0,Number.isFinite(x)?x:0));
const nearest=t=>STOPS.reduce((a,b)=>Math.abs(b.t-t)<Math.abs(a.t-t)?b:a,STOPS[0]);
const fromValue=v=>{
 if(typeof v==='string'){
  const key=v.trim().toUpperCase().replace(/[\s/-]+/g,'_');
  const alias={FULL_EXTEND:'UP',FULL:'UP',EXTEND:'FLIGHT_DETENT',MID:'FLIGHT_DETENT',
    HALF:'FLIGHT_DETENT',QUARTER:'ARMED',THREE_QUARTER:'FLIGHT_DETENT'};
  const stop=STOPS.find(s=>s.key===(alias[key]||key));
  if(stop)return stop.t;
 }
 const n=Number(v);return clamp(n>1?n/100:n);
};
function syncArmed(){
 const indication=nearest(position).key==='ARMED';
 const system=window.B737CockpitLights;
 if(!system?.setInputs)return;
 try{
  if(system.getState?.()?.inputs?.speedBrakeArmedIndication!==indication)
   system.setInputs({speedBrakeArmedIndication:indication});
 }catch(err){console.warn('SBK-0005 SPEED BRAKE ARMED indication sync',err);}
}
function emit(source){
 const stop=nearest(position);
 document.dispatchEvent(new CustomEvent('b737:speedbrake-position',{detail:{
  source:source||'PEDESTAL',position,percent:Math.round(position*1000)/10,
  detent:stop.key,armed:stop.key==='ARMED',phase:'VISUAL',ready
 }}));
 syncArmed();
}
function measure(){
 const sx=texture.offsetWidth/G.sourceWindowWidth,sy=texture.offsetHeight/G.sourceWindowHeight;
 const width=G.sourceWidth*sx,height=width*207/120;
 return {sx,sy,width,height};
}
/* The sprite already includes the real angled upper arm. Register its vertical
 * shaft to the photographed black slot, not to the white grip's left edge.
 * The raised, curved branch is visible behind the upper part of the lever. */
function render(){
 if(!lever||!texture)return;
 const m=measure();
 const y=G.trackTop+(G.trackBottom-G.trackTop)*position;
 // Register the steel pivot/base to the actual printed detent, never the grip.
 const top=texture.offsetTop+(y-G.sourceWindowY)*m.sy-G.baseAnchorY*m.height;
 const left=texture.offsetLeft+(G.sourceX-G.sourceWindowX)*m.sx-G.baseAnchorX*m.width;
 lever.style.left=left.toFixed(2)+'px';
 lever.style.top=top.toFixed(2)+'px';
 lever.style.width=m.width.toFixed(2)+'px';
 lever.style.height=m.height.toFixed(2)+'px';
 const panelSlotEnd=texture.offsetTop+(642-G.sourceWindowY)*m.sy;
 const lastVisible=Math.max(panelSlotEnd,top+m.height*.43);
 const lowerMask=Math.max(0,top+m.height-lastVisible);
 lever.style.clipPath='inset(0px 0px '+lowerMask.toFixed(2)+'px 0px)';
 lever.style.transform='rotate('+(-1+position*2).toFixed(2)+'deg)';
 lever.dataset.position=nearest(position).key;
 lever.setAttribute('aria-valuenow',String(Math.round(position*100)));
 lever.setAttribute('aria-valuetext',nearest(position).key.replace(/_/g,' '));
 for(const [key,button] of buttons){
  const active=key===nearest(position).key;
  button.dataset.active=String(active);
  button.setAttribute('aria-pressed',String(active));
 }
}
function set(v,source='PEDESTAL',snap=true){
 const t=fromValue(v);
 position=snap?nearest(t).t:t;
 render();
 if(source!=='quiet')emit(source);
 return position;
}
function step(delta){
 const i=STOPS.indexOf(nearest(position));
 return set(STOPS[Math.max(0,Math.min(STOPS.length-1,i+delta))].t,'PEDESTAL',true);
}
function pathPoint(t){
 return {x:171,y:G.trackTop+(G.trackBottom-G.trackTop)*clamp(t)};
}
function closestPoint(x,y){
 let best={distance:Infinity,position:0};
 for(let i=1;i<GUIDE.length;i++){
  const a=GUIDE[i-1],b=GUIDE[i],vx=b.x-a.x,vy=b.y-a.y;
  const d=vx*vx+vy*vy;
  const t=clamp(((x-a.x)*vx+(y-a.y)*vy)/d);
  const px=a.x+vx*t,py=a.y+vy*t,dist=(px-x)**2+(py-y)**2;
  if(dist<best.distance)best={distance:dist,position:clamp((py-G.trackTop)/(G.trackBottom-G.trackTop))};
 }
 return best.position;
}
function onDown(e){
 if(e.pointerType==='mouse'&&e.button!==0)return;
 if(e.ctrlKey||e.metaKey||e.shiftKey)return;
 e.preventDefault();e.stopPropagation();
 drag={pointer:e.pointerId,startX:e.clientX,startY:e.clientY,start:position,moved:false};
 try{lever.setPointerCapture(e.pointerId);}catch(_){}
 lever.classList.add('is-dragging');
}
function onMove(e){
 if(!drag||drag.pointer!==e.pointerId)return;
 e.preventDefault();e.stopPropagation();
 const rect=root.getBoundingClientRect(),m=measure();
 const scaleX=rect.width/root.offsetWidth||1,scaleY=rect.height/root.offsetHeight||1;
 const dx=(e.clientX-drag.startX)/scaleX/m.sx;
 const dy=(e.clientY-drag.startY)/scaleY/m.sy;
 if(Math.hypot(dx,dy)>3)drag.moved=true;
 if(drag.moved){
  const point=pathPoint(drag.start);
  position=closestPoint(point.x+dx,point.y+dy);
  render();
 }
}
function onUp(e){
 if(!drag||drag.pointer!==e.pointerId)return;
 e.preventDefault();e.stopPropagation();
 const moved=drag.moved;drag=null;lever.classList.remove('is-dragging');
 if(moved)set(position,'PEDESTAL',true);
 else step(1);
}
function bind(){
 lever.addEventListener('pointerdown',onDown);
 lever.addEventListener('pointermove',onMove);
 lever.addEventListener('pointerup',onUp);
 lever.addEventListener('pointercancel',()=>{
  if(!drag)return;
  const before=drag.start;drag=null;lever.classList.remove('is-dragging');
  set(before,'PEDESTAL',true);
 });
 lever.addEventListener('keydown',e=>{
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key))return;
  e.preventDefault();e.stopPropagation();
  if(e.key==='Home')return set('DOWN','PEDESTAL',true);
  if(e.key==='End')return set('UP','PEDESTAL',true);
  step(['ArrowDown','ArrowRight','PageDown'].includes(e.key)?1:-1);
 });
}
function mountGroove(){
 /* Repaint ONLY the old slot by reusing a neighboring strip from the exact
  * immutable background photo. No source file changes, no invented text. */
 const photo=texture.querySelector('img');
 if(photo){
  const cover=document.createElement('canvas');
  cover.className='speedbrake-old-slot-cover';
  cover.width=19;cover.height=313;
  const sx=texture.offsetWidth/G.sourceWindowWidth;
  const sy=texture.offsetHeight/G.sourceWindowHeight;
  Object.assign(cover.style,{
   left:(texture.offsetLeft+186*sx)+'px',
   top:(texture.offsetTop+318*sy)+'px',
   width:(19*sx)+'px',height:(313*sy)+'px'
  });
  const paint=()=>{
   if(!photo.naturalWidth)return;
   const ctx=cover.getContext('2d');
   if(ctx){ctx.imageSmoothingEnabled=true;
    ctx.drawImage(photo,175,318,8,313,0,0,19,313);}
  };
  if(photo.complete&&photo.naturalWidth)paint();
  else photo.addEventListener('load',paint,{once:true});
  root.append(cover);
 }
 const ns='http://www.w3.org/2000/svg';
 groove=document.createElementNS(ns,'svg');
 groove.id='b737-speedbrake-groove';
 groove.classList.add('speedbrake-slot-extension');
 groove.setAttribute('viewBox','0 0 800 978.1990521327015');
 groove.setAttribute('preserveAspectRatio','none');
 Object.assign(groove.style,{left:texture.offsetLeft+'px',top:texture.offsetTop+'px',
  width:texture.offsetWidth+'px',height:texture.offsetHeight+'px'});
 for(const [width,color] of [[16,'#8d99a5'],[13,'#35424b'],[10,'#05080b']]){
  const line=document.createElementNS(ns,'path');
  line.setAttribute('d',GROOVE_PATH);
  line.setAttribute('fill','none');
  line.setAttribute('stroke',color);
  line.setAttribute('stroke-width',String(width));
  line.setAttribute('stroke-linecap','round');
  line.setAttribute('stroke-linejoin','round');
  groove.appendChild(line);
 }
 root.append(groove);
}
function mountHitTargets(){
 const m=measure();
 for(const hit of HIT_TARGETS){
  const b=document.createElement('button');
  b.type='button';b.className='speedbrake-detent-hit';
  b.dataset.detent=hit.key;
  b.title='SPEED BRAKE '+hit.key.replace(/_/g,' ');
  b.setAttribute('aria-label','Set SPEED BRAKE '+hit.key.replace(/_/g,' '));
  Object.assign(b.style,{
   left:(texture.offsetLeft+(hit.x-hit.w/2-G.sourceWindowX)*m.sx)+'px',
   top:(texture.offsetTop+(hit.y-hit.h/2-G.sourceWindowY)*m.sy)+'px',
   width:(hit.w*m.sx)+'px',height:(hit.h*m.sy)+'px'
  });
  b.addEventListener('pointerdown',e=>e.stopPropagation());
  b.addEventListener('pointerup',e=>e.stopPropagation());
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();set(hit.key,'PEDESTAL_DETENT_CLICK',true);});
  root.append(b);buttons.set(hit.key,b);
 }
}
async function mount(){
 if(ready)return;
 root=document.querySelector('#region-pedestal .region-native');
 texture=root&&root.querySelector('[data-piece="throttle-quadrant"]');
 if(!root||!texture)return;
 mountGroove();
 lever=document.createElement('img');
 lever.id='b737-speedbrake-lever';
 lever.className='speedbrake-photo-lever';
 lever.src=ASSET;
 lever.addEventListener('error',()=>console.warn('SBK-0005 high-resolution speedbrake image failed to load'));
 lever.alt='B737 Speed Brake lever';lever.draggable=false;lever.tabIndex=0;
 lever.setAttribute('role','slider');lever.setAttribute('aria-label','Speed brake lever');
 lever.setAttribute('aria-valuemin','0');lever.setAttribute('aria-valuemax','100');
 lever.setAttribute('aria-orientation','vertical');
 root.append(lever);
 mountHitTargets();
 bind();ready=true;render();
 document.dispatchEvent(new CustomEvent('b737:speedbrake-ready',{detail:{
  source:'PEDESTAL',stops:STOPS.map(s=>s.key),clickableDetents:true
 }}));
 emit('mount');
}
window.addEventListener('b737:cockpit-mounted',mount);
document.addEventListener('DOMContentLoaded',mount,{once:true});
if(document.readyState!=='loading')mount();
window.addEventListener('b737:cockpit-lights-ready',syncArmed);
document.addEventListener('b737:speedbrake-state',e=>{
 const d=e.detail||{};if(d.source==='PEDESTAL'||d.source==='PEDESTAL_DETENT_CLICK'||!ready)return;
 if(d.detent!==undefined)set(d.detent,'quiet',true);
 else if(d.position!==undefined)set(d.position,'quiet',true);
 else if(d.percent!==undefined)set(d.percent,'quiet',true);
 syncArmed();
});
window.B737SpeedbrakeLever=Object.freeze({
 get:()=>position,set:v=>set(v,'api',true),stops:STOPS,
 mounted:()=>ready,geometry:()=>Object.assign({},G),
 path:()=>({d:GROOVE_PATH,guide:GUIDE.map(p=>({...p}))}),
 hitTargets:()=>HIT_TARGETS.map(h=>({...h})),
 calibrate:patch=>{
  for(const k of ['sourceWidth','trackTop','trackBottom']){
   if(Number.isFinite(patch?.[k]))G[k]=patch[k];
  }
  render();
 }
});
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
