/* EXTL-CLASSIC-0001 — additive controls for OH23–25, no modification to frozen artwork/guards. */
(function(){
'use strict';
const defs=[
 ['landing-out-l','OUTBOARD LANDING L',['RETRACT','EXTEND','ON']],
 ['landing-out-r','OUTBOARD LANDING R',['RETRACT','EXTEND','ON']],
 ['landing-in-l','INBOARD LANDING L',['OFF','ON']],
 ['landing-in-r','INBOARD LANDING R',['OFF','ON']],
 ['runway-turnoff-l','RUNWAY TURNOFF L',['OFF','ON']],
 ['runway-turnoff-r','RUNWAY TURNOFF R',['OFF','ON']],
 ['taxi','TAXI',['OFF','ON']],
 ['logo','LOGO',['OFF','AUTO','ON']],
 ['strobe','STROBE',['OFF','AUTO','ON']],
 ['position-lights','POSITION',['ON BAT','OFF','ON']],
 ['anti-collision','ANTI-COLLISION',['OFF','ON']],
 ['wing-lights','WING',['OFF','ON']],
 ['wheel-well','WHEEL WELL',['OFF','ON']]
].map(([id,label,states])=>Object.freeze({id,label,states:Object.freeze(states)}));
const circuits={'landing-out-l':'landingOutboardL','landing-out-r':'landingOutboardR','landing-in-l':'landingInboardL','landing-in-r':'landingInboardR','runway-turnoff-l':'turnoffL','runway-turnoff-r':'turnoffR','taxi':'taxi','strobe':'strobe','position-lights':'position','wing-lights':'wingScan'};
const effective=states=>Object.fromEntries(defs.map(d=>{const v=states[d.id],cb=window.B737UnifiedCB;
 const protectedOn=d.id==='anti-collision'?(cb?.available('lights.beaconUpper')!==false||cb?.available('lights.beaconLower')!==false):!circuits[d.id]||cb?.available('lights.'+circuits[d.id])!==false;
 return [d.id,{selected:v,illuminated:protectedOn&&['ON','ON BAT'].includes(v),circuitAvailable:protectedOn}];}));
const allowed=new Map(defs.map(x=>[x.id,x]));
const copy=()=>JSON.parse(JSON.stringify(defs));
const isChild=window.parent!==window&&!!document.getElementById('atlasAbsolute');
if(isChild){
 let booted=false;
 window.addEventListener('b737:cb-state-change',()=>report());
 const report=()=>{
  const engine=window.B737OverheadToggles;
  if(!engine)return;
  const values=engine.getState();
  const states=Object.fromEntries(defs.map(d=>[d.id,values[d.id]||null]));
  parent.postMessage({type:'b737:exterior-lights',kind:'state',version:'EXTL-CLASSIC-0001',states,effective:effective(states)},location.origin);
  window.dispatchEvent(new CustomEvent('b737:exterior-lights-state',{detail:{states,effective:effective(states)}}));
 };
 function set(id,state){
  const def=allowed.get(id);if(!def||!def.states.includes(state))return false;
  const native=window.B737OverheadToggles;
  const button=document.getElementById('toggle-'+id);
  if(!native||!button)return false;
  if(native.getState()[id]===state)return true;
  // Use the original switch engine and its persisted state, never a parallel model.
  button.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:0}));
  const target=Array.from(document.querySelectorAll('#toggleStates button')).find(x=>x.dataset.state===state);
  if(!target)return false;
  target.click();
  report();
  return native.getState()[id]===state;
 }
 const start=()=>{
  if(booted||!window.B737OverheadToggles||!document.getElementById('toggle-landing-out-l'))return false;
  booted=true;clearInterval(watch);
  window.addEventListener('b737:switch-change',e=>{if(allowed.has(e.detail?.id))report()});
  window.addEventListener('message',e=>{
   if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='b737:exterior-lights-command')return;
   if(e.data.action==='query')report();
   if(e.data.action==='set')set(e.data.id,e.data.state);
  });
  window.B737ClassicExteriorLights=Object.freeze({version:'EXTL-CLASSIC-0001',definitions:copy,getState:()=>Object.fromEntries(defs.map(d=>[d.id,window.B737OverheadToggles.getState()[d.id]])),set});
  report();return true;
 };
 const watch=setInterval(start,200);start();
 setTimeout(()=>clearInterval(watch),25000);
}else{
 const snapshot={};
 let dialog=null,readout=null;
 const receive=e=>{
  if(e.origin!==location.origin||e.source!==document.getElementById('overheadFrame')?.contentWindow||e.data?.type!=='b737:exterior-lights'||e.data.kind!=='state')return;
  Object.assign(snapshot,e.data.states||{});
  refresh();
 };
 window.addEventListener('message',receive);
 const command=(action,id,state)=>{
  const frame=document.getElementById('overheadFrame');
  if(!frame||!frame.contentWindow)return false;
  frame.contentWindow.postMessage({type:'b737:exterior-lights-command',action,id,state},location.origin);
  return true;
 };
 function refresh(){
  if(!dialog)return;
  for(const card of dialog.querySelectorAll('[data-exterior-control]')){
   const id=card.dataset.exteriorControl,v=snapshot[id];
   card.querySelector('.ext-state').textContent=v||'—';
   for(const b of card.querySelectorAll('button[data-detent]'))b.setAttribute('aria-pressed',String(v===b.dataset.detent));
  }
  readout.textContent=Object.keys(snapshot).length===defs.length?'۱۳ کنترل به پنل واقعی اورهد متصل هستند.':'برای اتصال، ابتدا نمای Overhead را در یونیفاید باز کن.';
 }
 function open(){
  if(!dialog){
   dialog=document.createElement('dialog');dialog.id='b737ExteriorLightsDialog';dialog.className='extl-unified-dialog';
   dialog.setAttribute('aria-label','B737 Classic Exterior Lights');
   const title=document.createElement('h2');title.textContent='B737 CLASSIC · EXTERIOR LIGHTS (P5)';
   const close=document.createElement('button');close.type='button';close.className='extl-close';close.textContent='بستن ×';close.onclick=()=>dialog.close();
   readout=document.createElement('p');readout.className='extl-status';readout.setAttribute('role','status');
   const grid=document.createElement('div');grid.className='extl-grid';
   for(const def of defs){
    const card=document.createElement('section');card.className='extl-card';card.dataset.exteriorControl=def.id;
    const label=document.createElement('strong');label.textContent=def.label;
    const state=document.createElement('span');state.className='ext-state';
    const choices=document.createElement('div');choices.className='extl-choices';
    for(const detent of def.states){
     const b=document.createElement('button');b.type='button';b.dataset.detent=detent;b.textContent=detent;
     b.onclick=()=>command('set',def.id,detent);choices.append(b);
    }
    card.append(label,state,choices);grid.append(card);
   }
   const note=document.createElement('p');note.className='extl-note';note.textContent='تغییر وضعیت‌ها از طریق همان سوئیچ‌های موجود روی موزاییک انجام می‌شود. منطق برق و CB بدون تغییر مانده است.';
   dialog.append(close,title,readout,grid,note);document.body.append(dialog);
  }
  refresh();dialog.showModal();command('query');
 }
 function install(){
  if(document.getElementById('b737ExteriorLightsOpen'))return;
  const bar=document.getElementById('unifiedLabShortcuts');
  if(!bar)return;
  const b=document.createElement('button');b.type='button';b.id='b737ExteriorLightsOpen';
  b.textContent='EXTERNAL LIGHTS';b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls','b737ExteriorLightsDialog');
  b.onclick=open;bar.append(b);
  window.B737ClassicExteriorLights=Object.freeze({version:'EXTL-CLASSIC-0001',definitions:copy,getState:()=>({...snapshot}),open});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}
})();
