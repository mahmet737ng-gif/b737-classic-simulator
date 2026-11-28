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
   if(def.read(api.getState()))throw Error('Fault already active; restore baseline first');
   api.dispatch({...def.command});if(!def.read(api.getState()))throw Error('Fire command readback did not confirm');
  }else{
   const api=win.B737ISNCockpitV1;
   if(!api?.fuelTrainerAction||!api?.getFuelSystem)throw Error('Fuel ECU unavailable');
   if(def.read(api.getFuelSystem()))throw Error('Fault already active; restore baseline first');
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
