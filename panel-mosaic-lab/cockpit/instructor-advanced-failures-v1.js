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

/* PROCEDURE TRAINER V2 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root?.document)api.install(root);})(typeof window!=="undefined"?window:globalThis,function procedureTrainerFactory(){
 'use strict';
 const native={
 'APU FIRE':{phase:'GROUND',story:'During turnaround the APU is running. After a normal preparation period a fire indication appears.',kind:'fire',command:{type:'SET_FIRE',unit:'APU',active:true},read:s=>s.apuFire===true},
 'ENGINE FIRE OR ENGINE SEVERE DAMAGE OR SEPARATION':{phase:'CLIMB',story:'The aircraft has departed normally. An engine fire indication appears during climb. This variant models the fire detection channel, not separation.',kind:'fire',command:{type:'SET_FIRE',unit:'ENG1',active:true},read:s=>s.engineFire?.ENG1===true},
 'ENGINE OVERHEAT':{phase:'CLIMB',story:'After a normal departure, the left engine overheat indication appears.',kind:'fire',command:{type:'SET_OVERHEAT',unit:'ENG1',active:true},read:s=>s.engineOverheat?.ENG1===true},
 'APU DETECTION INOPERATIVE':{phase:'GROUND',story:'During normal ground preparation the APU fire detection circuit becomes unavailable.',kind:'fire',command:{type:'SET_APU_DETECTOR',healthy:false},read:s=>s.apuDetector===false},
 'WHEEL WELL FIRE':{phase:'CLIMB',story:'After departure the wheel-well fire detection indication activates.',kind:'fire',command:{type:'SET_WHEEL_FIRE',active:true},read:s=>s.wheelWellFire===true},
 'CROSSFEED SELECTOR INOPERATIVE':{phase:'CRUISE',story:'The crew attempts a fuel-system configuration change; the crossfeed valve develops a fault.',kind:'fuel',command:{type:'CROSSFEED_FAILURE',active:true},read:s=>s.valves?.crossfeed?.failed===true},
 'FUEL PUMP LOW PRESSURE':{phase:'CRUISE',story:'During a normal cruise the left main forward fuel pump fails.',kind:'fuel',command:{type:'PUMP_FAILURE',id:'fuel.main1FwdPump',active:true},read:s=>s.pumps?.['fuel.main1FwdPump']?.failed===true},
 'ENGINE FIRE ON THE GROUND':{phase:'GROUND',story:'During normal ground operation the left engine fire indication activates.',kind:'fire',command:{type:'SET_FIRE',unit:'ENG1',active:true},read:s=>s.engineFire?.ENG1===true}
 };
 const normalize=x=>String(x||'').trim().replace(/\s+/g,' ').toUpperCase();
 const builtins=Object.keys(native).map((name,i)=>({id:'native-'+(i+1),name,chapter:'Native demonstrations'}));
 function parse(raw){
  const a=Array.isArray(raw)?raw:raw?.scenarios;
  if(!Array.isArray(a)||!a.length||a.length>1000)throw Error('Invalid scenario catalog');
  const ids=new Set();
  return a.map(x=>{
   if(!x||typeof x.id!=='string'||!x.id.trim()||ids.has(x.id)||typeof x.name!=='string'||!x.name.trim())throw Error('Invalid or duplicate scenario ID');
   ids.add(x.id);return {id:x.id.slice(0,180),name:x.name.slice(0,220),chapter:String(x.chapter||'Other').slice(0,120),section:String(x.section||'').slice(0,40),story:String(x.story||'').slice(0,2000),suggested_phase:String(x.suggested_phase||'').slice(0,40)};
  });
 }
 function createSession(adapter,now=()=>Date.now()){
  let status='IDLE',spec=null,elapsed=0,log=[],last=0;
  const record=(type,detail='')=>{log.push({at:now(),elapsed,type,detail});};
  function snapshot(){return {status,elapsed,delay:spec?.delay??0,name:spec?.name??'',log:log.map(x=>({...x}))};}
  function arm(input){
   if(['ARMED','TRIGGERED','OBSERVE','FAILED'].includes(status))throw Error('Finish or reset current session first');
   if(!input?.name||!Number.isFinite(input.delay)||input.delay<0||input.delay>900)throw Error('Invalid scenario configuration');
   spec={...input};elapsed=0;last=now();log=[];status='ARMED';record('ARMED',input.phase||'');return snapshot();
  }
  function tick(running){
   const t=now();const dt=Math.max(0,t-last);last=t;
   if(status!=='ARMED')return snapshot();
   if(running)elapsed+=dt/1000;
   if(elapsed>=spec.delay&&running){
    try{
     if(spec.mode==='native'){adapter(spec);status='TRIGGERED';record('NATIVE_READBACK_CONFIRMED');}
     else {status='OBSERVE';record('INSTRUCTOR_CUE',spec.story||'Instructor provides scenario cue');}
    }catch(e){status='FAILED';record('INJECTION_REJECTED',String(e.message||e));}
   }return snapshot();
  }
  function note(role,value){
   if(!['TRIGGERED','OBSERVE','FAILED'].includes(status))throw Error('No active exercise');
   if(!['CPT','FO','INSTRUCTOR'].includes(role)||!String(value).trim())throw Error('Enter a crew observation');
   record(role,String(value).trim().slice(0,500));return snapshot();
  }
  function finish(){if(!['TRIGGERED','OBSERVE','FAILED'].includes(status))throw Error('No active exercise');status='COMPLETE';record('DEBRIEF','No automatic QRH compliance score');return snapshot();}
  function reset(){if(status==='TRIGGERED'||status==='FAILED')throw Error('Finish and restore faults using native Failure controls first');status='IDLE';spec=null;elapsed=0;log=[];return snapshot();}
  return {arm,tick,note,finish,reset,snapshot};
 }
 function nativeInject(win,spec){
  const def=native[normalize(spec.name)];if(!def)throw Error('No validated native command for this title');
  if(def.kind==='fire'){
   const api=win.B737UnifiedFireLights;
   if(!api?.dispatch||!api?.getState)throw Error('Fire system unavailable');
   api.dispatch({...def.command});if(!def.read(api.getState()))throw Error('Fire command readback did not confirm');
  }else{
   const api=win.B737ISNCockpitV1;
   if(!api?.fuelTrainerAction||!api?.getFuelSystem)throw Error('Fuel ECU unavailable');
   const result=api.fuelTrainerAction({instructor:true,...def.command});
   if(result?.accepted!==true||!def.read(api.getFuelSystem()))throw Error('Fuel ECU command/readback rejected');
  }
 }
 function install(win){
  const doc=win.document;let entries=builtins.slice(),selected=entries[0],running=false,paused=false;
  const session=createSession(s=>nativeInject(win,s));
  function mount(){
   const host=doc.getElementById('flightScenarioDialog');if(!host||doc.getElementById('unifiedProcedureTrainerV2'))return !!host;
   const section=doc.createElement('details');section.id='unifiedProcedureTrainerV2';section.className='adv-scenario';
   function el(tag,parent,label){const e=doc.createElement(tag);if(label)e.textContent=label;parent.append(e);return e;}
   function button(parent,label,fn){const b=el('button',parent,label);b.type='button';b.className='adv-action';b.onclick=()=>{try{fn();render()}catch(e){status.textContent=e.message;}};return b;}
   function field(label,tag){const l=el('label',section,label);l.className='adv-label';return el(tag,l);}
   el('summary',section,'PROCEDURE TRAINER · SCENARIO SESSIONS');
   el('p',section,'Training only · local catalog import · instructor-controlled. Native readback confirms the command, not full aircraft fidelity. No automatic QRH grading.');
   const file=field('Load private QRH scenario JSON','input');file.type='file';file.accept='.json,application/json';
   const search=field('Search','input');search.type='search';
   const select=field('Exercise','select');
   const mode=field('Mode','select');for(const [v,l] of [['native','Native system command'],['manual','Instructor / procedural cue']]){const o=el('option',mode,l);o.value=v;}
   const phase=field('Initial phase (prepare actual aircraft first)','input');
   const story=field('Instructor briefing / cue','textarea');story.rows=3;story.style.width='95%';
   const delay=field('Delay after exercise starts (seconds)','input');delay.type='number';delay.min='0';delay.max='900';delay.value='30';
   const controls=el('div',section),status=el('p',section),log=el('pre',section);log.style.cssText='white-space:pre-wrap;max-height:180px;overflow:auto;font-size:11px';
   const role=field('Crew role','select');for(const k of ['CPT','FO','INSTRUCTOR'])el('option',role,k);
   const note=field('Observation / action (self-reported)','input');
   function fill(){const def=native[normalize(selected?.name)];phase.value=def?.phase||selected?.suggested_phase||'INSTRUCTOR DEFINED';story.value=selected?.story||def?.story||'';mode.value=def?'native':'manual';mode.options[0].disabled=!def;}
   function options(){select.replaceChildren();const list=entries.filter(x=>(x.name+' '+x.chapter+' '+x.section).toLowerCase().includes(search.value.toLowerCase()));for(const x of list){const o=el('option',select,x.chapter+' · '+x.name);o.value=x.id;}selected=list.find(x=>x.id===selected?.id)||list[0];if(selected)select.value=selected.id;fill();}
   search.oninput=options;select.onchange=()=>{selected=entries.find(x=>x.id===select.value);fill();};
   file.onchange=async()=>{try{if(!file.files[0])return;if(file.files[0].size>3000000)throw Error('Catalog too large');entries=parse(JSON.parse(await file.files[0].text()));selected=entries[0];search.value='';options();status.textContent=entries.length+' private titles loaded locally';}catch(e){status.textContent=e.message;}};
   button(controls,'ARM',()=>{if(!selected)throw Error('Select an exercise');if(mode.value==='manual'&&!story.value.trim())throw Error('Enter a story / cue for this exercise');session.arm({name:selected.name,mode:mode.value,phase:phase.value,delay:Number(delay.value),story:story.value});running=false;paused=false;});
   button(controls,'START / RESUME',()=>{if(session.snapshot().status!=='ARMED')throw Error('Arm an exercise first');running=true;paused=false;});
   button(controls,'PAUSE',()=>{paused=true;});
   button(controls,'LOG CREW ACTION',()=>{session.note(role.value,note.value);note.value='';});
   button(controls,'FINISH',()=>{session.finish();running=false;});
   button(controls,'NEW SESSION',()=>{session.reset();running=false;paused=false;});
   button(controls,'EXPORT DEBRIEF',()=>{const blob=new Blob([JSON.stringify(session.snapshot(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=doc.createElement('a');a.href=url;a.download='procedure-debrief.json';a.click();win.setTimeout(()=>URL.revokeObjectURL(url),1000);});
   function render(){const s=session.snapshot();status.textContent=entries.length+' TITLES · '+s.status+' · '+Math.min(s.elapsed,s.delay).toFixed(1)+' / '+s.delay+' s';log.textContent=s.log.map(e=>e.elapsed.toFixed(1)+'s  '+e.type+'  '+e.detail).join('\n');}
   win.setInterval(()=>{if(running){const flight=win.B737UnifiedFlightScenarioV1?.getDiagnostics?.();session.tick(!paused&&flight?.paused!==true);render();}else session.tick(false);},250);
   options();render();host.append(section);return true;
  }
  let attempts=0;function boot(){if(!mount()&&++attempts<40)win.setTimeout(boot,250);}
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  win.B737ProcedureTrainerV2=Object.freeze({version:'2.0',getState:session.snapshot});
 }
 return {parse,createSession,nativeInject,install,builtins};
});
