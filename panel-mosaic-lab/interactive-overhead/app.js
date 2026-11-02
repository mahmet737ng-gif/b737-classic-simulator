(function(){
 'use strict';
 const entryURL=document.currentScript.src,localURL=p=>new URL(p,entryURL).href;
 // ANTI ICE Lab uses the same locked sprites and toggle engine but a
 // separate persistence namespace. Training never writes live cockpit toggles.
 const STORAGE='b737-overhead-toggles-TGL-0001'+(new URLSearchParams(location.search).has('antiiceLab')?'-lab':'');
 const byId=id=>document.getElementById(id),model=window.B737OverheadToggleModel;
 // One directly supplied transparent atlas, no old sprite families or background repair.
 const SPRITE_CELL=1024,SPRITE_BEZEL=390;
 const poseFrames=c=>c.axis==='horizontal'?[0,1,2]:(c.states.length===2?[3,4]:[3,1,4]);
 let registry,engine,active=null,layer;
 const nodes=new Map(),interlocks=new Map();
 function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(engine.snapshot()));}catch{}}
 function refreshOne(c){
  const button=nodes.get(c.id);if(!button)return;
  const value=engine.get(c.id),index=c.states.indexOf(value);
  button.setAttribute('aria-disabled',String(interlocks.get(c.id)===false));
  button.dataset.state=value;button.setAttribute('aria-valuenow',String(index));button.setAttribute('aria-valuetext',value);button.setAttribute('aria-label',c.label+' — '+value);
  if(c.id==='emergency-exit-lights'){
   button.dataset.photoOwner='OH14-OPERABLE-FIXED-0017';
   button.title='EMER EXIT LIGHTS — '+value+' · Black Guarded';
   // A live, independent Small Silver pose sits over the invariant black housing.
   const moving=button._oh14SilverVisual;
   if(moving&&index>=0){
    moving.style.backgroundPosition=(poseFrames(c)[index]*25)+'% 50%';
    const hit=button._oh14LeverHit;
    if(hit){
     hit.dataset.state=value;
     hit.setAttribute('aria-valuenow',String(index));
     hit.setAttribute('aria-valuetext',value);
     hit.setAttribute('aria-label','EMER EXIT LIGHTS — '+value);
    }
   }
   button._refreshGuard?.();
  }
  const sprite=button.querySelector('.toggle-sprite');
  if(sprite&&index>=0){
   const frame=poseFrames(c)[index];
   const down=frame===4;
   if(c.visualFamily==='Small'||c.visualFamily==='Small Silver'){
    // Both Small atlases share one calibrated pivot: never invent hardware.
    const small=registry.visualFamilies[c.visualFamily];
    sprite.style.backgroundImage='url("'+localURL(small.asset)+'")';
    sprite.style.backgroundSize='500% 100%';
    sprite.style.backgroundPosition=(frame*25)+'% 50%';
   }else{
    // Locked Standard uses its individually corrected DOWN reference.
    const asset=registry.assets[down?'vertical-off':'vertical-on'];
    sprite.style.backgroundImage='url("'+localURL(asset.url)+'")';
    sprite.style.backgroundSize=down?'100% 100%':'500% 100%';
    sprite.style.backgroundPosition=down?'50% 50%':(frame*25)+'% 50%';
   }
  }
  if(active===c.id){byId('toggleState').textContent=value;for(const b of byId('toggleStates').children){b.classList.toggle('active',b.dataset.state===value);b.disabled=interlocks.get(c.id)===false;}}
 }
 function select(c){
  if(active===c.id)return;
  active=c.id;byId('selectedToggle').textContent=c.label;const group=byId('toggleStates');group.replaceChildren();
  for(const state of c.states){
   const button=document.createElement('button');button.type='button';button.textContent=state;button.dataset.state=state;
   if(c.springReturn?.[state]){
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);engine.set(c.id,state,'state-hold');});
    for(const event of ['pointerup','pointercancel','lostpointercapture','blur'])button.addEventListener(event,()=>engine.release(c.id));
    button.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();engine.set(c.id,state,'state-key-hold');}});
    button.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();engine.release(c.id);}});
   }else button.onclick=()=>engine.set(c.id,state,'state-button');
   group.append(button);
  }
  refreshOne(c);
 }
 function bind(c,button){
  let gesture=null,releaseTimer=null;
  const cancelTimer=()=>{clearTimeout(releaseTimer);releaseTimer=null;};
  const axis=e=>c.axis==='horizontal'?e.clientX:e.clientY;
  function nearest(e){const b=button.getBoundingClientRect(),v=c.axis==='horizontal'?(e.clientX-b.left)/b.width:(e.clientY-b.top)/b.height;return Math.max(0,Math.min(c.states.length-1,Math.floor(v*c.states.length)));}
  button.addEventListener('pointerdown',e=>{
   if(e.button!==0)return;e.preventDefault();e.stopPropagation();cancelTimer();select(c);button.focus({preventScroll:true});button.setPointerCapture(e.pointerId);
   gesture={pointer:e.pointerId,at:axis(e),index:c.states.indexOf(engine.get(c.id)),moved:false};
   if(c.springReturn)engine.set(c.id,c.states[nearest(e)],'hold');
  });
  button.addEventListener('pointermove',e=>{
   if(!gesture||gesture.pointer!==e.pointerId)return;e.stopPropagation();
   const delta=axis(e)-gesture.at,b=button.getBoundingClientRect(),size=c.axis==='horizontal'?b.width:b.height;
   if(Math.abs(delta)>Math.max(4,size*.12)){
    gesture.moved=true;
    const step=Math.round(delta/Math.max(8,size*.28));engine.set(c.id,c.states[Math.max(0,Math.min(c.states.length-1,gesture.index+step))],'drag');
   }
  });
  function finish(e,cancelled){
   if(!gesture||gesture.pointer!==e.pointerId)return;e.stopPropagation();
   if(!cancelled&&!gesture.moved&&!c.springReturn){if(c.id==='emergency-exit-lights'||c.states.length===2)engine.cycle(c.id);else engine.set(c.id,c.states[nearest(e)],'tap');}
   gesture=null;engine.release(c.id);
  }
  button.addEventListener('pointerup',e=>finish(e,false));button.addEventListener('pointercancel',e=>finish(e,true));
  button.addEventListener('lostpointercapture',e=>finish(e,true));
  button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(e.detail===0){select(c);engine.cycle(c.id);if(c.springReturn)releaseTimer=setTimeout(()=>engine.release(c.id),180);}});
  button.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();select(c);engine.step(c.id,Math.sign(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY),'wheel');if(c.springReturn){cancelTimer();releaseTimer=setTimeout(()=>engine.release(c.id),180);}},{passive:false});
  button.addEventListener('keydown',e=>{
   const keys=c.axis==='horizontal'?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'];
   if([...keys,'Home','End',' ','Enter'].includes(e.key)){
    e.preventDefault();e.stopPropagation();cancelTimer();select(c);
    if(e.repeat&&[' ','Enter'].includes(e.key))return;
    if(e.key==='Home')engine.set(c.id,c.states[0],'key');else if(e.key==='End')engine.set(c.id,c.states.at(-1),'key');else if(e.key===' '||e.key==='Enter')engine.cycle(c.id);else engine.step(c.id,e.key===keys[0]?-1:1,'key');
   }
  });
  button.addEventListener('keyup',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End',' ','Enter'].includes(e.key)){e.preventDefault();engine.release(c.id);}});
  button.addEventListener('blur',()=>{cancelTimer();gesture=null;engine.release(c.id);});
 }
 function mount(layout){
  layer=document.createElement('div');layer.className='toggle-layer';layer.id='overheadToggleLayer';
  const placements=new Map(layout.placements.map(p=>[p.id,p]));
  for(const c of registry.controls){
   const p=model.mapPoint(c,placements.get(c.placementId)),button=document.createElement('button');
   button.type='button';button.className='mounted-toggle';button.id='toggle-'+c.id;button.dataset.control=c.id;button.dataset.axis=c.axis;button.dataset.placement=c.placementId;button.dataset.visualFamily=c.visualFamily||'Standard';
   button.setAttribute('role','slider');button.setAttribute('aria-orientation',c.axis);button.setAttribute('aria-valuemin','0');button.setAttribute('aria-valuemax',String(c.states.length-1));button.title=c.label;
   Object.assign(button.style,{left:p.x+'px',top:p.y+'px',width:(p.diameter*1.65)+'px',height:(p.diameter*1.65)+'px'});
   // OH14 reuses its registered Small Silver three-position actuator.
   const photoOnly=c.id==='emergency-exit-lights';
   if(c.interactionSourceRect){
    const [hx,hy,hw,hh]=c.interactionSourceRect;
    const corner=(x,y)=>model.mapPoint({...c,sourcePoint:[x,y],bezelSourceDiameter:1},placements.get(c.placementId));
    const a=corner(hx,hy),b=corner(hx+hw,hy+hh);
    Object.assign(button.style,{left:a.x+'px',top:a.y+'px',width:(b.x-a.x)+'px',height:(b.y-a.y)+'px',transform:'none'});
   }
   // Render the existing registered Small Silver 5-position image on OH14,
   // while reusing the immutable OFF/ARMED/ON state and lamp coupling.
   const sprite=document.createElement('span');
   sprite.className='toggle-sprite';sprite.setAttribute('aria-hidden','true');
   const fullSize=p.diameter*SPRITE_CELL/SPRITE_BEZEL;
   Object.assign(sprite.style,{width:fullSize+'px',height:fullSize+'px',
     backgroundImage:'url("'+localURL(registry.visualFamilies[c.visualFamily]?.asset||registry.assets['vertical-on'].url)+'")'});
   if(photoOnly&&c.interactionSourceRect){
    const [sx,sy]=c.interactionSourceRect;
    const a=model.mapPoint({...c,sourcePoint:[sx,sy],bezelSourceDiameter:1},placements.get(c.placementId));
    Object.assign(sprite.style,{left:(p.x-a.x)+'px',top:(p.y-a.y)+'px'});
   }
   button.append(sprite);
   layer.append(button);nodes.set(c.id,button);bind(c,button);refreshOne(c);
   if(photoOnly){
    // A separate hinged cover is a physical child of the OH14 assembly, not
    // a second toggle and not an extra electrical/annunciator state.
    // Only the COVER is manipulated here; engine controls remain unchanged.
    const holder=document.createElement('div');
    holder.className='oh14-top-hinge-guard';
    holder.dataset.cover='open';
    const hood=document.createElement('button');
    hood.type='button';hood.className='oh14-top-hinge-lid';
    hood.title='EMER EXIT LIGHTS — black guard, top hinge · click to open/close';
    hood.setAttribute('aria-label','EMER EXIT LIGHTS top-hinged black guard');
    hood.setAttribute('aria-expanded','true');
    const photo=document.createElement('img');
    photo.alt='';photo.draggable=false;photo.setAttribute('aria-hidden','true');
    photo.className='oh14-guard-state-photo';
    // The owner's original top-hinged photo masters contain consistent
    // open and closed housings. The silver lever is a separate physical part:
    // never scale the guard when OFF, ARMED, or ON changes.
    const guardRoot='../assets/locked/2026-10-23/Switches/guard/runtime/';
    function renderGuard(){
     const file=holder.dataset.cover==='closed'?'Black_Guarded_CLOSED.png':'Black_Guarded_Open_CENTER.png';
     const url=localURL(guardRoot+file);
     if(photo.src!==url)photo.src=url;
    }
    button._refreshGuard=renderGuard;
    const silver=document.createElement('span');
    silver.className='oh14-small-silver-live';
    silver.setAttribute('aria-hidden','true');
    silver.style.backgroundImage='url("'+localURL(registry.visualFamilies['Small Silver'].asset)+'")';
    const leverHit=document.createElement('button');
    leverHit.type='button';leverHit.className='oh14-lever-hit';
    leverHit.setAttribute('role','slider');
    leverHit.setAttribute('aria-orientation','vertical');
    leverHit.setAttribute('aria-valuemin','0');
    leverHit.setAttribute('aria-valuemax','2');
    leverHit.title='EMER EXIT LIGHTS — operate OFF / ARMED / ON';
    button._oh14SilverVisual=silver;
    button._oh14LeverHit=leverHit;
    // Reuse the existing registered engine. This is an additional input
    // surface for the same switch, NOT a duplicate state or control.
    bind(c,leverHit);
    holder.append(photo,hood,silver,leverHit);
    // Match the precise hardware envelope from the existing retired OH14
    // guard socket, not the deliberately larger invisible interaction hitbox.
    const plate=placements.get('OH14');
    const guardCorner=(x,y)=>model.mapPoint({...c,sourcePoint:[x,y],bezelSourceDiameter:1},plate);
    // Screenshot red box 132x405, projected to the OH14 1074x1464 source.
    // Exactly the same holder is used for all four source PNGs, at every zoom.
    // This stays inside the existing unmodified [445,150,330,760] hit zone.
    const OH14_FIXED_SOURCE_RECT=Object.freeze([452,163,748,876]);
    const ga=guardCorner(OH14_FIXED_SOURCE_RECT[0],OH14_FIXED_SOURCE_RECT[1]);
    const gb=guardCorner(OH14_FIXED_SOURCE_RECT[2],OH14_FIXED_SOURCE_RECT[3]);
    Object.assign(holder.style,{
      left:ga.x+'px',top:ga.y+'px',
      width:(gb.x-ga.x)+'px',height:(gb.y-ga.y)+'px'
    });
    holder.dataset.fixedGeometry='OH14-OPERABLE-FIXED-0017';
    const silverSize=p.diameter*SPRITE_CELL/SPRITE_BEZEL;
    Object.assign(silver.style,{
     left:(p.x-ga.x)+'px',top:(p.y-ga.y)+'px',
     width:silverSize+'px',height:silverSize+'px'
    });
    function setCover(open){
     holder.dataset.cover=open?'open':'closed';
     hood.setAttribute('aria-expanded',String(open));
     hood.title='EMER EXIT LIGHTS — top-hinged black guard ('+(open?'OPEN':'CLOSED')+')';
     button.dataset.cover=open?'open':'closed';
     button.tabIndex=open?0:-1;
     button.setAttribute('aria-disabled',String(!open));
     // Never let the obsolete oversized transparent button intercept OH14.
     button.style.pointerEvents='none';
     leverHit.disabled=!open;
     leverHit.style.pointerEvents=open?'auto':'none';
     silver.style.visibility=open?'visible':'hidden';
     renderGuard();
    }
    // No events from the guard are allowed to cycle the three-detent switch.
    hood.addEventListener('pointerdown',e=>e.stopPropagation());
    hood.addEventListener('pointerup',e=>e.stopPropagation());
    hood.addEventListener('click',e=>{e.stopPropagation();e.preventDefault();setCover(holder.dataset.cover!=='open')});
    hood.addEventListener('keydown',e=>{
     if(e.key==='Escape'){e.stopPropagation();e.preventDefault();setCover(false)}
    });
    setCover(true);layer.append(holder);refreshOne(c);
   }
  }
  byId('atlasAbsolute').append(layer);
  byId('toggleCount').textContent=registry.controls.length+' تاگل تعاملی · رفرنس جدید · '+registry.version;
  byId('toggleVisibility').onchange=e=>layer.classList.toggle('hidden',!e.target.checked);
  byId('resetToggles').onclick=()=>{engine.releaseAll();engine.reset();persist();byId('toggleState').textContent='RESET';};
  select(registry.controls.find(c=>c.id==='vhf-nav'));
  persist();
  window.B737OverheadToggles=Object.freeze({getState:()=>engine.snapshot(),getRegistry:()=>JSON.parse(JSON.stringify(registry)),baseVersion:registry.baseVersion,setInterlock:(id,enabled)=>{interlocks.set(id,!!enabled);if(!enabled)engine.release(id);const c=registry.controls.find(c=>c.id===id);if(c)refreshOne(c);}});
  window.addEventListener('blur',()=>engine.releaseAll());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)engine.releaseAll();});
  requestAnimationFrame(()=>{const scale=byId('board').getBoundingClientRect().width/layout.canvas.width;byId('viewport').scrollTop=layout.firstLowerRowY*scale;});
 }
 async function start(){
  try{
   const [rr,lr]=await Promise.all([fetch(localURL('registry.json'),{cache:'no-store'}),fetch(localURL('../all-overhead/atlas-layout.json'),{cache:'no-store'})]);
   if(!rr.ok||!lr.ok)throw Error('Toggle metadata unavailable');registry=await rr.json();const layout=await lr.json();model.validate(registry,layout);
   let saved={};try{saved=JSON.parse(localStorage.getItem(STORAGE)||'{}')||{};}catch{}
   engine=model.controller(registry,saved,event=>{const c=registry.controls.find(c=>c.id===event.id);refreshOne(c);persist();window.dispatchEvent(new CustomEvent('b737:switch-change',{detail:{...event,timestamp:new Date().toISOString()}}));},id=>interlocks.get(id)!==false);
   const root=byId('atlasAbsolute');
   if(root.querySelector('.atlas-piece'))mount(layout);
   else{const observer=new MutationObserver(()=>{if(root.querySelector('.atlas-piece')){observer.disconnect();mount(layout);}});observer.observe(root,{childList:true});}
  }catch(error){console.error(error);byId('toggleCount').textContent='خطا در نصب سوییچ‌ها: '+error.message;byId('toggleCount').setAttribute('role','alert');}
 }
 start();
})();
