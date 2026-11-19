(async()=>{
;
/* ../cockpit/exterior-lights-classic-v1.js?v=EXTL-CLASSIC-0001&amp;cb=CB-UNIFIED-0001 */
try{
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
  readout.textContent=Object.keys(snapshot).length===defs.length?'13 controls connected to the physical overhead panel.':'Open the Unified Overhead view to connect the controls.';
 }
 function open(){
  if(!dialog){
   dialog=document.createElement('dialog');dialog.id='b737ExteriorLightsDialog';dialog.className='extl-unified-dialog';
   dialog.setAttribute('aria-label','B737 Classic Exterior Lights');
   const title=document.createElement('h2');title.textContent='B737 CLASSIC · EXTERIOR LIGHTS (P5)';
   const close=document.createElement('button');close.type='button';close.className='extl-close';close.textContent='Close ×';close.onclick=()=>dialog.close();
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
   const note=document.createElement('p');note.className='extl-note';note.textContent='Change states using the existing mosaic switches. Electrical and CB logic are unchanged.';
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

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/interaction/touch-rotary-swipe-v1.js?v=TOUCH-ROTARY-ASP-NATIVE-0003 */
try{
/* TOUCH-ROTARY-0001: iPad/stylus horizontal swipe controls for live cockpit knobs.
 * Reuses each control's existing wheel handler: no duplicate state/backend owner.
 * Mouse, keyboard, native scroll outside knobs and two-finger gestures are unchanged.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B737TouchRotarySwipeV1 = api;
  if (typeof document !== 'undefined') api.install(document);
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SELECTOR = [
    '.mounted-rotary:not(.ignition-toggle)',
    '.aircon400-knob',
    '.oh22-pressure-controls [data-role="actuator"]:not(.oh22-pressure-actuator-spring):not(.oh22-pressure-hotspot)',
    '.mcp-ias-mach-knob',
    '.mcp-v3-knob',
    '.irs-upper-outer',
    '.irs-upper-brt',
    '.irs-msu-mini',
    '.irs-live-msu-control',
    '.asp-vbr-selector',
    '[data-acdc-selector]'
  ].join(',');
  // ASP volume controls own their pointer lifecycle. In particular, a global
  // capture-phase listener must NEVER steal their pointerup and leave the
  // page's pan controller waiting for a stale finger.
  const ASP_VOLUME = '.asp-photo-control[data-kind="volume"]';
  const ASP_SWIPE_START_PX = 12;
  const REVERSE = '.mcp-ias-mach-knob,.mcp-v3-knob,.irs-upper-brt';

  // Both distance and finger velocity matter: deliberate swipes produce fine
  // adjustment while quick strokes produce several existing backend steps.
  // There is no momentum after lifting a finger, and a reversal is immediate.
  function createMotion(options = {}) {
    const pixelsPerStep = options.pixelsPerStep ?? 14;
    const maxSteps = options.maxSteps ?? 36;
    if (!(pixelsPerStep > 0 && maxSteps >= 1)) throw new Error('Invalid touch rotary motion');
    let travel = 0;
    return Object.freeze({
      feed(dx, dt) {
        if (!Number.isFinite(dx) || !Number.isFinite(dt) || !dx) return 0;
        const velocity = Math.abs(dx) / Math.max(8, dt);
        const gain = Math.min(2.8, 1 + 0.85 * velocity);
        travel += dx * gain;
        const steps = Math.min(maxSteps, Math.trunc(Math.abs(travel) / pixelsPerStep));
        if (!steps) return 0;
        const result = Math.sign(travel) * steps;
        travel -= result * pixelsPerStep;
        return result;
      },
      reset() { travel = 0; },
      pending() { return travel; }
    });
  }

  function tapDirection(clientX, rect) {
    return clientX < rect.left + rect.width / 2 ? -1 : 1;
  }

  function install(doc) {
    if (!doc || doc.__b737TouchRotarySwipeV1) return false;
    doc.__b737TouchRotarySwipeV1 = true;
    let active = null;
    const suppressClicks = new WeakMap();
    const style = doc.createElement('style');
    style.id = 'b737-touch-rotary-swipe-style-v1';
    style.textContent = SELECTOR + '{touch-action:none!important;-webkit-user-select:none!important;user-select:none!important}';
    (doc.head || doc.documentElement).appendChild(style);

    function stop(e) {
      if (e.cancelable) e.preventDefault();
      e.stopImmediatePropagation();
    }
    function step(el, count) {
      const reversed = el.matches(REVERSE);
      const direction = Math.sign(count);
      for (let i = 0; i < Math.abs(count); i++) {
        // Standard knobs: swipe right = clockwise/increase. The MCP IAS/MACH
        // and ASP volume wheel handlers have opposite native wheel polarity.
        const deltaY = direction * (reversed ? -100 : 100);
        el.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true, cancelable: true, deltaY, deltaMode: 0
        }));
      }
    }
    function clear(e, cancelled) {
      if (!active || (e && e.pointerId !== active.id)) return;
      const current = active;
      active = null;
      if (e) stop(e);
      suppressClicks.set(current.el, (typeof performance === 'object' ? performance.now() : Date.now()) + 650);
      if (!cancelled && !current.moved) {
        const x = e && Number.isFinite(e.clientX) ? e.clientX : current.startX;
        step(current.el, tapDirection(x, current.el.getBoundingClientRect()));
      }
      try {
        if (current.el.hasPointerCapture?.(current.id))
          current.el.releasePointerCapture(current.id);
      } catch (_) { /* A removed or replaced knob has already lost capture. */ }
    }

    doc.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      if (active) {
        // Second finger is not interpreted as a second knob or rapid turn.
        clear(null, true);
        return;
      }
      if (e.isPrimary === false || e.button !== 0) return;
      // Native ASP controller handles both touch and mouse with a single
      // pointer capture owner; never intercept its events at document capture.
      if (e.target?.closest?.(ASP_VOLUME)) return;
      const el = e.target?.closest?.(SELECTOR);
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      stop(e);
      active = {
        el, id: e.pointerId, startX: e.clientX, startY: e.clientY,
        lastX: e.clientX, lastTime: e.timeStamp,
        moved: false, motion: createMotion()
      };
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      el.focus?.({ preventScroll: true });
    }, true);
    doc.addEventListener('pointermove', e => {
      if (!active || e.pointerId !== active.id) return;
      stop(e);
      const item = active;
      const dx = e.clientX - item.lastX;
      const dt = e.timeStamp - item.lastTime;
      item.lastX = e.clientX;
      item.lastTime = e.timeStamp;
      if (Math.hypot(e.clientX - item.startX, e.clientY - item.startY) > 5)
        item.moved = true;
      if (!item.moved || !dx) return;
      const count = item.motion.feed(dx, dt);
      if (count) step(item.el, count);
    }, true);
    doc.addEventListener('pointerup', e => clear(e, false), true);
    doc.addEventListener('pointercancel', e => clear(e, true), true);
    doc.addEventListener('lostpointercapture', e => {
      if (active && e.pointerId === active.id) clear(e, true);
    }, true);
    doc.addEventListener('click', e => {
      if (e.detail === 0) return; // keyboard accessibility stays functional
      const el = e.target?.closest?.(SELECTOR);
      if (!el) return;
      const now = typeof performance === 'object' ? performance.now() : Date.now();
      if (now <= (suppressClicks.get(el) || 0)) stop(e);
    }, true);
    doc.defaultView?.addEventListener('blur', () => clear(null, true));
    return true;
  }
  return Object.freeze({ createMotion, tapDirection, install, selector: SELECTOR,
    ASP_SWIPE_START_PX, ASP_VOLUME });
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
