/* Thrust quadrant, registered in pixels of the installed 800 × 1000 photo. */
(function(win){
'use strict';
const doc=win.document;
const STOPS=[0,25,50,75,100], NAMES=['idle','quarter','mid','three-quarter','full'];
const CENTER=(322+437)/2, SEAM=-4;
const FULL=184, IDLE=652;
const WHITE_WIDTH=[137,135,127,117,108];
const positions={1:0,2:0}, controls=new Map();
// Each photo has its own crop and perspective. Register its metal shaft and
// white handgrip independently. The last pair locates the recessed button.
const PHOTO={
 1:[[.725,.884,.782,.717,.690],[.725,.855,.825,.725,.721],
    [.773,.765,.934,.766,.535],[.702,.383,.819,.696,.627],[.503,.123,.541,.507,.266]],
 2:[[.275,.884,.783,.282,.690],[.277,.855,.840,.269,.724],
    [.267,.769,.900,.254,.575],[.296,.392,.835,.300,.627],[.503,.123,.541,.507,.266]]
};
const clamp=n=>Math.max(0,Math.min(100,n));
const closest=n=>Math.round(n/25);
let layer,ready=false,mounting=false;
function box(el,x,y,w,h){
 Object.assign(el.style,{left:x/8+'%',top:y/10+'%',width:w/8+'%',height:h/10+'%'});
}
function paint(engine){
 const c=controls.get(engine);if(!c)return;
 const pct=positions[engine],requested=closest(pct);
 const k=c.poses[requested]?requested:c.poses.reduce((best,p,i)=>p&&(best<0||Math.abs(i-requested)<Math.abs(best-requested))?i:best,-1);
 if(k<0)return;
 const pose=c.poses[k],anchor=PHOTO[engine][k];
 const gripY=IDLE+(FULL-IDLE)*pct/100, width=WHITE_WIDTH[k]/anchor[2];
 const height=width*pose.naturalHeight/pose.naturalWidth;
 // The inner edges meet at the seam when throttle positions match.
 const gripCenterFraction=k===4?.5:engine===1?.484:.515;
 const gripX=CENTER+(engine===1?-1:1)*(WHITE_WIDTH[k]+SEAM)/2;
 const left=gripX-width*gripCenterFraction,top=gripY-height*anchor[1];
 if(c.stage!==k){
  if(c.stage!==undefined)c.poses[c.stage].style.display='none';
  pose.style.display='block';c.stage=k;
 }
 box(pose,left,top,width,height);
 const buttonX=left+width*anchor[3],buttonY=top+height*anchor[4];
 const btnSize=k<2?width*.134:18;
 box(c.toga,buttonX-btnSize*.78,buttonY-btnSize*.78,btnSize*1.56,btnSize*1.56);
 c.toga.classList.toggle('show-recess',k>=2);
 // The grip hit area travels with the handgrip, clear of the opposite lever.
 const hitWidth=WHITE_WIDTH[k]+SEAM/2;
 const hitLeft=engine===1?CENTER-hitWidth:CENTER;
 box(c.hit,hitLeft,gripY-24,hitWidth,48);
 c.hit.dataset.position=String(pct);c.hit.setAttribute('aria-valuenow',String(pct));
 c.hit.setAttribute('aria-valuetext',pct+' percent');
 if(c.select)c.select.value=STOPS.includes(pct)?String(pct):'';
}
function apply(engine,value,source){
 if(![1,2].includes(engine)||!Number.isFinite(value))return false;
 const pct=Math.round(clamp(value)*10)/10;positions[engine]=pct;paint(engine);
 if(source==='user')doc.dispatchEvent(new CustomEvent('b737:throttle-position',{
  detail:{engine,percent:pct,stage:NAMES[closest(pct)],source:'PEDESTAL'}}));
 return true;
}
function addControls(engine,poses){
 const hit=doc.createElement('div'),toga=doc.createElement('button');
 hit.className='throttle-sprite-hit';hit.tabIndex=0;hit.setAttribute('role','slider');
 hit.setAttribute('aria-label','Engine '+engine+' thrust lever');
 hit.setAttribute('aria-valuemin','0');hit.setAttribute('aria-valuemax','100');hit.setAttribute('aria-orientation','vertical');
 let drag=null;
 hit.onpointerdown=e=>{
  if(e.button!==0||drag)return;
  e.preventDefault();e.stopPropagation();const height=layer.getBoundingClientRect().height;
  if(height<=0)return;
  drag={id:e.pointerId,y:e.clientY,pct:positions[engine],travel:height*(IDLE-FULL)/1000};
  hit.setPointerCapture(e.pointerId);
 };
 hit.onpointermove=e=>{
  if(e.pointerId!==drag?.id)return;
  e.preventDefault();e.stopPropagation();
  apply(engine,drag.pct+(drag.y-e.clientY)*100/drag.travel,'user');
 };
 hit.onpointerup=hit.onpointercancel=hit.onlostpointercapture=e=>{if(e.pointerId===drag?.id)drag=null;};
 hit.onkeydown=e=>{
  const pct=positions[engine],value={Home:0,End:100,ArrowUp:pct+1,ArrowDown:pct-1,PageUp:pct+10,PageDown:pct-10}[e.key];
  if(value===undefined)return;e.preventDefault();e.stopPropagation();apply(engine,value,'user');
 };
 toga.type='button';toga.className='throttle-toga-push';toga.dataset.engine=String(engine);
 toga.setAttribute('aria-label','Press TO/GA switch on throttle '+engine);toga.title='TO/GA '+engine;
 toga.addEventListener('pointerdown',e=>e.stopPropagation());
 toga.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  win.dispatchEvent(new CustomEvent('b737:toga-request',{detail:{source:'THROTTLE_'+engine,engine}}));
 });
 layer.append(hit,toga);controls.set(engine,{poses,hit,toga});
}
function buildSelectors(){
 const bar=doc.querySelector('.toolbar .tools:last-child')||doc.querySelector('.toolbar');
 if(!bar||doc.getElementById('throttle-position-controls'))return;
 const holder=doc.createElement('div');holder.id='throttle-position-controls';holder.className='throttle-position-controls';holder.dir='ltr';
 for(const [engine,c] of controls){
  const label=doc.createElement('label'),select=doc.createElement('select');label.className='throttle-position-group';
  label.append('THR '+engine);select.setAttribute('aria-label','Engine '+engine+' throttle position');
  for(const pct of STOPS)select.add(new Option(pct===0?'IDLE':pct===100?'FULL':pct+'%',String(pct)));
  const continuous=new Option('—','');continuous.hidden=true;select.add(continuous);
  select.onchange=()=>apply(engine,Number(select.value),'user');label.append(select);holder.append(label);c.select=select;
 }
 bar.append(holder);
}
async function load(engine,k){
 const img=new Image();img.alt='';img.draggable=false;img.decoding='async';img.className='throttle-state-sprite';
 img.src='../assets/throttle-levers/engine-'+engine+'-'+NAMES[k]+'.png';
 try{await img.decode();return img;}catch{return null;}
}
async function mount(){
 if(ready||mounting)return;
 const native=doc.querySelector('#region-pedestal .region-native'),plate=native?.querySelector('[data-piece="throttle-quadrant"]');
 if(!plate)return;mounting=true;
 try{
  const sets=await Promise.all([1,2].map(n=>Promise.all(STOPS.map((_,k)=>load(n,k)))));
  if(sets.some(set=>set.every(img=>!img))){native.dataset.throttleMount='missing-assets';return;}
  layer=doc.createElement('div');layer.className='throttle-quadrant-layer';
  const cover=doc.createElement('div');cover.className='throttle-plastic-cover';
  box(cover,346,170,67,515);layer.append(cover);plate.append(layer);
  sets.forEach((set,i)=>{for(const img of set)if(img){img.style.display='none';layer.append(img);}addControls(i+1,set);});
  buildSelectors();paint(1);paint(2);ready=true;
  native.dataset.throttleMount='ready';native.dataset.throttleMissingAssets=String(sets.flat().filter(img=>!img).length);
  native.dispatchEvent(new CustomEvent('b737:throttle-sprites-ready',{bubbles:true,detail:{engines:2,positions:STOPS.slice()}}));
 }finally{mounting=false;}
}
doc.addEventListener('b737:throttle-state',e=>apply(e.detail?.engine,e.detail?.percent,'sim'));
win.addEventListener('b737:manual-engine-throttle',e=>apply(e.detail?.engine,e.detail?.percent,'sim'));
win.addEventListener('b737:cockpit-mounted',mount);
win.addEventListener('load',mount,{once:true});queueMicrotask(mount);
for(const ms of [500,1800,5000])setTimeout(mount,ms);
win.B737ThrottlePositions=Object.freeze({get:engine=>positions[engine],set:(engine,pct)=>apply(engine,Number(pct),'user'),
 mounted:()=>ready,positions:STOPS,geometry:()=>({centers:{1:CENTER-WHITE_WIDTH[4]/2,2:CENTER+WHITE_WIDTH[4]/2},sourceWidth:800,gripWidthNative:WHITE_WIDTH[4]-1,fullY:FULL,idleY:IDLE,hasAddedTogaFace:false})});
})(window);
