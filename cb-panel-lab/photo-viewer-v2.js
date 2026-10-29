/* B737 Classic CB wall: MRG aft-cockpit order; vector faces use the photo-transcribed
 * catalogue. Indexed placeholders intentionally have no invented breakers.
 * Presentation-only replacement: the existing BreakerNetwork snapshot remains authoritative.
 */
(function(){'use strict';
const catalog=window.CB_CATALOG,Kernel=window.B737_CB_Kernel;
if(!catalog||!Kernel)throw Error('CB wall requires catalogue and breaker kernel');
const STORAGE='b737classic.cb.v1',PROFILE='b737classic.aircraft-profile.v1';
const SCENE={width:4600,height:4820};
const POSITIONS=[
 ['P6-1',490,110,1320,910],['P6-2',490,1050,1320,630],
 ['P6-3',490,1710,1320,1100],['P6-4',490,2835,1320,1180],
 ['P6-5',100,3250,345,320],['P6-6',180,1785,210,895],
 ['P6-12',490,4040,645,748],['P6-11',1165,4040,645,748],
 ['P18-1',3210,400,720,985],
 ['P18-2',2840,1425,1180,965],['P18-3',2840,2430,1280,940]
].map(([id,x,y,w,h])=>({id,x,y,w,h}));
const ALIASES={
 'P6-11|B9':['WINDOW HEAT L FWD','LEFT FORWARD WINDOW HEAT','L1 HEAT'],
 'P6-11|B8':['WINDOW HEAT R SIDE','RIGHT SIDE WINDOW HEAT','R2 HEAT'],
 'P6-12|B9':['WINDOW HEAT L SIDE','LEFT SIDE WINDOW HEAT','L2 HEAT'],
 'P6-12|B8':['WINDOW HEAT R FWD','RIGHT FORWARD WINDOW HEAT','R1 HEAT'],
 'P6-11|B7':['WINDOW L4 L5','LEFT WINDOW 4 5'],
 'P6-12|B7':['WINDOW R4 R5','RIGHT WINDOW 4 5']
};
const $=id=>document.getElementById(id);
const viewport=$('cbViewport'),scene=$('cbScene'),panelLayer=$('cbPanels'),search=$('cbSearch'),findBtn=$('cbFind'),status=$('cbSrStatus');
const panelDefinitions=new Map(catalog.panels.map(p=>[p.id,p]));
const PHOTO=window.CB_PHOTO_GEOMETRY?.panels;
if(!PHOTO)throw Error('Missing surveyed photo geometry');
const panels=new Map(),records=[],pointers=new Map();
const network=new Kernel.BreakerNetwork(catalog);
let saved=null;try{saved=JSON.parse(localStorage.getItem(STORAGE)||'null');if(saved)network.restore(saved);}catch{}
function currentVariant(){
 try{const a=JSON.parse(localStorage.getItem(PROFILE)||'{}');if(a.pressurization==='DCPCS'||a.pressurization==='CPCS')return a.pressurization;}catch{}
 return saved?.variant==='DCPCS'?'DCPCS':saved?.variant==='CPCS'?'CPCS':network.variant;
}
if(currentVariant()!==network.variant)network.setVariant(currentVariant());
const camera={scale:1,x:0,y:0},gestures={dragged:false,gesture:null},ui={active:null,lastQuery:'',matches:[],matchIndex:-1,animation:0,touched:false},panelByButton=new WeakMap();
let fittedScale=1,lastWidth=0,lastHeight=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function emitStatus(s){status.textContent=s;}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(network.snapshot()));}catch{}}
function parseEntries(value){return String(value||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const z=x.split('|'),c=z[0].split(':');return {position:c[0],rating:Number(c[1]),label:(z[1]||'').trim()};});}
function getBreakers(p){if(p.id!=='P6-4')return parseEntries(p.breakers);const base=parseEntries(p.breakers);return network.variant==='DCPCS'?base.filter(x=>!/^F[1-6]$/.test(x.position)).concat(parseEntries(p.altBreakers)):base;}
function keyFor(p,position){return Kernel.keyFor(p.id,position,network.variant);}
function getBreakerState(key){return network.state(key);}
function syncButton(btn){const b=getBreakerState(btn.dataset.key);if(!b)return;const pulled=b.pulled||b.tripped;btn.classList.toggle('pulled',pulled);btn.setAttribute('aria-pressed',String(pulled));btn.setAttribute('aria-label',btn.dataset.label+' — '+(pulled?'PULLED':'PUSHED'));}

/* Image-based panels. Only the original surveyed inner-circle coordinates can be
 * controls on the photo. A mismatched catalogue address must never be guessed. */
function photoCrop(p){
 const meta=PHOTO[p.id],a=meta.roi,pts=meta.breakers;
 const x0=Math.min(a[0],...pts.map(b=>b.x-b.r-3));
 const y0=Math.min(a[1],...pts.map(b=>b.y-b.r-3));
 const x1=Math.max(a[2],...pts.map(b=>b.x+b.r+3));
 const y1=Math.max(a[3],...pts.map(b=>b.y+b.r+3));
 return {x0,y0,w:x1-x0,h:y1-y0};
}
function geometryFor(p,item){
 const points=PHOTO[p.id]?.breakers||[];
 if(p.id==='P6-4'&&network.variant==='DCPCS'&&/^F[1-5]$/.test(item.position))
   return points.find(b=>b.id==='G'+item.position.slice(1));
 return points.find(b=>b.id===item.position&&b.configuration!=='DCPCS');
}
function buttonFor(p,item,rec,face,rect,g,unverified){
 const btn=document.createElement('button');btn.type='button';btn.className='cb-knob'+(unverified?' cb-unknown':'');
 const key=unverified?'PHOTO|'+p.id+'|'+item.position:keyFor(p,item.position);
 btn.dataset.key=key;btn.dataset.label=p.id+' '+item.position+' '+item.label;
 btn.title=p.id+' '+item.position+' · '+item.label+(unverified?' · Photo point, identity not verified':' · '+item.rating+'A');
 btn.setAttribute('aria-label',btn.title);
 const head=document.createElement('span');head.className='cb-head';
 head.textContent=unverified?'?':String(item.rating).replace('.5','½');btn.append(head);
 let x=rect.x+rect.w/2,y=rect.y+rect.h/2;
 if(g){
   const crop=rect.crop,fw=rect.w-16,fh=rect.h-57;
   const u=(g.x-crop.x0)/crop.w,v=(g.y-crop.y0)/crop.h;
   const diameter=Math.max(9,2*g.r*Math.min(fw/crop.w,fh/crop.h));
   btn.style.cssText='left:'+(u*100)+'%;top:'+(v*100)+'%;width:'+diameter+'px;height:'+diameter+'px;';
   x=rect.x+8+u*fw;y=rect.y+46+v*fh;
   face.append(btn);
 } else {
   btn.classList.add('cb-unlocated');
   btn.textContent=item.position;
   rect.missing.append(btn);
   x=rect.x+rect.w/2;y=rect.y+rect.h-16;
 }
 const alias=(ALIASES[p.id+'|'+item.position]||[]).join(' ');
 const record={panelId:p.id,position:item.position,key,label:item.label,rating:item.rating,
   x,y,button:btn,panel:rect,unverified:!!unverified,searchable:normalize([p.id,item.position,item.label,alias].join(' '))};
 records.push(record);panelByButton.set(btn,record);
 if(!unverified)syncButton(btn);
 btn.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(record);}});
 return btn;
}
function mount(){
 panelLayer.replaceChildren();panels.clear();records.length=0;
 for(const base of POSITIONS){
  const p=panelDefinitions.get(base.id),meta=PHOTO[base.id];
  if(!p||!meta)continue;
  const rect={...base,crop:photoCrop(p)},node=document.createElement('section');
  rect.node=node;rect.missing=document.createElement('div');
  node.className='cb-panel cb-photo-panel';node.dataset.panel=p.id;
  node.style.cssText='left:'+rect.x+'px;top:'+rect.y+'px;width:'+rect.w+'px;height:'+rect.h+'px';
  const heading=document.createElement('div');heading.className='panel-head';
  const number=document.createElement('strong');number.textContent=p.id;heading.append(number);
  const info=document.createElement('small');info.textContent=p.title;heading.append(info);node.append(heading);
  const face=document.createElement('div');face.className='panel-face photo-face';
  const canvas=document.createElement('canvas');canvas.className='cb-photo-canvas';
  canvas.setAttribute('aria-label',p.id+' original reference photo');face.append(canvas);
  const path='./assets/mrg-reference/'+p.id.toLowerCase()+'.'+(p.id==='P6-6'?'png':'jpg');
  const img=new Image();img.decoding='async';
  img.onload=()=>{const c=rect.crop;canvas.width=Math.round(c.w);canvas.height=Math.round(c.h);
     const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(img,c.x0,c.y0,c.w,c.h,0,0,canvas.width,canvas.height);};
  img.onerror=()=>{face.dataset.photoError='true';emitStatus('Reference photo unavailable: '+p.id);};
  img.src=path;
  rect.missing.className='cb-unlocated-list';rect.missing.title='Catalogue address without a verified photo center';
  node.append(face,rect.missing);panels.set(p.id,rect);
  const loc=new Set();
  for(const item of getBreakers(p)){const g=geometryFor(p,item);
    if(g)loc.add(g.id);
    buttonFor(p,item,null,face,rect,g,false);
  }
  // A photographed circle with no matching catalogue entry remains read-only.
  for(const g of meta.breakers){
   if(p.id==='P6-4'){
    if(network.variant==='DCPCS'&&/^F[1-6]$/.test(g.id))continue;
    if(network.variant!=='DCPCS'&&g.configuration==='DCPCS')continue;
   }
   if(loc.has(g.id))continue;
   buttonFor(p,{position:g.id,label:'UNIDENTIFIED PHOTO POSITION',rating:null},null,face,rect,g,true);
  }
  if(!rect.missing.childNodes.length)rect.missing.remove();
  else{
    const badge=document.createElement('span');badge.className='unlocated-count';
    badge.textContent='Unverified catalogue locations · '+rect.missing.children.length;
    rect.missing.prepend(badge);
  }
  panelLayer.append(node);
 }
}

function normalize(s){return String(s||'').toUpperCase().replace(/[\u064A\u0649]/g,'ی').replace(/[\u0660-\u0669]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^A-Z0-9\u0600-\u06FF]+/g,' ').replace(/\s+/g,' ').trim();}
function matchScore(rec,q){
 const label=normalize(rec.label),key=normalize(rec.panelId+' '+rec.position);
 if(q===key||q===label)return 100;
 if(label.startsWith(q))return 85;
 if(key.startsWith(q))return 80;
 if(rec.searchable.includes(q))return 65;
 const words=q.split(' ');return words.every(w=>rec.searchable.includes(w))?40:0;
}
function searchResults(query){const q=normalize(query);if(!q)return [];return records.map(rec=>({rec,score:matchScore(rec,q)})).filter(v=>v.score>0).sort((a,b)=>b.score-a.score||a.rec.panelId.localeCompare(b.rec.panelId)||a.rec.position.localeCompare(b.rec.position)).map(x=>x.rec);}
// Four synchronized ON/OFF pulses; only the amber border and CB ring blink.
const FLASH_COUNT=4,FLASH_MS=500;
let flashTimer=0,flashGeneration=0;
function clearResult(){
 flashGeneration++;
 if(flashTimer){clearTimeout(flashTimer);flashTimer=0;}
 if(ui.active){
  ui.active.panel.node.classList.remove('is-result','cb-flashing');
  ui.active.button.classList.remove('is-hit','cb-flashing');
  ui.active=null;
 }
}
function highlight(rec){clearResult();ui.active=rec;rec.panel.node.classList.add('is-result');rec.button.classList.add('is-hit');}
function blinkFour(rec){
 if(ui.active!==rec)return;
 const generation=++flashGeneration;
 // Restart the four cycles reliably even when the same CB is searched again.
 void rec.button.offsetWidth;
 rec.panel.node.classList.add('cb-flashing');
 rec.button.classList.add('cb-flashing');
 flashTimer=setTimeout(()=>{
  if(generation===flashGeneration&&ui.active===rec)clearResult();
 },FLASH_COUNT*FLASH_MS+24);
}
function minFit(){return Math.min(viewport.clientWidth/(SCENE.width+140),viewport.clientHeight/(SCENE.height+130))*.97;}
function renderCamera(){scene.style.transform='translate3d('+camera.x.toFixed(3)+'px,'+camera.y.toFixed(3)+'px,0) scale('+camera.scale.toFixed(6)+')';}
function boundCamera(){
 const vw=viewport.clientWidth,vh=viewport.clientHeight,visibleX=vw*.12,visibleY=vh*.12;
 camera.x=clamp(camera.x,visibleX-SCENE.width*camera.scale,vw-visibleX);
 camera.y=clamp(camera.y,visibleY-SCENE.height*camera.scale,vh-visibleY);
}
function stopAnimation(){if(ui.animation){cancelAnimationFrame(ui.animation);ui.animation=0;}}
function fit(){stopAnimation();fittedScale=minFit();camera.scale=fittedScale;camera.x=(viewport.clientWidth-SCENE.width*fittedScale)/2;camera.y=(viewport.clientHeight-SCENE.height*fittedScale)/2;boundCamera();renderCamera();}
function focus(rec,onArrival){
 stopAnimation();clearResult();
 const vw=viewport.clientWidth,vh=viewport.clientHeight,p=rec.panel;
 const fitScale=minFit(),targetScale=clamp(Math.min(vw/(p.w*1.10),vh/(p.h*1.65)),fitScale*1.48,1.55);
 const targetX=rec.x*.78+(p.x+p.w*.5)*.22,targetY=rec.y*.78+(p.y+p.h*.5)*.22;
 const startScale=camera.scale,startX=(vw*.5-camera.x)/startScale,startY=(vh*.5-camera.y)/startScale;
 const start=performance.now(),duration=850;
 function frame(now){
  const t=clamp((now-start)/duration,0,1),ease=.5-.5*Math.cos(Math.PI*t);
  camera.scale=Math.exp(Math.log(startScale)+(Math.log(targetScale)-Math.log(startScale))*ease);
  const x=startX+(targetX-startX)*ease,y=startY+(targetY-startY)*ease;
  camera.x=vw*.5-x*camera.scale;camera.y=vh*.5-y*camera.scale;boundCamera();renderCamera();
  if(t<1)ui.animation=requestAnimationFrame(frame);else{ui.animation=0;if(onArrival)onArrival();}
 }
 ui.animation=requestAnimationFrame(frame);
}
function find(){
 const raw=search.value,q=normalize(raw);
 if(!q){search.focus();return;}
 if(q!==ui.lastQuery){ui.matches=searchResults(q);ui.lastQuery=q;ui.matchIndex=-1;}
 if(!ui.matches.length){clearResult();search.classList.add('not-found');emitStatus('No matching CB for '+raw);return;}
 search.classList.remove('not-found');
 ui.matchIndex=(ui.matchIndex+1)%ui.matches.length;
 const match=ui.matches[ui.matchIndex];focus(match,()=>{highlight(match);blinkFour(match);});
 emitStatus('Found '+match.panelId+' '+match.position+': '+match.label+'. Result '+(ui.matchIndex+1)+' of '+ui.matches.length);
}
function toggle(rec){
 if(rec.unverified){emitStatus(rec.panelId+' '+rec.position+': photo circle not identified in catalogue; no electrical action');return;}
 const state=network.state(rec.key);if(!state)return;
 const action=state.pulled||state.tripped?'PUSH':'PULL';
 const request=new CustomEvent('b737-cb-command',{cancelable:true,detail:{key:rec.key,panel:rec.panelId,position:rec.position,variant:network.variant,action,label:rec.label,rating:rec.rating}});
 if(!window.dispatchEvent(request))return;
 const reply=network.action(rec.key,action);if(!reply.ok){emitStatus('CB cannot be pushed: '+reply.reason);return;}
 persist();syncButton(rec.button);emitStatus(rec.panelId+' '+rec.position+' '+rec.label+' '+(action==='PULL'?'PULLED':'PUSHED'));
}
function zoomAt(scale,px,py){
 const next=clamp(scale,Math.max(.10,minFit()*.65),3);
 const wx=(px-camera.x)/camera.scale,wy=(py-camera.y)/camera.scale;
 camera.scale=next;camera.x=px-wx*next;camera.y=py-wy*next;boundCamera();renderCamera();
}
viewport.addEventListener('wheel',e=>{
 e.preventDefault();stopAnimation();ui.touched=true;
 const r=viewport.getBoundingClientRect(),amount=e.deltaY*(e.deltaMode===1?18:e.deltaMode===2?r.height:1);
 zoomAt(camera.scale*Math.exp(-amount*.00105),e.clientX-r.left,e.clientY-r.top);
},{passive:false});
function pts(){return [...pointers.values()];}
function setPinch(){const a=pts();if(a.length<2){gestures.gesture=null;return;}
 const midX=(a[0].x+a[1].x)/2,midY=(a[0].y+a[1].y)/2,dist=Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y);
 const r=viewport.getBoundingClientRect(),x=midX-r.left,y=midY-r.top;
 gestures.gesture={distance:Math.max(dist,1),scale:camera.scale,worldX:(x-camera.x)/camera.scale,worldY:(y-camera.y)/camera.scale};}
viewport.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&e.button!==0)return;
 stopAnimation();ui.touched=true;const pressed=e.target.closest('.cb-knob');
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,pressed:pressed||null,moved:false});
 viewport.setPointerCapture(e.pointerId);
 if(pointers.size===2)setPinch();else if(pointers.size===1)viewport.classList.add('dragging');
 e.preventDefault();
});
viewport.addEventListener('pointermove',e=>{
 const item=pointers.get(e.pointerId);if(!item)return;
 const dx=e.clientX-item.x,dy=e.clientY-item.y;item.x=e.clientX;item.y=e.clientY;
 if(Math.hypot(item.x-item.startX,item.y-item.startY)>6)item.moved=true;
 if(pointers.size>=2){const a=pts();if(!gestures.gesture)setPinch();const g=gestures.gesture;
  const mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2,dist=Math.max(1,Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y));
  const r=viewport.getBoundingClientRect();camera.scale=clamp(g.scale*dist/g.distance,Math.max(.10,minFit()*.65),3);
  camera.x=mx-r.left-g.worldX*camera.scale;camera.y=my-r.top-g.worldY*camera.scale;boundCamera();renderCamera();
 }else if(pointers.size===1){camera.x+=dx;camera.y+=dy;boundCamera();renderCamera();}
 e.preventDefault();
});
function pointerEnd(e){
 const item=pointers.get(e.pointerId);if(!item)return;
 const wasMulti=pointers.size>1;pointers.delete(e.pointerId);gestures.gesture=null;
 if(pointers.size>=2)setPinch();
 if(!pointers.size)viewport.classList.remove('dragging');
 if(!wasMulti&&!pointers.size&&!item.moved&&item.pressed){const rec=panelByButton.get(item.pressed);if(rec){toggle(rec);item.pressed.focus({preventScroll:true});}}
 e.preventDefault();
}
viewport.addEventListener('pointerup',pointerEnd);
viewport.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);gestures.gesture=null;viewport.classList.remove('dragging');});
viewport.addEventListener('dblclick',e=>e.preventDefault());
viewport.addEventListener('contextmenu',e=>{if(e.target.closest('.cb-knob'))e.preventDefault();});
viewport.addEventListener('keydown',e=>{
 if(e.target.closest('.cb-knob'))return;
 if(e.key==='0'){e.preventDefault();fit();}
 else if(e.key==='+'||e.key==='='){e.preventDefault();zoomAt(camera.scale*1.17,viewport.clientWidth/2,viewport.clientHeight/2);}
 else if(e.key==='-'){e.preventDefault();zoomAt(camera.scale/1.17,viewport.clientWidth/2,viewport.clientHeight/2);}
});
findBtn.addEventListener('click',find);
search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();find();}});
search.addEventListener('input',()=>{search.classList.remove('not-found');if(normalize(search.value)!==ui.lastQuery)ui.matches=[];});
window.addEventListener('storage',e=>{
 if(e.key===STORAGE){try{const snapshot=JSON.parse(e.newValue||'null');if(snapshot){network.restore(snapshot);clearResult();mount();if(ui.lastQuery)ui.matches=searchResults(ui.lastQuery);}}catch{}}
 if(e.key===PROFILE){const v=currentVariant();if(v!==network.variant){network.setVariant(v);persist();mount();clearResult();ui.matches=[];ui.matchIndex=-1;}}
});
window.addEventListener('resize',()=>{
 const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h||w===lastWidth&&h===lastHeight)return;
 lastWidth=w;lastHeight=h;if(!ui.touched)fit();else{stopAnimation();fittedScale=minFit();boundCamera();renderCamera();}
});
window.B737_CB_Electrical=Object.freeze({network,report:()=>network.report()});
window.B737_CB_LAB=Object.freeze({
 hydrate(snapshot){const result=network.restore(snapshot);if(result.ok){mount();ui.matches=ui.lastQuery?searchResults(ui.lastQuery):[];}return result;},
 setPulled(key,pulled){const b=network.state(key);if(!b)return false;const r=network.action(key,pulled?'PULL':'PUSH');if(r.ok){persist();const rec=records.find(x=>x.key===key);if(rec)syncButton(rec.button);}return r.ok;},
 getVariant:()=>network.variant
});
window.B737_CB_MRG_VIEWER=Object.freeze({
 layout:()=>POSITIONS.map(p=>({...p})),find:query=>searchResults(query).map(x=>({panel:x.panelId,position:x.position,key:x.key})),
 camera:()=>({...camera}),focusByKey:key=>{const r=records.find(x=>x.key===key);if(!r)return false;focus(r,()=>{highlight(r);blinkFour(r);});return true;},
 breaker:key=>network.state(key),fit
});
mount();persist();requestAnimationFrame(()=>{fit();lastWidth=viewport.clientWidth;lastHeight=viewport.clientHeight;});
})();
