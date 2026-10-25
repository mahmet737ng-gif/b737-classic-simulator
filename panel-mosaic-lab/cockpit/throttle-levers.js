(function(){
'use strict';
const CONFIG={"schema":"b737.throttle-five-position-v1","version":"THR-0001","relativeAssetRoot":"../assets/throttle-levers/","engineSourceCenters":{"1":465,"2":680},"backgroundSource":{"width":1145,"height":1373},"stages":{"0":{"name":"idle","sourceY":1060},"25":{"name":"quarter","sourceY":770},"50":{"name":"mid","sourceY":565},"75":{"name":"three-quarter","sourceY":360},"100":{"name":"full","sourceY":160}},"gripWidthNative":114,"note":"Owner visual stage pack. Position/scale calibration is provisional pending on-panel verification. No underlying panel/locked bitmap is changed.","sprites":{"engine-1-idle.png":{"anchor":[0.5,0.9],"gripWidth":790},"engine-2-idle.png":{"anchor":[0.53,0.9],"gripWidth":790},"engine-1-quarter.png":{"anchor":[0.49,0.84],"gripWidth":800},"engine-2-quarter.png":{"anchor":[0.52,0.86],"gripWidth":800},"engine-1-mid.png":{"anchor":[0.5,0.76],"gripWidth":1240},"engine-2-mid.png":{"anchor":[0.51,0.76],"gripWidth":1040},"engine-1-three-quarter.png":{"anchor":[0.5,0.38],"gripWidth":1180},"engine-2-three-quarter.png":{"anchor":[0.5,0.37],"gripWidth":1140},"engine-1-full.png":{"anchor":[0.5,0.13],"gripWidth":590},"engine-2-full.png":{"anchor":[0.5,0.13],"gripWidth":590}}};
const KEYS=Object.freeze([0,25,50,75,100]);
const position={1:0,2:0};
const images={};
const controls=new Map();
let mounted=false,root=null,piece=null,texture=null;
function filename(engine,pct){return 'engine-'+engine+'-'+CONFIG.stages[String(pct)].name+'.png';}
function path(engine,pct){return CONFIG.relativeAssetRoot+filename(engine,pct);}
function fire(engine){document.dispatchEvent(new CustomEvent('b737:throttle-position',{detail:{engine,percent:position[engine],stage:CONFIG.stages[String(position[engine])].name,source:'PEDESTAL'}}));}
function snap(pct){return KEYS.reduce((a,b)=>Math.abs(b-pct)<Math.abs(a-pct)?b:a,0);}
function apply(engine,pct,source){
 const next=snap(Number(pct));if(!KEYS.includes(next))return;
 position[engine]=next;
 const c=controls.get(engine);if(c){
  for(const [key,object] of c.sprite.entries())object.style.display=key===next?'block':'none';
  c.select.value=String(next);
  c.visual.dataset.position=String(next);
  c.visual.setAttribute('aria-label','Engine '+engine+' throttle '+next+' percent');
 }
 if(source!=='sim')fire(engine);
}
function buildControls(){
 const toolbar=document.querySelector('.toolbar .tools:last-child')||document.querySelector('.toolbar');
 if(!toolbar||document.getElementById('throttle-position-controls'))return;
 const holder=document.createElement('div');holder.id='throttle-position-controls';holder.className='throttle-position-controls';holder.dir='ltr';
 [1,2].forEach(engine=>{
  const group=document.createElement('label');group.className='throttle-position-group';
  group.append(document.createTextNode('THR '+engine));
  const select=document.createElement('select');select.setAttribute('aria-label','Engine '+engine+' throttle position');
  for(const value of KEYS){const o=document.createElement('option');o.value=String(value);o.textContent=value===0?'IDLE':value===25?'¼':value===50?'MID':value===75?'¾':'FULL';select.append(o);}
  select.value='0';select.onchange=()=>apply(engine,Number(select.value),'user');
  group.append(select);holder.append(group);
  const c=controls.get(engine);if(c)c.select=select;
 });
 toolbar.append(holder);
}
function createSprite(engine,pct,tex){
 const p=CONFIG.stages[String(pct)];
 const name=filename(engine,pct),image=images[name],cal=CONFIG.sprites[name];
 const scale=CONFIG.gripWidthNative/cal.gripWidth;
 const visual=document.createElement('img');visual.src=image.src;visual.alt='';visual.draggable=false;
 visual.className='throttle-state-sprite';
 const x=CONFIG.engineSourceCenters[engine];
 // The panel's already-calibrated source window is reused; this never modifies the locked plate.
 const baseScale=tex.offsetWidth/1055;
 const centerX=tex.offsetLeft+(x-20)*baseScale;
 const centerY=tex.offsetTop+(p.sourceY-30)*baseScale;
 Object.assign(visual.style,{left:(centerX-image.naturalWidth*cal.anchor[0]*scale)+'px',
    top:(centerY-image.naturalHeight*cal.anchor[1]*scale)+'px',
    width:(image.naturalWidth*scale)+'px',
    height:(image.naturalHeight*scale)+'px',
    display:pct===0?'block':'none'});
 return visual;
}
function place(engine,tex){
 const hit=document.createElement('div');hit.className='throttle-sprite-hit';hit.setAttribute('role','slider');
 hit.tabIndex=0;hit.setAttribute('aria-valuemin','0');hit.setAttribute('aria-valuemax','100');
 hit.setAttribute('aria-valuenow','0');hit.setAttribute('aria-label','Engine '+engine+' throttle position');
 let down=null;
 hit.onpointerdown=e=>{if(e.button!==0&&e.pointerType==='mouse')return;e.stopPropagation();down={y:e.clientY,pointer:e.pointerId};hit.setPointerCapture(e.pointerId);};
 hit.onpointerup=e=>{e.stopPropagation();if(!down)return;const delta=e.clientY-down.y;down=null;
  if(Math.abs(delta)<12)return;
  const current=KEYS.indexOf(position[engine]);apply(engine,KEYS[Math.max(0,Math.min(KEYS.length-1,current+(delta<0?1:-1)))],'user');};
 hit.onpointercancel=()=>down=null;
 hit.onkeydown=e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();
  if(e.key==='Home')return apply(engine,0,'user');
  if(e.key==='End')return apply(engine,100,'user');
  const current=KEYS.indexOf(position[engine]);apply(engine,KEYS[Math.max(0,Math.min(4,current+(e.key==='ArrowUp'?1:-1)))],'user');};
 const sprites=new Map();
 for(const pct of KEYS){const img=createSprite(engine,pct,tex);root.append(img);sprites.set(pct,img);}
 // Hit area follows common section of sprite movement, avoiding overlap with engine-start levers below.
 const ref=CONFIG.engineSourceCenters[engine],scale=tex.offsetWidth/1055;
 const x=tex.offsetLeft+(ref-20)*scale;
 Object.assign(hit.style,{left:(x-60)+'px',top:(tex.offsetTop+60)+'px',width:'120px',height:'570px'});
 root.append(hit);controls.set(engine,{sprite:sprites,visual:hit,select:null});
}
async function mount(){
 if(mounted)return;root=document.querySelector('#region-pedestal .region-native');
 texture=root?.querySelector('[data-piece="throttle-quadrant"]');
 if(!root||!texture)return;
 try{
   const entries=[1,2].flatMap(e=>KEYS.map(p=>[filename(e,p),path(e,p)]));
   const loaded=await Promise.all(entries.map(async ([name,url])=>{
    const img=new Image();img.decoding='async';
    img.src=url;
    await img.decode();
    if(!img.naturalWidth||!img.naturalHeight)throw Error('Invalid PNG '+name);
    return [name,img];
   }));
   for(const [name,img] of loaded)images[name]=img;
 }catch(err){
   console.warn('THR-0001: Throttle sprites are not published; original cockpit artwork is preserved.',err);
   return;
 }
 mounted=true;place(1,texture);place(2,texture);buildControls();
 root.dispatchEvent(new CustomEvent('b737:throttle-sprites-ready',{detail:{engines:2,positions:KEYS.slice()}}));
}
window.addEventListener('b737:cockpit-mounted',mount,{once:true});
document.addEventListener('b737:throttle-state',event=>{
 const d=event.detail||{};if([1,2].includes(d.engine)&&Number.isFinite(d.percent)&&mounted)apply(d.engine,d.percent,'sim');
});
window.B737ThrottlePositions=Object.freeze({get:engine=>position[engine],set:(engine,value)=>[1,2].includes(engine)&&apply(engine,value,'user'),mounted:()=>mounted,positions:KEYS});
})();