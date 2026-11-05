(function(){'use strict';
 const $=id=>document.getElementById(id), esc=s=>String(s===undefined||s===null?'—':s);
 let latest=null,seq=0,lastRequest=null;
 const send=(cmd)=>{const sequence=++seq;lastRequest=sequence;
  if(window.parent===window){feedback('Open this laboratory from Unified cockpit',true);return;}
  window.parent.postMessage({type:'b737:engine-lab-v2-command',sequence,command:cmd},location.origin);
  feedback('Sending '+esc(cmd.type)+' to live Unified ECU…');
 };
 function feedback(msg,isError=false){const el=$('command-response');el.textContent=msg;el.classList.toggle('error',isError);}
 const e=()=>$('engine').value;
 const on=(node,kind,cb)=>$(node).addEventListener(kind,cb);
 const command=(type,extras={})=>send({type,engine:e(),...extras});
 function cell(v){
  const text=typeof v==='boolean'?v?'YES':'NO':esc(v);
  const className=/^(VALID|ON|RUNNING|POWERED|YES|OPEN|AVAILABLE)$/.test(text)?'good':
    /^(FAILED|UNIT_FAILED|POWER_LOSS|SENSOR_FAILED|OFF|UNPOWERED|ABNORMAL|NO)$/.test(text)?'bad':'unknown';
  return '<td class="'+className+'">'+String(text).replace(/[<&"]/g,c=>({'<':'&lt;','&':'&amp;','"':'&quot;'}[c]))+'</td>';
 }
 function table(cols,rows){
  const col='<tr>'+cols.map(x=>'<th>'+x+'</th>').join('')+'</tr>';
  const body=rows.map(r=>'<tr>'+r.map(cell).join('')+'</tr>').join('');
  return '<table><thead>'+col+'</thead><tbody>'+body+'</tbody></table>';
 }
 function renderIndications(status){
  const s=status?.snapshot;
  if(!s){$('indications-table').textContent='Engine Indication Backend not ready';return;}
  const rows=[];
  for(const p of ['n1','egt','n2','fuelFlow','oilPressure','oilTemperature','oilQuantity','vibration']){
   for(const side of [1,2]){
    const x=s.engines?.['engine'+side]?.indications?.[p];
    rows.push([p,side,x?.inputValue??'—',x?.value??'—',x?.unit??'—',
     x?.powerBus??'—',x?.power??'—',x?.status??'—',x?.pointer??'—',x?.digital??'—',
     x?.origin??'—']);
   }
  }
  $('indications-table').innerHTML=table(['PARAMETER','ENGINE','SENSOR','DISPLAY','UNIT','FEED BUS','POWER','STATUS','POINTER','DIGITAL','PROVENANCE'],rows);
 }
 function renderStart(state){
  if(!state?.engines){$('start-table').textContent='Start logic not available';return;}
  const rows=[];
  for(const side of [1,2]){
   const x=state.engines['engine'+side];if(!x)continue;
   rows.push([side,x.phase,x.startSwitch,x.ignitionSelector,x.starterValveCommand,
    x.starterValveObserved,x.starterMotorPossible,x.ignitionLeftEligible,x.ignitionRightEligible,
    x.fuelLever,x.atFuelEntryCriterion,x.n2Percent,x.egtC,x.warnings?.join(', ')||'NONE']);
  }
  $('start-table').innerHTML=table(['ENGINE','PHASE','START SW','IGN SEL','VALVE CMD','VALVE ACT','MOTOR','IGN L','IGN R','FUEL LEVER','FUEL ENTRY','N2 %','EGT °C','WARNINGS'],rows);
 }
 function renderSummary(status){
  const s=status?.snapshot;
  if(!s)return;
  const rows=[];
  for(const side of [1,2]){
   const x=s.engines['engine'+side],w=x?.warnings||{};
   for(const name of ['lowOilPressure','oilFilterBypass','startValveOpen','reverserUnlocked',
    'n1Overlimit','n2Overlimit','egtOverlimit','oilTemperatureOverlimit']){
    rows.push([side,name,w[name]?.state||'—',w[name]?.powerBus||'—',
     w[name]?.limitQuality||w[name]?.limit?.origin||'—']);
   }
  }
  rows.push(['—','EIS PRIMARY BITE',String(s.bite?.primaryEligible??'—'),'N1<10% BOTH','SOURCE']);
  rows.push(['—','EIS SECONDARY BITE',String(s.bite?.secondaryEligible??'—'),'OIL P<13 PSI BOTH','SOURCE']);
  rows.push(['—','FUEL USED ENGINE 1',s.fuelUsedKg?.engine1??'—','kg','integrated']);
  rows.push(['—','FUEL USED ENGINE 2',s.fuelUsedKg?.engine2??'—','kg','integrated']);
  $('summary').innerHTML=table(['ENGINE','ANNUNCIATOR/BITE','STATE','POWER/RULE','EVIDENCE'],rows);
 }
 function draw(packet){
  if(!packet)return;
  const state=packet.kind==='ack'?packet.state:packet;
  if(state?.kind!=='snapshot')return;
  latest=state;
  $('connection').textContent=state.ready?'CONNECTED · ONE ECU / ONE ELECTRICAL V7':'WAITING FOR TECH DB / ECU';
  $('connection').style.color=state.ready?'#9bdfbb':'#eac66a';
  $('report-age').textContent=state.ecu?.timeMs===undefined?'NO ECU CLOCK':'ECU CLOCK '+Math.round(state.ecu.timeMs/1000)+'s';
  if(state.snapshot?.mode && $('display').value!==state.snapshot.mode)$('display').value=state.snapshot.mode;
  renderIndications(state);renderStart(state.start);renderSummary(state);
  $('electrical').textContent=JSON.stringify({
   sourceOwner:state.source,selectedSources:state.electrical?.source,
   battery:state.electrical?.config?.batterySwitch,standby:state.electrical?.config?.standbySelector,
   faults:state.electrical?.faults,technicalRevision:state.technicals?.revision,
   liveError:state.error||null},null,2);
 }
 window.addEventListener('message',event=>{
  if(event.source!==window.parent||event.origin!==location.origin||!event.data)return;
  if(event.data.type!=='b737:engine-lab-v2-snapshot')return;
  const pkt=event.data.packet;
  if(pkt?.kind==='ack'&&pkt.sequence===lastRequest){
   feedback(pkt.outcome?.accepted===false?(pkt.outcome.error||'Command rejected'):(pkt.outcome?.message||'Command accepted'),
    pkt.outcome?.accepted===false);
  }
  draw(pkt);
 });
 on('refresh','click',()=>window.parent.postMessage({type:'b737:engine-lab-v2-ready'},location.origin));
 for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>{
  document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('selected',el===b));
  document.querySelectorAll('[data-panel]').forEach(el=>el.hidden=el.dataset.panel!==b.dataset.tab);
 });
 for(const b of document.querySelectorAll('[data-command]'))b.addEventListener('click',()=>{
  const type=b.dataset.command;if(type==='LEVER')command(type,{position:b.dataset.position});
  else if(type==='APU_PRESET')send({type:'APU_PRESET'});
  else command(type);
 });
 on('display','change',()=>send({type:'MODE',mode:$('display').value}));
 on('set-duct','click',()=>command('DUCT_PSI',{psi:Number($('duct').value)}));
 on('throttle','input',()=>{$('throttle-label').textContent=$('throttle').value+'%';});
 on('throttle-set','click',()=>command('THROTTLE',{value:Number($('throttle').value)/100}));
 for(const [id,active]of [['start-fault-on',true],['start-fault-off',false]])on(id,'click',()=>command('START_FAULT',{key:$('start-fault').value,active}));
 for(const [id,active]of [['oil-fault-on',true],['oil-fault-off',false]])on(id,'click',()=>command('OIL_FAULT',{key:$('oil-fault').value,active}));
 for(const [id,active]of [['electric-on',true],['electric-off',false]])on(id,'click',()=>send({type:'ELECTRICAL_FAULT',key:$('electrical-fault').value,active}));
 for(const [id,active]of [['unit-on',true],['unit-off',false]])on(id,'click',()=>send({type:'DISPLAY_FAULT',key:$('unit-fault').value,active}));
 for(const [id,active]of [['channel-on',true],['channel-off',false]])on(id,'click',()=>send({type:'DISPLAY_FAULT',key:$('channel').value+'.'+e().at(-1),active}));
 on('sensor-set','click',()=>send({type:'SENSOR',engine:e(),parameter:$('sensor').value,
  value:Number($('sensor-value').value),condition:'VALID'}));
 on('sensor-fail','click',()=>send({type:'SENSOR',engine:e(),parameter:$('sensor').value,condition:'FAILED'}));
 on('sensor-clear','click',()=>send({type:'SENSOR',engine:e(),parameter:$('sensor').value,condition:'CLEAR'}));
 on('set-fuel-mode','click',()=>send({type:'FUEL_MODE',value:$('fuel-mode').value}));
 on('reset-fuel-used','click',()=>send({type:'RESET_FUEL_USED'}));
 on('set-filter','click',()=>send({type:'FILTER_THRESHOLD',value:$('filter-limit').value===''?null:Number($('filter-limit').value)}));
 on('reset-instruments','click',()=>send({type:'RESET_INSTRUMENT_FAULTS'}));
 if(window.parent!==window)window.parent.postMessage({type:'b737:engine-lab-v2-ready'},location.origin);
 else feedback('This lab needs the live Unified cockpit host; open it using ENGINE TEST LAB',true);
})();
