/* Unified Instructor Non-Normal V1 — additive Failure / Scenario integration.
 * Training model only. Do not edit frozen OH artwork, guards, IRS display or instruments.
 */
(function (root) {
 'use strict';
 const doc=root.document;
 const KEY='b737classic.instructor-nonnormal.v1';
 const G={
  navigation:[
   ['irs.L','IRS LEFT FAILURE'],['irs.R','IRS RIGHT FAILURE'],['irs.BOTH','BOTH IRS FAILURE'],
   ['fmc.BOTH','BOTH FMC FAILURE']],
  instruments:['CAPT','FO'].flatMap(seat=>['EADI','EHSI','ASI','ALTIMETER','VSI','RDMI','IVSI'].map(id=>[seat+'.'+id,seat+' '+id+' FAILURE'])),
  air:[['autoFail','PRESSURIZATION AUTO FAIL'],['cargoDoor','CARGO DOOR PRESSURE LOSS']],
  engines:[['valve1','ENG 1 START VALVE STUCK OPEN'],['valve2','ENG 2 START VALVE STUCK OPEN']],
  hydraulics:[['lossA','HYDRAULIC SYSTEM A LOSS'],['lossB','HYDRAULIC SYSTEM B LOSS'],['lossBoth','BOTH HYDRAULIC SYSTEMS LOSS']],
  electrical:[['bothBus','BOTH GENERATOR BUSES OFF']]
 };
 const busy={navigation:new Set(),instruments:new Set(),air:new Set(),engines:new Set(),hydraulics:new Set(),electrical:new Set()};
 let previousIRS={},ownBuses=[],pressure=null,mode='AUTO',lastPerformance=0,installed=false,renderNeeded=true;
 const $=id=>doc.getElementById(id);
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const pressurePsi=ft=>14.696*Math.pow(Math.max(.00001,1-.00000687535*clamp(ft,-1000,60000)),5.2559);
 const difference=(aircraft,cabin)=>Math.max(0,pressurePsi(cabin)-pressurePsi(aircraft));
 const active=(category,id)=>busy[category].has(id);
 const present=(category,id,value)=>{if(value)busy[category].add(id);else busy[category].delete(id);};
 const pressureState=()=>pressure?{...pressure}:null;
 const announce=(name,detail)=>root.dispatchEvent(new CustomEvent(name,{detail}));
 function overheadFault(id,on){
  // Use the existing overhead command receiver rather than modifying locked photo art.
  const frame=$('overheadFrame');
  if(frame?.contentWindow)frame.contentWindow.postMessage({
   type:'b737:cockpit-command',action:'fault',id,active:on},root.location.origin);
 }
 const status=(id,text,bad=false)=>{const node=$(id);if(node){node.textContent=text;node.dataset.error=String(bad);}};
 function persist(){try{root.sessionStorage.setItem(KEY,JSON.stringify({active:Object.fromEntries(Object.entries(busy).map(([k,v])=>[k,[...v]])),mode}));}catch(_){}}
 function busWrite(enabled){
  const bus=root.B737UnifiedBusFailureInjectionV1;
  if(!bus?.live?.get||!bus?.live?.write)throw Error('ELECTRICAL INJECTION SOURCE NOT READY');
  const keys=bus.live.get().offBusKeys.slice();
  const inject=['generator1@115VAC','generator2@115VAC'];
  const retained=keys.filter(k=>!ownBuses.includes(k));
  if(enabled){ownBuses=inject.filter(k=>!keys.includes(k));}
  const merged=enabled?[...new Set([...retained,...keys,...inject])]:retained;
  bus.live.write(bus.payload(merged));
 }
 function setIRS(which,on){
  const api=root.B737IRSTrainerUnified;
  if(!api?.setMode||!api?.getState)throw Error('IRS TRAINER NOT READY');
  const sides=which==='BOTH'?['L','R']:[which];
  for(const side of sides){
   if(on){if(previousIRS[side]===undefined)previousIRS[side]=api.getState().units[side]?.mode||'NAV';api.setMode(side,'OFF');}
   else if(previousIRS[side]!==undefined){
    const prior=previousIRS[side];delete previousIRS[side];
    try{api.setMode(side,prior);}catch(_){api.setMode(side,'OFF');}
   }
  }
 }
 function setHydraulic(id,on){
  const lab=root.B737HydraulicLabV1;
  if(!lab?.choosePreset)throw Error('HYDRAULIC LAB NOT READY');
  const which=id==='lossA'?'a-lost':id==='lossB'?'b-lost':'dual-lost';
  if(on){lab.choosePreset(which);lab.command?.({type:'SET_ENV',id:'onGround',value:false});lab.open?.();}
  else lab.choosePreset('airborne');
  announce('b737:instructor-hydraulic-failure',{id,active:on,origin:'ISOLATED_HYDRAULIC_LAB'});
 }
 function toggle(group,id,enabled){
  const on=enabled===undefined?!active(group,id):Boolean(enabled);
  try{
   if(group==='navigation'){
    if(id.startsWith('irs.'))setIRS(id.split('.')[1],on);
    else if(id==='fmc.BOTH'){
     if(typeof root.B737FmcSystemsBridgeV1?.setFailure!=='function')throw Error('FMC FAILURE BRIDGE NOT READY');
     root.B737FmcSystemsBridgeV1.setFailure(on);
     if(!on)root.B737FmcSystemsBridgeV1.acknowledgeRecovery?.();
    }
   }else if(group==='electrical'&&id==='bothBus')busWrite(on);
   else if(group==='hydraulics')setHydraulic(id,on);
   else if(group==='air'&&on){present('air',id,true);startPressure({cause:id,severity:'uncontrolled',loadFlight:false});}
   else if(group==='air'&&!on&&pressure?.cause===id){pressure=null;overheadFault(id==='autoFail'?'press-auto-fail':'door-fwd-cargo',false);}
   present(group,id,on);
   if(group==='hydraulics'&&on)for(const [other]of G.hydraulics)if(other!==id)present('hydraulics',other,false);
   if(group==='navigation'&&id==='irs.BOTH'){
    present(group,'irs.L',on);present(group,'irs.R',on);
   }
   if(group==='navigation'&&(id==='irs.L'||id==='irs.R')&&!on)present(group,'irs.BOTH',false);
   if(group==='engines')announce('b737:instructor-start-valve-failure',{engine:id==='valve1'?1:2,stuckOpen:on,starterCutoutN2:46,source:'INSTRUCTOR'});
   if(group==='instruments')announce('b737:instructor-instrument-failure',{seat:id.split('.')[0],instrument:id.split('.')[1],active:on});
   announce('b737:instructor-failure-change',{group,id,active:on});
   persist();renderNeeded=true;render();return true;
  }catch(error){status('instructorFailuresStatus',String(error.message||error),true);return false;}
 }
 function paintFailures(){
  for(const [group,ids]of Object.entries(G))for(const [id]of ids){
   const b=doc.querySelector('[data-instructor-group="'+group+'"][data-instructor-id="'+id+'"]');
   if(b){b.setAttribute('aria-pressed',String(active(group,id)));b.dataset.active=String(active(group,id));}
  }
 }
 function maskDisplays(){
  for(const seat of ['CAPT','FO'])for(const id of ['EADI','EHSI']){
   const selector=id==='EADI'?'[data-eadi-stage1-seat="'+seat+'"]':'[data-unified-ehsi-seat="'+seat+'"]';
   for(const node of doc.querySelectorAll(selector))node.dataset.instructorFailed=String(active('instruments',seat+'.'+id));
  }
  // Native photo-gauge SVGs retain their own scale and needles.
  // A fault adds/removes a black overlay on only the selected instrument glass.
  const ns='http://www.w3.org/2000/svg';
  for(const svg of doc.querySelectorAll('.texture-piece svg[data-gauge]')){
   const piece=svg.closest('.texture-piece')?.dataset.piece||'';
   const seat=piece==='captain'?'CAPT':piece.startsWith('fo-')?'FO':null;
   const id={airspeed:'ASI',altimeter:'ALTIMETER',rmi:'RDMI',ivsi:'IVSI'}[svg.dataset.gauge];
   if(!seat||!id)continue;
   const failed=active('instruments',seat+'.'+id)||
    (id==='IVSI'&&active('instruments',seat+'.VSI'));
   const old=svg.querySelector('[data-instructor-analog-cover]');
   if(failed&&!old){
    const cover=doc.createElementNS(ns,'rect');
    cover.setAttribute('x','0');cover.setAttribute('y','0');
    cover.setAttribute('width','100%');cover.setAttribute('height','100%');
    cover.setAttribute('fill','#010306');cover.setAttribute('pointer-events','none');
    cover.setAttribute('data-instructor-analog-cover','');
    svg.append(cover);
   }else if(!failed&&old)old.remove();
  }
  for(const n of [1,2]){
   const value=$('isnStartIndications')?.querySelector?.('[data-engine="engine'+n+'"] [data-field="valve"]');
   if(value&&active('engines','valve'+n)){
    value.textContent='OPEN · STUCK';value.dataset.amber='true';
   }
  }
 }
 function aircraftAltitude(){
  const s=root.B737UnifiedFlightScenarioV1?.getState?.();
  return Number.isFinite(s?.altitudeFt)?s.altitudeFt:31000;
 }
 function startPressure({cause='autoFail',severity='uncontrolled',loadFlight=true}={}){
  if(!['autoFail','cargoDoor'].includes(cause)||!['controlled','uncontrolled'].includes(severity))throw Error('INVALID PRESSURIZATION SCENARIO');
  const phase=root.B737UnifiedFlightScenarioV1;
  if(loadFlight){
   if(!phase?.loadScenario)throw Error('FLT PHASE ENGINE NOT READY');
   phase.loadScenario({airport:'OIMM',runway:'31R',preset:'MANUAL',altitudeFt:31000,
     headingDeg:310,speedKt:280,vsFpm:0,airborne:true});
  }
  const initialAlt=loadFlight?31000:aircraftAltitude();
  pressure={cause,severity,cabinAltitudeFt:Math.min(5500,initialAlt),cabinRateFtMin:0,
   aircraftAltitudeFt:initialAlt,differentialPsid:difference(initialAlt,Math.min(5500,initialAlt)),
   emergencyDescent:false,elapsedSec:0,manualControl:'NONE',state:'PRESSURE LOSS'};
  present('air','autoFail',cause==='autoFail');
  present('air','cargoDoor',cause==='cargoDoor');
  overheadFault('press-auto-fail',cause==='autoFail');
  overheadFault('door-fwd-cargo',cause==='cargoDoor');
  renderNeeded=true;persist();reportPressure();return pressureState();
 }
 function startScenario(which,opts={}){
  const flight=root.B737UnifiedFlightScenarioV1;
  if(!flight?.loadScenario)throw Error('FLT PHASE ENGINE NOT READY');
  if(which==='emergency'){
   const cause=opts.cause||$('instructorPressureCause')?.value||'autoFail';
   const severity=opts.severity||$('instructorPressureSeverity')?.value||'uncontrolled';
   startPressure({cause,severity,loadFlight:true});
   announce('b737:instructor-scenario-change',{id:'EMERGENCY_DESCENT',cause,severity});
   status('instructorScenarioStatus','EMERGENCY DESCENT · CRUISE 31,000 FT · CAB ALT 5,500 FT · PRESSURE LOSS ACTIVE');
  }else if(which==='bothBus'){
   if(pressure)pressure=null;
   flight.loadScenario({airport:'OIMM',runway:'31R',preset:'MANUAL',altitudeFt:12000,
     headingDeg:310,speedKt:260,vsFpm:1800,airborne:true});
   flight.command({type:'ALTITUDE',value:30000});
   flight.command({type:'VS',value:1800});
   toggle('electrical','bothBus',true);
   announce('b737:instructor-scenario-change',{id:'BOTH_BUS_OFF_CLIMB',altitudeFt:12000,targetFt:30000});
   status('instructorScenarioStatus','BOTH BUS OFF · CLIMB 12,000 FT → 30,000 FT · TWO GENERATOR BUSES FAILED');
  }else if(which==='hydraulic'){
   flight.loadScenario({airport:'OIMM',runway:'31R',preset:'MANUAL',altitudeFt:31000,
     headingDeg:310,speedKt:280,vsFpm:0,airborne:true});
   const id=opts.system||$('instructorHydraulicSystem')?.value||'lossA';
   toggle('hydraulics',id,true);
   announce('b737:instructor-scenario-change',{id:'HYDRAULIC_LOSS_CRUISE',failure:id});
   status('instructorScenarioStatus','HYDRAULIC LOSS · CRUISE · '+id+' · INDEPENDENT HYDRAULIC LAB');
  }else throw Error('UNKNOWN SCENARIO');
  renderNeeded=true;render();return true;
 }
 function manualControl(value){
  if(!pressure)throw Error('NO ACTIVE PRESSURIZATION SCENARIO');
  pressure.manualControl=value;mode=value==='CLOSE'?'MAN':'AUTO';renderNeeded=true;reportPressure();
 }
 function emergencyDescent(){
  if(!pressure)throw Error('NO ACTIVE PRESSURIZATION SCENARIO');
  const flight=root.B737UnifiedFlightScenarioV1;
  if(!flight?.command)throw Error('FLT PHASE ENGINE NOT READY');
  flight.command({type:'ALTITUDE',value:10000});
  flight.command({type:'VS',value:-3000});
  pressure.emergencyDescent=true;
  announce('b737:instructor-emergency-descent-request',{targetAltitudeFt:10000,trainingVerticalRateFtMin:-3000});
  status('instructorScenarioStatus','EMERGENCY DESCENT IN PROGRESS · TARGET 10,000 FT · TRAINING V/S −3,000 FT/MIN');
  return true;
 }
 function stepPressure(seconds){
  if(!pressure||seconds<=0)return pressureState();
  const s=pressure,aircraft=aircraftAltitude(),base=s.cabinAltitudeFt;
  // Pressure-loss training surrogate: relaxation toward ambient at a rate that
  // depends on the failure source, severity and (for controlled failures) recovery.
  // Never let pressure altitude exceed local aircraft ambient by model overshoot.
  const rate=s.cause==='cargoDoor'?(s.severity==='uncontrolled'?4800:1500):
                                      (s.severity==='uncontrolled'?3200:850);
  const recovery=s.severity==='controlled'&&s.manualControl==='CLOSE';
  const target=recovery?Math.min(5500,aircraft):aircraft;
  const maxStep=rate*seconds/60;
  const change=clamp(target-base,-maxStep,maxStep);
  s.cabinAltitudeFt=clamp(base+change,-1000,Math.max(0,aircraft));
  s.cabinRateFtMin=seconds?change*60/seconds:0;
  s.aircraftAltitudeFt=aircraft;
  s.differentialPsid=difference(aircraft,s.cabinAltitudeFt);
  s.elapsedSec+=seconds;
  s.state=s.cabinAltitudeFt>=10000?'CABIN ALTITUDE WARNING':
    s.severity==='uncontrolled'?'UNCONTROLLED DEPRESSURIZATION':'CONTROLLED PRESSURE LOSS';
  return pressureState();
 }
 function reportPressure(){
  if(!pressure)return;
  const p=pressureState();
  const system=root.B737AircraftProfileStore?.get?.()?.pressurization||'CPCS';
  root.B737UnifiedCabinNeedles?.setMeasuredReadings?.({
   cabinAltitudeFt:p.cabinAltitudeFt,differentialPsid:p.differentialPsid,
   cabinRateFtMin:p.cabinRateFtMin},system);
  const angle=clamp(Math.round(p.cabinRateFtMin/40),-145,145);
  root.B737UnifiedCabinRateNeedle?.setOffset?.(angle);
  announce('b737:instructor-cabin-pressure',{...p,source:'INSTRUCTOR_EDUCATIONAL_PLANT',
   cabinAltitudeWarning:p.cabinAltitudeFt>=10000,manualRecoveryAvailable:p.severity==='controlled'});
  const n=$('instructorCabinReadings');
  if(n)n.textContent='CAB ALT '+Math.round(p.cabinAltitudeFt).toLocaleString('en-US')+
    ' FT · CAB RATE '+Math.round(p.cabinRateFtMin).toLocaleString('en-US')+
    ' FT/MIN · DIFF '+p.differentialPsid.toFixed(2)+' PSI · '+p.state;
 }
 function render(){
  if(!installed)return;
  paintFailures();maskDisplays();
  const live=$('instructorCabinReadings');if(live&&!pressure)live.textContent='No active pressurization scenario';
 }
 function tick(){
  const t=root.performance.now();const elapsed=lastPerformance?clamp((t-lastPerformance)/1000,0,.5):0;lastPerformance=t;
  if(pressure){stepPressure(elapsed);reportPressure();}
  if(renderNeeded){render();renderNeeded=false;}
 }
 function create(tag,cls,txt,parent){
  const node=doc.createElement(tag);if(cls)node.className=cls;
  if(txt!==undefined)node.textContent=txt;if(parent)parent.append(node);return node;
 }
 function categoryUI(host,group,title){
  const d=create('details','instructor-category',undefined,host);
  const summary=create('summary','',title,d),body=create('div','instructor-options',undefined,d);
  for(const [id,label]of G[group]){
   const b=create('button','instructor-option',label,body);b.type='button';
   b.dataset.instructorGroup=group;b.dataset.instructorId=id;
   b.addEventListener('click',()=>toggle(group,id));
  }
  return {details:d,summary,body};
 }
 function installStyle(){
  if($('instructorNonnormalStyle'))return;
  const s=create('style','','',doc.head);s.id='instructorNonnormalStyle';
  s.textContent='#failuresHeaderPopover .instructor-category,#flightScenarioDialog .instructor-category{border:1px solid #36596d;border-radius:7px;margin-top:7px;overflow:hidden}' +
   '#failuresHeaderPopover .instructor-category>summary,#flightScenarioDialog .instructor-category>summary{background:#17394c;padding:9px;color:#c9e4f5;cursor:pointer;font-weight:650}' +
   '.instructor-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:8px}' +
   '.instructor-option{color:#dce8f4;background:#21394a;border:1px solid #4a6878;border-radius:5px;padding:8px;font:600 11px/1.35 system-ui;cursor:pointer;text-align:left}' +
   '.instructor-option[data-active="true"]{color:#ffc9ae;border-color:#ef926e;background:#5b302c}' +
   '.instructor-section{margin:12px 0;padding:10px;border:1px solid #38617b;border-radius:8px;color:#dcebf6;background:#0d2533;font:12px/1.5 system-ui}' +
   '.instructor-section label{display:flex;flex-direction:column;gap:3px;margin:7px 0;color:#cfdfeb}' +
   '.instructor-section select{background:#102635;color:#fff;border:1px solid #557589;border-radius:5px;padding:6px}' +
   '.instructor-section button{margin:4px;padding:7px 10px;color:#dff5ff;background:#24516c;border:1px solid #4c91b1;border-radius:5px;cursor:pointer}' +
   '[data-instructor-failed="true"]::after{content:"";display:block;position:absolute;inset:0;background:#010306;pointer-events:none;z-index:40}' +
   '#instructorScenarioStatus[data-error="true"],#instructorFailuresStatus[data-error="true"]{color:#ff9e9e}';
 }
 function mountAdvanced(){
  const branch=$('advancedFailureBranch'),scene=$('advancedScenarioBlock');
  if(!branch||!scene)return false;
  // A concurrently installed instructor menu already owns these two tabs.
  // Attach the actual system adapters to its controls instead of duplicating menus.
  const mapping={
   'irs.left':['navigation','irs.L'],'irs.right':['navigation','irs.R'],
   'irs.both':['navigation','irs.BOTH'],'fmc.both':['navigation','fmc.BOTH'],
   'air.autoFail':['air','autoFail'],'air.cargoDoor':['air','cargoDoor'],
   'engine.1.startValveOpen':['engines','valve1'],
   'engine.2.startValveOpen':['engines','valve2'],
   'hyd.a.loss':['hydraulics','lossA'],'hyd.b.loss':['hydraulics','lossB']
  };
  for(const seat of ['cpt','fo'])for(const unit of ['eadi','ehsi','asi','altimeter','vsi','rdmi','ivsi'])
   mapping[seat+'.'+unit]=['instruments',(seat==='cpt'?'CAPT':'FO')+'.'+unit.toUpperCase()];
  const extraHyd={'hyd.standbyPump':'STBY_PUMP_FAIL','hyd.ptu':'PTU_FAIL','hyd.lgtu':'LGTU_FAIL'};
  for(const input of doc.querySelectorAll('[data-advanced-failure]')){
   const id=input.dataset.advancedFailure;
   input.addEventListener('change',()=>{
    const pair=mapping[id];
    if(pair){if(!toggle(pair[0],pair[1],input.checked))input.checked=!input.checked;}
    else if(extraHyd[id]){
     const lab=root.B737HydraulicLabV1,code=extraHyd[id];
     if(!lab?.inject){status('advancedFailureFeedback','HYDRAULIC LAB NOT READY',true);return;}
     const present=lab.getState?.().faults?.includes(code)===true;
     if(present!==input.checked)lab.inject(code);
     announce('b737:instructor-hydraulic-failure',{id,active:input.checked,origin:'ISOLATED_HYDRAULIC_LAB'});
    }else if(id.startsWith('fmc.')){
     announce('b737:instructor-fmc-channel-request',{id,failed:input.checked,origin:'CHANNEL_ADAPTER_NOT_CONNECTED'});
     status('advancedFailureFeedback','Individual FMC failure: native channel adapter pending; BOTH FMC failure is live.');
    }
   });
  }
  const selected=$('advScenarioSelect');
  if(selected&&!selected.querySelector('option[value="hydraulic-both"]')){
   const option=create('option','','LOSS OF BOTH HYDRAULIC SYSTEMS',selected);option.value='hydraulic-both';
  }
  const launch=scene.querySelector('.adv-action');
  if(launch){
   launch.onclick=()=>{
    try{
     const kind=selected?.value||'emergency-descent';
     if(kind==='emergency-descent')startScenario('emergency',{
      cause:$('advCause')?.value||'autoFail',severity:$('advSeverity')?.value||'uncontrolled'
     });
     else if(kind==='both-bus-off-climb')startScenario('bothBus');
     else if(kind.startsWith('hydraulic-'))startScenario('hydraulic',{
      system:kind==='hydraulic-a'?'lossA':kind==='hydraulic-b'?'lossB':'lossBoth'
     });
     status('advancedScenarioStatus','SCENARIO LOADED INTO FLT PHASE · '+kind.toUpperCase());
    }catch(error){status('advancedScenarioStatus','SCENARIO FAILED: '+String(error.message||error),true);}
   };
  }
  const extras=create('div','instructor-section',undefined,scene);
  extras.id='instructorScenarioAdditions';
  create('strong','','PRESSURIZATION PROCEDURE CONTROLS',extras);
  const row=create('div','',undefined,extras);
  function action(title,fn){
   const b=create('button','',title,row);b.type='button';
   b.onclick=()=>{try{fn();status('advancedScenarioStatus',title+' APPLIED');}
    catch(error){status('advancedScenarioStatus','ACTION FAILED: '+String(error.message||error),true);}};
  }
  action('INITIATE EMERGENCY DESCENT',emergencyDescent);
  action('MANUAL VALVE CLOSE',()=>manualControl('CLOSE'));
  action('MANUAL VALVE NEUTRAL',()=>manualControl('NONE'));
  const output=create('output','',undefined,extras);
  output.id='instructorCabinReadings';output.textContent='No active pressurization scenario';
  create('p','','Cabin readings use an educational pressure-loss model. Hydraulic loss runs in the independent Hydraulic Lab.',extras);
  return true;
 }
 function mount(){
  if(installed)return true;
  const fail=$('failuresHeaderPopover'),flight=$('flightScenarioDialog');
  if(!fail||!flight)return false;
  installStyle();
  if(mountAdvanced()){
   installed=true;render();
   root.addEventListener('b737:cockpit-mounted',()=>{renderNeeded=true;});
   root.setInterval(tick,200);
   root.setInterval(maskDisplays,900);
   return true;
  }
  const branch=create('section','instructor-section',undefined,fail);branch.id='instructorFailureBranches';
  create('strong','','ADDITIONAL SYSTEM FAILURES · INSTRUCTOR',branch);
  for(const [group,label]of [['navigation','NAVIGATION / IRS / FMC'],['instruments','FLIGHT INSTRUMENTS · CAPT / FO'],['air','AIR SYSTEMS'],['engines','ENGINES · START VALVE'],['hydraulics','HYDRAULICS · FCOM / MRG LAB'],['electrical','ELECTRICAL · DUAL BUS']])categoryUI(branch,group,label);
  create('p','','Native adapters are used where available. Hydraulic and pressure-loss physics remain educational training models.',branch);
  const feedback=create('p','','Ready',branch);feedback.id='instructorFailuresStatus';feedback.setAttribute('role','status');
  const section=create('section','instructor-section',undefined,flight);section.id='instructorScenarioPresets';
  create('strong','','NON-NORMAL SCENARIOS',section);
  const cause=create('label','','Pressure loss cause',section);
  const cs=create('select','',undefined,cause);cs.id='instructorPressureCause';
  for(const [v,label]of [['autoFail','AUTO FAIL'],['cargoDoor','CARGO DOOR']]){const o=create('option','',label,cs);o.value=v;}
  const severity=create('label','','Cabin pressure response',section);
  const ss=create('select','',undefined,severity);ss.id='instructorPressureSeverity';
  for(const [v,label]of [['controlled','CONTROLLED'],['uncontrolled','UNCONTROLLED']]){const o=create('option','',label,ss);o.value=v;}
  const row=create('div','',undefined,section);
  function button(name,callback){
   const b=create('button','',name,row);b.type='button';b.addEventListener('click',()=>{
    try{callback();status('instructorFailuresStatus','INSTRUCTOR ACTION APPLIED');}
    catch(error){status('instructorScenarioStatus',String(error.message||error),true);}
   });return b;
  }
  button('LOAD EMERGENCY DESCENT',()=>startScenario('emergency'));
  button('INITIATE DESCENT',emergencyDescent);
  button('MANUAL VALVE CLOSE',()=>manualControl('CLOSE'));
  button('MANUAL VALVE NEUTRAL',()=>manualControl('NONE'));
  button('LOAD BOTH BUS OFF · 12,000 FT CLIMB',()=>startScenario('bothBus'));
  const hydlabel=create('label','','Hydraulic system loss',section);
  const hyd=create('select','',undefined,hydlabel);hyd.id='instructorHydraulicSystem';
  for(const [val,label]of [['lossA','SYSTEM A'],['lossB','SYSTEM B'],['lossBoth','BOTH A AND B']]){const o=create('option','',label,hyd);o.value=val;}
  button('LOAD HYDRAULIC LOSS',()=>startScenario('hydraulic'));
  button('OPEN HYDRAULIC TEST LAB',()=>{if(!root.B737HydraulicLabV1?.open)throw Error('HYDRAULIC TEST LAB NOT READY');root.B737HydraulicLabV1.open();});
  const output=create('output','',undefined,section);output.id='instructorCabinReadings';output.textContent='No active pressurization scenario';
  const stat=create('p','','Choose a scenario to load it into FLT PHASE.',section);stat.id='instructorScenarioStatus';stat.setAttribute('role','status');
  installed=true;render();
  root.addEventListener('b737:cockpit-mounted',()=>{renderNeeded=true;});
  root.setInterval(tick,200);
  root.setInterval(maskDisplays,900);
  return true;
 }
 const api=Object.freeze({version:'INSTRUCTOR-NONNORMAL-0001',catalog:G,toggle,startScenario,
  startPressure,stepPressure,pressureState,manualControl,emergencyDescent,
  getState:()=>({active:Object.fromEntries(Object.entries(busy).map(([k,v])=>[k,[...v]])),pressure:pressureState(),installed}),mount});
 root.B737UnifiedInstructorNonNormalV1=api;
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
