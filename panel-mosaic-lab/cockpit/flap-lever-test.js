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
   overlay.setAttribute('aria-label','Flap lever currently '+position+(position===0?' UP':'')+'. Swipe vertically to move one detent.');
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
     Object.assign(hit.style,{left:(point.x-17)+'px',top:(point.y-13)+'px',width:'35px',height:'27px'});
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
     if(Math.abs(dy)>13&&Math.abs(dy)>Math.abs(dx)*0.7)moveBySwipe(dy>0?+1:-1);
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
