(async()=>{
;
/* ./cockpit-photo-input-v1.js?v=PHOTO-INPUT-0001 */
try{
/* PHOTO-INPUT-0001 — browser gesture defaults only.
   This module never suppresses pointerdown/up/move or click on actual controls.
   It only prevents text/photo selection, dragging and browser long-press menus
   within the cockpit viewport, leaving zoom, pan and simulated switches intact.
*/
(function(){
 'use strict';
 const viewport=document.getElementById('viewport');
 if(!viewport)return;
 const editingSelector='input,textarea,select,[contenteditable="true"]';
 function editable(event){
   return event.target instanceof Element&&!!event.target.closest(editingSelector);
 }
 for(const type of ['contextmenu','selectstart','dragstart']){
   viewport.addEventListener(type,event=>{
     if(!editable(event))event.preventDefault();
   },{capture:true,passive:false});
 }
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./unified-pinch-v1.js?v=UNIFIED-PINCH-0004-COMPOSITOR-PREVIEW */
try{
/* UNIFIED-PINCH-0001 — zoom and pan the cockpit, never the browser page.
   Works over the main panel and pedestal, plus the embedded overhead iframe.
   One-finger taps on real hardware controls are deliberately not intercepted.
*/
(function(){
 'use strict';
 const viewport=document.getElementById('viewport');
 if(!viewport)return;
 const adapter=()=>window.B737UnifiedPinchAdapterV1;
 const clampPoint=(e)=>{
  // The viewport boundary is stationary during scroll/zoom. Cache its rect
  // for the gesture to avoid forced layout reads after the prior zoom frame.
  const r=pinchViewportRect||(pinchViewportRect=viewport.getBoundingClientRect());
  const a=e.touches[0],b=e.touches[1];
  return {distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),
   x:(a.clientX+b.clientX)/2-r.left,y:(a.clientY+b.clientY)/2-r.top};
 };
 const interactive='button,input,select,textarea,a,[contenteditable="true"],[role="slider"],[role="switch"],[role="button"],[data-control],.cockpit-light,.mounted-light';
 let gesture=null,oneFinger=null,suppressRemaining=false,iframeBlocked=false,pinchViewportRect=null;
 // A touch controller can send many move events before the display can paint.
 // Coalesce only the viewport pan writes; never alter the aircraft controls,
 // switch/guard hit testing, or the final finger-end scroll location.
 function flushOneFinger(){
  const current=oneFinger;
  if(!current)return;
  if(current.frame!==undefined){
   cancelAnimationFrame(current.frame);
   current.frame=undefined;
  }
  if(current.pending){
   viewport.scrollLeft=current.left-current.pending.dx;
   viewport.scrollTop=current.top-current.pending.dy;
   current.pending=null;
  }
  oneFinger=null;
 }
 function moveOneFinger(current,dx,dy){
  current.pending={dx,dy};
  if(current.frame!==undefined)return;
  current.frame=requestAnimationFrame(()=>{
   current.frame=undefined;
   if(oneFinger!==current)return;
   const point=current.pending;
   current.pending=null;
   if(!point)return;
   viewport.scrollLeft=current.left-point.dx;
   viewport.scrollTop=current.top-point.dy;
  });
 }
 function begin(point,kind){
  if(!adapter()||!point||point.distance<2)return;
  // Flush the last one-finger coordinate before capturing the pinch anchor.
  flushOneFinger();
  const start=adapter().begin(point.distance,point.x,point.y);
  if(!start)return;
  gesture={kind,start};
  if(kind==='overhead')iframeBlocked=true;
 }
 // Coalesce high-frequency touchmove messages to the next screen frame.
 // A single paint uses the newest midpoint/scale without intermediate layouts.
 function move(point,kind){
  if(!gesture||gesture.kind!==kind||!adapter())return;
  const current=gesture;
  current.nextPoint=point;
  if(current.frame!==undefined)return;
  current.frame=requestAnimationFrame(()=>{
   current.frame=undefined;
   const queued=current.nextPoint;
   current.nextPoint=null;
   if(gesture!==current||!queued)return;
   const latest=typeof queued==='function'?queued():queued;
   if(latest)adapter()?.move(current.start,latest.distance,latest.x,latest.y);
  });
 }
 function finish(kind,remaining){
  if(gesture?.kind===kind){
   const current=gesture;
   if(current.frame!==undefined)cancelAnimationFrame(current.frame);
   // Preserve the final finger position when the gesture ends before paint.
   const queued=current.nextPoint;
   const latest=typeof queued==='function'?queued():queued;
   if(latest)adapter()?.move(current.start,latest.distance,latest.x,latest.y);
   // Restore exact display-label geometry and schedule source image quality
   // only when the pinch finishes; never during its compositor frame loop.
   adapter()?.end?.(current.start);
   gesture=null;
  }
  if(remaining>0)suppressRemaining=true;
  else {suppressRemaining=false;flushOneFinger();}
  if(kind==='overhead'&&remaining===0)iframeBlocked=false;
  if(kind==='parent')pinchViewportRect=null;
 }
 viewport.addEventListener('touchstart',e=>{
  if(e.touches.length>=2){
   if(!gesture||gesture.kind!=='parent')pinchViewportRect=null;
   const point=clampPoint(e);
   if(!gesture||gesture.kind!=='parent')begin(point,'parent');
   oneFinger=null;
   if(e.cancelable)e.preventDefault();
   e.stopImmediatePropagation(); // suppress the older native pinch listener
  }else if(e.touches.length===1&&!suppressRemaining&&!gesture){
   const el=e.target;
   if(el instanceof Element&&el.closest(interactive)){oneFinger=null;return}
   const touch=e.touches[0];
   oneFinger={id:touch.identifier,x:touch.clientX,y:touch.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
  }
 },{capture:true,passive:false});
 viewport.addEventListener('touchmove',e=>{
  if(e.touches.length>=2){
   const point=clampPoint(e);
   if(!gesture||gesture.kind!=='parent')begin(point,'parent');
   move(point,'parent');
   if(e.cancelable)e.preventDefault();
   e.stopImmediatePropagation();
  }else if(gesture||suppressRemaining){
   if(e.cancelable)e.preventDefault();
   e.stopImmediatePropagation();
  }else if(oneFinger&&e.touches.length===1){
   const touch=e.touches[0];
   if(touch.identifier!==oneFinger.id)return;
   const dx=touch.clientX-oneFinger.x,dy=touch.clientY-oneFinger.y;
   moveOneFinger(oneFinger,dx,dy);
   if(e.cancelable)e.preventDefault();
  }
 },{capture:true,passive:false});
 const end=e=>{
  if(e.touches.length<2&&gesture?.kind==='parent')finish('parent',e.touches.length);
  if(oneFinger){
   // Touchend may contain a final coordinate not present in touchmove.
   const finalTouch=Array.from(e.changedTouches||[]).find(t=>t.identifier===oneFinger.id);
   if(finalTouch)oneFinger.pending={
    dx:finalTouch.clientX-oneFinger.x,dy:finalTouch.clientY-oneFinger.y
   };
   if(finalTouch||e.touches.length===0)flushOneFinger();
  }
  if(e.touches.length===0)suppressRemaining=false;
 };
 viewport.addEventListener('touchend',end,{capture:true,passive:true});
 viewport.addEventListener('touchcancel',end,{capture:true,passive:true});
 // The overhead is an iframe. Touch events cannot bubble across frames, so its
 // gesture bridge sends a midpoint in local iframe coordinates.
 function convertFromOverhead(data,frame){
  if(!Number.isFinite(data.distance)||data.distance<2||!Number.isFinite(data.x)||!Number.isFinite(data.y))return null;
  const r=frame.getBoundingClientRect(),v=viewport.getBoundingClientRect();
  const factor=r.width/(frame.clientWidth||2220);
  if(!Number.isFinite(factor)||factor<=0)return null;
  return {distance:data.distance,x:r.left-v.left+data.x*factor,y:r.top-v.top+data.y*factor};
 }
 window.addEventListener('message',e=>{
  const frame=document.getElementById('overheadFrame');
  if(!frame||e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.type!=='b737:cockpit-overhead')return;
  const d=e.data;
  if(d.kind==='pinch-start'){
   const point=convertFromOverhead(d,frame);
   if(point)begin(point,'overhead');
   return;
  }
  if(d.kind==='pinch-move'){
   // An iframe reports many touch-move messages during one screen frame.
   // Defer the expensive parent/iframe rect reads until the one rAF that
   // actually applies the zoom. The latest midpoint always wins.
   if(!gesture||gesture.kind!=='overhead'){
    const first=convertFromOverhead(d,frame);
    if(first)begin(first,'overhead');
   }
   if(gesture?.kind==='overhead')move(()=>convertFromOverhead(d,frame),'overhead');
   return;
  }
  if(d.kind==='pinch-end'){
   finish('overhead',Math.max(0,Number(d.remaining)||0));
   return;
  }
  // Block the old one-pointer pan stream during a multi-touch overhead gesture.
  if(iframeBlocked&&['pan-start','pan-move','pan-end'].includes(d.kind)){
   e.stopImmediatePropagation();
  }
 },true);
 window.addEventListener('resize',()=>{pinchViewportRect=null;});
 window.B737UnifiedPinchV1=Object.freeze({version:'UNIFIED-PINCH-0003'});
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/window-heat-v1.js?v=WH-LOSS-OVERHEAT-0007 */
try{
/* 737 Classic Window Heat training core v1: FCOM 3.10/3.20, SP.3.1-2, MRG IV.3/IV.6.
 * Generic procedural trainer, NOT aircraft-specific WDM/AMM or certified dispatch logic.
 * No changes to approved panel artwork or switch mechanics.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737WindowHeatV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const CHANNELS=Object.freeze({
  'L_FWD':{switchId:'window-l-fwd',onId:'window-l-fwd-on',ovhtId:'window-l-fwd-overheat',heaterBus:'generator1',controllerAC:'main1',controllerDC:'dc1',heaterCB:'P6-11|ALL|B9',controllerCB:'P18-3|ALL|F1',target:40,cutout:63,restore:43,group:'L1'},
  'L_SIDE':{switchId:'window-l-side',onId:'window-l-side-on',ovhtId:'window-l-side-overheat',heaterBus:'generator2',controllerAC:'main2',controllerDC:'dc2',heaterCB:'P6-12|ALL|B9',controllerCB:'P18-3|ALL|F3',target:32,cutout:49,restore:27,group:'L2'},
  'R_FWD':{switchId:'window-r-fwd',onId:'window-r-fwd-on',ovhtId:'window-r-fwd-overheat',heaterBus:'generator2',controllerAC:'main2',controllerDC:'dc2',heaterCB:'P6-12|ALL|B8',controllerCB:'P18-3|ALL|E1',target:40,cutout:63,restore:43,group:'R1'},
  'R_SIDE':{switchId:'window-r-side',onId:'window-r-side-on',ovhtId:'window-r-side-overheat',heaterBus:'generator1',controllerAC:'main1',controllerDC:'dc1',heaterCB:'P6-11|ALL|B8',controllerCB:'P18-3|ALL|E3',target:32,cutout:49,restore:27,group:'R2'}
 });
 const AUX=Object.freeze({
  'L45':{switchId:'window-l-side',bus:'generator1',breaker:'P6-11|ALL|B7',label:'L4/L5 DEFOG'},
  'R45':{switchId:'window-r-side',bus:'generator2',breaker:'P6-12|ALL|B7',label:'R4/R5 DEFOG'}
 });
 const PHOTO_CB=Object.freeze({ 'P6-11|ALL|B9':'WINDOW ANTI-ICE L FRONT','P6-11|ALL|B8':'WINDOW ANTI-ICE R SIDE','P6-12|ALL|B9':'WINDOW ANTI-ICE L SIDE','P6-12|ALL|B8':'WINDOW ANTI-ICE R FRONT',
 'P18-3|ALL|F1':'WINDOW HEAT CONTROL L FRONT AC','P18-3|ALL|F3':'WINDOW HEAT CONTROL L SIDE AC','P18-3|ALL|E1':'WINDOW HEAT CONTROL R FRONT AC','P18-3|ALL|E3':'WINDOW HEAT CONTROL R SIDE AC' });
 const ALL_CBS=Object.freeze([...Object.keys(PHOTO_CB),AUX.L45.breaker,AUX.R45.breaker]);
 const FAULTS=Object.freeze(['HEATER_FAIL','CONTROLLER_FAIL','SENSOR_FAIL','STUCK_OVERHEAT','POWER_TEST_FAIL']);
 // Trainer behavior requested by the owner: clear test-generated amber after
 // 60 seconds, or immediately for one channel when its own switch goes OFF.
 // The timer is a simulator behavior choice; normal thermal overheat remains.
 const OVHT_TEST_DURATION_SECONDS=60;
 const OVHT_ON_EXPIRE_SECONDS=60;
 const copy=v=>JSON.parse(JSON.stringify(v));
 function initialState(){return {schema:'b737-window-heat/1',elapsed:0,test:'NEUTRAL',ovhtTestElapsed:null,channels:Object.fromEntries(Object.keys(CHANNELS).map(k=>[k,{temp:18,heating:false,overheat:false,ovhtTestLatched:false,ovhtTestGreen:false,lastGreen:null,lastSwitch:false}])),aux:{L45:{temp:18,heating:false,thermostatOn:true},R45:{temp:18,heating:false,thermostatOn:true}},faults:Object.fromEntries(Object.keys(CHANNELS).map(k=>[k,{}]))};}
 function injectFault(s,channel,fault,active){if(!CHANNELS[channel]||!FAULTS.includes(fault)||typeof active!=='boolean')throw Error('Invalid Window Heat instructor fault');const n=copy(s);n.faults[channel][fault]=active;return n;}
 const breakerClosed=(cbs,key)=>!cbs||cbs[key]!==false;
 const busOk=(buses,key)=>!!buses&&buses[key]===true;
 function step(s,input={},seconds=0){
  if(!s||s.schema!=='b737-window-heat/1')throw Error('Invalid Window Heat state');
  if(!Number.isFinite(seconds)||seconds<0||seconds>300)throw Error('Invalid time step');
  const n=copy(s),sw=input.switches||{},b=input.buses||{},cb=input.breakers||{},test=['OVHT','PWR TEST'].includes(sw['window-power-test'])?sw['window-power-test']:'NEUTRAL';
  n.elapsed+=seconds;n.test=test;
  // Spring detent starts the timer only on entry; holding OVHT cannot
  // repeat the test. OFF->ON clears the associated channel independently.
  const startingOvhtTest=test==='OVHT'&&s.test!=='OVHT';
  if(startingOvhtTest)n.ovhtTestElapsed=0;
  else if(n.ovhtTestElapsed!==null)n.ovhtTestElapsed+=seconds;
  const ovhtExpired=n.ovhtTestElapsed!==null&&n.ovhtTestElapsed>=OVHT_TEST_DURATION_SECONDS;
  const outputs={},auxOut={};
  for(const [id,d] of Object.entries(CHANNELS)){
    const q=n.channels[id],f=n.faults[id]||{},selected=sw[d.switchId]==='ON';
    if(!selected||ovhtExpired){q.ovhtTestLatched=false;q.ovhtTestGreen=false;}
    if(!selected){q.overheat=false;q.lastGreen=false;q.lastSwitch=false;}
    const controller=busOk(b,d.controllerAC)&&busOk(b,d.controllerDC)&&breakerClosed(cb,d.controllerCB)&&!f.CONTROLLER_FAIL&&!f.SENSOR_FAIL;
    const heaterBus=busOk(b,d.heaterBus),heaterCB=breakerClosed(cb,d.heaterCB);
    // Distinguish heater power from the controller/annunciator feed.
    // FCOM 3.10.1: OVERHEAT also illuminates when electrical power to
    // a selected window is interrupted, if its indication still has power.
    const indicationPowered=controller;
    const supply=controller&&heaterBus&&heaterCB&&!f.HEATER_FAIL;
    // OVHT test is a powered, per-channel latch. A loss of supply cancels
    // that channel's test without generating a deferred warning on restore.
    if(!supply){q.ovhtTestLatched=false;q.ovhtTestGreen=false;}
    if(startingOvhtTest&&selected&&indicationPowered){
      // Preserve the PRE-TEST ON indication. SP.3.2 does not turn an
      // extinguished green light ON during the overheat test; instead,
      // illuminated ON lights go out after approximately one minute.
      q.ovhtTestGreen=q.lastGreen===null
        ?(supply&&q.temp<d.target-1.5&&!q.overheat):q.lastGreen;
      q.ovhtTestLatched=true;
    }
    const forcedOverheat=Boolean(f.STUCK_OVERHEAT||q.ovhtTestLatched);
    if(!forcedOverheat&&q.overheat&&q.temp<=d.restore)q.overheat=false;
    if(q.temp>=d.cutout||f.STUCK_OVERHEAT)q.overheat=true;
    // Temperature control uses intentionally approximate targets, not asserted FCOM values.
    const requestingHeat=selected&&(test==='PWR TEST'&&!f.POWER_TEST_FAIL||q.temp<d.target-1.5);
    const blocked=forcedOverheat||q.overheat;
    const heater=supply&&requestingHeat&&!blocked;
    q.temp=Math.max(-50,Math.min(100,q.temp+(heater?(test==='PWR TEST'?0.20:0.08):-0.025)*seconds));
    if(q.temp>=d.cutout){q.overheat=true;}
    q.heating=heater&&!q.overheat;
    // Window heater power interruption is an amber annunciation condition,
    // not a fictitious temperature rise. Unpowered annunciators stay dark.
    const powerInterrupted=selected&&indicationPowered&&(!heaterBus||!heaterCB||!!f.HEATER_FAIL);
    const overheat=selected&&indicationPowered&&(q.overheat||q.ovhtTestLatched||powerInterrupted);
    const warningReason=overheat?(q.overheat?'THERMAL_OVERHEAT':q.ovhtTestLatched?'OVHT_TEST':'WINDOW_POWER_INTERRUPTED'):null;
    const pendingOvhtTest=q.ovhtTestLatched&&n.ovhtTestElapsed!==null&&n.ovhtTestElapsed<OVHT_ON_EXPIRE_SECONDS;
    // Green ON means the selected window's heating control is available,
    // NOT that current happens to be flowing through its thermostatically
    // cycled heater at this precise instant. The 32C side windows reach
    // their target before the 40C forward windows. Binding ON to q.heating
    // incorrectly caused side lamps to go dark and forward lamps to flash.
    // Keep the approved OVHT-test 60-second latch and OFF-switch PWR TEST.
    const green=test==='PWR TEST'
      ?(supply&&!blocked&&!f.POWER_TEST_FAIL)
      :selected&&(q.ovhtTestLatched
        ?(pendingOvhtTest&&q.ovhtTestGreen&&supply)
        :(supply&&!blocked));
    q.lastGreen=!!green;
    outputs[id]={id,selected,temperatureC:Math.round(q.temp*10)/10,heaterPower:q.heating,controllerPower:controller,heaterFeed:heaterBus,indicationPowered,cbHeaterClosed:heaterCB,cbControllerClosed:breakerClosed(cb,d.controllerCB),normalTargetApproxC:d.target,overheatLimitC:d.cutout,restoreLimitC:d.restore,powerInterrupted,warningReason,greenOn:!!green,overheatOn:!!overheat,warning:!!overheat,source:'FCOM+MRG_GENERIC_TRAINER'};
    q.lastSwitch=selected;
  }
  // No electronic WHCU on L4/L5 and R4/R5; independent generator bus/CB and thermal cycling.
  for(const [id,d] of Object.entries(AUX)){
    const q=n.aux[id],selected=sw[d.switchId]==='ON',supply=busOk(b,d.bus)&&breakerClosed(cb,d.breaker);
    if(q.temp>=38)q.thermostatOn=false;else if(q.temp<=34)q.thermostatOn=true;
    q.heating=selected&&supply&&q.thermostatOn;
    q.temp=Math.max(-50,Math.min(70,q.temp+(q.heating?0.06:-0.02)*seconds));
    auxOut[id]={selected,heaterPower:q.heating,temperatureC:Math.round(q.temp*10)/10,cbClosed:breakerClosed(cb,d.breaker),busPowered:busOk(b,d.bus),label:d.label,thermostatTargetApproxC:38};
  }
  if(!Object.values(n.channels).some(q=>q.ovhtTestLatched))n.ovhtTestElapsed=null;
  const antiIceCaution=Object.values(outputs).some(v=>v.overheatOn);
  return {state:n,output:{schema:'B737_WINDOW_HEAT_V1_RESULT',channels:outputs,aux:auxOut,annunciations:{antiIceCaution,masterCautionRequest:antiIceCaution},test,elapsed:n.elapsed,notes:'generic simulator temperatures and timings; not dispatch authority'}};
 }
 return Object.freeze({CHANNELS,AUX,PHOTO_CB,ALL_CBS,FAULTS,OVHT_TEST_DURATION_SECONDS,OVHT_ON_EXPIRE_SECONDS,initialState,injectFault,step});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./window-heat-unified-v1.js?v=ATA24-CONSUMER-REG-0002 */
try{
/* Unified Window Heat bridge. Additive only: reads the actual OH15 switches,
 * Electrical V7 authority and persisted CB Lab pulls; paints existing lamps in
 * place without changing a pixel or event handler of the frozen overhead atlas.
 */
(function(){'use strict';
 const Core=window.B737WindowHeatV1;if(!Core){console.error('Window Heat core unavailable');return;}
 const CB_KEY='b737classic.cb.v1',FAULT_KEY='b737.windowheat.faults.v1',TRAIN_KEY='b737.windowheat.training-power.v1';
 const TRAIN_BUSES=Object.freeze({generator1:true,generator2:true,main1:true,main2:true,dc1:true,dc2:true});
 // Cold & dark always starts with real Electrical V7/CB gating.
 // An earlier training-only toggle persisted '1' and silently powered OH15
 // without any live AC/DC source. Never resurrect that persisted bypass:
 // the instructor must opt in again during this page session.
 let trainingPower=false;
 // Explicit isolated training supply is an instructor-only exception, not an
 // aircraft source or permission to bypass the standard cold/dark default.
 let s=Core.initialState(),last=null,lastAt=performance.now(),child=null,previousCaution=null;
  let electricalBusSnapshot=null; // six live feeder states, pushed on events
 let faults={};try{faults=JSON.parse(localStorage.getItem(FAULT_KEY)||'{}')||{};}catch{}
 for(const [ch,f] of Object.entries(faults)){if(!Core.CHANNELS[ch]||!f||typeof f!=='object')continue;
  for(const id of Core.FAULTS)if(typeof f[id]==='boolean')s=Core.injectFault(s,ch,id,f[id]);
 }
 function breaks(){
  const result={};try{const x=JSON.parse(localStorage.getItem(CB_KEY)||'{}');for(const b of x.breakers||[])if(b.pulled||b.tripped)result[b.id]=false;}catch{}return result;
 }
 function switches(){try{return document.getElementById('overheadFrame')?.contentWindow?.B737OverheadToggles?.getState?.()||{};}catch{return {};}}
 function buses(){try{
  const p=window.B737ISNCockpitV1;
  // The chain.get() result exposes Electrical V7 BUS fields directly under
  // .electrical. The alternate ISN bridge returns state.electrical.bus.
  // Never incorrectly expect chain.get().electrical.bus.
  // Use the evaluated V7 bus model: instructor BUS/FAILURES injections
  // are applied there, not to the raw ISN start-chain electrical object.
  const v7State=p?.getElectricalState?.();
  const evaluated=v7State&&window.B737ElectricalV7?.evaluate?.(v7State);
  if(evaluated?.bus&&typeof evaluated.bus==='object')return evaluated.bus;
  const fromStart=p?.getStartState?.()?.electrical;
  if(fromStart&&typeof fromStart==='object'&&Object.prototype.hasOwnProperty.call(fromStart,'generator1'))return fromStart;
  const fromBridge=p?.getState?.()?.state?.electrical?.bus;
  return fromBridge&&typeof fromBridge==='object'?fromBridge:null;
 }catch{return null;}}
 function applyLamps(out){
  const iframe=document.getElementById('overheadFrame');
  let doc;try{doc=iframe?.contentDocument;}catch{return;}
  if(!doc||doc.documentElement.classList.contains('cockpit-visual-test')||iframe?.contentWindow?.B737OverheadLights?.getState?.()?.lampTest)return;
  const lamps={};
  for(const x of Object.values(out.channels)){
   lamps[Core.CHANNELS[x.id].onId]=x.greenOn;
   lamps[Core.CHANNELS[x.id].ovhtId]=x.overheatOn;
  }
  // The iframe overhead-bridge is the SINGLE DOM painter for the eight OH15
  // lamps: it applies the liveElectricalPower gate and visual/LAMP TEST priority.
  // The former direct DOM fallback could repaint green ON every 250ms while the
  // bridge immediately forced OFF, producing visible flashing on a dead bus.
  // Re-send the projection for iframe reload/race recovery, never paint twice.
  try{iframe.contentWindow?.postMessage({type:'b737:cockpit-command',
   action:'window-heat-projection',lamps,annunciations:out.annunciations},location.origin);}catch{}
 }

 function diagnosticPower(b){
  const keys=['generator1','generator2','main1','main2','dc1','dc2'];
  const off=keys.filter(k=>b?.[k]===false),unknown=keys.filter(k=>b?.[k]!==true&&b?.[k]!==false);
  return {liveBuses:b||null,off,unknown,mode:trainingPower?'WINDOW_HEAT_TRAINING_SUPPLY':'AIRCRAFT_ELECTRICAL',
   explanation:trainingPower?'TRAINING POWER ON · ONLY WINDOW HEAT · CBs and faults remain active'
     :!b?'AIRCRAFT ELECTRICAL STATE NOT READY'
     :off.length||unknown.length?'WINDOW HEAT FEED INCOMPLETE · OFF: '+(off.join(', ')||'none')+' · UNKNOWN: '+(unknown.join(', ')||'none')
     :'WINDOW HEAT AC/DC FEEDS AVAILABLE'};
 }
 function draw(out){
  if(!ui)return;
  const live=buses(),power=diagnosticPower(live);
  const powerStatus=ui.querySelector('#wh-power-status');
  if(powerStatus)powerStatus.textContent=power.explanation;
  const status=ui.querySelector('#wh-status');
  status.textContent=Object.keys(out.channels).map(id=>{const v=out.channels[id];return id.replace('_',' ')+' '+(v.overheatOn?'OVHT':v.greenOn?'ON':v.selected?'STBY/OFF':'OFF');}).join(' · ')+
   ' | ANTI-ICE '+(out.annunciations.antiIceCaution?'CAUTION':'NORMAL');
  for(const id of ['wh-caution-master','wh-caution-anti-ice']){
   const node=ui.querySelector('#'+id);if(node){const on=out.annunciations.antiIceCaution;node.textContent=id==='wh-caution-master'?'MASTER CAUTION':'ANTI-ICE';node.style.background=on?'#b67a18':'#26323b';node.style.color=on?'#fff0c5':'#889eaa';node.style.borderColor=on?'#f1b547':'#42525f';node.dataset.active=String(on);}
  }
  const rows=ui.querySelector('#wh-rows');rows.replaceChildren();
  for(const [id,v]of Object.entries(out.channels)){
   const tr=document.createElement('tr');
   for(const val of [id,v.selected?'ON':'OFF',v.controllerPower?'YES':'NO',v.heaterPower?'HEAT':'OFF',v.temperatureC+'°C',v.greenOn?'ON':'OFF',v.overheatOn?'OVHT':'OFF']){
    const td=document.createElement('td');td.textContent=val;td.style.padding='3px 5px';td.style.borderBottom='1px solid #566';tr.append(td);
   }rows.append(tr);
  }
  ui.querySelector('#wh-aux').textContent=Object.entries(out.aux).map(([id,v])=>id+': '+(v.heaterPower?'HEAT':'OFF')+' / CB '+(v.cbClosed?'IN':'OUT')).join(' · ');
 }
 let ui=null;
 function makeUI(){
  const anchor=document.querySelector('.overhead-tools')||document.querySelector('#inspector');if(!anchor)return;
  ui=document.createElement('details');ui.id='windowHeatTrainingV1';ui.dir='ltr';
  ui.style.cssText='margin-top:12px;padding:10px;border:1px solid #657383;border-radius:8px;color:inherit;font:12px/1.5 sans-serif';
  ui.innerHTML='<summary style="cursor:pointer;font-weight:700">WINDOW HEAT · Live System / Failure Test</summary>'+
   '<p style="font-size:12px">Real OH15 switches + Electrical V7 + CB Panel Lab. FCOM 3/SP.3 generic training.</p>'+
   '<p style="font-size:12px">POWER TEST checks all four green ON lamps even when the window switches are OFF. A failed feed, CB, controller or test circuit keeps its channel dark. OVERHEAT TEST behavior is unchanged.</p>'+
   '<p id="wh-status" role="status">Connecting overhead and electrical engine…</p>'+
   '<label style="display:flex;align-items:center;gap:7px;padding:8px;border:1px solid #647785;border-radius:5px"><input id="wh-training-power" type="checkbox" aria-label="Enable training power for Window Heat only"> WINDOW HEAT TRAINING POWER · AC/DC (demo only)</label>'+
   '<p id="wh-power-status" role="status" style="font-size:11px">Checking real AC/DC buses…</p>'+
   '<div style="display:flex;gap:8px;margin:8px 0 12px 0"><span id="wh-caution-master" style="padding:5px 9px;border:1px solid #42525f;border-radius:4px;font-weight:700">MASTER CAUTION</span><span id="wh-caution-anti-ice" style="padding:5px 9px;border:1px solid #42525f;border-radius:4px;font-weight:700">ANTI-ICE</span></div>'+
   '<div style="overflow-x:auto"><table style="font-size:11px;width:100%;border-collapse:collapse"><thead><tr><th>CH</th><th>SW</th><th>CTRL</th><th>POWER</th><th>TEMP</th><th>GREEN</th><th>OVHT</th></tr></thead><tbody id="wh-rows"></tbody></table></div>'+
   '<p id="wh-aux"></p>'+
   '<div style="display:flex;flex-wrap:wrap;gap:5px"><select id="wh-channel" aria-label="Window channel"><option value="L_FWD">L FWD</option><option value="L_SIDE">L SIDE</option><option value="R_FWD">R FWD</option><option value="R_SIDE">R SIDE</option></select>'+
   '<select id="wh-fault" aria-label="Failure"><option value="HEATER_FAIL">Heater fail</option><option value="CONTROLLER_FAIL">Controller fail</option><option value="SENSOR_FAIL">Sensor fail</option><option value="STUCK_OVERHEAT">Stuck OVHT</option><option value="POWER_TEST_FAIL">Power test fail</option></select>'+
   '<button type="button" id="wh-inject">Inject fault</button><button type="button" id="wh-clear">Clear fault</button><button type="button" id="wh-reset">Reset WH</button></div>'+
   '<p style="font-size:11px"><a href="../../cb-panel-lab/" target="_blank" rel="noopener">Open CB panels P6-11 / P6-12 / P18-3</a> (same browser origin; pulls sync live). Test POWER and OVHT with the real centre spring switch.</p>';
  const lab=document.createElement('dialog');lab.id='windowHeatTestLabDialog';lab.dir='rtl';
  lab.style.cssText='width:min(980px,94vw);max-width:980px;max-height:90vh;overflow:auto;padding:14px;background:#101f2b;color:#e1ecf4;border:1px solid #79d5df;border-radius:12px;box-shadow:0 18px 70px #000b';
  lab.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px"><strong style="font-size:16px;letter-spacing:.4px">WINDOW HEAT · TEST LAB</strong><button type="button" id="wh-lab-close" aria-label="Close Window Heat Test Lab">Close ×</button></div>'+
   '<p style="margin:0 0 10px;color:#9bb1c2;font-size:12px">Triple-click or tap the Unified Cockpit title to enter. This lab tests the Window Heat system only.</p>';
  lab.append(ui);ui.open=true;document.body.append(lab);
  lab.querySelector('#wh-lab-close').onclick=()=>lab.close();
  lab.addEventListener('click',e=>{if(e.target===lab)lab.close();});
  const trigger=document.querySelector('#inspector h1');
  if(trigger){
   trigger.title='Triple-click or tap to open Window Heat Test Lab';
   trigger.style.userSelect='none';
   let tapCount=0,lastTap=0,resetTapTimer=null;
   trigger.addEventListener('click',()=>{
    const now=performance.now();tapCount=now-lastTap<=1200?tapCount+1:1;lastTap=now;
    clearTimeout(resetTapTimer);resetTapTimer=setTimeout(()=>{tapCount=0;},1200);
    if(tapCount>=3){tapCount=0;clearTimeout(resetTapTimer);if(!lab.open)lab.showModal();}
   });
  }
  const trainingCheckbox=ui.querySelector('#wh-training-power');
  trainingCheckbox.checked=trainingPower;
  trainingCheckbox.onchange=()=>setTrainingPower(!!trainingCheckbox.checked);
  const controls=()=>[ui.querySelector('#wh-channel').value,ui.querySelector('#wh-fault').value];
  ui.querySelector('#wh-inject').onclick=()=>{const [ch,f]=controls();fault(ch,f,true);};
  ui.querySelector('#wh-clear').onclick=()=>{const [ch,f]=controls();fault(ch,f,false);};
  ui.querySelector('#wh-reset').onclick=()=>{s=Core.initialState();faults={};saveFaults();tick(0);};
 }
 function saveFaults(){try{localStorage.setItem(FAULT_KEY,JSON.stringify(faults));}catch{}}
 function setTrainingPower(active){
  if(typeof active!=='boolean')throw Error('Window Heat training power expects boolean');
  trainingPower=active;
  try{localStorage.setItem(TRAIN_KEY,active?'1':'0');}catch{}
  const control=ui?.querySelector('#wh-training-power');if(control)control.checked=active;
  tick(0);
  return diagnosticPower(buses());
 }
 function fault(channel,id,active){
  s=Core.injectFault(s,channel,id,active);
  if(!faults[channel])faults[channel]={};faults[channel][id]=active;saveFaults();tick(0);
 }
 function tick(forcedSeconds){
  // Wall-clock time is important for the 60-second OVERHEAT test.
  // If the CB tab is active or this tab is briefly background-throttled,
  // catch up using elapsed real time rather than delaying the expiry.
  const now=performance.now(),dt=typeof forcedSeconds==='number'?forcedSeconds:Math.min(300,Math.max(0,(now-lastAt)/1000));lastAt=now;
  // Missing electrical authority is fail-dark, not an invitation to retain a
  // stale illuminated projection from a previous source or iframe session.
  const injected=window.B737UnifiedBusFailureInjectionV1?.live?.get?.()?.active===true;
  const live=electricalBusSnapshot||buses(),b=trainingPower&&!injected?TRAIN_BUSES:(live||{}),sw=switches();if(!Object.keys(sw).length){
   if(ui)ui.querySelector('#wh-status').textContent='WAITING FOR LIVE ELECTRICAL / OVERHEAD AUTHORITY';
   return;
  }
  const r=Core.step(s,{buses:b,switches:sw,breakers:breaks()},dt);s=r.state;last=r.output;
  last.powerDiagnostic=diagnosticPower(live);
  last.powerDiagnostic.effectiveBuses={...b};
  applyLamps(last);draw(last);
  if(previousCaution!==last.annunciations.antiIceCaution){
   previousCaution=last.annunciations.antiIceCaution;
   window.dispatchEvent(new CustomEvent('b737:window-heat-annunciations',{detail:last.annunciations}));
  }
 }
 function linkOverhead(){
  let w;try{w=document.getElementById('overheadFrame')?.contentWindow;}catch{}
  if(w&&w!==child){
   child=w;
   w.addEventListener('b737:switch-change',e=>{if(e.detail?.id?.startsWith('window-'))tick(0);});
   w.addEventListener('b737:overhead-light-state',()=>{if(last)applyLamps(last);});
  }
 }
 function boot(){makeUI();linkOverhead();setInterval(()=>{linkOverhead();tick();},250);window.addEventListener('b737:bus-failure-injection-changed',()=>{if(!electricalBusSnapshot)tick(0);});window.addEventListener('b737:cb-state-change',()=>tick(0));window.addEventListener('storage',e=>{if(e.key===CB_KEY)tick(0);if(e.key===FAULT_KEY){try{const next=JSON.parse(e.newValue||'{}');for(const ch of Object.keys(Core.CHANNELS))for(const f of Core.FAULTS)s=Core.injectFault(s,ch,f,!!next?.[ch]?.[f]);faults=next;}catch{}tick(0);}});}
 window.B737WindowHeatUnifiedV1=Object.freeze({getState:()=>s,getOutput:()=>last,
   setElectricalBusSnapshot:feeds=>{
    if(!feeds||typeof feeds!=='object')throw Error('Window Heat electrical feed snapshot required');
    const keys=['generator1','generator2','main1','main2','dc1','dc2'];
    for(const id of keys)if(!Object.hasOwn(feeds,id)||
     ![true,false,null].includes(feeds[id]))
     throw Error('Window Heat invalid electrical feeder '+id);
    const next=Object.fromEntries(keys.map(key=>[key,feeds[key]]));
    if(electricalBusSnapshot&&keys.every(key=>electricalBusSnapshot[key]===next[key]))return false;
    electricalBusSnapshot=next;tick(0);return true;
   },
   getEventElectricalPower:()=>electricalBusSnapshot?{...electricalBusSnapshot}:null,
  getPowerDiagnostic:()=>diagnosticPower(buses()),setTrainingPower,injectFault:fault,
  reset:()=>{s=Core.initialState();faults={};saveFaults();tick(0);},
  evaluate:()=>tick(0),matchedCBs:Core.ALL_CBS});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/cb/tat-probe-cb-link-v1.js?v=TAT-CB-0001 */
try{
/* Canonical TAT CB link: P18-3 C5, shared with the photo CB Panel Lab.
 * Uses its exact persisted BreakerNetwork schema; never invents a new CB.
 * Only the requested key is modified and every unrelated pull/fault is retained.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737TatCbLinkV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const STORAGE='b737classic.cb.v1',CB_ID='P18-3|ALL|C5';
 function valid(s){return !!s&&s.schema===1&&['CPCS','DCPCS'].includes(s.variant)&&Array.isArray(s.breakers)&&Array.isArray(s.buses);}
 function read(s){const record=valid(s)?s.breakers.find(x=>x.id===CB_ID):null;return {key:CB_ID,pulled:!!(record?.pulled||record?.tripped),tripped:!!record?.tripped,fault:record?.fault||null};}
 function setPulled(snapshot,pulled,variant='CPCS'){
  if(typeof pulled!=='boolean')return {ok:false,reason:'INVALID_ACTION'};
  if(snapshot&&!valid(snapshot))return {ok:false,reason:'INVALID_SNAPSHOT'};
  const next=snapshot?JSON.parse(JSON.stringify(snapshot)):{schema:1,variant:variant==='DCPCS'?'DCPCS':'CPCS',breakers:[],buses:[]};
  const record=read(next);
  if(!pulled&&(record.tripped||record.fault))return {ok:false,reason:'TRIPPED_CB_REQUIRES_FAULT_CLEAR',state:record};
  next.breakers=next.breakers.filter(x=>x.id!==CB_ID);
  if(pulled)next.breakers.push({id:CB_ID,pulled:true,tripped:false,fault:null});
  return {ok:true,snapshot:next,state:read(next)};
 }
 return Object.freeze({STORAGE,CB_ID,read,setPulled,valid});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/tat-probe-v1.js?v=TAT-STUCK-0003 */
try{
/* B737 Classic TAT probe heat — generic ground test trainer.
 * FCOM 3.10.4: momentary TAT TEST on ground applies power to TEMP PROBE.
 * FCOM 3.20.4: probe electrically heated. Aspirated probe ground inhibit
 * suppresses the amber lamp with PITOT A ON even though ground heater is OFF.
 * Classic MRG: MAIN BUS 2 115V AC, TEMP PROBE CB P18-3 C5 (photo catalogue).
 * No AMM-level aircraft wiring or heat-rate guesses. No protected artwork.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737TATProbeV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const CB_ID='P18-3|ALL|C5';
 const FAULTS=Object.freeze(['HEATER_FAIL','CURRENT_SENSE_FAIL','PROBE_STUCK_OFF','PROBE_STUCK_ON','INDICATOR_STUCK_ON','INDICATOR_STUCK_OFF']);
 const initialState=()=>({schema:'b737-tat-probe/1',faults:Object.fromEntries(FAULTS.map(id=>[id,false]))});
 const copy=s=>({schema:s.schema,faults:{...s.faults}});
 function injectFault(state,id,active){
  if(!FAULTS.includes(id)||typeof active!=='boolean')throw Error('Invalid TAT fault');
  const next=copy(state);next.faults[id]=active;return next;
 }
 function evaluate(state,input={}){
  if(state?.schema!=='b737-tat-probe/1')throw Error('Invalid TAT probe state');
  const onGround=input.onGround===true;
  const groundKnown=typeof input.onGround==='boolean';
  const pitotAOn=String(input.switches?.['pitot-a']||'OFF').toUpperCase()==='ON';
  const testPressed=input.testPressed===true;
  const cbClosed=input.breakers?.[CB_ID]!==false;
  const liveBus=input.buses?.main2;
  const busMain2=input.trainingPower===true||liveBus===true;
  // On the ground the spring-loaded test contact is the heater demand.
  // In flight the normal PITOT STATIC HEAT A selection requests heating.
  const heaterRequested=groundKnown&&(onGround?testPressed:pitotAOn);
  // Probe STUCK OFF/ON refers to physical heater behavior, NOT the
  // separate annunciator failure modes. A stuck-on heater still needs
  // real power and a closed C5 CB; a stuck-off heater cannot draw current.
  const stuckOff=state.faults.PROBE_STUCK_OFF===true;
  const stuckOn=state.faults.PROBE_STUCK_ON===true;
  const heaterPower=busMain2&&cbClosed&&!state.faults.HEATER_FAIL&&!stuckOff&&(heaterRequested||stuckOn);
  const heatVerified=heaterPower&&!state.faults.CURRENT_SENSE_FAIL;
  // Classic aspirated TAT: ground inhibit relay disconnects the heater
  // when PITOT A is ON, but extinguishes its TEMP PROBE annunciator.
  // The momentary ground TEST overrides this *indication* bypass and
  // checks real heater current even with A selected ON.
  const groundIndicationBypass=onGround&&pitotAOn&&!testPressed;
  // Indicator circuitry is on 28 V DC (INDICATOR DIM BUS / DC1 model).
  // Separate lamp supply from heater MAIN BUS 2 AC; dark cockpit must not
  // show a fabricated lit amber light without indicator electrical power.
  const lampPower=input.trainingPower===true||input.indicatorPower===true||input.buses?.dc1===true;
  const amberDemand=state.faults.INDICATOR_STUCK_ON?true:
   state.faults.INDICATOR_STUCK_OFF?false:
   stuckOff?true:
   stuckOn?!heatVerified:
   groundIndicationBypass?false:!heatVerified;
  const amberOn=!!(lampPower&&amberDemand);
  return {
   onGround:groundKnown?onGround:null,groundKnown,pitotAOn,testPressed,
   cbId:CB_ID,cbClosed,main2Present:busMain2,liveMain2:liveBus===true?true:liveBus===false?false:null,
   trainingPower:input.trainingPower===true,heaterRequested,heaterPower,heatVerified,probeStuckOn:stuckOn,probeStuckOff:stuckOff,
   groundIndicationBypass,lampPower,amberDemand,amberOn,
   faults:{...state.faults},testEligible:groundKnown&&onGround,
   status:!groundKnown?'GROUND/AIR STATUS UNKNOWN':
    !lampPower?'TEMP PROBE INDICATOR SUPPLY UNPOWERED':
    stuckOff?'TEMP PROBE STUCK OFF · NO HEATER CURRENT':
    stuckOn?(heaterPower?'TEMP PROBE STUCK ON · HEATER ENERGIZED':'TEMP PROBE STUCK ON · ELECTRICAL FEED UNAVAILABLE'):
    testPressed&&!onGround?'TAT GROUND TEST INHIBITED IN FLIGHT':
    heaterRequested&&!busMain2?'MAIN BUS 2 UNPOWERED':
    heaterRequested&&!cbClosed?'TEMP PROBE CB P18-3 C5 PULLED':
    heaterRequested&&state.faults.HEATER_FAIL?'HEATER FAILED':
    heaterPower&&state.faults.CURRENT_SENSE_FAIL?'CURRENT DETECTOR FAILED':
    heaterPower?'HEATER POWERED / TEMP PROBE LAMP OFF':
    groundIndicationBypass?'GROUND INHIBIT: TAT NOT HEATED, INDICATION SUPPRESSED':
    'TAT PROBE HEAT NOT REQUESTED'
  };
 }
 return Object.freeze({CB_ID,FAULTS,initialState,injectFault,evaluate});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./tat-probe-unified-v1.js?v=TAT-SIXPACK-LIVE-0002 */
try{
/* Live TAT probe trainer in Unified. Additive only; OH15 graphics and the
 * momentary TAT button are owned by the locked overhead assembly.
 * P18-3 C5 is shared with CB Panel Lab through its persisted snapshot.
 */
(function(){'use strict';
 const Core=window.B737TATProbeV1,CbLink=window.B737TatCbLinkV1;
 if(!Core){console.error('TAT core unavailable');return;}
 const CB_KEY='b737classic.cb.v1',FAULT_KEY='b737.tat-probe.faults.v1',TRAIN_KEY='b737.tat-probe.training-power.v1';
 // The cockpit boots cold and dark. As with Window Heat, TAT training supply
 // defaults ON for standalone classroom switch checks; OFF restores actual
 // Main Bus 2 heater / DC1 annunciator gating with no invented aircraft feed.
 let state=Core.initialState(),pressed=false,trainingPower=true,output=null,child=null,ui=null,lastSixPackSignature='';
 try{trainingPower=localStorage.getItem(TRAIN_KEY)!=='0';}catch{}
 try{
  const f=JSON.parse(localStorage.getItem(FAULT_KEY)||'{}');
  for(const id of Core.FAULTS)if(typeof f[id]==='boolean')state=Core.injectFault(state,id,f[id]);
 }catch{}
 const frame=()=>document.getElementById('overheadFrame');
 function readLive(){
  try{
   const p=window.B737ISNCockpitV1,st=p?.getStartState?.(),e=st?.electrical;
   const bus=e&&typeof e==='object'&&Object.prototype.hasOwnProperty.call(e,'main2')?e:p?.getState?.()?.state?.electrical?.bus||null;
   const envelope=st?.runningEnvelope;
   const ground=typeof envelope?.onGround==='boolean'?envelope.onGround:
    p?.getState?.()?.state?.context?.onGround;
   return {buses:bus,onGround:typeof ground==='boolean'?ground:null};
  }catch{return {buses:null,onGround:null};}
 }
 function switches(){
  try{return frame()?.contentWindow?.B737OverheadToggles?.getState?.()||{};}
  catch{return {};}
 }
 function breakers(){
  const out={};
  try{const snapshot=JSON.parse(localStorage.getItem(CB_KEY)||'{}');
   for(const cb of snapshot.breakers||[])if(cb.pulled||cb.tripped)out[cb.id]=false;
  }catch{}
  return out;
 }
 function cbStatus(){
  try{
   const snapshot=JSON.parse(localStorage.getItem(CB_KEY)||'null');
   if(CbLink)return CbLink.read(snapshot);
   const rec=snapshot?.breakers?.find(x=>x.id===Core.CB_ID);
   return {key:Core.CB_ID,pulled:!!(rec?.pulled||rec?.tripped),tripped:!!rec?.tripped,fault:rec?.fault||null};
  }catch{return {key:Core.CB_ID,pulled:false,tripped:false,fault:null};}
 }
 function setCbPulled(pulled){
  if(typeof pulled!=='boolean'||!CbLink)return {ok:false,reason:'CB_LINK_UNAVAILABLE'};
  // If the real CB Panel Lab is open, use its own kernel: it enforces
  // fault and pull rules and persists the same shared state.
  try{
   const front=document.getElementById('cbPanelFrame')?.contentWindow?.B737_CB_LAB;
   if(front&&typeof front.setPulled==='function'){
    const ok=front.setPulled(Core.CB_ID,pulled);
    if(ok){evaluate();return {ok:true,state:cbStatus(),source:'CB_PANEL_LAB'};}
    return {ok:false,reason:'CB_KERNEL_REJECTED',state:cbStatus()};
   }
  }catch{}
  try{
   const raw=localStorage.getItem(CB_KEY);
   const existing=raw?JSON.parse(raw):null;
   const variant=JSON.parse(localStorage.getItem('b737classic.aircraft-profile.v1')||'{}').pressurization;
   const result=CbLink.setPulled(existing,pulled,variant);
   if(!result.ok)return result;
   localStorage.setItem(CB_KEY,JSON.stringify(result.snapshot));
   evaluate();return {ok:true,state:cbStatus(),source:'SHARED_CB_SNAPSHOT'};
  }catch{return {ok:false,reason:'CB_STORAGE_ERROR'};}
 }
 function project(o){
  const f=frame();if(!f)return;
  let doc;try{doc=f.contentDocument;}catch{return;}
  if(!doc?.documentElement||doc.documentElement.classList.contains('cockpit-visual-test')||
   f.contentWindow?.B737OverheadLights?.getState?.()?.lampTest)return;
  try{f.contentWindow?.postMessage({type:'b737:cockpit-command',
    action:'tat-probe-projection',lamps:{'probe-temp':o.amberOn}},location.origin);}catch{}
  const el=doc.querySelector('.mounted-light[data-light="probe-temp"]');
  if(!el)return;
  const face=o.amberOn?'ON':'OFF';
  for(const img of el.querySelectorAll('.light-face'))img.classList.toggle('active',img.dataset.frame===face);
  el.dataset.frame=face;el.dataset.state=face;
  el.dataset.tatProbeEngine='v1';
  el.setAttribute('aria-label','TEMP PROBE — '+face+' (TAT probe heat)');
 }
 function show(o){
  if(!ui)return;
  const status=ui.querySelector('#tat-status');
  if(status)status.textContent=o.status;
  for(const [id,value] of Object.entries({
   'tat-ground':o.onGround===null?'UNKNOWN':o.onGround?'GROUND':'AIR',
   'tat-switch':o.pitotAOn?'PITOT A ON':'PITOT A OFF',
   'tat-button':o.testPressed?'PRESSED':'RELEASED',
   'tat-bus':o.liveMain2===null?'UNKNOWN':o.liveMain2?'ON':'OFF',
   'tat-cb':o.cbClosed?'IN':'OUT',
   'tat-heat':o.heaterPower?'HEATING':'OFF',
   'tat-indicator-feed':o.lampPower?'POWERED':'UNPOWERED',
   'tat-ground-inhibit':o.groundIndicationBypass?'ACTIVE':'INACTIVE',
   'tat-lamp':o.amberOn?'AMBER ON':'OFF'
  })){
   const node=ui.querySelector('#'+id);if(node)node.textContent=value;
  }
 }
 function evaluate(){
  const live=readLive();
  output=Core.evaluate(state,{...live,switches:switches(),breakers:breakers(),
    testPressed:pressed,trainingPower});
  project(output);show(output);
  // Independent annunciator observer; never affects TAT operation or CB state.
  const signature=JSON.stringify([output.amberOn,output.lampPower,output.heaterRequested,
   output.testPressed,output.faults,output.onGround,output.trainingPower]);
  if(signature!==lastSixPackSignature){
   lastSixPackSignature=signature;
   window.dispatchEvent(new CustomEvent('b737:tat-probe-output',{detail:{...output}}));
  }
  return output;
 }
 function fault(id,active){
  state=Core.injectFault(state,id,active);
  try{localStorage.setItem(FAULT_KEY,JSON.stringify(state.faults));}catch{}
  evaluate();
 }
 function setTrainingPower(active){
  if(typeof active!=='boolean')throw Error('TAT training power expects boolean');
  trainingPower=active;
  try{localStorage.setItem(TRAIN_KEY,active?'1':'0');}catch{}
  const input=ui?.querySelector('#tat-training-power');if(input)input.checked=active;
  evaluate();
 }
 function onMessage(e){
  if(e.origin!==location.origin||e.source!==frame()?.contentWindow||
      e.data?.type!=='b737:cockpit-overhead'||
      e.data?.kind!=='recessed-button'||e.data?.id!=='pitot-static-tat-test')return;
  pressed=e.data.pressed===true;evaluate();
 }
 function attachFrame(){
  let w;try{w=frame()?.contentWindow;}catch{}
  if(w&&w!==child){
   child=w;pressed=false;
   w.addEventListener('b737:switch-change',e=>{
    if(e.detail?.id==='pitot-a')evaluate();
   });
   w.addEventListener('b737:overhead-light-state',()=>{
    if(output)project(output);
   });
  }
 }
 function mountLab(){
  const lab=document.getElementById('windowHeatTestLabDialog');
  if(!lab||lab.querySelector('#tat-probe-system-v1'))return;
  ui=document.createElement('section');ui.id='tat-probe-system-v1';ui.dir='ltr';
  ui.style.cssText='padding:12px;margin:16px 0 2px;border:1px solid #5d7887;border-radius:9px;color:inherit;font:12px/1.5 sans-serif';
  ui.innerHTML='<h3 style="margin:0 0 8px">TAT PROBE HEAT · FCOM 3.10.4 / MRG</h3>'+
   '<p style="margin:0 0 9px">GROUND: with PITOT A OFF, TEMP PROBE is amber. Hold TAT TEST to energize the heater and extinguish amber (if healthy); release returns amber. With PITOT A ON, the TAT heater remains inhibited on ground BUT TEMP PROBE is dark. TAT TEST overrides ground inhibit to check real current. No timer.</p>'+
   '<label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="tat-training-power"> TAT TRAINING SUPPLY · isolated MAIN BUS 2 + indicator DC (demo only, default ON)</label>'+
   '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">'+
    '<div>Ground: <strong id="tat-ground">—</strong></div><div>Switch: <strong id="tat-switch">—</strong></div><div>TAT TEST: <strong id="tat-button">—</strong></div>'+
    '<div>Actual MAIN2: <strong id="tat-bus">—</strong></div><div>CB P18-3 C5: <strong id="tat-cb">—</strong></div><div>Heater: <strong id="tat-heat">—</strong></div>'+
    '<div>TEMP PROBE: <strong id="tat-lamp">—</strong></div><div>Indicator DC: <strong id="tat-indicator-feed">—</strong></div>'+
    '<div>Ground inhibit: <strong id="tat-ground-inhibit">—</strong></div></div>'+
   '<p id="tat-status" role="status" style="font-weight:700;margin:10px 0">Connecting…</p>'+
   '<div style="display:flex;gap:7px;flex-wrap:wrap"><select id="tat-fault" aria-label="TAT trainer failure">'+
    '<option value="HEATER_FAIL">Heater fail</option><option value="CURRENT_SENSE_FAIL">Current detector fail</option>'+
    '<option value="INDICATOR_STUCK_ON">TEMP PROBE lamp stuck ON</option><option value="INDICATOR_STUCK_OFF">TEMP PROBE lamp stuck OFF</option></select>'+
    '<button id="tat-inject" type="button">Inject</button><button id="tat-clear" type="button">Clear</button>'+
    '<button id="tat-reset" type="button">Reset TAT faults</button></div>'+
   '<p style="margin:9px 0 0;font-size:11px">CB: <a href="../../cb-panel-lab/" target="_blank" rel="noopener">P18-3 / C5 TEMP PROBE</a>. Pull/push from CB Panel Lab and return to Unified.</p>';
  lab.append(ui);
  const power=ui.querySelector('#tat-training-power');
  power.checked=trainingPower;
  power.onchange=()=>setTrainingPower(!!power.checked);
  ui.querySelector('#tat-inject').onclick=()=>fault(ui.querySelector('#tat-fault').value,true);
  ui.querySelector('#tat-clear').onclick=()=>fault(ui.querySelector('#tat-fault').value,false);
  ui.querySelector('#tat-reset').onclick=()=>{state=Core.initialState();try{localStorage.setItem(FAULT_KEY,'{}');}catch{}evaluate();};
 }
 function boot(){
  mountLab();attachFrame();evaluate();
  window.addEventListener('message',onMessage);
  window.addEventListener('storage',e=>{
   if(e.key===CB_KEY)evaluate();
   if(e.key===FAULT_KEY){try{
    const values=JSON.parse(e.newValue||'{}');
    for(const id of Core.FAULTS)state=Core.injectFault(state,id,!!values[id]);
   }catch{}evaluate();}
   if(e.key===TRAIN_KEY){trainingPower=e.newValue==='1';const box=ui?.querySelector('#tat-training-power');if(box)box.checked=trainingPower;evaluate();}
  });
  frame()?.addEventListener('load',()=>{pressed=false;attachFrame();evaluate();});
  setInterval(()=>{attachFrame();evaluate();},250);
 }
 window.B737TATProbeUnifiedV1=Object.freeze({
  getOutput:()=>output,getState:()=>state,injectFault:fault,setTrainingPower,
  getCbState:cbStatus,setCbPulled,
  evaluate,cbId:Core.CB_ID,reset:()=>{state=Core.initialState();pressed=false;try{localStorage.setItem(FAULT_KEY,'{}');}catch{}evaluate();}
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./antiice-live-test-lab-v2.js?v=ANTIICE-STUCK-0003&amp;cb=CB-UNIFIED-0001 */
try{
/* ANTIICE-EMBED-0002
 * Live original Unified OH15 stage: one separate same-origin overhead-stage
 * iframe cropped to its registered OH15 atlas tile. All 7 metal toggle
 * sprites, 17 light sockets, the original momentary recessed TAT switch and
 * locked blanking plate come from the real stage; no HTML imitations.
 * Lab physics are isolated and run through the same Window Heat/TAT cores.
 */
(function(){'use strict';
const WH=window.B737WindowHeatV1,TAT=window.B737TATProbeV1,TATLive=window.B737TATProbeUnifiedV1;
if(!WH||!TAT)return;
const TILE={x:1231,y:1031,w:493,h:508},FRAME={w:2220,h:3312};
const WH_IDS=Object.keys(WH.CHANNELS),LAMP_IDS=[
 'probe-capt-ps','probe-fo-static','probe-l-elev','probe-l-alpha',
 'probe-fo-ps','probe-capt-static','probe-r-elev','probe-r-alpha'];
const PITOT={
 'probe-capt-ps':'pitot-a','probe-fo-static':'pitot-a',
 'probe-l-elev':'pitot-a','probe-l-alpha':'pitot-a',
 'probe-fo-ps':'pitot-b','probe-capt-static':'pitot-b',
 'probe-r-elev':'pitot-b','probe-r-alpha':'pitot-b'
};
const CHANNELS=Object.fromEntries(WH_IDS.map(id=>[id,WH.CHANNELS[id]]));
const KEY='b737classic.cb.v1';
const DEFAULT_BUS=()=>({generator1:true,generator2:true,main1:true,main2:true,dc1:true,dc2:true});
const scenarioList=[
 {id:'normal',name:'All systems healthy',note:'Switch the original controls freely; CB and supplied buses are available'},
 {id:'cold',name:'Cold & Dark',bus:'all',note:'No AC or DC; no heat or powered indications'},
 {id:'main1',name:'MAIN BUS 1 loss',bus:'main1',note:'Channel controllers tied to MAIN1 have no supply'},
 {id:'main2',name:'MAIN BUS 2 loss',bus:'main2',note:'MAIN2 controllers and the TAT heater lose AC'},
 {id:'gen1',name:'GENERATOR BUS 1 loss',bus:'generator1'},
 {id:'gen2',name:'GENERATOR BUS 2 loss',bus:'generator2'},
 {id:'dc1',name:'DC 1 loss',bus:'dc1',note:'L FWD / R SIDE controller DC and indicator A unavailable'},
 {id:'dc2',name:'DC 2 loss',bus:'dc2',note:'L SIDE / R FWD controller DC and indicator B unavailable'},
 {id:'window-power',name:'WINDOW PWR TEST',action:'PWR TEST',windowAll:'OFF',note:'All four green ON annunciations tested with the window switches OFF'},
 {id:'window-ovht',name:'WINDOW OVHT TEST',action:'OVHT',windowAll:'ON',note:'60-second amber test; individual OFF clears only that channel'},
 {id:'wh-heater',name:'Window heater open',channel:'L_FWD',whFault:'HEATER_FAIL'},
 {id:'wh-controller',name:'Window controller fail',channel:'L_FWD',whFault:'CONTROLLER_FAIL'},
 {id:'wh-sensor',name:'Window sensor fail',channel:'L_FWD',whFault:'SENSOR_FAIL'},
 {id:'wh-overheat',name:'Real window overheat',channel:'L_FWD',whFault:'STUCK_OVERHEAT'},
 {id:'wh-pwr-fail',name:'Window PWR TEST fail',channel:'L_FWD',whFault:'POWER_TEST_FAIL',action:'PWR TEST'},
 {id:'wh-heater-cb',name:'Window heater CB open',channel:'L_FWD',cbType:'heater'},
 {id:'wh-control-cb',name:'Window control CB open',channel:'L_FWD',cbType:'controller'},
 {id:'wh-aux-l',name:'Left L4/L5 CB open',aux:'L45'},
 {id:'wh-aux-r',name:'Right R4/R5 CB open',aux:'R45'},
 {id:'tat-ground',name:'TAT · ground normal',onGround:true},
 {id:'tat-press',name:'TAT TEST healthy',onGround:true,action:'TAT TEST'},
 {id:'tat-heater',name:'TAT heater fail',tatFault:'HEATER_FAIL',action:'TAT TEST'},
 {id:'tat-detector',name:'TAT current sensor fail',tatFault:'CURRENT_SENSE_FAIL',action:'TAT TEST'},
 // Probe heater STUCK states and annunciator STUCK states are separate
 // failure classes: probe OFF => TEMP PROBE amber, probe ON => amber dark.
 {id:'tat-probe-off',name:'TEMP PROBE STUCK OFF · amber ON',tatFault:'PROBE_STUCK_OFF',note:'Probe heater remains OFF; TEMP PROBE amber stays ON while indicator power is present.'},
 {id:'tat-probe-on',name:'TEMP PROBE STUCK ON · amber OFF',tatFault:'PROBE_STUCK_ON',note:'Probe heater remains ON when its power feed is available; TEMP PROBE amber stays OFF.'},
 {id:'tat-lamp-on',name:'TEMP PROBE INDICATOR STUCK ON',tatFault:'INDICATOR_STUCK_ON',note:'Separate indicator failure: amber lamp itself stuck illuminated.'},
 {id:'tat-lamp-off',name:'TEMP PROBE INDICATOR STUCK OFF',tatFault:'INDICATOR_STUCK_OFF',note:'Separate indicator failure: amber lamp itself stuck extinguished.'},
 {id:'tat-cb',name:'TAT C5 CB open',virtualTatCB:true,action:'TAT TEST'},
 {id:'pitot-a-fail',name:'PITOT A indication fault',pitotFault:'probe-capt-ps'},
 {id:'pitot-b-fail',name:'PITOT B indication fault',pitotFault:'probe-fo-ps'},
 {id:'flight',name:'Airborne pitot heat',onGround:false,pitotOn:true}
];
const scenarios=new Map(scenarioList.map(x=>[x.id,x]));
let dialog=null,stage=null,embedded=null,sourceDoc=null,ready=false,ticker=null,whState=WH.initialState();
let current='normal',scenario={},faults={},testHeld=false,lastAt=0,frameDetector=null,gesture=null,hitCount=0,lastHit=0,session=0;
const query=id=>dialog?.querySelector('#'+id);
const cbSnapshot=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}};
const realCbOpen=(key)=>!!cbSnapshot()?.breakers?.some(x=>x.id===key&&(x.pulled||x.tripped));
const physSwitches=()=>{try{return embedded?.contentWindow?.B737OverheadToggles?.getState?.()||{};}catch{return {};}};
const overlays={};
function infoLine(message){const el=query('anti-status');if(el)el.textContent=message;}
function post(action,lamps){
 if(!ready||!embedded?.contentWindow)return;
 embedded.contentWindow.postMessage({type:'b737:cockpit-command',action,lamps},location.origin);
}
function resetSimulation(){whState=WH.initialState();lastAt=performance.now();}
function getState(){
 const bus=DEFAULT_BUS();if(scenario.bus==='all')for(const k of Object.keys(bus))bus[k]=false;
 else if(scenario.bus&&Object.prototype.hasOwnProperty.call(bus,scenario.bus))bus[scenario.bus]=false;
 const sw={...physSwitches()};
 const breakers={};
 for(const key of WH.ALL_CBS)if(realCbOpen(key))breakers[key]=false;
 if(realCbOpen(TAT.CB_ID))breakers[TAT.CB_ID]=false;
 if(scenario.cbType&&WH.CHANNELS[scenario.channel]){
  breakers[WH.CHANNELS[scenario.channel][scenario.cbType==='controller'?'controllerCB':'heaterCB']]=false;
 }
 if(scenario.aux)breakers[WH.AUX[scenario.aux].breaker]=false;
 if(scenario.virtualTatCB)breakers[TAT.CB_ID]=false;
 for(const [id,d] of Object.entries(WH.CHANNELS))for(const fault of WH.FAULTS)
  if(scenario.channel===id&&scenario.whFault===fault)faults[id+'|'+fault]=true;
 const pitotFaults=LAMP_IDS.filter(id=>id===scenario.pitotFault||!!faults['pitot|'+id]);
 const onGround=scenario.onGround!==false;
 return {bus,sw,breakers,pitotFaults,onGround};
}
function evaluate(elapsed=0){
 const ctx=getState();let w=whState;
 for(const id of WH_IDS)for(const fault of WH.FAULTS){
  const active=!!faults[id+'|'+fault];
  if(!!w.faults[id]?.[fault]!==active)w=WH.injectFault(w,id,fault,active);
 }
 const step=WH.step(w,{buses:ctx.bus,switches:ctx.sw,breakers:ctx.breakers},Math.max(0,Math.min(300,elapsed)));
 whState=step.state;
 const tatState=scenario.tatFault?TAT.injectFault(TAT.initialState(),scenario.tatFault,true):TAT.initialState();
 const tat=TAT.evaluate(tatState,{buses:ctx.bus,breakers:ctx.breakers,
  onGround:ctx.onGround,testPressed:testHeld,
  switches:ctx.sw,trainingPower:false});
 const wh={};
 for(const ch of Object.values(step.output.channels)){
  const d=WH.CHANNELS[ch.id];wh[d.onId]=ch.greenOn;wh[d.ovhtId]=ch.overheatOn;
 }
 const probes={};
 for(const id of LAMP_IDS){
  const sw=ctx.sw[PITOT[id]]==='ON',power=ctx.bus[PITOT[id]==='pitot-a'?'dc1':'dc2'];
  // Pitot A/B and individual probe failure are GENERIC trainer logic; no
  // unverified aircraft WDM/individual CB wiring is claimed.
  const heater={'probe-capt-ps':'captUpper','probe-fo-static':'foLower','probe-l-elev':'elevatorL','probe-l-alpha':'alphaL','probe-fo-ps':'foUpper','probe-capt-static':'captLower','probe-r-elev':'elevatorR','probe-r-alpha':'alphaR'}[id];
  probes[id]=!!power&&(!sw||ctx.pitotFaults.includes(id)||window.B737UnifiedCB?.available('probe.'+heater)===false);
 }
 post('isn-projection',probes);
 post('window-heat-projection',wh);
 post('tat-probe-projection',{'probe-temp':tat.amberOn});
 const output={window:step.output,tat,probes,buses:ctx.bus,breakers:ctx.breakers,switches:ctx.sw,mode:current,
  note:'PITOT probe failures: generic simulator approximations; TAT & Window Heat use the actual verified cores.'};
 const metrics=query('anti-metrics');
 if(metrics){
  const heated=Object.values(step.output.channels).filter(x=>x.heaterPower).length;
  const amber=Object.values(step.output.channels).filter(x=>x.overheatOn).length;
  metrics.textContent='WINDOW HEAT '+heated+'/4 heaters · '+amber+' OVERHEAT · TAT '+(tat.heaterPower?'HEATING':'OFF')+
   ' · TEMP PROBE '+(tat.amberOn?'AMBER':'OFF')+' · CB P18-3 C5 '+(ctx.breakers[TAT.CB_ID]===false?'OPEN':'CLOSED');
 }
 return output;
}
window.addEventListener('b737:cb-state-change',()=>evaluate(0));
function tick(){
 if(!ready)return;
 const now=performance.now(),dt=Math.min(300,Math.max(0,(now-lastAt)/1000));lastAt=now;
 const out=evaluate(dt);
 if(query('anti-debug'))query('anti-debug').textContent=out.tat.status;
}
function nativeSwitch(id,value){
 const win=embedded?.contentWindow,btn=win?.document?.getElementById('toggle-'+id);
 if(!btn)return false;
 const states=win.B737OverheadToggles?.getRegistry?.()?.controls?.find(x=>x.id===id)?.states||[];
 if(states.length!==2)return false;
 if(win.B737OverheadToggles.getState()[id]!==value)btn.click();
 return win.B737OverheadToggles.getState()[id]===value;
}
function nativeMomentary(id,direction,ms=240){
 const win=embedded?.contentWindow,btn=win?.document?.getElementById('toggle-'+id);
 if(!btn)return false;
 const k=direction==='OVHT'?'Home':direction==='PWR TEST'?'End':null;
 if(!k)return false;
 btn.dispatchEvent(new win.KeyboardEvent('keydown',{key:k,bubbles:true}));
 setTimeout(()=>btn.dispatchEvent(new win.KeyboardEvent('keyup',{key:k,bubbles:true})),ms);
 return true;
}
function nativeTat(ms=450){
 const win=embedded?.contentWindow,btn=win?.document?.querySelector('.b737-recess-unit[data-recessed-id="pitot-static-tat-test"] .b737-recess-unit__cap');
 if(!btn)return false;
 btn.dispatchEvent(new win.KeyboardEvent('keydown',{key:' ',bubbles:true}));
 setTimeout(()=>btn.dispatchEvent(new win.KeyboardEvent('keyup',{key:' ',bubbles:true})),ms);
 return true;
}
function onLiveEvent(){
 if(!ready)return;
 tick();
}
function connect(){
 const w=embedded?.contentWindow,doc=w?.document;
 if(!w||!doc||!w.B737OverheadToggles?.getState||!w.B737OverheadLights?.getState||
  !doc.querySelector('#atlasAbsolute .atlas-piece[data-key="OH15"]'))return false;
 if(sourceDoc===doc&&ready)return true;
 sourceDoc=doc;ready=true;testHeld=false;resetSimulation();
 w.addEventListener('b737:switch-change',e=>{
  if(e.detail?.id==='window-power-test')evaluate(0);
  else onLiveEvent();
 });
 w.addEventListener('b737:recessed-button',e=>{
  if(e.detail?.id==='pitot-static-tat-test'){testHeld=e.detail.pressed===true;evaluate(0);}
 });
 w.addEventListener('b737:overhead-light-state',()=>{ /* tick owns scenario lamps */ });
 infoLine('LIVE OH15 READY · All switches and lamps are from the original Unified overhead renderer');
 // The embedded original stage initializes asynchronously. Apply any
 // scenario selected before it mounted its real controls.
 if(current!=='normal')applyScenario(current);
 else for(const id of [...Object.values(WH.CHANNELS).map(d=>d.switchId),'pitot-a','pitot-b'])nativeSwitch(id,'OFF');
 tick();return true;
}
function applyScenario(id){
 const s=scenarios.get(id);if(!s)return false;
 current=id;scenario={...s};faults={};testHeld=false;resetSimulation();
 const el=query('anti-scenarios');
 if(el)for(const b of el.querySelectorAll('button[data-scenario]'))
  b.setAttribute('aria-pressed',String(b.dataset.scenario===id));
 if(ready){
  if(id==='normal'){
   for(const key of [...Object.values(WH.CHANNELS).map(d=>d.switchId),'pitot-a','pitot-b'])nativeSwitch(key,'OFF');
  }
  if(s.windowAll)for(const d of Object.values(WH.CHANNELS))nativeSwitch(d.switchId,s.windowAll);
  if(s.pitotOn){nativeSwitch('pitot-a','ON');nativeSwitch('pitot-b','ON');}
  if(s.channel)nativeSwitch(WH.CHANNELS[s.channel].switchId,'ON');
  if(s.action==='OVHT'||s.action==='PWR TEST')setTimeout(()=>nativeMomentary('window-power-test',s.action),100);
  if(s.action==='TAT TEST')setTimeout(()=>nativeTat(),150);
 }
 const description=query('anti-scenario-desc');
 if(description)description.textContent=s.note||('Selected: '+s.name+' · use the original live metal controls to test the fault.');
 tick();return true;
}
function chooseFault(){
 const channel=query('anti-wh-channel')?.value,fault=query('anti-wh-fault')?.value;
 if(!WH.CHANNELS[channel]||!WH.FAULTS.includes(fault))return;
 current='manual';scenario={channel,whFault:fault,note:'Manually injected Window Heat fault. Other systems remain unchanged.'};
 const k=channel+'|'+fault;faults[k]=!faults[k];resetSimulation();nativeSwitch(WH.CHANNELS[channel].switchId,'ON');
 query('anti-scenario-desc').textContent=scenario.note+' · '+(faults[k]?'FAULT ACTIVE: ':'FAULT CLEARED: ')+k;
 const buttons=query('anti-scenarios');if(buttons)for(const b of buttons.querySelectorAll('button[data-scenario]'))b.setAttribute('aria-pressed','false');
 tick();
}
function simulateCb(){
 const channel=query('anti-wh-channel')?.value,type=query('anti-cb-type')?.value;
 if(!WH.CHANNELS[channel]||!['heater','controller'].includes(type))return false;
 current='manual';scenario={channel,cbType:type};
 faults={};nativeSwitch(WH.CHANNELS[channel].switchId,'ON');
 const key=WH.CHANNELS[channel][type==='heater'?'heaterCB':'controllerCB'];
 query('anti-scenario-desc').textContent='SIMULATED CB OPEN: '+key+' (lab only, real CB unchanged).';
 tick();return true;
}
function injectPitot(){
 const id=query('anti-pitot-id')?.value;
 if(!LAMP_IDS.includes(id))return false;
 current='manual';faults['pitot|'+id]=!faults['pitot|'+id];scenario={onGround:true};
 nativeSwitch(PITOT[id],'ON');
 query('anti-scenario-desc').textContent=id+(faults['pitot|'+id]?' FAILURE INJECTED':' FAILURE CLEARED')+' · GENERIC probe trainer';
 tick();return true;
}
function injectTat(){
 const fault=query('anti-tat-fault')?.value;
 if(!TAT.FAULTS.includes(fault))return false;
 current='manual';scenario={onGround:true,tatFault:fault};
 query('anti-scenario-desc').textContent='TAT '+fault+' · use original TAT TEST to verify indication';
 tick();return true;
}
function crop(){
 const box=query('anti-live-crop'),canvas=query('anti-live-canvas');
 if(!box||!canvas)return;
 const width=Math.min(650,box.clientWidth),heightMax=Math.max(250,Math.min(window.innerHeight*.70,705));
 const scale=Math.min(width/TILE.w,heightMax/TILE.h);
 const w=TILE.w*scale,h=TILE.h*scale;
 box.style.height=h+'px';
 canvas.style.transform='scale('+scale+')';
 canvas.style.width=TILE.w+'px';canvas.style.height=TILE.h+'px';
}
function build(){
 dialog=document.createElement('dialog');dialog.id='antiIceLiveLab';dialog.className='antiice-dialog';dialog.dir='ltr';
 const buttons=scenarioList.map(s=>'<button type="button" data-scenario="'+s.id+'" aria-pressed="false">'+s.name+'</button>').join('');
 const channelOptions=WH_IDS.map(id=>'<option value="'+id+'">'+id+'</option>').join('');
 const faultOptions=WH.FAULTS.map(id=>'<option value="'+id+'">'+id+'</option>').join('');
 const pitotOptions=LAMP_IDS.map(id=>'<option value="'+id+'">'+id+'</option>').join('');
 const tatFaultOptions=TAT.FAULTS.map(id=>'<option value="'+id+'">'+id+'</option>').join('');
 dialog.innerHTML='<header class="antiice-header"><div><strong>ANTI ICE · LIVE PANEL TEST LAB</strong><small>Exact Unified OH15 tile · same bitmap, original interactive switches, original light faces</small></div><button type="button" id="anti-close" aria-label="Close test lab">×</button></header>'+
 '<div class="antiice-main"><section class="antiice-visual"><div class="antiice-crop" id="anti-live-crop">'+
 '<div class="antiice-canvas" id="anti-live-canvas"><iframe id="anti-live-stage" title="Original live Unified ANTI ICE panel OH15" loading="eager"></iframe></div></div>'+
 '<p class="antiice-note">The panel above is the original interactive Unified Overhead embedded as an independent training instance. Its lights, artwork and controls are NOT recreated.</p>'+
 '<p id="anti-metrics" role="status"></p><p id="anti-debug"></p>'+
 '<div class="antiice-buttons"><button type="button" id="anti-ovht">OVHT TEST · 60s</button><button type="button" id="anti-power">PWR TEST</button><button type="button" id="anti-tat">TAT TEST</button></div>'+
 '</section><aside class="antiice-right"><h3>TRAINING SCENARIOS AND FAILURES</h3><div class="antiice-scenarios" id="anti-scenarios">'+buttons+'</div>'+
 '<p id="anti-scenario-desc" class="antiice-desc"></p>'+
 '<h3>WINDOW HEAT · MANUAL FAULT</h3><div class="antiice-selects"><select id="anti-wh-channel">'+channelOptions+'</select><select id="anti-wh-fault">'+faultOptions+'</select><button type="button" id="anti-inject">INJECT</button></div>'+
 '<h3>WINDOW HEAT · VIRTUAL CB OPEN</h3><div class="antiice-selects"><select id="anti-cb-type"><option value="heater">HEATER CB</option><option value="controller">CONTROLLER CB</option></select><button type="button" id="anti-cb-fail">OPEN SELECTED CHANNEL CB</button></div>'+
 '<h3>PITOT STATIC · INDIVIDUAL PROBE FAILURES</h3><div class="antiice-selects"><select id="anti-pitot-id">'+pitotOptions+'</select><button type="button" id="anti-probe-fail">TOGGLE PROBE FAULT</button></div>'+
 '<h3>TAT · ALL MODELED FAULTS</h3><div class="antiice-selects"><select id="anti-tat-fault">'+tatFaultOptions+'</select><button type="button" id="anti-tat-fail">INJECT TAT FAULT</button></div>'+
 '<h3>REAL CB / VIRTUAL CB</h3><p class="antiice-note">P18-3 C5 is the actual TEMP PROBE CB. Preset open-CB scenarios are isolated: they do not change aircraft CB state.</p>'+
 '<div class="antiice-buttons"><button type="button" id="anti-real-cb">PULL REAL TAT C5</button><button type="button" id="anti-cb-view">FIND IN CB PANEL</button></div>'+
 '<button type="button" id="anti-reset">RESET LAB · CLEAR FAULTS</button><p id="anti-status" role="status"></p>'+
 '<p class="antiice-note">Pitot/static probe-failure scenarios use generic simulation behavior; no unverified aircraft-specific wiring is asserted.</p></aside></div>';
 document.body.append(dialog);embedded=query('anti-live-stage');
 const main=document.getElementById('overheadFrame');
 const source=main?.getAttribute('src')||'./overhead-stage.html';
 embedded.src=new URL(source,document.baseURI).href+(source.includes('?')?'&':'?')+'antiiceLab=1';
 embedded.style.cssText='position:absolute;left:-'+TILE.x+'px;top:-'+TILE.y+'px;width:'+FRAME.w+'px;height:'+FRAME.h+'px;border:0;max-width:none;max-height:none;display:block';
 embedded.addEventListener('load',()=>{ready=false;sourceDoc=null;connect();});
 query('anti-close').onclick=()=>dialog.close();
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>{testHeld=false;});
 query('anti-scenarios').addEventListener('click',e=>{const id=e.target.closest('[data-scenario]')?.dataset.scenario;if(id)applyScenario(id);});
 query('anti-inject').onclick=chooseFault;
 query('anti-cb-fail').onclick=simulateCb;
 query('anti-probe-fail').onclick=injectPitot;
 query('anti-tat-fail').onclick=injectTat;
 query('anti-reset').onclick=()=>{for(const d of Object.values(WH.CHANNELS))nativeSwitch(d.switchId,'OFF');nativeSwitch('pitot-a','OFF');nativeSwitch('pitot-b','OFF');applyScenario('normal');};
 query('anti-ovht').onclick=()=>{for(const d of Object.values(WH.CHANNELS))nativeSwitch(d.switchId,'ON');nativeMomentary('window-power-test','OVHT');};
 query('anti-power').onclick=()=>nativeMomentary('window-power-test','PWR TEST',650);
 query('anti-tat').onclick=()=>nativeTat(650);
 query('anti-real-cb').onclick=()=>{
  const pulled=!!TATLive?.getCbState?.()?.pulled;const out=TATLive?.setCbPulled?.(!pulled);
  if(!out?.ok)infoLine('CB command rejected: '+(out?.reason||'Unavailable'));else tick();
 };
 query('anti-cb-view').onclick=()=>{
  dialog.close();document.getElementById('cbPanelOpen')?.click();
  const frame=document.getElementById('cbPanelFrame');const focus=()=>{try{return frame?.contentWindow?.B737_CB_MRG_VIEWER?.focusByKey(TAT.CB_ID);}catch{return false;}};
  if(!focus())frame?.addEventListener('load',()=>setTimeout(focus,200),{once:true});
 };
 const observer=new ResizeObserver(crop);observer.observe(query('anti-live-crop'));
 window.addEventListener('resize',crop);crop();
 ticker=setInterval(()=>{if(!dialog.open)return;if(!ready)connect();if(ready)tick();
  const btn=query('anti-real-cb');if(btn){btn.textContent=TATLive?.getCbState?.()?.pulled?'PUSH REAL TAT C5':'PULL REAL TAT C5';}
 },140);
 applyScenario('normal');
}
function open(){
 if(!dialog)build();
 if(!dialog.open)dialog.showModal();
 crop();connect();
}
function installTripleTap(){
 const frame=document.getElementById('overheadFrame');
 let bound=null,gesture=null,count=0,at=0,pointers=new Set();
 function bind(){
  let doc;try{doc=frame?.contentDocument;}catch{return;}
  if(!doc||doc===bound)return;
  bound=doc;count=0;gesture=null;pointers=new Set();
  const inTile=e=>{
   const r=doc.querySelector('#atlasAbsolute .atlas-piece[data-key="OH15"]')?.getBoundingClientRect();
   return !!r&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
  };
  doc.addEventListener('pointerdown',e=>{
   if(e.pointerType==='touch')pointers.add(e.pointerId);
   if(e.pointerType==='mouse'&&e.button!==0||pointers.size>1){gesture=null;count=0;return;}
   gesture=inTile(e)?{id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now()}:null;
  },true);
  doc.addEventListener('pointerup',e=>{
   if(e.pointerType==='touch')pointers.delete(e.pointerId);
   if(!gesture||gesture.id!==e.pointerId){gesture=null;return;}
   const valid=performance.now()-gesture.at<420&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)<12&&inTile(e)&&pointers.size===0;
   gesture=null;if(!valid){count=0;return;}
   const now=performance.now();count=now-at<650?count+1:1;at=now;
   if(count===3){count=0;open();}
  },true);
  doc.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);gesture=null;count=0;},true);
 }
 bind();frame?.addEventListener('load',bind);
 setInterval(bind,500);
}
function boot(){/* Shared OH-LABS-0001 owns all three-tap entry gestures.
 * The old tile-wide recognizer was not target- or same-spot-safe and is
 * intentionally disabled; direct API open() remains available. */}
// Events from the isolated overhead iframe must not pan/zoom or select
// controls on the main Unified Cockpit view.
window.addEventListener('message',e=>{
 if(embedded&&e.source===embedded.contentWindow&&e.data?.type==='b737:cockpit-overhead')e.stopImmediatePropagation();
},true);
window.B737AntiIceTestLabV2=Object.freeze({open,applyScenario,evaluate,scenarioIds:scenarioList.map(x=>x.id),getTile:()=>({...TILE}),isReady:()=>ready});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
