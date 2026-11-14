/* Owner bare IRS panel: measured apertures, existing functional controls.
 * Registration is independent of frozen overhead, SYS DSPL and 13-seg files.
 * Fixed SYS and display are anchors; neither is moved or restyled.
 */
(function(root){
 'use strict';
 let geometry=null,region=null,art=null,targets=[],observer=null;
 const px=n=>n+'px';
 function centered(el,aperture,width,height,anchor=[.5,.5]){
  if(!el)return false;
  const p=aperture.native;
  Object.assign(el.style,{left:px(p.cx-width*anchor[0]),top:px(p.cy-height*anchor[1]),width:px(width),height:px(height)});
  targets.push({id:el.dataset.isduKey||el.dataset.irsPhysical||el.dataset.msuMini||el.id,el,aperture,anchor});
  return true;
 }
 function imageLayer(kind,origin){
  const img=document.createElement('img');img.src=art.src;img.alt='';img.draggable=false;
  img.className='irs-registered-panel-'+kind;img.setAttribute('aria-hidden','true');
  img.dataset.irsPanelAsset=geometry.asset;
  Object.assign(img.style,{left:px(origin.x),top:px(origin.y),width:px(geometry.image.width*geometry.scale.x),height:px(geometry.image.height*geometry.scale.y)});
  const split=100*geometry.topSplitY/geometry.image.height;
  img.style.clipPath=kind==='top'?'inset(0 0 '+(100-split)+'% 0)':'inset('+split+'% 0 0 0)';
  return img;
 }
 function preserveApprovedHeading(){
  // Preserve only the approved heading. Owner separately approved the new
  // pictured 45-degree L/R stencils; their old overlay is now superseded.
  const p=document.createElement('div');p.className='irs-preserved-sys-heading';
  const sx=2214/1731,sy=1019/909,x=423,y=413,w=110,h=19;
  Object.assign(p.style,{left:px(3+x*sx),top:px(3+y*sy),width:px(w*sx),height:px(h*sy),backgroundImage:'url(../assets/locked/2026-10-23/OH01-06-source-9d8ac0ac86bd.png)',backgroundSize:'2214px 1019px',backgroundPosition:px(-x*sx)+' '+px(-y*sy)});
  p.setAttribute('aria-hidden','true');return p;
 }
 function install(){
  region=document.getElementById('region-overhead');
  if(!geometry||!region||!art?.complete||!art.naturalWidth)return false;
  const upper=region.querySelector('#irsUpperDsplMounted');
  const keys=region.querySelectorAll('#irsKeypadMounted .irs-photo-key');
  const msu=region.querySelector('#irsTrainerMSU');
  if(!upper||keys.length!==12||!msu||msu.querySelectorAll('[data-msu-mini]').length!==2||msu.querySelectorAll('.irs-msu-phys-lamp').length!==8||!region.querySelector('#irsSysDsplMounted')||!region.querySelector('#irsSegmentDisplayMounted'))return false;
  targets=[];
  if(!region.querySelector('#irsBarePanelRegistered')){
   const layer=document.createElement('div');layer.id='irsBarePanelRegistered';layer.setAttribute('aria-hidden','true');
   layer.append(imageLayer('body',geometry.origin),imageLayer('top',geometry.displayOrigin),preserveApprovedHeading());
   region.append(layer);
  }
  centered(upper,geometry.upper,88,88);
  if(geometry.detents){
   const d=geometry.detents;
   root.B737IRSDisplaySelector?.setDetentAngles?.(['TEST','TK/GS','PPOS','WIND','HDG/STS'].map(k=>d.upper[k]));
   for(const [side,value] of Object.entries(d.sys))region.style.setProperty('--irs-photo-sys-'+side,value+'deg');
   for(const [side,values] of Object.entries(d.msu))for(const [mode,value] of Object.entries(values))region.style.setProperty('--irs-photo-'+side+'-'+mode,value+'deg');
  }
  // The original mask's black-cap center is (69,70) in its 138px cell.
  // The new panel already contains its own metal bezel. Fit only the source
  // photo cap to the measured well; its original press/lens handlers survive.
  for(const key of keys){
   const p=geometry.keys[key.dataset.isduKey];if(!p)continue;
   centered(key,p,p.native.w*138/88,p.native.h*138/94,[.5,70/138]);
  }
  for(const side of ['L','R']){
   const p=geometry.msu[side],size=Math.max(p.native.w,p.native.h)/.8;
   centered(msu.querySelector('[data-msu-mini="'+side+'"]'),p,size,size);
  }
  for(const lamp of msu.querySelectorAll('.irs-msu-phys-lamp')){
   const id=lamp.dataset.irsPhysical,p=geometry.lamps[id];if(!p)continue;
   centered(lamp,p,p.native.w,p.native.h);
   const name=id.slice(2).replaceAll(' ','_'),color=name==='ALIGN'?'WHITE':'AMBER';
   const base='../lights-reference-v2/svg/'+name+'__'+color+'__';
   lamp.style.setProperty('--irs-panel-lamp-off','url("'+base+'OFF.svg")');
   lamp.style.setProperty('--irs-panel-lamp-on','url("'+base+'BRIGHT.svg")');
  }
  // These two frozen components are measured, never assigned a style.
  targets.push({id:'irsSysDsplMounted',el:region.querySelector('#irsSysDsplMounted'),aperture:geometry.sys,anchor:[.5,.5]});
  targets.push({id:'irsSegmentDisplayMounted',el:region.querySelector('#irsSegmentDisplayMounted'),aperture:geometry.display,anchor:[.5,.5]});
  region.classList.add('irs-panel-registered');region.dataset.irsPanelVersion=geometry.version;
  region.dataset.irsPanelTest=String(document.documentElement.dataset.lampVisualTest==='true');
  return true;
 }
 function audit(){
  if(!region||!geometry)return {ready:false,targets:[]};
  const r=region.getBoundingClientRect(),scale=r.width/region.offsetWidth;
  const report=targets.map(({id,el,aperture,anchor})=>{
   const b=el.getBoundingClientRect();
   const actual={x:(b.left+b.width*anchor[0]-r.left)/scale,y:(b.top+b.height*anchor[1]-r.top)/scale};
   const error=Math.hypot(actual.x-aperture.native.cx,actual.y-aperture.native.cy);
   return {id,expected:{x:aperture.native.cx,y:aperture.native.cy},actual,errorNativePx:error};
  });
  return {ready:report.length===25,version:geometry.version,assetNaturalSize:[art.naturalWidth,art.naturalHeight],scale,maxErrorNativePx:Math.max(0,...report.map(x=>x.errorNativePx)),targets:report};
 }
 async function boot(){
  try{
   const response=await fetch('./irs-panel-registration-v1.json?v=IRS-PANEL-0002');
   if(!response.ok)throw Error('IRS panel registration '+response.status);
   geometry=await response.json();art=new Image();
   art.onload=()=>{
    if(!install()){
     observer=new MutationObserver(()=>{if(install())observer.disconnect();});
     observer.observe(document.documentElement,{childList:true,subtree:true});
    }
   };
   art.onerror=()=>root.console?.error('IRS bare panel original PNG failed to load');
   art.src='./assets/'+geometry.asset;
  }catch(error){root.console?.error('IRS bare panel registration failed',error);}
 }
 root.addEventListener('b737:cockpit-mounted',install);
 root.addEventListener('b737:visual-test',event=>{
  if(region&&typeof event.detail?.active==='boolean')region.dataset.irsPanelTest=String(event.detail.active);
 });
 root.B737IRSPanelRegistration=Object.freeze({install,audit,getGeometry:()=>geometry});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
