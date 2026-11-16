/* EFIS PEDESTAL CP 0001 — CAPT/FO independent photographic control panels.
 * NEW additive overlay in the 272px clear left/right pedestal margins.
 * No locked photo/guard/IRS/EADI geometry is changed. Pure event-driven controls.
 */
(function(root){
'use strict';
const VERSION='EFIS-PEDESTAL-RASTER-0004-TIGHT-DETENTS';
const src=document.currentScript?.src||location.href;
const asset=(name)=>new URL('./assets/'+name,src).href;
const PHOTO={plate:asset('efis-cp-photo-plate-v1.webp'),
 mode:asset('efis-rose-mode-v1.webp'),range:asset('efis-range-tfc-v1.webp'),
 tfc:asset('efis-tfc-center-v2.webp'),dh:new URL('./dcpcs-altitude-knob-front-v1.webp',src).href,
 adi:new URL('./dcpcs-altitude-knob-front-v1.webp',src).href,
 hsi:asset('existing-knob-hsi.webp'),wxInner:asset('existing-knob-wxInner.webp')};
const W=1448,H=1086;
const MODE=['FULL_NAV','FULL_VOR_ILS','EXP_NAV','EXP_VOR_ILS','MAP','CTR_MAP','PLAN'];
const RANGES=[10,20,40,80,160,320];
const MODE_POS={FULL_NAV:-118,FULL_VOR_ILS:-29,EXP_NAV:-101,EXP_VOR_ILS:31,MAP:78,CTR_MAP:113,PLAN:168};
const RANGE_POS={10:-39,20:-16,40:11,80:44,160:90,320:139};
const ROTORS={dh:[296.5,500.5,84],adi:[292.5,892.5,72],
 mode:[777.5,316.5,108],range:[1190,311,112],
 hsi:[560.5,587,102],wxInner:[560.5,587,55]};
const BUTTONS={rst:[250,666,320,729],wxr:[1079,495,1244,661],
 vorAdf:[469,805,609,970],navAid:[637,805,780,970],
 arpt:[809,805,951,970],rteData:[979,805,1127,970],wpt:[1151,805,1294,970]};
const LABELS={wxr:'WXR',vorAdf:'VOR/ADF',navAid:'NAV AID',arpt:'ARPT',rteData:'RTE DATA',wpt:'WPT'};
const MODE_HITS={FULL_NAV:[639,389],FULL_VOR_ILS:[698,175],EXP_NAV:[647,290],EXP_VOR_ILS:[859,178],MAP:[972,276],CTR_MAP:[963,395],PLAN:[817,503]};
const RANGE_HITS={10:[1034,439],20:[1006,363],40:[1024,278],80:[1079,203],160:[1190,166],320:[1311,205]};
// Tight measured printed-text boxes in native photo pixels, not large
// radial touch zones. Exactly 5 CSS pixels of padding is attempted and
// reduced if nearby label zones would otherwise overlap.
const LABEL_HIT_SIZE={
 mode:{FULL_NAV:[84,42],FULL_VOR_ILS:[128,46],EXP_NAV:[84,42],
  EXP_VOR_ILS:[128,46],MAP:[54,36],CTR_MAP:[96,22],PLAN:[78,42]},
 range:{10:[38,34],20:[38,34],40:[38,34],80:[40,34],160:[62,34],320:[62,34]}
};
// All positions are native pixels of the approved 1448x1086 EFIS plate.
// The photograph, knob art and established detent angles remain unchanged.
const geometry=root.B737DetentHitGeometryV1;
if(!geometry?.build)throw Error('B737DetentHitGeometryV1 must load before EFIS CP');
const detentText=()=>[['mode',MODE_HITS],['range',RANGE_HITS]].flatMap(([kind,locations])=>
 Object.entries(locations).map(([value,[cx,cy]])=>{
  const [w,h]=LABEL_HIT_SIZE[kind][value];
  return {id:kind+':'+value,kind,value:kind==='range'?Number(value):value,cx,cy,w,h};
 }));
function labelBoxes(panelWidth=365,panelHeight=365*H/W){
 return geometry.build(detentText(),{
  scaleX:panelWidth/W,scaleY:panelHeight/H,paddingPx:5});
}
function nearestLabel(x,y,panelWidth=365,panelHeight=365*H/W){
 const hits=labelBoxes(panelWidth,panelHeight).filter(box=>geometry.at(box,x,y));
 return hits[0]?{kind:hits[0].kind,value:hits[0].value,distance:0}:null;
}
const states={CAPT:initial(),FO:initial()},instances=new Map();
let dialog=null,dialogSeat='CAPT',mounted=false;
function initial(){return {mode:'MAP',range:40,dh:200,brightness:{adi:1,hsi:1,wxInner:1},options:{wxr:false,tfc:false,vorAdf:false,navAid:false,arpt:false,rteData:false,wpt:false},dhResetCount:0};}
function copy(x){return JSON.parse(JSON.stringify(x))}
function pct(v,whole){return (100*v/whole)+'%'}
function elm(tag,cls,parent){const e=document.createElement(tag);if(cls)e.className=cls;if(parent)parent.append(e);return e}
function pos(e,c){const[x,y,w,h]=c;Object.assign(e.style,{left:pct(x,W),top:pct(y,H),width:pct(w,W),height:pct(h,H)});return e}
function emit(seat,control){
 const snap=copy(states[seat]);
 root.dispatchEvent(new CustomEvent('b737:unified-efis-control',{detail:{version:VERSION,seat,control,state:snap}}));
 // No synthetic traffic/radar/FMC content is generated. A downstream EHSI may subscribe.
 renderSeat(seat);
}
function change(seat,control,value){
 if(!Object.hasOwn(states,seat))throw Error('Invalid EFIS seat');
 const s=states[seat];
 if(control==='mode'){if(!MODE.includes(value))throw Error('Bad EFIS mode');s.mode=value;}
 else if(control==='range'){if(!RANGES.includes(value))throw Error('Bad EFIS range');s.range=value;}
 else if(control==='dh'){s.dh=Math.max(-20,Math.min(999,Math.trunc(Number(value))));}
 else if(['adi','hsi','wxInner'].includes(control)){s.brightness[control]=Math.max(0,Math.min(1,Math.round(Number(value)*100)/100));}
 else if(control==='rst'){s.dhResetCount++;}
 else if(Object.hasOwn(s.options,control)){s.options[control]=!!value;}
 else throw Error('Unknown EFIS control: '+control);
 emit(seat,control);
 return copy(s);
}
function step(seat,key,dir){
 if(!dir)return;
 const s=states[seat];
 if(key==='mode'||key==='range'){
  const arr=key==='mode'?MODE:RANGES,old=key==='mode'?s.mode:s.range;
  change(seat,key,arr[Math.max(0,Math.min(arr.length-1,arr.indexOf(old)+Math.sign(dir)))]);
 }else if(key==='dh')change(seat,key,s.dh+Math.sign(dir));
 else change(seat,key,s.brightness[key]+Math.sign(dir)*.04);
}
function button(c,aria){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',aria);b.dataset.control='efis';b.title=aria;b.addEventListener('pointerdown',e=>e.stopPropagation());return c.appendChild(b)}
function gestures(b,seat,key){
 let track=null;
 // No synthetic click-to-rotate: tap merely focuses the selector.
 // Each pointer gesture ends immediately on release/cancel, without timers.
 function release(id){
  const prev=track;track=null;
  if(prev&&id===prev.id&&b.hasPointerCapture?.(id))b.releasePointerCapture(id);
 }
 b.addEventListener('wheel',e=>{
  e.stopPropagation();e.preventDefault();step(seat,key,e.deltaY<0?1:-1);
 },{passive:false});
 b.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  e.stopPropagation();
  track={id:e.pointerId,x:e.clientX,y:e.clientY,acc:0};
  b.setPointerCapture?.(e.pointerId);
 });
 b.addEventListener('pointermove',e=>{
  if(!track||track.id!==e.pointerId)return;
  const dx=e.clientX-track.x,dy=e.clientY-track.y;
  track.x=e.clientX;track.y=e.clientY;
  track.acc+=(Math.abs(dx)>Math.abs(dy)?dx:-dy);
  const threshold=['mode','range'].includes(key)?18:11;
  const n=Math.trunc(track.acc/threshold);
  if(n){
   e.preventDefault();e.stopPropagation();
   track.acc-=n*threshold;
   for(let i=0;i<Math.min(16,Math.abs(n));i++)step(seat,key,Math.sign(n));
  }
 });
 b.addEventListener('pointerup',e=>{if(track?.id===e.pointerId){e.stopPropagation();release(e.pointerId);}});
 b.addEventListener('pointercancel',e=>{if(track?.id===e.pointerId)release(e.pointerId);});
 b.addEventListener('lostpointercapture',()=>{track=null;});
 b.addEventListener('click',e=>{e.stopPropagation();}); // selection only; rotation requires drag/wheel/key
 b.addEventListener('keydown',e=>{
  if(!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(e.key))return;
  e.preventDefault();step(seat,key,['ArrowUp','ArrowRight'].includes(e.key)?1:-1);
 });
}
function physicalPanel(seat,host,zoomed=false){
 const panel=elm('div','uefis-face',host);panel.dataset.seat=seat;panel.dataset.zoomed=String(zoomed);
 const photo=elm('img','uefis-photo',panel);photo.src=PHOTO.plate;photo.alt='737 Classic EFIS panel';photo.draggable=false;
 const stencil=elm('span','uefis-range80',panel);pos(stencil,[1073,139,56,51]);stencil.textContent='80';
 const parts={knobs:{},push:{},tfc:null,readout:null,detents:[]};
 // Every label uses only its own small invisible exact text hit box.
 // No broad faceplate click fallback: blank spaces never select a detent.
 // The physical rotor drag/wheel and stationary pushbuttons remain unchanged.
 for(const [key,[cx,cy,r]] of Object.entries(ROTORS)){
  const b=button(panel,seat+' '+key+' selector');b.className='uefis-knob uefis-'+key;
  b.dataset.rotor=key;pos(b,[cx-r,cy-r,r*2,r*2]);
  const img=elm('img','uefis-knob-image',b);img.src=PHOTO[key];img.alt='';img.draggable=false;
  gestures(b,seat,key);parts.knobs[key]=img;
 }
 // Stationary pushbutton exactly over the rotating RANGE rotor's center.
 const tfc=button(panel,seat+' TFC traffic overlay');tfc.className='uefis-tfc';
 tfc.dataset.push='tfc';pos(tfc,[1192-55,314-55,110,110]);
 const ti=elm('img','uefis-tfc-image',tfc);ti.src=PHOTO.tfc;ti.alt='';ti.draggable=false;
 tfc.setAttribute('aria-pressed','false');
 tfc.addEventListener('click',e=>{e.stopPropagation();change(seat,'tfc',!states[seat].options.tfc)});
 parts.tfc=tfc;
 for(const [key,coords] of Object.entries(BUTTONS)){
  const b=button(panel,seat+' '+(LABELS[key]||'DH RESET')+' pushbutton');
  b.className='uefis-push uefis-push-'+key;b.dataset.push=key;pos(b,[coords[0],coords[1],coords[2]-coords[0],coords[3]-coords[1]]);
  if(key!=='rst'){b.setAttribute('aria-pressed','false');const on=elm('span','uefis-on',b);on.textContent='ON';}
  b.addEventListener('click',e=>{e.stopPropagation();if(key==='rst')change(seat,'rst');else change(seat,key,!states[seat].options[key])});
  parts.push[key]=b;
 }
 const hitButtons=new Map();
 for(const spec of detentText()){
  const kind=spec.kind,value=String(spec.value);
  const b=button(panel,seat+' '+kind+' '+value.replaceAll('_',' '));
  b.className='uefis-detent';b.dataset.detent=kind;b.dataset.value=value;
  b.setAttribute('aria-label',seat+' EFIS '+kind+' detent '+value.replaceAll('_',' '));
  b.setAttribute('aria-pressed','false');
  b.addEventListener('click',e=>{e.stopPropagation();change(seat,kind,spec.value)});
  parts.detents.push(b);hitButtons.set(spec.id,b);
 }
 const fitTextHitAreas=()=>{
  if(!panel.isConnected)return;
  const rect=panel.getBoundingClientRect();
  const width=rect.width||(zoomed?900:365),height=rect.height||(zoomed?900*H/W:365*H/W);
  for(const box of labelBoxes(width,height)){
   const b=hitButtons.get(box.id);
   Object.assign(b.style,{left:pct(box.cx,W),top:pct(box.cy,H),
    width:pct(box.w,W),height:pct(box.h,H)});
   b.dataset.hitPaddingPx=box.paddingPx.toFixed(2);
  }
 };
 fitTextHitAreas();
 if(root.ResizeObserver){
  const observer=new root.ResizeObserver(fitTextHitAreas);
  observer.observe(panel);
  // Dialog instances are removed on close; release the observer as well.
  if(zoomed)dialog?.addEventListener('close',()=>observer.disconnect(),{once:true});
 }
 root.requestAnimationFrame?.(fitTextHitAreas);
 const disp=elm('div','uefis-dh-window',panel);
 pos(disp,[169,201,215,90]);disp.setAttribute('role','status');disp.setAttribute('aria-label','Decision height feet');
 parts.readout=disp;
 const entry={seat,panel,parts};const arr=instances.get(seat)||[];arr.push(entry);instances.set(seat,arr);
 renderPanel(entry);
 return entry;
}
function renderPanel(entry){
 const s=states[entry.seat],p=entry.parts;
 const angles={mode:MODE_POS[s.mode]||0,range:RANGE_POS[s.range]??0,
  dh:(s.dh-200)*10,adi:-110+s.brightness.adi*220,
  hsi:-110+s.brightness.hsi*220,wxInner:-110+s.brightness.wxInner*220};
 for(const [key,img] of Object.entries(p.knobs))img.style.transform='rotate('+angles[key]+'deg)';
 p.tfc.setAttribute('aria-pressed',String(s.options.tfc));
 for(const [key,b] of Object.entries(p.push))if(key!=='rst')b.setAttribute('aria-pressed',String(s.options[key]));
 for(const b of p.detents)b.setAttribute('aria-pressed',String(
  b.dataset.detent==='mode'?s.mode===b.dataset.value:String(s.range)===b.dataset.value));
 p.readout.textContent=String(s.dh).padStart(3,'0');
}
function renderSeat(seat){for(const item of instances.get(seat)||[])if(item.panel.isConnected)renderPanel(item);}
function open(seat){
 if(!dialog){dialog=elm('dialog','uefis-dialog',document.body);
  const top=elm('div','uefis-dialog-bar',dialog);const title=elm('strong','',top);title.id='uefis-dialog-title';
  const close=elm('button','uefis-dialog-close',top);close.textContent='CLOSE ×';close.type='button';close.onclick=()=>dialog.close();
  const inside=elm('div','uefis-dialog-body',dialog);inside.id='uefis-dialog-body';
  dialog.addEventListener('close',()=>{inside.replaceChildren();for(const [key,arr] of instances)instances.set(key,arr.filter(x=>x.panel.isConnected));});
 }
 dialogSeat=seat;dialog.querySelector('#uefis-dialog-title').textContent=seat+' · EFIS CONTROL PANEL';
 const inside=dialog.querySelector('#uefis-dialog-body');inside.replaceChildren();physicalPanel(seat,inside,true);
 dialog.showModal();
}
function mount(){
 const native=document.querySelector('#region-pedestal .region-native');if(!native)return false;
 if(native.querySelectorAll('[data-uefis-seat]').length===2){mounted=true;return true;}
 const layout=[{seat:'CAPT',x:55,y:1290,w:365},{seat:'FO',x:735,y:1290,w:365}];
 for(const g of layout){
  if(native.querySelector('[data-uefis-seat="'+g.seat+'"]'))continue;
  const frame=elm('div','uefis-seat',native);frame.dataset.uefisSeat=g.seat;
  Object.assign(frame.style,{left:g.x+'px',top:g.y+'px',width:g.w+'px'});
  const banner=elm('div','uefis-banner',frame);
  const label=elm('span','',banner);label.textContent=g.seat+' / EFIS CP';
  const expand=button(banner,'Expand '+g.seat+' EFIS CP');expand.className='uefis-expand';expand.textContent='⛶';
  expand.onclick=e=>{e.stopPropagation();open(g.seat)};
  physicalPanel(g.seat,frame);
 }
 mounted=true;
 for(const seat of ['CAPT','FO'])emit(seat,'mount');
 return true;
}
function mountOnce(){mount();}
root.addEventListener('b737:cockpit-mounted',mountOnce);
root.addEventListener('b737:engine-indication-view',()=>{for(const seat of ['CAPT','FO'])emit(seat,'engine-view')});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountOnce,{once:true});else mount();
root.B737UnifiedEFISPedestalV1=Object.freeze({version:VERSION,PHOTO,MODE,RANGES,ROTORS,BUTTONS,positions:{CAPT:[55,1290,365],FO:[735,1290,365]},
 detentHitSizes:LABEL_HIT_SIZE,labelBoxes,nearestLabel,mount,open,getState:(seat)=>Object.hasOwn(states,seat)?copy(states[seat]):null,operate:change});
})(window);
