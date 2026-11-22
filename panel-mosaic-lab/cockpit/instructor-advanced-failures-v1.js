/* Unified instructor advanced fault and scenario controls · additive live bridge.
 * Training only. No DOM lamp overrides; all non-native fault changes are published
 * as typed events for authoritative system consumers. */
(function(win){
 'use strict';
 if(!win?.document)return;
 const doc=win.document;
 const KEY='b737.unified.advanced-failures.v1';
 const catalogue=[
  {group:'NAVIGATION',items:[['irs.left','LEFT IRS FAILURE'],['irs.right','RIGHT IRS FAILURE'],['irs.both','BOTH IRS FAILURE'],['fmc.left','LEFT FMC FAILURE'],['fmc.right','RIGHT FMC FAILURE'],['fmc.both','BOTH FMC FAILURE']]},
  {group:'FLIGHT INSTRUMENTS',items:['CPT','FO'].flatMap(seat=>['EADI','EHSI','ASI','ALTIMETER','VSI','RDMI','IVSI'].map(unit=>[seat.toLowerCase()+'.'+unit.toLowerCase(),seat+' '+unit+' FAILURE']))},
  {group:'AIR SYSTEMS',items:[['air.autoFail','PRESSURIZATION AUTO FAIL'],['air.cargoDoor','CARGO DOOR PRESSURE LOSS']]},
  {group:'ENGINES',items:[['engine.1.startValveOpen','ENG 1 START VALVE STUCK OPEN'],['engine.2.startValveOpen','ENG 2 START VALVE STUCK OPEN']]},
  {group:'HYDRAULICS',items:[['hyd.a.loss','SYSTEM A LOSS'],['hyd.b.loss','SYSTEM B LOSS'],['hyd.standbyPump','STANDBY PUMP FAILURE'],['hyd.ptu','PTU FAILURE'],['hyd.lgtu','LANDING GEAR TRANSFER UNIT FAILURE']]}
 ];
 const all=new Set(catalogue.flatMap(g=>g.items.map(x=>x[0])));
 let failed=new Set(),selected='emergency-descent',cause='autoFail',severity='uncontrolled',messageNode=null;
 const meta={engine:{},hydraulics:{},pressurization:null};
 function message(text,error=false){if(messageNode){messageNode.textContent=text;messageNode.dataset.error=String(error);}}
 function emit(name,detail){win.dispatchEvent(new CustomEvent(name,{detail}));}
 function read(){try{const v=JSON.parse(win.sessionStorage.getItem(KEY)||'[]');return new Set(Array.isArray(v)?v.filter(id=>all.has(id)):[]);}catch{return new Set();}}
 failed=read();
 function publish(){
  win.sessionStorage.setItem(KEY,JSON.stringify([...failed]));
  emit('b737:advanced-failures-changed',{source:'UNIFIED_INSTRUCTOR',failures:[...failed],at:Date.now()});
  refresh();
 }
 function set(id,active){
  if(!all.has(id))throw Error('Unknown fault '+id);
  if(active)failed.add(id);else failed.delete(id);
  // Both fails dominate individual channel status, without deleting individual selections.
  publish();
  if(id.startsWith('hyd.')){
   const h=win.B737HydraulicLabV1;
   if(h?.inject){
    const bridge={'hyd.a.loss':'A_RAPID_LEAK','hyd.b.loss':'B_RAPID_LEAK',
     'hyd.standbyPump':'STBY_PUMP_FAIL','hyd.ptu':'PTU_FAIL','hyd.lgtu':'LGTU_FAIL'};
    // Independent test-lab state remains isolated from Unified.
    emit('b737:hydraulic-failure-request',{id,active,labId:bridge[id]});
   }
  }
 }
 function isFailed(id){return failed.has(id);}
 function channelFailed(sys,side){return isFailed(sys+'.both')||isFailed(sys+'.'+side);}
 function status(){return Object.freeze({navigation:{
  irs:{left:!channelFailed('irs','left'),right:!channelFailed('irs','right')},
  fmc:{left:!channelFailed('fmc','left'),right:!channelFailed('fmc','right')}},
  instruments:Object.fromEntries(['cpt','fo'].map(seat=>[seat,Object.fromEntries(['eadi','ehsi','asi','altimeter','vsi','rdmi','ivsi'].map(unit=>[unit,!isFailed(seat+'.'+unit)]))])),
  air:{autoFail:isFailed('air.autoFail'),cargoDoor:isFailed('air.cargoDoor')},
  engines:{startValve1Stuck:isFailed('engine.1.startValveOpen'),startValve2Stuck:isFailed('engine.2.startValveOpen')},
  hydraulics:{aFailed:isFailed('hyd.a.loss'),bFailed:isFailed('hyd.b.loss'),
    standbyPumpFailed:isFailed('hyd.standbyPump'),ptuFailed:isFailed('hyd.ptu'),lgtuFailed:isFailed('hyd.lgtu')}});}
 function refresh(){
  for(const el of doc.querySelectorAll('[data-advanced-failure]')){
   const yes=failed.has(el.dataset.advancedFailure);el.checked=yes;
  }
  const count=doc.getElementById('advancedFailureCount');
  if(count)count.textContent=failed.size+' ACTIVE';
 }
 function el(tag,parent,cls,txt){
  const node=doc.createElement(tag);
  if(cls)node.className=cls;if(txt!==undefined)node.textContent=txt;
  parent?.append(node);return node;
 }
 function labelControl(parent,text,tag,values,id){
  const l=el('label',parent,'adv-label');el('span',l,'',text);
  const input=el(tag,l);input.id=id;
  if(tag==='select')for(const [v,t] of values){const option=el('option',input,'',t);option.value=v;}
  return input;
 }
 function installFailures(){
  const panel=doc.getElementById('failuresHeaderPopover');
  if(!panel||panel.querySelector('#advancedFailureBranch'))return !!panel;
  for(const group of catalogue){
   const section=el('details',panel,'failures-electrical');
   if(group.group==='NAVIGATION')section.id='advancedFailureBranch';
   const header=el('summary',section,'failures-section-title',group.group);
   if(group.group==='NAVIGATION'){const n=el('span',header,'failures-branch-counter','0 ACTIVE');n.id='advancedFailureCount';}
   const grid=el('div',section,'adv-failure-grid');
   for(const [id,title] of group.items){
    const label=el('label',grid,'adv-failure-label');
    const input=el('input',label);input.type='checkbox';input.dataset.advancedFailure=id;
    input.checked=failed.has(id);
    input.onchange=()=>set(id,input.checked);
    el('span',label,'',title);
   }
   if(group.group==='HYDRAULICS'){
    const open=el('button',section,'adv-action','OPEN HYDRAULIC LIVE TEST LAB');
    open.type='button';open.onclick=()=>win.B737HydraulicLabV1?.open?.();
   }
  }
  messageNode=el('p',panel,'failures-feedback','Advanced failures are available for instructor selection; avionics/engine/aircraft effects require a connected consumer.');
  messageNode.id='advancedFailureFeedback';
  const clear=el('button',panel,'adv-action','CLEAR ADVANCED FAILURES');
  clear.type='button';clear.onclick=()=>{failed.clear();publish();message('Advanced instructor failures cleared.');};
  refresh();return true;
 }
 function flightPreset(altitude,speed){
  const bridge=win.B737UnifiedFlightScenarioV1;
  if(!bridge?.loadScenario)throw Error('FLT PHASE ENGINE NOT READY');
  const airport=doc.getElementById('flightAirport')?.value||'OIMM';
  const runway=doc.getElementById('flightRunway')?.value||'31';
  return bridge.loadScenario({airport,runway,preset:'MANUAL',
    airborne:true,altitudeFt:altitude,speedKt:speed,
    headingDeg:Number(doc.getElementById('flightHeading')?.value)||0,
    lat:Number(doc.getElementById('flightLat')?.value)||36.235,
    lon:Number(doc.getElementById('flightLon')?.value)||59.643});
 }
 function busBothOff(){
  const p=win.B737UnifiedBusFailureInjectionV1;
  if(!p?.live?.get||!p?.payload||!p?.live?.write)throw Error('LIVE ELECTRICAL INJECTION NOT READY');
  const old=p.live.get(),keys=new Set(old.active?old.offBusKeys:[]);
  keys.add('transfer1@115VAC');keys.add('transfer2@115VAC');
  p.live.write(p.payload(p.BUS_KEYS.filter(k=>keys.has(k))));
 }
 function launch(){
  try{
   if(selected==='both-bus-off-climb'){
    const loaded=flightPreset(12000,260);
    busBothOff();
    emit('b737:instructor-scenario-loaded',{id:selected,phase:'CLIMB',altitudeFt:12000,targetAltitudeFt:30000,verticalRateFpm:1800,loaded});
   }else if(selected==='emergency-descent'){
    const loaded=flightPreset(31000,280);
    set(cause==='cargoDoor'?'air.cargoDoor':'air.autoFail',true);
    const state={id:selected,cause,severity,phase:'CRUISE',aircraftAltitudeFt:31000,
      cabinAltitudeFt:5500,cabinDifferentialPsi:7.83,
      initialCabinRateFpm:0,manualRecoveryAllowed:severity==='controlled',loaded};
    meta.pressurization=state;
    emit('b737:instructor-scenario-loaded',state);
   }else if(selected==='hydraulic-a'||selected==='hydraulic-b'){
    flightPreset(31000,280);
    set(selected==='hydraulic-a'?'hyd.a.loss':'hyd.b.loss',true);
    emit('b737:instructor-scenario-loaded',{id:selected,phase:'CRUISE'});
   }else throw Error('UNKNOWN SCENARIO');
   const node=doc.getElementById('advancedScenarioStatus');
   if(node)node.textContent='SCENARIO REQUESTED · '+selected.toUpperCase()+
    ' · Only connected native consumers will change actual cockpit indications.';
  }catch(e){const node=doc.getElementById('advancedScenarioStatus');
   if(node)node.textContent='SCENARIO LOAD FAILED: '+String(e.message||e);}
 }
 function installScenarios(){
  const dialog=doc.getElementById('flightScenarioDialog');
  if(!dialog||dialog.querySelector('#advancedScenarioBlock'))return !!dialog;
  const block=el('section',null,'adv-scenario');block.id='advancedScenarioBlock';
  el('strong',block,'','INSTRUCTOR NON-NORMAL SCENARIOS');
  const opt=labelControl(block,'Scenario','select',[
   ['emergency-descent','EMERGENCY DESCENT · PRESSURIZATION'],
   ['both-bus-off-climb','BOTH BUS OFF · CLIMB 12,000 FT'],
   ['hydraulic-a','LOSS OF HYDRAULIC SYSTEM A'],
   ['hydraulic-b','LOSS OF HYDRAULIC SYSTEM B']], 'advScenarioSelect');
  opt.onchange=()=>{selected=opt.value;setVisible();};
  const choices=el('div',block,'adv-choices');choices.id='advancedPressurizationOptions';
  const reason=labelControl(choices,'Cause','select',[['autoFail','AUTO FAIL'],['cargoDoor','CARGO DOOR']],'advCause');
  const mode=labelControl(choices,'Severity','select',[['controlled','CONTROLLED'],['uncontrolled','UNCONTROLLED']],'advSeverity');
  mode.value=severity;reason.onchange=()=>{cause=reason.value;};
  mode.onchange=()=>{severity=mode.value;};
  const launchButton=el('button',block,'adv-action','LOAD SELECTED NON-NORMAL SCENARIO');
  launchButton.type='button';launchButton.onclick=launch;
  const status=el('p',block,'flight-status','Load this scenario using its separate button. Pilot response and system follow-up are training-only.');
  status.id='advancedScenarioStatus';
  const original=doc.getElementById('flightScenarioStatus');dialog.insertBefore(block,original);
  function setVisible(){choices.hidden=selected!=='emergency-descent';}
  setVisible();return true;
 }
 function installStyle(){
  if(doc.getElementById('advancedInstructorStyle'))return;
  const s=el('style',doc.head);s.id='advancedInstructorStyle';
  s.textContent='.adv-failure-grid{padding:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}.adv-failure-label{display:flex;align-items:center;gap:8px;font:12px system-ui;color:#d8e5ee}.adv-failure-label input{accent-color:#d99c40}.adv-action{margin:9px;padding:9px 13px;background:#16324b;color:#f3f9ff;border:1px solid #5984a7;border-radius:6px;cursor:pointer}.adv-scenario{margin:12px 0;padding:12px;border:1px solid #5a7890;border-radius:7px;background:#102332;color:#eaf5ff;display:grid;gap:8px}.adv-label{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.adv-label select{background:#10202c;color:#fff;padding:7px;border:1px solid #62839c;border-radius:5px}.adv-choices{display:flex;gap:20px;flex-wrap:wrap}.adv-choices[hidden]{display:none}';
 }
 let tries=0;
 function mount(){installStyle();const a=installFailures(),b=installScenarios();
  if((!a||!b)&&++tries<40)win.setTimeout(mount,250);
 }
 const api=Object.freeze({version:'ADV-FAILURES-20261122-01',getStatus:status,
  getFailures:()=>[...failed],setFailure:set,launchScenario:(id,options={})=>{
   selected=id;cause=options.cause||cause;severity=options.severity||severity;launch();},
  refresh,mount});
 win.B737UnifiedAdvancedInstructorV1=api;
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
