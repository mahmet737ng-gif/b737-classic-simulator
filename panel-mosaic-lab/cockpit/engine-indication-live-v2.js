/* Unified EIS / Conventional engine instrumentation — one live ECU and one
 * Electrical V7. Source-indexed DB, sensor failure, CB/bus loss, trainer tests.
 * Additive presentation: preserve owner's photo, gauge centers and all guards.
 */
(function(){'use strict';
 const VER='ENG-LIVE-0002', P=['n1','egt','n2','fuelFlow','oilPressure','oilTemperature','oilQuantity','vibration'];
 const CONV={n1:'n1',egt:'egt',n2:'n2',fuelFlow:'fuelFlow',oilPressure:'oilPressure',
  oilTemperature:'oilTemp',oilQuantity:'oilQty',vibration:'vib'};
 const DOT=new Set(['n1','egt','n2','fuelFlow','oilQuantity']);
 const $=s=>document.querySelector(s);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const numeric=n=>typeof n==='number'&&Number.isFinite(n);
 const api=()=>window.B737EngineIndicationsV1;
 let db=null,prior=null,current=null,lastTime=null,lastRaw=null,error=null,loadPromise=null;
 let mode='EIS',fuelMode='RATE',filterThreshold=null,fuelUsedExpiresAt=null,resetFuelPending=false;
 let displayFaults={},sensorOverrides={engine1:{},engine2:{}},displayLimits={};
 let lastPaint=new Map(),lastEmitted=-1,events=0,labFrame=null;
 const electrical=()=>window.B737ElectricalV7?.evaluate(window.B737ISNCockpitV1?.getElectricalState?.());
 function frameFlag(id,status,active){
  const node=$(id);if(!node)return;
  node.dataset.indicationStatus=status;node.dataset.engineLive=VER;
  if(active===null)return;
  node.style.visibility=active?'visible':'hidden';
 }
 function paint(result){
  if(!result)return;
  for(const side of [1,2]){
   const id='engine'+side;
   for(const p of P){
    const x=result.engines[id].indications[p],key=p+'_'+side;
    const valid=x.status==='VALID'||x.status==='SENSOR_FAILURE_TRANSIENT'||
       (x.pointer==='HOLD_LAST'&&numeric(x.value));
    const uncertain=x.status==='POWER_EFFECT_UNVERIFIED'||x.status==='POWER_UNKNOWN';
    const visualValue=numeric(x.value)?x.value:null;
    // Fuel USED selects accumulated mass on the digital roller only; the
    // analogue fuel-flow pointer must continue to follow instantaneous flow.
    const digitalValue=p==='fuelFlow'&&fuelMode==='USED'&&numeric(x.digitalValue)?
      x.digitalValue:visualValue;
    if(DOT.has(p)){
     const attr=mode==='EIS'?'data-eis-readout':'data-conventional-readout';
     const node=$('#region-main ['+attr+'="'+key+'"]');
     const shown=x.status==='UNIT_FAILED'||x.status==='POWER_LOSS'?'hidden':uncertain?'unchanged':'visible';
     if(node){node.dataset.engineLiveStatus=x.status;if(shown!=='unchanged')node.style.visibility=shown;}
     // The shared renderer consumes raw sensor units. Conventional oil
     // quantity is converted from percent to gallons by its display spec.
     const raw=p==='oilQuantity'?x.inputValue:digitalValue;
     const value=valid&&numeric(raw)?raw:null,stamp='DOT.'+mode+'.'+key;
     if(node&&p==='fuelFlow'){
      node.dataset.fuelDisplayMode=fuelMode;node.dataset.displayUnit=fuelMode==='USED'?'t':'t/h';
     }
     if(!uncertain&&shown!=='hidden'&&(lastPaint.get(stamp)!==value||!node)){
      window.B737EISDotReadoutsV1?.setReading(id,p,value,'ENGINE_INDICATION_BACKEND_V2');
      lastPaint.set(stamp,value);
     }
    }
    if(mode==='EIS'){
     const pointerId='#region-main [data-gauge="'+key+'"]';
     const group=$(pointerId);
     if(group){
      group.dataset.engineLiveStatus=x.status;
      if(!uncertain){group.style.visibility=valid?'visible':'hidden';}
     }
     if(p==='oilQuantity'){} // Oil quantity has only the separate numeric EIS field.
     if(p!=='oilQuantity'&&p!=='vibration'&&p!=='oilTemperature'&&p!=='oilPressure'&&p!=='n1'&&p!=='egt'&&p!=='n2'&&p!=='fuelFlow')continue;
     if(p!=='oilQuantity'&&p!=='vibration'||p==='vibration'||p==='oilTemperature'||p==='oilPressure'){
      // "hydPressure" is an unrelated EIS channel: do not overwrite it.
      if(valid&&numeric(visualValue)&&p!=='oilQuantity'){
       const stamp='POINTER.'+key;
       if(lastPaint.get(stamp)!==visualValue){
        window.B737EISNeedlesV1?.setReading(id,p,visualValue);
        lastPaint.set(stamp,visualValue);
       }
      }
     }
    }else{
     const convKey=CONV[p];
     const group=$('#region-main [data-conventional-needle="'+convKey+'_'+side+'"]');
     if(group){
      group.dataset.engineLiveStatus=x.status;
      if(!uncertain)group.style.visibility=valid?'visible':'hidden';
     }
     if(valid&&numeric(visualValue)){
      const stamp='CONV.'+key;
      if(lastPaint.get(stamp)!==visualValue){
       window.B737ConventionalNeedlesV1?.setReading(id,convKey,visualValue);
       lastPaint.set(stamp,visualValue);
      }
     }
    }
   }
  }
  // Feed observed analogue pressure to the existing physical cockpit lamp model.
  // The lamp engine owns real light state/push-to-test; do not directly tint images.
  const lights=window.B737CockpitLights;
  if(lights?.setInputs){
   const present=lights.getState()?.inputs||{},patch={};
   for(const side of [1,2]){
    const id='engine'+side;
    const oil=result.engines[id].indications.oilPressure;
    if(oil.status==='VALID'&&numeric(oil.inputValue)){
     const key='oil'+side+'AtRedRadial';
     const active=oil.inputValue<=db.laws.oilPressureRedLinePsi;
     if(present[key]!==active)patch[key]=active;
    }
    const real=lastRaw?.engines?.[id]?.oil?.filterBypassLamp;
    const filterKey='oilFilter'+side+'Bypass';
    if(typeof real==='boolean'&&present[filterKey]!==real)patch[filterKey]=real;
   }
   if(Object.keys(patch).length)try{lights.setInputs(patch);}catch(err){error='Physical lamp bridge: '+err.message;}
  }
 }
 function startReport(){
  if(!window.B737ClassicEngineStartLogicV2||!window.B737ISNCockpitV1)return null;
  try{return window.B737ClassicEngineStartLogicV2.project({
   chain:window.B737ISNCockpitV1.getStartState(),ecu:lastRaw,
   electrical:electrical()
  });}catch(ex){return {error:ex.message};}
 }
 function apply(live){
  if(!db||!api()||!live||live.quality!=='TRAINING_SIMULATION_ONLY')return null;
  try{
   const state=electrical();
   if(!state)return null;
   const desired=document.documentElement.dataset.engineIndication;
   const nextMode=desired==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
   if(mode!==nextMode){mode=nextMode;lastPaint.clear();}
   const observed=api().fromEcu(live);
   for(const id of ['engine1','engine2'])for(const [param,override] of Object.entries(sensorOverrides[id])){
    observed[id][param]=copy(override);
   }
   const now=numeric(live.timeMs)?live.timeMs:0;
   const dt=lastTime===null?0:Math.max(0,Math.min(60000,Math.round(now-lastTime)));
   // EIS FUEL USED is a momentary ten-second display. Conventional uses its
   // own held RATE/USED selector and is not subject to this automatic timer.
   if(mode==='EIS'&&fuelMode==='USED'&&fuelUsedExpiresAt!==null&&now>=fuelUsedExpiresAt){
    fuelMode='RATE';fuelUsedExpiresAt=null;lastPaint.clear();
   }
   if(lastTime!==null&&now<lastTime){prior=null;lastPaint.clear();}
   const next=api().calculate(db,{mode,electrical:state,observed,previous:prior,
    faults:displayFaults,limits:displayLimits,filterBypassThresholdPsid:filterThreshold,
    dtMs:dt,fuelMode,resetFuelUsed:resetFuelPending});
   resetFuelPending=false;
   prior=next;lastTime=now;lastRaw=live;current=next;events++;
   paint(next);
   // Start logic contains actual switch feedback; no duplicate start controller.
   if(events%3===0){
    window.dispatchEvent(new CustomEvent('b737:engine-indications-live-v2',{
     detail:{schema:next.schema,mode,engines:next.engines,bite:next.bite,start:startReport()}
    }));
   }
   return next;
  }catch(e){error=e.message;console.warn('Engine indication bridge:',e);return null;}
 }
 function setFault(key,on){
  if(typeof on!=='boolean'||!(
    ['eisPrimary','eisSecondary'].includes(key)||
    /^(n1|n2|egt|fuelFlow|oilPressure|oilTemperature|oilQuantity|vibration)\.[12]$/.test(key)
  ))throw Error('Unknown instrument fault or invalid state');
  displayFaults[key]=on;refresh();return current;
 }
 function setSensor(id,parameter,value,condition='VALID'){
  if(!['engine1','engine2'].includes(id)||!P.includes(parameter))throw Error('Unknown engine sensor');
  if(!['VALID','FAILED','CLEAR'].includes(condition))throw Error('Unknown sensor condition');
  if(condition==='CLEAR'){delete sensorOverrides[id][parameter];refresh();return;}
  if(condition==='FAILED')sensorOverrides[id][parameter]={valid:false,reason:'INSTRUCTOR_SENSOR_FAILURE'};
  else {
   if(!numeric(value)||value<0||value>100000)throw Error('Finite nonnegative sensor test value required');
   sensorOverrides[id][parameter]={valid:true,value,unit:db.instruments[parameter].unit,
    origin:'EXPLICIT_INSTRUCTOR_SENSOR',quality:'TRAINING_INJECTION'};
  }
  refresh();return current;
 }
 function changeMode(value){
  if(!['EIS','CONVENTIONAL'].includes(value))throw Error('Unknown engine display');
  window.B737EngineIndicationModeV1?.setMode(value);
  refresh();
 }
 function setPhysicalDetent(cmd){
  const id=cmd.type==='PHYSICAL_IGNITION'?'ignition-source':
   cmd.engine==='engine1'?'engine-start-1':cmd.engine==='engine2'?'engine-start-2':null;
  const allowed=id==='ignition-source'?['IGN L','BOTH','IGN R']:['GRD','OFF','CONT','FLT'];
  if(!id||!allowed.includes(cmd.value))throw Error('Invalid physical start or ignition detent');
  const rotary=document.getElementById('overheadFrame')?.contentWindow?.B737RotaryGuards;
  if(!rotary?.setEngineLabDetent||!rotary?.getState)
   throw Error('Physical overhead is not mounted; open the OVERHEAD panel');
  const old=rotary.getState()?.rotaries?.[id];
  if(old===cmd.value)return {accepted:true,unchanged:true,id,value:cmd.value,owner:'ACTUAL_OVERHEAD_ROTARY'};
  if(rotary.setEngineLabDetent(id,cmd.value)!==true)throw Error('Physical overhead rejected detent');
  if(rotary.getState()?.rotaries?.[id]!==cmd.value)throw Error('Physical detent feedback did not match');
  // Existing overhead rotary event -> single ISN live gateway -> ECU. No shadow starter.
  return {accepted:true,id,value:cmd.value,owner:'ACTUAL_OVERHEAD_ROTARY'};
 }
 function command(cmd){
  if(!cmd||typeof cmd!=='object')throw Error('Instructor command required');
  switch(cmd.type){
   case 'PHYSICAL_IGNITION':
   case 'PHYSICAL_START_SWITCH':return setPhysicalDetent(cmd);
   case 'DISPLAY_FAULT':return setFault(cmd.key,cmd.active);
   case 'SENSOR':return setSensor(cmd.engine,cmd.parameter,cmd.value,cmd.condition);
   case 'MODE':return changeMode(cmd.mode);
   case 'FUEL_MODE':
    if(!['RATE','USED'].includes(cmd.value))throw Error('Unsupported fuel display mode');
    fuelMode=cmd.value;
    const clock=window.B737ISNCockpitV1?.getECUState?.()?.timeMs;
    fuelUsedExpiresAt=fuelMode==='USED'&&mode==='EIS'&&numeric(clock)?clock+10000:null;
    lastPaint.clear();return refresh();
   case 'RESET_FUEL_USED':
    resetFuelPending=true;lastPaint.clear();return refresh();
   case 'FILTER_THRESHOLD':
    if(cmd.value!==null&&(!numeric(cmd.value)||cmd.value<0||cmd.value>100))
     throw Error('Explicit installed filter switch threshold required');
    filterThreshold=cmd.value;return refresh();
   case 'PHYSICAL_START_DETENT':
    if(cmd.id==='ignition-source')return setPhysicalDetent({type:'PHYSICAL_IGNITION',value:cmd.value});
    if(['engine-start-1','engine-start-2'].includes(cmd.id))
     return setPhysicalDetent({type:'PHYSICAL_START_SWITCH',engine:'engine'+cmd.id.at(-1),value:cmd.value});
    throw Error('Invalid physical OH engine selector ID');
   case 'RESET_INSTRUMENT_FAULTS':
    displayFaults={};sensorOverrides={engine1:{},engine2:{}};filterThreshold=null;
    prior=null;lastPaint.clear();return refresh();
   default:
    return window.B737ISNCockpitV1?.engineTrainerAction?.({...cmd,instructor:true})||
      (()=>{throw Error('Unified engine ECU not ready');})();
  }
 }
 function refresh(){
  const now=window.B737ISNCockpitV1?.getECUState?.()||lastRaw;
  return apply(now);
 }
 function status(){
  return {version:VER,ready:!!db,mode,fuelMode,error,events,
   source:'ONE ECU / ONE ELECTRICAL V7',snapshot:current?copy(current):null,
   start:startReport(),electrical:window.B737ISNCockpitV1?.getElectricalState?.()||null};
 }
 function sendLab(packet){if(!labFrame?.contentWindow)return;
  labFrame.contentWindow.postMessage({type:'b737:engine-lab-v2-snapshot',packet},location.origin);
 }
 function labSnapshot(){return {kind:'snapshot',...status(),ecu:lastRaw,
  start:startReport(),technicals:db?{revision:db.revision,sources:db.sources}:null};}
 function installLab(){
  if($('#engineLabButtonV2'))return;
  const bar=$('unifiedLabShortcuts');
  if(!bar)return;
  const button=document.createElement('button');button.type='button';button.id='engineLabButtonV2';
  button.textContent='ENGINE TEST LAB';button.title='Source-traced EIS / Conventional, start and emergency test lab';
  bar.append(button);
  const dialog=document.createElement('dialog');dialog.id='engineLabDialogV2';
  dialog.setAttribute('aria-label','Engine indication and engine start laboratory');
  dialog.innerHTML='<header><b>B737 CLASSIC · ENGINE SYSTEM TEST LAB</b><button id="engineLabCloseV2" type="button">CLOSE ×</button></header>'+
   '<iframe title="737 Classic Engine Normal Abnormal Emergency Test Lab" id="engineLabFrameV2" loading="lazy"></iframe>';
  document.body.append(dialog);labFrame=dialog.querySelector('iframe');
  button.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();
   if(!labFrame.src||labFrame.src==='about:blank')
    labFrame.src=new URL('../engine-test-lab/index.html?v='+VER,document.baseURI).href;
   sendLab(labSnapshot());
  });
  dialog.querySelector('button').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{labFrame.src='about:blank';});
  window.addEventListener('message',event=>{
   if(event.origin!==location.origin||event.source!==labFrame.contentWindow)return;
   const data=event.data;
   if(data?.type==='b737:engine-lab-v2-ready'){sendLab(labSnapshot());return;}
   if(data?.type!=='b737:engine-lab-v2-command')return;
   if(!Number.isSafeInteger(data.sequence)||data.sequence<1)return;
   let outcome={accepted:true};
   try{
    const returned=command(data.command);
    if(returned?.accepted===false)outcome={accepted:false,error:returned.reason||'ECU rejected action'};
    else outcome={accepted:true,message:returned?.owner==='ACTUAL_OVERHEAD_ROTARY'?
     'Physical overhead detent confirmed':'Shared live ECU command accepted'};
   }catch(ex){outcome={accepted:false,error:ex.message};}
   sendLab({kind:'ack',sequence:data.sequence,outcome,state:labSnapshot()});
  });
  // Updating the lab twice a second is enough and avoids extra ECU work on every frame.
  setInterval(()=>{if(dialog.open)sendLab(labSnapshot());},500);
 }
 async function load(){
  if(loadPromise)return loadPromise;
  loadPromise=(async()=>{
   if(!api())throw Error('B737EngineIndicationsV1 must load first');
   const res=await fetch(new URL('../../engine/instruments/engine-indication-technical-db-v1.json?v='+VER,document.baseURI),
    {cache:'force-cache'});
   if(!res.ok)throw Error('Technical data HTTP '+res.status);
   const next=await res.json();api().validate(next);db=next;refresh();
   return true;
  })().catch(ex=>{error=ex.message;console.error('Engine Technical DB:',ex);return false;});
  return loadPromise;
 }
 window.B737UnifiedEngineIndicationsV2=Object.freeze({
  getState:status,refresh,command,startReport,load,
  setMode:changeMode,getDatabase:()=>db?copy(db):null
 });
 window.addEventListener('b737:unified-ecu-observation',ev=>apply(ev.detail));
 window.addEventListener('b737:engine-indication-view',()=>{lastPaint.clear();refresh();});
 window.addEventListener('b737:cockpit-mounted',()=>{lastPaint.clear();refresh();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{installLab();load();},{once:true});
 else{installLab();load();}
})();
