/* UI adapter: no business logic. engine/trainer/core.js owns all state. */
(function(){'use strict';
const E=window.B737TrainerCore; if(!E)throw new Error('Trainer core not loaded');
let state=E.initialState(), joined=false, role=null, revision=0, stream=null, live=false, lastSnapshot=null;
const el=id=>document.getElementById(id);
const htmlEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function postApi(path,body){
 const res=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)});
 const obj=await res.json(); if(!res.ok)throw Object.assign(new Error(obj.detail||obj.error||'Request failed'),{code:obj.error,snapshot:obj.state}); return obj;
}
function say(msg){el('connectionMessage').textContent=msg;}
function updateNetwork(flag,text){live=flag;const b=el('networkStatus');b.textContent=text;b.className='network-status '+(flag?'online':joined?'pending':'');}
async function send(cmd,expectedValue){
 if(!joined||!live){say('Wait for the network to reconnect before operating the controls.');return;}
 try{const body={command:cmd};if(arguments.length>1)body.expectedValue=expectedValue;await postApi('command',body);}
 catch(err){say('Command not applied: '+err.message);if(err.snapshot)handleSnapshot(err.snapshot);}
}
const groups=[
  ['Electrical sources',[
    ['Battery','battery'],['Bus transfer AUTO','busTransferAuto'],['External AC available','externalAvailable'],['External AC connected','externalConnected'],
    ['Engine 1 running','engine1Running'],['GEN 1 connected','gen1Connected'],['Engine 2 running','engine2Running'],['GEN 2 connected','gen2Connected'],
    ['APU running','apuRunning'],['APU GEN 1 selected','apuGen1Connected'],['APU GEN 2 selected','apuGen2Connected']]],
  ['Fuel pumps',E.FUEL.map(id=>[E.LABELS[id],'fuel.'+id])],
  ['Electric hydraulic pumps',E.HYD.map(id=>[E.LABELS[id],'hyd.'+id])],
  ['Engine hydraulic pumps',[['Engine driven A','engineHyd.A'],['Engine driven B','engineHyd.B']]]
];
function controlValue(path){return path.split('.').reduce((o,k)=>o[k],state.controls)}
function renderControls(){el('controls').innerHTML=groups.map(([name,rows])=>`<div class="controls-group"><div class="group-title">${htmlEscape(name)}</div>${rows.map(([label,path])=>{const b=controlValue(path);return `<div class="control"><label for="c_${path.replaceAll('.','_')}">${htmlEscape(label)}</label><button id="c_${path.replaceAll('.','_')}" data-path="${path}" class="${b?'selected':'secondary'}" aria-pressed="${b}">${b?'ON':'OFF'}</button></div>`}).join('')}</div>`).join('');
  el('controls').querySelectorAll('button[data-path]').forEach(b=>b.addEventListener('click',()=>{const old=controlValue(b.dataset.path);send({type:'CONTROL',path:b.dataset.path,value:!old},old)}));
}
function renderFaults(){el('faults').innerHTML=E.FAULTS.map(id=>{const active=state.faults[id];const label=E.LABELS[id]||('Fuel '+E.LABELS[id.slice(5,-7)]+' failed');return `<button class="${active?'danger':'secondary'}" aria-pressed="${active}" data-fault="${id}">${active?'● ':'○ '}${htmlEscape(label)}</button>`}).join('');
  el('faults').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const old=state.faults[b.dataset.fault];send({type:'FAULT',id:b.dataset.fault,active:!old},old)}));
}
function busText(id,label,powered,source){const e=el(id);e.className='bus '+(powered?'online':'offline');e.innerHTML=`<strong>${label}</strong><p class="${powered?'on-text':'off-text'}">${powered?htmlEscape(source||'ENERGIZED'):'BUS OFF'}</p>`;}
function lamp(label,on,color){return `<div class="lamp ${on?'on '+color:''}" role="status">${htmlEscape(label)}</div>`}
function render(){const d=E.derive(state),q=E.checklist(state);renderControls();renderFaults();
  busText('genbus1','GENERATOR BUS 1',Boolean(d.generatorBus[1]),d.generatorBus[1]);busText('genbus2','GENERATOR BUS 2',Boolean(d.generatorBus[2]),d.generatorBus[2]);
  busText('transfer1','TRANSFER BUS 1',d.transferBus[1]);busText('transfer2','TRANSFER BUS 2',d.transferBus[2]);
  el('dcstatus').textContent=`Battery: ${d.dc.battery?'ON':'OFF'} | DC1: ${d.dc.bus1?'ON':'OFF'} | DC2: ${d.dc.bus2?'ON':'OFF'} | AC STBY (simplified): ${d.acStandby?'ON':'OFF'}`;
  const loads=[...E.FUEL.map(id=>[E.LABELS[id],d.fuel[id].operational,d.fuel[id].lowPressure]),...E.HYD.map(id=>[E.LABELS[id],d.hyd[id].operating,d.hyd[id].lowPressure])];
  el('loadStatus').innerHTML=`<table class="load-table">${loads.map(([name,on,low])=>`<tr><td>${htmlEscape(name)}</td><td><span class="pill ${on?'':'fail'}">${on?'RUN':'STOP'}</span></td><td><span class="${low?'off-text':'on-text'}">${low?'LOW PRESSURE':'NORMAL'}</span></td></tr>`).join('')}</table><p class="help">System A pressure source: ${d.systemHyd.A?'AVAILABLE':'LOST'} | System B pressure source: ${d.systemHyd.B?'AVAILABLE':'LOST'}</p>`;
  const i=d.indicators;el('annunciators').innerHTML=[
    lamp('BUS OFF L',i.busOff1,'amber'),lamp('BUS OFF R',i.busOff2,'amber'),lamp('TRANSFER BUS OFF L',i.transferBusOff1,'amber'),lamp('TRANSFER BUS OFF R',i.transferBusOff2,'amber'),
    lamp('GEN OFF BUS 1',i.genOffBus1,'blue'),lamp('GEN OFF BUS 2',i.genOffBus2,'blue'),lamp('GRD POWER AVAILABLE',i.groundPowerAvailable,'blue'),
    lamp('FUEL MASTER CAUTION',i.masterCautionFuel,'amber'),
    ...E.HYD.map(id=>lamp('HYD '+E.LABELS[id]+' LOW PRESS',d.hyd[id].lowPressure,'amber')),
    ...E.HYD.map(id=>lamp('HYD '+E.LABELS[id]+' OVERHEAT',d.hyd[id].overheat,'amber')),
    ...E.FUEL.map(id=>lamp('FUEL '+E.LABELS[id]+' LOW PRESS',d.fuel[id].lowPressure,'amber'))
  ].join('');
  el('checklist').innerHTML=q.id==='none'?'<p class="help">Select an instructor GEN 1 or GEN 2 scenario to load a condition-sensitive training flow.</p>':
    `<p><strong>${htmlEscape(q.title)}</strong> <span class="${q.complete?'success':'caution'}">${q.complete?'COMPLETE':'OPEN'}</span></p>`+
    q.steps.map(s=>`<div class="check-step ${s.done?'done':''}"><span>${htmlEscape(s.title)}<div class="check-note">${htmlEscape(s.detail)}</div></span><strong>${s.done?'✓':'○'}</strong></div>`).join('')+
    `<p class="check-note">${htmlEscape(q.branch)} • retry and alternate source are conditional alternatives, not two required sequential steps.</p>`;
  el('events').innerHTML=(state.events.length?state.events.slice(-15).reverse().map(e=>`<div>#${e.seq} ${htmlEscape(JSON.stringify(e.command))}</div>`).join(''):'<p>Ready. No commands yet.</p>');
  el('statusMessage').textContent=`Shared revision ${revision} · state seq ${state.seq} · ${live?'CONNECTED':'RECONNECTING'} · TRAINER ONLY`;
}
function scen(side){send({type:'PRESET',id:'bus'+side})}
el('scenario1').addEventListener('click',()=>scen(1));el('scenario2').addEventListener('click',()=>scen(2));
el('scenarioClear').addEventListener('click',()=>send({type:'SCENARIO',id:'none'}));
el('reset').addEventListener('click',()=>send({type:'RESET'}));
el('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({schema:'b737-trainer-log/1',state,derived:E.derive(state),checklist:E.checklist(state)},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='b737-trainer-session.json';a.click();URL.revokeObjectURL(url)});

function setJoined(on){
 joined=on; el('trainerMain').hidden=!on;el('joinForm').hidden=on;el('joinedToolbar').hidden=!on;
 el('instructorPanel').hidden=!on||role!=='instructor';el('reset').hidden=!on||role!=='instructor';
 el('myRole').textContent=role==='first_officer'?'FIRST OFFICER':String(role||'').toUpperCase();
 if(on)render();
}
function displaySeats(occupants){el('seatStatus').textContent=['captain','first_officer','instructor'].map(k=>(k==='first_officer'?'First Officer':k[0].toUpperCase()+k.slice(1))+' '+(occupants?.[k]?'●':'○')).join(' · ');}
function handleSnapshot(data){
 if(!data||data.type!=='snapshot'||typeof data.revision!=='number'||!data.state)return;
 if(data.revision<revision)return;
 revision=data.revision;state=data.state;lastSnapshot=data;displaySeats(data.occupants);if(joined)render();
}
function listen(){
 if(stream)stream.close();stream=new EventSource('/api/events');
 updateNetwork(false,'CONNECTING');say('Connecting to the shared aircraft...');
 stream.addEventListener('snapshot',event=>{try{handleSnapshot(JSON.parse(event.data));updateNetwork(true,'LIVE • SHARED');say('Connected. All connected seats receive the same airplane state.');}catch(err){say('Invalid update from host: '+err.message);}});
 stream.onerror=()=>{updateNetwork(false,'RECONNECTING');say('Connection lost — controls paused. Trying to reconnect to the host.');};
}
async function join(event){
 event.preventDefault();const seat=el('seatSelect').value;
 el('joinButton').disabled=true;
 try{await postApi('join',{role:seat,roomPin:el('roomPin').value.trim(),instructorPin:el('teacherPin').value.trim()});role=seat;setJoined(true);listen();}
 catch(err){say('Unable to join: '+err.message);updateNetwork(false,'NOT CONNECTED');}
 finally{el('joinButton').disabled=false;}
}
async function leave(){if(stream){stream.close();stream=null;}try{await postApi('leave',{});}catch(err){say('Leave: '+err.message);}joined=false;role=null;revision=0;state=E.initialState();updateNetwork(false,'NOT CONNECTED');setJoined(false);say('Seat released. You may select another role.');}
el('joinForm').addEventListener('submit',join);
el('seatSelect').addEventListener('change',()=>{el('teacherPinGroup').hidden=el('seatSelect').value!=='instructor';});
el('leaveButton').addEventListener('click',leave);
async function resume(){try{const res=await fetch('/api/session',{credentials:'same-origin'});const info=await res.json();if(info.joined){role=info.role;setJoined(true);listen();}else updateNetwork(false,'NOT CONNECTED');}catch(e){say('Server unavailable. Open this page through the host computer LAN URL.');}}
setJoined(false);resume();
})();