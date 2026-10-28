/* LGT-VARIANTS-FIT-001
   2.5 source-photo-pixel bezel extension for OH22 CPCS/DCPCS,
   B737-400 OH20 zone cautions and OH21 PACKs.
   Optical only: neither protected panel images nor their native controls,
   sensors, originals or system logic are edited. */
(function(win){
'use strict';
const q=new URLSearchParams(location.search);
let disabled=q.get('socketFit')==='0';
try{if(parent!==win)disabled=disabled||new URLSearchParams(parent.location.search).get('socketFit')==='0';}catch(_){}
if(disabled)return;
const script=document.currentScript.src,root=new URL('../',script);
const photoPad=2.5,profiles=new WeakMap(),sourceCache=new Map(),derived=new Map();
const errors=[],groups={DCPCS:0,CPCS:0,OH20_400:0,OH21_400:0};
let manifest=null,ready=false,scheduled=false,scans=0,changed=0;
const getJSON=async p=>{const r=await fetch(new URL(p,root),{cache:'no-store'});if(!r.ok)throw Error('Variant fit data HTTP '+r.status);return r.json()};
const builtIn={
 'auto-fail':{asset:'AUTO_FAIL'},'off-sched':{asset:'OFF_SCHED_DESCENT'},
 standby:{asset:'STANDBY_GREEN'},manual:{asset:'MANUAL_GREEN'},
 altn:{asset:'STANDBY_GREEN',label:['ALTN']}
};
function variant(row){
 const n=row.node;
 if(row.kind==='OH22'){
  const system=n.closest('.oh22-pressure-controls')?.dataset.system;
  const model=win.B737OH22PressureModel,cfg=model?.config(system),g=cfg?.lamps.find(l=>l.id===n.dataset.lamp);
  if(!g)return null;
  const plate=document.querySelector('#atlasAbsolute .atlas-piece[data-key="OH22"]');
  const photo=system==='DCPCS'?
   plate?.querySelector('.dcpcs-owner-oh22-background img'):
   plate?.querySelector('.atlas-image-window img');
  // On the DCPCS replacement, never substitute the CPCS photo dimensions.
  if(!photo?.naturalWidth||!photo?.naturalHeight)return null;
  const face=g.face,fit=cfg.lampFit;
  const width=Math.max(1,n.offsetWidth),height=Math.max(1,n.offsetHeight);
  const dx=photoPad*width/(face[2]*photo.naturalWidth*fit.x);
  const dy=photoPad*height/(face[3]*photo.naturalHeight*fit.y);
  const entry=builtIn[n.dataset.lamp];
  return {bank:'OH',asset:entry.asset,lines:entry.label||null,
   name:system+'-'+n.dataset.lamp,srcW:face[2]*photo.naturalWidth,srcH:face[3]*photo.naturalHeight,
   dx,dy,group:system,lit:n.dataset.lit==='true',dimensionKey:photo.naturalWidth+'x'+photo.naturalHeight};
 }
 if(row.kind==='OH20'){
  const model=win.B737Aircon400Model,l=model?.lamps.find(l=>l.id===n.dataset.airconLamp);
  if(!l)return null;
  const dx=photoPad*n.offsetWidth/l.rect[2],dy=photoPad*n.offsetHeight/l.rect[3];
  return {bank:'OH',asset:'AUTO_FAIL',lines:['ZONE','TEMP'],name:l.id,
   srcW:l.rect[2],srcH:l.rect[3],dx,dy,group:'OH20_400',lit:n.dataset.state==='ON',dimensionKey:'1122x1402'};
 }
 if(row.kind==='OH21'){
  const model=win.B737Aircon400Oh21Model,l=model?.packs.find(l=>l.side===n.dataset.airconPack);
  if(!l)return null;
  const dx=photoPad*n.offsetWidth/l.rect[2],dy=photoPad*n.offsetHeight/l.rect[3];
  return {bank:'OH400',asset:'PACK_FITTED',lines:null,name:l.id,
   srcW:l.rect[2],srcH:l.rect[3],dx,dy,group:'OH21_400',lit:n.dataset.state==='ON',dimensionKey:'1122x1402'};
 }
 return null;
}
function stateFor(cfg){
 const global=win.B737LampAppearance?.getMode?.()||'BRIGHT';
 return cfg.lit?(global==='DIM'?'DIM':'BRIGHT'):'OFF';
}
function makeSVG(xml,targetRatio,lines){
 const doc=new DOMParser().parseFromString(xml,'image/svg+xml');
 if(doc.querySelector('parsererror'))throw Error('Invalid SVG master');
 const s=doc.documentElement,v=(s.getAttribute('viewBox')||'').split(/\s+/).map(Number);
 const [,,w,h]=v,W=Math.round(h*targetRatio*1e5)/1e5;
 if(!(w>0&&h>0&&W>50&&W<2500))throw Error('Bad variant viewBox');
 if(lines){
  for(const g of s.querySelectorAll('g')){
   const texts=[...g.children].filter(x=>x.localName==='text');
   if(texts.length===lines.length)texts.forEach((t,i)=>t.textContent=lines[i]);
  }
 }
 // Preserve all original glyph proportions, fonts, sizing, luminous palettes and vertical baselines.
 const dx=(W-w)/2;
 for(const r of s.querySelectorAll('rect')){
  const x=Number(r.getAttribute('x')||0),width=Number(r.getAttribute('width'));
  if(!Number.isFinite(width))continue;
  const remain=w-x-width;
  r.setAttribute('width',String(Math.max(1,W-x-remain)));
 }
 for(const t of s.querySelectorAll('text')){
  if(t.hasAttribute('x'))t.setAttribute('x',String(Number(t.getAttribute('x'))+dx));
 }
 s.setAttribute('viewBox','0 0 '+W+' '+h);
 s.setAttribute('width',W);s.setAttribute('height',h);
 return new XMLSerializer().serializeToString(s);
}
async function getFace(cfg){
 const id=manifest.sourceAssetToMaster[cfg.bank+':'+cfg.asset]||
  manifest.variantAliases?.[cfg.bank+':'+cfg.asset];
 const master=manifest.masters.find(m=>m.id===id);
 if(!master)throw Error('No approved master: '+cfg.bank+':'+cfg.asset);
 const state=stateFor(cfg),source=master.assets[state];
 if(!source)throw Error('Missing master mode '+id+'/'+state);
 const aspect=(cfg.srcW+5)/(cfg.srcH+5);
 const key=id+'|'+state+'|'+aspect.toFixed(7)+'|'+(cfg.lines||[]).join('/');
 if(derived.has(key))return derived.get(key);
 const url=new URL(source,new URL('lights-reference-v2/',root));
 if(!sourceCache.has(url.href)){
  const r=await fetch(url,{cache:'force-cache'});
  if(!r.ok)throw Error('Missing master '+url.href);
  sourceCache.set(url.href,await r.text());
 }
 const xml=makeSVG(sourceCache.get(url.href),aspect,cfg.lines);
 const blob=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'}));
 derived.set(key,blob);return blob;
}
async function refresh(row,force){
 if(!row.node.isConnected)return;
 const cfg=variant(row);
 if(!cfg){row.sig='';return}
 const mode=stateFor(cfg);
 const sig=[cfg.group,cfg.name,mode,cfg.dimensionKey,cfg.dx.toFixed(5),cfg.dy.toFixed(5)].join('|');
 if(!force&&row.sig===sig)return;
 row.sig=sig;const token=++row.token;
 try{
  const src=await getFace(cfg);
  if(token!==row.token||!row.node.isConnected)return;
  const W=row.node.offsetWidth,H=row.node.offsetHeight;
  Object.assign(row.image.style,{
    left:-cfg.dx+'px',top:-cfg.dy+'px',
    width:W+2*cfg.dx+'px',height:H+2*cfg.dy+'px'
  });
  row.image.src=src;row.image.hidden=false;
  row.node.dataset.variantFit='2.5';
  changed++;
 }catch(e){
  if(token!==row.token)return;
  row.sig='';row.image.hidden=true;
  if(errors.length<20)errors.push({lamp:cfg.name,error:String(e.message||e)});
  console.error('LGT-VARIANTS-FIT-001',cfg.name,e);
 }
}
function attach(node,kind){
 if(profiles.has(node))return;
 const image=document.createElement('img');
 image.className='b737-special-lamp-fit-v1';image.alt='';image.draggable=false;image.hidden=true;
 image.style.cssText='position:absolute!important;display:block!important;object-fit:fill!important;pointer-events:none!important;max-width:none!important;max-height:none!important;opacity:1!important;z-index:10!important;margin:0!important;padding:0!important;border:0!important;';
 node.style.setProperty('overflow','visible','important');
 node.append(image);
 const row={node,kind,image,sig:'',token:0};profiles.set(node,row);
 const attr=kind==='OH22'?'data-lit':'data-state';
 const watch=new MutationObserver(()=>refresh(row,false));
 watch.observe(node,{attributes:true,attributeFilter:[attr]});
 row.watch=watch;
 refresh(row,true);
}
function scan(){
 scheduled=false;if(!ready)return;scans++;
 for(const node of document.querySelectorAll('.oh22-pressure-controls [data-role="lamp"][data-lamp]'))
  attach(node,'OH22');
 for(const node of document.querySelectorAll('.aircon400-layer .aircon400-zone-lamp[data-aircon-lamp]'))
  attach(node,'OH20');
 for(const node of document.querySelectorAll('.aircon400-oh21-layer .aircon400-pack-face[data-aircon-pack]'))
  attach(node,'OH21');
}
function schedule(){
 if(!scheduled){scheduled=true;requestAnimationFrame(scan)}
}
(async()=>{
 try{
  await win.B737LampAppearance?.ready;
  manifest=await getJSON('lights-reference-v2/manifest.json');
  if(manifest.masters.length!==87)throw Error('Unexpected owner-approved lamp masters');
  ready=true;
  const watch=new MutationObserver(schedule);
  watch.observe(document.getElementById('atlasAbsolute'),{childList:true,subtree:true});
  // DCPCS owner photo is loaded asynchronously. Native width/height become
  // valid on the image load event (not on a childList mutation).
  document.addEventListener('load',event=>{
   if(event.target?.matches?.('.atlas-image-window img,.dcpcs-owner-oh22-background img'))schedule();
  },true);
  win.addEventListener('b737:lamp-brightness-change',()=>{
   for(const node of document.querySelectorAll('.b737-special-lamp-fit-v1')){
    const holder=node.parentElement,row=profiles.get(holder);
    if(row)refresh(row,true);
   }
  });
  win.B737VariantSocketFit=Object.freeze({status:()=>({
   configuredPhotoPadding:photoPad,
   scanned:scans,
   mounted:{
    DCPCS:document.querySelectorAll('.oh22-pressure-controls[data-system="DCPCS"] [data-variant-fit="2.5"]').length,
    CPCS:document.querySelectorAll('.oh22-pressure-controls[data-system="CPCS"] [data-variant-fit="2.5"]').length,
    OH20_400:document.querySelectorAll('.aircon400-layer [data-variant-fit="2.5"]').length,
    OH21_400:document.querySelectorAll('.aircon400-oh21-layer [data-variant-fit="2.5"]').length
   },renders:changed,errors:[...errors]})});
  schedule();
 }catch(e){console.error('LGT-VARIANTS-FIT-001 startup',e)}
})();
})(window);
