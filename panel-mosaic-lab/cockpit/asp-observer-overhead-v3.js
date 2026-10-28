/* ASP-OBS-IFRAME-0003 — observer audio panel belongs to the REAL overhead
 * atlas OH-04 in the embedded viewport, NOT to the parent cockpit wrapper.
 * Existing locked OH source, owner photos, labels and guard switches untouched.
 * Reuses approved CAPT/FO sprites + common 20-socket center registration.
 */
(function(root){
 'use strict';
 // Explicitly use the shared controls renderer in OBS-only mode.
 root.B737ASPOnlyObserver=true;
 const source=Object.freeze({x:953,y:56,w:379,h:283,w0:1731,h0:909});
 const atlas=Object.freeze({x:3,y:3,w:2214,h:1019});
 const box=Object.freeze({
  x:atlas.x+source.x*atlas.w/source.w0,
  y:atlas.y+source.y*atlas.h/source.h0,
  w:source.w*atlas.w/source.w0,
  h:source.h*atlas.h/source.h0
 });
 let host=null,watch=null;
 function install(){
  const layer=document.getElementById('atlasAbsolute');
  if(!layer)return false;
  const existing=layer.querySelector('.asp-bare-mounted[data-seat="OBS"]');
  if(existing){host=existing;return true;}
  const el=document.createElement('div');
  el.className='asp-bare-mounted asp-observer-overhead-native';
  el.dataset.seat='OBS';el.dataset.region='aft-overhead';el.dataset.panel='OH-04';
  el.dataset.aspObserverMount='ASP-OBS-IFRAME-0003';
  Object.assign(el.style,{position:'absolute',left:box.x+'px',top:box.y+'px',
   width:box.w+'px',height:box.h+'px',zIndex:'400',
   boxSizing:'border-box',background:'#566e81',border:'0',borderRadius:'0',margin:'0',padding:'0',
   pointerEvents:'auto',overflow:'hidden',direction:'ltr',userSelect:'none'});
  const img=document.createElement('img');
  img.src='../cockpit/assets/asp-bare-aft-overhead-v3.svg?v=ASP-COLOR-0003';
  img.alt='Observer ASP bare face on OH-04';img.draggable=false;
  Object.assign(img.style,{position:'absolute',inset:'0',left:'0px',top:'0px',display:'block',width:'100%',height:'100%',maxWidth:'none',
   objectFit:'fill',border:'0',margin:'0',padding:'0',pointerEvents:'none'});
  el.append(img);layer.append(el);host=el;
  root.dispatchEvent(new CustomEvent('b737:asp-observer-mounted',{detail:{seat:'OBS',panel:'OH-04',nativeRect:{...box}}}));
  return true;
 }
 function boot(){
  install();
  // The atlas renderer calls #atlasAbsolute.replaceChildren() asynchronously.
  // Keep one lightweight observer on that atlas and restore OBS whenever an
  // atlas redraw replaces our additive panel. Disconnecting after the first
  // mount would cause precisely the owner-reported "OBS unchanged" failure.
  const atlasRoot=document.getElementById('atlasAbsolute');
  watch=new MutationObserver(()=>{
   if(!document.querySelector('#atlasAbsolute > .asp-bare-mounted[data-seat="OBS"]'))install();
  });
  if(atlasRoot)watch.observe(atlasRoot,{childList:true});
  else watch.observe(document.documentElement,{childList:true,subtree:true});
 }
 // Relay only physical OBS inputs. Backend remains authoritative in parent.
 root.addEventListener('b737:asp-control',event=>{
  const d=event.detail||{};
  if(d.seat!=='OBS'||parent===root)return;
  parent.postMessage({type:'b737:asp-obs-control',detail:{seat:'OBS',kind:d.kind,
   channel:d.channel,selected:d.selected,volume:d.volume,angle:d.angle}},root.location.origin);
 });
 function audit(){
  if(!host||!host.isConnected)return {mounted:false,count:0,pass:false};
  const face=host.querySelector(':scope > img');
  if(!face)return {mounted:true,count:0,pass:false,reason:'No physical OBS photo'};
  const panel=face.getBoundingClientRect(),controls=[...host.querySelectorAll('.asp-photo-control')];
  const checks=controls.map(b=>{
   const hit=b.getBoundingClientRect();
   const x=Number(b.dataset.cx),y=Number(b.dataset.cy);
   const expectedX=panel.left+panel.width*x/1122,expectedY=panel.top+panel.height*y/888;
   return {kind:b.dataset.kind,channel:b.dataset.channel,
    expected:[expectedX,expectedY],actual:[hit.left+hit.width/2,hit.top+hit.height/2],
    errorCssPx:Math.hypot(expectedX-hit.left-hit.width/2,expectedY-hit.top-hit.height/2)};
  });
  const parent=host.getBoundingClientRect();
  const imageOffsetPx=Math.hypot(panel.left-parent.left,panel.top-parent.top);
  const maxErrorCssPx=Math.max(0,...checks.map(x=>x.errorCssPx));
  return {mounted:true,photoAnchored:imageOffsetPx<.25,
   photoOffsetCssPx:imageOffsetPx,rect:{...box},count:controls.length,
   maxErrorCssPx,checks,
   registration:host.dataset.aspRegistration||null,
   imageNative:true,pass:controls.length===20&&imageOffsetPx<.25&&maxErrorCssPx<.25};
 }
 root.B737ASPObserverOverhead=Object.freeze({install,getBounds:()=>({...box}),audit});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
})(window);
