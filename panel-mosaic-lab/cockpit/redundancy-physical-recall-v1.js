/* REDUNDANCY-PHYSICAL-0001
 * Read-only overlay onto the existing photographed OH flight-control lamps.
 * NO writes to LGT fault/sensor state, hardware, geometry, guard switches or artwork.
 */
(function(win){
 'use strict';
 const allowed=new Set(['speed-trim','mach-trim','auto-slat']);
 let incoming=Object.create(null),lastVersion=0;
 function paint(){
  const state=win.B737OverheadLights?.getState?.();
  if(!state?.frames)return;
  const panelPowered=state.power===true;
  for(const id of allowed){
   const lamp=win.document.querySelector('.mounted-light[data-light="'+id+'"]');
   if(!lamp)continue;
   const actualFrame=state.frames[id];
   const physical=panelPowered&&(incoming[id]?.on===true||actualFrame==='ON'||actualFrame==='FLASH');
   const frame=physical?'ON':'OFF';
   for(const face of lamp.querySelectorAll('img.light-face'))face.classList.toggle('active',face.dataset.frame===frame);
   lamp.dataset.state=physical?'ON':'OFF';
   lamp.dataset.frame=frame;lamp.classList.remove('flashing');
   lamp.dataset.redundancyPresentation=incoming[id]?.mode||'NORMAL';
   lamp.setAttribute('aria-label',id+' — '+frame+' (redundancy presentation)');
  }
 }
 win.addEventListener('message',e=>{
  if(e.source!==win.parent||e.origin!==win.location.origin)return;
  const d=e.data;
  if(d?.type!=='b737:cockpit-command'||d.action!=='redundancy-physical-lamps')return;
  if(!d.indicators||typeof d.indicators!=='object')return;
  const next=Object.create(null);
  for(const id of allowed){
   const v=d.indicators[id];
   if(!v||typeof v.on!=='boolean'||!['NORMAL','RECALL_ONLY','IMMEDIATE'].includes(v.mode))return;
   next[id]={on:v.on,mode:v.mode};
  }
  incoming=next;lastVersion++;paint();
 });
 win.addEventListener('b737:overhead-light-state',paint);
 win.B737RedundancyPhysicalV1=Object.freeze({paint,
  snapshot:()=>({revision:lastVersion,indicators:Object.fromEntries(allowed.values().map(id=>[id,{...(incoming[id]||{on:false,mode:'NORMAL'})}]))})});
})(window);
