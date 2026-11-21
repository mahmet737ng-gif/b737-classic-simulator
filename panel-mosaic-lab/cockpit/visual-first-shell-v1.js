/* B737 Classic Unified: photo geometry first, system hydration second.
   Uses only verified gateway assembly+preview URLs; no live ECU dependencies.
   The interactive app adopts the exact original image nodes later. */
(function(win,doc){
 'use strict';
 const scene=doc.getElementById('scene'),vp=doc.getElementById('viewport');
 const boot=win.B737GatewayBoot,layout=boot?.assembly,photos=boot?.firstPaint;
 if(!scene||!vp||!layout||!photos)return;
 const main=layout.regions.find(r=>r.id==='main');
 if(!main?.placements?.length||!main.placements.every(p=>photos[p.asset]))return;
 let resolveLane,finished=false,released=false;
 const ready=new Promise(resolve=>{resolveLane=resolve;});
 function release(value){if(released)return;released=true;resolveLane(value);}
 win.B737VisualFirstShellV1={ready,adopted:false,startedAt:performance.now()};
 const required=[];
 const create=(type,cls,parent)=>{
  const node=doc.createElement(type);if(cls)node.className=cls;if(parent)parent.append(node);
  return node;
 };
 function setImage(img,key,high){
  if(!photos[key])return false;
  img.alt=key;img.draggable=false;img.decoding='async';
  img.loading=high?'eager':'lazy';img.fetchPriority=high?'high':'low';
  if(layout.assets[key])img.dataset.perfSource=layout.assets[key].url;
  img.src=photos[key];
  if(high)required.push(img);
  return true;
 }
 function mountPhotoRegion(r){
  if(!r?.placements?.length||!r.placements.every(p=>photos[p.asset]))return;
  const section=create('section','region',scene);
  section.id='region-'+r.id;section.dataset.visualShell='preview';
  section.dataset.region=r.id;section.setAttribute('aria-label',r.label);
  Object.assign(section.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});
  const title=create('span','region-label',section);title.textContent=r.label;
  const native=create('div','region-native',section);
  native.style.width=r.nativeWidth+'px';native.style.height=r.nativeHeight+'px';
  native.style.transform='scale('+(r.w/r.nativeWidth)+')';
  for(const p of r.placements){
   const piece=create('div','texture-piece',native);
   piece.dataset.piece=p.id;piece.dataset.reference=String(!!p.referenceOnly);
   piece.setAttribute('aria-label',p.label);
   Object.assign(piece.style,{left:p.x+'px',top:p.y+'px',width:p.w+'px',height:p.h+'px'});
   const img=create('img','',piece);setImage(img,p.asset,r.id==='main');
   if(p.presentation==='contain')img.style.objectFit='contain';
   if(p.sourceWindow){
    const src=layout.assets[p.asset],ratio=p.w/p.sourceWindow.w;
    Object.assign(img.style,{position:'absolute',
     width:(src.dimensions[0]*ratio)+'px',height:(src.dimensions[1]*ratio)+'px',
     left:(-p.sourceWindow.x*ratio)+'px',top:(-p.sourceWindow.y*ratio)+'px'});
   }
   if(p.maskPolygon){
    const [w,h]=layout.assets[p.asset].dimensions;
    img.style.clipPath='polygon('+
      p.maskPolygon.map(([x,y])=>(x/w*100).toFixed(4)+'% '+(y/h*100).toFixed(4)+'%').join(',')+')';
   }
  }
  const backing=r.id==='main'?'assets/main-panel.webp':'assets/pedestal.webp';
  if(photos[backing]){
   const ref=create('img','reference-image',section);
   setImage(ref,backing,false);
  }
 }
 Object.assign(scene.style,{width:layout.canvas.width+'px',height:layout.canvas.height+'px'});
 for(const id of ['main','pedestal'])mountPhotoRegion(layout.regions.find(r=>r.id===id));
 // Overhead photo: passive until the real OH iframe has loaded and its
 // separate electrical/air system owners are connected.
 const over=layout.regions.find(r=>r.id==='overhead');
 if(over&&photos['assets/overhead.webp']){
  const section=create('section','region',scene);
  section.id='region-overhead';section.dataset.visualShell='preview-overhead';
  section.dataset.region='overhead';section.setAttribute('aria-label',over.label);
  Object.assign(section.style,{left:over.x+'px',top:over.y+'px',width:over.w+'px',height:over.h+'px'});
  const title=create('span','region-label',section);title.textContent=over.label;
  const image=create('img','visual-overhead-preview',section);
  Object.assign(image.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'fill',pointerEvents:'none'});
  setImage(image,'assets/overhead.webp',false);
 }
 // Approved 737 CDU faceplates remain visible without depending on FMC
 // messages or a loaded iframe. Images disappear only after each live CDU
 // document is ready; no placeholder is presented as an operational CDU.
 const cduKey='cdu-standalone-v6/assets/cdu-approved-unlit.png';
 if(photos[cduKey])for(const item of layout.embeddedInstruments||[]){
  const native=doc.querySelector('#region-'+item.regionId+'[data-visual-shell="preview"] .region-native');
  if(!native)continue;
  const face=create('div','cdu-visual-shell',native);
  face.dataset.seat=item.seat;
  Object.assign(face.style,{position:'absolute',left:item.x+'px',top:item.y+'px',
   width:item.w+'px',height:item.h+'px',overflow:'hidden',background:'#05090b',pointerEvents:'none'});
  const photo=create('img','',face);
  setImage(photo,cduKey,true);
  const source=item.sourceWindow||{x:0,y:0,w:item.nativeWidth,h:item.nativeHeight};
  const sx=item.w/source.w,sy=item.h/source.h;
  Object.assign(photo.style,{position:'absolute',width:item.nativeWidth*sx+'px',
   height:item.nativeHeight*sy+'px',left:-source.x*sx+'px',top:-source.y*sy+'px'});
 }

 // Visual-only navigation remains usable while the simulator downloads.
 // Once the authoritative app adopts this shell, these lightweight handlers
 // become inert and its original pan/zoom and AFDS interactions take over.
 let focusAttempts=0,currentView='main',zoom=.2,interacted=false;
 // Preserve the viewport through visual-first -> full simulator hydration.
 win.B737VisualFirstShellV1.snapshot=()=>({zoom,left:vp.scrollLeft,top:vp.scrollTop,
  focused:currentView,interacted});
 const clamp=v=>Math.max(.04,Math.min(2,v));
 function viewBox(id){
  if(id==='all')return {x:0,y:0,w:layout.canvas.width,h:layout.canvas.height};
  const region=layout.regions.find(r=>r.id===id);
  if(region)return region;
  const inst=(layout.embeddedInstruments||[]).find(x=>x.id===id);
  if(inst){
   const host=layout.regions.find(r=>r.id===inst.regionId);
   const ratio=host.w/host.nativeWidth;
   return {x:host.x+inst.x*ratio,y:host.y+inst.y*ratio,w:inst.w*ratio,h:inst.h*ratio};
  }
  if(id==='cdu-both'){
   const a=viewBox('cdu-captain'),b=viewBox('cdu-first-officer');
   if(a&&b)return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),
    w:Math.max(a.x+a.w,b.x+b.w)-Math.min(a.x,b.x),
    h:Math.max(a.y+a.h,b.y+b.h)-Math.min(a.y,b.y)};
  }
  return null;
 }
 const labels={main:'Main Panel',overhead:'Interactive Overhead',pedestal:'Pedestal',
  all:'Full Cockpit','cdu-captain':'Captain CDU','cdu-first-officer':'First Officer CDU',
  'cdu-both':'Captain and First Officer CDUs'};
 function scale(z){
  zoom=clamp(z);
  const w=vp.clientWidth,h=vp.clientHeight;
  scene.style.left=Math.max(0,(w-layout.canvas.width*zoom)/2)+'px';
  scene.style.top=Math.max(0,(h-layout.canvas.height*zoom)/2)+'px';
  scene.style.transform='scale('+zoom+')';
  scene.style.setProperty('--zoom',String(zoom));
  const sizer=doc.getElementById('sizer');
  sizer.style.width=Math.ceil(layout.canvas.width*zoom)+'px';
  sizer.style.height=Math.ceil(layout.canvas.height*zoom)+'px';
  const value=doc.getElementById('zoomValue');
  if(value)value.textContent=Math.round(zoom*100)+'%';
 }
 function focus(id){
  const box=viewBox(id);if(!box)return;
  const w=vp.clientWidth,h=vp.clientHeight;
  if(w<40||h<100)return;
  currentView=id;win.B737VisualFirstShellV1.focused=id;
  scale(Math.min((w-42)/box.w,(h-65)/box.h));
  vp.scrollLeft=Math.max(0,(box.x+box.w/2)*zoom-w/2);
  vp.scrollTop=Math.max(0,box.y*zoom-38);
  const label=doc.getElementById('viewLabel');
  if(label)label.textContent=labels[id]||'Main Panel';
  for(const button of doc.querySelectorAll('[data-focus]'))
   button.classList.toggle('active',button.dataset.focus===id);
 }
 function focusMain(){
  if(win.B737VisualFirstShellV1.adopted||interacted)return;
  if((vp.clientWidth<40||vp.clientHeight<100)&&focusAttempts++<25){
   win.requestAnimationFrame(focusMain);return;
  }
  focus('main');
 }
 win.requestAnimationFrame(focusMain);
 doc.addEventListener('click',e=>{
  if(win.B737VisualFirstShellV1.adopted)return;
  const button=e.target.closest?.('[data-focus],#zoomOut,#zoomIn,#fit,#native');
  if(!button)return;
  interacted=true;
  if(button.dataset.focus){focus(button.dataset.focus);return;}
  if(button.id==='fit'){focus(currentView);return;}
  const newZ=button.id==='native'?1:button.id==='zoomIn'?zoom*1.2:zoom/1.2;
  const w=vp.clientWidth,h=vp.clientHeight,old=zoom;
  const left=(vp.scrollLeft+w/2)/old,top=(vp.scrollTop+h/2)/old;
  scale(newZ);
  vp.scrollLeft=Math.max(0,left*zoom-w/2);
  vp.scrollTop=Math.max(0,top*zoom-h/2);
 });
 vp.addEventListener('wheel',e=>{
  if(win.B737VisualFirstShellV1.adopted)return;
  interacted=true;
  if(!(e.ctrlKey||e.metaKey))return;
  e.preventDefault();
  const rect=vp.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
  const old=zoom,sourceX=(vp.scrollLeft+x)/old,sourceY=(vp.scrollTop+y)/old;
  scale(zoom*Math.exp(-e.deltaY*.002));
  vp.scrollLeft=Math.max(0,sourceX*zoom-x);
  vp.scrollTop=Math.max(0,sourceY*zoom-y);
 },{passive:false});
 let drag=null;
 vp.addEventListener('pointerdown',e=>{
  if(win.B737VisualFirstShellV1.adopted||e.pointerType!=='mouse'||e.button!==0||
    e.target.closest?.('button,input,select,a,iframe,[data-control]'))return;
  interacted=true;
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,l:vp.scrollLeft,t:vp.scrollTop};
 });
 vp.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId||win.B737VisualFirstShellV1.adopted)return;
  if(!(e.buttons&1)){drag=null;return;}
  vp.scrollLeft=drag.l-(e.clientX-drag.x);
  vp.scrollTop=drag.t-(e.clientY-drag.y);
  if(e.cancelable)e.preventDefault();
 });
 for(const name of ['pointerup','pointercancel','lostpointercapture'])
  vp.addEventListener(name,()=>{drag=null;});
 vp.addEventListener('touchstart',()=>{if(!win.B737VisualFirstShellV1.adopted)interacted=true;},{passive:true});
 win.addEventListener('resize',()=>{
  if(!win.B737VisualFirstShellV1.adopted)focus(currentView);
 });
 function finish(ok){
  if(finished)return;
  finished=true;
  if(ok){
   win.requestAnimationFrame(()=>win.requestAnimationFrame(()=>{
    const ms=Math.round(performance.now());
    doc.documentElement.dataset.unifiedVisualReadyMs=String(ms);
    doc.documentElement.dataset.unifiedVisualPhase='ready';
    performance.mark('b737:visual-ready');
    const banner=doc.getElementById('loading');
    if(banner){banner.textContent='VISUAL READY · SYSTEMS CONNECTING';banner.dataset.phase='visual';}
    win.dispatchEvent(new CustomEvent('b737:visual-ready',{detail:{visualReadyMs:ms}}));
    release({ok:true,atMs:ms});
   }));
  }else{
   doc.documentElement.dataset.unifiedVisualPhase='fallback';
   release({ok:false});
  }
 }
 let remaining=required.length,failed=false;
 if(!remaining)finish(false);
 else for(const img of required){
  const settled=ok=>{if(!ok)failed=true;if(--remaining===0)finish(!failed);};
  if(img.complete)settled(img.naturalWidth>0);
  else{
   img.addEventListener('load',()=>settled(true),{once:true});
   img.addEventListener('error',()=>settled(false),{once:true});
  }
 }
 // A slow or corrupt preview must never deadlock Overhead or CDU startup.
 // Fallback doesn't count as VISUAL READY.
 win.setTimeout(()=>release({ok:false,reason:'photo-preload-timeout'}),4000);
})(window,document);
