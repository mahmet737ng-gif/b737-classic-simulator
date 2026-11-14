/* Guest-only overhead electrical/CB bridge, event-driven and same-origin. */
(function(win){
'use strict';
const key='b737classic.bus-failure-injection.v1',profileKey='b737classic.aircraft-profile.v1';
let index=null,started=false,lastSignature='',statusNode=null,refreshingLights=false;
const Core=win.B737ClassicBusConsumersV1, Lab=win.B737BusConsumerTestLabV1;
const protocol=()=>win.B737UnifiedBusFailureInjectionV1?.live;
function faultKeys(){return protocol()?.get?.().offBusKeys||[];}
function profile(){try{return JSON.parse(localStorage.getItem(profileKey)||'null')||{};}catch(_){return {};}}
function ensure(){
 if(statusNode)return statusNode;
 const holder=document.querySelector('aside.inspector')||document.querySelector('.workspace');
 if(!holder)return null;
 statusNode=document.createElement('section');
 statusNode.className='guest-power-status';statusNode.id='guestPowerStatus';
 const head=document.createElement('strong');head.id='guestBusSummary';head.textContent='ATA24 · OVERHEAD ELECTRICAL';
 const cb=document.createElement('small');cb.id='guestCbSummary';cb.textContent='CB status loading…';
 const details=document.createElement('details'),title=document.createElement('summary');
 title.textContent='Affected electrical functions';details.append(title);
 const list=document.createElement('div');list.className='guest-device-list';list.id='guestAffected';
 list.textContent='Waiting for reference index…';details.append(list);
 const disclaimer=document.createElement('small');
 disclaimer.textContent='Electrical availability and annunciators respond to bus/CB state. Mechanical switch positions do not change when a failure is injected. Training-only reference, not a certified wiring diagram.';
 statusNode.append(head,cb,details,disclaimer);holder.prepend(statusNode);return statusNode;
}
function cbs(){const r=win.B737UnifiedCB?.snapshot?.();return r?.breakers?.filter(b=>b.pulled||b.tripped)?.length||0;}
function update(){
 const node=ensure();if(!node)return;
 const keys=faultKeys(),cnt=cbs(),p=profile(),revision=win.B737UnifiedCB?.revision??0;
 const signature=keys.join('|')+';'+revision+';'+[p.aircraftModel,p.pressurization,p.engineInstruments].join('|')+';'+!!index;
 if(signature===lastSignature)return;
 lastSignature=signature;
 node.dataset.failure=String(keys.length>0);
 document.getElementById('guestBusSummary').textContent=keys.length?'ATA24 · '+keys.length+' BUS CLASS INTERRUPTION(S)':'ATA24 · NO INJECTED BUS FAILURES';
 document.getElementById('guestCbSummary').textContent='Pulled/tripped circuit breakers: '+cnt;
 if(win.B737OverheadLights && !refreshingLights){
  refreshingLights=true;
  try{
   // The V7 evaluator was overlaid by the existing instructor-failure
   // protocol before the annunciator engine was initialized.
   win.B737OverheadLights.setScenario({});
   if(['B737-300-500','B737-400'].includes(p.aircraftFamily))
    win.B737OverheadLights.setAircraftFamily(p.aircraftFamily);
  }catch(e){console.warn('Overhead re-evaluation:',e.message);}
  finally{refreshingLights=false;}
 }
 if(!index||!Core||!Lab)return;
 const list=document.getElementById('guestAffected');
 try{
  const electrical=win.B737ElectricalV7;
  const raw=electrical.initialState({coldDark:false});
  const evaluated=electrical.evaluate(raw);
  const reference=Core.defineBuses(evaluated,{electricalState:raw});
  const supply=Lab.calculatePower(reference,keys,'ALL_ON',false);
  const snapshot=Core.project({index,electrical:evaluated,electricalState:raw,
   labBusPower:supply,cbAvailable:id=>win.B737UnifiedCB?.available?.(id)??null,
   mode:p.engineInstruments==='CONVENTIONAL'?'CONVENTIONAL':'EIS',
   aircraftModel:p.aircraftModel||'737-300',pressurization:p.pressurization||'DCPCS',
   includeAllConfigurations:true});
  const affected=Object.values(snapshot.devices||{}).filter(d=>d.state==='OFF'||d.state==='DEGRADED');
  document.getElementById('guestBusSummary').textContent=keys.length
   ? keys.length+' BUS OUTAGES · '+affected.length+' EQUIPMENT FUNCTIONS AFFECTED'
   : 'ATA24 · '+affected.length+' EQUIPMENT FUNCTIONS AFFECTED';
  list.replaceChildren();
  if(!affected.length){list.textContent='No modelled consumer interruptions.';return;}
  for(const d of affected.slice(0,50)){
   const row=document.createElement('div');
   row.textContent=d.state+' · '+(d.displayName||d.name||'Equipment');
   list.append(row);
  }
  if(affected.length>50){
   const rest=document.createElement('small');
   rest.textContent='+'+(affected.length-50)+' more affected entries in Bus Test Lab';
   list.append(rest);
  }
 }catch(e){console.warn('Guest consumer projection:',e.message);list.textContent='Power projection unavailable: '+e.message;}
}
async function loadIndex(){
 try{
  const response=await fetch('/static/mrg-classic-340-consumer-bus-index-v1.json',{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();Core.validate(data);index=data;
  update();
 }catch(e){const el=ensure();if(el)el.querySelector('#guestAffected').textContent='Consumer reference unavailable: '+e.message;}
}
function start(){
 if(started)return;started=true;
 const toggle=document.getElementById('guestTestsToggle');
 const inspector=document.getElementById('guestOverheadInspector');
 if(toggle&&inspector){
  toggle.addEventListener('click',()=>{
   const open=inspector.classList.toggle('guest-visible');
   toggle.setAttribute('aria-expanded',String(open));
  });
  document.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&inspector.classList.contains('guest-visible')){
    inspector.classList.remove('guest-visible');toggle.setAttribute('aria-expanded','false');
   }
  });
 }
 ensure();
 win.addEventListener('b737:bus-failure-injection-changed',update);
 win.addEventListener('b737:cb-state-change',update);
 win.addEventListener('b737:guest-profile-changed',update);
 win.addEventListener('storage',e=>{if(e.key===key||e.key===profileKey)update();});
 win.addEventListener('b737:overhead-light-state',update,{once:true});
 protocol()?.recompute?.();
 loadIndex();update();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})(window);
