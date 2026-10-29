/* 737-300/500 Unified only: place the owner's photo-extracted slim black
 * temperature selector on the two EXISTING OH20 rotary controls. No new hit
 * targets; no changes to the locked overhead atlas or Owner18 guards.
 */
(function(){
 'use strict';
 const ids=['control-cabin-temp','pass-cabin-temp'];
 const asset=new URL('./assets/aircon-300500-owner-approved-round-knob-v3.webp',document.baseURI).href;
 const originals=new WeakMap();
 const key='b737classic.aircraft-profile.v1';
 const propNames=['left','top','width','height','transform-origin','object-fit','scale'];
 function family(doc){
  if(doc.documentElement.classList.contains('b737-aircon400'))return 'B737-400';
  if(doc.documentElement.classList.contains('b737-aircon300500'))return 'B737-300-500';
  try{return JSON.parse(localStorage.getItem(key)||'null')?.aircraftFamily==='B737-400'?'B737-400':'B737-300-500';}
  catch{return 'B737-300-500';}
 }
 function save(el){
  if(originals.has(el))return originals.get(el);
  if(!el.getAttribute('src'))return null;
  const state={src:el.getAttribute('src'),styles:Object.fromEntries(propNames.map(name=>[name,{value:el.style.getPropertyValue(name),priority:el.style.getPropertyPriority(name)}]))};
  originals.set(el,state);
  return state;
 }
 function restore(el){
  const state=originals.get(el);if(!state)return;
  if(el.getAttribute('src')!==state.src)el.setAttribute('src',state.src);
  for(const name of propNames){const p=state.styles[name];if(p.value)el.style.setProperty(name,p.value,p.priority);
   else el.style.removeProperty(name);}
  delete el.dataset.aircon300500Approved;
 }
 function fit(btn,img){
  const w=parseFloat(btn.style.width),h=parseFloat(btn.style.height);
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return false;
  // The physical pivot remains exactly the existing OH20 rotary socket center.
  // Owner-approved transparent round knob (192x192): its full central base\n  // covers the recessed hole at the reference-photo scale (diameter =\n  // original control hit-area width), without moving the socket/pivot.
  const imageW=w,imageH=imageW;
  img.style.setProperty('width',imageW+'px');
  img.style.setProperty('height',imageH+'px');
  img.style.setProperty('left',(w-imageW)/2+'px');
  img.style.setProperty('top',(h-imageH)/2+'px');
  img.style.setProperty('transform-origin','50% 50%');
  img.style.setProperty('object-fit','fill');
  img.style.setProperty('scale','1','important');
  return true;
 }
 function sync(){
  let frame,child;
  try{frame=document.getElementById('overheadFrame');child=frame?.contentDocument;}catch{return;}
  if(!child||!child.documentElement)return;
  const selectedFamily=family(child);
  for(const id of ids){
   const btn=child.querySelector('#rotaryGuardLayer .mounted-rotary[data-control="'+id+'"]');
   const image=btn?.querySelector('img.rotary-picture');
   if(!image||!save(image))continue;
   if(selectedFamily!=='B737-300-500'){if(image.dataset.aircon300500Approved==='true')restore(image);continue;}
   if(!fit(btn,image))continue;
   if(image.getAttribute('src')!==asset)image.setAttribute('src',asset);
   image.dataset.aircon300500Approved='true';
  }
 }
 function boot(){
  const frame=document.getElementById('overheadFrame');
  frame?.addEventListener('load',sync);
  window.addEventListener('storage',e=>{if(e.key===key)sync();});
  window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===frame?.contentWindow&&e.data?.type==='b737:cockpit-overhead'&&e.data.kind==='ready')sync();});
  // The frame mounts controls asynchronously after its 'load' event.
  // Periodic idempotent reconciliation also follows Settings changes.
  setInterval(sync,700);sync();
 }
 window.B737Aircon300500SlimKnobsV1=Object.freeze({sync,getAsset:()=>asset,ids:Object.freeze([...ids])});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();