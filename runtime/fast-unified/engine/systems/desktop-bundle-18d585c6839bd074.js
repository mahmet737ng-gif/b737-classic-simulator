(async()=>{
;
/* ../../engine/systems/electrical-network-v1.js?v=ATA24-CLASSIC-RECTIFY-0001 */
try{
/* Classic ATA24 live distribution projection. The existing ECU Electrical Pack
 * remains the ONLY state owner. No second source selector or electrical session.
 * FCOM private DB: 6.20.1-4, 6.20.9-12; controls 6.10.7. No manual text/assets.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ElectricalNetworkV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='ELEC-LIVE-0001';
 const BUS_IDS=Object.freeze({generator1:'GENERATOR_BUS_1',generator2:'GENERATOR_BUS_2',
  main1:'MAIN_1',main2:'MAIN_2',transfer1:'TRANSFER_1',transfer2:'TRANSFER_2',
  dc1:'DC_1',dc2:'DC_2',battery:'BATTERY_BUS',hotBattery:'HOT_BATTERY_BUS',
  switchedHotBattery:'SWITCHED_HOT_BATTERY_BUS',acStandby:'AC_STANDBY',
  dcStandby:'DC_STANDBY',groundService:'GROUND_SERVICE'});
 const copy=v=>JSON.parse(JSON.stringify(v));
 const tri=v=>v===true||v===false||v===null;
 const status=v=>v===null?'UNKNOWN':v?'ENERGIZED':'DEENERGIZED';
 function project(state,electrical,{numericMode='NOMINAL_MODEL',measurements={},apuGenerator=null}={}){
  if(state?.schema!=='b737-electrical/7'||electrical?.schema!=='B737_ELECTRICAL_V7_RESULT'||
   state.rev!==electrical.revision)throw Error('Matching shared Electrical Pack state/result required');
  if(!['NOMINAL_MODEL','SENSOR_ONLY'].includes(numericMode))throw Error('Invalid numeric mode');
  if(!measurements||typeof measurements!=='object'||Array.isArray(measurements))throw Error('Invalid measurements');
  // APU ECU owns the independently-excited generator output. A ready APU can
  // deliver source-terminal voltage/frequency while its BUS contactors are OPEN.
  // The electrical V7 source selection still exclusively owns BUS distribution.
  if(apuGenerator!==null&&(
    typeof apuGenerator!=='object'||Array.isArray(apuGenerator)||
    typeof apuGenerator.ready!=='boolean'||
    !Number.isFinite(apuGenerator.voltageV)||apuGenerator.voltageV<0||
    !Number.isFinite(apuGenerator.frequencyHz)||apuGenerator.frequencyHz<0
  ))throw Error('Invalid APU generator ECU observation');
  const sourceMeasurements={...measurements};
  if(apuGenerator?.ready===true&&!Object.hasOwn(sourceMeasurements,'APU'))
   sourceMeasurements.APU={volts:apuGenerator.voltageV,hz:apuGenerator.frequencyHz};
  const c=state.config,f=state.faults,e=electrical,nodes={},edges=[];
  function node(id,kind,powered,feeds=[],nominal=null,reason=null){
   if(!tri(powered))throw Error('Invalid electrical power status');
   const n={id,kind,powered,status:status(powered),feeds:[...feeds],volts:null,hz:null,amps:null,
    numericQuality:'UNAVAILABLE',reason};
   if(powered===false){n.volts=0;if(kind==='AC')n.hz=0;n.numericQuality='DEENERGIZED_MODEL';}
   else if(powered===true&&numericMode==='NOMINAL_MODEL'&&nominal){
    n.volts=nominal.volts;n.hz=kind==='AC'?nominal.hz:null;n.numericQuality='NOMINAL_MODEL';
   }
   const sample=sourceMeasurements[id];
   if(sample!==undefined){
    if(!sample||typeof sample!=='object'||Array.isArray(sample))throw Error('Invalid sensor '+id);
    for(const [key,value]of Object.entries(sample)){
     if(!['volts','hz','amps'].includes(key)||value!==null&&(typeof value!=='number'||!Number.isFinite(value)))throw Error('Invalid sensor value');
     if(key!=='amps'&&value!==null&&value<0)throw Error('Negative voltage/frequency');
     if(key==='hz'&&kind!=='AC'&&value!==null)throw Error('DC node has no frequency');
    }
    if(powered===true){Object.assign(n,sample);n.numericQuality='SENSOR_INPUT';}
   }
   nodes[id]=n;return n;
  }
  function edge(from,to,closed,role='FEED'){
   edges.push({id:from+'>'+to,from,to,closed,role});
  }
  const connected=id=>[1,2].filter(side=>e.source[side]===id);
  const readiness={GEN1:c.engine1Running&&!f.GEN1_FAILED,GEN2:c.engine2Running&&!f.GEN2_FAILED,
   APU:c.apuRunning&&!f.APU_FAILED&&!e.apuAutomaticShutdownRequested,
   EXT:c.onGround&&c.groundPowerAttached&&c.groundPowerQualityGood,BATTERY:e.feed.batteryAvailable};
  for(const id of ['GEN1','GEN2','APU','EXT']){
   const sides=connected(id),available=Boolean(readiness[id]);
   // Engine-driven AC generator output exists at operational drive speed
   // independently of whether its generator breaker/contactor feeds a BUS.
   // The existing engineRunning owner is the training proxy for rated drive
   // speed + excited field; an injected generator failure, or an opened
   // generator-control CB, inhibits that modeled output. FCOM 6.10.3:
   // AC meter selector GEN1/GEN2 reads SOURCE terminals, not bus contactors.
   // Each generator SOURCE is metered upstream of its BUS contactor.
   // APU generator readiness comes from its own ECU plant when available, NOT
   // from GEN1/GEN2 running state or whether an APU GEN switch is ON BUS.
   const engineGenerator=id==='GEN1'||id==='GEN2';
   const apuSource=id==='APU';
   const modeledReady=apuSource&&apuGenerator!==null?
     apuGenerator.ready&&!f.APU_FAILED&&!e.apuAutomaticShutdownRequested:available;
   const field=engineGenerator?
    (globalThis.B737UnifiedCB?.gate('electrical.gen'+id.slice(-1)+'Control',available)??available):
    apuSource?(globalThis.B737UnifiedCB?.gate('electrical.apuGenControl',modeledReady)??modeledReady):null;
   const outputReady=engineGenerator||apuSource?field===true:available;
   const powered=engineGenerator||apuSource?outputReady:
    !available?false:id==='EXT'||sides.length>0?true:null;
   const reason=engineGenerator||apuSource?(outputReady?
    (apuSource?'APU_ECU_SOURCE_OUTPUT_INDEPENDENT_OF_BUS_CONTACTOR':'RATED_DRIVE_EXCITED_NOMINAL_OUTPUT_INDEPENDENT_OF_BUS_CONTACTOR'):
    'STOPPED_FAILED_OR_FIELD_CONTROL_UNAVAILABLE'):
    powered===null?'DISCONNECTED_GENERATOR_FIELD_UNVERIFIED':null;
   node(id,'AC',powered,[],{volts:115,hz:400},reason);
   Object.assign(nodes[id],{available:outputReady,driveAtOperatingSpeed:engineGenerator?Boolean(readiness[id]):apuSource?apuGenerator?.ready??Boolean(readiness[id]):null,
    electricallyExcited:engineGenerator||apuSource?outputReady:null,connectedBusSides:sides,
    busContactorClosed:sides.length>0});
  }
  node('BATTERY','DC',readiness.BATTERY,[],{volts:24});
  Object.assign(nodes.BATTERY,{available:readiness.BATTERY,capacityAh:null,stateOfCharge:null,
   reason:'NOMINAL_24V_NO_DISCHARGE_OR_CHARGE_CHEMISTRY_YET'});
  if(state.battery){
   const b=state.battery;
   Object.assign(nodes.BATTERY,{volts:b.voltageV,amps:b.ammeterA,
    capacityAh:b.capacityAh,stateOfCharge:b.chargeAh/b.capacityAh,
    numericQuality:'BATTERY_DYNAMICS_TRAINING',reason:b.quality});
  }
  function acBus(id,powered,feeds,reason=null){
   const parent=feeds.length?nodes[feeds[0]]:null;
   return node(id,'AC',powered,feeds,parent?{volts:parent.volts,hz:parent.hz}:null,reason);
  }
  for(const side of [1,2]){
   const id='GENERATOR_BUS_'+side,source=e.source[side];
   for(const s of side===1?['GEN1','APU','EXT']:['GEN2','APU','EXT'])edge(s,id,source===s,'SOURCE_CONTACTOR');
   acBus(id,e.bus['generator'+side],source?[source]:[]);
   acBus('MAIN_'+side,e.bus['main'+side],[id]);edge(id,'MAIN_'+side,e.bus['main'+side]);
  }
  for(const side of [1,2]){
   const id='TRANSFER_'+side,feed=e.feed.transferSource[side];
   acBus(id,e.bus['transfer'+side],feed?[feed]:[]);
   for(const sourceSide of [1,2])edge('GENERATOR_BUS_'+sourceSide,id,feed==='GENERATOR_BUS_'+sourceSide,
    side===sourceSide?'NORMAL_TRANSFER':'ALTERNATE_TRANSFER');
  }
  const serviceExternal=c.onGround&&c.groundServiceSelected&&c.groundPowerAttached&&c.groundPowerQualityGood;
  const serviceFeed=serviceExternal?'EXT':'GENERATOR_BUS_1';
  acBus('GROUND_SERVICE',e.bus.groundService,e.bus.groundService?[serviceFeed]:[]);
  edge('EXT','GROUND_SERVICE',Boolean(serviceExternal),'GROUND_SERVICE_RELAY');
  edge('GENERATOR_BUS_1','GROUND_SERVICE',e.bus.groundService&&!serviceExternal);
  for(const [id,feed]of [['TR1','TRANSFER_1'],['TR2','TRANSFER_2'],['TR3','MAIN_2']]){
   node(id,'DC',e.feed.tr[id],[feed],{volts:28});edge(feed,id,e.feed.tr[id],'AC_TO_DC');
  }
  for(const side of [1,2]){
   const feeds=['TR'+side];if(e.feed.tie)feeds.push('TR'+(side===1?2:1));
   const active=feeds.filter(id=>nodes[id].powered===true);
   node('DC_'+side,'DC',e.bus['dc'+side],active,{volts:28},
    e.bus['dc'+side]===null?'TR3_BACKUP_ROUTE_UNVERIFIED':null);
   for(const id of ['TR1','TR2'])edge(id,'DC_'+side,feeds.includes(id)&&nodes[id].powered,
    id==='TR'+side?'NORMAL_DC_FEED':'VIA_DC_TIE');
   // Preserve the unresolved TR3 backup route; never invent a relay path.
   edge('TR3','DC_'+side,e.bus['dc'+side]===null?null:false,'UNVERIFIED_BACKUP');
  }
  // A live battery charger can supply HOT BATTERY BUS even when the cell
  // charge is exhausted. Keep charger and battery as distinct source nodes.
  const chargerFeed=e.feed.chargerSource;
  node('CHARGER','DC',chargerFeed!==null,chargerFeed?[chargerFeed]:[],{volts:28},
   'TRAINING_CHARGE_CAPABILITY_NOT_MEASURED_CURRENT');
  edge('GROUND_SERVICE','CHARGER',chargerFeed==='GROUND_SERVICE','CHARGER_AC_FEED');
  edge('MAIN_2','CHARGER',chargerFeed==='MAIN_2','CHARGER_ALTERNATE_FEED');
  const hotBatterySource=e.feed.hotBatterySource;
  const hotBatteryVolts=hotBatterySource==='CHARGER'?28:nodes.BATTERY.volts;
  node('HOT_BATTERY_BUS','DC',e.bus.hotBattery,hotBatterySource?[hotBatterySource]:[],
   {volts:hotBatteryVolts});
  edge('BATTERY','HOT_BATTERY_BUS',hotBatterySource==='BATTERY','UNSWITCHED');
  edge('CHARGER','HOT_BATTERY_BUS',hotBatterySource==='CHARGER','CHARGER_FEED');
  node('SWITCHED_HOT_BATTERY_BUS','DC',e.bus.switchedHotBattery,['HOT_BATTERY_BUS'],{volts:nodes.HOT_BATTERY_BUS.volts});
  edge('HOT_BATTERY_BUS','SWITCHED_HOT_BATTERY_BUS',c.batterySwitch,'BATTERY_SWITCH');
  const forcedBattery=c.standbySelector==='BAT';
  const batteryFeed=forcedBattery?'HOT_BATTERY_BUS':e.feed.tr.TR3?'TR3':'HOT_BATTERY_BUS';
  const batteryVolts=nodes[batteryFeed].volts;
  node('BATTERY_BUS','DC',e.bus.battery,e.bus.battery?[batteryFeed]:[],{volts:batteryVolts});
  edge('TR3','BATTERY_BUS',e.bus.battery&&!forcedBattery&&c.batterySwitch&&e.feed.tr.TR3,
   'BATTERY_SWITCH_CONTROLLED_TR3_RELAY');
  edge('HOT_BATTERY_BUS','BATTERY_BUS',e.bus.battery&&
   (forcedBattery||(!e.feed.tr.TR3&&c.batterySwitch)),'BATTERY_BUS_CONTROL');
  const normalStandby=e.feed.standbyFeed==='TRANSFER1_DC1';
  const unknownStandby=e.bus.acStandby===null||e.bus.dcStandby===null;
  const batteryStandby=!normalStandby&&c.standbySelector!=='OFF'&&!unknownStandby&&
   (e.bus.acStandby===true||e.bus.dcStandby===true);
  const inverter=unknownStandby?null:batteryStandby&&e.bus.battery&&!f.STATIC_INVERTER_FAILED;
  node('INVERTER','AC',inverter,inverter?['BATTERY_BUS']:[],{volts:115,hz:400},
   unknownStandby?'STANDBY_CONFIGURATION_UNRESOLVED':null);
  edge('BATTERY_BUS','INVERTER',inverter,'DC_TO_AC');
  acBus('AC_STANDBY',e.bus.acStandby,e.bus.acStandby?[normalStandby?'TRANSFER_1':'INVERTER']:[],e.feed.standbyFeed);
  const dcStandbyFeed=normalStandby?'DC_1':'BATTERY_BUS';
  node('DC_STANDBY','DC',e.bus.dcStandby,e.bus.dcStandby?[dcStandbyFeed]:[],
   {volts:normalStandby?28:batteryVolts},e.feed.standbyFeed);
  edge('TRANSFER_1','AC_STANDBY',normalStandby,'NORMAL_STANDBY');
  edge('INVERTER','AC_STANDBY',unknownStandby?null:batteryStandby,'ALTERNATE_STANDBY');
  edge('DC_1','DC_STANDBY',normalStandby,'NORMAL_STANDBY');
  edge('BATTERY_BUS','DC_STANDBY',unknownStandby?null:batteryStandby,'ALTERNATE_STANDBY');
  // Sensor data never energizes a bus. It only replaces numbers on an already
  // energized authoritative node, and never resolves a source/effectivity gap.
  for(const id of Object.keys(measurements))if(!nodes[id])throw Error('Unknown sensor '+id);
  const dc=id=>({volts:nodes[id].volts,amps:nodes[id].amps});
  const ac=id=>({volts:nodes[id].volts,cps:nodes[id].hz});
  const sources={DC:{'STBY PWR':dc('DC_STANDBY'),'BAT BUS':dc('BATTERY_BUS'),BAT:dc('BATTERY'),
    'APU BAT':{volts:null,amps:null},TR1:dc('TR1'),TR2:dc('TR2'),TR3:dc('TR3')},
   AC:{'STBY PWR':ac('AC_STANDBY'),'GND PWR':ac('EXT'),GEN1:ac('GEN1'),
    'APU GEN':ac('APU'),GEN2:ac('GEN2'),INV:ac('INVERTER'),TEST:{volts:null,cps:null}}};
  const qa=copy(e.qa);
  qa.push({id:'NOMINAL_NUMBERS',level:'MODEL_LIMIT',detail:'24/28/115 V and 400 Hz are nominal training values, not a load-flow or battery model.'},
   {id:'APU_BAT_EFFECTIVITY',level:'UNKNOWN',detail:'Separate APU battery installation is not confirmed.'},
   {id:'LOAD_CURRENT',level:'UNKNOWN',detail:'Installed device feeds, CB mapping and currents require per-device evidence.'});
  return {schema:'b737-electrical-network/1',version:VERSION,revision:state.rev,
   authority:'EXISTING_ECU_ELECTRICAL_PACK',numericMode,nodes,edges,meterSources:sources,
   controls:copy(c),faults:copy(f),lamps:copy(e.lamps),galleyShed:e.galleyShed,
   dcTieClosed:e.feed.tie,qa,reference:'FCOM Classic chapter 6; single-battery baseline; EP-FSI effectivity pending'};
 }
 function supply(network,{bus,cbClosed=null,switchOn=true,healthy=true}={}){
  for(const value of [cbClosed,switchOn,healthy])if(!tri(value))throw Error('Three-state consumer inputs required');
  const id=BUS_IDS[bus]||bus,n=network?.nodes?.[id],upstream=n?.powered??null;
  const gates=[upstream,cbClosed,switchOn,healthy];
  const operating=gates.includes(false)?false:gates.includes(null)?null:true;
  return {bus:id||null,busPowered:upstream,cbClosed,switchOn,healthy,operating,
   quality:!n?'UNVERIFIED_BUS':operating===null?'UNRESOLVED_CIRCUIT':'DECLARED_CIRCUIT_MODEL'};
 }
 return Object.freeze({VERSION,BUS_IDS,project,supply});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./electrical-live-unified-v1.js?v=ATA24-CONSUMER-REG-0002 */
try{
/* Phase 1 live electricity: observe the SAME ECU Pack, populate the existing
 * P5-13 selectors/needles, and expose test inputs in Controls. No cockpit art.
 */
(function(root){
 'use strict';
 const Core=root.B737ElectricalNetworkV1;if(!Core)return;
 let current=null,lastKey='',panel=null,errorBox=null,numericMode='NOMINAL_MODEL';
 let lastDistributionBusSignature=null;
 const listeners=new Set(),sourceCache=new Map(),busRows=new Map(),faultInputs=new Map();
 const label={ENERGIZED:'Powered',DEENERGIZED:'Unpowered',UNKNOWN:'Unknown'};
 const copy=v=>JSON.parse(JSON.stringify(v));
 const owner=()=>root.B737ISNCockpitV1;
 function element(tag,text,parent){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(parent)parent.append(n);return n;}
 function showError(error){if(errorBox)errorBox.textContent=error?.message||String(error);}
 function safely(fn){try{if(errorBox)errorBox.textContent='';return fn();}catch(error){showError(error);return null;}}
 function scenario(key,value){
  if(!['groundPowerAttached','onGround'].includes(key)||typeof value!=='boolean')throw Error('Invalid ground scenario');
  const lights=document.getElementById('overheadFrame')?.contentWindow?.B737OverheadLights;
  if(!lights?.setScenario)throw Error('Overhead panel is not ready.');
  // Use the actual iframe scenario owner so its next snapshot cannot undo
  // the input. Existing transport -> Gateway -> same Pack remains authoritative.
  lights.setScenario({[key]:value});return {pending:true};
 }
 function fault(id,active){
  if(!root.B737ElectricalV7.FAULTS.includes(id)||typeof active!=='boolean')throw Error('Invalid electrical fault');
  if(!owner())throw Error('Electrical engine is not ready.');
  owner().instructor({type:'ELECTRICAL',action:{type:'FAULT',id,active,instructor:true}});
  refresh();return snapshot();
 }
 function control(key,value){
  if(!['groundPowerQualityGood','groundServiceSelected'].includes(key)||typeof value!=='boolean')throw Error('Invalid instructor environment control');
  if(!owner())throw Error('Electrical engine is not ready.');
  owner().instructor({type:'ELECTRICAL',action:{type:'CONTROL',key,value}});refresh();
 }
 function snapshot(){return current?copy(current):null;}
 function updateMeters(network){
  if(!root.B737UnifiedAcDcSelectors)return;
  for(const [side,sources]of Object.entries(network.meterSources))for(const [position,measurement]of Object.entries(sources)){
   const id=side+':'+position,key=JSON.stringify(measurement);
   if(sourceCache.get(id)===key)continue;
   root.dispatchEvent(new CustomEvent('b737:ac-dc-source-measurement',{detail:{side,position,measurement}}));
   sourceCache.set(id,key);
  }
 }
 function refresh(){
  const profiler=root.B737InteractionProfilerV1;
  const profileStart=profiler?performance.now():0;
  const p=owner();if(!p?.getElectricalState||!p?.getState)return null;
  const state=p.getElectricalState(),electrical=p.getState().state.electrical;
  const sourceAPU=p.getECUState?.()?.apu?.generator;
  // Read ONLY the authoritative APU ECU generator terminal values, never the
  // GEN1/GEN2 status or selected BUS. Null preserves legacy model fallback.
  const apuGenerator=sourceAPU&&typeof sourceAPU.ready==='boolean'?
   {ready:sourceAPU.ready,voltageV:sourceAPU.voltageV,frequencyHz:sourceAPU.frequencyHz}:null;
  const key=state.rev+':'+numericMode;
  // Reset can reuse a revision. Include effective inputs/result so a reset
  // cannot leave stale energized instruments on the display.
  const signature=key+':'+JSON.stringify([state.config,state.source,state.faults,electrical.bus,state.battery,apuGenerator]);
  if(signature===lastKey)return snapshot();
  const next=Core.project(state,electrical,{numericMode,apuGenerator});
  const projectionDone=profiler?performance.now():0;
  current=next;lastKey=signature;buildPanel();updateMeters(next);
  // The electrical state, network notifications and real meter readings
  // remain live; only instructor-only table DOM writes are skipped.
  if(document.body.classList.contains('side-open'))paint();
  const painted=profiler?performance.now():0;
  // Only the drive-running bit is used by the RESID adapter; Boolean bus
  // connectivity is never promoted to an inferred GCR/field/residual sensor.
  root.dispatchEvent(new CustomEvent('b737:electrical-v7-state',{detail:{state:copy(state)}}));
   // ATA24 consumers do not listen to every ECU/electrical render.
   // Notify their hub ONLY when one of the actual distribution bus flags changes.
   const distributionSignature=JSON.stringify([electrical.bus||{},
    state.config?.onGround??null,state.config?.groundPowerAttached??null,
    state.config?.groundPowerQualityGood??null]);
   if(distributionSignature!==lastDistributionBusSignature){
    lastDistributionBusSignature=distributionSignature;
    root.dispatchEvent(new CustomEvent('b737:electrical-distribution-changed',{
     detail:{owner:'ELECTRICAL_V7',source:'LIVE_DISTRIBUTION_CHANGE'}}));
   }
  root.dispatchEvent(new CustomEvent('b737:electrical-network',{detail:snapshot()}));
  for(const fn of listeners)try{fn(snapshot());}catch(error){console.error('Electrical subscriber failed',error);}
  if(profiler){
   const finished=performance.now();
   profiler.markWork('ATA24 evaluate and project',projectionDone-profileStart);
   profiler.markWork('ATA24 panel DOM update',painted-projectionDone);
   profiler.markWork('ATA24 events and subscribers',finished-painted);
   profiler.markWork('ATA24 refresh total',finished-profileStart);
  }
  return snapshot();
 }
 function checkbox(parent,id,text,handler){
  const line=element('label',undefined,parent);line.style.cssText='display:flex;gap:8px;align-items:center;margin:7px 0';
  const input=element('input',undefined,line);input.type='checkbox';input.id=id;
  element('span',text,line);input.addEventListener('change',()=>safely(()=>handler(input.checked)));return input;
 }
 function buildPanel(){
  if(panel)return;
  const holder=document.getElementById('isnBridgePanel');if(!holder)return;
  panel=element('section');panel.id='electricalLivePanel';
  panel.style.cssText='border:1px solid #45606b;border-radius:10px;padding:12px;margin:14px 0;line-height:1.7';
  element('h2','Live Electrical · Phase 1',panel);
  element('p','Installed battery charge and discharge evolve in real time. Actual modeled current and charge appear on BAT indicators. AC values are nominal; battery consumption is a training profile.',panel);
  const help=element('p','Ground test: select BATTERY ON, connect GPU cable, then select the physical GRD PWR switch ON. AC/DC selectors read the installed gauges.',panel);
  help.style.color='#bde6cf';
  checkbox(panel,'electricalGpuAttached','Ground Power Cable Connected',value=>scenario('groundPowerAttached',value));
  checkbox(panel,'electricalOnGround','Aircraft on Ground',value=>scenario('onGround',value));
  const env=element('details',undefined,panel);element('summary','Ground Power Quality and Ground Service',env);
  checkbox(env,'electricalGpuQuality','Ground Power Quality Acceptable',value=>control('groundPowerQualityGood',value));
  checkbox(env,'electricalGroundService','Ground Service Selected',value=>control('groundServiceSelected',value));
  element('p','Ground Service can power service loads and charger without energizing every aircraft bus.',env);
  const numbers=element('label','Gauge Display: ',panel),select=element('select',undefined,numbers);
  select.id='electricalNumericMode';
  for(const [value,text]of [['NOMINAL_MODEL','Nominal Model Values'],['SENSOR_ONLY','Sensor Input Only; missing values remain UNKNOWN']]){
   const opt=element('option',text,select);opt.value=value;
  }
  select.addEventListener('change',()=>safely(()=>{numericMode=select.value;refresh();}));
  const source=element('p','',panel);source.id='electricalLiveSources';source.dir='ltr';
  const scroll=element('div',undefined,panel);scroll.style.cssText='overflow-x:auto';
  const table=element('table',undefined,scroll);table.style.cssText='width:100%;table-layout:fixed;font-size:11px;direction:ltr;text-align:left;border-collapse:collapse';
  const head=element('tr',undefined,element('thead',undefined,table));
  for(const [i,text]of ['Bus / unit','State','Feed','V','Hz'].entries()){const th=element('th',text,head);th.style.width=[28,18,28,14,12][i]+'%';th.style.whiteSpace='normal';}
  const body=element('tbody',undefined,table);
  for(const id of [...Object.values(Core.BUS_IDS),'TR1','TR2','TR3','INVERTER','CHARGER']){
   const row=element('tr',undefined,body);row.dataset.electricalNode=id;
   row.style.borderTop='1px solid #344c57';
   const cols=Array.from({length:5},()=>element('td','',row));cols[0].textContent=id;for(const cell of cols)cell.style.cssText='white-space:normal;overflow-wrap:anywhere;padding:4px 2px';busRows.set(id,{row,cols});
  }
  const fail=element('details',undefined,panel);element('summary','Inject Electrical Failure for Panel Test',fail);
  for(const id of root.B737ElectricalV7.FAULTS){
   const input=checkbox(fail,'electricalFault-'+id,id,value=>fault(id,value));faultInputs.set(id,input);
  }
  const clear=element('button','Clear Injected Failures',fail);clear.type='button';
  clear.onclick=()=>safely(()=>{for(const [id,active]of Object.entries(current?.faults||{}))if(active)fault(id,false);});
  const qa=element('p','',panel);qa.id='electricalLiveUnknown';qa.style.color='#edc87b';
  errorBox=element('p','',panel);errorBox.id='electricalLiveError';errorBox.setAttribute('role','status');
  holder.prepend(panel);
 }
 function paint(){
  if(!panel||!current)return;
  const n=current.nodes;
  document.getElementById('electricalLiveSources').textContent=['GEN1','GEN2','APU','EXT','BATTERY'].map(id=>{
   const source=n[id];return id+': '+(source.available?'AVAILABLE':'UNAVAILABLE')+
    (source.connectedBusSides?.length?' → BUS '+source.connectedBusSides.join('+'):'');
  }).join(' | ');
  for(const [id,{row,cols}]of busRows){
   const value=n[id];row.dataset.power=value.status;cols[1].textContent=label[value.status];
   cols[1].style.color=value.powered===null?'#edc87b':value.powered?'#8fdfb4':'#a9b8bf';
   cols[2].textContent=value.feeds.join(' + ')||'—';cols[3].textContent=value.volts??'—';cols[4].textContent=value.hz??'—';
   row.title=value.reason||value.numericQuality;
  }
  for(const [id,key]of [['electricalGpuAttached','groundPowerAttached'],['electricalOnGround','onGround'],
   ['electricalGpuQuality','groundPowerQualityGood'],['electricalGroundService','groundServiceSelected']])document.getElementById(id).checked=current.controls[key];
  for(const [id,input]of faultInputs)input.checked=current.faults[id];
  const unresolved=current.qa.filter(item=>!['NOMINAL_NUMBERS','LOAD_CURRENT','APU_BAT_EFFECTIVITY'].includes(item.id)).map(item=>item.id);
  document.getElementById('electricalLiveUnknown').textContent='APU BAT and consumer CB paths remain unverified.'+
   (unresolved.length?' Outstanding: '+unresolved.join(' · '):'')+
   (current.galleyShed?' · GALLEY LOAD SHED':'');
 }
 root.B737UnifiedElectricalLive=Object.freeze({version:Core.VERSION,snapshot,refresh,scenario,fault,
  supply:input=>Core.supply(current,input),
  subscribe(fn){if(typeof fn!=='function')throw Error('Subscriber function required');listeners.add(fn);if(current)fn(snapshot());return ()=>listeners.delete(fn);}
 });
 for(const event of ['b737:electrical-owner-ready','b737:unified-ecu-observation'])root.addEventListener(event,()=>{
  const profiler=event==='b737:unified-ecu-observation'?root.B737InteractionProfilerV1:null;
  const started=profiler?performance.now():0;
  try{safely(refresh);}
  finally{if(profiler)profiler.markWork('ECU listener ATA24 live network',performance.now()-started);}
 });
 document.getElementById('inspectorToggle')?.addEventListener('click',()=>{
  setTimeout(()=>{if(document.body.classList.contains('side-open')&&current)paint();},0);
 });
 safely(refresh);
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/classic-electrical-event-hub-v1.js?v=ATA24-EVENT-HUB-0001 */
try{
/* B737 Classic ATA24: event-driven electrical delta dispatch; no polling. */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicElectricalEventHubV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='ATA24-EVENT-HUB-0001';
 const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
 const caps=d=>JSON.stringify(d?.capabilities||{});
 const feeds=d=>(d?.feedChannels||[]).map(x=>x.key+':'+x.status+':'+x.cbState).join('|');
 const channels=['bus','device','consumer','capability','system'];
 function createHub(){
  let previous=null,sequence=0;
  const handlers=Object.fromEntries(channels.map(k=>[k,new Map()]));
  const stats={accepted:0,unchanged:0,busChanges:0,deviceChanges:0,consumerChanges:0,capabilityChanges:0,systemChanges:0,callbacks:0};
  const keyFor=(name,purpose)=>JSON.stringify([name,purpose]);
  function value(type,key,snap){
   if(!snap)return null;
   if(type==='bus')return snap.buses[key]||null;
   if(type==='device')return snap.devices[key]||null;
   if(type==='consumer')return snap.consumers[key]||null;
   if(type==='system')return snap.systems[key]||null;
   if(type==='capability'){
    const [name,purpose]=JSON.parse(key),obj=snap.devices[name]?.capabilities;
    return obj&&Object.hasOwn(obj,purpose)?{name,purpose,available:obj[purpose]}:null;
   }
   return null;
  }
  function sendOne(fn,data){
   try{fn(Object.freeze(data));stats.callbacks++;}
   catch(e){if(typeof console!=='undefined')console.warn('ATA24 subscriber callback',e);}
  }
  function emit(type,key,data){
   for(const cb of handlers[type].get(key)||[])sendOne(cb,data);
  }
  function register(type,key,cb,{immediate=true}={}){
   if(typeof cb!=='function'||typeof key!=='string'||!key)
    throw Error('Invalid electrical subscription');
   if(!handlers[type].has(key))handlers[type].set(key,new Set());
   handlers[type].get(key).add(cb);
   if(immediate&&previous){
    const v=value(type,key,previous);
    if(v!==null)sendOne(cb,{type:'INITIAL',target:key,previous:null,
     value:clone(v),sequence,reason:'CURRENT_SNAPSHOT'});
   }
   return ()=>{const set=handlers[type].get(key);if(!set)return;
    set.delete(cb);if(!set.size)handlers[type].delete(key);};
  }
  function publish(snap,{reason='ELECTRICAL_CHANGE'}={}){
   if(!snap?.buses||!snap.devices||!snap.consumers||!snap.systems)
    throw Error('Complete electrical snapshot required');
   if(!previous){
    previous=snap;stats.accepted++;sequence++;
    for(const type of channels)for(const [key,set]of handlers[type]){
     const v=value(type,key,snap);
     if(v!==null)for(const fn of set)sendOne(fn,{type:'INITIAL',
      target:key,previous:null,value:clone(v),sequence,reason});
    }
    return {changed:true,initial:true,buses:[],devices:[],consumers:[],systems:[]};
   }
   const busKeys=Object.keys(snap.buses).filter(k=>
    previous.buses[k]?.powered!==snap.buses[k].powered);
   const devNames=Object.keys(snap.devices).filter(k=>{
    const a=previous.devices[k],b=snap.devices[k];
    return !a||a.state!==b.state||a.topology!==b.topology||
     feeds(a)!==feeds(b)||caps(a)!==caps(b);
   });
   const rowIds=Object.keys(snap.consumers).filter(k=>{
    const a=previous.consumers[k],b=snap.consumers[k];
    return !a||a.powerState!==b.powerState||a.cbState!==b.cbState;
   });
   const sysNames=Object.keys(snap.systems).filter(k=>
    previous.systems[k]?.state!==snap.systems[k].state);
   if(!busKeys.length&&!devNames.length&&!rowIds.length&&!sysNames.length){
    stats.unchanged++;return {changed:false,initial:false,buses:[],devices:[],consumers:[],systems:[]};
   }
   const old=previous;previous=snap;sequence++;stats.accepted++;
   const meta={sequence,reason};
   for(const key of busKeys){
    const powered=snap.buses[key].powered;
    emit('bus',key,{...meta,target:key,type:powered===true?'POWER_RESTORED':
     powered===false?'POWER_LOST':'POWER_UNKNOWN',
     previous:old.buses[key]?.powered??null,value:powered});
   }
   let capabilityChanges=0;
   for(const name of devNames){
    const before=old.devices[name],now=snap.devices[name];
    emit('device',name,{...meta,type:'DEVICE_FEED_CHANGED',target:name,
     previous:clone(before),value:clone(now),changedBusKeys:busKeys});
    const previousCaps=before?.capabilities||{},currentCaps=now.capabilities||{};
    for(const purpose of new Set([...Object.keys(previousCaps),...Object.keys(currentCaps)])){
     if(previousCaps[purpose]===currentCaps[purpose])continue;
     capabilityChanges++;
     emit('capability',keyFor(name,purpose),{...meta,type:'CAPABILITY_CHANGED',
      name,purpose,target:keyFor(name,purpose),
      previous:previousCaps[purpose]??null,value:currentCaps[purpose]??null,changedBusKeys:busKeys});
    }
   }
   for(const id of rowIds)emit('consumer',id,{...meta,type:'CONSUMER_POWER_CHANGED',
    target:id,previous:clone(old.consumers[id]),value:clone(snap.consumers[id]),changedBusKeys:busKeys});
   for(const id of sysNames)emit('system',id,{...meta,type:'SYSTEM_POWER_CHANGED',
    target:id,previous:old.systems[id]?.state??null,value:snap.systems[id].state,changedBusKeys:busKeys});
   stats.busChanges+=busKeys.length;stats.deviceChanges+=devNames.length;
   stats.consumerChanges+=rowIds.length;stats.capabilityChanges+=capabilityChanges;
   stats.systemChanges+=sysNames.length;
   return {changed:true,initial:false,buses:busKeys,devices:devNames,consumers:rowIds,systems:sysNames};
  }
  return Object.freeze({version:VERSION,publish,
   subscribeBus:(key,fn,opts)=>register('bus',key,fn,opts),
   subscribeDevice:(key,fn,opts)=>register('device',key,fn,opts),
   subscribeConsumer:(key,fn,opts)=>register('consumer',key,fn,opts),
   subscribeSystem:(key,fn,opts)=>register('system',key,fn,opts),
   subscribeCapability:(name,purpose,fn,opts)=>register('capability',keyFor(name,purpose),fn,opts),
   getBus:key=>clone(value('bus',key,previous)),
   getDevice:key=>clone(value('device',key,previous)),
   getStats:()=>({...stats,sequence,activeSubscriptions:Object.values(handlers).reduce(
    (n,map)=>n+[...map.values()].reduce((m,set)=>m+set.size,0),0)}),
   get initialized(){return !!previous;}
  });
 }
 return Object.freeze({VERSION,createHub});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./bus-consumer-unified-v1.js?v=ATA24-CONSUMER-REG-0002 */
try{
/* Unified ATA24 functional power browser / read-only integration.
 * Uses existing ISN Electrical V7 state, MRG 340 indexed consumers and CB.
 * No second battery, generator, physical system or independent simulation.
 */
(function(root){'use strict';
 const Core=root.B737ClassicBusConsumersV1;
 if(!Core)throw Error('Classic bus consumer engine must load before Unified bridge');
 const EventHub=root.B737ClassicElectricalEventHubV1;
 if(!EventHub?.createHub)throw Error('ATA24 event hub required');
 const dispatcher=EventHub.createHub();
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
  const key=JSON.stringify([input.live.bus,input.live.busClassOutages||[],
   input.state.config?.onGround??null,input.state.config?.groundPowerAttached??null,
   input.state.config?.groundPowerQualityGood??null,
   cb?.revision??null,config]);
  if(!force&&key===signature)return current;
  const snapshot=Core.project({index,electrical:input.live,electricalState:input.state,
   ...config,cbAvailable:id=>cb?.available?.(id)??null});
  current=snapshot;signature=key;
  const delta=dispatcher.publish(snapshot,{reason:'ELECTRICAL_CB_OR_PROFILE_CHANGE'});
  build();if(delta.changed)paint();
  if(delta.changed)root.dispatchEvent(new CustomEvent('b737:bus-consumer-snapshot',{
   detail:{revision:snapshot.revision,coverage:copy(snapshot.coverage),
    systems:copy(snapshot.systems),powerOwner:'Electrical_V7'}}));
  if(delta.changed)for(const fn of subscribers)try{fn(current);}
   catch(e){console.warn('Consumer listener failed',e);}
  return current;
 }
 async function load(){
  if(loadPromise)return loadPromise;
  loadPromise=(async()=>{
   const res=await fetch(new URL(INDEX_URL,document.baseURI));
   if(!res.ok)throw Error('MRG consumer index HTTP '+res.status);
   const data=await res.json();Core.validate(data);
   if(!root.B737ClassicMultifeedV1?.validateIndex)throw Error('Multi-feed authority missing');
   root.B737ClassicMultifeedV1.validateIndex(data);index=data;
   build();refresh(true);return true;
  })().catch(e=>{build();if(errors)errors.textContent='Source index unavailable: '+e.message;console.error(e);return false;});
  return loadPromise;
 }
 root.B737UnifiedBusConsumerLiveV1=Object.freeze({
  load,refresh,
  getSnapshot:()=>current?copy(current):null,
  getConsumer:id=>current?.consumers?.[id]?copy(current.consumers[id]):null,
  getDevice:name=>current?.devices?.[name]?copy(current.devices[name]):null,
  getCapability:(name,purpose)=>current?.devices?.[name]?.capabilities?.[purpose]??null,
  getBus:(bus,voltage)=>current?.buses?.[bus+'@'+voltage]?copy(current.buses[bus+'@'+voltage]):null,
  getSystem:id=>current?.systems?.[id]?copy(current.systems[id]):null,
  subscribeBus:dispatcher.subscribeBus,
  subscribeDevice:dispatcher.subscribeDevice,
  subscribeConsumer:dispatcher.subscribeConsumer,
  subscribeCapability:dispatcher.subscribeCapability,
  subscribeSystem:dispatcher.subscribeSystem,
  getEventStats:dispatcher.getStats,
  subscribe:fn=>{if(typeof fn!=='function')throw Error('Function required');
   subscribers.add(fn);if(current)fn(current);return ()=>subscribers.delete(fn);}
 });
 for(const event of ['b737:electrical-distribution-changed','b737:cb-state-change',
  'b737:aircraft-profile-change','b737:engine-indication-view',
  'b737:electrical-owner-ready','b737:bus-failure-injection-changed'])
  root.addEventListener(event,()=>{if(index)refresh();});
 if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',load,{once:true});
 else load();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/battery-dynamics-v1.js?v=BATTERY-LIVE-0001 */
try{
/* Coulomb-counted training battery. 24V NiCd identity: Classic FCOM 6.20.9.
 * Capacity, OCV curve, resistance and charger rates are explicit TRAINING
 * parameters, not an EP-FSI battery part-number or certified endurance claim.
 * Positive ammeter current = charge; negative = discharge.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737BatteryDynamicsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const PROFILE=Object.freeze({capacityAh:40,resistanceOhm:0.012,chargerMaxA:25,
  chargerTargetA:20,chargerVolts:28,minimumBusVolts:21,quality:'TRAINING_PARAMETERS_NOT_EP_FSI_CALIBRATED'});
 const copy=v=>JSON.parse(JSON.stringify(v));
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function number(v,name,min=0,max=Infinity){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('Invalid battery '+name);return v;}
 function initial({capacityAh=PROFILE.capacityAh,chargeAh=capacityAh}={}){
  number(capacityAh,'capacity',1,200);number(chargeAh,'charge',0,capacityAh);
  return {schema:'b737-battery/1',capacityAh,chargeAh,elapsedSec:0,dischargedAh:0,chargedAh:0,
   dischargedWh:0,chargedWh:0,voltageV:ocv(chargeAh/capacityAh),ammeterA:0,
   dischargeA:0,chargeA:0,loadWatts:0,chargerA:0,depleted:chargeAh===0,loads:[],
   quality:PROFILE.quality};
 }
 function ocv(soc){
  number(soc,'SOC',0,1);
  // Deliberately simplified NiCd plateau and end-of-discharge knee.
  return soc<0.1?22+soc*20:24+((soc-0.1)/0.9)*1.5;
 }
 function inputs(value={}){
  const {loadAmps=0,inverterWatts=0,chargerAvailable=false,forcedFailed=false,loads=[]}=value;
  number(loadAmps,'load',0,2000);number(inverterWatts,'AC load',0,10000);
  if(typeof chargerAvailable!=='boolean'||typeof forcedFailed!=='boolean'||!Array.isArray(loads))throw Error('Invalid battery source inputs');
  return {loadAmps,inverterWatts,chargerAvailable,forcedFailed,loads:copy(loads)};
 }
 function validate(s){
  if(s?.schema!=='b737-battery/1')throw Error('Battery state required');
  number(s.capacityAh,'capacity',1,200);number(s.chargeAh,'charge',0,s.capacityAh);
  for(const key of ['elapsedSec','dischargedAh','chargedAh','dischargedWh','chargedWh'])number(s[key],key);
 }
 function sample(s,i){
  const soc=s.chargeAh/s.capacityAh,openVolts=ocv(soc);
  const demand=i.loadAmps+i.inverterWatts/(Math.max(21,openVolts)*0.85);
  let charger=0,net=-demand;
  if(i.chargerAvailable&&!i.forcedFailed){
   const taper=clamp((1-soc)/0.1,0,1)*PROFILE.chargerTargetA;
   charger=Math.min(PROFILE.chargerMaxA,demand+taper);net=charger-demand;
  }
  if(i.forcedFailed){net=0;charger=0;}
  if(s.chargeAh<=0&&net<0)net=0;
  if(s.chargeAh>=s.capacityAh&&net>0)net=0;
  const voltage=i.chargerAvailable&&!i.forcedFailed&&demand<=PROFILE.chargerMaxA?
   PROFILE.chargerVolts:Math.max(0,openVolts+net*PROFILE.resistanceOhm);
  return {voltageV:voltage,ammeterA:net,dischargeA:Math.max(0,-net),chargeA:Math.max(0,net),
   loadWatts:demand*voltage,chargerA:charger,
   depleted:s.chargeAh<=0||i.forcedFailed,
   available:!i.forcedFailed&&s.chargeAh>0&&voltage>=PROFILE.minimumBusVolts};
 }
 function step(state,dtSec,rawInputs={}){
  validate(state);number(dtSec,'clock step',0,86400);const i=inputs(rawInputs),s=copy(state);
  // <=1s integration: equivalent foreground ticks and a throttled background
  // catch-up use the same load/voltage curve. No accelerated UI clock.
  let remaining=dtSec;
  while(remaining>0){
   const dt=Math.min(1,remaining),p=sample(s,i),before=s.chargeAh;
   s.chargeAh=clamp(before+p.ammeterA*dt/3600,0,s.capacityAh);
   const delta=s.chargeAh-before;
   if(delta<0){s.dischargedAh-=delta;s.dischargedWh-=delta*p.voltageV;}
   else{s.chargedAh+=delta;s.chargedWh+=delta*p.voltageV;}
   s.elapsedSec+=dt;remaining-=dt;
  }
  Object.assign(s,sample(s,i),{loads:i.loads});return s;
 }
 function snapshot(state){validate(state);const s=copy(state),soc=s.chargeAh/s.capacityAh;
  return {...s,soc,percent:soc*100,remainingWh:s.chargeAh*24,
   remainingMinutes:s.dischargeA>0?s.chargeAh/s.dischargeA*60:null,
   status:s.depleted?'EMPTY':s.chargeA>0.01?'CHARGING':s.dischargeA>0.01?'DISCHARGING':'HOLD'};
 }
 return Object.freeze({PROFILE,initial,step,snapshot,ocv});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/integration/battery-panel-loads-v1.js?v=ATA24-CLASSIC-RECTIFY-0001 */
try{
/* Explicit starter/panel load PROFILE, not installed-aircraft WDM currents.
 * Live hardware positions and supply paths decide which profile loads draw.
 * AC fuel/hydraulic pumps are intentionally not invented as battery loads.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737BatteryPanelLoadsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 function project(state,e,{litLamps=0,brightness=50,apuPhase='OFF',irsModes={L:'OFF',R:'OFF'}}={}){
  if(state?.schema!=='b737-electrical/7'||e?.revision!==state.rev)throw Error('Matching electrical owner required');
  if(!Number.isInteger(litLamps)||litLamps<0||litLamps>500||!Number.isFinite(brightness)||brightness<0||brightness>100)throw Error('Invalid live panel load input');
  const loads=[],c=state.config,b=e.bus;
  function add(id,bus,amps,active){
   const powered=b[bus]===true;
   const cellFeedsHot=e.feed.hotBatterySource==='BATTERY';
   const fromBattery=(bus==='hotBattery'||bus==='switchedHotBattery')&&
    (cellFeedsHot||id==='APU_STARTER')||
    bus==='battery'&&(c.standbySelector==='BAT'||!e.feed.tr.TR3)&&cellFeedsHot||
    bus==='dcStandby'&&e.feed.standbyFeed!=='TRANSFER1_DC1'&&cellFeedsHot;
   loads.push({id,bus,amps:active&&powered?amps:0,fromBattery:Boolean(fromBattery),
    active:Boolean(active&&powered),quality:'LIVE_SWITCH_WITH_TRAINING_CURRENT'});
  }
  add('HOT_BUS_KEEP_ALIVE','hotBattery',0.05,true);
  add('SWITCHED_CONTROL_RELAYS','switchedHotBattery',1.2,true);
  add('DC_PANEL_ELECTRONICS','battery',3,true);
  add('INSTRUMENT_BACKLIGHT','battery',4*brightness/100,true);
  add('ILLUMINATED_PANEL_LAMPS','battery',litLamps*0.06,true);
  add('APU_INLET_DOOR_MOTOR','hotBattery',2,apuPhase==='INLET_DOOR');
  add('APU_STARTER','hotBattery',250,apuPhase==='STARTING');
  for(const side of ['L','R']){
   if(!['OFF','ALIGN','NAV','ATT'].includes(irsModes[side]))throw Error('Invalid IRS load selector');
   // Right backup cutoff is a separate IRS engine responsibility; these are
   // panel-training current estimates, never a CB installation assertion.
   add('IRS_'+side+'_DC_CONTROL','switchedHotBattery',3.5,irsModes[side]!=='OFF');
  }
  add('DC_STANDBY_EQUIPMENT','dcStandby',8,true);
  const inverterOn=b.acStandby===true&&e.feed.standbyFeed!=='TRANSFER1_DC1';
  const inverterWatts=inverterOn?160:0;
  return {loadAmps:loads.filter(x=>x.fromBattery).reduce((sum,x)=>sum+x.amps,0),inverterWatts,
   chargerAvailable:e.feed.chargerSource!==null,
   forcedFailed:state.faults.BATTERY_DEPLETED,loads,
   panelPower:b.battery===true||b.dc1===true||b.dc2===true||b.dcStandby===true,
   quality:'TRAINING_CURRENTS_AND_FEED_GROUPS_NOT_EP_FSI_LOAD_SCHEDULE'};
 }
 return Object.freeze({project});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./battery-panel-live-v1.js?v=BAT-CONTROLS-0001 */
try{
/* Installed battery -> existing BAT selector/ammeter/voltmeter and panel power.
 * Real elapsed seconds, persistent charge, no Controls page or fast-time switch.
 */
(function(root){
 'use strict';
 const Engine=root.B737BatteryDynamicsV1,Loads=root.B737BatteryPanelLoadsV1;
 if(!Engine||!Loads)return;
 const STORE='b737classic.live-battery.v1';
 let attached=false,busy=false,readout=null,lastAt=Date.now(),lastInputs=null,lastPower=null,
  savedAt=0,timer=null,current=null,restored=false;
 const owner=()=>root.B737ISNCockpitV1;
 const copy=v=>JSON.parse(JSON.stringify(v));
 function stored(){
  try{const data=JSON.parse(localStorage.getItem(STORE)||'null');
   if(data?.schema==='b737-saved-battery/1'){const b=Engine.step(data.state,0);restored=true;return b;}
  }catch(error){console.warn('Battery saved charge unavailable:',error.message);}
  return null;
 }
 function save(){
  if(!attached)return;
  try{localStorage.setItem(STORE,JSON.stringify({schema:'b737-saved-battery/1',state:owner().getElectricalState().battery}));savedAt=Date.now();}
  catch(error){if(readout)readout.dataset.persistence='UNAVAILABLE';}
 }
 function panelInputs(){
  const p=owner(),raw=p.getElectricalState(),electrical=p.getState().state.electrical,
   frame=document.getElementById('overheadFrame'),win=frame?.contentWindow;
  let litLamps=0,brightness=50,irsModes={L:'OFF',R:'OFF'};
  try{
   litLamps=frame?.contentDocument?.querySelectorAll('.mounted-light[data-frame="ON"],.mounted-light[data-frame="BRIGHT_BLUE"],.mounted-light[data-frame="DIM_BLUE"]').length||0;
   const rotaries=win?.B737RotaryGuards?.getState?.()?.rotaries||{};
   const br=Number(rotaries['panel-brightness']);if(Number.isFinite(br))brightness=Math.max(0,Math.min(100,br));
   for(const [side,id]of [['L','irs-l-mode'],['R','irs-r-mode']]){
    if(['OFF','ALIGN','NAV','ATT'].includes(rotaries[id]))irsModes[side]=rotaries[id];
   }
  }catch{}
  const main=root.B737CockpitLights?.getState?.();
  if(main?.frames)litLamps+=Object.values(main.frames).filter(x=>x!=='OFF').length;
  return Loads.project(raw,electrical,{litLamps,brightness,irsModes,apuPhase:p.getStartState?.()?.phase?.apu||'OFF'});
 }
 function mount(){
  const slot=document.getElementById('batteryMeterControlSlot');if(!slot||readout)return;
  readout=document.createElement('section');readout.id='liveBatteryReadout';readout.dir='ltr';
  readout.setAttribute('aria-label','Live aircraft battery voltage current charge and consumption');
  readout.style.cssText='position:static;width:100%;max-width:100%;padding:9px 10px;border:1px solid #668270;border-radius:7px;background:#0b191eee;color:#d9f2de;font:12px/1.6 system-ui;box-shadow:0 2px 9px #0005';
  readout.innerHTML='<b>BATTERY <span data-battery-percent></span></b> <span data-battery-status></span><div style="display:flex;gap:12px;flex-wrap:wrap;font:600 15px/1.7 monospace"><span data-battery-volts></span><span data-battery-amps></span><span data-battery-watts></span></div><div style="font-size:10px;color:#adc0c1"><span data-battery-used></span> · 40 Ah training model</div>';
  // Battery meter and charger stay together in the Controls drawer.
  slot.append(readout);
 }
 function paint(){
  mount();if(!readout||!current)return;
  // Use the evaluated, connected source, not the engine-running bit:
  // a disconnected/failed generator must not dismiss the battery HUD.
  const electrical=owner()?.getState?.()?.state?.electrical;
  // The drawer must show live volts/amps in every supply state, including
  // charging or generator-on. Never hide the battery meter on AC power.
  readout.style.display='';
  const set=(key,text)=>{readout.querySelector('[data-battery-'+key+']').textContent=text;};
  set('percent',current.percent.toFixed(2)+'%');
  set('volts',current.voltageV.toFixed(2)+' V');
  set('amps',(current.ammeterA>=0?'+':'')+current.ammeterA.toFixed(2)+' A');
  set('watts',(current.voltageV*current.dischargeA).toFixed(1)+' W');
  set('used','Used '+current.dischargedAh.toFixed(3)+' Ah / '+current.dischargedWh.toFixed(2)+' Wh');
  set('status',current.status==='EMPTY'?'Battery Empty':current.status==='CHARGING'?'Charging':current.status==='DISCHARGING'?'Discharging':'Ready');
  readout.dataset.status=current.status;readout.dataset.restored=String(restored);
  readout.style.borderColor=current.percent<=10?'#da6c45':'#668270';
 }
 function rechargeBattery(){
  // Instructor-only instant top-up: no accelerated time and no fake display.
  // The ECU session owns chargeAh; persistence reads that same session.
  if(!attached)tick();
  const p=owner();
  if(!p?.rechargeLiveBattery)throw Error('Live battery charge command unavailable');
  const result=p.rechargeLiveBattery();
  if(!result||result.percent<99.999)throw Error('Battery ECU did not accept full recharge');
  current=result;
  lastInputs=null;lastAt=Date.now();
  paint();power();
  save();
  root.dispatchEvent(new CustomEvent('b737:battery-recharged',{detail:copy(result)}));
  return copy(result);
 }
 function power(){
  const p=owner(),b=p.getState().state.electrical.bus,
   available=b.battery===true||b.dc1===true||b.dc2===true||b.dcStandby===true;
  const frame=document.getElementById('overheadFrame');
  if(frame?.contentWindow&&available!==lastPower){
   lastPower=available;
   frame.contentWindow.postMessage({type:'b737:cockpit-command',action:'live-electrical-supply',power:available},location.origin);
  }
 }
 function tick(){
  if(busy||!owner()?.attachLiveBattery)return;
  busy=true;
  try{
   const p=owner(),now=Date.now();
   if(!attached){p.attachLiveBattery(stored());attached=true;lastAt=now;}
   const dt=Math.max(0,Math.min(86400,(now-lastAt)/1000));lastAt=now;
   const nextInputs=panelInputs();
   const appliedInputs=lastInputs||nextInputs;
   current=p.advanceLiveBattery(dt,appliedInputs);
   // Apply changed switches immediately after integrating the previous interval.
   const afterInputs=panelInputs();
   if(JSON.stringify(afterInputs)!==JSON.stringify(appliedInputs))current=p.advanceLiveBattery(0,afterInputs);
   lastInputs=afterInputs;
   power();paint();
   root.dispatchEvent(new CustomEvent('b737:battery-live',{detail:copy(current)}));
   if(now-savedAt>=5000)save();
  }catch(error){console.error('Live battery:',error);}
  finally{busy=false;}
 }
 function start(){
  // ECU observations can fire at 10 Hz; every old 'start()' invoked a full
  // battery step, ECU render, panel repaint and another observation event.
  // Bound this live integration to 2.5 Hz plus the existing 1 Hz timer.
  // Physical meter-selector actions below still refresh immediately.
  if(!attached||Date.now()-lastAt>=400)tick();
  if(attached&&!timer)timer=setInterval(tick,1000);
 }
 for(const name of ['b737:electrical-owner-ready','b737:unified-ecu-observation'])root.addEventListener(name,start);
 root.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==document.getElementById('overheadFrame')?.contentWindow)return;
  const d=event.data;if(d?.type!=='b737:cockpit-overhead')return;
  const e=d.event;
  if(d.kind==='control-event'&&e?.kind==='rotary'){
   const selectors=root.B737UnifiedAcDcSelectors;
   if(e.id==='dc-meter'&&selectors?.detents.DC.includes(e.next))selectors.choose('DC',e.next);
   if(e.id==='ac-meter'){
    const next=({'GRD PWR':'GND PWR','GEN 1':'GEN1','GEN 2':'GEN2'})[e.next]||e.next;
    if(selectors?.detents.AC.includes(next))selectors.choose('AC',next);
   }
   tick();
  }
 });
 document.getElementById('overheadFrame')?.addEventListener('load',()=>{lastPower=null;start();});
 document.addEventListener('visibilitychange',()=>{tick();save();});
 root.addEventListener('pagehide',()=>{tick();save();});
 root.B737InstalledBattery=Object.freeze({snapshot:()=>current?copy(current):null,recharge:rechargeBattery,refresh:tick});
 start();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./battery-recharge-header-v1.js?v=BAT-CONTROLS-0001 */
try{
/* Instructor BAT RECHARGE inside Unified Controls drawer.
 * Always available regardless of AC generator, ground service,
 * external power or standby inverter. Actual charge stays in the ECU.
 */
(function(root){
 'use strict';
 const ID='liveBatteryRecharge';
 const STORE='b737classic.live-battery.v1';
 const owner=()=>root.B737ISNCockpitV1;
 // Own exactly one battery recharge control under Controls, never in the top bar.
 // Do not make availability dependent on generator or ground power state.
 function ensureButton(){
  const slot=document.getElementById('batteryRechargeControlSlot');
  if(!slot)return null;
  let button=document.getElementById(ID);
  if(!button){
   button=document.createElement('button');
   button.id=ID;button.type='button';
   button.textContent='BAT RECHARGE';
   button.setAttribute('aria-label','Recharge training battery to 100 percent');
  }
  if(button.parentElement!==slot)slot.append(button);
  // Other electrical modules may mark the HUD hidden; this instructor
  // command MUST remain visible with or without generator/GPU/APU power.
  if(button.hidden)button.hidden=false;
  if(button.style.getPropertyValue('display')!=='inline-flex'||
     button.style.getPropertyPriority('display')!=='important')
   button.style.setProperty('display','inline-flex','important');
  if(button.dataset.batteryRechargeBound!=='true'){
   button.addEventListener('click',recharge);
   button.dataset.batteryRechargeBound='true';
  }
  return button;
 }
 function acPowerConnected(electrical){
  const bus=electrical?.bus;
  return bus?.generator1===true||bus?.generator2===true||bus?.groundService===true;
 }
 function electrical(){
  try{return owner()?.getState?.()?.state?.electrical||null;}
  catch(error){console.warn('BAT RECHARGE source state unavailable:',error);return null;}
 }
 function update(){
  const button=ensureButton();
  if(!button)return;
  const connected=acPowerConnected(electrical());
  const ready=typeof root.B737InstalledBattery?.recharge==='function'||
   typeof owner()?.rechargeLiveBattery==='function';
  // Instructor recharge must remain present with AC online, off, or unknown.
  button.hidden=false;
  button.disabled=!ready;
  button.dataset.acConnected=String(connected);
  button.title=!ready?'Waiting for the live battery ECU':
   'Recharge training battery to 100% — AC state does not inhibit this control';
 }
 function persistFromECU(){
  const state=owner()?.getElectricalState?.()?.battery;
  if(!state||!Number.isFinite(state.chargeAh)||!Number.isFinite(state.capacityAh))
   throw Error('Battery state unavailable for persistence');
  try{
   localStorage.setItem(STORE,JSON.stringify({schema:'b737-saved-battery/1',state}));
  }catch(error){console.warn('Battery charged but persistence unavailable:',error);}
 }
 function recharge(event){
  event.preventDefault();event.stopPropagation();
  const button=ensureButton();
  if(!button)return;
  button.disabled=true;
  try{
   const installed=root.B737InstalledBattery;
   let battery;
   if(typeof installed?.recharge==='function')battery=installed.recharge();
   else if(typeof owner()?.rechargeLiveBattery==='function'){
    battery=owner().rechargeLiveBattery();
    installed?.refresh?.();
   }else throw Error('Live electrical ECU is not ready');
   if(!battery||battery.percent<99.99)
    throw Error('Battery ECU did not reach 100%');
   persistFromECU();
   button.textContent='BAT RECHARGE';
   button.dataset.recharge='success';
   root.dispatchEvent(new CustomEvent('b737:battery-recharge-header',{detail:{percent:battery.percent}}));
  }catch(error){
   console.error('BAT RECHARGE failed:',error);
   button.textContent='RECHARGE FAILED';
   button.dataset.recharge='error';
   button.title=String(error.message||error);
  }finally{update();}
 }
 function start(){
  const button=ensureButton();
  if(!button)return;
  // Observe only the battery slot, not the entire animated cockpit or top bar.
  const bar=button.parentElement;
  if(typeof MutationObserver==='function'){
   const observer=new MutationObserver(()=>{ensureButton();update();});
   observer.observe(bar,{childList:true});
  }
  for(const event of ['b737:electrical-owner-ready','b737:electrical-network',
   'b737:battery-live','b737:unified-ecu-observation','b737:battery-recharged'])
   root.addEventListener(event,update);
  update();
 }
 root.B737BatteryRechargeHeader=Object.freeze({acPowerConnected,refresh:update});
 if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
