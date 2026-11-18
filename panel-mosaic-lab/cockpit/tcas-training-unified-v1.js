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
  const status=by('tcasTrainingStatus');if(!status)return;const s=getState();
  for(const [id,key] of [['tcasTrainingMode','mode'],['tcasUnit','unit'],['tcasCode','code'],['tcasFilter','filter']]){
   const field=by(id);if(field&&doc.activeElement!==field&&field.value!==String(mode[key]))field.value=mode[key];
  }
  status.textContent=[s.mode,s.stage,s.callout,...(s.inhibits||[])].filter(Boolean).join(' · ');
  const rows=by('tcasTrafficRows');if(rows)rows.textContent=(s.targets||[]).map(t=>
   t.id+' · '+t.kind+' · '+t.distance.toFixed(2)+' NM · '+(Number.isFinite(t.bearing)?Math.round(t.bearing)+'° TRUE':'NO BEARING')+
   ' · '+(Number.isFinite(t.relativeAltitude)?Math.round(t.relativeAltitude)+' FT':'ALT UNKNOWN')+
   ' · '+(t.verticalRate??'—')+' FPM · '+(t.verticalRelation||'')).join('\n')||'No received traffic';
  const xpdr=by('tcasXpdrStatus'),x=s.transponder;
  if(xpdr&&x)xpdr.textContent='ATC '+x.selectedUnit+' · '+x.displayedCode+' · MODE S '+(x.modeS?'ON':'OFF')+
   ' · ALT '+(x.altitudeReporting?Math.round(x.transmittedAltitudeFt)+' FT':'OFF / INVALID')+(x.ident?' · IDENT':'')+
   ' · '+(x.failed?'ATC FAIL':x.test?'ATC TEST':'NORMAL');
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
  section.innerHTML='<legend>TCAS / TRANSPONDER · CLASSIC TRAINER</legend><div class="flight-grid">'+
   '<label>Transponder mode<select id="tcasTrainingMode">'+Core.MODES.map(m=>'<option value="'+m+'"'+(m==='TA_RA'?' selected':'')+'>'+m.replaceAll('_',' ')+'</option>').join('')+'</select></label>'+
   '<label>Encounter<select id="tcasTrainingScenario">'+Object.entries(Core.SCENARIOS).map(([id,s])=>'<option value="'+id+'">'+s.label+'</option>').join('')+'</select></label>'+
   '<label>Selected ATC<select id="tcasUnit"><option>1</option><option>2</option></select></label>'+
   '<label>Altitude source<select id="tcasAltSource"><option>1</option><option>2</option></select></label>'+
   '<label>Squawk (0000–7777)<input id="tcasCode" value="2000" maxlength="4" pattern="[0-7]{4}"></label>'+
   '<label>Altitude display band<select id="tcasFilter"><option value="NORM">NORM −2700 / +2700 FT</option><option value="ABOVE">ABOVE −2700 / +9900 FT</option><option value="BELOW">BELOW −9900 / +2700 FT</option></select></label>'+
   '<label>Initial relative altitude (ft)<input id="tcasRelativeAltitude" type="number" placeholder="Use encounter default"></label>'+
   '<label>Intruder vertical rate (fpm)<input id="tcasVerticalRate" type="number" placeholder="Use encounter default"></label></div>'+
   '<div class="flight-actions"><button id="tcasTrainingStart" type="button">START ENCOUNTER</button><button id="tcasTrainingNext" type="button">ADVANCE INTRUDER 10 S</button><button id="tcasTrainingStop" type="button">CLEAR ENCOUNTER</button><button id="tcasIdent" type="button">IDENT</button><button id="tcasAbsolute" type="button">ABS ALT 15 S</button><a href="./tcas-lab/" target="_blank" rel="noopener">OPEN TCAS TEST LAB</a></div>'+
   '<label class="flight-mcp"><input type="checkbox" id="tcasPrepareDisplay" checked> Prepare both EHSIs: TFC ON, supported mode, range 10 NM</label>'+
   '<label class="flight-mcp"><input type="checkbox" id="tcasTrainingVoice"> Synthetic English training voice</label>'+
   '<details><summary>Instructor failures / source isolation</summary>'+Object.keys(mode.failures).map(id=>'<label class="flight-mcp"><input type="checkbox" data-tcas-failure="'+id+'"> '+id+'</label>').join('')+'</details>'+
   '<label class="flight-mcp"><input type="checkbox" id="tcasTrainingPriority"> GPWS / WINDSHEAR priority inhibit</label>'+
   '<p id="tcasXpdrStatus" class="flight-status"></p><p id="tcasTrainingStatus" class="flight-status" role="status"></p><pre id="tcasTrafficRows" style="white-space:pre-wrap"></pre>'+
   '<p class="flight-sub">Real relative target motion; PAUSE freezes flight time. RA guidance never controls the A/P. Use existing flight targets to respond. Classic ATC feeds: Electronic Bus 1/2, 115 VAC. Simulator panel labels: ATC1 P18-1 B3, ATC2 P6-1 D16, TCAS P18-1 B2/B6. TCAS computer supply and airframe-specific breaker identities require the installed WDM.</p>';
  dialog.append(section);
  const run=fn=>()=>{try{fn();}catch(e){by('tcasTrainingStatus').textContent=e.message;}};
  by('tcasTrainingStart').addEventListener('click',run(()=>{
   const options={};for(const [id,key] of [['tcasRelativeAltitude','relativeAltitudeFt'],['tcasVerticalRate','verticalRateFpm']])
    if(by(id).value.trim()!=='')options[key]=Number(by(id).value);
   start(by('tcasTrainingScenario').value,options);
  }));
  by('tcasTrainingNext').addEventListener('click',run(next));by('tcasTrainingStop').addEventListener('click',stop);
  for(const [id,key] of [['tcasTrainingMode','mode'],['tcasUnit','unit'],['tcasAltSource','altSource'],['tcasCode','code'],['tcasFilter','filter']])
   by(id).addEventListener('change',run(()=>configure({[key]:['unit','altSource'].includes(key)?Number(by(id).value):by(id).value})));
  by('tcasPrepareDisplay').addEventListener('change',e=>{prepareDisplay=e.target.checked;});
  by('tcasTrainingVoice').addEventListener('change',e=>{voice=e.target.checked;lastAural='';announce();});
  by('tcasTrainingPriority').addEventListener('change',e=>configure({priorityWarning:e.target.checked}));
  for(const input of section.querySelectorAll('[data-tcas-failure]'))input.addEventListener('change',()=>configure({failures:{[input.dataset.tcasFailure]:input.checked}}));
  by('tcasIdent').addEventListener('click',ident);
  by('tcasAbsolute').addEventListener('click',absolute);notify();
 }
 for(const event of ['b737:bus-consumer-snapshot','b737:cb-snapshot','b737:cb-state-change','b737:efis-preset-change','b737:efis-source-change'])win.addEventListener(event,()=>update());
 win.addEventListener('b737:flight-scenario-state',e=>update(e.detail));win.addEventListener('b737:flight-scenario-stopped',stop);
 win.B737UnifiedTcasV1=Object.freeze({start,stop,next,getState,getControls,configure,ident,absolute,
  setMode(value){configure({mode:value==='OFF'?'STBY':value});},setPriorityWarning(value){configure({priorityWarning:value===true});},
  getDiagnostics:()=>({active:!!state,scenario:state?.scenario,elapsedSec:state?.time,mode:mode.mode,feeds:feeds()})});
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
