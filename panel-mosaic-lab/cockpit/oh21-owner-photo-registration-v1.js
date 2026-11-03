/* PHOTO-REG-20261030 · Unified embedded overhead ONLY.
 * Frozen OH01–OH25 source assets/atlas are never written or replaced.
 * Fail closed: don't display a photo until all source PNGs and dimensions verify.
 * Mounts the existing switch/light/recessed hardware, never replaces backend state.
 */
(function(){
'use strict';
const host=document.getElementById('atlasAbsolute');if(!host)return;
const MANIFEST=new URL('../cockpit/panel-photo-registry.v1.json',document.baseURI).href;
const PROFILE='b737classic.aircraft-profile.v1';
const originals=new WeakMap();let register=null,active=null,layer=null,detail=null,desired=null,loading=false,requestedFamily=null,failed=false;
const target=(p)=>new URL('../cockpit/assets/'+p.file,document.baseURI).href;
const num=s=>Number.parseFloat(s);
const photoGroup=family=>family==='B737-400'?'OH21_400':'OH21_300500';
function family(){
 if(requestedFamily)return requestedFamily;
 try{return JSON.parse(localStorage.getItem(PROFILE)||'null')?.aircraftFamily==='B737-400'?'B737-400':'B737-300-500'}
 catch{return 'B737-300-500'}
}
function save(node){if(!originals.has(node))originals.set(node,{style:node.getAttribute('style'),viewBox:node.getAttribute('viewBox'),transform:node.getAttribute('transform')});}
function restore(node){const was=originals.get(node);if(!was)return;if(was.style===null)node.removeAttribute('style');else node.setAttribute('style',was.style);if(was.viewBox!==null)node.setAttribute('viewBox',was.viewBox);if(was.transform!==null)node.setAttribute('transform',was.transform);originals.delete(node);}
const affected=new Set();function setstyle(node,properties){if(!node)return;save(node);affected.add(node);Object.assign(node.style,properties);}
function revert(){for(const node of affected)restore(node);affected.clear();layer?.remove();layer=null;active=null;detail=null;document.documentElement.removeAttribute('data-owner-oh21-photo');}
function fit(){const piece=host.querySelector('.atlas-piece[data-key="OH21"]');if(!piece||!detail)return null;
 const p={x:num(piece.style.left),y:num(piece.style.top),w:num(piece.style.width),h:num(piece.style.height)};
 if(!Object.values(p).every(Number.isFinite)||p.w<=0||p.h<=0)return null;
 const scale=Math.min(p.w/detail.width,p.h/detail.height);if(scale<=0)return null;
 return {x:p.x+(p.w-detail.width*scale)/2,y:p.y+(p.h-detail.height*scale)/2,w:detail.width*scale,h:detail.height*scale,scale};}
function circle(node,[x,y],fit,diameter=100){if(!node)return;
 const px=fit.x+x*fit.scale,py=fit.y+y*fit.scale,d=diameter*fit.scale;
 setstyle(node,{left:px+'px',top:py+'px',width:(d*1.65)+'px',height:(d*1.65)+'px'});
 const sprite=node.querySelector('.toggle-sprite');if(sprite)setstyle(sprite,{width:(d*1024/390)+'px',height:(d*1024/390)+'px'});
}
function relocateRect(node,[x,y,w,h],fit){if(!node)return;setstyle(node,{left:(fit.x+x*fit.scale)+'px',top:(fit.y+y*fit.scale)+'px',width:(w*fit.scale)+'px',height:(h*fit.scale)+'px'});}
function singleRecircAppearance(){
 if(!layer)return;
 layer.dataset.variant=active;
 layer.querySelectorAll('.oh21-single-recirc-removal,.oh21-single-recirc-title').forEach(el=>el.remove());
 if(active!=='OH21_300500')return;
 // The legacy blue 300/500 panel has been retired. Use the approved beige
 // source and remove ONLY its additional left fan/lettering cosmetically.
 // The existing 300/500 single-fan physical control remains authoritative.
 const cover=document.createElement('span');cover.className='oh21-single-recirc-removal';
 const title=document.createElement('span');title.className='oh21-single-recirc-title';
 title.textContent='RECIRC FAN';
 cover.setAttribute('aria-hidden','true');title.setAttribute('aria-hidden','true');
 layer.append(cover,title);
}
function place(){if(!active||!detail||!layer)return false;const f=fit();if(!f)return false;
 const recircTitle=layer.querySelector('.oh21-single-recirc-title');
 if(recircTitle)recircTitle.style.fontSize=(35*f.scale)+'px';
 // Atlas reassembly may detach a candidate after loading. Re-attach only this
 // optional photo layer, never modify any locked source image or atlas tile.
 if(layer.parentNode!==host)host.append(layer);
 Object.assign(layer.style,{left:f.x+'px',top:f.y+'px',width:f.w+'px',height:f.h+'px'});
 for(const [id,xy]of Object.entries(detail.controls)){
  if(id==='aircon-ovht-test'||id==='trip-reset'){
   const node=host.querySelector('.b737-recess-unit[data-recessed-id="'+id+'"]');if(node){const d=(id==='trip-reset'?105:100)*f.scale;setstyle(node,{left:(f.x+xy[0]*f.scale)+'px',top:(f.y+xy[1]*f.scale)+'px',width:d+'px',height:d+'px'});}continue;
  }
  const node=id==='recirc-fan-l'?document.getElementById('toggle-recirc-fan-l-400'):host.querySelector('.mounted-toggle[data-control="'+id+'"]');
  circle(node,xy,f,100);
 }
 for(const [id,rect]of Object.entries(detail.lights)){
  relocateRect(host.querySelector('.mounted-light[data-light="'+id+'"]'),rect,f);
 }
 const is400=active==='OH21_400';
 const labels=host.querySelectorAll('#aircon400Oh21Overlay .aircon400-recirculation-label, #aircon400Oh21Underlay');
 labels.forEach(node=>setstyle(node,{visibility:is400?'hidden':''}));
 if(is400){
  for(const side of ['L','R'])relocateRect(host.querySelector('.aircon400-pack-face[data-aircon-pack="'+side+'"]'),detail.lights['pack-trip-'+side.toLowerCase()],f);
 }
 const duct=host.querySelector('svg[data-duct-pressure-needles]');
 if(duct){
  setstyle(duct,{left:f.x+'px',top:f.y+'px',width:f.w+'px',height:f.h+'px'});
  save(duct);affected.add(duct);duct.setAttribute('viewBox',`0 0 ${detail.width} ${detail.height}`);
  for(const g of duct.querySelectorAll('g[transform^="translate("]')){
   const first=g.getAttribute('transform');
   if(!/translate\([^)]*\) scale\(/.test(first))continue;
   save(g);affected.add(g);g.setAttribute('transform',first.replace(/^translate\([^)]*\)/,`translate(${detail.gauge_pivots['duct-pressure'].join(' ')})`));
  }
 }
 document.documentElement.setAttribute('data-owner-oh21-photo',active);
 window.dispatchEvent(new CustomEvent('b737:owner-oh21-photo-registration',{detail:{version:'PHOTO-REG-20261030',asset:detail.file,family:active,fit:f}}));
 return true;
}
function show(asset,img){
 revert();active=desired;detail=asset;failed=false;
 layer=document.createElement('div');layer.className='owner-oh21-photo-layer-v1';
 layer.dataset.asset=asset.file;layer.dataset.photoState='approved';
 Object.assign(layer.style,{position:'absolute',zIndex:'62',pointerEvents:'none',overflow:'hidden',background:'#bec0b6'});
 Object.assign(img.style,{display:'block',width:'100%',height:'100%',maxWidth:'none',maxHeight:'none',objectFit:'fill',pointerEvents:'none'});img.draggable=false;
 layer.append(img);singleRecircAppearance();host.append(layer);place();}
async function sync(){
 if(!register)return;
 const next=photoGroup(family()),asset=register.panels[next];
 if(!asset||!['OH21_400','OH21_300500'].includes(next))
  throw Error('Only two current OH21 air-system variants are supported');
 if(next===active){place();return;}
 // Both supported layouts use the very same approved photographic source:
 // apply the 300/500 single-fan adaptation atomically with no image reload.
 if(layer&&detail?.file===asset.file){
  active=next;detail=asset;failed=false;singleRecircAppearance();place();return;
 }
 if(loading)return;
 desired=next;loading=true;const img=new Image();img.decoding='async';
 try{
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;
   img.src=target(asset)+'?v=OH21-APPROVED-20261103';});
  if(img.naturalWidth!==asset.width||img.naturalHeight!==asset.height)
   throw Error('Approved OH21 photo dimensions differ from manifest');
  if(photoGroup(family())!==next)return;
  show(asset,img);
 }catch(error){
  failed=true;revert();
  // Fail closed: no previously rejected blue photo may appear as a fallback.
  console.warn('Approved OH21 air-system photo unavailable; showing neutral blank',error);
  if(parent!==window)parent.postMessage({type:'b737:cockpit-overhead',
   kind:'oh21-photo-error',family:next,reason:'APPROVED_PHOTO_UNAVAILABLE'},location.origin);
 }finally{
  loading=false;
  if(register&&photoGroup(family())!==active&&!failed)queueMicrotask(sync);
 }
}
async function boot(){try{const r=await fetch(MANIFEST,{cache:'no-store'});if(!r.ok)throw Error('Registration manifest missing');register=await r.json();if(register.schema!=='b737.owner.photo.panel-registration/1')throw Error('Registration schema mismatch');
  await sync();
  const observer=new MutationObserver(()=>{if(active)requestAnimationFrame(place);else if(!loading)sync()});observer.observe(host,{childList:true,subtree:false});
  window.addEventListener('storage',e=>{if(e.key===PROFILE){requestedFamily=null;sync()}});
  window.addEventListener('message',e=>{
   if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='b737:cockpit-command'
    ||e.data.action!=='aircon-background')return;
   if(['B737-400','B737-300-500'].includes(e.data.family)){
    requestedFamily=e.data.family;sync();
   }
  });
  // Hardware is mounted by multiple independent async modules; retry placement,
  // not loading, so every existing owner control is eventually registered.
  setInterval(()=>{if(photoGroup(family())!==active){if(!failed)sync()}else place()},950);
 }catch(error){failed=true;console.warn('OH21 registry unavailable; neutral blank retained rather than rejected photo',error)}}
window.B737OH21OwnerPhotoV1=Object.freeze({status:()=>({active,asset:detail?.file||null,loaded:!!layer?.isConnected,failed,version:'OH21-APPROVED-ONLY-20261103',panel:detail?.layout||null}),refresh:()=>{failed=false;return sync()},restore:revert});
boot();
})();