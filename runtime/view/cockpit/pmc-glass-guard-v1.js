/* Additive PMC 1/2 photo-socket controls in the real Unified overhead iframe. */
(function(root){
 'use strict';
 const model=root.B737PMCGlassModel,STORE='b737classic.pmc-glass-v1';
 if(!model)throw Error('PMC glass model missing');
 let saved={};try{saved=JSON.parse(localStorage.getItem(STORE)||'{}')||{};}catch{}
 const state=model.controller(saved),units=new Map();
 let lampTest=false,visualTest=false;
 function viewportSnapshot(){
  try{const node=root.parent.document.getElementById('viewport');return node?{node,left:node.scrollLeft,top:node.scrollTop}:null;}catch{return null;}
 }
 function keepViewport(snapshot){
  if(!snapshot)return;
  const restore=()=>snapshot.node.scrollTo({left:snapshot.left,top:snapshot.top,behavior:'instant'});
  // Chromium can scroll a scaled iframe's parent when focus enters the frame,
  // independently of preventScroll on the actual button. Retain the pilot view.
  root.requestAnimationFrame(()=>{restore();root.requestAnimationFrame(restore);});
 }
 const coverArt='<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M3 2H97V96L94 99H6L3 96Z" fill="#bfd7df" fill-opacity=".025" stroke="#151a1c" stroke-width="2.3"/><path d="M5 4H95V95L92 97H8L5 95Z" fill="#d9edf2" fill-opacity=".025" stroke="#bac9cd" stroke-opacity=".66" stroke-width="1"/><path d="M7 8V92M93 8V92" stroke="#e7f0ef" stroke-opacity=".45" stroke-width="1.3"/><path d="M7 94H93L90 97H10Z" fill="#c9d5d4" fill-opacity=".67"/><path d="M10 10L86 6M8 15L92 11" stroke="#edf4f2" stroke-opacity=".10" stroke-width="1.6"/><path d="M8 8V27M92 72V92" stroke="#fff" stroke-opacity=".22" stroke-width=".75"/></svg>';
 function hingeArt(id){return '<svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="pmc-hinge-'+id+'" x2="0" y2="1"><stop stop-color="#343b3e"/><stop offset=".25" stop-color="#bec8c7"/><stop offset=".49" stop-color="#b2bcba"/><stop offset=".65" stop-color="#667170"/><stop offset="1" stop-color="#20282b"/></linearGradient></defs><rect x="7" y="2" width="86" height="7" rx="1.5" fill="url(#pmc-hinge-'+id+')" stroke="#2e3435" stroke-width=".8"/><path d="M3 1H8V11H3ZM92 1H97V11H92Z" fill="#747f7e" stroke="#171d20" stroke-width="1"/><path d="M8 4H92" stroke="#e8eeea" stroke-opacity=".4" stroke-width=".8"/><path d="M16 2V9M84 2V9" stroke="#222a2a" stroke-opacity=".65" stroke-width=".6"/></svg>';}
 function persist(){try{localStorage.setItem(STORE,JSON.stringify(state.snapshot()));}catch{}}
 function render(engine){
  const unit=units.get(engine);if(!unit)return;
  const v=state.view(engine,lampTest||visualTest);
  unit.dataset.on=String(v.on);unit.dataset.open=String(v.open);unit.dataset.inop=String(v.inop);
  const push=unit.querySelector('.pmc-pushbutton'),cover=unit.querySelector('.pmc-cover');
  push.disabled=!v.open;push.setAttribute('aria-pressed',String(v.on));
  push.setAttribute('aria-label','PMC '+engine+' — '+(v.on?'ON':'OFF')+' — INOP '+(v.inop?'ON':'OFF'));
  cover.setAttribute('aria-expanded',String(v.open));
  cover.setAttribute('aria-label','PMC '+engine+' glass guard — '+(v.open?'open; close':'closed; open'));
 }
 function renderAll(){for(const p of model.sockets)render(p.engine);}
 function notify(engine,action){
  const detail={...state.view(engine),action,source:model.version};
  root.dispatchEvent(new CustomEvent('b737:pmc-control',{detail}));
  if(root.parent!==root)root.parent.postMessage({type:'b737:pmc-control',detail},root.location.origin);
 }
 function mount(){
  const atlas=document.getElementById('atlasAbsolute');
  if(!atlas||!atlas.querySelector('.atlas-piece'))return false;
  for(const p of model.sockets){
   if(atlas.querySelector('.pmc-glass-unit[data-engine="'+p.engine+'"]'))continue;
   const unit=document.createElement('div'),b=model.bounds(p.engine);
   unit.className='pmc-glass-unit';unit.dataset.engine=String(p.engine);unit.dataset.sourceHinge=p.x+','+p.y;
   Object.assign(unit.style,{left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px'});
   const shell=document.createElement('span');shell.className='pmc-case';shell.setAttribute('aria-hidden','true');
   const push=document.createElement('button');push.type='button';push.className='pmc-pushbutton';
   push.innerHTML='<svg class="pmc-on-symbol" viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="22"/><text x="25" y="31">ON</text></svg><span class="pmc-divider" aria-hidden="true"></span><svg class="pmc-inop-symbol" viewBox="0 0 100 30" aria-hidden="true"><text x="50" y="22">INOP</text></svg>';
   const cover=document.createElement('button');cover.type='button';cover.className='pmc-cover';cover.innerHTML=coverArt;
   const hinge=document.createElement('span');hinge.className='pmc-hinge';hinge.innerHTML=hingeArt(p.engine);hinge.setAttribute('aria-hidden','true');
   let entryViewport=null,enteredAt=0;
   unit.addEventListener('pointerenter',()=>{entryViewport=viewportSnapshot();enteredAt=performance.now();});
   for(const node of [push,cover]){
    // Keep pointer activation from focusing a control in the scaled iframe;
    // keyboard users can still reach both buttons with normal Tab navigation.
    node.addEventListener('pointerdown',e=>{
     const view=performance.now()-enteredAt<250?entryViewport:viewportSnapshot();
     e.preventDefault();e.stopPropagation();keepViewport(view);
    });
    for(const type of ['pointerup','dblclick'])node.addEventListener(type,e=>e.stopPropagation());
   }
   cover.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();state.cover(p.engine,!state.view(p.engine).open);render(p.engine);notify(p.engine,'cover');});
   push.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(state.press(p.engine)){persist();render(p.engine);notify(p.engine,'select');}});
   unit.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();state.cover(p.engine,false);render(p.engine);cover.focus({preventScroll:true});}});
   unit.append(shell,push,cover,hinge);atlas.append(unit);units.set(p.engine,unit);render(p.engine);
  }
  document.documentElement.classList.add('pmc-glass-mounted');
  return true;
 }
 root.addEventListener('message',e=>{
  if(e.origin!==root.location.origin||e.source!==root.parent||e.data?.type!=='b737:cockpit-command')return;
  const d=e.data;if(typeof d.active!=='boolean')return;
  if(d.action==='visual-test')visualTest=d.active;else if(d.action==='lamp-test')lampTest=d.active;else return;
  renderAll();
 });
 root.addEventListener('blur',()=>{lampTest=false;renderAll();});
 function boot(){mount();const atlas=document.getElementById('atlasAbsolute');if(atlas)new MutationObserver(()=>mount()).observe(atlas,{childList:true});}
 root.B737PMCGlassGuardV1=Object.freeze({version:model.version,getState:()=>model.sockets.map(p=>state.view(p.engine,lampTest||visualTest)),getBounds:engine=>model.bounds(engine)});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
