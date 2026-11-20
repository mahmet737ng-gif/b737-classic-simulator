(async()=>{
;
/* ../../engine/systems/ground-power-header-policy-v1.js?v=GPU-FCOM-0001 */
try{
/* 737-300/-400/-500 FCOM 6.10.6, 6.20.2 & SP.6.1.
 * Pure UI decision policy; the only electrical writer is existing V7/ISN Pack.
 * External GPU connection is an environment event, NOT an AC bus selection.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737GroundPowerHeaderPolicyV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const ACTIONS=Object.freeze(['CONNECT','DISCONNECT','ON','OFF']);
 function evaluate(state,projection){
  if(!state?.config||!state.source)throw Error('Live Electrical V7 state required');
  const c=state.config;
  const attached=c.groundPowerAttached===true;
  const quality=c.groundPowerQualityGood===true;
  const onGround=c.onGround===true;
  const available=attached&&quality;
  const ext1=state.source[1]==='EXT',ext2=state.source[2]==='EXT';
  const connected=ext1&&ext2&&projection?.source?.[1]==='EXT'&&projection?.source?.[2]==='EXT'&&
   projection?.bus?.transfer1===true&&projection?.bus?.transfer2===true;
  const batteryOn=c.batterySwitch===true;
  const fault=!quality&&attached;
  let status=connected?'ON_BUS':available?'AVAILABLE':fault?'BAD_QUALITY':attached?'CABLE_ATTACHED':'DISCONNECTED';
  return Object.freeze({
   status,attached,quality,available,onGround,batteryOn,connected,
   selected:{1:ext1,2:ext2},
   bus:{1:projection?.bus?.transfer1===true,2:projection?.bus?.transfer2===true},
   lampAvailable:available,
   canConnect:onGround&&!attached,
   canDisconnect:attached,
   canSwitchOn:available&&onGround&&batteryOn&&!connected,
   canSwitchOff:ext1||ext2,
   reason:!onGround?'NOT_ON_GROUND':!attached?'CONNECT_GPU_FIRST':
    !quality?'POWER_QUALITY_NOT_ACCEPTABLE':!batteryOn?'BATTERY_SWITCH_OFF':
    connected?'ALREADY_ON_BOTH_BUSES':'READY_FOR_GRD_PWR_ON'
  });
 }
 function plan(action,state,projection){
  if(!ACTIONS.includes(action))throw Error('Unknown ground power header action');
  const view=evaluate(state,projection);
  if(action==='CONNECT'){
   if(!view.canConnect)throw Error(view.onGround?'GPU already attached':'GPU connection requires aircraft on ground');
   return Object.freeze({environmentAttached:true,sourceCommands:[]});
  }
  if(action==='ON'){
   if(!view.canSwitchOn)throw Error('GRD PWR ON inhibited: '+view.reason);
   return Object.freeze({environmentAttached:null,
    sourceCommands:[{type:'SELECT_SOURCE',side:1,source:'EXT'}]});
  }
  const commands=[1,2].filter(side=>view.selected[side]).map(side=>
   ({type:'SELECT_SOURCE',side,source:'OFF'}));
  return Object.freeze({environmentAttached:action==='DISCONNECT'?false:null,
   sourceCommands:commands});
 }
 return Object.freeze({ACTIONS,evaluate,plan});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./ground-power-header-v1.js?v=GPU-SPRING-0001-HEADER4 */
try{
/* 737 Classic GRD POWER trainer control in the Unified header.
 * FCOM 6.10.6 / 6.20.2 / SP.6.1. External cable and cockpit momentary
 * GRD PWR switch are separate steps; never manufacture AC power on attach.
 * One electrical owner: the existing ISN03 ECU Electrical V7 Pack.
 */
(function(root){
 'use strict';
 const ID='groundPowerHeader',PANEL='groundPowerPopover';
 const policy=root.B737GroundPowerHeaderPolicyV1;
 if(!policy)return;
 let button=null,panel=null,notice=null,momentary=null,opened=false,lastSignature='';
 const byId=id=>document.getElementById(id);
 const owner=()=>root.B737ISNCockpitV1;
 const electrical=()=>root.B737ElectricalV7;
 function snapshot(){
  const state=owner()?.getElectricalState?.();
  if(!state||!electrical()?.evaluate)return null;
  return {state,projection:electrical().evaluate(state),
   view:policy.evaluate(state,electrical().evaluate(state))};
 }
 function bar(){return document.getElementById('flightGroundPowerDock') || document.querySelector('body > header.unified-minimal-header .header-settings');}
 function ensure(){
  const holder=bar();if(!holder)return false;
  button=byId(ID);
  if(!button){
   button=document.createElement('button');button.id=ID;button.type='button';
   button.textContent='GROUND POWER';
  }
  const cb=holder.querySelector('#cbPanelOpen');
  if(cb&&button.previousElementSibling!==cb)cb.insertAdjacentElement('afterend',button);
  else if(button.parentElement!==holder)holder.append(button);
  if(button.dataset.gpuBound!=='true'){
   button.addEventListener('click',()=>{opened=!opened;panel.hidden=!opened;
    button.setAttribute('aria-expanded',String(opened));render(true);});
   button.dataset.gpuBound='true';
  }
  button.setAttribute('aria-controls',PANEL);
  button.setAttribute('aria-haspopup','dialog');
  button.setAttribute('aria-expanded',String(opened));
  button.setAttribute('aria-label','Ground power cable and GRD PWR switch');
  if(!panel){
   panel=document.createElement('section');panel.id=PANEL;
   panel.setAttribute('role','dialog');panel.setAttribute('aria-label','External Ground Power — FCOM');
   panel.setAttribute('dir','ltr');panel.hidden=true;
   panel.innerHTML=
    '<header><strong>GROUND POWER · 737 CLASSIC</strong><button type="button" id="gpuClose" aria-label="Close ground power controls">×</button></header>'+
    '<p id="gpuStatus" role="status">WAITING FOR LIVE ELECTRICAL SYSTEM</p>'+
    '<p id="gpuAvailability">GRD POWER AVAILABLE: —</p>'+
    '<p id="gpuBus">AC TRANSFER BUS 1 / 2: —</p>'+
    '<div class="gpu-actions">'+
    '<button type="button" data-gpu-action="CONNECT">1 · CONNECT GPU</button>'+
    '<button type="button" data-gpu-action="DISCONNECT">DISCONNECT GPU</button></div>'+
    '<div class="gpu-grd-switch"><strong>2 · GRD PWR · MOMENTARY</strong>'+
    '<div class="gpu-switch-layout"><div class="gpu-switch-labels"><span>ON</span><span>NEUTRAL</span><span>OFF</span></div>'+
    '<button type="button" id="gpuMomentarySwitch" class="gpu-spring-switch" data-position="NEUTRAL" aria-label="GRD POWER ON NEUTRAL OFF; momentary, spring returns to neutral; arrow up for ON and arrow down for OFF"><span class="gpu-spring-lever"></span></button></div>'+
    '<small>Hold toward ON or OFF; release returns to NEUTRAL.</small></div>'+
    '<p class="gpu-explain">FCOM sequence: connect approved external AC → check GRD POWER AVAILABLE → BAT ON → momentarily select GRD PWR ON → verify BUS OFF / TRANSFER BUS OFF and STANDBY PWR OFF extinguish. The real P5 switch remains usable.</p>'+
    '<p id="gpuMessage" role="status" aria-live="polite"></p>';
   document.body.append(panel);
   notice=byId('gpuMessage');
   momentary=byId('gpuMomentarySwitch');
   bindMomentary();
   panel.querySelector('#gpuClose').addEventListener('click',close);
   for(const control of panel.querySelectorAll('[data-gpu-action]')){
    control.addEventListener('click',()=>run(control.dataset.gpuAction));
   }
   document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened)close();});
   document.addEventListener('pointerdown',event=>{
    if(opened&&!panel.contains(event.target)&&!button?.contains(event.target))close();
   });
  }
  // FLT PHASE is a modal: the existing electrical popover must share its top layer.
  const dock=document.getElementById('flightGroundPowerPopoverDock');
  if(panel&&dock&&panel.parentElement!==dock)dock.append(panel);
  return true;
 }
 function close(){opened=false;releaseMomentary();if(panel)panel.hidden=true;if(button)button.setAttribute('aria-expanded','false');}
 function setMomentary(position){
  if(!momentary)return;
  momentary.dataset.position=position;
  momentary.setAttribute('aria-valuetext',position);
 }
 function releaseMomentary(){setMomentary('NEUTRAL');}
 function bindMomentary(){
  if(!momentary||momentary.dataset.bound==='true')return;
  momentary.dataset.bound='true';
  let held=null;
  const poseAt=e=>{
   const rect=momentary.getBoundingClientRect();
   const fraction=(e.clientY-rect.top)/Math.max(1,rect.height);
   return fraction<.35?'ON':fraction>.65?'OFF':'NEUTRAL';
  };
  const actuate=position=>{
   if(position===momentary.dataset.position)return;
   setMomentary(position);
   if(position==='ON'||position==='OFF')run(position);
  };
  const release=e=>{
   if(e&&held!==e.pointerId)return;
   held=null;releaseMomentary();
  };
  momentary.addEventListener('pointerdown',e=>{
   if(e.pointerType==='mouse'&&e.button!==0)return;
   e.preventDefault();e.stopPropagation();
   held=e.pointerId;
   momentary.setPointerCapture(e.pointerId);
   actuate(poseAt(e));
  });
  momentary.addEventListener('pointermove',e=>{
   if(held===e.pointerId){e.preventDefault();actuate(poseAt(e));}
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])
   momentary.addEventListener(name,release);
  momentary.addEventListener('keydown',e=>{
   const next=e.key==='ArrowUp'||e.key==='Home'?'ON':
    e.key==='ArrowDown'||e.key==='End'?'OFF':
    e.key===' '||e.key==='Enter'?(e.shiftKey?'OFF':'ON'):null;
   if(next===null)return;
   e.preventDefault();e.stopPropagation();
   if(e.repeat)return;
   actuate(next);
  });
  momentary.addEventListener('keyup',e=>{
   if(['ArrowUp','ArrowDown','Home','End',' ','Enter'].includes(e.key)){
    e.preventDefault();releaseMomentary();
   }
  });
  momentary.addEventListener('blur',releaseMomentary);
  root.addEventListener('blur',releaseMomentary);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseMomentary();});
 }
 function message(value,error=false){
  if(!notice)return;
  notice.textContent=value||'';notice.dataset.error=String(error);
 }
 function render(force=false){
  if(!ensure())return;
  const s=snapshot();
  const sig=JSON.stringify(s?{
   rev:s.state.rev,attached:s.view.attached,connected:s.view.connected,
   battery:s.view.batteryOn,ground:s.view.onGround,quality:s.view.quality,
   source:s.projection.source,bus:s.projection.bus
  }:null);
  if(!force&&lastSignature===sig)return;
  lastSignature=sig;
  if(!s){
   button.dataset.gpu='WAITING';button.title='Waiting for the live Electrical V7 owner';
   button.disabled=false;
   if(panel&&!panel.hidden){
    byId('gpuStatus').textContent='WAITING FOR LIVE ELECTRICAL SYSTEM';
    for(const el of panel.querySelectorAll('[data-gpu-action]'))el.disabled=true;
   }
   return;
  }
  const {view:v,projection:p}=s;
  button.dataset.gpu=v.status;
  button.title=v.connected?'External AC feeding both AC transfer buses':
   v.available?'GPU attached; use GRD PWR ON with BATTERY ON':
   v.attached?'GPU attached, quality rejected':'Ground power cable disconnected';
  if(!panel?.hidden){
   byId('gpuStatus').textContent='GPU: '+v.status+
    ' · BATTERY '+(v.batteryOn?'ON':'OFF')+
    ' · ON GROUND '+(v.onGround?'YES':'NO');
   byId('gpuAvailability').textContent='GRD POWER AVAILABLE: '+(v.available?'BLUE / ON':'OFF')+
    (v.attached&&!v.quality?' · BAD QUALITY':'');
   byId('gpuBus').textContent='AC TRANSFER BUS 1: '+(p.bus.transfer1?'POWERED':'OFF')+
    ' · BUS 2: '+(p.bus.transfer2?'POWERED':'OFF')+
    ' · SOURCE 1/2: '+(p.source[1]||'NONE')+'/'+(p.source[2]||'NONE');
   for(const control of panel.querySelectorAll('[data-gpu-action]')){
    const a=control.dataset.gpuAction;
    control.disabled=a==='CONNECT'?!v.canConnect:a==='DISCONNECT'?!v.canDisconnect:
     a==='ON'?!v.canSwitchOn:!v.canSwitchOff;
   }
  }
 }
 function environment(attached){
  const lights=byId('overheadFrame')?.contentWindow?.B737OverheadLights;
  if(typeof lights?.setScenario!=='function')
   throw Error('The original overhead must be ready before connecting the GPU');
  // The iframe owns the physical scenario; its controls-state snapshot
  // flows through the existing Bridge into the very same electrical Pack.
  const observation=lights.setScenario({groundPowerAttached:attached});
  if(observation?.context?.groundPowerAttached!==attached)
   throw Error('Overhead GPU cable scenario was not accepted');
 }
 function run(action){
  try{
   if(!policy.ACTIONS.includes(action))throw Error('Unsupported GPU command');
   const s=snapshot();
   if(!s)throw Error('The live Electrical V7 system is not ready');
   const plan=policy.plan(action,s.state,s.projection);
   if(plan.environmentAttached===true){
    environment(true);
    message('GPU cable connected; wait for GRD POWER AVAILABLE, then select GRD PWR ON');
   }else{
    // Before requesting OFF or physical cable removal, retain generator/APU
    // connections on unrelated buses. Only remove a selected EXT contactor.
    for(const command of plan.sourceCommands){
     owner().instructor({type:'ELECTRICAL',action:command});
     const after=owner().getElectricalState();
     if(command.source==='EXT'&&!(after.source[1]==='EXT'&&after.source[2]==='EXT'))
      throw Error('GRD PWR ON rejected by live electrical source owner');
     if(command.source==='OFF'&&after.source[command.side]==='EXT')
      throw Error('GRD PWR OFF was not accepted for bus '+command.side);
    }
    if(plan.environmentAttached===false)environment(false);
    message(action==='ON'?'External power selected on both buses; verify aircraft bus lamps':
     action==='OFF'?'GRD PWR OFF; GPU may remain AVAILABLE':
     'GPU disconnected; external contactors open');
   }
   render(true);
  }catch(error){
   message(error.message||String(error),true);
   render(true);
  }
 }
 function start(){
  if(!ensure())return;
  for(const event of ['b737:electrical-owner-ready','b737:electrical-network',
   'b737:unified-ecu-observation','b737:battery-live']){
   root.addEventListener(event,()=>render());
  }
  // A late iframe/ECU load is not an excuse for a dead header button.
  // This small status check does not read or traverse cockpit bitmap DOM.
  setInterval(()=>{if(opened)render();},1000);
  render(true);
 }
 root.B737GroundPowerHeader=Object.freeze({refresh:()=>render(true),
  getState:()=>snapshot()?.view||null,act:run});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/electrical-demand-estimate-v1.js?v=ATA24-LOAD-EST-0001 */
try{
/* ATA 24 approximate LIVE LOAD ledger for the B737 Classic trainer.
 * NOT a WDM circuit map or verified EP-FSI equipment load schedule.
 * Only the existing Electrical V7 owner can energize buses/sources.
 * AC ratings are equivalent AC GENERATOR AMMETER amperes (three-phase 200V);
 * DC ratings are 28V consumer amperes; never add these unlike units directly.
 * This module does not set switch positions, faults, or alter cockpit artwork.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ElectricalDemandEstimateV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='ATA24-LOAD-EST-0001';
 const entry=(id,label,system,bus,kind,amps,control=null,states=['ON'])=>
  Object.freeze({id,label,system,bus,kind,amps,control,states:Object.freeze(states)});
 const CATALOG=Object.freeze([
  entry('AVIONICS_1','Avionics/equipment DC 1','AVIONICS','dc1','DC',8),
  entry('AVIONICS_2','Avionics/equipment DC 2','AVIONICS','dc2','DC',8),
  entry('FMC_L','FMC/CDU L','AVIONICS','dc1','DC',2.5),
  entry('FMC_R','FMC/CDU R','AVIONICS','dc2','DC',2.5),
  entry('STANDBY_BASE','Essential DC standby','STANDBY','dcStandby','DC',8),
  entry('FUEL_1_FWD','Fuel No.1 FWD','FUEL','transfer1','AC',5.5,'fuel-1-fwd'),
  entry('FUEL_1_AFT','Fuel No.1 AFT','FUEL','transfer1','AC',5.5,'fuel-1-aft'),
  entry('FUEL_2_FWD','Fuel No.2 FWD','FUEL','transfer2','AC',5.5,'fuel-2-fwd'),
  entry('FUEL_2_AFT','Fuel No.2 AFT','FUEL','transfer2','AC',5.5,'fuel-2-aft'),
  entry('FUEL_CENTER_L','Fuel CENTER L','FUEL','transfer1','AC',7,'fuel-center-l'),
  entry('FUEL_CENTER_R','Fuel CENTER R','FUEL','transfer2','AC',7,'fuel-center-r'),
  entry('HYD_ELEC_1','Hydraulic ELEC 1','HYDRAULIC','transfer1','AC',29,'hyd-elec-1'),
  entry('HYD_ELEC_2','Hydraulic ELEC 2','HYDRAULIC','transfer2','AC',29,'hyd-elec-2'),
  entry('WIN_L_FWD','Window L FWD heater','ANTI_ICE','generator1','AC',9,'window-l-fwd'),
  entry('WIN_L_SIDE','Window L SIDE heater','ANTI_ICE','generator2','AC',5,'window-l-side'),
  entry('WIN_R_FWD','Window R FWD heater','ANTI_ICE','generator2','AC',9,'window-r-fwd'),
  entry('WIN_R_SIDE','Window R SIDE heater','ANTI_ICE','generator1','AC',5,'window-r-side'),
  entry('PITOT_A','Pitot/static heat A','ANTI_ICE','transfer1','AC',7,'pitot-a'),
  entry('PITOT_B','Pitot/static heat B','ANTI_ICE','transfer2','AC',7,'pitot-b'),
  entry('EQUIP_COOL_SUP','Equipment cooling supply fan','AIR_COND','transfer1','AC',5.5),
  entry('EQUIP_COOL_EXH','Equipment cooling exhaust fan','AIR_COND','transfer2','AC',5.5),
  entry('RECIRC_FAN','Recirculation fan','AIR_COND','transfer1','AC',6.5,'recirc-fan',['AUTO','ON']),
  entry('PACK_L_CTL','PACK L electrical controls (bleed-air pack)','AIR_COND','dc1','DC',1.2,'pack-l',['AUTO','HIGH']),
  entry('PACK_R_CTL','PACK R electrical controls (bleed-air pack)','AIR_COND','dc2','DC',1.2,'pack-r',['AUTO','HIGH']),
  entry('BLEED_1_VALVE','Engine bleed 1 control','PNEUMATIC','dc1','DC',0.4,'bleed-eng-1'),
  entry('BLEED_2_VALVE','Engine bleed 2 control','PNEUMATIC','dc2','DC',0.4,'bleed-eng-2'),
  entry('BLEED_APU_VALVE','APU bleed valve control','PNEUMATIC','battery','DC',0.4,'bleed-apu'),
  entry('ENG_AI_1_VALVE','Engine anti-ice 1 valve controls','ANTI_ICE','dc1','DC',0.5,'engine-anti-ice-1'),
  entry('ENG_AI_2_VALVE','Engine anti-ice 2 valve controls','ANTI_ICE','dc2','DC',0.5,'engine-anti-ice-2'),
  entry('WING_AI_VALVE','Wing anti-ice valve controls','ANTI_ICE','dc1','DC',0.6,'wing-anti-ice'),
  entry('YAW_DAMPER','Yaw damper controls','FLIGHT_CONTROLS','dc1','DC',1.3,'yaw-damper'),
  entry('OUTFLOW_MAN','Manual outflow DC drive (moving)','PRESSURIZATION','dcStandby','DC',2.8,'outflow-manual',['OPEN','CLOSE']),
  entry('GALLEY_1','Galley heaters group L','GALLEY','main1','AC',29,'galley'),
  entry('GALLEY_2','Galley heaters group R','GALLEY','main2','AC',29,'galley'),
  entry('LANDING_L','Landing lights outboard L','LIGHTING','transfer1','AC',4,'landing-out-l',['ON','EXTEND']),
  entry('LANDING_R','Landing lights outboard R','LIGHTING','transfer2','AC',4,'landing-out-r',['ON','EXTEND']),
  entry('LANDING_IN_L','Landing light inboard L','LIGHTING','transfer1','AC',4,'landing-in-l'),
  entry('LANDING_IN_R','Landing light inboard R','LIGHTING','transfer2','AC',4,'landing-in-r'),
  entry('TAXI','Taxi light','LIGHTING','transfer1','AC',2.3,'taxi'),
  entry('TURNOFF_L','Runway turnoff L','LIGHTING','transfer1','AC',2,'runway-turnoff-l'),
  entry('TURNOFF_R','Runway turnoff R','LIGHTING','transfer2','AC',2,'runway-turnoff-r'),
  entry('LOGO','Logo lights','LIGHTING','transfer2','AC',2,'logo'),
  entry('STROBE','Strobes','LIGHTING','transfer2','AC',1.2,'strobe'),
  entry('BEACON','Anti-collision beacon','LIGHTING','transfer1','AC',1.4,'anti-collision'),
  entry('WING_LIGHTS','Wing illumination','LIGHTING','transfer1','AC',1.1,'wing-lights'),
  entry('WHEEL_WELL','Wheel-well illumination','LIGHTING','transfer2','AC',1.1,'wheel-well'),
  entry('SIGNS','Passenger signs','LIGHTING','dc1','DC',0.7,'fasten-belts',['ON','CREW']),
  entry('NO_SMOKING','No smoking signs','LIGHTING','dc2','DC',0.6,'no-smoking',['ON','AUTO'])
 ]);
 const WM=Object.freeze({'WIN_L_FWD':'L_FWD','WIN_L_SIDE':'L_SIDE','WIN_R_FWD':'R_FWD','WIN_R_SIDE':'R_SIDE'});
 const copy=v=>JSON.parse(JSON.stringify(v));
 const valid=n=>typeof n==='number'&&Number.isFinite(n);
 const round=n=>Math.round(n*100)/100;
 function project({electrical,toggles={},windowHeat=null,battery=null}={}){
  if(electrical?.schema!=='B737_ELECTRICAL_V7_RESULT')throw Error('Electrical V7 evaluated output required');
  if(!toggles||typeof toggles!=='object'||Array.isArray(toggles))throw Error('Overhead toggle map required');
  const bus=electrical.bus,feed=electrical.feed,source=electrical.source;
  const sourceAmps={GEN1:0,GEN2:0,APU:0,EXT:0},trAmps={TR1:0,TR2:0,TR3:0};
  function pathFor(name){
   if(['generator1','generator2','main1','main2','transfer1','transfer2'].includes(name)){
    const side=name.endsWith('1')?1:2;
    if(name.startsWith('transfer')){
     const parent=feed.transferSource[side];
     if(!parent)return null;
     return source[parent.endsWith('1')?1:2];
    }
    return source[side]||null;
   }
   if(name==='groundService')return source[1]||'EXT';
   if(name==='acStandby')return feed.standbyFeed==='TRANSFER1_DC1'?pathFor('transfer1'):'BATTERY_INVERTER';
   if(name==='dc1'||name==='dc2'){
    const side=name==='dc1'?1:2,primary='TR'+side,other='TR'+(3-side);
    return feed.tr[primary]?pathFor('transfer'+side):
     feed.tie&&feed.tr[other]?pathFor('transfer'+(3-side)):null;
   }
   if(name==='dcStandby')return feed.standbyFeed==='TRANSFER1_DC1'?pathFor('dc1'):'BATTERY';
   if(name==='battery'||name==='hotBattery'||name==='switchedHotBattery')
    return feed.tr.TR3&&feed.standbyFeed!=='BATTERY_SELECTOR'?pathFor('main2'):'BATTERY';
   return null;
  }
  function trFor(name){
   if(name==='dc1'||name==='dc2'){
    const side=name.endsWith('1')?1:2,primary='TR'+side,other='TR'+(3-side);
    return feed.tr[primary]?primary:feed.tie&&feed.tr[other]?other:null;
   }
   if(name==='battery')return feed.tr.TR3?'TR3':null;
   if(name==='dcStandby')return feed.standbyFeed==='TRANSFER1_DC1'?trFor('dc1'):feed.tr.TR3?'TR3':null;
   return null;
  }
  const records=[];
  for(const spec of CATALOG){
   const selection=spec.control===null?true:spec.states.includes(toggles[spec.control]);
   const thermostatic=WM[spec.id]&&windowHeat?.channels?
    windowHeat.channels[WM[spec.id]]?.heaterPower===true:true;
   const commanded=selection&&thermostatic&&!(spec.system==='GALLEY'&&electrical.galleyShed);
   const powered=bus[spec.bus]===true;
   const active=Boolean(commanded&&powered),suppliedFrom=active?pathFor(spec.bus):null;
   // If the V7 network cannot determine a path, DO NOT charge a fictional generator.
   const measured=active&&suppliedFrom!==null;
   const amps=measured?spec.amps:0;
   const tr=measured&&spec.kind==='DC'?trFor(spec.bus):null;
   if(tr)trAmps[tr]+=amps;
   const genEquivalent=spec.kind==='AC'?amps:
    // Three-phase 200V source, PF=0.82, rectification conversion eff=0.90.
    amps*28/(Math.sqrt(3)*200*0.82*0.90);
   if(measured&&Object.hasOwn(sourceAmps,suppliedFrom))sourceAmps[suppliedFrom]+=genEquivalent;
   records.push({id:spec.id,label:spec.label,system:spec.system,bus:spec.bus,
    unit:spec.kind==='AC'?'AC_GEN_EQUIV_A':'DC_28V_A',nominalA:spec.amps,
    commanded,energized:powered,active:measured,currentA:round(amps),
    source:measured?suppliedFrom:null,sourceEvidence:'ASSUMED_EQUIPMENT_BUS_FOR_TRAINING'});
  }
  // The installed battery dynamics engine owns BAT current and actual charge.
  // It already integrates standby, IRS, panel, inverter and APU starter loads.
  // This ledger must not simulate a second independent battery capacity.
  if(battery&&valid(battery.chargerA)&&feed.tr.TR3)trAmps.TR3+=battery.chargerA;
  if(battery&&valid(battery.chargerA)&&feed.tr.TR3){
   const chargingSource=pathFor('main2');
   if(chargingSource&&Object.hasOwn(sourceAmps,chargingSource))
    sourceAmps[chargingSource]+=battery.chargerA*28/(Math.sqrt(3)*200*0.82*0.90);
  }
  for(const key of Object.keys(sourceAmps))sourceAmps[key]=round(sourceAmps[key]);
  for(const key of Object.keys(trAmps))trAmps[key]=round(trAmps[key]);
  const sourceTotals={...sourceAmps};
  const sourceToBus={1:source[1],2:source[2]};
  return {schema:'b737-approx-electrical-demand/1',version:VERSION,loads:records,
   sourceAmps,sourceToBus,trAmps,
   batteryAmps:valid(battery?.ammeterA)?battery.ammeterA:null,
   chargingAmps:valid(battery?.chargerA)?battery.chargerA:null,
   totals:{sourceGenAmps:round(Object.values(sourceTotals).reduce((a,b)=>a+b,0)),
    acLoadCount:records.filter(x=>x.active&&x.unit==='AC_GEN_EQUIV_A').length,
    dcLoadCount:records.filter(x=>x.active&&x.unit==='DC_28V_A').length},
   quality:'APPROXIMATE_TRAINING_LOAD_ESTIMATES_NOT_AIRFRAME_WDM_OR_CERTIFIED_AMPS',
   notes:['No electrical source is created by this model','No assumed equipment feed is promoted to EP-FSI VERIFIED',
    'DC BAT meter remains the coulomb-counted battery measurement',
    'Window heater thermostats/CB faults use observed heaterPower when available',
    'AC values are equivalent three-phase generator ammeter currents, not 115V single-phase circuit current']};
 }
 return Object.freeze({VERSION,CATALOG,project});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/electrical-demand-estimate-v2.js?v=ATA24-LOAD-DYNAMICS-0002&amp;cb=CB-UNIFIED-0001 */
try{
/* ATA24-LOAD-DYNAMICS-0002: deterministic, bounded training estimates.
 * V7 owns power routing. V1 retains its legacy unit tests and catalog.
 * No assumed load/CB feed is claimed as a verified EP-FSI wiring value.
 * No change to lamps, panel art, needles, switches or physical detents.
 */
(function(root,factory){'use strict';
 const api=factory(typeof module==='object'&&module.exports?require('./electrical-demand-estimate-v1.js'):root.B737ElectricalDemandEstimateV1);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ElectricalDemandEstimateV2=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(Base){
 'use strict';
 if(!Base?.project||!Base.CATALOG)throw Error('ATA24 V1 model is required');
 const VERSION='ATA24-LOAD-DYNAMICS-0002';
 const AC_CONVERSION=28/(Math.sqrt(3)*200*0.82*0.90);
 const MOTOR_IDS=new Set(Base.CATALOG.filter(x=>x.system==='FUEL'||x.system==='HYDRAULIC'||
  x.id==='EQUIP_COOL_SUP'||x.id==='EQUIP_COOL_EXH'||x.id==='RECIRC_FAN').map(x=>x.id));
 const HEAT_IDS=new Set(['WIN_L_FWD','WIN_L_SIDE','WIN_R_FWD','WIN_R_SIDE']);
 const round=n=>Math.round(n*100)/100;
 const clip=(n,a,b)=>Math.max(a,Math.min(b,n));
 function fraction(value,fallback,label){
  if(value==null)return fallback;
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1)
   throw Error(label+' must be a finite fraction 0..1');
  return value;
 }
 function project(input={}){
  const base=Base.project(input),loads=[];
  const galleyDuty=fraction(input.galleyDuty,0,'Galley appliance demand');
  const hydraulicDuty=fraction(input.hydraulicDuty,0.35,'Hydraulic pressure demand');
  const fallbackWindowDuty=fraction(input.fallbackWindowDuty,0.55,'Window heater training duty');
  const latched=input.galleyShedLatched===true;
  const runSeconds=input.motorRunSeconds||{};
  const sourceAmps={GEN1:0,GEN2:0,APU:0,EXT:0},trAmps={TR1:0,TR2:0,TR3:0};
  for(const old of base.loads){
   let factor=1,reason='NOMINAL_TRAINING_RUNNING';
   if(old.system==='GALLEY'){
    factor=latched?0:galleyDuty;
    reason=latched?'GALLEY_SHED_SIMULATION':galleyDuty?'APPLIANCE_DUTY_TRAINING':'POWER_ON_APPLIANCES_IDLE';
   }else if(old.system==='HYDRAULIC'){
    // A running variable-delivery pump does not consume rated full-flow power
    // indefinitely. Without a real hydraulic demand signal use a mid/low state.
    factor=.60+.40*hydraulicDuty;
    reason='VARIABLE_DELIVERY_PUMP_TRAINING';
   }else if(HEAT_IDS.has(old.id)&&!input.windowHeat?.channels){
    // A selected thermostatic heater need not draw full current continuously.
    factor=fallbackWindowDuty;reason='THERMOSTAT_DUTY_ESTIMATE';
   }
   if(MOTOR_IDS.has(old.id)&&old.active){
    const t=runSeconds[old.id];
    if(t!==undefined&&(typeof t!=='number'||!Number.isFinite(t)||t<0))
     throw Error('Invalid motor run seconds: '+old.id);
    if(Number.isFinite(t)&&t<2){
     // Short motor inrush, smoothly decaying to its running load.
     const transient=1+.55*(1-t/2);
     factor*=transient;
     reason+='+START_TRANSIENT';
    }
   }
   const circuits={FUEL_1_FWD:'fuel.main1FwdPump',FUEL_1_AFT:'fuel.main1AftPump',FUEL_2_FWD:'fuel.main2FwdPump',FUEL_2_AFT:'fuel.main2AftPump',FUEL_CENTER_L:'fuel.centerLeftPump',FUEL_CENTER_R:'fuel.centerRightPump',HYD_ELEC_1:'hyd.electricPumpB',HYD_ELEC_2:'hyd.electricPumpA',RECIRC_FAN:'air.recirc',PACK_L_CTL:'air.packL',PACK_R_CTL:'air.packR',FMC_L:'fmc.FMC1',FMC_R:'fmc.FMC2',EQUIP_COOL_SUP:'cooling.control',EQUIP_COOL_EXH:'cooling.control'};
   if(circuits[old.id]&&globalThis.B737UnifiedCB?.available(circuits[old.id])===false){factor=0;reason='PROTECTED_CIRCUIT_CB_OPEN';}
   const amps=old.active?round(old.nominalA*factor):0;
   const active=old.active&&amps>0;
   const row={...old,active,currentA:amps,source:active?old.source:null,
    dutyFactor:round(factor),demandModel:reason};
   loads.push(row);
   if(!active||!row.source||!Object.hasOwn(sourceAmps,row.source))continue;
   sourceAmps[row.source]+=row.unit==='AC_GEN_EQUIV_A'?amps:amps*AC_CONVERSION;
   if(row.unit==='DC_28V_A'){
    // Keep V1's TR assignment as the authoritative electrical routing owner.
    const original=Base.CATALOG.find(x=>x.id===row.id);
    const b=original?.bus;
    const e=input.electrical;
    const feed=e?.feed;
    let tr=null;
    if(b==='dc1'||b==='dc2'){
     const side=b==='dc1'?1:2,main='TR'+side,other='TR'+(3-side);
     tr=feed.tr[main]?main:feed.tie&&feed.tr[other]?other:null;
    }else if(b==='battery')tr=feed.tr.TR3?'TR3':null;
    else if(b==='dcStandby')tr=feed.standbyFeed==='TRANSFER1_DC1'?
      (feed.tr.TR1?'TR1':feed.tie&&feed.tr.TR2?'TR2':null):feed.tr.TR3?'TR3':null;
    if(tr)trAmps[tr]+=amps;
   }
  }
  const bat=input.battery;
  if(bat&&Number.isFinite(bat.chargerA)&&input.electrical.feed.tr.TR3){
   trAmps.TR3+=bat.chargerA;
   const chargingSource=input.electrical.source[2];
   if(chargingSource&&Object.hasOwn(sourceAmps,chargingSource))
    sourceAmps[chargingSource]+=bat.chargerA*AC_CONVERSION;
  }
  for(const key of Object.keys(sourceAmps))sourceAmps[key]=round(sourceAmps[key]);
  for(const key of Object.keys(trAmps))trAmps[key]=round(trAmps[key]);
  const apuLimitA=input.onGround===false?125:150;
  const apuAmps=sourceAmps.APU;
  const needsGalleyShed=apuAmps>162&&galleyDuty>0&&input.toggles?.galley==='ON'&&!latched;
  return {...base,version:VERSION,loads,sourceAmps,trAmps,
   totals:{...base.totals,sourceGenAmps:round(Object.values(sourceAmps).reduce((a,b)=>a+b,0)),
    acLoadCount:loads.filter(x=>x.active&&x.unit==='AC_GEN_EQUIV_A').length,
    dcLoadCount:loads.filter(x=>x.active&&x.unit==='DC_28V_A').length},
   apu:{amps:apuAmps,limitA:apuLimitA,overLimit:apuAmps>apuLimitA,
    needsGalleyShed,galleyShedLatched:latched,
    loadPct:round(100*apuAmps/apuLimitA),onGround:input.onGround!==false,
    quality:'LIMIT_TRAINING_REFERENCE_REQUIRES_AIRFRAME_EFFECTIVITY'},
   systemAmps:Object.fromEntries([...new Set(loads.map(x=>x.system))].map(system=>
    [system,round(loads.filter(x=>x.system===system&&x.active)
     .reduce((sum,x)=>sum+(x.unit==='AC_GEN_EQUIV_A'?x.currentA:x.currentA*AC_CONVERSION),0))])),
   quality:'APPROXIMATE_DYNAMIC_LOADS_NOT_AIRFRAME_WDM_OR_CERTIFIED_AMPS',
   notes:[...base.notes,'Galley power ON only energizes outlets; appliances start with zero simulated demand',
    'Hydraulic variable-displacement pump has a part-load running state and motor start transient',
    'APU >162A galley shed only if installed training option is enabled',
    'APU 125A flight/150A ground reference is not a forced ammeter cap']};
 }
 return Object.freeze({VERSION,CATALOG:Base.CATALOG,MOTOR_IDS,project});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./electrical-demand-live-unified-v1.js?v=ATA24-APU-ZERO-0002 */
try{
/* Non-invasive live ATA24 load adapter. Existing panel selector/needle geometry
 * stays untouched: only official public setAmps/setSourceMeasurement APIs are used.
 * Unified ECU Electrical V7 is the only power-state owner.
 */
(function(root){
 'use strict';
 const Engine=root.B737ElectricalDemandEstimateV2||root.B737ElectricalDemandEstimateV1;
 if(!Engine)return;
 const owner=()=>root.B737ISNCockpitV1;
 let latest=null,signature='',panel=null,body=null,head=null,summary=null;
 let galleyDuty=0,hydraulicDuty=.35,galleyShedLatched=false,galleyShedEnabled=true;
 const motorBegan=new Map();

 const pretty=n=>Number.isFinite(n)?n.toFixed(1):'—';
 const safe=fn=>{try{return fn();}catch(error){console.warn('ATA24 load meter:',error);return null;}};
 const clone=v=>JSON.parse(JSON.stringify(v));
 function inputs(){
  const cockpit=owner();
  if(!cockpit?.getElectricalState||!cockpit?.getState)return null;
  const frame=document.getElementById('overheadFrame');
  let toggles={};
  try{toggles=frame?.contentWindow?.B737OverheadToggles?.getState?.()||{};}catch{}
  const windowHeat=root.B737WindowHeatUnifiedV1?.getOutput?.()||null;
  return {electrical:cockpit.getState().state.electrical,
   toggles,windowHeat,battery:cockpit.getLiveBattery?.()||root.B737InstalledBattery?.snapshot?.()||null,
   onGround:cockpit.getElectricalState?.()?.config?.onGround!==false};
 }
 function selectedMeterReadings(result){
  const electrical=root.B737UnifiedElectricalLive?.snapshot?.();
  const selectors=root.B737UnifiedAcDcSelectors;
  if(!electrical||!selectors)return;
  const battery=result.batteryAmps,dc=electrical.meterSources.DC;
  for(const id of ['TR1','TR2','TR3']){
   const powered=electrical.nodes[id].powered;
   const measurement={volts:dc[id].volts,amps:powered===true?result.trAmps[id]:powered===false?0:null};
   selectors.setSourceMeasurement('DC',id,measurement);
  }
  selectors.setSourceMeasurement('DC','BAT',{volts:dc.BAT.volts,amps:battery});
  // All other selector positions remain controlled by the original network.
 }
 function driveAmmeters(result){
  const needles=root.B737UnifiedDriveAmpsNeedles;
  if(!needles)return;
  const source=result.sourceAmps;
  const assigned=result.sourceToBus;
  const gen1=assigned[1]==='GEN1'?source.GEN1:0;
  const gen2=assigned[2]==='GEN2'?source.GEN2:0;
  needles.setAmps('acAmps1',Math.max(0,Math.min(200,gen1)));
  needles.setAmps('acAmps2',Math.max(0,Math.min(200,gen2)));
  // Meter zeros whenever the APU generator is not READY and really
  // connected to an energized V7 bus. Selected/last APU switch != load.
  const apuGenerator=owner()?.getECUState?.()?.apu?.generator;
  const liveAPU=apuGenerator?.ready===true&&Object.values(assigned).includes('APU')&&
    (apuGenerator.connectedBusSides?.length??0)>0;
  const amps=liveAPU&&Number.isFinite(source.APU)?Math.max(0,Math.min(200,source.APU)):0;
  const model=root.B737DriveAmpsNeedleModel;
  if(model?.bearingForApuAmps)needles.setAngle('apuAcAmps',model.bearingForApuAmps(amps));
 }
 function mount(){
  const host=document.getElementById('electricalLivePanel')||document.getElementById('isnBridgePanel');
  if(!host)return;
  if(panel?.isConnected)return;
  panel=document.createElement('details');panel.id='liveLoadLedgerV1';panel.dir='ltr';
  panel.style.cssText='margin:12px 0;padding:9px;border:1px solid #526f7b;border-radius:7px;font:12px/1.45 system-ui;color:#dce8ea';
  const heading=document.createElement('summary');heading.textContent='ATA 24 · Estimated Live System Loads / AC & DC LOAD';heading.style.cursor='pointer';
  head=document.createElement('p');head.style.cssText='font:600 13px/1.7 monospace;white-space:normal';panel.append(heading,head);
  summary=document.createElement('p');summary.style.cssText='font-size:11px;color:#edc87b';
  summary.textContent='Values are approximate training estimates. EP-FSI bus assignments are not WDM verified. AC amperes represent generator gauge equivalents; DC amperes are at 28 V. Do not sum AC and DC currents directly.';
  panel.append(summary);
  const demand=document.createElement('div');demand.style.cssText='display:grid;gap:7px;margin:7px 0';
  const addDemandSlider=(name,initial,onValue)=>{
   const label=document.createElement('label');label.style.cssText='display:grid;gap:4px';
   const title=document.createElement('span');title.textContent=name+' · '+Math.round(initial*100)+'%';
   const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.step='5';
   slider.value=String(Math.round(initial*100));slider.addEventListener('input',()=>{
    const duty=Number(slider.value)/100;title.textContent=name+' · '+slider.value+'%';
    onValue(duty);tick(true);
   });label.append(title,slider);demand.append(label);
  };
  addDemandSlider('GALLEY APPLIANCES (not galley-power switch)',galleyDuty,v=>{galleyDuty=v;});
  addDemandSlider('HYDRAULIC ELECTRIC-PUMP DEMAND',hydraulicDuty,v=>{hydraulicDuty=v;});
  const shed=document.createElement('label');shed.style.cssText='display:flex;gap:7px;align-items:center';
  const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=galleyShedEnabled;
  enabled.addEventListener('change',()=>{galleyShedEnabled=enabled.checked;tick(true);});
  shed.append(enabled,document.createTextNode('Classic APU galley auto-shed training option (162 A; airframe effectivity unverified)'));
  demand.append(shed);panel.append(demand);
  const scroll=document.createElement('div');scroll.style.cssText='overflow:auto;max-height:350px';
  const table=document.createElement('table');table.style.cssText='border-collapse:collapse;width:100%;font:11px monospace';
  const th=document.createElement('thead');const row=document.createElement('tr');
  for(const label of ['SYSTEM','BUS','SOURCE','STATUS','MODEL A']){
   const cell=document.createElement('th');cell.textContent=label;cell.style.cssText='text-align:left;padding:4px;border-bottom:1px solid #536c73';row.append(cell);
  }
  th.append(row);table.append(th);
  body=document.createElement('tbody');table.append(body);scroll.append(table);panel.append(scroll);
  host.append(panel);
  // A hidden instructor ledger is not aircraft instrumentation. On opening,
  // show the latest already-computed power estimate without a new ECU tick.
  panel.addEventListener('toggle',()=>{if(panel.open&&latest)paint(latest);});
 }
 function paint(result){
  mount();if(!panel||!document.body.classList.contains('side-open'))return;
  head.textContent='GEN 1 '+pretty(result.sourceAmps.GEN1)+' A  ·  GEN 2 '+pretty(result.sourceAmps.GEN2)+
   ' A  ·  APU '+pretty(result.sourceAmps.APU)+' A  ·  GPU '+pretty(result.sourceAmps.EXT)+
   ' A  |  TR1 '+pretty(result.trAmps.TR1)+' A  TR2 '+pretty(result.trAmps.TR2)+
   ' A  TR3 '+pretty(result.trAmps.TR3)+' A  |  BAT '+(result.batteryAmps===null?'—':(result.batteryAmps>0?'+':'')+pretty(result.batteryAmps))+' A'+
   (result.apu?'  |  APU TRAINING LIMIT '+result.apu.limitA+' A'+
    (result.apu.overLimit?' · OVER LIMIT':'')+
    (result.apu.galleyShedLatched?' · GALLEY LOAD SHED':''):'');
  summary.textContent='Estimator: training-only amperes, not verified EP-FSI WDM. GALLEY POWER ON does not mean appliances heating. Pumps respond to start/steady-state and demand; heater thermostat controls window consumption. APU current beyond the physical 200 A scale is still reported above (not silently discarded).';
  if(!panel.open)return;
  body.replaceChildren();
  for(const item of result.loads){
   const tr=document.createElement('tr');
   const status=item.active?'DRAWING':item.commanded?item.energized===null?'UNKNOWN':item.energized===true?'IDLE / SHED':'NO POWER':'OFF';
   const values=[item.label,item.bus,item.source||'—',status,item.active?pretty(item.currentA):'0.0'];
   for(const value of values){
    const td=document.createElement('td');td.textContent=value;
    td.style.cssText='border-bottom:1px solid #314853;padding:3px 5px;white-space:nowrap';
    if(value===status)td.style.color=status==='DRAWING'?'#a4dfb4':status==='UNKNOWN'?'#edc87b':'#a2aeb4';
    tr.append(td);
   }
   body.append(tr);
  }
 }
 function tick(force=false){
  const input=safe(inputs);if(!input)return;
  if(input.toggles.galley==='OFF')galleyShedLatched=false;
  const now=Date.now();
  const sig=JSON.stringify([input.electrical.revision,input.electrical.source,input.electrical.bus,
   input.toggles,input.windowHeat?.channels&&Object.fromEntries(Object.entries(input.windowHeat.channels).map(([k,v])=>[k,v.heaterPower])),
   input.battery?.ammeterA,input.battery?.chargerA,input.onGround,
   galleyDuty,hydraulicDuty,galleyShedLatched,galleyShedEnabled,
   owner()?.getECUState?.()?.apu?.generator?.ready===true]);
  const ramping=[...motorBegan.values()].some(start=>now-start<2600);
  if(!force&&sig===signature&&!ramping){
   // QA controls must never leave a stale manual full-scale needle.
   if(latest)safe(()=>driveAmmeters(latest));
   return;
  }
  const baseArgs={...input,galleyDuty,hydraulicDuty,galleyShedLatched};
  const preview=safe(()=>Engine.project(baseArgs));if(!preview)return;
  const motorRunSeconds={};
  if(Engine.MOTOR_IDS){
   for(const row of preview.loads){
    if(!Engine.MOTOR_IDS.has(row.id))continue;
    if(row.active){
     if(!motorBegan.has(row.id))motorBegan.set(row.id,now);
     motorRunSeconds[row.id]=Math.max(0,(now-motorBegan.get(row.id))/1000);
    }else motorBegan.delete(row.id);
   }
  }
  let estimate=safe(()=>Engine.project({...baseArgs,motorRunSeconds}));if(!estimate)return;
  if(galleyShedEnabled&&estimate.apu?.needsGalleyShed){
   // Installed options differ by airframe; simulate the electrical relay,
   // not an unauthorized movement of the photographed GALLEY switch.
   galleyShedLatched=true;
   estimate=safe(()=>Engine.project({...baseArgs,galleyShedLatched:true,motorRunSeconds}));
   if(!estimate)return;
  }
  signature=sig;latest=estimate;
  safe(()=>driveAmmeters(estimate));
  safe(()=>selectedMeterReadings(estimate));
  paint(estimate);
  root.dispatchEvent(new CustomEvent('b737:electrical-demand-estimate',{detail:clone(estimate)}));
 }

 const events=['b737:electrical-network','b737:electrical-owner-ready','b737:unified-ecu-observation',
  'b737:battery-live','b737:ac-dc-selector-change','b737:cockpit-mounted'];
 for(const name of events)root.addEventListener(name,()=>{
  const profiler=name==='b737:unified-ecu-observation'?root.B737InteractionProfilerV1:null;
  const started=profiler?performance.now():0;
  try{tick(name==='b737:electrical-network'||name==='b737:ac-dc-selector-change'||name==='b737:cockpit-mounted');}
  finally{if(profiler)profiler.markWork('ECU listener ATA24 demand',performance.now()-started);}
 });
 document.getElementById('inspectorToggle')?.addEventListener('click',()=>{
  setTimeout(()=>{if(document.body.classList.contains('side-open')&&latest)paint(latest);},0);
 });
 root.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==document.getElementById('overheadFrame')?.contentWindow)return;
  if(event.data?.type==='b737:cockpit-overhead'&&['controls-state','control-event'].includes(event.data.kind))tick(true);
 });
 const api=Object.freeze({version:Engine.VERSION,snapshot:()=>latest?clone(latest):null,refresh:()=>tick(true),
  trainingControls:()=>({galleyDuty,hydraulicDuty,galleyShedEnabled,galleyShedLatched})});
 root.B737UnifiedLoadMeterV1=api;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>tick(true),{once:true});else tick(true);
 setInterval(()=>tick(),350);
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./apu-live-meter-unified-v1.js?v=APU-EGT-COLDZERO3 */
try{
/* Single-owner, non-visual APU EGT instrument link. Source: Unified ISN ECU.
 * Never changes owner-approved EGT dial, needle sprite, center or switches.
 */
(function(root){
 'use strict';
 // The actual OH12 photographed EGT instrument is numbered 0..8 (°C×100),
 // clockwise from the lower-right zero tick circled in the owner's image,
 // past 1..8 to the upper arc; NOT 0..1000°C.
 // Graduations were measured against the owner screenshot: (dial centre
 // 396,796 px; numbered label centres 1:(510,975), 2:(410,1008),
 // 3:(306,981), 4:(230,896), 5:(208,795), 6:(231,697),
 // 7:(306,630), 8:(399,589)). Unprinted 0 is extrapolated from 1/2.
 // The continuous, unwrapped CSS angles prevent discontinuities at 360°.
 // Values are photo-derived TRAINING calibration, not shaft certification.
 const EGT_C=[0,100,200,300,400,500,600,700,800];
 const EGT_DEG=[-241.5,-212.5,-183.8,-154.1,-121.1,-89.7,-59,-28.5,0.8];
 const MAX_C=800;
 let latest=null;
 const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
 function bearingForEGT(c){
  if(typeof c!=='number'||!Number.isFinite(c))throw Error('APU EGT must be finite °C');
  const v=clamp(c,0,MAX_C),major=v/100;
  if(Number.isInteger(major))return EGT_DEG[major]; // exact labelled tick
  const i=Math.min(7,Math.floor(major));
  return EGT_DEG[i]+(EGT_DEG[i+1]-EGT_DEG[i])*(v-EGT_C[i])/100;
 }
 function project(apu){
  if(!apu||!Number.isFinite(apu.egtC))return null;
  // Fresh cold/dark must sit precisely at the printed zero, while actual
  // post-shutdown residual heat is preserved and cools gradually through 50°C.
  const indicatedC=apu.phase==='OFF'&&apu.egtC<=0.05?0:apu.egtC;
  return {phase:apu.phase,egtC:indicatedC,angleDeg:bearingForEGT(indicatedC),
   rpmPct:apu.rpmPct,generatorReady:apu.generator?.ready===true,
   voltsV:apu.generator?.voltageV??0,frequencyHz:apu.generator?.frequencyHz??0,
   sourceAmpsA:apu.generator?.currentEstimatedA??0,
   fuel:apu.fuelPath||null,quality:'APU_EGT_OH12_PHOTO_GRADUATIONS_0_TO_8_X100_TRAINING'};
 }
 function paint(apu){
  const reading=project(apu);if(!reading)return false;
  latest=reading;
  const needle=root.B737UnifiedApuEgtNeedle;
  if(!needle?.setAngle)return false;
  needle.setAngle(reading.angleDeg);return true;
 }
 root.addEventListener('b737:unified-ecu-observation',event=>paint(event.detail?.apu));
 root.addEventListener('b737:electrical-owner-ready',()=>{
  paint(root.B737ISNCockpitV1?.getECUState?.()?.apu);
 });
 root.addEventListener('b737:cockpit-mounted',()=>{
  paint(latest||root.B737ISNCockpitV1?.getECUState?.()?.apu);
 });
 root.B737APULiveMetersV1=Object.freeze({bearingForEGT,EGT_C:Object.freeze(EGT_C),EGT_DEG:Object.freeze(EGT_DEG),project,
  snapshot:()=>latest?JSON.parse(JSON.stringify(latest)):null,refresh:()=>paint(root.B737ISNCockpitV1?.getECUState?.()?.apu)});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./navdata-public-connect-v1.js?v=PUBLIC-NAV-2610-0001 */
try{
/* Opt-in public Unified access to owner's localhost NAVDATA; token never stored. */
(function(root){
'use strict';
const BASE='http://127.0.0.1:8767',DOMAIN='mahmet737ng-gif.github.io';
let token='',connected=false;
root.B737NavBridgeV1=Object.freeze({
 isConnected:()=>connected&&!!token,
 async request(path,options){
  if(!connected||!token)throw Error('PRIVATE NAV DATA DISCONNECTED');
  if(typeof path!=='string'||!/^\/api\/stage6\/(navdata|catalog)\?/.test(path)||
    (options?.method&&options.method.toUpperCase()!=='GET'))
   throw Error('READ ONLY LOOKUP REQUIRED');
  return fetch(BASE+path,{method:'GET',mode:'cors',cache:'no-store',
   credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',
   targetAddressSpace:'loopback',
   headers:{'X-B737-Nav-Token':token}});
 }
});
const el=x=>document.getElementById(x),frames=()=>[...document.querySelectorAll('iframe.cdu-frame')];
function broadcast(name){for(const frame of frames())try{frame.contentWindow?.[name]?.()}catch(_){}}
function status(message,ok=false){
 const output=el('privateNavStatus');if(output)output.textContent=message;
 const b=el('privateNavConnect'),d=el('privateNavDisconnect');
 if(b)b.disabled=ok;if(d)d.disabled=!ok;
}
function disconnect(){connected=false;token='';broadcast('B737CDUDetachPublicNavDataV1');status('Private: Disconnected · Standard CDU Mode');}
async function connect(){
 const input=el('privateNavToken'),submitted=String(input?.value||'').trim();
 if(input)input.value='';
 if(root.location.hostname!==DOMAIN||submitted.length<24||submitted.length>256){
  status('Invalid trusted origin or connection token');return;
 }
 el('privateNavConnect').disabled=true;status('Checking Local Service…');
 try{
  const r=await fetch(BASE+'/api/navdata/status',{
   method:'GET',mode:'cors',cache:'no-store',credentials:'omit',
   referrerPolicy:'no-referrer',redirect:'error',
   targetAddressSpace:'loopback',headers:{'X-B737-Nav-Token':submitted}});
  if(!r.ok)throw Error('TOKEN_REJECTED');
  const x=await r.json();
  if(x.status!=='CONNECTED_READ_ONLY'||x.airac!=='2610'||
     x.fmc_executable!==false||x.public_source_hosted!==false)
   throw Error('INVALID_LOCAL_BRIDGE');
  token=submitted;connected=true;
  status('Connected · PRIVATE AIRAC 2610 · Read Only',true);
  broadcast('B737CDUAttachPublicNavDataV1');
 }catch(_){
  disconnect();status('Connection failed: check local service, token and browser permissions');
 }finally{el('privateNavConnect').disabled=connected;}
}
function init(){
 const sidebar=document.querySelector('section.cdu-tools');
 if(!sidebar||el('privateNavConnect'))return;
 const wrap=document.createElement('section');wrap.className='private-nav-bridge';
 wrap.style.cssText='margin-top:12px;padding:12px;border:1px solid #456070;border-radius:8px;display:grid;gap:8px';
 const title=document.createElement('strong');title.textContent='Private NAV DATA · AIRAC 2610';
 const help=document.createElement('small');help.textContent='Private navigation data remains on this computer. Enter the local service token.';
 const input=document.createElement('input');input.id='privateNavToken';input.type='password';
 input.autocomplete='off';input.dir='ltr';input.placeholder='One-time connection token';
 input.setAttribute('aria-label','Private NAVDATA token');
 const b=document.createElement('button');b.id='privateNavConnect';b.type='button';b.textContent='Connect Private NAV DATA';
 const d=document.createElement('button');d.id='privateNavDisconnect';d.type='button';d.textContent='Disconnect';d.disabled=true;
 const info=document.createElement('p');info.id='privateNavStatus';info.setAttribute('role','status');
 info.textContent='Private: Disconnected · Optional';info.style.margin='0';
 wrap.append(title,help,input,b,d,info);sidebar.append(wrap);
 b.addEventListener('click',connect);d.addEventListener('click',disconnect);
 for(const frame of frames())frame.addEventListener('load',()=>{
  if(connected)try{frame.contentWindow?.B737CDUAttachPublicNavDataV1?.()}catch(_){}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./cdu-sg-public-connect-v1.js?v=CDU-SG-LEG-AST-20261117-0001 */
try{
/* Unified CDU data reads use the local bank after installation. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)api.mount(root);
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const CYCLE='UNSPECIFIED_IN_UPLOADED_FILES', KEY='b737.unified.cduCatalog.v1';
 const AUTO_OFF=KEY+'.autoInstallOff';
 const AIRPORTS=['OIII','OIMM','OISS'], KINDS=['SID','STAR','APP'];
 function createCatalog(data){
  if(data?.schema!=='CDU_SG_CATALOG_V1'||data.source_cycle!==CYCLE||
     data.fmc_executable!==false||data.reference_only!==true)throw Error('INVALID NAV DATA');
  for(const icao of AIRPORTS){
   const a=data.airports?.[icao];
   if(a?.airport?.icao!==icao||!Array.isArray(a.airport.runways)||!Array.isArray(a.airport.published_runways)||
      !KINDS.every(k=>Array.isArray(a.catalogs?.[k]?.items)&&Array.isArray(a.procedures?.[k])))
    throw Error('INCOMPLETE NAV DATA');
  }
  function events(part){
   if(!Array.isArray(part.commands)||!Array.isArray(part.refs)||!Number.isInteger(part.source_line))
    throw Error('PROCEDURE SOURCE INCOMPLETE');
   const fixes=part.refs.filter(ref=>ref.kind==='FIX');
   let idx=0;
   return part.commands.map(cmd=>{
    if(cmd.kind==='SPEED')return {kind:'SPEED_TOKEN'};
    if(cmd.kind==='AT'&&/^(?:OR (?:ABOVE|BELOW) )?\d{3,5}$/.test(cmd.value))
     return {kind:'ALTITUDE_CONSTRAINT'};
    if(cmd.kind==='TRK'&&/^\d{1,3}$/.test(cmd.value)&&Number(cmd.value)<360)
     return {kind:'TRK',values:{degrees:Number(cmd.value)},sourceCommand:cmd.raw_text};
    if(cmd.kind==='UNTIL'&&/^\d{3,5}$/.test(cmd.value))
     return {kind:'UNTIL',values:{altitudeFt:Number(cmd.value)},sourceCommand:cmd.raw_text};
    if(cmd.kind==='TURN'&&['LEFT','RIGHT'].includes(cmd.value))
     return {kind:'TURN',values:{direction:cmd.value},sourceCommand:cmd.raw_text};
    if(cmd.kind==='DIRECT')return {kind:'DIRECT',values:{},sourceCommand:cmd.raw_text};
    if(cmd.kind!=='FIX')return {kind:String(cmd.kind||'UNKNOWN')};
    const ident=String(cmd.value||'').trim().replace(/^OVERFLY\s+/,'');
    const ref=fixes[idx++];
    if(ref?.ident!==ident||ref.source_resolution!=='LOCAL_AIRPORT_FIX'||
       !['ROUTE_POINT','DIRECT_FIX'].includes(ref.role)||!Number.isFinite(ref.lat)||!Number.isFinite(ref.lon))
     return {kind:'UNRESOLVED_FIX',values:{ident}};
    return {kind:'FIX_PASSAGE',values:{ident:ref.ident},reference_status:'LOCAL_FIX_COORDINATE_VERIFIED',
     fix:{ident:ref.ident,lat:ref.lat,lon:ref.lon}};
   });
  }
  function request(path){
   if(typeof path!=='string'||path.length>420||!/^\/api\/cdu\/(airport|catalog|procedure)\?[^#]+$/.test(path))
    throw Error('INVALID NAV DATA QUERY');
   const url=new URL(path,'https://localhost'),get=name=>url.searchParams.get(name);
   const icao=get('icao')||get('airport'),a=AIRPORTS.includes(icao)?data.airports[icao]:null;
   if(!a)throw Error('AIRPORT NOT IN NAV DATA');
   if(url.pathname.endsWith('/airport'))return a.airport;
   const kind=get('kind');
   if(!KINDS.includes(kind))throw Error('INVALID PROCEDURE KIND');
   if(url.pathname.endsWith('/catalog'))return a.catalogs[kind];
   const procedure=a.procedures[kind].find(p=>p.ident===get('ident'));
   if(!procedure||procedure.fmc_executable!==false)throw Error('PROCEDURE NOT IN NAV DATA');
   const runway=get('runway'),transition=get('transition');
   if((procedure.requires_runway_selection&&!runway)||(procedure.requires_transition_selection&&!transition)||
      (runway&&!procedure.runway_options.includes(runway))||
      (transition&&!procedure.transition_options.includes(transition)))throw Error('SELECT PUBLISHED VARIANT');
   const variant=procedure.variants.filter(p=>p.runway===runway);
   const base=variant.length?variant:procedure.variants.filter(p=>!p.runway);
   const trans=transition?procedure.transitions.filter(p=>p.ident===transition):[];
   if(!base.length||(transition&&!trans.length))throw Error('PROCEDURE SOURCE INCOMPLETE');
   const parts=kind==='SID'?[...base,...trans]:[...trans,...base];
   return {airport:icao,kind,ident:procedure.ident,fmc_executable:false,
    requires_runway_selection:procedure.requires_runway_selection,
    requires_transition_selection:procedure.requires_transition_selection,
    runway_options:procedure.runway_options,transition_options:procedure.transition_options,
    segments:parts.map(part=>({source_line:part.source_line,events:events(part)}))};
  }
  return Object.freeze({request});
 }
 function mount(root){
  const doc=root.document,$=id=>doc.getElementById(id);
  const frames=()=>[...doc.querySelectorAll('iframe.cdu-frame')];
  let catalog=null,attempt=0;
  const storage={
   read(key){try{return root.localStorage.getItem(key);}catch(_){return null;}},
   save(key,value){try{root.localStorage.setItem(key,value);return true;}catch(_){return false;}},
   remove(key){try{root.localStorage.removeItem(key);}catch(_){}}
  };
  function announce(action){
   for(const f of frames())try{f.contentWindow?.[action]?.()}catch(_){}
  }
  function status(message){
   const label=$('cduSgPrivateStatus');if(label)label.textContent=message;
   const remove=$('cduSgPrivateDisconnect');if(remove)remove.disabled=!catalog;
  }
  root.B737CduSgBridgeV1=Object.freeze({
   isConnected:()=>!!catalog,source:'UNIFIED_LOCAL_NAVDATA',
   async request(path){
    if(!catalog)throw Error('NAV DATA UNAVAILABLE');
    if(typeof path==='string'&&/^\/api\/cdu\/airway-check\?[^#]{1,250}$/.test(path))
     return root.fetch(path,{credentials:'same-origin',cache:'no-store',redirect:'error',
      headers:{Accept:'application/json'}});
    try{const body=catalog.request(path);return {ok:true,json:async()=>body};}
    catch(err){return {ok:false,json:async()=>({error:err.message})};}
   }
  });
  function install(text){
   const next=createCatalog(JSON.parse(text));
   if(catalog){
    root.B737CduSgRouteV1?.setConnected(false);
    announce('B737CDUDetachCduSgV1');
   }
   catalog=next;root.B737CduSgRouteV1?.setConnected(true);
   announce('B737CDUAttachCduSgV1');
  }
  function save(raw){
   install(raw);
   status(storage.save(KEY,raw)?'OIII, OIMM and OISS reference bank is active.':
    'Bank is active but browser persistence is unavailable.');
  }
  async function seedFromPage(path){
   if(!/^\/[a-zA-Z0-9][a-zA-Z0-9/_-]*$/.test(path||''))return;
   const current=++attempt;
   status('Loading Installed Unified Reference Bank…');
   try{
    const response=await root.fetch(path,{credentials:'same-origin',mode:'same-origin',
     cache:'no-store',redirect:'error',headers:{Accept:'application/json','X-Unified-Navdata':'local-reference'}});
    if(!response.ok)throw Error('NAV DATA UNAVAILABLE');
    const raw=await response.text();
    if(current!==attempt)return;
    if(raw.length>2_900_000)throw Error('INVALID NAV DATA');
    save(raw);
   }catch(_){
    if(current===attempt)status('Installed reference bank unavailable. Select CDU_3_AIRPORTS.json.');
   }
  }
  function init(){
   const panel=doc.querySelector('section.cdu-tools');
   if(!panel||$('cduSgPrivateStatus'))return;
   const section=doc.createElement('section');section.className='private-nav-bridge';
   const title=doc.createElement('strong');title.textContent='CDU / SG · NAV DATA';
   const file=doc.createElement('input');file.type='file';file.accept='.json,application/json';
   file.id='cduSgPrivateFile';
   file.setAttribute('aria-label','Import CDU_3_AIRPORTS.json');
   const remove=doc.createElement('button');remove.type='button';remove.id='cduSgPrivateDisconnect';
   remove.textContent='Remove Local Bank';
   const label=doc.createElement('p');label.id='cduSgPrivateStatus';label.setAttribute('role','status');
   section.append(title,file,remove,label);panel.append(section);
   const seed=doc.querySelector('meta[name="unified-navdata-seed"]')?.content;
   if(seed){
    const restore=doc.createElement('button');restore.type='button';
    restore.textContent='Reload Installed Bank';
    restore.addEventListener('click',()=>{storage.remove(AUTO_OFF);void seedFromPage(seed);});
    section.insertBefore(restore,remove);
   }
   status('Select CDU_3_AIRPORTS.json.');
   file.addEventListener('change',async()=>{
    const selected=file.files?.[0];file.value='';
    if(!selected)return;
    const current=++attempt;
    if(selected.size>2_900_000){status('Invalid file size.');return;}
    try{
     const raw=await selected.text();
     if(current===attempt)save(raw);
    }catch(err){if(current===attempt)status('Bank import failed · '+err.message);}
   });
   remove.addEventListener('click',()=>{
    ++attempt;catalog=null;
    storage.remove(KEY);
    if(seed)storage.save(AUTO_OFF,'1');
    root.B737CduSgRouteV1?.setConnected(false);announce('B737CDUDetachCduSgV1');
    status('Local bank removed.');
   });
   const inspector=$('inspectorToggle'),header=inspector?.parentElement;
   if(header&&!$('cduSgQuickOpen')){
    const quick=doc.createElement('button');quick.type='button';quick.id='cduSgQuickOpen';quick.textContent='NAV DATA';
    quick.addEventListener('click',()=>{
     if(!doc.body.classList.contains('side-open'))inspector.click();
     section.scrollIntoView({block:'start'});
    });
    header.insertBefore(quick,inspector);
   }
   root.addEventListener('message',event=>{
    const d=event.data;
    if(catalog&&event.origin===root.location.origin&&d?.type==='b737:unified-cdu'&&d.kind==='ready'&&
       ['CAPT','FO'].includes(d.seat)&&frames().some(frame=>frame.contentWindow===event.source)){
     try{event.source.B737CDUAttachCduSgV1?.()}catch(_){}
    }
   });
   const saved=storage.read(KEY);
   if(saved)try{
    install(saved);
    status('OIII, OIMM and OISS reference bank is active.');
   }catch(_){storage.remove(KEY);}
   if(!catalog&&seed&&storage.read(AUTO_OFF)!=='1')void seedFromPage(seed);
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
 }
 return Object.freeze({createCatalog,mount});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
