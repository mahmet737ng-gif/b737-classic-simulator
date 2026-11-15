/* B737 Classic EFIS CP — photographic, independently mounted EADI/EHSI lab.
   Geometry and alpha knob sprites reused from the repository's approved EFIS source.
   Cockpit integration is by the lab's event-driven dispatch only; no polling. */
(function(){
'use strict';
const M=window.B737EFISDisplayLab,images=window.EFIS_TEST_IMAGES||{},mount=document.getElementById('efisCpMount');
if(!mount)return;
if(!M||!images['efis-plate.webp']){
 mount.textContent='EFIS CP source image or EADI/EHSI lab dependency unavailable';return;
}
const W=1448,H=1086,pct=(n,d)=>n/d*100+'%';
const MODE=['FULL_NAV','FULL_VOR_ILS','EXP_NAV','EXP_VOR_ILS','MAP','CTR_MAP','PLAN'];
const MODE_DEG={FULL_NAV:-180,FULL_VOR_ILS:-135,EXP_NAV:-86,EXP_VOR_ILS:-42,MAP:0,CTR_MAP:47,PLAN:100};
const RANGE=[10,20,40,80,160,320],RANGE_DEG={10:0,20:32,40:65,80:97,160:127,320:159};
const KNOBS={dh:[296.5,500.5,84],adi:[292.5,892.5,72],mode:[777.5,316.5,108],hsi:[560.5,587,102],wxInner:[570,589,58],range:[1190,311,112]};
const BUTTONS={rst:[250,666,320,729],wxr:[1079,495,1244,661],vorAdf:[469,805,609,970],navAid:[637,805,780,970],arpt:[809,805,951,970],rteData:[979,805,1127,970],wpt:[1151,805,1294,970]};
const OPTIONS={wxr:'wxr',vorAdf:'vorAdf',navAid:'navAid',arpt:'arpt',rteData:'rteData',wpt:'wpt'};
const MODE_HITS={FULL_NAV:[639,389],FULL_VOR_ILS:[698,175],EXP_NAV:[647,290],EXP_VOR_ILS:[859,178],MAP:[972,276],CTR_MAP:[963,395],PLAN:[817,503]};
const RANGE_HITS={10:[1034,439],20:[1006,363],40:[1024,278],80:[1079,203],160:[1190,166],320:[1311,205]};
let st=M.getState(),last='Ready',rstCount=0,dhAngular=0,lastDH=st.eadi.dh;
const rotorEls={};const detents=[];const pushEls={};
function el(tag,cls,parent,text){
 const x=document.createElement(tag);if(cls)x.className=cls;if(text!=null)x.textContent=text;if(parent)parent.appendChild(x);return x;
}
function pos(x,left,top,width,height){
 Object.assign(x.style,{left:pct(left,W),top:pct(top,H),width:pct(width,W),height:pct(height,H)});
 return x;
}
function setEvent(patch,description){
 last=description;
 M.dispatch(patch);
}
function patch(path,value,description){setEvent({type:'set',path,value},description)}
function option(key,value){setEvent({type:'option',name:key,value},key.toUpperCase()+' '+(value?'ON':'OFF'))}
function clickKnob(key,sign){
 sign=Math.sign(sign);if(!sign)return;
 if(key==='mode'){
  const i=MODE.indexOf(st.ehsi.mode);
  const mode=MODE[Math.max(0,Math.min(MODE.length-1,(i<0?4:i)+sign))];
  patch('ehsi.mode',mode,'HSI '+mode);
 }else if(key==='range'){
  const i=RANGE.indexOf(st.ehsi.range);
  const r=RANGE[Math.max(0,Math.min(RANGE.length-1,(i<0?2:i)+sign))];
  patch('ehsi.range',r,'RANGE '+r+' NM');
 }else if(key==='dh'){
  const dh=Math.max(-20,Math.min(999,Math.trunc(st.eadi.dh)+sign));
  patch('eadi.dh',dh,'DH REF '+dh+' ft');
 }else{
  const path=key==='adi'?'eadi.brightness':key==='hsi'?'ehsi.brightness':'ehsi.wxBrightness';
  const scope=key==='adi'?st.eadi:st.ehsi;
  const prop=key==='adi'?'brightness':key==='hsi'?'brightness':'wxBrightness';
  const next=Math.max(0,Math.min(1,Math.round((Number(scope[prop]??1)+sign*.04)*100)/100));
  patch(path,next,key.toUpperCase()+' BRT '+Math.round(next*100)+'%');
 }
}
function bindRotary(btn,key){
 let pointer=null,swiped=false;
 btn.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY};
  swiped=false;btn.setPointerCapture?.(e.pointerId);
 });
 btn.addEventListener('pointermove',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
  const amount=Math.abs(dx)>Math.abs(dy)?dx:-dy;
  const pixels=(key==='mode'||key==='range')?22:key==='dh'?8:11;
  const steps=Math.trunc(amount/pixels);
  if(!steps)return;
  swiped=true;
  // A quick swipe generates multiple real detent steps, bounded by physical end stops.
  for(let i=0;i<Math.min(Math.abs(steps),24);i++)clickKnob(key,Math.sign(steps));
  if(Math.abs(dx)>Math.abs(dy))pointer.x+=steps*pixels;
  else pointer.y-=steps*pixels;
 });
 btn.addEventListener('pointerup',()=>{pointer=null;});
 btn.addEventListener('pointercancel',()=>{pointer=null;});
 btn.addEventListener('click',e=>{if(swiped){swiped=false;return;}clickKnob(key,e.shiftKey?-1:1)});
 btn.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();clickKnob(key,e.deltaY<0?1:-1)},{passive:false});
 btn.addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(e.key)){
   e.preventDefault();clickKnob(key,['ArrowUp','ArrowRight'].includes(e.key)?1:-1);
  }
 });
}
const layout=el('div','efcp-layout',mount);
const face=el('div','efcp-face',layout);face.setAttribute('aria-label','Classic EFIS physical control panel');
const base=el('img','efcp-plate',face);base.src=images['efis-plate.webp'];base.alt='Approved Classic EFIS photographic plate';base.draggable=false;
// The archived approved plate says 60; the Classic six-step selector is 10/20/40/80/160/320.
// Correct only the superimposed stencil, leaving the versioned source image untouched.
el('div','efcp-range80',face,'80');
for(const [key,[cx,cy,r]] of Object.entries(KNOBS)){
 const b=pos(el('button','efcp-knob',face),cx-r,cy-r,2*r,2*r);
 b.type='button';b.dataset.knob=key;b.dataset.kind=key==='wxInner'?'inner':'outer';
 b.title=key+' · click / wheel / swipe / arrows · Shift+click reverse';
 b.setAttribute('aria-label',key+' selector');
 const img=el('img','efcp-rotor',b);img.src=images['knob-'+key+'.webp'];img.alt='';img.draggable=false;
 rotorEls[key]=img;bindRotary(b,key);
}
for(const [key,[x1,y1,x2,y2]] of Object.entries(BUTTONS)){
 const b=pos(el('button','efcp-key',face),x1,y1,x2-x1,y2-y1);
 b.type='button';b.dataset.switch=key;b.title=key.toUpperCase();
 b.setAttribute('aria-label',key==='rst'?'Decision height RESET':key.toUpperCase()+' map option');
 if(key!=='rst'){
  b.setAttribute('aria-pressed','false');
  el('span','efcp-on',b,'ON');
 }
 b.addEventListener('click',()=>{
  if(key==='rst'){rstCount++;last='DH REF alert reset';M.dispatch({type:'dhReset'});}
  else option(OPTIONS[key],!st.ehsi.options[OPTIONS[key]]);
 });
 pushEls[key]=b;
}
const tfc=pos(el('button','efcp-tfc',face,'TFC'),1156,278,69,68);
tfc.type='button';tfc.id='efcp-tfc';tfc.setAttribute('aria-label','TFC recessed traffic display button');
tfc.title='TFC traffic overlay select — independent of range';
tfc.setAttribute('aria-pressed','false');
tfc.addEventListener('click',()=>option('tfc',!st.ehsi.options.tfc));
for(const [type,values,coords] of [['mode',MODE,MODE_HITS],['range',RANGE,RANGE_HITS]]){
 for(const value of values){
  const [x,y]=coords[value];
  const b=el('button','efcp-detent',face);
  b.type='button';b.dataset.detent=type;b.dataset.value=String(value);
  b.style.left=pct(x,W);b.style.top=pct(y,H);
  b.title=(type==='mode'?'HSI ':'RANGE ')+String(value).replaceAll('_',' ')+' — click to set this detent';
  b.setAttribute('aria-label',b.title);
  b.addEventListener('click',()=>patch(type==='mode'?'ehsi.mode':'ehsi.range',value,b.title));
  detents.push(b);
 }
}
function segmentsSVG(n){
 const glyph={0:'abcdef',1:'bc',2:'abdeg',3:'abcdg',4:'bcfg',5:'acdfg',6:'acdefg',7:'abc',8:'abcdefg',9:'abcdfg','-':'g'};
 const path={
  a:'M11 3 H47 L41 9 H17 Z',
  b:'M49 5 L54 11 V42 L48 47 L45 40 V15 Z',
  c:'M49 54 L54 60 V88 L48 94 L45 87 V60 Z',
  d:'M17 91 H41 L47 97 H11 Z',
  e:'M8 54 L13 60 V87 L8 94 L3 88 V60 Z',
  f:'M8 5 L13 15 V40 L8 47 L3 42 V11 Z',
  g:'M12 47 H46 L40 53 H18 Z'
 };
 const str=String(Math.trunc(Number(n)||0)).padStart(3,'0').slice(-3);
 let inner='';
 for(let i=0;i<str.length;i++){
  const active=glyph[str[i]]||'';
  inner+='<g transform="translate('+(i*60)+',0)">';
  for(const [id,d] of Object.entries(path))
   inner+='<path d="'+d+'" fill="'+(active.includes(id)?'#f5f5f2':'#434648')+'" opacity="'+(active.includes(id)?'1':'.10')+'"/>';
  inner+='</g>';
 }
 return '<svg viewBox="0 0 180 100" aria-label="DH '+n+' feet" role="img" xmlns="http://www.w3.org/2000/svg">'+inner+'</svg>';
}
const dh=el('div','efcp-dh',face),dhValue=el('span','efcp-dh-val',dh,'200');
dh.setAttribute('role','status');dh.setAttribute('aria-label','DH REF feet');
const sidebar=el('div','efcp-tester',layout);
el('h3','',sidebar,'SELECTOR / DETENT TEST');
const dl=el('dl','',sidebar);
const values={};
for(const [label,key] of [['HSI MODE','mode'],['RANGE','range'],['DH REF','dh'],['EADI BRT','adi'],['EHSI BRT','hsi'],['MAP/WXR BRT','wxInner'],['TFC','tfc'],['WXR','wxr'],['RST count','rst']]){
 el('dt','',dl,label);values[key]=el('dd','',dl,'—');
}
el('h3','',sidebar,'HSI MODE · 7 DETENTS');
const modes=el('div','efcp-modes',sidebar),modeBtns={};
MODE.forEach(mode=>{
 const b=el('button','',modes,mode.replaceAll('_',' '));b.type='button';b.dataset.cpMode=mode;
 b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>patch('ehsi.mode',mode,'HSI '+mode));modeBtns[mode]=b;
});
el('h3','',sidebar,'RANGE · 6 DETENTS').style.marginTop='12px';
const ranges=el('div','efcp-modes',sidebar),rangeBtns={};
RANGE.forEach(n=>{
 const b=el('button','',ranges,n+' NM');b.type='button';b.dataset.cpRange=String(n);
 b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>patch('ehsi.range',n,'RANGE '+n));rangeBtns[n]=b;
});
const details=el('details','',sidebar),sum=el('summary','',details,'Component audit / live input');
const audit=el('p','',details);
el('p','efcp-legend',mount,'Detents: click a visible selector dot/legend, use the mouse wheel, tap or swipe on the knob, or use arrow keys. The TFC button is a fixed recessed pushbutton in the RANGE centre; the EHSI outer BRT and MAP/WXR inner BRT are independent. No TCAS targets or weather returns are fabricated.');
function sync(next){
 st=next||M.getState();
 const e=st.ehsi,adi=st.eadi;
 if(lastDH!==adi.dh){dhAngular+=(adi.dh-lastDH)*11;lastDH=adi.dh;}
 const angles={mode:MODE_DEG[e.mode]??0,range:RANGE_DEG[e.range]??0,dh:dhAngular,adi:-110+Number(adi.brightness??1)*220,hsi:-110+Number(e.brightness??1)*220,wxInner:-110+Number(e.wxBrightness??1)*220};
 for(const [key,img] of Object.entries(rotorEls))img.style.transform='rotate('+angles[key]+'deg)';
 dhValue.innerHTML=segmentsSVG(adi.dh);
 for(const [key,b] of Object.entries(pushEls))if(key!=='rst')b.setAttribute('aria-pressed',String(!!e.options[key]));
 tfc.setAttribute('aria-pressed',String(!!e.options.tfc));
 values.mode.textContent=e.mode.replaceAll('_',' ');
 values.range.textContent=e.range+' NM';
 values.dh.textContent=adi.dh+' ft';
 values.adi.textContent=Math.round(Number(adi.brightness??1)*100)+'%';
 values.hsi.textContent=Math.round(Number(e.brightness??1)*100)+'%';
 values.wxInner.textContent=Math.round(Number(e.wxBrightness??1)*100)+'%';
 values.tfc.textContent=e.options.tfc?'ON':'OFF';
 values.wxr.textContent=e.options.wxr?'ON':'OFF';
 values.rst.textContent=String(rstCount);
 for(const [mode,b] of Object.entries(modeBtns))b.setAttribute('aria-pressed',String(mode===e.mode));
 for(const [n,b] of Object.entries(rangeBtns))b.setAttribute('aria-pressed',String(Number(n)===Number(e.range)));
 for(const b of detents)b.setAttribute('aria-pressed',String(b.dataset.detent==='mode'?b.dataset.value===e.mode:Number(b.dataset.value)===Number(e.range)));
 const canvas=document.getElementById('eadi');if(canvas)canvas.style.opacity=String(.1+.9*Number(adi.brightness??1));
 audit.textContent='Last: '+last+' · MODE '+e.mode+' · '+e.range+' NM · MAP '+JSON.stringify(e.options);
}
window.addEventListener('efislab-state',ev=>sync(ev.detail));
sync(st);
window.B737EFISCP=Object.freeze({getState:()=>JSON.parse(JSON.stringify(st)),modes:[...MODE],ranges:[...RANGE],knobs:KNOBS,buttons:BUTTONS,modeDetents:MODE_HITS,rangeDetents:RANGE_HITS});
})();