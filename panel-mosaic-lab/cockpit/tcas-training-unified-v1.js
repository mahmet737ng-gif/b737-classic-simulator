/* Shared Classic TCAS kinematic trainer, transponder and source-failure adapter. */
(function(win){
 'use strict';
 const Core=win.B737ClassicTcasV2,doc=win.document;if(!Core)return;
 let state=null,latest=null,previousTime=null,mode=Core.controls(),voice=false,lastAural='',prepareDisplay=true;
 const by=id=>doc.getElementById(id),copy=x=>x?JSON.parse(JSON.stringify(x)):null;
 const flight=()=>win.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.active?win.B737UnifiedFlightScenarioV1.getState():null;
 function feeds(){
  const supply=win.B737UnifiedBusConsumerLiveV1,training=win.B737UnifiedEfisSources?.trainingSupply;
  const bus=id=>{const known=supply?.getBus?.(id,'115VAC')?.powered;
   return known===false&&!training?.(id,'115VAC')?false:known===true||training?.(id,'115VAC')?true:null;};
  const snapshot=win.B737UnifiedAvionicsNetworkV1?.getSnapshot?.();
  const signal=id=>snapshot?.[id]?.quality==='VALID';
  const irs=win.B737IRSTrainerUnified?.getState?.();
  const closed=id=>win.B737UnifiedCB?.closed?.(id)!==false;
  return {xpdr1:closed('P18-1|ALL|B3')?bus('electronic1'):false,xpdr2:win.B737UnifiedCB?.closed?.('P6-1|ALL|D16')===false?false:bus('electronic2'),
   adc1:snapshot?signal('airdata.adc1'):null,adc2:snapshot?signal('airdata.adc2'):null,
   radioAlt:snapshot?signal('airdata.radioAltitude'+mode.altSource):null,
   aligned:irs?['L','R'].every(s=>irs.units?.[s]?.positionValid):null,
   irs:irs?Object.values(irs.units||{}).some(u=>u.positionValid):null,
   computer:closed('P18-1|ALL|B2')&&closed('P18-1|ALL|B6')&&!mode.failures.computer};
 }
 function getState(){
  const health=win.B737UnifiedFlightScenarioV1?.getDiagnostics?.();
  if(state&&(!health?.active||health.lastPublishAgeMs>3000))return {mode:'FAIL',stage:'SOURCE STALE',targets:[],ra:null,advisory:null};
  if(latest)return copy(latest);
  const own=flight()||{airborne:false,elapsedSec:performance.now()/1000};
  const idle={scenario:'SAME_LEVEL',targets:[]};
  const output=Core.output(idle,own,mode,feeds());
  if(mode.mode!=='TEST')output.stage='IDLE';
  return output;

 }
 function getControls(){return copy(mode);}
 function renderStatus(){
  const field=by('tcasTrainingMode');
  if(field&&doc.activeElement!==field&&field.value!==mode.mode)field.value=mode.mode;
 }
 function notify(){renderStatus();win.dispatchEvent(new CustomEvent('b737:tcas-state',{detail:getState()}));}
 function announce(){const s=getState(),key=[s.mode,s.advisory,s.ra?.id,s.callout].join('|');
  if(key===lastAural)return;lastAural=key;if(!voice||!s.callout||!s.voiceAllowed)return;
  win.dispatchEvent(new CustomEvent('b737:tcas-aural',{detail:{text:s.callout,synthetic:true}}));
  if(win.speechSynthesis&&win.SpeechSynthesisUtterance){const u=new win.SpeechSynthesisUtterance(s.callout);u.lang='en-US';win.speechSynthesis.speak(u);}
 }
 function update(own=flight()){
  if(!state){announce();notify();return;}if(!own){stop();return;}
  const now=own.elapsedSec??0;if(previousTime!==null&&now<previousTime){stop();return;}
  const delta=previousTime===null?0:Math.max(0,now-previousTime);previousTime=now;
  let remaining=Math.min(delta,30);if(!remaining)state=Core.step(state,own,0,mode,feeds());
  while(remaining>0){const dt=Math.min(1,remaining);state=Core.step(state,own,dt,mode,feeds());remaining-=dt;}latest=state.output;announce();notify();
 }
 function prepare(){if(!prepareDisplay)return;
  const panel=win.B737UnifiedEFISPedestalV1;
  for(const seat of ['CAPT','FO']){
   const current=panel?.getState?.(seat);
   if(current&&!['MAP','CTR_MAP','EXP_NAV','EXP_VOR_ILS'].includes(current.mode))panel.operate(seat,'mode','MAP');
   panel?.operate?.(seat,'tfc',true);panel?.operate?.(seat,'range',10);
  }
 }
 function start(id='SAME_LEVEL',options={}){
  const own=flight();if(!own||!own.airborne&&mode.mode!=='TEST')throw Error('Load an airborne flight scenario; TEST also permits an aligned ground scenario.');
  state=Core.create(id,own,options);previousTime=own.elapsedSec??0;lastAural='';prepare();update(own);return getState();
 }
 function stop(){state=null;latest=null;previousTime=null;lastAural='';notify();}
 function configure(patch){
  const next={...mode,...patch,failures:{...mode.failures,...patch.failures}};
  Core.transponder(next,flight()||{airborne:false,elapsedSec:0});mode=next;update();return getControls();
 }
 const pulseTimers={};
 function pulse(key,seconds){
  const elapsed=flight()?.elapsedSec??performance.now()/1000;
  configure({[key]:elapsed+seconds});
  clearTimeout(pulseTimers[key]);
  pulseTimers[key]=setTimeout(()=>configure({[key]:0}),seconds*1000);
 }
 const ident=()=>pulse('identUntil',1),absolute=()=>pulse('absoluteUntil',15);
 function next(){
  const own=flight();if(!state||!own)return;
  for(let i=0;i<10;i++)state=Core.step(state,own,1,mode,feeds());
  latest=state.output;announce();notify();return getState();
 }
 function mount(){
  const dialog=by('flightScenarioDialog');if(!dialog||by('tcasTrainingControls'))return;
  const section=doc.createElement('fieldset');section.id='tcasTrainingControls';
  section.innerHTML='<legend>TCAS / TRANSPONDER</legend><div class="flight-grid">'+
   '<label>Transponder mode<select id="tcasTrainingMode">'+Core.MODES.map(m=>'<option value="'+m+'"'+(m==='TA_RA'?' selected':'')+'>'+m.replaceAll('_',' ')+'</option>').join('')+'</select></label>'+
   '<label>Encounter<select id="tcasTrainingScenario">'+Object.entries(Core.SCENARIOS).map(([id,s])=>'<option value="'+id+'">'+s.label+'</option>').join('')+'</select></label></div>'+
   '<div class="flight-actions"><button id="tcasTrainingStart" type="button">START ENCOUNTER</button><button id="tcasTrainingNext" type="button">ADVANCE INTRUDER 10 S</button><button id="tcasTrainingStop" type="button">CLEAR ENCOUNTER</button></div>';
  dialog.append(section);
  const run=fn=>()=>{try{fn();}catch(e){
   const status=by('flightScenarioStatus');
   if(status){status.textContent='TCAS: '+String(e.message||e);status.dataset.error='true';}
  }};
  by('tcasTrainingStart').addEventListener('click',run(()=>start(by('tcasTrainingScenario').value)));
  by('tcasTrainingNext').addEventListener('click',run(next));
  by('tcasTrainingStop').addEventListener('click',stop);
  by('tcasTrainingMode').addEventListener('change',run(()=>configure({mode:by('tcasTrainingMode').value})));
  notify();
 }
 for(const event of ['b737:bus-consumer-snapshot','b737:cb-snapshot','b737:cb-state-change','b737:efis-preset-change','b737:efis-source-change'])win.addEventListener(event,()=>update());
 win.addEventListener('b737:flight-scenario-state',e=>update(e.detail));win.addEventListener('b737:flight-scenario-stopped',stop);
 win.B737UnifiedTcasV1=Object.freeze({start,stop,next,getState,getControls,configure,ident,absolute,
  setMode(value){configure({mode:value==='OFF'?'STBY':value});},setPriorityWarning(value){configure({priorityWarning:value===true});},
  getDiagnostics:()=>({active:!!state,scenario:state?.scenario,elapsedSec:state?.time,mode:mode.mode,feeds:feeds()})});
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
