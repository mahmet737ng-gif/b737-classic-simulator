/* Unified ATA24 functional power browser / read-only integration.
 * Uses existing ISN Electrical V7 state, MRG 340 indexed consumers and CB.
 * No second battery, generator, physical system or independent simulation.
 */
(function(root){'use strict';
 const Core=root.B737ClassicBusConsumersV1;
 if(!Core)throw Error('Classic bus consumer engine must load before Unified bridge');
 const INDEX_URL='../../engine/systems/mrg-classic-340-consumer-bus-index-v1.json?v=BUS-CONSUMER-0001';
 let index=null,loadPromise=null,current=null,signature='',ui=null,rowsBody=null,summary=null;
 let query='',filterBus='ALL',limit=80,errors=null;
 const subscribers=new Set(),copy=x=>JSON.parse(JSON.stringify(x));
 function configuration(){
  let saved={};
  try{saved=JSON.parse(localStorage.getItem('b737classic.aircraft-profile.v1')||'{}');}catch(_){}
  const engineMode=document.documentElement.dataset.engineIndication==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
  return {mode:engineMode,
   pressurization:saved.pressurization==='CPCS'?'CPCS':'DCPCS',
   aircraftModel:['737-300','737-400','737-500'].includes(saved.aircraftModel)?
    saved.aircraftModel:'737-300'};
 }
 function electricalInputs(){
  const owner=root.B737ISNCockpitV1;
  const state=owner?.getElectricalState?.();
  const live=state&&root.B737ElectricalV7?.evaluate?.(state);
  return state&&live?{state,live}:null;
 }
 function create(tag,par,text){
  const n=document.createElement(tag);if(text!==undefined)n.textContent=text;
  if(par)par.append(n);return n;
 }
 function row(text,bus,status,breaker,impact,parent){
  const tr=create('tr',parent);tr.dataset.consumerState=status;
  for(const value of [text,bus,status,breaker,impact]){
   const td=create('td',tr,value);
   td.style.cssText='padding:5px;word-break:break-word;border-bottom:1px solid #3c5260';
  }
  return tr;
 }
 function paint(){
  if(!ui||!current)return;
  const c=current.coverage;
  const text='MRG CL '+c.sourceRows+' mapped / '+c.logicalDevices+' devices · '+c.NORMAL+' NORMAL · '+c.OFF+
   ' OFF · '+c.DEGRADED+' DEGRADED · '+c.UNKNOWN+' UNKNOWN · '+c.NOT_INSTALLED+' N/A';
  if(summary.textContent!==text)summary.textContent=text;
  if(!ui.open)return; // opening the details is the only costly DOM paint
  const vals=Object.values(current.consumers).filter(x=>
   (filterBus==='ALL'||x.feedBus.split('|').includes(filterBus))&&
   (!query||(x.name+' '+x.id+' '+x.system).toLowerCase().includes(query)));
  rowsBody.replaceChildren();
  for(const x of vals.slice(0,limit)){
   const tr=row(x.name+' ['+x.id+']',x.feedBus+' '+x.feedVoltage,
    x.powerState,x.cbState,x.impact,rowsBody);
   tr.title='MRG IV.6 p.'+x.source.printedPage+' · '+x.quality;
  }
  const label=ui.querySelector('[data-summary-count]');
  if(label)label.textContent='Showing '+Math.min(limit,vals.length)+' / '+vals.length+' consumers';
  ui.querySelector('[data-more]').disabled=limit>=vals.length;
  const output=ui.querySelector('[data-bus-status]');
  if(output)output.textContent=Object.values(current.buses)
   .map(b=>b.id+': '+b.status).join(' · ');
 }
 function build(){
  if(ui||typeof document.createElement!=='function')return;
  const holder=document.getElementById('electricalLivePanel')||
   document.getElementById('isnQuickEngineControls')||document.getElementById('inspector');
  if(!holder)return;
  ui=create('details',holder);ui.id='unifiedBusConsumersV1';ui.dir='ltr';
  ui.style.cssText='margin:10px 0;padding:8px;border:1px solid #506372;border-radius:8px;font-size:11px';
  const title=create('summary',ui,'ATA24 · BUS → CONSUMERS · MRG 340');
  title.style.cssText='font-weight:bold;cursor:pointer;font-size:12px';
  summary=create('p',ui,'Loading reference index…');
  errors=create('small',ui);errors.style.color='#e9bb72';
  const bar=create('div',ui);bar.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin:10px 0';
  const search=create('input',bar);search.type='search';search.placeholder='Search systems / indicators / consumers';
  search.style.cssText='min-width:155px;flex:1;padding:5px';
  const select=create('select',bar);select.title='Filter by source bus';
  for(const name of ['ALL',...Object.keys(Core.BUS_VOLTAGES)]){
   const opt=create('option',select,name);opt.value=name;
  }
  search.addEventListener('input',()=>{query=search.value.trim().toLowerCase();limit=80;paint();});
  select.addEventListener('change',()=>{filterBus=select.value;limit=80;paint();});
  const busText=create('p',ui);busText.dataset.busStatus='true';
  busText.style.cssText='max-height:90px;overflow:auto;line-height:1.6;color:#bdd4dc';
  const scroller=create('div',ui);scroller.style.cssText='max-height:440px;overflow:auto';
  const table=create('table',scroller);table.style.cssText='width:100%;border-collapse:collapse;font-size:10px';
  const head=create('tr',create('thead',table));
  for(const label of ['Consumer','Bus / class','State','CB','Electrical effect'])
   create('th',head,label).style.cssText='text-align:left;position:sticky;top:0;background:#162633;padding:5px';
  rowsBody=create('tbody',table);
  const foot=create('div',ui);foot.style.cssText='display:flex;gap:8px;align-items:center;margin-top:5px';
  const remaining=create('small',foot);remaining.dataset.summaryCount='true';
  const more=create('button',foot,'Show more');more.dataset.more='true';more.type='button';
  more.addEventListener('click',()=>{limit+=80;paint();});
  create('p',ui,'NORMAL means the electrical function is available; it does not mean the device was commanded ON. Unverified effectivity or conversion remains UNKNOWN. Functional training reference, not aircraft WDM.').style.color='#cbd6dd';
  ui.addEventListener('toggle',paint);
 }
 function refresh(force=false){
  if(!index||!Core||!root.B737ElectricalV7)return null;
  const input=electricalInputs();if(!input)return null;
  const config=configuration(),cb=root.B737UnifiedCB;
  const key=JSON.stringify([input.live.bus,input.live.source,input.live.feed,
   cb?.revision??null,config]);
  if(!force&&key===signature)return current;
  const snapshot=Core.project({index,electrical:input.live,electricalState:input.state,
   ...config,cbAvailable:id=>cb?.available?.(id)??null});
  current=snapshot;signature=key;build();paint();
  root.dispatchEvent(new CustomEvent('b737:bus-consumer-snapshot',{
   detail:{revision:snapshot.revision,coverage:copy(snapshot.coverage),
    systems:copy(snapshot.systems),powerOwner:'Electrical_V7'}}));
  for(const fn of subscribers)try{fn(current);}catch(e){console.warn('Consumer listener failed',e);}
  return current;
 }
 async function load(){
  if(loadPromise)return loadPromise;
  loadPromise=(async()=>{
   const res=await fetch(new URL(INDEX_URL,document.baseURI));
   if(!res.ok)throw Error('MRG consumer index HTTP '+res.status);
   const data=await res.json();Core.validate(data);index=data;
   build();refresh(true);return true;
  })().catch(e=>{build();if(errors)errors.textContent='Source index unavailable: '+e.message;console.error(e);return false;});
  return loadPromise;
 }
 root.B737UnifiedBusConsumerLiveV1=Object.freeze({
  load,refresh,
  getSnapshot:()=>current?copy(current):null,
  getConsumer:id=>current?.consumers?.[id]?copy(current.consumers[id]):null,
  getDevice:name=>current?.devices?.[name]?copy(current.devices[name]):null,
  getBus:(bus,voltage)=>current?.buses?.[bus+'@'+voltage]?copy(current.buses[bus+'@'+voltage]):null,
  getSystem:id=>current?.systems?.[id]?copy(current.systems[id]):null,
  subscribe:fn=>{if(typeof fn!=='function')throw Error('Function required');
   subscribers.add(fn);if(current)fn(current);return ()=>subscribers.delete(fn);}
 });
 for(const event of ['b737:electrical-v7-state','b737:cb-state-change',
  'b737:aircraft-profile-change','b737:engine-indication-view',
  'b737:electrical-owner-ready','b737:unified-ecu-observation'])
  root.addEventListener(event,()=>{if(index)refresh();});
 if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',load,{once:true});
 else load();
})(window);
