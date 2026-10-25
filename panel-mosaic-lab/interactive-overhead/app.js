(function(){
 'use strict';
 const entryURL=document.currentScript.src,localURL=p=>new URL(p,entryURL).href;
 const STORAGE='b737-overhead-toggles-TGL-0001';
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
  const sprite=button.querySelector('.toggle-sprite');
  if(sprite&&index>=0){
   const frame=poseFrames(c)[index];
   const down=frame===4;
   if(c.visualFamily==='Small'){
    // Five top-down poses share the exact fixed metal bezel and pivot.
    const small=registry.visualFamilies.Small;
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
   if(!cancelled&&!gesture.moved&&!c.springReturn){if(c.states.length===2)engine.cycle(c.id);else engine.set(c.id,c.states[nearest(e)],'tap');}
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
   // The nut center sits exactly at the existing, unmodified socket pivot.
   const sprite=document.createElement('span');
   sprite.className='toggle-sprite';sprite.setAttribute('aria-hidden','true');
   const fullSize=p.diameter*SPRITE_CELL/SPRITE_BEZEL;
   Object.assign(sprite.style,{width:fullSize+'px',height:fullSize+'px',
     backgroundImage:'url("'+localURL(c.visualFamily==='Small'?registry.visualFamilies.Small.asset:registry.assets['vertical-on'].url)+'")'});
   button.append(sprite);
   layer.append(button);nodes.set(c.id,button);bind(c,button);refreshOne(c);
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
