/* Interactive bus / all-consumer lab. No ECU, CB, or physical bus writes. */
(function(root){
'use strict';
const Core=root.B737ClassicBusConsumersV1;
const E=root.B737ElectricalV7;
const Lab=root.B737BusConsumerTestLabV1;
const $=id=>document.getElementById(id);
const BUS_GROUPS=[
 {name:'AC GENERATOR / MAIN / TRANSFER · 115V',ids:['generator1@115VAC','generator2@115VAC','main1@115VAC','main2@115VAC','transfer1@115VAC','transfer2@115VAC']},
 {name:'AC SERVICE / EXTERNAL · 115V',ids:['groundService@115VAC','external@115VAC']},
 {name:'DC DISTRIBUTION · 28V',ids:['dc1@28VDC','dc2@28VDC','battery@28VDC','hotBattery@28VDC','switchedHotBattery@28VDC']},
 {name:'STANDBY AC / DC',ids:['standby@115VAC','standby@28VDC']},
 {name:'ELECTRONIC 1 / 2',ids:['electronic1@115VAC','electronic2@115VAC','electronic1@28VDC','electronic2@28VDC']},
 {name:'AC CONVERSION · 28V AC',ids:['transfer1@28VAC','transfer2@28VAC','main1@28VAC','main2@28VAC','groundService@28VAC']}
];
const labels={
 generator1:'GEN BUS 1',generator2:'GEN BUS 2',main1:'MAIN BUS 1',main2:'MAIN BUS 2',
 transfer1:'TRANSFER BUS 1',transfer2:'TRANSFER BUS 2',dc1:'DC BUS 1',dc2:'DC BUS 2',
 battery:'BATTERY BUS',hotBattery:'HOT BAT BUS',switchedHotBattery:'SW HOT BAT',
 standby:'STANDBY',
 groundService:'GROUND SERVICE',external:'EXT POWER BUS',
 electronic1:'ELECTRONIC BUS 1',electronic2:'ELECTRONIC BUS 2'
};
const statusLabels={
 NORMAL:'● POWERED',OFF:'● NO POWER',DEGRADED:'● DEGRADED',
 UNKNOWN:'● UNKNOWN',NOT_INSTALLED:'— N/A'
};
let session=null,view='rows',search='',system='ALL',powerState='ALL';
const busButtons=new Map();
function make(tag,parent,text,className){
 const el=document.createElement(tag);
 if(text!==undefined&&text!==null)el.textContent=text;
 if(className)el.className=className;
 if(parent)parent.appendChild(el);
 return el;
}
function setFailure(error){
 $('labError').hidden=false;
 $('labError').textContent='خطا در بارگذاری Test Lab: '+(error?.message||String(error));
 console.error('B737 BUS TEST LAB',error);
}
function busLabel(key){
 const [id,voltage]=key.split('@');
 if(id==='standby')return (voltage==='115VAC'?'AC STBY BUS':'DC STBY BUS')+' · '+voltage;
 return (labels[id]||id.toUpperCase())+' · '+voltage;
}
function makeBusButtons(){
 const all=session.buses;
 const grouped=new Set(BUS_GROUPS.flatMap(g=>g.ids));
 if(all.length!==24||grouped.size!==24||all.some(key=>!grouped.has(key)))
  throw Error('Bus controls must show every one of the 24 source-class nodes');
 const list=$('busList');
 list.replaceChildren();
 busButtons.clear();
 for(const group of BUS_GROUPS){
  const section=make('section',list,null,'bus-group');
  make('h3',section,group.name,'bus-group-title');
  const grid=make('div',section,null,'bus-grid');
  for(const key of group.ids){
   const btn=make('button',grid,null,'bus-toggle');
   btn.type='button';btn.dataset.bus=key;
   btn.title='Independent lab bus toggle: '+key;
   const pair=key.split('@');
   make('span',btn,pair[0]==='standby'?
    (pair[1]==='115VAC'?'AC STBY BUS':'DC STBY BUS'):
    labels[pair[0]]||pair[0].toUpperCase(),'bus-name');
   const text=make('span',btn,'','bus-indicator');
   text.dataset.voltage=pair[1];text.title=pair[1];
   btn.addEventListener('click',()=>run(()=>{
    const old=session.busStates[key];
    if(session.cascade&&!old&&!session.disabled.includes(key)){
     $('scenarioLabel').textContent='UPSTREAM BUS IS OFF · restore the supplying bus first';
     return;
    }
    session.toggle(key);refresh();
   }));
   busButtons.set(key,btn);
  }
 }
 $('busTotal').textContent=all.length+' BUS NODES';
}
function renderBuses(){
 const state=session.busStates,forced=new Set(session.disabled);
 for(const [key,button] of busButtons){
  const on=state[key];
  const forcedOff=forced.has(key);
  button.setAttribute('aria-pressed',String(on));
  button.setAttribute('aria-label',busLabel(key)+' '+(on?'ON':'OFF')+
   (forcedOff?' manually disconnected':!on?' upstream source unavailable':''));
  button.dataset.forced=String(forcedOff);
  button.dataset.cascade=String(!on&&!forcedOff);
  button.title=busLabel(key)+' · '+(on?'ON':'OFF')+
   (!on&&!forcedOff?' (automatic upstream loss)':'');
  const indicator=button.querySelector('.bus-indicator');
  indicator.textContent=(on?'ON':'OFF');
 }
 $('metricBusOn').textContent=Object.values(state).filter(Boolean).length+' / '+session.buses.length;
}
function consumerEntries(snapshot){
 if(view==='rows')return Object.values(snapshot.consumers).map((v,i)=>({
  number:i+1,name:v.name,system:v.system,status:v.powerState,
  feed:v.feedBus.split('|').map(x=>x+' '+v.feedVoltage).join(' / '),
  source:'MRG IV.6 p.'+v.source.printedPage+' / '+v.id+
   (v.duplicateSourceOf?' · SOURCE INDEX DUPLICATE':''),
  details:v.impact+' · DOCUMENT QA: '+v.quality+
   (v.duplicateSourceOf?' · Same referenced power feed as '+v.duplicateSourceOf:''),
  role:v.role
 }));
 return Object.values(snapshot.devices).map((dev,i)=>{
  const parts=dev.channels.map(id=>snapshot.consumers[id]).filter(Boolean);
  const feed=[...new Set(parts.map(p=>p.feedBus+' '+p.feedVoltage))].join(' + ');
  const pages=[...new Set(parts.map(p=>p.source.printedPage))].join(', ');
  return {number:i+1,name:dev.name,system:dev.system,status:dev.state,
   feed,source:'MRG IV.6 p.'+pages+' / '+dev.channels.length+' row(s)',
   details:dev.effect+' / '+dev.topology,role:dev.role};
 });
}
function displayRow(entry){
 const tr=document.createElement('tr');
 tr.dataset.state=entry.status;tr.dataset.consumer=entry.name;
 tr.title=entry.source+' · '+entry.details;
 make('td',tr,String(entry.number),'num');
 const title=make('td',tr);
 make('div',title,entry.name,'consumer-name');
 make('div',title,entry.source,'source-page');
 make('td',tr,entry.feed,'consumer-feed');
 make('td',tr,entry.system,'consumer-system');
 const state=make('td',tr,statusLabels[entry.status]||entry.status,'consumer-status');
 state.dataset.power=entry.status;
 return tr;
}
function renderConsumers(){
 const snapshot=session.snapshot(),all=consumerEntries(snapshot);
 const entries=all.filter(r=>
  (system==='ALL'||system===r.system)&&
  (powerState==='ALL'||powerState===r.status)&&
  (!search||(r.name+' '+r.feed+' '+r.system+' '+r.source).toLowerCase().includes(search))
 );
 const counts={NORMAL:0,OFF:0,DEGRADED:0,UNKNOWN:0,NOT_INSTALLED:0};
 for(const entry of all)counts[entry.status]=(counts[entry.status]||0)+1;
 $('metricOn').textContent=counts.NORMAL;
 $('metricOff').textContent=counts.OFF;
 $('metricOther').textContent=counts.DEGRADED+counts.UNKNOWN+counts.NOT_INSTALLED;
 $('resultCount').textContent='نمایش '+entries.length+' از '+all.length+
  (view==='rows'?' ردیف مصرف‌کننده':' تجهیز منطقی');
 const body=$('consumerBody');
 const fragment=document.createDocumentFragment();
 for(const entry of entries)fragment.appendChild(displayRow(entry));
 if(!entries.length){
  const tr=make('tr',fragment);
  const td=make('td',tr,'با فیلتر فعلی مصرف‌کننده‌ای پیدا نشد.');
  td.colSpan=5;
 }
 body.replaceChildren(fragment);
 const tabRows=view==='rows';
 $('rowsView').classList.toggle('active',tabRows);
 $('devicesView').classList.toggle('active',!tabRows);
 $('rowsView').setAttribute('aria-pressed',String(tabRows));
 $('devicesView').setAttribute('aria-pressed',String(!tabRows));
 $('scenarioLabel').textContent=(session.cascade?'UPSTREAM CASCADE':'INDEPENDENT BUS SWITCHES')+
  ' · '+session.disabled.length+' OFF COMMAND(S)';
}
function refresh(){
 if(!session)return;
 renderBuses();
 renderConsumers();
}
function run(action){
 try{action();}
 catch(error){setFailure(error);}
}
function configure(){
 session.configure({
  aircraftModel:$('modelSelect').value,
  mode:$('indicationSelect').value,
  pressurization:$('pressurizationSelect').value
 });
 refresh();
}
function bind(){
 $('allOn').addEventListener('click',()=>run(()=>{session.all(true);refresh();}));
 $('allOff').addEventListener('click',()=>run(()=>{session.all(false);refresh();}));
 $('resetLab').addEventListener('click',()=>run(()=>{session.restore();$('baselineSelect').value='ALL_ON';refresh();}));
 $('baselineSelect').addEventListener('change',()=>run(()=>{
  session.selectBaseline($('baselineSelect').value);refresh();
 }));
 $('cascadeSwitch').addEventListener('change',()=>run(()=>{
  session.setCascade($('cascadeSwitch').checked);refresh();
 }));
 $('rowsView').addEventListener('click',()=>{view='rows';renderConsumers();});
 $('devicesView').addEventListener('click',()=>{view='devices';renderConsumers();});
 $('searchInput').addEventListener('input',()=>{
  search=$('searchInput').value.trim().toLowerCase();renderConsumers();
 });
 $('systemFilter').addEventListener('change',()=>{system=$('systemFilter').value;renderConsumers();});
 $('stateFilter').addEventListener('change',()=>{powerState=$('stateFilter').value;renderConsumers();});
 for(const el of ['modelSelect','indicationSelect','pressurizationSelect'])
  $(el).addEventListener('change',()=>run(configure));
}
function readProfile(){
 let saved={};
 try{saved=JSON.parse(root.localStorage.getItem('b737classic.aircraft-profile.v1')||'{}');}catch(_){}
 if(['737-300','737-400','737-500'].includes(saved.aircraftModel))
  $('modelSelect').value=saved.aircraftModel;
 if(['EIS','CONVENTIONAL'].includes(saved.engineInstruments))
  $('indicationSelect').value=saved.engineInstruments;
 if(['DCPCS','CPCS'].includes(saved.pressurization))
  $('pressurizationSelect').value=saved.pressurization;
}
async function start(){
 if(!Core||!E||!Lab)throw Error('The bus/electrical engines have not loaded');
 const response=await fetch('../engine/systems/mrg-classic-340-consumer-bus-index-v1.json?v=BUS-LAB-0001',{cache:'no-cache'});
 if(!response.ok)throw Error('MRG 340 consumer index HTTP '+response.status);
 const data=await response.json();
 Core.validate(data);
 readProfile();
 session=Lab.makeSession({Core,Electrical:E,index:data,
  mode:$('indicationSelect').value,
  pressurization:$('pressurizationSelect').value,
  aircraftModel:$('modelSelect').value});
 const snapshot=session.snapshot();
 const category=$('systemFilter');
 for(const system of Object.keys(snapshot.systems).sort()){
  const option=make('option',category,system);option.value=system;
 }
 bind();
 makeBusButtons();
 refresh();
 root.B737BusConsumerTestLabUIV1=Object.freeze({
  getSnapshot:()=>session.snapshot(),getBusState:key=>session.busStates[key],
  listBusNames:()=>session.buses.slice(),getSession:()=>session,
  version:Lab.VERSION,nonMutating:true
 });
}
start().catch(setFailure);
})(window);
