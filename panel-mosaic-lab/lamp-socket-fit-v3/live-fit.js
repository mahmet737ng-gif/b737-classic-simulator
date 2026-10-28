/* LGT-SOCKET-FIT-003 — OPT-IN, non-destructive per-socket lens fitting.
   Enable only with ?socketFit=1. Does not change approved photos,
   sourceRect, electrical rules, lens master typography or guards. */
(function(win){
'use strict';
const query=new URLSearchParams(win.location.search);
let opted=query.get('socketFit')==='1';
try { opted=opted||(win.parent!==win&&new URLSearchParams(win.parent.location.search).get('socketFit')==='1'); } catch(_){}
if(!opted)return;
const script=document.currentScript.src;
const root=new URL('../',script);
const json=async path=>{
 const r=await fetch(new URL(path,root),{cache:'no-store'});
 if(!r.ok)throw Error('SocketFit registry '+path+' HTTP '+r.status);
 return r.json();
};
const masterRoot=new URL('lights-reference-v2/',root);
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
let padRequested=query.get('fitPad');
try { if(!padRequested&&win.parent!==win)padRequested=new URLSearchParams(win.parent.location.search).get('fitPad'); }catch(_){}
const maxPad=clamp(padRequested===null?2.5:Number(padRequested),0,6);
const pageScope=win.location.pathname.includes('/interactive-overhead/')?'OH':'MP';
const own=new Map(), records=new Map(), nodes=new Map(), pending=new Map();
const sourceCache=new Map(), blobURLs=new Map(), errors=[];
let manifest, ready=false, mounts=0, renders=0, retries=0;
let scanPending=false, listener=null;
const keyOf=r=>r.bank==='OH'?(r.placementId==='OH07'||r.placementId==='OH08'?'OH07-08':r.placementId):r.pieceId;
function boundedRect(row){
 const [x,y,w,h]=row.sourceRect;
 const p={l:Math.min(maxPad,x),r:maxPad,t:Math.min(maxPad,y),b:maxPad};
 for(const other of records.values()){
  if(other===row||other.bank!==row.bank||other.photo!==row.photo)continue;
  const [X,Y,W,H]=other.sourceRect;
  if(y<Y+H&&Y<y+h){
   if(X>=x+w)p.r=Math.min(p.r,Math.max(0,(X-x-w)*0.5-0.2));
   if(X+W<=x)p.l=Math.min(p.l,Math.max(0,(x-X-W)*0.5-0.2));
  }
  if(x<X+W&&X<x+w){
   if(Y>=y+h)p.b=Math.min(p.b,Math.max(0,(Y-y-h)*0.5-0.2));
   if(Y+H<=y)p.t=Math.min(p.t,Math.max(0,(y-Y-H)*0.5-0.2));
  }
 }
 return {x:x-p.l,y:y-p.t,w:w+p.l+p.r,h:h+p.t+p.b,p};
}
function shapeFit(svgText,shape){
 const doc=new DOMParser().parseFromString(svgText,'image/svg+xml');
 if(doc.querySelector('parsererror'))throw Error('Malformed source SVG');
 const s=doc.documentElement,v=(s.getAttribute('viewBox')||'').split(/\s+/).map(Number);
 const oldW=v[2],oldH=v[3],newW=oldH*shape.w/shape.h;
 if(!(oldW>0&&oldH>0&&newW>65&&newW<2300))throw Error('Invalid lens aspect');
 const dx=(newW-oldW)/2;
 // Resize ONLY the structural rectangles. Font, letters and all original
 // luminous vector groups remain the same original nodes.
 for(const r of s.querySelectorAll('rect')){
  const x=Number(r.getAttribute('x')||0),w=Number(r.getAttribute('width'));
  if(!Number.isFinite(w))continue;
  const right=oldW-x-w;
  r.setAttribute('width',String(Math.max(1,newW-x-right)));
 }
 for(const t of s.querySelectorAll('text')){
  if(t.hasAttribute('x'))t.setAttribute('x',String(Number(t.getAttribute('x'))+dx));
 }
 // Existing typeface, font-size, kerning and baselines are untouched.
 // If a narrower REAL aperture requires it, scale full text groups
 // uniformly; never stretch their letters horizontally.
 let maxText=0;
 const cvs=document.createElement('canvas'),ctx=cvs.getContext('2d');
 for(const t of s.querySelectorAll('text')){
  const group=t.parentElement,fs=Number(t.getAttribute('font-size')||'95');
  ctx.font='700 '+fs+'px "Liberation Sans Narrow", "Arial Narrow", Arial';
  const width=ctx.measureText(t.textContent||'').width+(t.textContent||'').length*1.2;
  maxText=Math.max(maxText,width);
 }
 const safeWidth=newW-45;
 const scalar=maxText>safeWidth?clamp(safeWidth/maxText,0.48,1):1;
 if(scalar<1){
  for(const g of s.querySelectorAll('g')){
   if(!g.querySelector('text'))continue;
   const before=g.getAttribute('transform')||'';
   const transform='translate('+newW/2+' '+oldH/2+') scale('+scalar+') translate('+(-newW/2)+' '+(-oldH/2)+')';
   g.setAttribute('transform',(before+' '+transform).trim());
  }
 }
 s.setAttribute('viewBox','0 0 '+newW.toFixed(4)+' '+oldH);
 s.setAttribute('width',String(newW));
 s.setAttribute('height',String(oldH));
 return new XMLSerializer().serializeToString(s);
}
function masterState(frame){
 const mode=win.B737LampAppearance?.getMode?.()||'BRIGHT';
 const x=frame==='FLASH'?'ON':frame==='UNKNOWN'?'OFF':frame;
 return [x,mode];
}
async function face(row,frame){
 const [state,mode]=masterState(frame);
 const mid=manifest.sourceAssetToMaster[row.bank+':'+row.asset];
 const master=manifest.masters.find(m=>m.id===mid);
 if(!master)throw Error('Missing master '+row.bank+':'+row.asset);
 const selector=manifest.mapping[state]?.[mode]||(state==='OFF'?'OFF':mode);
 const asset=master.assets[selector];
 if(!asset)throw Error('Missing master state '+mid+' '+selector);
 const shape=boundedRect(row),slotRatio=(shape.w/shape.h).toFixed(6);
 const faceKey=mid+'|'+selector+'|'+slotRatio;
 if(blobURLs.has(faceKey))return {url:blobURLs.get(faceKey),shape,selector};
 const url=new URL(asset,masterRoot).href;
 if(!sourceCache.has(url)){
  const r=await fetch(url,{cache:'force-cache'});
  if(!r.ok)throw Error('Missing master SVG '+url);
  sourceCache.set(url,await r.text());
 }
 const svg=shapeFit(sourceCache.get(url),shape);
 const blob=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 blobURLs.set(faceKey,blob);
 return {url:blob,shape,selector};
}
async function update(id){
 const obj=nodes.get(id),row=records.get(id);
 if(!obj||!row)return;
 const frame=obj.node.dataset.frame||'OFF';
 const mode=win.B737LampAppearance?.getMode?.()||'BRIGHT';
 const sig=frame+'|'+mode;
 if(obj.signature===sig)return;
 obj.signature=sig;
 const token=++obj.serial;
 try{
  const r=await face(row,frame);
  if(token!==obj.serial)return;
  const [ox,oy,ow,oh]=row.sourceRect;
  const fx=(parseFloat(obj.node.style.width)||obj.node.offsetWidth)/ow;
  const fy=(parseFloat(obj.node.style.height)||obj.node.offsetHeight)/oh;
  const p=r.shape.p;
  Object.assign(obj.img.style,{
   left:(-p.l*fx)+'px',top:(-p.t*fy)+'px',
   width:(r.shape.w*fx)+'px',height:(r.shape.h*fy)+'px'
  });
  if(obj.img.src!==r.url)obj.img.src=r.url;
  obj.img.hidden=false;
  obj.node.dataset.socketFitState=r.selector;
  obj.node.dataset.socketFitApplied='true';
  renders++;
 }catch(error){
  if(token!==obj.serial)return;
  obj.img.hidden=true;
  obj.signature='';
  if(errors.length<25)errors.push({id,error:String(error.message||error)});
  console.warn('LGT-SOCKET-FIT-003',id,error);
 }
}
function attach(row,node){
 if(nodes.has(row.id))return;
 const img=document.createElement('img');
 img.className='lamp-socket-fit-face';
 img.dataset.socketFit='v3';
 img.alt='';img.draggable=false;
 img.style.cssText='position:absolute;display:block;pointer-events:none;object-fit:fill!important;max-width:none!important;max-height:none!important;z-index:16;margin:0;border:0;padding:0;user-select:none;';
 img.hidden=true;
 node.style.setProperty('overflow','visible','important');
 node.appendChild(img);
 const o={node,img,serial:0,signature:''};
 nodes.set(row.id,o);mounts++;
 const observer=new MutationObserver(()=>update(row.id));
 observer.observe(node,{attributes:true,attributeFilter:['data-frame']});
 o.observer=observer;
 update(row.id);
}
function scan(){
 scanPending=false;
 if(!ready)return;
 for(const node of document.querySelectorAll('.mounted-light[data-light],.cockpit-light[data-cockpit-light]')){
  const id=node.dataset.light||node.dataset.cockpitLight,row=records.get(id);
  if(row)attach(row,node);
 }
 if(!nodes.size&&retries++<35)setTimeout(scan,300);
}
function scheduleScan(){
 if(!scanPending){scanPending=true;requestAnimationFrame(scan);}
}
async function start(){
 try{
  const arr=await Promise.all([
   json('interactive-overhead/lights.json'),
   json('cockpit/lights.json'),
   json('lights-reference-v2/manifest.json')
  ]);
  const [oh,mp,m]=arr;manifest=m;
  if(m.schema!=='b737.classic.annunciator.global-dimmer.v2')throw Error('Unexpected master manifest');
  for(const [bank,data] of [['OH',oh],['MP',mp]]){
   for(const original of data.lights){
    const row={...original,bank,photo:keyOf({...original,bank})};
    if(records.has(row.id))throw Error('Duplicate lamp socket '+row.id);
    records.set(row.id,row);
   }
  }
  if(oh.lights.length!==112||mp.lights.length!==30||records.size!==142)throw Error('Unexpected source socket count');
  for(const row of records.values()){
   const a=boundedRect(row);
   if(a.w<=0||a.h<=0)throw Error('Invalid fit rect '+row.id);
   own.set(row.id,a);
  }
  ready=true;
  document.addEventListener('b737:socket-fit-request-refresh',scheduleScan);
  win.addEventListener('b737:cockpit-lights-ready',scheduleScan);
  win.addEventListener('b737:overhead-light-state',scheduleScan);
  win.addEventListener('b737:lamp-brightness-change',()=>{
   for(const id of nodes.keys())update(id);
  });
  const watch=new MutationObserver(scheduleScan);
  watch.observe(document.body,{childList:true,subtree:true});
  scheduleScan();
  setTimeout(()=>{watch.disconnect();scheduleScan();},12000);
  win.B737SocketFit=Object.freeze({
   status:()=>({opted:true,sourceCount:records.size,scope:pageScope,
     expectedLocal:pageScope==='OH'?112:30,mounted:mounts,renders,
     errors:[...errors],unmounted:[...records.values()].filter(r=>r.bank===pageScope&&!nodes.has(r.id)).map(r=>r.id),
     maxPad,mode:win.B737LampAppearance?.getMode?.()||'BRIGHT'}),
   bounds:id=>own.get(id)||null,
   refresh:()=>{for(const id of nodes.keys()){nodes.get(id).signature='';update(id);}scheduleScan();}
  });
 }catch(error){console.error('LGT-SOCKET-FIT-003 init:',error);}
}
start();
})(window);
