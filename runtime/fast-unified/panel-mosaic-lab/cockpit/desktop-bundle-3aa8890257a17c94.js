(async()=>{
;
/* ./eis-autobrake-physical-v1.js?v=AUTO-BRAKE-LABEL-TAPS-0008-TIGHT */
try{
/* EIS-AUTOBRAKE-0001 — B737 Classic AUTO BRAKE selector in EIS main panel.
 * This is a physical view adapter ONLY. Both EIS and Conventional command the
 * one B737AutobrakeUnified engine (FCOM 14.10/14.20; LAN ATA 32-40).
 * The approved EIS photograph/Owner18 guarded switches remain unmodified.
 * PIXEL-REGISTERED from the user's CURRENT live EIS screenshot (1920x1080):
 * open aperture white ring circle: center=(1120,568), radius=38 screen px;
 * existing OFF-detent rotary round base: center=(1136,556), radius=37 px.
 * The actual base, not its long pointer handle, must move LEFT 16px,
 * DOWN 12px. At 1.007 rendered px/source px, reference [102,893]
 * centers the base over the photo well. EIS diameter 94 source px
 * is now 105 source px: its base reaches just inside the photographed
 * white ring (about 2px border still visible at native screenshot zoom).
 * These are EIS-only adjustments. Conventional sprite, six detents,
 * switching law, 1500 ms RTO test, and backend remain untouched.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)api.install(root);
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const REF=Object.freeze({
  image:Object.freeze([918,1713]),
  center:Object.freeze([102,893]),
  diameter:105,
  source:'EIS_FO_INNER_SCREENSHOT_PIXEL_REGISTERED_20261105_V5'
 });
 const DETENTS=Object.freeze(['RTO','OFF','1','2','3','MAX']);
 const ANGLES=Object.freeze({RTO:-135,OFF:-90,'1':-45,'2':0,'3':45,MAX:90});
 // Center/width/height of the *printed lettering* relative to the
 // knob diameter (not a 45-degree polar placement of the knob).
 const PRINTED=Object.freeze({
  RTO:[-.70,.34,.32,.19],OFF:[-.83,0,.32,.19],
  '1':[-.59,-.51,.16,.19],'2':[0,-.75,.16,.19],
  '3':[.56,-.51,.16,.19],MAX:[.84,0,.38,.20]
 });
 function placement(rect){
  if(!rect||![rect.x,rect.y,rect.w,rect.h].every(Number.isFinite)||
    rect.w<=0||rect.h<=0)throw Error('EIS FO-inner placement is required');
  const sx=rect.w/REF.image[0],sy=rect.h/REF.image[1];
  return {x:rect.x+REF.center[0]*sx,y:rect.y+REF.center[1]*sy,
   w:REF.diameter*sx,h:REF.diameter*sy,source:REF.source};
 }
 function install(win){
  const doc=win.document;
  let knob=null,watcher=null,ready=false;
  const detentLabels=new Map();
  const shared=()=>win.B737AutobrakeUnified;
  const mode=()=>doc.documentElement?.dataset?.engineIndication||'EIS';
  const native=()=>doc.querySelector('#region-main .region-native');
  const fo=()=>native()?.querySelector('.texture-piece[data-piece="fo-inner"]');
  const selected=()=>shared()?.getState()?.selector||'OFF';
  function paint(){
   if(!knob)return;
   const detent=selected(),index=DETENTS.indexOf(detent);
   if(index<0)return;
   knob.dataset.detent=detent;
   knob.setAttribute('aria-valuenow',String(index));
   knob.setAttribute('aria-valuetext',detent);
   knob.setAttribute('aria-label','AUTO BRAKE EIS selector — '+detent);
   knob.title='AUTO BRAKE · '+detent+' · click/wheel/arrow keys';
   knob.querySelector('img').style.transform='rotate('+ANGLES[detent]+'deg)';
   for(const [value,button]of detentLabels)button.setAttribute('aria-pressed',String(value===detent));
  }
  function set(next,origin){
   if(!DETENTS.includes(next))throw Error('Invalid EIS AUTO BRAKE detent');
   const api=shared();
   if(!api?.setSelector)throw Error('Shared Unified autobrake ECU not available');
   const old=api.getState().selector;
   const out=api.setSelector(next);paint();
   if(old!==next)win.dispatchEvent(new win.CustomEvent('b737:autobrake-selector-changed',{
    detail:{selector:'AUTOBRAKE',detent:next,previous:old,
     detents:DETENTS.slice(),origin,source:'EIS-AUTOBRAKE-0001',visualControl:true}
   }));
   return out;
  }
  function step(delta,origin){
   const current=selected(),index=DETENTS.indexOf(current);
   return set(DETENTS[Math.max(0,Math.min(DETENTS.length-1,index+delta))],origin);
  }
  function make(){
   if(knob)return knob;
   knob=doc.createElement('button');knob.type='button';
   knob.className='b737-eis-autobrake-rotary';
   knob.dataset.control='autobrake-selector';
   knob.dataset.owner='EIS-AUTOBRAKE-0001';
   knob.setAttribute('role','slider');
   knob.setAttribute('aria-valuemin','0');
   knob.setAttribute('aria-valuemax','5');
   knob.setAttribute('aria-orientation','horizontal');
   const image=doc.createElement('img');
   image.alt='';image.draggable=false;
   image.src=new URL('../assets/locked/2026-10-23/Switches/Rotary/rotary-standard-v1.webp',
    doc.baseURI).href;
   knob.append(image);
   knob.addEventListener('click',e=>{
    if(mode()!=='EIS')return;
    e.preventDefault();e.stopPropagation();step(e.shiftKey?-1:1,'click');
   });
   knob.addEventListener('contextmenu',e=>{
    if(mode()!=='EIS')return;
    e.preventDefault();e.stopPropagation();step(-1,'right-click');
   });
   knob.addEventListener('wheel',e=>{
    if(mode()!=='EIS'||!e.deltaY)return;
    e.preventDefault();e.stopPropagation();
    step(e.deltaY<0?1:-1,'wheel');
   },{passive:false});
   knob.addEventListener('keydown',e=>{
    if(mode()!=='EIS')return;
    const key=e.key;
    if(key==='ArrowRight'||key==='ArrowUp'){e.preventDefault();step(1,'keyboard');}
    else if(key==='ArrowLeft'||key==='ArrowDown'){e.preventDefault();step(-1,'keyboard');}
    else if(key==='Home'){e.preventDefault();set('RTO','keyboard');}
    else if(key==='End'){e.preventDefault();set('MAX','keyboard');}
   });
   knob.addEventListener('pointerdown',()=>knob?.classList.add('pressed'));
   for(const type of ['pointerup','pointercancel','pointerleave','blur'])
    knob.addEventListener(type,()=>knob?.classList.remove('pressed'));
   paint();
   return knob;
  }
  function placeDetentLabels(host,target){
   const geometry=win.B737DetentHitGeometryV1;
   if(!geometry?.build)throw Error('B737DetentHitGeometryV1 must load before AUTOBRAKE');
   const boxes=geometry.build(DETENTS.map(value=>{
    const [dx,dy,tw,th]=PRINTED[value];
    return {id:value,cx:target.x+dx*target.w,cy:target.y+dy*target.h,
     w:tw*target.w,h:th*target.h};
   }),{paddingPx:5});
   // Exact text-centered invisible zones. Expansions are clamped against
   // neighboring detent labels by the common geometry owner.
   for(const box of boxes){
    const detent=box.id;
    let label=detentLabels.get(detent);
    if(!label){
     label=doc.createElement('button');label.type='button';
     label.className='b737-autobrake-detent-label';
     label.dataset.autobrakeLabel=detent;
     label.dataset.autobrakeInstallation='EIS';
     label.setAttribute('aria-label','AUTO BRAKE → '+detent);
     label.setAttribute('aria-pressed','false');
     label.title='AUTO BRAKE · '+detent+' (tap printed marking)';
     Object.assign(label.style,{position:'absolute',zIndex:'55',padding:'0',
      border:'0',margin:'0',borderRadius:'4px',background:'transparent',
      boxShadow:'none',touchAction:'manipulation',cursor:'pointer'});
     label.addEventListener('pointerdown',e=>e.stopPropagation());
     label.addEventListener('click',e=>{
      if(mode()!=='EIS')return;
      e.preventDefault();e.stopPropagation();set(detent,'printed-label-tap');
     });
     detentLabels.set(detent,label);
    }
    Object.assign(label.style,{
     left:box.x.toFixed(3)+'px',top:box.y.toFixed(3)+'px',
     width:box.w.toFixed(3)+'px',height:box.h.toFixed(3)+'px',
     transform:'none'
    });
    label.dataset.hitPaddingPx=box.paddingPx.toFixed(2);
    if(label.parentElement!==host)host.append(label);
    label.setAttribute('aria-pressed',String(selected()===detent));
   }
  }
  function update(){
   const host=native(),piece=fo();
   if(!host||!piece)return false;
   const n=piece.style;
   const rect={x:parseFloat(n.left),y:parseFloat(n.top),
    w:parseFloat(n.width),h:parseFloat(n.height)};
   let target;
   try{target=placement(rect);}catch(_){return false;}
   const control=make();
   Object.assign(control.style,{left:target.x.toFixed(3)+'px',
    top:target.y.toFixed(3)+'px',width:target.w.toFixed(3)+'px',
    height:target.h.toFixed(3)+'px'});
   if(control.parentElement!==host)host.append(control);
   placeDetentLabels(host,target);
   ready=true;paint();return true;
  }
  function stopWatcher(){if(watcher){watcher.disconnect();watcher=null;}}
  function watch(){
   if(watcher||mode()!=='EIS'||!win.MutationObserver)return;
   const node=doc.getElementById('scene')||doc.body;
   if(!node)return;
   watcher=new win.MutationObserver(()=>{if(update()||mode()!=='EIS')stopWatcher();});
   watcher.observe(node,{subtree:true,childList:true});
  }
  function schedule(){
   const callback=()=>{if(update())stopWatcher();else watch();};
   if(win.requestAnimationFrame)win.requestAnimationFrame(callback);else callback();
  }
  for(const type of ['b737:cockpit-mounted','b737:engine-indication-view','resize'])
   win.addEventListener(type,schedule);
  win.addEventListener('b737:autobrake-state',paint);
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
  const api=Object.freeze({update,getDetent:selected,setDetent:(d)=>set(d,'api'),
   step:(dir)=>step(dir,'api'),getGeometry:()=>({...REF}),
   getState:()=>({ready,visible:mode()==='EIS',detent:selected(),
    knob:knob?{left:knob.style.left,top:knob.style.top,width:knob.style.width,height:knob.style.height}:null})});
  win.B737EISAutobrakePhysicalV1=api;
  return api;
 }
 return Object.freeze({REF,DETENTS,ANGLES,placement,install});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/ch11/fmc-systems-network-v1.js?v=CDU-ELEC-DARK-0002 */
try{
/* B737 Classic Chapter 11 · conservative FMC/CDU power & avionics data bus.
 * Public engineering model. No proprietary FCOM diagrams, screen facsimiles,
 * breaker-to-bus claims or AFDS servo commands.
 * FCOM Sepehran Vol 2: 11.10, 11.31, 11.32.5–6, 11.40–43.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FmcSystemsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const UNIT_IDS=Object.freeze(['FMC1','FMC2','CDU_CAPT','CDU_FO']);
 const STATES=Object.freeze(['PRESENT','ABSENT','UNKNOWN']);
 const POWER_BUSES=Object.freeze(['generator1','generator2','transfer1','transfer2','main1','main2','acStandby','groundService','dc1','dc2','battery','hotBattery','switchedHotBattery','dcStandby']);
 // Hot Battery is live with BAT OFF and is NOT an FMC/CDU screen supply.
 // Ground Service supplies service loads, not an assumed CDU feeder.
 // Only all-dead switched/aircraft buses prove the absence of CDU power.
 const CANDIDATE_CDU_BUSES=Object.freeze(POWER_BUSES.filter(id=>!['hotBattery','groundService'].includes(id)));
 // Minimum authoritative Electrical V7 proof that NO normal switched aircraft
 // feeder can supply a CDU. Main1/main2 are upstream generator buses; if the
 // generators and both transfers are confirmed off, they cannot alone power
 // a display. Ignore HOT BATTERY and GROUND SERVICE (battery charger loads).
 // Some ECU diagnostics omit the upstream main1/main2 properties; that must
 // not turn an otherwise proven cold/dark cockpit into a bright CDU.
 const CDU_POWER_LOSS_EVIDENCE=Object.freeze([
  'generator1','generator2','transfer1','transfer2','acStandby',
  'dc1','dc2','battery','switchedHotBattery','dcStandby'
 ]);
 const BREAKERS=Object.freeze([
  {id:'P18-2:E8',label:'FMCS CMPTR NO.1',unit:'FMC1'},
  {id:'P18-2:E9',label:'CDU NO.1',unit:'CDU_CAPT'},
  {id:'P6-1:C12',label:'FMCS COMPTR NO.2',unit:'FMC2'},
  {id:'P6-1:C13',label:'CDU NO.2',unit:'CDU_FO'},
  {id:'P18-2:D1',label:'FMC AC',unit:null},
  {id:'P6-1:D8',label:'FMC AC',unit:null},
  {id:'P18-2:E7',label:'FMCS MODE ANN',unit:null},
  {id:'P18-2:C5',label:'DAA FMC NO.1',unit:null},
  {id:'P6-1:D13',label:'DAA FMC NO.2',unit:null},
  {id:'P18-1:D1',label:'AFDS MCP DC',unit:'MCP'},
  {id:'P6-2:B2',label:'AFDS MCP CRS 2',unit:'MCP'}
 ].map(x=>Object.freeze({...x,verification:'PHOTO_LABEL_CANDIDATE_ONLY',bus:'UNVERIFIED',activeTripEffect:false})));
 const clone=x=>JSON.parse(JSON.stringify(x));
 const invalid=x=>{throw Error(x);};
 function validateDisplayRoute(route,origin,dest){
  if(route?.source!=='PMDG_WORLD_2610_WITH_PROCEDURES_R1'||!Array.isArray(route.points)||
    route.points.length<2||route.points.length>251||route.points[0]?.name!==origin||route.points.at(-1)?.name!==dest)return null;
  const valid=route.points.every(p=>p&&/^[A-Z0-9]{2,8}$/.test(p.name)&&
   Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lon)&&Math.abs(p.lon)<=180);
  return valid?{source:route.source,points:route.points.map(p=>({name:p.name,lat:p.lat,lon:p.lon,
   leg:p.leg==='DISCONTINUITY'?'DISCONTINUITY':'ACTIVE'}))}:null;
 }
 function createState(){
  return {schema:'B737_FMC_SYSTEMS_V1',revision:0,profile:'EP-FSI_737_CLASSIC',power: Object.fromEntries(UNIT_IDS.map(x=>[x,{feed:'UNKNOWN',sinceMs:null,lastDurationMs:null}])),
   phase:'GROUND',route:{origin:'',dest:'',active:false,legsVerified:false,discontinuitiesUnknown:true},irs:{leftValid:null,rightValid:null},
   guidance:{lnavAuthorized:false,vnavAuthorized:false,forceDisengage:false,reason:'SOURCE_NOT_VERIFIED'},
   recovery:{reinitializePreflight:false,selectActiveWaypoint:false,showModRteLegs:false},history:[],
   fmcFailure:false,connection:'TRAINER_NO_ACTUATOR_AUTHORITY'};
 }
 function globalPower(snapshot){
  const buses=snapshot?.bus;
  if(!buses||typeof buses!=='object')return 'UNKNOWN';
  // A confirmed 0V on every switched AC/DC supply is conclusive. Do not
  // require unrelated hot-battery, charger or optional diagnostic bus fields.
  // Unknown (null/missing) on any essential feed is NOT absence evidence.
  const confirmedOff=CDU_POWER_LOSS_EVIDENCE.every(k=>buses[k]===false);
  // Explicit contradictory upstream power prevents a false blackout.
  if(confirmedOff&&buses.main1!==true&&buses.main2!==true)return 'ABSENT';
  // Nonzero upstream voltage does not verify this CDU's individual CB/feed.
  return 'UNKNOWN';
 }
 function apply(old,event){
  if(old?.schema!=='B737_FMC_SYSTEMS_V1'||!event||typeof event.type!=='string')invalid('INVALID_FMC_NETWORK_EVENT');
  const s=clone(old),now=event.nowMs;
  if(event.type==='FEED'){
   if(!UNIT_IDS.includes(event.unit)||!STATES.includes(event.evidence)||!Number.isFinite(now)||now<0)invalid('FEED_EVENT_INVALID');
   if(!['DIRECT_VERIFIED_EQUIPMENT_FEED','ALL_POWER_BUSES_PROVEN_ABSENT','UPSTREAM_POWER_RESTORED_FEED_UNKNOWN'].includes(event.provenance))invalid('FEED_PROVENANCE_REQUIRED');
   if(event.provenance==='UPSTREAM_POWER_RESTORED_FEED_UNKNOWN'&&event.evidence!=='UNKNOWN')invalid('RESTORATION_CANNOT_PROVE_FEED');
   if(event.provenance==='ALL_POWER_BUSES_PROVEN_ABSENT'&&event.evidence!=='ABSENT')invalid('GLOBAL_POWER_MAY_ONLY_PROVE_ABSENCE');
   const p=s.power[event.unit],previous=p.feed;
   if(previous!==event.evidence){
    if(event.evidence==='ABSENT')p.sinceMs=now;
    else if(previous==='ABSENT'&&p.sinceMs!==null){
     const duration=Math.max(0,now-p.sinceMs);
     p.lastDurationMs=duration;p.sinceMs=null;
     if(event.unit.startsWith('FMC')&&event.evidence==='PRESENT'){
      if(duration>=10000&&s.phase==='GROUND')s.recovery.reinitializePreflight=true;
      if(duration>10000&&s.phase==='FLIGHT'){
       s.recovery.selectActiveWaypoint=true;s.recovery.showModRteLegs=true;
      }
     }
    }else p.sinceMs=null;
    p.feed=event.evidence;
    if(event.unit.startsWith('FMC')&&event.evidence==='ABSENT'){
     s.guidance.lnavAuthorized=false;s.guidance.vnavAuthorized=false;
     s.guidance.forceDisengage=true;s.guidance.reason='FMC_POWER_INTERRUPTED';
    }
   }
  }else if(event.type==='PHASE'){
   if(!['GROUND','FLIGHT'].includes(event.phase))invalid('PHASE_INVALID');s.phase=event.phase;
  }else if(event.type==='IRS'){
   for(const k of ['leftValid','rightValid'])if(event[k]!==undefined){if(![true,false,null].includes(event[k]))invalid('IRS_EVIDENCE_INVALID');s.irs[k]=event[k]}
  }else if(event.type==='ROUTE'){
   if(!event.route||typeof event.route!=='object')invalid('ROUTE_EVIDENCE_MISSING');
   const r=event.route;
   for(const k of ['origin','dest'])if(r[k]!==undefined)s.route[k]=String(r[k]).toUpperCase().slice(0,4);
   if('displayRoute' in r)s.route.displayRoute=validateDisplayRoute(r.displayRoute,s.route.origin,s.route.dest);
   for(const k of ['active','legsVerified','discontinuitiesUnknown'])if(r[k]!==undefined){if(typeof r[k]!=='boolean')invalid('ROUTE_EVIDENCE_INVALID');s.route[k]=r[k]}
  }else if(event.type==='FMC_FAILURE'){
   if(typeof event.failed!=='boolean')invalid('FMC_FAILURE_INVALID');
   s.fmcFailure=event.failed;
   if(event.failed){s.guidance.forceDisengage=true;s.guidance.reason='FMC_FAILURE';}
  }else if(event.type==='ACK_RECOVERY'){
   s.recovery={reinitializePreflight:false,selectActiveWaypoint:false,showModRteLegs:false};
  }else invalid('EVENT_NOT_SUPPORTED');
  const i=s.irs.leftValid===true||s.irs.rightValid===true;
  const r=s.route;
  const ready=/^[A-Z]{4}$/.test(r.origin)&&/^[A-Z]{4}$/.test(r.dest)&&r.origin!==r.dest&&r.active&&r.legsVerified&&!r.discontinuitiesUnknown&&i&&!s.fmcFailure;
  const powered=UNIT_IDS.filter(k=>k.startsWith('FMC')).some(k=>s.power[k].feed==='PRESENT');
  const allOff=['FMC1','FMC2'].every(k=>s.power[k].feed==='ABSENT');
  if(!ready||!powered){s.guidance.lnavAuthorized=false;s.guidance.vnavAuthorized=false;s.guidance.reason=allOff?'NO_FMC_POWER':'NAV_ROUTE_OR_FEED_NOT_VERIFIED';}
  else {s.guidance.lnavAuthorized=true;s.guidance.vnavAuthorized=true;s.guidance.forceDisengage=false;s.guidance.reason='TRAINER_EVIDENCE_ONLY';}
  s.revision++;s.history.push({type:event.type,unit:event.unit||null,revision:s.revision});if(s.history.length>32)s.history.shift();
  return s;
 }
 function mcpEvidence(s){
  if(s.guidance.lnavAuthorized&&s.guidance.vnavAuthorized)return true;
  if(s.route.active===false||s.fmcFailure||['FMC1','FMC2'].every(k=>s.power[k].feed==='ABSENT'))return false;
  return null;
 }
 function screenGrid(rows){
  if(!Array.isArray(rows)||rows.length!==14)invalid('CDU_REQUIRES_EXACTLY_14_ROWS');
  return rows.map((row,i)=>{
   const val=String(row??'');if([...val].length>24)invalid('CDU_ROW_TOO_LONG_'+i);
   return val.padEnd(24,' ');
  });
 }
 return Object.freeze({validateDisplayRoute,UNIT_IDS,POWER_BUSES,BREAKERS,createState,apply,globalPower,mcpEvidence,screenGrid});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./fmc-systems-bridge-v1.js?v=CH11-ROUTE-PAGES-0001&amp;cb=CB-UNIFIED-0001 */
try{
/* Unified avionics evidence bridge for existing two-CDU trainer.
 * Data flows CDU -> FMC reference -> IRS validity -> MCP/AFDS evidence.
 * No A/T motor control, flight guidance, CB-to-bus fabrication or artwork edits.
 */
(function(){
 'use strict';
 const model=window.B737FmcSystemsV1;
 if(!model)throw Error('B737FmcSystemsV1 failed to load');
 let network=model.createState(),lastRouteSig='',lastMcpEvidence='INITIAL',lastPower='UNKNOWN';
 let electricalObserved=false; // no CDU bright screen before first real ECU supply evidence
 const feedEvidence=new Map();
 const seatState=new Map(),lastCduPower=new Map();let latestAfds=null;const now=()=>performance.now();
 const emit=forceSeat=>{
  for(const seat of ['CAPT','FO']){
   const frame=document.getElementById('cduFrame'+seat);
   const unit='CDU_'+seat;
   const feed=network.power[unit].feed,previous=lastCduPower.get(seat);
   if(electricalObserved&&frame?.contentWindow&&
    (forceSeat===seat||previous?.frame!==frame.contentWindow||previous?.feed!==feed)){
    frame.contentWindow.postMessage({type:'b737:fmc-cdu-power',seat,feed,reason:feed==='ABSENT'?'CONFIRMED_POWER_LOSS':'FEED_NOT_CONFIRMED'},location.origin);
    lastCduPower.set(seat,{frame:frame.contentWindow,feed});
   }
  }
  const out={revision:network.revision,power:network.power,
   route:network.route,irs:network.irs,guidance:network.guidance,
   recovery:network.recovery,breakerCandidates:model.BREAKERS,
   afds:latestAfds?{mcpPowered:latestAfds.power,atArmed:latestAfds.controls?.atArm===true,
    autothrottleMode:latestAfds.modes?.thrust||null,lateralMode:latestAfds.modes?.lateral||null,
    verticalMode:latestAfds.modes?.vertical||null,source:'MCP_AFDS_BRIDGE_READ_ONLY'}:null};
  window.dispatchEvent(new CustomEvent('b737:fmc-systems-state',{detail:out}));
  let el=document.getElementById('fmcNetworkStatus');
  if(!el){
   const panel=document.querySelector('.cdu-tools');
   if(panel){el=document.createElement('p');el.id='fmcNetworkStatus';el.setAttribute('role','status');el.style.fontSize='12px';panel.append(el);}
  }
  if(el){
   const ready=model.mcpEvidence(network);
   el.textContent='FMC/CDU · electrical feeder: '+(lastPower==='ABSENT'?'GLOBAL POWER LOST':'UNVERIFIED')+
    ' · IRS: '+(network.irs.leftValid===true?'L VALID':'L UNKNOWN')+'/'+(network.irs.rightValid===true?'R VALID':'R UNKNOWN')+
    ' · LNAV/VNAV evidence: '+(ready===true?'VERIFIED':ready===false?'NOT READY':'UNVERIFIED')+
    ' · FMC1 '+network.power.FMC1.feed+' / FMC2 '+network.power.FMC2.feed+
    ' · A/T '+(latestAfds?.controls?.atArm?'ARM':'OFF/UNKNOWN')+
    (network.recovery.reinitializePreflight?' · RECOVERY: RE-ENTER PREFLIGHT':'')+
    (network.recovery.selectActiveWaypoint?' · RECOVERY: SELECT ACTIVE WPT/LEG':'')+
    ' · CB: PHOTO INDEX ONLY';
  }
 };
 const transition=event=>{network=model.apply(network,event);emit();return network};
 function transmitToMCP(){
  const evidence=model.mcpEvidence(network);
  if(evidence===lastMcpEvidence)return;
  lastMcpEvidence=evidence;
  window.B737McpAFDSBridgeV1?.setEvidence?.('fmcRouteReady',evidence);
 }
 function updateIRS(){
  const units=window.B737IRSTrainerUnified?.getState?.()?.units;
  if(!units)return;
  const left=units.L?.positionValid===true?true:units.L?.positionValid===false?false:null;
  const right=units.R?.positionValid===true?true:units.R?.positionValid===false?false:null;
  if(left!==network.irs.leftValid||right!==network.irs.rightValid){
   transition({type:'IRS',leftValid:left,rightValid:right});transmitToMCP();
  }
 }
 function receive(e){
  if(e.origin!==location.origin)return;
  if(e.data?.type==='b737:fmc-cdu-power-ready'){
   const seat=e.data.seat,frame=document.getElementById('cduFrame'+seat);
   if(['CAPT','FO'].includes(seat)&&frame?.contentWindow===e.source)emit(seat);
   return;
  }
  if(e.data?.type!=='b737:fmc-cdu-snapshot')return;
  const d=e.data,frame=document.getElementById('cduFrame'+d.seat);
  if(!['CAPT','FO'].includes(d.seat)||!frame||e.source!==frame.contentWindow)return;
  seatState.set(d.seat,d);
  const a=d.active||{},origin=String(a.ORIGIN||''),dest=String(a.DEST||'');
  const airportsValid=/^[A-Z]{4}$/.test(origin)&&/^[A-Z]{4}$/.test(dest)&&origin!==dest;
  const legacyActive=!d.routeTransactionPending||network.route.active&&
   network.route.origin===origin&&network.route.dest===dest;
  const activated=airportsValid&&(typeof d.routeActivated==='boolean'?d.routeActivated:legacyActive);
  const displayRoute=activated?model.validateDisplayRoute(d.displayRoute,origin,dest):null;
  const next={origin,dest,active:activated,displayRoute,legsVerified:false,discontinuitiesUnknown:true};
  const signature=JSON.stringify(next);
  if(signature!==lastRouteSig){
   lastRouteSig=signature;transition({type:'ROUTE',route:next});transmitToMCP();
  }
  updateIRS();
 }
 function refreshGlobalElectrical(){
  // Ask the ONE live Electrical V7 owner, not a cached CDU or trainer screen.
  // The bridge snapshot is fallback only (e.g. an older isolated benchmark).
  const owner=window.B737ISNCockpitV1;
  const electrical=window.B737ElectricalV7;
  let snap=null;
  try{
   const source=owner?.getElectricalState?.();
   if(source?.schema==='b737-electrical/7'&&electrical?.evaluate)
    snap=electrical.evaluate(source);
  }catch(error){console.warn('FMC electrical ECU snapshot:',error);}
  if(snap?.schema!=='B737_ELECTRICAL_V7_RESULT')
   snap=owner?.getState?.()?.state?.electrical;
  if(snap?.schema!=='B737_ELECTRICAL_V7_RESULT')return;
  const evaluated=model.globalPower(snap);
  const first=!electricalObserved;
  electricalObserved=true;
  const cbSignature=JSON.stringify(model.UNIT_IDS.map(unit=>window.B737UnifiedCB?.available('fmc.'+unit)));
  if(evaluated===lastPower&&refreshGlobalElectrical.cbSignature===cbSignature){
   if(first)emit(); // resolved power evidence must reach newly loaded CDU
   return;
  }
  lastPower=evaluated;refreshGlobalElectrical.cbSignature=cbSignature;
  // A powered hot-battery/charger alone is NOT evidence of CDU supply.
  // Restoration of main buses is still UNKNOWN until its own feeder is verified.
  for(const unit of model.UNIT_IDS){
   const cbOpen=window.B737UnifiedCB?.available('fmc.'+unit)===false;
   const target=cbOpen||evaluated==='ABSENT'?'ABSENT':feedEvidence.get(unit)||'UNKNOWN';
   if(network.power[unit].feed!==target)
    network=model.apply(network,{type:'FEED',unit,evidence:target,nowMs:now(),
     provenance:target==='ABSENT'?'ALL_POWER_BUSES_PROVEN_ABSENT':'UPSTREAM_POWER_RESTORED_FEED_UNKNOWN'});
  }
  emit();
  transmitToMCP();
 }
 function setVerifiedFeed(unit,evidence){
  if(!model.UNIT_IDS.includes(unit)||!['PRESENT','ABSENT','UNKNOWN'].includes(evidence))throw Error('DIRECT_FEED_EVIDENCE_INVALID');
  feedEvidence.set(unit,evidence);
  transition({type:'FEED',unit,evidence:window.B737UnifiedCB?.available('fmc.'+unit)===false?'ABSENT':evidence,nowMs:now(),provenance:'DIRECT_VERIFIED_EQUIPMENT_FEED'});
  transmitToMCP();
 }
 window.addEventListener('b737:cb-state-change',refreshGlobalElectrical);
 window.addEventListener('message',receive);
 window.addEventListener('b737:cockpit-mounted',()=>{emit();refreshGlobalElectrical()});
 window.addEventListener('b737:isn-start-indications',refreshGlobalElectrical);
 // Source changes, BAT switch transitions and GPU/APU generator selection
 // must reach the embedded CDU even if no engine-start indication changes.
 for(const type of ['b737:electrical-network','b737:electrical-v7-state',
  'b737:unified-ecu-observation','b737:electrical-owner-ready',
  'b737:battery-live','b737:cockpit-overhead'])
  window.addEventListener(type,refreshGlobalElectrical);
 window.addEventListener('b737:mcp-afds-state',e=>{latestAfds=e.detail||null;emit()}); // A/T ARM/modes are observed, never commanded
 window.addEventListener('b737:irs-trainer-state',updateIRS);
 document.addEventListener('DOMContentLoaded',()=>{emit();refreshGlobalElectrical();updateIRS()});
 if(document.readyState!=='loading'){emit();refreshGlobalElectrical();updateIRS();}
 window.B737FmcSystemsBridgeV1=Object.freeze({
  getState:()=>JSON.parse(JSON.stringify(network)),
  getPowerAudit:()=>({observed:electricalObserved,globalPower:lastPower,
   feeds:Object.fromEntries(model.UNIT_IDS.map(id=>[id,network.power[id].feed]))}),
  getCBPhotoCandidates:()=>model.BREAKERS.map(x=>({...x})),
  refresh:()=>{refreshGlobalElectrical();updateIRS();return network},
  setVerifiedFeed,confirmRouteLegs(verified,discontinuitiesUnknown){
   if(typeof verified!=='boolean'||typeof discontinuitiesUnknown!=='boolean')throw Error('ROUTE_LEG_AUDIT_REQUIRED');
   const r={...network.route,legsVerified:verified,discontinuitiesUnknown};
   transition({type:'ROUTE',route:r});transmitToMCP();
  },
  setPhase:phase=>transition({type:'PHASE',phase}),
  setFailure:failed=>{const value=transition({type:'FMC_FAILURE',failed:!!failed});transmitToMCP();return value},
  acknowledgeRecovery:()=>transition({type:'ACK_RECOVERY'})
 });
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/runtime/avionics-data-network-v1.js?v=AVIONICS-NET-0001 */
try{
/* Unified B737 Classic avionics data network v1 — independent source ownership.
 * Signal exchange / evidence only. Not certified ARINC wiring; never commands actuators.
 * One producer per topic, many read-only consumers, monotonic revisions, TTL and trace.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737AvionicsDataNetworkV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const CATALOG=Object.freeze({
  'electrical.buses':{owner:'ELECTRICAL',ttl:1500},
  'electrical.fmcFeeds':{owner:'FMC_FEEDS',ttl:1500},
  'irs.left':{owner:'IRS',ttl:2000},'irs.right':{owner:'IRS',ttl:2000},
  'airdata.adc1':{owner:'ADC',ttl:2000},'airdata.adc2':{owner:'ADC',ttl:2000},
  'navigation.gps1':{owner:'GPS',ttl:3000},'navigation.gps2':{owner:'GPS',ttl:3000},
  'navigation.vor1':{owner:'VHF_NAV',ttl:4000},'navigation.vor2':{owner:'VHF_NAV',ttl:4000},
  'navigation.adf1':{owner:'ADF',ttl:4000},'navigation.adf2':{owner:'ADF',ttl:4000},
  'navigation.dme1':{owner:'DME',ttl:4000},'navigation.dme2':{owner:'DME',ttl:4000},
  'fuel.quantity':{owner:'FUEL',ttl:3000},'fuel.pumps':{owner:'FUEL',ttl:2000},
  'flightcontext.state':{owner:'FLIGHT_CONTEXT',ttl:2000},
  'apu.state':{owner:'APU',ttl:2000},
  'hydraulics.state':{owner:'HYDRAULICS',ttl:3000},
  'propulsion.engine1':{owner:'ENGINE',ttl:2000},'propulsion.engine2':{owner:'ENGINE',ttl:2000},
  'pneumatics.state':{owner:'PNEUMATICS',ttl:3000},
  'antiice.state':{owner:'ANTIICE',ttl:3000},
  'aircraft.airground':{owner:'AIRGROUND',ttl:2000},
  'environment.tat':{owner:'TAT',ttl:3000},
  'clock.utc':{owner:'CLOCK',ttl:2500},
  'crew.flightplan':{owner:'CDU',ttl:60000},
  'aircraft.profile':{owner:'PROFILE',ttl:60000},
  'mcp.state':{owner:'MCP',ttl:2000},
  'afds.state':{owner:'AFDS',ttl:2000},
  'autothrottle.state':{owner:'AUTOTHROTTLE',ttl:2000},
  'navigation.database':{owner:'NAVDB',ttl:86400000},
  'performance.database':{owner:'PERFDB',ttl:86400000},
  'navigation.ils1':{owner:'ILS',ttl:2000},'navigation.ils2':{owner:'ILS',ttl:2000},
  'airdata.radioAltitude1':{owner:'RADIO_ALTIMETER',ttl:2000},'airdata.radioAltitude2':{owner:'RADIO_ALTIMETER',ttl:2000},
  'afds.director1':{owner:'FCC',ttl:1500},'afds.director2':{owner:'FCC',ttl:1500},
  'datalink.acars':{owner:'ACARS',ttl:60000},
  'cb.observations':{owner:'CB',ttl:3000},
  'fmc.computed':{owner:'FMC',ttl:2000}
 });
 const QUALITIES=Object.freeze(['VALID','UNKNOWN','INVALID']);
 const ORIGINS=Object.freeze(['LIVE_SYSTEM','SIMULATOR_TELEMETRY','TRAINING_SCENARIO','CREW_ENTRY','REFERENCE_DATABASE','UNVERIFIED']);
 const copy=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
 const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const number=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
 function validate(topic,value){
  if(!isObject(value))throw Error('SIGNAL_PAYLOAD_MUST_BE_OBJECT_'+topic);
  const n=(key,lo,hi)=>{if(value[key]!==undefined&&value[key]!==null&&!number(value[key],lo,hi))throw Error('SIGNAL_RANGE_'+topic+'.'+key)};
  if(/^airdata\.adc/.test(topic)){n('pressureAltitudeFt',-2000,70000);n('casKt',0,600);n('tasKt',0,850);n('mach',0,1.5);n('tatC',-100,100);n('satC',-100,80);}
  if(/^navigation\.gps|^irs\./.test(topic)){n('lat',-90,90);n('lon',-180,180);n('gsKt',0,850);n('trackDeg',0,360);}
  if(/^navigation\.ils/.test(topic)){n('localizerDots',-10,10);n('glideslopeDots',-10,10);n('tunedFrequencyMHz',108.1,111.95);}
  if(/^airdata\.radioAltitude/.test(topic))n('heightFt',-20,5000);
  if(/^afds\.director/.test(topic)){n('pitchDeg',-90,90);n('rollDeg',-180,180);}
  if(/^navigation\.dme/.test(topic))n('distanceNm',0,500);
  if(/^navigation\.(vor|adf)/.test(topic))n('bearingDeg',0,360);
  if(/^navigation\.adf/.test(topic)&&value.bearingReference!==undefined&&
     !['TRUE','MAGNETIC','RELATIVE'].includes(value.bearingReference))throw Error('SIGNAL_ADF_REFERENCE_'+topic);
  if(topic==='fuel.quantity'){n('totalKg',0,50000);n('totalLb',0,110000);}
  if(/^propulsion\.engine/.test(topic)){n('n1Percent',0,125);n('n2Percent',0,125);n('egtC',-100,1200);n('fuelFlowKgHr',0,10000);}
  if(topic==='environment.tat')n('tatC',-100,100);
 }
 function createNetwork({now=()=>Date.now(),onError=null}={}){
  const state=new Map(),owners=new Set(),listeners=new Map(),trace=[],errors=[];
  let revision=0;
  function error(item){errors.push(item);if(errors.length>32)errors.shift();if(typeof onError==='function')onError(item);}
  function read(topic){
   if(!Object.hasOwn(CATALOG,topic))throw Error('UNKNOWN_TOPIC_'+topic);
   const stored=state.get(topic);
   if(!stored)return {topic,owner:CATALOG[topic].owner,quality:'UNKNOWN',origin:'UNVERIFIED',value:null,revision:0,receivedAtMs:null,reason:'NO_SOURCE_CONNECTED'};
   const next=copy(stored),ttl=CATALOG[topic].ttl;delete next.fingerprint;
   if(next.quality==='VALID'&&now()-next.receivedAtMs>ttl){next.quality='STALE';next.reason='TIME_TO_LIVE_EXCEEDED';}
   return next;
  }
  function producer(owner){
   if(!/^[A-Z][A-Z_0-9]{1,32}$/.test(owner))throw Error('INVALID_OWNER');
   if(owners.has(owner))throw Error('DUPLICATE_OWNER_'+owner);
   const topics=Object.keys(CATALOG).filter(k=>CATALOG[k].owner===owner);
   if(!topics.length)throw Error('UNREGISTERED_OWNER_'+owner);
   owners.add(owner);
   return Object.freeze({owner,topics:[...topics],publish(topic,value,{quality='VALID',origin='LIVE_SYSTEM',reason=null}={}){
    if(!topics.includes(topic))throw Error('TOPIC_NOT_OWNED_'+owner+':'+topic);
    if(!QUALITIES.includes(quality)||!ORIGINS.includes(origin))throw Error('INVALID_SIGNAL_METADATA');
    if(quality==='VALID'&&origin==='UNVERIFIED')throw Error('UNVERIFIED_CANNOT_BE_VALID');
    if(quality==='VALID')validate(topic,value);
    else if(value!==null&&value!==undefined)validate(topic,value);
    const old=state.get(topic),payload=quality==='VALID'?copy(value):copy(value??null);
    const fingerprint=JSON.stringify([quality,origin,payload,reason]);
    const stamp=now();
    if(!Number.isFinite(stamp)||stamp<0)throw Error('INVALID_CLOCK');
    if(old&&old.fingerprint===fingerprint){
     old.receivedAtMs=stamp;
     return read(topic);
    }
    revision++;
    const next={topic,owner,quality,origin,value:payload,revision,receivedAtMs:stamp,reason,fingerprint};
    state.set(topic,next);
    const record=read(topic);delete record.fingerprint;
    trace.push({topic,owner,quality,revision,receivedAtMs:stamp});
    if(trace.length>256)trace.shift();
    for(const key of [topic,'*'])for(const listener of [...(listeners.get(key)||[])])try{listener(copy(record));}catch(e){error({topic,consumerError:String(e?.message||e),revision});}
    return record;
   }});
  }
  function subscribe(topic,fn,{replay=true}={}){
   if(topic!=='*'&&!Object.hasOwn(CATALOG,topic))throw Error('UNKNOWN_TOPIC_'+topic);
   if(typeof fn!=='function')throw Error('SUBSCRIBER_REQUIRED');
   if(!listeners.has(topic))listeners.set(topic,new Set());
   listeners.get(topic).add(fn);
   if(replay){const snapshot=topic==='*'?Object.keys(CATALOG).map(read):[read(topic)];
    for(const item of snapshot)try{fn(copy(item));}catch(e){error({topic,consumerError:String(e?.message||e),revision});}}
   return ()=>listeners.get(topic)?.delete(fn);
  }
  function snapshot(){return Object.fromEntries(Object.keys(CATALOG).map(topic=>[topic,read(topic)]));}
  function audit(){const signals=Object.values(snapshot());return {schema:'B737_AVIONICS_NETWORK_V1',revision,totalTopics:signals.length,valid:signals.filter(x=>x.quality==='VALID').length,stale:signals.filter(x=>x.quality==='STALE').length,unavailable:signals.filter(x=>x.quality==='UNKNOWN').map(x=>x.topic),invalid:signals.filter(x=>x.quality==='INVALID').map(x=>x.topic),owners:[...owners],errors:copy(errors),trace:copy(trace)};}
  return Object.freeze({producer,read,subscribe,snapshot,audit,topics:()=>Object.keys(CATALOG),getRevision:()=>revision});
 }
 return Object.freeze({CATALOG,QUALITIES,ORIGINS,createNetwork});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/integration/avionics-fmc-computer-v1.js?v=CH11-ROUTE-PAGES-0001 */
try{
/* FMC consumer/projection for the independent avionics topic network.
 * FCOM 11.20/11.30–32 evidence model. Does NOT move aircraft or fabricate radio fixes.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737AvionicsFmcComputerV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const INPUTS=Object.freeze(['electrical.buses','electrical.fmcFeeds','irs.left','irs.right','airdata.adc1','airdata.adc2',
  'navigation.gps1','navigation.gps2','navigation.vor1','navigation.vor2','navigation.dme1','navigation.dme2',
  'fuel.quantity','fuel.pumps','flightcontext.state','apu.state','hydraulics.state',
  'propulsion.engine1','propulsion.engine2','pneumatics.state','antiice.state',
  'aircraft.airground','environment.tat','clock.utc','crew.flightplan','aircraft.profile',
  'mcp.state','afds.state','autothrottle.state','navigation.database','performance.database','datalink.acars','cb.observations']);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const valid=x=>x?.quality==='VALID';
 const coord=v=>v&&Number.isFinite(v.lat)&&v.lat>=-90&&v.lat<=90&&Number.isFinite(v.lon)&&v.lon>=-180&&v.lon<=180;
 function project(network){
  const read=t=>network.read(t),inputs=Object.fromEntries(INPUTS.map(t=>[t,read(t)]));
  const issues=[],data={};
  const pick=(arr)=>{
   const found=arr.map(t=>inputs[t]).find(x=>valid(x));
   return found||null;
  };
  const gps=['navigation.gps1','navigation.gps2'].map(t=>inputs[t]).find(x=>valid(x)&&coord(x.value)&&x.value.fixValid===true)||null;
  const irs=['irs.left','irs.right'].map(t=>inputs[t]).find(x=>valid(x)&&coord(x.value)&&x.value.positionValid===true)||null;
  const adc=pick(['airdata.adc1','airdata.adc2']);
  const fuel=inputs['fuel.quantity'],plan=inputs['crew.flightplan'],feeds=inputs['electrical.fmcFeeds'];
  const radioCandidates=['navigation.dme1','navigation.dme2','navigation.vor1','navigation.vor2'].filter(t=>valid(inputs[t]));
  const gpsFix=gps&&coord(gps.value)&&gps.value.fixValid===true;
  const irsFix=irs&&coord(irs.value)&&irs.value.positionValid===true;
  const fix=gpsFix?gps:irsFix?irs:null;
  data.position=fix?{latitudeDeg:fix.value.lat,longitudeDeg:fix.value.lon,source:fix.topic,
    origin:fix.origin,quality:'VALID',method:gpsFix?'GPS_UPDATE':'IRS_REFERENCE'}:
    {latitudeDeg:null,longitudeDeg:null,source:null,quality:'UNKNOWN',method:'NO_VALID_POSITION'};
  data.radioUpdate={availableCandidates:radioCandidates,fixComputed:false,
    reason:'RADIO_FIX_REQUIRES_VALIDATED_NAVAID_GEOMETRY_AND_TUNING'};
  if(!fix)issues.push('POSITION_SOURCE_MISSING');
  data.airData=adc?{source:adc.topic,pressureAltitudeFt:adc.value.pressureAltitudeFt??null,
    casKt:adc.value.casKt??null,tasKt:adc.value.tasKt??null,mach:adc.value.mach??null,
    satC:adc.value.satC??null,origin:adc.origin,quality:'VALID'}:
    {source:null,quality:'UNKNOWN'};
  if(!adc)issues.push('ADC_SIGNAL_MISSING');
  data.trainingFlightContext=valid(inputs['flightcontext.state'])?{
   pressureAltitudeFt:inputs['flightcontext.state'].value.pressureAltitudeFt??null,
   iasKt:inputs['flightcontext.state'].value.iasKt??null,
   oatC:inputs['flightcontext.state'].value.oatC??null,
   origin:inputs['flightcontext.state'].origin,
   note:'TRAINING_REFERENCE_NOT_AN_ADC_INPUT'}:{quality:'UNKNOWN'};

  data.fuel=valid(fuel)?{totalKg:fuel.value.totalKg??null,totalLb:fuel.value.totalLb??null,
    source:fuel.topic,origin:fuel.origin,quality:'VALID'}: {totalKg:null,totalLb:null,source:null,quality:'UNKNOWN'};
  if(!valid(fuel))issues.push('FUEL_SUMMATION_MISSING');
  const fmcFeed=valid(feeds)?feeds.value:null;
  const primary=fmcFeed?.FMC1?.feed??'UNKNOWN',secondary=fmcFeed?.FMC2?.feed??'UNKNOWN';
  data.fmcFeeds={FMC1:primary,FMC2:secondary,provenance:feeds?.origin||'UNVERIFIED'};
  const provenPower=[primary,secondary].includes('PRESENT');
  const operational=fmcFeed?.failed!==true&&(provenPower||fmcFeed?.trainingEfisSupply===true||
   (fmcFeed?.modeledSupply===true&&[primary,secondary].includes('UNKNOWN')));
  const powerReady=provenPower&&fmcFeed?.failed!==true;
  if(!powerReady)issues.push('FMC_EQUIPMENT_FEED_NOT_PROVEN_PRESENT');
  const route=valid(plan)?plan.value:{};
  const active=route?.active===true&&/^[A-Z]{4}$/.test(route.origin||'')&&
   /^[A-Z]{4}$/.test(route.dest||'')&&route.origin!==route.dest;
  data.route={origin:route?.origin||'',dest:route?.dest||'',active,legsVerified:route?.legsVerified===true,
   displayRoute:operational&&active?route?.displayRoute??null:null,
   discontinuitiesUnknown:route?.discontinuitiesUnknown!==false,source:valid(plan)?plan.origin:'UNVERIFIED'};
  if(!active||!data.route.legsVerified||data.route.discontinuitiesUnknown)issues.push('ROUTE_LEGS_NOT_AUDITED');
  const velocity=operational&&fix&&Number.isFinite(fix.value.trackDeg)&&Number.isFinite(fix.value.gsKt)?fix.value:null;
  const motion=velocity?{trueTrackDeg:velocity.trackDeg,gsKt:velocity.gsKt,
   windFromDeg:velocity.windFromDeg??null,windKt:velocity.windKt??null,source:fix.topic}:null;
  const mcp=inputs['mcp.state'];data.mcp=valid(mcp)?{altitudeFt:mcp.value.altitudeFt??null,
    selectedSpeedKt:mcp.value.selectedSpeedKt??null,source:mcp.origin}:{quality:'UNKNOWN'};
  data.autoflight={mcp:valid(mcp),afds:valid(inputs['afds.state']),
   autothrottle:valid(inputs['autothrottle.state']),commandsIssued:false};
  if(!valid(inputs['navigation.database']))issues.push('NAV_DATABASE_SOURCE_NOT_VERIFIED');
  if(!valid(inputs['performance.database']))issues.push('PERFORMANCE_DATABASE_SOURCE_NOT_VERIFIED');
  data.predictions={fuelAtDestinationKg:null,topOfDescentNm:null,optimumAltitudeFt:null,
   n1TargetPercent:null,quality:'UNKNOWN',reason:'NO_VALIDATED_PERFORMANCE_AND_FLIGHT_MODEL'};
  const ready=powerReady&&!!fix&&active&&data.route.legsVerified&&!data.route.discontinuitiesUnknown;
  const live=typeof globalThis==='object'?globalThis.B737UnifiedFccFlightV1?.getFmcGuidance?.():null;
  const training=operational&&!!fix&&active&&live?.fmcTrackValid===true&&Number.isFinite(live.observedAtMs)&&Date.now()-live.observedAtMs<2000;
  const navActive=training?{ident:live.activeIdent,index:live.activeIndex,distanceNm:live.distanceNm,courseTrueDeg:live.courseTrueDeg,bearingTrueDeg:live.bearingTrueDeg,crossTrackNm:live.crossTrackNm,position:live.position}:null;
  const vertical=training&&live.fmcVerticalValid===true&&mcp?.value?.verticalMode==='VNAV';
  data.guidance={routeEvidenceReady:ready||training,canCommandAircraft:false,authority:training?'SIMULATOR_FCC_ONLY':'ADVISORY_ONLY',simulatorCoupled:training,
   activeLeg:navActive,lnavActive:training&&mcp?.value?.lateralMode==='LNAV',vnavActive:vertical,descent:vertical&&live.vertical?.phase==='DESCENT',commandCasKt:vertical?live.targetKt:null,vnavMode:vertical?live.vnavMode:null,
   reason:training?'EXECUTED_TRAINING_GUIDANCE':ready?'INPUT_EVIDENCE_READY_NO_ACTUATOR_AUTHORITY':'SOURCE_OR_ROUTE_NOT_VERIFIED'};
  return {schema:'B737_FMC_COMPUTED_V1',inputs:INPUTS.length,position:data.position,motion,operational,failed:fmcFeed?.failed===true,
   radioUpdate:data.radioUpdate,airData:data.airData,trainingFlightContext:data.trainingFlightContext,fuel:data.fuel,fmcFeeds:data.fmcFeeds,
   route:data.route,mcp:data.mcp,autoflight:data.autoflight,predictions:data.predictions,
   guidance:data.guidance,issues,sourceQuality:Object.fromEntries(INPUTS.map(t=>[t,inputs[t].quality]))};
 }
 function connect(network){
  if(!network?.producer||!network?.read||!network?.subscribe)throw Error('AVIONICS_NETWORK_REQUIRED');
  const out=network.producer('FMC');let previous='',updating=false;
  function refresh(){
   if(updating)return null;
   updating=true;
   try{const value=project(network),fingerprint=JSON.stringify(value);
    if(previous!==fingerprint||network.read('fmc.computed').quality!=='VALID'){previous=fingerprint;out.publish('fmc.computed',value,{origin:'TRAINING_SCENARIO'});}
    return value;
   }finally{updating=false;}
  }
  const unsub=network.subscribe('*',msg=>{if(msg.topic!=='fmc.computed')refresh();},{replay:false});
  refresh();
  return Object.freeze({refresh,getState:()=>copy(project(network)),disconnect:unsub});
 }
 return Object.freeze({INPUTS,project,connect});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/integration/avionics-sensor-ingress-v2.js?v=AVIONICS-SENSORS-0002 */
try{
/* B737 Classic independent ADC/GPS/VOR/DME simulator ingress, stage 2.
 * Explicitly opt-in for a named LOCAL simulator adapter; never assumes GPS
 * installation, never derives sensor values from cockpit gauges or route maps.
 * Commands: NONE.  All signals remain TRAINING/TELEMETRY, not certified flight.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737AvionicsSensorIngressV2=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const KINDS=Object.freeze(['adc1','adc2','gps1','gps2','vor1','vor2','dme1','dme2']);
 const OWNER=Object.freeze({adc:'ADC',gps:'GPS',vor:'VHF_NAV',dme:'DME'});
 const TOPIC=Object.freeze(Object.fromEntries(KINDS.map(k=>[k,k.startsWith('adc')?'airdata.'+k:'navigation.'+k])));
 const copy=v=>JSON.parse(JSON.stringify(v));
 const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 function field(value,k,lo,hi,required=false){
  const v=value[k];
  if(v==null){if(required)throw Error('MISSING_'+k.toUpperCase());return null;}
  if(!finite(v,lo,hi))throw Error('INVALID_'+k.toUpperCase());
  return v;
 }
 function parse(kind,data){
  if(!obj(data)||typeof data.valid!=='boolean')throw Error('SENSOR_VALIDITY_REQUIRED_'+kind);
  if(data.valid===false){
   if(Object.keys(data).some(k=>k!=='valid'&&k!=='failureCode'))throw Error('INVALID_SENSOR_MUST_NOT_CARRY_MEASUREMENTS');
   return {quality:'INVALID',value:null,reason:String(data.failureCode||'SENSOR_REPORTED_INVALID').slice(0,80)};
  }
  if(kind.startsWith('adc')){
   const pressureAltitudeFt=field(data,'pressureAltitudeFt',-2000,70000);
   const casKt=field(data,'casKt',0,600),tasKt=field(data,'tasKt',0,850);
   const mach=field(data,'mach',0,1.5),tatC=field(data,'tatC',-100,100),satC=field(data,'satC',-100,80);
   if([pressureAltitudeFt,casKt,tasKt,mach].every(x=>x===null))throw Error('ADC_REQUIRES_AT_LEAST_ONE_AIR_DATA_MEASUREMENT');
   return {quality:'VALID',value:{sensorValid:true,pressureAltitudeFt,casKt,tasKt,mach,tatC,satC,
    source:'SIMULATOR_ADC_CHANNEL_'+kind.slice(-1)}};
  }
  if(kind.startsWith('gps')){
   if(data.fixValid!==true)throw Error('GPS_VALID_SIGNAL_REQUIRES_FIX');
   const lat=field(data,'lat',-90,90,true),lon=field(data,'lon',-180,180,true);
   return {quality:'VALID',value:{fixValid:true,lat,lon,gsKt:field(data,'gsKt',0,850),
    trackDeg:field(data,'trackDeg',0,360),source:'SIMULATOR_GPS_CHANNEL_'+kind.slice(-1)}};
  }
  if(kind.startsWith('vor')){
   const stationIdent=String(data.stationIdent||'').toUpperCase();
   if(!/^[A-Z0-9]{2,5}$/.test(stationIdent))throw Error('VOR_STATION_IDENT_REQUIRED');
   const bearingReference=data.bearingReference;
   if(bearingReference!==undefined&&!['TRUE','MAGNETIC','RELATIVE'].includes(bearingReference))
    throw Error('VOR_BEARING_REFERENCE_INVALID');
   return {quality:'VALID',value:{stationIdent,bearingDeg:field(data,'bearingDeg',0,360,true),
    ...(bearingReference===undefined?{}:{bearingReference}),
    stationLat:field(data,'stationLat',-90,90),stationLon:field(data,'stationLon',-180,180),
    tunedFrequencyMHz:field(data,'tunedFrequencyMHz',108,117.95),
    source:'SIMULATOR_VOR_CHANNEL_'+kind.slice(-1)}};
  }
  if(kind.startsWith('dme')){
   const stationIdent=String(data.stationIdent||'').toUpperCase();
   if(!/^[A-Z0-9]{2,5}$/.test(stationIdent))throw Error('DME_STATION_IDENT_REQUIRED');
   return {quality:'VALID',value:{stationIdent,distanceNm:field(data,'distanceNm',0,500,true),
    stationLat:field(data,'stationLat',-90,90),stationLon:field(data,'stationLon',-180,180),
    tunedFrequencyMHz:field(data,'tunedFrequencyMHz',108,117.95),
    source:'SIMULATOR_DME_CHANNEL_'+kind.slice(-1),
    measurement:'SLANT_RANGE_NM_NO_GEOMETRIC_FIX'}};
  }
  throw Error('UNKNOWN_SENSOR_KIND');
 }
 function create({getPublisher,now=()=>Date.now()}={}){
  if(typeof getPublisher!=='function')throw Error('SENSOR_BUS_PUBLISHER_REGISTRY_REQUIRED');
  let config=null,lastSequence=-1,lastFrameTime=null,accepted=0,rejected=0;
  const active=new Set(),lastRejected=[];
  function configure({sourceId,equipment}={}){
   if(config!==null)throw Error('SOURCE_ALREADY_CONFIGURED');
   if(typeof sourceId!=='string'||!(/^[A-Z][A-Z0-9_-]{2,63}$/).test(sourceId))
    throw Error('EXPLICIT_SIMULATOR_SOURCE_ID_REQUIRED');
   if(!obj(equipment)||Object.keys(equipment).some(k=>!['adc','gps','vor','dme'].includes(k)))
    throw Error('EQUIPMENT_MANIFEST_REQUIRED');
   const channels=[];
   for(const type of ['adc','gps','vor','dme']){
    if(!Array.isArray(equipment[type])||equipment[type].some(n=>![1,2].includes(n))||new Set(equipment[type]).size!==equipment[type].length)
     throw Error('EQUIPMENT_CHANNELS_REQUIRED_'+type);
    for(const n of equipment[type])channels.push(type+n);
   }
   if(channels.length===0)throw Error('NO_INSTALLED_SENSORS_DECLARED');
   config=Object.freeze({sourceId,equipment:copy(equipment),channels:Object.freeze(channels)});
   for(const kind of channels)active.add(kind);
   return diagnostics();
  }
  function ingest(frame){
   if(!config)throw Error('SENSOR_SOURCE_NOT_CONFIGURED');
   const failure=reason=>{rejected++;lastRejected.push(reason);if(lastRejected.length>24)lastRejected.shift();throw Error(reason);};
   if(!obj(frame)||frame.schema!=='B737_SENSOR_FRAME_V2'||frame.sourceId!==config.sourceId)failure('SENSOR_FRAME_SOURCE_MISMATCH');
   if(!Number.isSafeInteger(frame.sequence)||frame.sequence<=lastSequence||frame.sequence<0)failure('SENSOR_REPLAY_OR_OUT_OF_ORDER');
   const time=now();
   if(!Number.isFinite(time)||!finite(frame.sourceTimestampMs,0,1e15)||
      time-frame.sourceTimestampMs>2500||frame.sourceTimestampMs-time>500)failure('SENSOR_FRAME_STALE_OR_FUTURE');
   if(!obj(frame.sensors)||Object.keys(frame.sensors).length===0)failure('SENSOR_FRAME_EMPTY');
   const staged=[];
   try{
    for(const [kind,measurement] of Object.entries(frame.sensors)){
     if(!active.has(kind))throw Error('UNINSTALLED_OR_UNAUTHORIZED_SENSOR_'+kind);
     staged.push({kind,...parse(kind,measurement)});
    }
   }catch(e){failure(e.message||String(e))}
   // Atomic validation: no sensor changes or sequence advances on bad packets.
   for(const s of staged){
    const owner=OWNER[s.kind.replace(/[12]$/,'')],topic=TOPIC[s.kind];
    getPublisher(owner).publish(topic,s.value,{quality:s.quality,origin:'SIMULATOR_TELEMETRY',reason:s.reason??null});
   }
   lastSequence=frame.sequence;lastFrameTime=frame.sourceTimestampMs;accepted++;
   return {schema:'B737_SENSOR_INGRESS_RESULT_V2',accepted:true,sourceId:config.sourceId,
    sequence:frame.sequence,channels:staged.map(s=>s.kind),invalid:staged.filter(s=>s.quality==='INVALID').map(s=>s.kind)};
  }
  function diagnostics(){return {configured:config!==null,sourceId:config?.sourceId||null,
   equipment:config?copy(config.equipment):null,channels:[...active],lastSequence,lastFrameTime,
   accepted,rejected,lastRejected:[...lastRejected],authority:'SIMULATOR_TELEMETRY_ONLY_NO_FLIGHT_CONTROL'};}
  return Object.freeze({configure,ingest,diagnostics,TOPIC});
 }
 return Object.freeze({KINDS,OWNER,TOPIC,parse,create});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/efis/wmm2025-magnetic-model-v1.js?v=WMM2025-GLOBAL-0001 */
try{
/* NOAA NCEI / BGS World Magnetic Model WMM2025; public domain.
 * WGS84 spherical harmonic degree 12, annual secular variation 2025-2029.
 * Test against NOAA WMM2025_TEST_VALUES.txt; not a physical aircraft sensor.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737WMM2025V1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='B737_WMM2025_0001',EPOCH=2025,UNTIL=2030;
 const COF=[[1,0,-29351.8,0,12,0],[1,1,-1410.8,4545.4,9.7,-21.5],[2,0,-2556.6,0,-11.6,0],[2,1,2951.1,-3133.6,-5.2,-27.7],[2,2,1649.3,-815.1,-8,-12.1],[3,0,1361,0,-1.3,0],[3,1,-2404.1,-56.6,-4.2,4],[3,2,1243.8,237.5,0.4,-0.3],[3,3,453.6,-549.5,-15.6,-4.1],[4,0,895,0,-1.6,0],[4,1,799.5,278.6,-2.4,-1.1],[4,2,55.7,-133.9,-6,4.1],[4,3,-281.1,212,5.6,1.6],[4,4,12.1,-375.6,-7,-4.4],[5,0,-233.2,0,0.6,0],[5,1,368.9,45.4,1.4,-0.5],[5,2,187.2,220.2,0,2.2],[5,3,-138.7,-122.9,0.6,0.4],[5,4,-142,43,2.2,1.7],[5,5,20.9,106.1,0.9,1.9],[6,0,64.4,0,-0.2,0],[6,1,63.8,-18.4,-0.4,0.3],[6,2,76.9,16.8,0.9,-1.6],[6,3,-115.7,48.8,1.2,-0.4],[6,4,-40.9,-59.8,-0.9,0.9],[6,5,14.9,10.9,0.3,0.7],[6,6,-60.7,72.7,0.9,0.9],[7,0,79.5,0,0,0],[7,1,-77,-48.9,-0.1,0.6],[7,2,-8.8,-14.4,-0.1,0.5],[7,3,59.3,-1,0.5,-0.8],[7,4,15.8,23.4,-0.1,0],[7,5,2.5,-7.4,-0.8,-1],[7,6,-11.1,-25.1,-0.8,0.6],[7,7,14.2,-2.3,0.8,-0.2],[8,0,23.2,0,-0.1,0],[8,1,10.8,7.1,0.2,-0.2],[8,2,-17.5,-12.6,0,0.5],[8,3,2,11.4,0.5,-0.4],[8,4,-21.7,-9.7,-0.1,0.4],[8,5,16.9,12.7,0.3,-0.5],[8,6,15,0.7,0.2,-0.6],[8,7,-16.8,-5.2,0,0.3],[8,8,0.9,3.9,0.2,0.2],[9,0,4.6,0,0,0],[9,1,7.8,-24.8,-0.1,-0.3],[9,2,3,12.2,0.1,0.3],[9,3,-0.2,8.3,0.3,-0.3],[9,4,-2.5,-3.3,-0.3,0.3],[9,5,-13.1,-5.2,0,0.2],[9,6,2.4,7.2,0.3,-0.1],[9,7,8.6,-0.6,-0.1,-0.2],[9,8,-8.7,0.8,0.1,0.4],[9,9,-12.9,10,-0.1,0.1],[10,0,-1.3,0,0.1,0],[10,1,-6.4,3.3,0,0],[10,2,0.2,0,0.1,0],[10,3,2,2.4,0.1,-0.2],[10,4,-1,5.3,0,0.1],[10,5,-0.6,-9.1,-0.3,-0.1],[10,6,-0.9,0.4,0,0.1],[10,7,1.5,-4.2,-0.1,0],[10,8,0.9,-3.8,-0.1,-0.1],[10,9,-2.7,0.9,0,0.2],[10,10,-3.9,-9.1,0,0],[11,0,2.9,0,0,0],[11,1,-1.5,0,0,0],[11,2,-2.5,2.9,0,0.1],[11,3,2.4,-0.6,0,0],[11,4,-0.6,0.2,0,0.1],[11,5,-0.1,0.5,-0.1,0],[11,6,-0.6,-0.3,0,0],[11,7,-0.1,-1.2,0,0.1],[11,8,1.1,-1.7,-0.1,0],[11,9,-1,-2.9,-0.1,0],[11,10,-0.2,-1.8,-0.1,0],[11,11,2.6,-2.3,-0.1,0],[12,0,-2,0,0,0],[12,1,-0.2,-1.3,0,0],[12,2,0.3,0.7,0,0],[12,3,1.2,1,0,-0.1],[12,4,-1.3,-1.4,0,0.1],[12,5,0.6,0,0,0],[12,6,0.6,0.6,0.1,0],[12,7,0.5,-0.1,0,0],[12,8,-0.1,0.8,0,0],[12,9,-0.4,0.1,0,0],[12,10,-0.2,-1,-0.1,0],[12,11,-1.3,0.1,0,0],[12,12,-0.7,0.2,-0.1,-0.1]];
 const N=12,A=6378.137,B=6356.7523142,R=6371.2,RAD=Math.PI/180;
 const valid=x=>typeof x==='number'&&Number.isFinite(x);
 const norm=x=>((x%360)+360)%360;
 const c=Array.from({length:13},()=>Array(13).fill(0));
 const cd=Array.from({length:13},()=>Array(13).fill(0));
 const k=Array.from({length:13},()=>Array(13).fill(0));
 const sn=Array.from({length:13},()=>Array(13).fill(0));sn[0][0]=1;
 for(const [n,m,g,h,dg,dh] of COF){c[m][n]=g;cd[m][n]=dg;if(m){c[n][m-1]=h;cd[n][m-1]=dh;}}
 for(let n=1;n<=N;n++){
  sn[0][n]=sn[0][n-1]*(2*n-1)/n;let j=2;
  for(let m=0;m<=n;m++){
   k[m][n]=n===1?0:((n-1)*(n-1)-m*m)/((2*n-1)*(2*n-3));
   if(m){
    sn[m][n]=sn[m-1][n]*Math.sqrt((n-m+1)*j/(n+m));j=1;
    c[n][m-1]*=sn[m][n];cd[n][m-1]*=sn[m][n];
   }
   c[m][n]*=sn[m][n];cd[m][n]*=sn[m][n];
  }
 }
 function decimalYear(date){
  if(valid(date))return date;
  const d=date instanceof Date?date:date===undefined?new Date():new Date(date);
  if(!Number.isFinite(d.getTime()))return NaN;
  const y=d.getUTCFullYear(),start=Date.UTC(y,0,1),end=Date.UTC(y+1,0,1);
  return y+(d.getTime()-start)/(end-start);
 }
 function evaluate({lat,lon,altitudeFt=0,date}={}){
  const year=decimalYear(date);
  if(!valid(lat)||Math.abs(lat)>90||!valid(lon)||Math.abs(lon)>360||
     !valid(altitudeFt)||altitudeFt< -3280||altitudeFt>2788000||
     !valid(year)||year<EPOCH||year>=UNTIL)
   return {valid:false,source:VERSION,reason:'INVALID_WMM2025_LOCATION_ALTITUDE_OR_EPOCH',declinationDeg:null};
  const h=altitudeFt*.0003048;
  const a2=A*A,b2=B*B,c2=a2-b2,a4=a2*a2,b4=b2*b2;
  const phi=lat*RAD,lambda=lon*RAD,sl=Math.sin(phi),cl=Math.cos(phi);
  const q=Math.sqrt(a2-c2*sl*sl),q1=h*q,q2=((q1+a2)/(q1+b2))**2;
  const ct=sl/Math.sqrt(q2*cl*cl+sl*sl),st=Math.sqrt(Math.max(0,1-ct*ct));
  const radius=Math.sqrt(h*h+2*q1+(a4-(a4-b4)*sl*sl)/(q*q));
  const d=Math.sqrt(a2*cl*cl+b2*sl*sl),ca=(h+d)/radius,sa=c2*cl*sl/(radius*d);
  const sp=Array(13).fill(0),cp=Array(13).fill(0);cp[0]=1;
  sp[1]=Math.sin(lambda);cp[1]=Math.cos(lambda);
  for(let m=2;m<=N;m++){
   sp[m]=sp[1]*cp[m-1]+cp[1]*sp[m-1];
   cp[m]=cp[1]*cp[m-1]-sp[1]*sp[m-1];
  }
  const pp=Array(13).fill(0);pp[0]=1;
  const p=Array.from({length:13},()=>Array(13).fill(0));
  const dp=Array.from({length:13},()=>Array(13).fill(0));p[0][0]=1;
  const dt=year-EPOCH,aor=R/radius;let ar=aor*aor,bt=0,bp=0,br=0,bpp=0;
  for(let n=1;n<=N;n++){
   ar*=aor;
   for(let m=0;m<=n;m++){
    if(n===m){
     p[m][n]=st*p[m-1][n-1];
     dp[m][n]=st*dp[m-1][n-1]+ct*p[m-1][n-1];
    }else if(n===1&&m===0){
     p[m][n]=ct*p[m][n-1];
     dp[m][n]=ct*dp[m][n-1]-st*p[m][n-1];
    }else{
     p[m][n]=ct*p[m][n-1]-k[m][n]*p[m][n-2];
     dp[m][n]=ct*dp[m][n-1]-st*p[m][n-1]-k[m][n]*dp[m][n-2];
    }
    const g=c[m][n]+dt*cd[m][n],hg=m?c[n][m-1]+dt*cd[n][m-1]:0;
    const t1=g*cp[m]+hg*sp[m],t2=g*sp[m]-hg*cp[m];
    const par=ar*p[m][n];
    bt-=ar*t1*dp[m][n];bp+=m*t2*par;br+=(n+1)*t1*par;
    if(st<1e-9&&m===1){
     if(n===1)pp[n]=pp[n-1];else pp[n]=ct*pp[n-1]-k[m][n]*pp[n-2];
     bpp+=m*t2*ar*pp[n];
    }
   }
  }
  bp=st<1e-9?bpp:bp/st;
  const north=-bt*ca-br*sa,east=bp,down=bt*sa-br*ca,horizontal=Math.hypot(north,east);
  if(!valid(horizontal)||horizontal<2000)
   return {valid:false,source:VERSION,reason:'MAGNETIC_POLAR_BLACKOUT_UNRELIABLE',declinationDeg:null};
  return {valid:true,source:'NOAA_NCEI_BGS_WMM2025',quality:'MODELED_NOT_MEASURED',
   declinationDeg:Math.atan2(east,north)/RAD,northNt:north,eastNt:east,downNt:down,
   horizontalNt:horizontal,decimalYear:year,lat,lon,altitudeFt};
 }
 return Object.freeze({VERSION,EPOCH,UNTIL,COEFFICIENT_COUNT:COF.length,decimalYear,evaluate,
  trueToMag:(x,variation)=>valid(x)&&valid(variation)?norm(x-variation):null,
  magToTrue:(x,variation)=>valid(x)&&valid(variation)?norm(x+variation):null});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./avionics-network-runtime-v1.js?v=AVIONICS-NET-0004-WMM2025-MAG */
try{
/* Unified read-only avionics source adapters + FMC consumer.
 * Each subsystem owns its topic. Readings are published to any subscribers in
 * the same cockpit session; never sent to unrelated Internet users.
 * Protected IRS/CDU/MCP frontends and CB photos are not modified.
 */
(function(root){
 'use strict';
 const Network=root.B737AvionicsDataNetworkV1,Computer=root.B737AvionicsFmcComputerV1;
 if(!Network||!Computer){root.console?.error('AVIONICS NETWORK DEPENDENCIES MISSING');return;}
 const SensorIngress=root.B737AvionicsSensorIngressV2;
 const network=Network.createNetwork({onError:e=>root.console?.warn('AVIONICS SUBSCRIBER ERROR',e)});
 const owners=new Map(),faults=[];
 let irsMotion=null;
 root.addEventListener('b737:simulator-telemetry',({detail:f})=>{
  const age=Date.now()-f?.sourceTimestampMs;
  if(f?.valid!==true||!Number.isFinite(f.gsKt)||f.gsKt<0||f.gsKt>750||
   !Number.isFinite(f.trueTrackDeg)||!Number.isFinite(age)||age< -1000||age>3000||
   f.sourceTimestampMs<=(irsMotion?.sourceTimestampMs??-Infinity))return;
  irsMotion=structuredClone(f);
  scheduleRefresh();
 });
 let refreshPending=false;
 const enqueue=root.queueMicrotask?fn=>root.queueMicrotask(fn):fn=>Promise.resolve().then(fn);
 function scheduleRefresh(){
  if(refreshPending)return;refreshPending=true;
  enqueue(()=>{if(refreshPending){refreshPending=false;refresh();}});
 }
 function flushRefresh(){if(refreshPending){refreshPending=false;refresh();}}
 const clone=x=>JSON.parse(JSON.stringify(x));
 const getOwner=id=>{if(!owners.has(id))owners.set(id,network.producer(id));return owners.get(id)};
 const sensorIngress=SensorIngress?.create({getPublisher:getOwner})||null;
 const send=(owner,topic,value,origin='TRAINING_SCENARIO')=>{
  try{return getOwner(owner).publish(topic,value,{origin});}
  catch(e){faults.push({owner,topic,error:String(e.message||e)});if(faults.length>32)faults.shift();return null;}
 };
 const snapshotFns=Object.freeze({
  electrical:()=>root.B737ISNCockpitV1?.getState?.()?.state?.electrical,
  irs:()=>root.B737IRSTrainerUnified?.getState?.(),
  mcp:()=>root.B737McpAFDSBridgeV1?.getOutput?.(),
  fmc:()=>root.B737FmcSystemsBridgeV1?.getState?.(),
  ecu:()=>root.B737ISNCockpitV1?.getECUState?.(),
  profile:()=>root.B737AircraftProfileStore?.get?.()
 });
 function electrical(){
  const e=snapshotFns.electrical();
  if(e?.schema==='B737_ELECTRICAL_V7_RESULT'&&e.bus&&typeof e.bus==='object'){
   send('ELECTRICAL','electrical.buses',{bus:e.bus,revision:e.revision??null,
    evidence:'BUS_LEVEL_ONLY_NO_VERIFIED_EQUIPMENT_FEED'},'LIVE_SYSTEM');
  }
 }
 function irs(){
  const state=snapshotFns.irs();
  if(!state?.units)return;
  const bench=state.motionSource==='BENCH_SIM';
  const frame=state.motionSource==='EXTERNAL_TELEMETRY'&&irsMotion&&
   Date.now()-irsMotion.sourceTimestampMs<=3000?irsMotion:null;
  const number=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max?v:null;
  for(const [side,topic] of [['L','irs.left'],['R','irs.right']]){
   const u=state.units[side];if(!u)continue;
   const position=u.positionValid===true?u.position:null;
   const sample=frame?.iru?.[side]??frame;
   const nav=u.powered===true&&u.positionValid===true;
   const att=nav||u.powered===true&&u.phase==='ATT'&&sample?.attRecoveryValid===true;
   const pitchDeg=att?number(sample?.pitchDeg??(bench?0:null),-90,90):null;
   const rollDeg=att?number(sample?.rollDeg??(bench?0:null),-180,180):null;
   const heading=nav?number(sample?.trueHeadingDeg??((frame||bench)?u.trueHeadingDeg:null),0,360):
    att&&sample?.attHeadingValid===true?number(sample.trueHeadingDeg,0,360):null;
   const suppliedVariation=att?number(sample?.magneticVariationDeg,-180,180):null;
   const lat=nav?number(sample?.lat??position?.lat,-90,90):null;
   const lon=nav?number(sample?.lon??position?.lon,-180,180):null;
   const altitudeFt=number(sample?.altitudeFt,-1000,65000)??0;
   const model=att&&lat!==null&&lon!==null&&suppliedVariation===null?
    root.B737WMM2025V1?.evaluate?.({lat,lon,altitudeFt}):null;
   const variation=suppliedVariation??(model?.valid===true?model.declinationDeg:null);
   const variationSource=suppliedVariation!==null?'EXTERNAL_IRS_TELEMETRY':
    model?.valid===true?'NOAA_NCEI_BGS_WMM2025':
    'NO_VALID_MAGNETIC_VARIATION';
   send('IRS',topic,{mode:u.mode,phase:u.phase,powered:u.powered===true,
    positionValid:nav,lat:lat??null,lon:lon??null,
    gsKt:nav&&!!(frame||bench)?number(sample?.gsKt??u.gsKt,0,750):null,
    trackDeg:nav&&!!(frame||bench)?number(sample?.trueTrackDeg??u.trueTrackDeg,0,360):null,
    headingDeg:heading,pitchDeg,rollDeg,attitudeValid:pitchDeg!==null&&rollDeg!==null,
    magneticVariationDeg:att?variation:null,
    magneticVariationSource:variationSource,
    magneticVariationMode:'MAGNETIC_REFERENCE_ALWAYS',
    windFromDeg:nav?number(sample?.windFromDeg,0,360):null,windKt:nav?number(sample?.windKt,0,250):null,
    source:state.motionSource,trainerOnly:state.trainerOnly===true},
    state.motionSource==='EXTERNAL_TELEMETRY'?'SIMULATOR_TELEMETRY':'TRAINING_SCENARIO');
  }
 }
 function mcp(){
  const s=snapshotFns.mcp();if(s?.schema!=='B737_MCP_AFDS_OUTPUT_V1')return;
  const c=s.controls||{},m=s.modes||{},v=s.values||{};
  // MCP is the authoritative selected-value and AFDS mode owner; the
  // COURSE 2 window has its own battery-bus feed and must not be treated
  // as powered simply because MCP's main feed is present.
  send('MCP','mcp.state',{powered:s.power,course2Powered:s.course2Power,
   feedEvidence:s.powerEvidence,altitudeFt:v.altitude??null,
   selectedSpeedKt:v.speed??null,selectedMachHundredths:v.machHundredths??null,
   speedDisplayMode:s.speedDisplayMode??null,speedBlank:s.displayBlank?.speed===true,
   headingDeg:v.heading??null,verticalSpeedFpm:v.verticalSpeed??null,
   courseL:v.courseL??null,courseR:v.courseR??null,
   lateralMode:m.lateral??null,verticalMode:m.vertical??null,
   thrustMode:m.thrust??null,autopilotMode:m.autopilot??null,
   fdLeft:c.fd?.left===true,fdRight:c.fd?.right===true,
   atArm:c.atArm===true,axisControl:s.axisControl||null,
   armed:s.armed||{},capture:s.capture||{},pending:s.pending||{},fmcGuidance:s.fmcGuidance||null},'TRAINING_SCENARIO');
  send('AFDS','afds.state',{lateralMode:m.lateral??null,verticalMode:m.vertical??null,autopilotMode:m.autopilot??null,
   fdLeft:c.fd?.left??null,fdRight:c.fd?.right??null,power:s.power},'TRAINING_SCENARIO');
  send('AUTOTHROTTLE','autothrottle.state',{armed:c.atArm===true,mode:m.thrust??null,
   power:s.power,actuatorFeedback:'NOT_AVAILABLE'},'TRAINING_SCENARIO');
 }
 function fmcFeedsAndRoute(){
  const s=snapshotFns.fmc();if(!s)return;
  const mode=window.B737UnifiedBusConsumerLiveV1?.getDevice?.('FMC')?.state;
  const efisSupply=root.B737UnifiedEfisSources?.trainingSupply;
  const trainingEfisSupply=['electronic1','electronic2','standby'].some(bus=>efisSupply?.(bus,'115VAC'))&&
   ['FMC1','FMC2'].some(unit=>root.B737UnifiedCB?.available('fmc.'+unit)!==false);
  if(s.power)send('FMC_FEEDS','electrical.fmcFeeds',{FMC1:s.power.FMC1, FMC2:s.power.FMC2,
   CDU_CAPT:s.power.CDU_CAPT,CDU_FO:s.power.CDU_FO,
   modeledSupply:mode==='NORMAL'?true:mode==='OFF'?false:null,trainingEfisSupply,failed:s.fmcFailure===true,
   verification:'INDIVIDUAL_FEEDS_AND_MRG_AGGREGATE'},'LIVE_SYSTEM');
  const r=s.route;
  if(r)send('CDU','crew.flightplan',{origin:r.origin||'',dest:r.dest||'',active:r.active===true,
   displayRoute:r.displayRoute??null,legsVerified:r.legsVerified===true,discontinuitiesUnknown:r.discontinuitiesUnknown!==false,
   routeSource:'DUAL_CDU_SHARED_SESSION',transactional:true},'CREW_ENTRY');
 }
 function engine(){
  const e=snapshotFns.ecu();
  if(!e?.engines)return;
  for(const n of [1,2]){
   const v=e.engines['engine'+n];if(!v||typeof v!=='object')continue;
   send('ENGINE','propulsion.engine'+n,{phase:v.phase||null,n1Percent:v.n1Percent??null,
    n2Percent:v.n2Percent??null,egtC:v.egtC??null,fuelFlowKgHr:v.fuelFlowKgHr??null,
    oilPressurePsi:v.oil?.pressurePsi??null,trainingModel:true},'TRAINING_SCENARIO');
  }
  // An ECU fuel-flow indication is NOT a fuel-quantity summation signal.
  // Fuel quantity stays UNKNOWN until an authoritative summation adapter is attached.
 }
 function auxiliarySystems(){
  const ecu=snapshotFns.ecu();
  if(!ecu)return;
  const aircraft=ecu.aircraft;
  const scenarioApi=root.B737UnifiedFlightScenarioV1;
  const scenario=scenarioApi?.getDiagnostics?.()?.active===true?scenarioApi.getState?.():null;
  if(scenario||(aircraft&&typeof aircraft==='object'))
   send('FLIGHT_CONTEXT','flightcontext.state',{
    pressureAltitudeFt:scenario?.altitudeFt??aircraft?.pressureAltitudeFt??null,
    iasKt:scenario?.iasKt??aircraft?.iasKt??null,
    oatC:aircraft?.oatC??null,massKg:aircraft?.massKg??null,
    onGround:scenario?!scenario.airborne:aircraft?.onGround??null,
    source:scenario?'FLIGHT_SCENARIO_INSTRUCTOR_OVERRIDE':'ISN13_18_TRAINING_FLIGHT_CONDITIONS_NOT_ADC'},'TRAINING_SCENARIO');
  if(ecu.apu&&typeof ecu.apu==='object')
   send('APU','apu.state',{...ecu.apu,source:'ISN13_18_APU_TRAINING_MODEL'},'TRAINING_SCENARIO');
  if(ecu.hydraulics&&typeof ecu.hydraulics==='object')
   send('HYDRAULICS','hydraulics.state',{...ecu.hydraulics,
    source:'ISN13_18_ENGINE_DRIVEN_PRESSURE_TRAINING_MODEL'},'TRAINING_SCENARIO');
  const pumps=root.B737ISNCockpitV1?.getState?.()?.state?.pumps;
  if(pumps&&typeof pumps==='object')
   send('FUEL','fuel.pumps',{observations:pumps,
    note:'INCLUDES_HYDRAULIC_PUMPS; EQUIPMENT_FEED_ASSIGNMENTS_UNVERIFIED'},'TRAINING_SCENARIO');
 }
 function fuelQuantity(){
  const fuel=snapshotFns.ecu()?.fuel;
  const t=fuel?.tanksKg;
  if(!t||!['main1','main2','center'].every(k=>typeof t[k]==='number'&&Number.isFinite(t[k])&&t[k]>=0))return;
  const totalKg=t.main1+t.main2+t.center;
  send('FUEL','fuel.quantity',{totalKg,tanksKg:{main1:t.main1,main2:t.main2,center:t.center},
   source:'ISN09_12_SIMULATED_TANKS_NOT_A_VERIFIED_FUEL_SUMMATION_UNIT',
   trainingModel:true},'TRAINING_SCENARIO');
 }
 function airGround(){
  const scenarioApi=root.B737UnifiedFlightScenarioV1;
  const scenario=scenarioApi?.getDiagnostics?.()?.active===true?scenarioApi.getState?.():null;
  const a=snapshotFns.ecu()?.aircraft;
  if(scenario||typeof a?.onGround==='boolean'){
   send('AIRGROUND','aircraft.airground',{onGround:scenario?!scenario.airborne:a.onGround,
    source:scenario?'FLIGHT_SCENARIO_INSTRUCTOR_OVERRIDE':'ISN13_18_TRAINING_FLIGHT_CONTEXT'},'TRAINING_SCENARIO');
  }
 }
 function pneumatics(){
  const start=root.B737ISNCockpitV1?.getStartState?.();
  const bleed=start?.bleed;
  if(bleed&&typeof bleed==='object')send('PNEUMATICS','pneumatics.state',{
   bleedValveObservations:bleed,ductPressurePsi:null,
   ductPressureVerified:false,source:'ISN_START_CHAIN_DISCRETES'},'TRAINING_SCENARIO');
 }
 function antiice(){
  const heat=root.B737WindowHeatUnifiedV1?.getOutput?.();
  const tat=root.B737TATProbeUnifiedV1?.getOutput?.();
  if(!heat&&!tat)return;
  send('ANTIICE','antiice.state',{windowHeat:heat||null,
   tatProbeHeater:tat||null,engineAntiIce:null,wingAntiIce:null,
   completeness:'PARTIAL_WINDOW_HEAT_AND_TAT_ONLY'},'TRAINING_SCENARIO');
 }
 function profile(){
  const s=snapshotFns.profile();
  if(s&&typeof s==='object')send('PROFILE','aircraft.profile',{aircraftFamily:s.aircraftFamily??null,
   pressurization:s.pressurization??null,engineInstruments:s.engineInstruments??null},'CREW_ENTRY');
 }
 function clock(){
  const time=new Date();
  send('CLOCK','clock.utc',{isoUtc:time.toISOString(),epochMs:time.valueOf()},'LIVE_SYSTEM');
 }
 function refresh(){
  refreshPending=false;
  for(const f of [electrical,irs,mcp,fmcFeedsAndRoute,engine,auxiliarySystems,fuelQuantity,airGround,pneumatics,antiice,profile,clock])try{f()}catch(e){
   faults.push({source:f.name,error:String(e.message||e)});if(faults.length>32)faults.shift();
  }
  computer.refresh(); // Let TTL expiry invalidate computed FMC even without new sensor frames.
  return network.audit();
 }
 const computer=Computer.connect(network);
 network.subscribe('*',record=>{
  if(record.revision>0)root.dispatchEvent(new CustomEvent('b737:avionics-data',{detail:record}));
 },{replay:false});
 // Every future adapter is attached to its own fixed owner. It cannot write a
 // topic owned by another avionics system, or override existing live adapters.
 const connectedExternal=new Set();
 function connectExternal(owner){
  if(typeof owner!=='string'||!Object.values(Network.CATALOG).some(x=>x.owner===owner))throw Error('UNKNOWN_AVIONICS_OWNER');
  if(owners.has(owner)||connectedExternal.has(owner)||owner==='FMC')throw Error('OWNER_ALREADY_CONNECTED');
  const publisher=getOwner(owner);
  connectedExternal.add(owner);
  return Object.freeze({owner,topics:[...publisher.topics],
   publish(topic,value,{quality='VALID',origin='SIMULATOR_TELEMETRY',reason=null}={}){
    if(!['SIMULATOR_TELEMETRY','TRAINING_SCENARIO','REFERENCE_DATABASE','CREW_ENTRY'].includes(origin))
     throw Error('EXTERNAL_SOURCE_ORIGIN_UNVERIFIED');
    return publisher.publish(topic,value,{quality,origin,reason});
   }});
 }
 // Non-mutating registration, readable by all authorized same-context consumers.
 root.B737UnifiedAvionicsNetworkV1=Object.freeze({
  getSignal:topic=>{flushRefresh();return network.read(topic)},getSnapshot:()=>{flushRefresh();return network.snapshot()},
  getDiagnostics:()=>{flushRefresh();return {...network.audit(),adapterErrors:clone(faults)}},
  getFmcInputs:()=>{flushRefresh();return computer.getState()},subscribe:(...args)=>{flushRefresh();return network.subscribe(...args)},
  connectExternal,refresh,topics:network.topics,
  configureSensorIngress(options){
   if(!sensorIngress)throw Error('SENSOR_INGRESS_MODULE_NOT_LOADED');
   if(options?.equipment)for(const [kind,nums] of Object.entries(options.equipment)){
    if(!['adc','gps','vor','dme'].includes(kind))throw Error('INVALID_SENSOR_KIND');
    if(Array.isArray(nums)&&nums.length){
     const owner={adc:'ADC',gps:'GPS',vor:'VHF_NAV',dme:'DME'}[kind];
     if(owners.has(owner))throw Error('SENSOR_OWNER_ALREADY_REGISTERED_'+owner);
    }
   }
   const info=sensorIngress.configure(options);
   for(const kind of Object.keys(options.equipment))
    if(options.equipment[kind].length)getOwner({adc:'ADC',gps:'GPS',vor:'VHF_NAV',dme:'DME'}[kind]);
   return info;
  },
  ingestSensorFrame(packet){if(!sensorIngress)throw Error('SENSOR_INGRESS_MODULE_NOT_LOADED');
   return sensorIngress.ingest(packet);},
  getSensorIngressDiagnostics:()=>sensorIngress?.diagnostics()||{configured:false,error:'MODULE_MISSING'},
  supportedSources:Object.freeze({LIVE:['ELECTRICAL','IRS','MCP','AFDS','AUTOTHROTTLE','FMC_FEEDS','CDU','ENGINE','FUEL','FLIGHT_CONTEXT','APU','HYDRAULICS','PNEUMATICS','ANTIICE','AIRGROUND','PROFILE','CLOCK'],
   AWAITING_SIGNAL:['ADC','GPS','VHF_NAV','DME','TAT','NAVDB','PERFDB','ACARS','CB'],
   SENSOR_INGRESS_READY:['ADC','GPS','VHF_NAV','DME']})
 });
 // Old FMC/IRS frontend and driver remain the authoritative writers.
 // Consume existing change events, with a 250ms health poll for non-event sources.
 for(const event of ['b737:irs-trainer-state','b737:mcp-afds-state','b737:isn-start-indications',
  'b737:fmc-systems-state','b737:aircraft-profile-change','b737:bus-consumer-snapshot','b737:efis-preset-change']){
  root.addEventListener(event,scheduleRefresh);
 }
 root.addEventListener('b737:cockpit-mounted',refresh);
 if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',refresh,{once:true});
 refresh();
 root.setInterval(refresh,250);
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
