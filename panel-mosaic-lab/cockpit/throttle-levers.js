(function(){
'use strict';
const CONFIG={"schema":"b737.throttle-five-position-v1","version":"THR-0005","relativeAssetRoot":"../assets/throttle-levers/","engineSourceCenters":{"1":478,"2":570},"backgroundSource":{"width":1145,"height":1373},"stages":{"0":{"name":"idle","sourceY":1088},"25":{"name":"quarter","sourceY":856},"50":{"name":"mid","sourceY":642},"75":{"name":"three-quarter","sourceY":430},"100":{"name":"full","sourceY":220}},"gripWidthNative":138,"note":"THR-0005: both throttle visual stages use slot-registered centers and five fixed Y anchors. Existing approved PNGs and locked quadrant are unmodified.","sprites":{"engine-1-idle.png":{"anchor":[0.5,0.9],"gripWidth":640},"engine-1-quarter.png":{"anchor":[0.5,0.88],"gripWidth":655},"engine-1-mid.png":{"anchor":[0.5,0.83],"gripWidth":760},"engine-1-three-quarter.png":{"anchor":[0.5,0.78],"gripWidth":760},"engine-1-full.png":{"anchor":[0.5,0.73],"gripWidth":650},"engine-2-idle.png":{"anchor":[0.5,0.9],"gripWidth":640},"engine-2-quarter.png":{"anchor":[0.5,0.88],"gripWidth":655},"engine-2-mid.png":{"anchor":[0.5,0.83],"gripWidth":760},"engine-2-three-quarter.png":{"anchor":[0.5,0.78],"gripWidth":760},"engine-2-full.png":{"anchor":[0.5,0.73],"gripWidth":650}}};
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
 Object.assign(hit.style,{
  left:(x-48)+'px',
  top:(tex.offsetTop+78)+'px',
  width:'96px',
  height:'585px'
 });
 root.append(hit);controls.set(engine,{sprite:sprites,visual:hit,select:null});
}
function mountPlasticCover(tex){
 if(root.querySelector('.throttle-plastic-cover'))return;
 // THR-0005: corrected slot-based placement (owner screenshot, 2026-10-25).
 // Cover is aligned to the two central throttle roller tracks; all coordinates are
 // original 1145x1373 quadrant-image pixels, not viewport/mobile CSS pixels.
 // This stays behind throttle sprites, with the locked plate unmodified.
 const sourceRect={x:388,y:176,w:224,h:648};
 const sourceWindow={x:20,y:30,w:1055,h:1290};
 const unit=tex.offsetWidth/sourceWindow.w;
 const cover=document.createElement('img');
 cover.className='throttle-plastic-cover';
 cover.alt='';
 cover.draggable=false;
 cover.decoding='async';
 cover.src=CONFIG.relativeAssetRoot+'throttle-plastic-cover.svg?v=THR-0005';
 Object.assign(cover.style,{
  left:(tex.offsetLeft+(sourceRect.x-sourceWindow.x)*unit)+'px',
  top:(tex.offsetTop+(sourceRect.y-sourceWindow.y)*unit)+'px',
  width:(sourceRect.w*unit)+'px',height:(sourceRect.h*unit)+'px'
 });
 // The cover is behind all throttle sprites and does not intercept controls.
 root.append(cover);
}
async function mount(){
 if(mounted)return;root=document.querySelector('#region-pedestal .region-native');
 texture=root?.querySelector('[data-piece="throttle-quadrant"]');
 if(!root||!texture)return;
 mountPlasticCover(texture);
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