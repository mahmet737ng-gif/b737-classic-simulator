/* Event-driven, same-cockpit TCAS instructor encounters. Never commands AP/FD or IRS. */
(function(win){
 'use strict';
 const Core=win.B737ClassicTcasV1,doc=win.document;
 if(!Core)return;
 let active=false,mode='TA_RA',scenario='CLIMB',elapsed=0,previousTime=null,output=null,voice=false,hadRA=false,lastAural='';
 let priorityWarning=false,latestOwn=null,speakingOwn=false;
 const by=id=>doc.getElementById(id),clone=x=>x?JSON.parse(JSON.stringify(x)):null;
 const own=()=>win.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.active===true?win.B737UnifiedFlightScenarioV1.getState():null;
 function getState(){
  const health=win.B737UnifiedFlightScenarioV1?.getDiagnostics?.();
  if(active&&(health?.active!==true||health.lastPublishAgeMs>3000))
   return {mode:'FAIL',stage:'SOURCE STALE',targets:[],ra:null,advisory:null};
  return clone(output)||{mode:'OFF',targets:[],ra:null,advisory:null,stage:'OFF'};
 }
 function announce(text,key,allowed){
  if(!allowed&&speakingOwn){win.speechSynthesis?.cancel();speakingOwn=false;}
  if(key===lastAural)return;lastAural=key;
  if(!text||!allowed||!voice)return;
  win.dispatchEvent(new CustomEvent('b737:tcas-aural',{detail:{text,source:'SCRIPTED_TCAS_7_1',synthetic:true}}));
  if(win.speechSynthesis&&win.SpeechSynthesisUtterance){
   if(speakingOwn)win.speechSynthesis.cancel();
   const speech=new win.SpeechSynthesisUtterance(text);speech.lang='en-US';speech.rate=1;
   speech.onstart=()=>{speakingOwn=true;};speech.onend=speech.onerror=()=>{speakingOwn=false;};
   win.speechSynthesis.speak(speech);
  }
 }
 function ui(){
  const status=by('tcasTrainingStatus');if(!status)return;
  const s=getState();
  status.textContent=(active?Core.SCENARIOS[scenario].label+' · ':'')+s.mode+' · '+s.stage+
   (s.callout?' · '+s.callout:'')+(s.inhibits?.length?' · '+s.inhibits.join(' / '):'');
  const conditions=by('tcasTrainingConditions'),t=s.thresholds;
  if(conditions)conditions.textContent=t?'SL '+t.sl+' · nominal TA '+t.taSec+' s / RA '+(t.raSec??'INHIBITED')+
   ' s before CPA · '+(s.ra?'Avoid red pitch region.':'Traffic advisories do not command a maneuver.'):
   'Load an airborne scenario to run an encounter. Existing flight targets remain available.';
 }
 function update(flight=own()){
  if(active&&!flight){stop();return;}
  if(active&&flight){
   const time=flight.elapsedSec??0;
   if(previousTime!==null&&time<previousTime){stop();return;}
   if(previousTime!==null)elapsed+=Math.max(0,time-previousTime);
   previousTime=time;latestOwn=flight;
   output=Core.evaluate({scenario,elapsedSec:elapsed,own:flight,mode,priorityWarning});
   if(output.advisory==='RA')hadRA=true;
   if(output.callout==='CLEAR OF CONFLICT'&&!hadRA)output.callout=null;
   announce(output.callout,[output.mode,output.stage,output.ra?.id,output.callout].join('|'),output.voiceAllowed);
   if(output.complete){active=false;output.ra=null;output.advisory=null;output.targets=[];}
  }else if(!active)output={schema:'B737_CLASSIC_TCAS_OUTPUT_V1',mode:flight?.airborne?mode:'OFF',stage:'IDLE',targets:[],ra:null,advisory:null};
  ui();win.dispatchEvent(new CustomEvent('b737:tcas-state',{detail:getState()}));
 }
 function start(id=scenario){
  if(!Core.SCENARIOS[id])throw RangeError('UNKNOWN TCAS SCENARIO');
  const flight=own();
  if(!flight?.airborne)throw Error('Load an airborne flight scenario before starting TCAS.');
  scenario=id;elapsed=0;previousTime=flight.elapsedSec??0;active=true;hadRA=false;lastAural='';
  update(flight);return getState();
 }
 function stop(){if(speakingOwn){win.speechSynthesis?.cancel();speakingOwn=false;}active=false;elapsed=0;previousTime=null;hadRA=false;lastAural='';update();}
 function next(){
  if(!active)return start();
  const t=Core.thresholds(latestOwn,mode),first=3+Math.max(10,t.taSec-(t.raSec??10));
  const stages=[3,first,first+7,first+18,first+23];
  elapsed=stages.find(t=>t>elapsed+.01)??first+23;update();return getState();
 }
 function mount(){
  const dialog=by('flightScenarioDialog');if(!dialog||by('tcasTrainingControls'))return;
  const section=doc.createElement('fieldset');section.id='tcasTrainingControls';
  section.innerHTML='<legend>TCAS II 7.1 · SCRIPTED TRAINING</legend>'+
   '<div class="flight-grid"><label>TCAS mode<select id="tcasTrainingMode"><option value="TA_RA">TA / RA</option><option value="TA_ONLY">TA ONLY</option><option value="OFF">STBY / OFF</option><option value="FAIL">FAIL</option><option value="TEST">SELF TEST</option></select></label>'+
   '<label>Encounter<select id="tcasTrainingScenario">'+Object.entries(Core.SCENARIOS).map(([id,s])=>'<option value="'+id+'">'+s.label+'</option>').join('')+'</select></label></div>'+
   '<div class="flight-actions"><button type="button" id="tcasTrainingStart">START ENCOUNTER</button><button type="button" id="tcasTrainingNext">NEXT EVENT</button><button type="button" id="tcasTrainingStop">CLEAR ENCOUNTER</button></div>'+
   '<label class="flight-mcp"><input type="checkbox" id="tcasTrainingVoice"> Training voice (synthetic English)</label>'+
   '<label class="flight-mcp"><input type="checkbox" id="tcasTrainingPriority"> GPWS / WINDSHEAR priority inhibit</label>'+
   '<p id="tcasTrainingStatus" class="flight-status" role="status"></p><p id="tcasTrainingConditions" class="flight-sub"></p>'+
   '<p class="flight-sub">Scripted encounters progress with flight time; PAUSE freezes the encounter. NEXT EVENT advances the script. Use TFC and a supported EHSI mode to display traffic symbols. Fly RA guidance manually; TCAS does not engage the autopilot.</p>';
  dialog.appendChild(section);
  const run=fn=>()=>{try{fn();}catch(error){by('tcasTrainingStatus').textContent=error.message;}};
  by('tcasTrainingStart').addEventListener('click',run(()=>start(by('tcasTrainingScenario').value)));
  by('tcasTrainingNext').addEventListener('click',run(next));by('tcasTrainingStop').addEventListener('click',stop);
  by('tcasTrainingMode').addEventListener('change',e=>{mode=e.target.value;update();});
  by('tcasTrainingVoice').addEventListener('change',e=>{voice=e.target.checked;lastAural='';update();});
  by('tcasTrainingPriority').addEventListener('change',e=>{priorityWarning=e.target.checked;update();});
  ui();
 }
 win.addEventListener('b737:flight-scenario-state',e=>update(e.detail));
 win.addEventListener('b737:flight-scenario-stopped',stop);
 win.B737UnifiedTcasV1=Object.freeze({start,stop,next,getState,
  setMode(value){if(!['TA_RA','TA_ONLY','OFF','FAIL','TEST'].includes(value))throw RangeError('TCAS mode');mode=value;update();},
  setPriorityWarning(value){priorityWarning=value===true;update();},
  getDiagnostics:()=>({active,scenario,elapsedSec:elapsed,hadRA,mode,voice})});
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
