/* TCAS Lab EFIS physical CP — reuse approved Unified pedestal photo and rotor assets.
 * No source photo, frozen panels, or Unified control owners are modified.
 * The local standalone model mirrors its 1448x1086 control coordinates.
 */
(function(root){
 'use strict';
 const mount=document.getElementById('efisCpMount');
 if(!mount)return;
 const W=1448,H=1086;
 const asset=name=>'../assets/'+name;
 const MODES=['FULL_NAV','FULL_VOR_ILS','EXP_NAV','EXP_VOR_ILS','MAP','CTR_MAP','PLAN'];
 const RANGES=[10,20,40,80,160,320];
 const MODE_POS={FULL_NAV:-118,FULL_VOR_ILS:-29,EXP_NAV:-101,EXP_VOR_ILS:31,MAP:78,CTR_MAP:113,PLAN:168};
 const RANGE_POS={10:-39,20:-16,40:11,80:44,160:90,320:139};
 const ROTORS={dh:[296.5,500.5,84],adi:[292.5,892.5,72],mode:[777.5,316.5,108],
  range:[1190,311,112],hsi:[560.5,587,102],wxInner:[560.5,587,55]};
 const PHOTO={mode:'efis-rose-mode-v1.webp',range:'efis-range-tfc-v1.webp',
  tfc:'efis-tfc-center-v2.webp',dh:'../dcpcs-altitude-knob-front-v1.webp',
  adi:'../dcpcs-altitude-knob-front-v1.webp',hsi:'existing-knob-hsi.webp',
  wxInner:'existing-knob-wxInner.webp'};
 const BUTTONS={rst:[250,666,320,729],wxr:[1079,495,1244,661],
  vorAdf:[469,805,609,970],navAid:[637,805,780,970],arpt:[809,805,951,970],
  rteData:[979,805,1127,970],wpt:[1151,805,1294,970]};
 const MODE_HITS={FULL_NAV:[639,389],FULL_VOR_ILS:[698,175],EXP_NAV:[647,290],
  EXP_VOR_ILS:[859,178],MAP:[972,276],CTR_MAP:[963,395],PLAN:[817,503]};
 const RANGE_HITS={10:[1034,439],20:[1006,363],40:[1024,278],80:[1079,203],160:[1190,166],320:[1311,205]};
 const state={mode:'CTR_MAP',range:10,tfc:true,dh:-20,
  brightness:{adi:1,hsi:1,wxInner:1},
  options:{wxr:false,vorAdf:false,navAid:false,arpt:false,rteData:false,wpt:false}};
 const elems={rotors:{},buttons:{},detents:[],tfc:null,dh:null};
 const pct=(n,total)=>n/total*100+'%';
 function element(tag,cls,parent){
  const el=document.createElement(tag);if(cls)el.className=cls;
  if(parent)parent.appendChild(el);
  return el;
 }
 function rect(el,[x,y,w,h]){
  Object.assign(el.style,{left:pct(x,W),top:pct(y,H),width:pct(w,W),height:pct(h,H)});
  return el;
 }
 const face=element('div','uefis-face',mount);
 face.setAttribute('aria-label','B737 Classic photographic EFIS control panel');
 const plate=element('img','uefis-photo',face);
 plate.src=asset('efis-cp-photo-plate-v1.webp');plate.alt='737 Classic EFIS control photo';plate.draggable=false;
 const range80=rect(element('span','uefis-range80',face),[1073,139,56,51]);range80.textContent='80';
 function button(cls,label,box){
  const b=rect(element('button',cls,face),box);b.type='button';b.title=label;
  b.setAttribute('aria-label',label);return b;
 }
 function change(kind,value){
  const input=document.getElementById(kind==='mode'?'displayMode':'range');
  if(kind==='mode'||kind==='range'){
   input.value=String(value);state[kind]=value;input.onchange?.();
  }else if(kind==='tfc'){
   document.getElementById('tfc').onclick?.();
   state.tfc=!!(document.getElementById('tfc').getAttribute('aria-pressed')==='true');
  }else if(kind==='rst'){state.dh=-20;}
  else if(kind==='dh')state.dh=Math.max(-20,Math.min(999,state.dh+value));
  else if(Object.hasOwn(state.brightness,kind)){
   state.brightness[kind]=Math.max(0,Math.min(1,Math.round((state.brightness[kind]+value*.04)*100)/100));
  }else if(Object.hasOwn(state.options,kind)){state.options[kind]=!state.options[kind];}
  redraw();root.B737TcasEfisCPChanged?.(snapshot());
 }
 function steps(kind,dir){
  const list=kind==='mode'?MODES:kind==='range'?RANGES:null;
  if(list)change(kind,list[Math.max(0,Math.min(list.length-1,list.indexOf(state[kind])+Math.sign(dir)))]);
  else change(kind,Math.sign(dir));
 }
 function rotary(b,kind){
  let pointer=null;
  b.addEventListener('wheel',ev=>{ev.preventDefault();ev.stopPropagation();steps(kind,ev.deltaY<0?1:-1)},{passive:false});
  b.addEventListener('pointerdown',ev=>{
   if(ev.button!==0)return;
   pointer={id:ev.pointerId,x:ev.clientX,y:ev.clientY,acc:0};
   b.setPointerCapture?.(ev.pointerId);
  });
  b.addEventListener('pointermove',ev=>{
   if(!pointer||pointer.id!==ev.pointerId)return;
   const dx=ev.clientX-pointer.x,dy=ev.clientY-pointer.y;
   pointer.x=ev.clientX;pointer.y=ev.clientY;
   pointer.acc+=Math.abs(dx)>Math.abs(dy)?dx:-dy;
   const unit=['mode','range'].includes(kind)?18:11,n=Math.trunc(pointer.acc/unit);
   if(n){pointer.acc-=n*unit;
    for(let i=0;i<Math.min(16,Math.abs(n));i++)steps(kind,Math.sign(n));
    ev.preventDefault();}
  });
  const release=ev=>{if(pointer?.id===ev.pointerId){
   pointer=null;if(b.hasPointerCapture?.(ev.pointerId))b.releasePointerCapture(ev.pointerId);
  }};
  b.addEventListener('pointerup',release);
  b.addEventListener('pointercancel',release);
  b.addEventListener('lostpointercapture',()=>{pointer=null;});
  b.addEventListener('keydown',ev=>{
   if(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(ev.key)){
    ev.preventDefault();steps(kind,['ArrowUp','ArrowRight'].includes(ev.key)?1:-1);
   }
  });
 }
 for(const [kind,[cx,cy,r]] of Object.entries(ROTORS)){
  const knob=button('uefis-knob uefis-'+kind,'EFIS '+kind+' selector',[cx-r,cy-r,r*2,r*2]);
  knob.dataset.rotor=kind;
  const img=element('img','uefis-knob-image',knob);
  img.src=PHOTO[kind].startsWith('../')?PHOTO[kind]:asset(PHOTO[kind]);img.alt='';img.draggable=false;
  elems.rotors[kind]=img;rotary(knob,kind);
 }
 const tfc=button('uefis-tfc','TFC traffic overlay',[1192-55,314-55,110,110]);
 const tfcImg=element('img','uefis-tfc-image',tfc);tfcImg.src=asset(PHOTO.tfc);tfcImg.alt='';
 tfc.addEventListener('click',()=>change('tfc'));elems.tfc=tfc;
 for(const [kind,[x1,y1,x2,y2]] of Object.entries(BUTTONS)){
  const b=button('uefis-push uefis-push-'+kind,'EFIS '+kind+' pushbutton',[x1,y1,x2-x1,y2-y1]);
  b.dataset.push=kind;
  if(kind!=='rst'){b.setAttribute('aria-pressed','false');element('span','uefis-on',b).textContent='ON';}
  b.addEventListener('click',()=>change(kind));
  elems.buttons[kind]=b;
 }
 // Printed-text detents from the approved 1448px image, with small invisible
 // hit areas. They select exact physical positions rather than +/- cycles.
 for(const [kind,hits] of [['mode',MODE_HITS],['range',RANGE_HITS]]){
  for(const [value,[cx,cy]] of Object.entries(hits)){
   const isMode=kind==='mode',w=isMode?(value.includes('VOR')?125:85):value.length===3?60:40;
   const h=isMode?33:30;
   const b=button('uefis-detent','EFIS '+kind+' '+value,[cx-w/2,cy-h/2,w,h]);
   // Source selector CSS positions detents by center rather than upper left.
   Object.assign(b.style,{left:pct(cx,W),top:pct(cy,H)});
   b.dataset.detent=kind;b.dataset.value=value;
   b.addEventListener('click',()=>change(kind,isMode?value:Number(value)));
   elems.detents.push(b);
  }
 }
 const dh=rect(element('div','uefis-dh-window',face),[169,201,215,90]);
 elems.dh=dh;dh.setAttribute('role','status');dh.setAttribute('aria-label','EFIS DH selector');
 function snapshot(){return JSON.parse(JSON.stringify(state));}
 function redraw(){
  const angles={mode:MODE_POS[state.mode]??0,range:RANGE_POS[state.range]??0,
   dh:(state.dh-200)*10,adi:-110+state.brightness.adi*220,
   hsi:-110+state.brightness.hsi*220,wxInner:-110+state.brightness.wxInner*220};
  for(const [kind,img] of Object.entries(elems.rotors))img.style.transform='rotate('+angles[kind]+'deg)';
  elems.tfc.setAttribute('aria-pressed',String(state.tfc));
  for(const [kind,b] of Object.entries(elems.buttons))if(kind!=='rst')b.setAttribute('aria-pressed',String(state.options[kind]));
  for(const b of elems.detents)b.setAttribute('aria-pressed',String(
   b.dataset.detent==='mode'?b.dataset.value===state.mode:Number(b.dataset.value)===state.range));
  elems.dh.textContent=String(state.dh).padStart(3,'0');
 }
 function sync({mode,range,tfc}={}){
  if(MODES.includes(mode))state.mode=mode;
  if(RANGES.includes(Number(range)))state.range=Number(range);
  if(typeof tfc==='boolean')state.tfc=tfc;
  redraw();
 }
 redraw();
 mount.dataset.source='approved-unified-efis-cp-photo-plate';
 root.B737TcasEfisCPV1=Object.freeze({sync,getState:snapshot,modes:MODES,ranges:RANGES,face});
})(window);
