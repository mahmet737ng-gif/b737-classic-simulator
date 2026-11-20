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

 let focusAttempts=0;
 function focusMain(){
  const width=vp.clientWidth,height=vp.clientHeight;
  if((width<40||height<100)&&focusAttempts++<25){win.requestAnimationFrame(focusMain);return;}
  if(width<40||height<100)return;
  const z=Math.max(.04,Math.min(2,(width-42)/main.w,(height-65)/main.h));
  scene.style.left=Math.max(0,(width-layout.canvas.width*z)/2)+'px';
  scene.style.top=Math.max(0,(height-layout.canvas.height*z)/2)+'px';
  scene.style.transform='scale('+z+')';scene.style.setProperty('--zoom',String(z));
  const sizer=doc.getElementById('sizer');
  sizer.style.width=Math.ceil(layout.canvas.width*z)+'px';
  sizer.style.height=Math.ceil(layout.canvas.height*z)+'px';
  vp.scrollLeft=Math.max(0,(main.x+main.w/2)*z-width/2);
  vp.scrollTop=Math.max(0,main.y*z-38);
  const label=doc.getElementById('viewLabel');if(label)label.textContent='Main Panel';
  const zoom=doc.getElementById('zoomValue');if(zoom)zoom.textContent=Math.round(z*100)+'%';
 }
 win.requestAnimationFrame(focusMain);
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
