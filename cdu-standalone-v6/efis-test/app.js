/* EFIS CP photographic control QA — browser-only, powered by the exact approved orthographic image. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const WIDTH=1448,HEIGHT=1086;
const MODES=['FULL_NAV','FULL_VOR_ILS','EXP_NAV','EXP_VOR_ILS','MAP','CTR_MAP','PLAN'];
const MODE_DEG={FULL_NAV:-180,FULL_VOR_ILS:-135,EXP_NAV:-86,EXP_VOR_ILS:-42,MAP:0,CTR_MAP:47,PLAN:100};
const RANGES=[10,20,40,80,160,320];
const RANGE_DEG={10:0,20:32,40:65,80:97,160:127,320:159};
// Physical rotor circles; centers/radii calibrated against approved 1448x1086 image.
// Only the alpha-masked mechanical component is rotated. Surrounding legend and markings never rotate.
const CONTROLS={
 dh:{cx:296.5,cy:500.5,r:84},
 adi:{cx:292.5,cy:892.5,r:72},
 mode:{cx:777.5,cy:316.5,r:108},
 hsi:{cx:560.5,cy:587,r:102},
 wxInner:{cx:570,cy:589,r:58},
 range:{cx:1190,cy:311,r:112}
};
// Click targets cover the dark central faces of the pushbuttons — not adjacent panel/labels.
const BUTTONS={
 rst:[250,666,320,729],
 wxr:[1079,495,1244,661],
 vorAdf:[469,805,609,970],
 navAid:[637,805,780,970],
 arpt:[809,805,951,970],
 rteData:[979,805,1127,970],
 wpt:[1151,805,1294,970]
};
const LABELS={rst:'RST',wxr:'WXR',vorAdf:'VOR/ADF',navAid:'NAV AID',arpt:'ARPT',rteData:'RTE DATA',wpt:'WPT'};
const state={mode:'MAP',range:10,dhRef:200,brightness:{adi:.6,hsi:.6,wxInner:.6},options:{wxr:false,vorAdf:false,navAid:false,arpt:false,rteData:false,wpt:false}};
const rotations={dh:0,adi:0,hsi:0,wxInner:0,mode:0,range:0};
const pct=(v,d)=>(v*100/d).toFixed(5)+'%';
const stage=$('panel');
const images=window.EFIS_TEST_IMAGES||{};
if(images['efis-approved.webp'])stage.querySelector('.source').src=images['efis-approved.webp'];
if(images['efis-plate.webp'])stage.querySelector('.plate').src=images['efis-plate.webp'];
let lastInput='Ready';
function createKnob(key,g){
 const b=document.createElement('button');b.type='button';b.className='knob knob-'+key;b.title=key+' — click, scroll, swipe, or arrows';b.setAttribute('aria-label',key+' rotary selector');b.dataset.knob=key;
 const x=g.cx-g.r,y=g.cy-g.r,w=g.r*2,h=g.r*2;
 Object.assign(b.style,{left:pct(x,WIDTH),top:pct(y,HEIGHT),width:pct(w,WIDTH),height:pct(h,HEIGHT)});
 const art=document.createElement('img');art.className='rotor';art.src=window.EFIS_TEST_IMAGES?.['knob-'+key+'.webp']||'assets/knob-'+key+'.webp';art.alt='';art.draggable=false;b.append(art);
 bindRotary(b,key);
 stage.append(b);
 return b;
}
function createButton(key,rect){
 const b=document.createElement('button');b.type='button';b.className='push push-'+key;b.title=LABELS[key];b.setAttribute('aria-label',LABELS[key]+' pushbutton');b.dataset.switch=key;
 Object.assign(b.style,{left:pct(rect[0],WIDTH),top:pct(rect[1],HEIGHT),width:pct(rect[2]-rect[0],WIDTH),height:pct(rect[3]-rect[1],HEIGHT)});
 if(key!=='rst'){
  const lamp=document.createElement('span');lamp.className='lamp';lamp.textContent=LABELS[key];lamp.setAttribute('aria-hidden','true');b.append(lamp);
  b.setAttribute('aria-pressed','false');
 }
 b.addEventListener('pointerdown',()=>b.classList.add('depressed'));
 for(const event of ['pointerup','pointerleave','pointercancel'])b.addEventListener(event,()=>b.classList.remove('depressed'));
 b.addEventListener('click',()=>{
  if(key==='rst'){lastInput='DH RESET pressed';$('reset-count').textContent=Number($('reset-count').textContent)+1}
  else{state.options[key]=!state.options[key];lastInput=LABELS[key]+' '+(state.options[key]?'ON':'OFF')}
  render();
 });stage.append(b);
}
function changeKnob(key,d){
 d=Math.sign(d);if(!d)return;
 if(key==='mode'){const i=MODES.indexOf(state.mode);state.mode=MODES[Math.max(0,Math.min(MODES.length-1,i+d))];rotations.mode=MODE_DEG[state.mode];}
 if(key==='range'){const i=RANGES.indexOf(state.range);state.range=RANGES[Math.max(0,Math.min(RANGES.length-1,i+d))];rotations.range=RANGE_DEG[state.range];}
 if(key==='dh'){let old=state.dhRef;state.dhRef=Math.max(-20,Math.min(999,old+d));rotations.dh+=(state.dhRef-old)*12;}
 if(['adi','hsi','wxInner'].includes(key)){
  const old=state.brightness[key];const next=Math.max(0,Math.min(1,Math.round((old+d*.025)*1000)/1000));state.brightness[key]=next;rotations[key]=-115+next*230;
 }
 lastInput=key.toUpperCase()+' '+(key==='mode'?state.mode:key==='range'?state.range:key==='dh'?state.dhRef:Math.round(state.brightness[key]*100)+'%');render();
}
function bindRotary(node,key){
 node.addEventListener('click',e=>{if(node.dataset.swiped==='1'){node.dataset.swiped='0';return}changeKnob(key,e.shiftKey?-1:1)});
 node.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();changeKnob(key,e.deltaY<0?1:-1)},{passive:false});
 node.addEventListener('keydown',e=>{if(['ArrowRight','ArrowUp','ArrowLeft','ArrowDown'].includes(e.key)){e.preventDefault();changeKnob(key,['ArrowRight','ArrowUp'].includes(e.key)?1:-1)}});
 let start=null,acc=0,moved=false;
 node.addEventListener('pointerdown',e=>{if(e.button!==0)return;start={x:e.clientX,y:e.clientY,id:e.pointerId};acc=0;moved=false;node.setPointerCapture?.(e.pointerId)});
 node.addEventListener('pointermove',e=>{if(!start||e.pointerId!==start.id)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;const dominant=Math.abs(dx)>Math.abs(dy)?dx:-dy;const threshold=(key==='mode'||key==='range'?22:12);
  if(Math.abs(dominant)>=threshold){const steps=Math.trunc(dominant/threshold);for(let i=0;i<Math.min(15,Math.abs(steps));i++)changeKnob(key,Math.sign(steps));
   if(Math.abs(dx)>Math.abs(dy))start.x+=steps*threshold;else start.y-=steps*threshold;
   moved=true;
  }
 });
 node.addEventListener('pointerup',()=>{if(moved)node.dataset.swiped='1';start=null});
 node.addEventListener('pointercancel',()=>{start=null});
}
function buildDigits(value){
 const segments={0:'abcdef',1:'bc',2:'abdeg',3:'abcdg',4:'bcfg',5:'acdfg',6:'acdefg',7:'abc',8:'abcdefg',9:'abcdfg','-':'g'};
 const locations={a:[6,2,41,5],b:[46,8,5,35],c:[46,47,5,35],d:[6,86,41,5],e:[1,47,5,35],f:[1,8,5,35],g:[6,44,41,5]};
 const text=String(value).padStart(3,'0').slice(-3);
 let out='<svg viewBox="0 0 170 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Decision height '+value+' feet">';
 for(let i=0;i<3;i++){
  let active=segments[text[i]]||'';
  for(const [k,[x,y,w,h]] of Object.entries(locations))out+='<rect x="'+(6+i*55+x)+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="2" fill="'+(active.includes(k)?'#fb3938':'#571c1c')+'" opacity="'+(active.includes(k)?'.95':'.22')+'"/>';
 }
 return out+'</svg>';
}
function render(){
 for(const [key,a] of Object.entries(rotations)){
  const rotor=stage.querySelector('[data-knob="'+key+'"] .rotor');if(rotor)rotor.style.transform='rotate('+a+'deg)';
 }
 $('dh-digits').innerHTML=buildDigits(state.dhRef);
 for(const b of stage.querySelectorAll('[data-switch]')){
  if(b.dataset.switch==='rst')continue;const val=!!state.options[b.dataset.switch];b.classList.toggle('on',val);b.setAttribute('aria-pressed',String(val));
 }
 $('current-mode').textContent=state.mode.replaceAll('_',' ');$('current-range').textContent=state.range+' NM';$('current-dh').textContent=state.dhRef+' ft';$('last-input').textContent=lastInput;
 $('adi').textContent=Math.round(state.brightness.adi*100)+'%';$('hsi').textContent=Math.round(state.brightness.hsi*100)+'%';$('wxi').textContent=Math.round(state.brightness.wxInner*100)+'%';
 $('state-json').textContent=JSON.stringify(state,null,2);
}
Object.entries(CONTROLS).forEach(([k,g])=>createKnob(k,g));Object.entries(BUTTONS).forEach(([k,b])=>createButton(k,b));
const readout=document.createElement('div');readout.id='dh-digits';readout.className='dh-digits';Object.assign(readout.style,{left:pct(168,WIDTH),top:pct(201,HEIGHT),width:pct(216,WIDTH),height:pct(89,HEIGHT)});stage.append(readout);
stage.classList.toggle('show-bounds',$('toggle-bounds').checked);
$('toggle-bounds').addEventListener('change',e=>stage.classList.toggle('show-bounds',e.target.checked));
$('reset').onclick=()=>{state.mode='MAP';state.range=10;state.dhRef=200;state.brightness={adi:.6,hsi:.6,wxInner:.6};Object.keys(state.options).forEach(k=>state.options[k]=false);Object.keys(rotations).forEach(k=>rotations[k]=0);lastInput='RESET';render()};
$('copy').onclick=()=>navigator.clipboard?.writeText(JSON.stringify({state,geometry:{width:WIDTH,height:HEIGHT,knobs:CONTROLS,buttons:BUTTONS,modeOrder:MODES}},null,2));
$('show-original').onclick=()=>stage.classList.toggle('original');
render();
// Expose QA read-only geometry to automated integration tests without impacting interactions.
window.EFIS_QA=Object.freeze({modeOrder:[...MODES],controls:CONTROLS,buttons:BUTTONS,getState:()=>JSON.parse(JSON.stringify(state))});
})();