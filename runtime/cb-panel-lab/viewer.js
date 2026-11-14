/* B737 Classic CB wall: MRG aft-cockpit order; vector faces use the photo-transcribed
 * catalogue. Indexed placeholders intentionally have no invented breakers.
 * Presentation-only replacement: the existing BreakerNetwork snapshot remains authoritative.
 */
(function(){'use strict';
const catalog=window.CB_CATALOG,Kernel=window.B737_CB_Kernel;
if(!catalog||!Kernel)throw Error('CB wall requires catalogue and breaker kernel');
const STORAGE='b737classic.cb.v1',PROFILE='b737classic.aircraft-profile.v1';
const SCENE={width:4500,height:2720};
const POSITIONS=[
 ['P6-1',440,110,1380,430],['P6-2',440,550,1380,385],
 ['P6-3',440,945,1380,550],['P6-4',440,1510,1380,555],
 ['P6-5',105,1730,300,325],['P6-6',185,1030,195,625],
 ['P6-12',440,2085,678,425],['P6-11',1130,2085,690,425],
 ['P18-0',3190,260,680,210],['P18-1',3135,485,730,310],
 ['P18-2',2830,815,1080,545],['P18-3',2825,1380,1255,665],
 ['P18-4',3480,2075,535,235],['P18-5',3450,2330,370,210]
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
function addKnob(cell,p,item,col,row){
 const btn=document.createElement('button');btn.type='button';btn.className='cb-knob';
 const key=keyFor(p,item.position);btn.dataset.key=key;btn.dataset.label=p.id+' '+item.position+' '+item.label;
 btn.title=p.id+' '+item.position+' · '+item.label+' · '+item.rating+'A';
 const head=document.createElement('span');head.className='cb-head';head.textContent=Number.isInteger(item.rating)?String(item.rating):String(item.rating).replace('.5','½');btn.append(head);cell.append(btn);syncButton(btn);
 const rect=panels.get(p.id);
 const innerW=rect.w-32,innerH=rect.h-70;
 const knobSize=Number(rect.knobSize||34);
 const cx=rect.x+16+(col+.5)*innerW/Math.max(1,p.cols);
 const cy=rect.y+45+(row+1)*innerH/Math.max(1,p.rows.length)-6-knobSize/2;
 const record={panelId:p.id,position:item.position,key,label:item.label,rating:item.rating,x:cx,y:cy,button:btn,panel:rect,searchable:''};
 const alias=(ALIASES[p.id+'|'+item.position]||[]).join(' ');
 record.searchable=normalize([p.id,item.position,item.label,alias,p.id+' '+item.position].join(' '));
 records.push(record);panelByButton.set(btn,record);
 btn.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(record);}});
 return btn;
}
function gridFor(p,rect){
 const face=document.createElement('div');face.className='panel-face';
 face.style.setProperty('--cols',String(p.cols));face.style.setProperty('--rows',String(p.rows.length));
 const m=new Map(getBreakers(p).map(x=>[x.position,x]));
 for(let row=0;row<p.rows.length;row++)for(let col=0;col<p.cols;col++){
  const position=p.rows[row]+(col+1),item=m.get(position);
  const cell=document.createElement('div');cell.className='cb-cell';cell.dataset.position=position;
  if(item){const label=document.createElement('span');label.className='cb-caption';label.textContent=item.label;cell.append(label);addKnob(cell,p,item,col,row);}
  else{const dot=document.createElement('span');dot.className='cb-empty';cell.append(dot);}
  face.append(cell);
 }
 return face;
}
function specialFor(p,rect){
 const face=document.createElement('div');face.className='panel-face';const items=getBreakers(p);
 for(let i=0;i<2;i++){const socket=document.createElement('div');socket.className='service-socket';socket.textContent=i===0?'SERVICE':'28V DC';face.append(socket);}
 for(let i=0;i<items.length;i++){
  const item=items[i],cell=document.createElement('div');cell.className='cb-cell';
  const name=document.createElement('span');name.className='cb-caption';name.textContent=item.label;cell.append(name);
  addKnob(cell,p,item,0,i);const rec=records[records.length-1];rec.x=rect.x+rect.w/2;rec.y=rect.y+rect.h*(.76+.15*i);
  face.append(cell);
 }
 return face;
}
function mount(){
 panelLayer.replaceChildren();panels.clear();records.length=0;
 for(const rect0 of POSITIONS){
  const rect={...rect0},p=panelDefinitions.get(rect.id);
  const node=document.createElement('section');node.className='cb-panel';node.dataset.panel=rect.id;
  node.style.cssText='left:'+rect.x+'px;top:'+rect.y+'px;width:'+rect.w+'px;height:'+rect.h+'px';
  const heading=document.createElement('div');heading.className='panel-head';
  const number=document.createElement('strong');number.textContent=rect.id;heading.append(number);
  if(p){const meta=document.createElement('small');meta.textContent=p.title;heading.append(meta);}
  node.append(heading);rect.node=node;rect.knobSize=p&&p.cols>19?28:p&&p.cols>16?32:36;panels.set(rect.id,rect);
  node.style.setProperty('--knob-size',rect.knobSize+'px');
  node.style.setProperty('--cell-font',p&&p.cols>19?'8px':p&&p.cols>16?'9px':'10px');
  if(p){node.dataset.outline=p.outline||'rectangle';if(p.id==='P6-6'){node.dataset.special='true';node.dataset.compact='true';node.append(specialFor(p,rect));}
   else{if(rect.w<400)node.dataset.compact='true';node.append(gridFor(p,rect));}
  }else{node.dataset.pending='true';const blank=document.createElement('div');blank.className='panel-unmapped';node.append(blank);node.setAttribute('aria-label',rect.id+' panel; no breaker inventory available');}
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
