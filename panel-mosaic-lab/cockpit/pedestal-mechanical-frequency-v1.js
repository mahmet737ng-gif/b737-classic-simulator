/* B737 Classic VHF rotating-drum frequency displays, photographic pedestal.
 * Owner-provided 5-number mechanical windows: three MHz digits + decimal + two fraction digits.
 * Source: LHT LAN 737CL ATA23 VHF 118.000-136.975 MHz, ATA34 NAV 108.00-117.95 MHz.
 * 25 kHz COM channels use a 2-digit legacy display (e.g. 118.025 reads 118.02).
 * Exact channel remains in integer kHz; this readout does NOT simulate RF transmission.
 */
(function(root){
'use strict';
const VERSION='PD-ROLLING-FREQUENCY-0003';
const CHANNELS={COMM:{min:118000,max:136975,step:25},NAV:{min:108000,max:117950,step:50}};
const WINDOWS=[
 {id:'comm-capt-left',plate:'vhf-comm-capt',kind:'COMM',seat:'CAPT',rect:[215,167,395,161],dim:[1799,815],index:'bar'},
 {id:'comm-capt-right',plate:'vhf-comm-capt',kind:'COMM',seat:'CAPT',rect:[1117,167,405,161],dim:[1799,815],index:'wedge'},
 {id:'comm-fo-left',plate:'vhf-comm-fo',kind:'COMM',seat:'FO',rect:[215,167,395,161],dim:[1799,815],index:'bar'},
 {id:'comm-fo-right',plate:'vhf-comm-fo',kind:'COMM',seat:'FO',rect:[1117,167,405,161],dim:[1799,815],index:'wedge'},
 {id:'nav-capt-manual',plate:'vhf-nav-capt',kind:'NAV',seat:'CAPT',rect:[1103,142,462,182],dim:[1799,813],index:'bar'},
 {id:'nav-fo-manual',plate:'vhf-nav-fo',kind:'NAV',seat:'FO',rect:[1103,142,462,182],dim:[1799,813],index:'bar'},
 {id:'nav-capt-auto',plate:'vhf-nav-capt',kind:'NAV',seat:'CAPT',rect:[214,142,458,182],dim:[1799,813],index:'none',automatic:true},
 {id:'nav-fo-auto',plate:'vhf-nav-fo',kind:'NAV',seat:'FO',rect:[214,142,458,182],dim:[1799,813],index:'none',automatic:true}
];
// The legacy mechanical NAV AUTO readout must not show unsupported dashes on
// initial mount. 110.30 MHz is a training seed until a valid FMC auto-tune
// event provides the actual current AUTO selection for that seat.
const DEFAULT_NAV_AUTO_KHZ=110300;
const live=new Map(),auto=new Map([
 ['CAPT',DEFAULT_NAV_AUTO_KHZ],['FO',DEFAULT_NAV_AUTO_KHZ]
]),autoFromFmc=new Set();
function valid(kind,khz){
 const c=CHANNELS[kind];
 return !!c&&Number.isInteger(khz)&&khz>=c.min&&khz<=c.max&&khz%c.step===0;
}
function exact(khz){return (khz/1000).toFixed(3)}
function display(khz){
 if(khz==null)return '---.--';
 const mhz=Math.floor(khz/1000),fraction=Math.floor(khz%1000/10);
 return String(mhz).padStart(3,'0')+'.'+String(fraction).padStart(2,'0');
}
function node(tag,cls,parent){
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(parent)parent.append(e);return e;
}
function buildWheel(parent){
 const wheel=node('span','pd-freq-wheel',parent);
 wheel.setAttribute('aria-hidden','true');
 return wheel;
}
function setWheel(wheel,next,old,forward){
 wheel.replaceChildren();
 const strip=node('span','pd-freq-strip',wheel);
 if(old!=null&&old!==next&&/\d/.test(old)&&/\d/.test(next)){
  strip.classList.add(forward?'pd-freq-roll-up':'pd-freq-roll-down');
  const shown=forward?[old,next,String((Number(next)+1)%10)]:
   [String((Number(next)+9)%10),next,old];
  for(const glyph of shown)node('span','pd-freq-glyph',strip).textContent=glyph;
 }else{
  const n=/\d/.test(next)?Number(next):null;
  for(const glyph of [n===null?next:String((n+9)%10),next,n===null?next:String((n+1)%10)])
   node('span','pd-freq-glyph',strip).textContent=glyph;
 }
}
function refresh(item,khz,motion){
 if(khz!=null&&!valid(item.spec.kind,khz))return false;
 const shown=display(khz),prior=item.shown;
 if(prior===shown&&item.value===khz)return true;
 // Use the physical rotation direction even at the numeric wrap-around: e.g.
 // 108 <- 117 (left swipe) must roll backward although the total MHz increases.
 const forward=motion?.direction?motion.direction>0:
   (khz!=null&&item.value!=null?khz>item.value:true);
 for(let i=0,j=0;i<shown.length;i++){
  if(i===3)continue;
  if(!prior||shown[i]!==prior[i])setWheel(item.wheels[j],shown[i],prior?prior[i]:null,forward);
  j++;
 }
 item.shown=shown;item.value=khz;
 item.root.dataset.frequencyKhz=khz===null?'':String(khz);
 item.root.dataset.frequencyMhz=khz===null?'':exact(khz);
 item.root.title=khz===null?'Not automatically tuned':'Exact frequency: '+exact(khz)+' MHz';
 item.root.setAttribute('aria-label',item.spec.seat+' '+item.spec.kind+
   (item.spec.automatic?' AUTO':'')+' frequency '+(khz===null?'not available':exact(khz)+' megahertz'));
 return true;
}
function create(spec,frame){
 if(live.has(spec.id)&&live.get(spec.id).root.isConnected)return true;
 const box=node('div','pd-freq-mechanical',frame);
 box.dataset.mechanicalFrequency=spec.id;
 box.dataset.kind=spec.kind;
 box.dataset.index=spec.index;
 box.setAttribute('role','img');
 const [x,y,w,h]=spec.rect,[sw,sh]=spec.dim;
 Object.assign(box.style,{left:100*x/sw+'%',top:100*y/sh+'%',
   width:100*w/sw+'%',height:100*h/sh+'%'});
 const glass=node('span','pd-freq-glass',box);
 const wheels=[];
 for(let i=0;i<5;i++){
  if(i===3)node('span','pd-freq-dot',glass).textContent='.';
  wheels.push(buildWheel(glass));
 }
 node('span','pd-freq-index',box);
 const item={spec,root:box,wheels,shown:null,value:null};
 live.set(spec.id,item);
 const state=root.B737UnifiedVHFDualV1?.getState?.(spec.id);
 const preset=spec.automatic?(auto.get(spec.seat)??DEFAULT_NAV_AUTO_KHZ):
  (state?.frequencyKhz??(spec.kind==='COMM'?118000:110300));
 if(spec.automatic)box.dataset.autoSource=autoFromFmc.has(spec.seat)?'fmc':'training-seed';
 refresh(item,preset);
 return true;
}
function mount(){
 let count=0;
 for(const spec of WINDOWS){
  const frame=document.querySelector('#unified-pedestal-faceplates [data-faceplate="'+spec.plate+'"]');
  if(frame&&create(spec,frame))count++;
 }
 return count===WINDOWS.length;
}
root.addEventListener('b737:unified-vhf-frequency',event=>{
 const d=event.detail||{},item=live.get(d.id);
 if(item&&d.kind===item.spec.kind&&valid(d.kind,d.frequencyKhz))refresh(item,d.frequencyKhz,d);
});
// FMC/avionics can supply NAV AUTO without changing manual tuning.
root.addEventListener('b737:nav-auto-frequency',event=>{
 const d=event.detail||{};
 if(!['CAPT','FO'].includes(d.seat)||!valid('NAV',d.frequencyKhz))return;
 auto.set(d.seat,d.frequencyKhz);
 autoFromFmc.add(d.seat);
 const item=live.get('nav-'+d.seat.toLowerCase()+'-auto');
 if(item){item.root.dataset.autoSource='fmc';refresh(item,d.frequencyKhz);}
});
function start(){
 if(mount())return;
 const watch=new MutationObserver(()=>{if(mount())watch.disconnect()});
 watch.observe(document.body,{childList:true,subtree:true});
}
root.addEventListener('b737:cockpit-mounted',mount);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
root.B737UnifiedMechanicalFrequencyV1=Object.freeze({
 version:VERSION,windows:WINDOWS,channels:CHANNELS,defaultNavAutoKhz:DEFAULT_NAV_AUTO_KHZ,mount,display,valid,
 getState:id=>{const item=live.get(id);return item?{frequencyKhz:item.value,display:item.shown,
  source:item.spec.automatic?(autoFromFmc.has(item.spec.seat)?'fmc':'training-seed'):'manual'}:null;},
 setNavAuto:(seat,khz)=>{
  if(!['CAPT','FO'].includes(seat)||!valid('NAV',khz))return false;
  auto.set(seat,khz);autoFromFmc.add(seat);
  const item=live.get('nav-'+seat.toLowerCase()+'-auto');
  if(item){item.root.dataset.autoSource='fmc';refresh(item,khz);}
  return true;
 }
});
})(window);
