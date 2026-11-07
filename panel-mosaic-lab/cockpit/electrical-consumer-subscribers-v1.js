/* ATA24 Unified electrical consumer registration (event driven, no polling).
 * Register ALL logical MRG devices once. Their cached supply is updated only
 * by the existing bus/CB event hub; only implemented owners receive actions.
 * No stand-alone electrical plant or per-frame/interval electrical queries.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document){
  root.B737UnifiedElectricalSubscribersV1=api;
  const boot=()=>{try{api.install(root);}catch(e){console.error('ATA24 registrations',e);}};
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
 }
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='ATA24-CONSUMER-REG-0001';
 const OWNER_GROUPS=Object.freeze({
  ISN:'ISN',WINDOW:'WINDOW',ENGINE:'ENGINE',AUTOBRAKE:'AUTOBRAKE',
  CDU:'CDU',ANTIICE:'ANTIICE'
 });
 const groupFor=name=>{
  if(/^Fuel Boost Pump|^Electric Hydraulic Pump|^Engine [12] Electric Hydraulic Pump Control/i.test(name))return 'ISN';
  if(/^Window Heat(?: Control)?\b/i.test(name))return 'WINDOW';
  if(/^Alpha Vane AoA|^Pitot Heat|^Temp Probe Heat|^Wing Anti-Ice|^Engine [12] Anti-Ice/i.test(name))return 'ANTIICE';
  if(name==='Autobrake Control')return 'AUTOBRAKE';
  if(name==='CDU FO')return 'CDU';
  if(/^(?:Engine [12] (?:Fuel Flow Indication|N2 Indication|Oil Pressure Indication|Oil Quantity Indication|Oil Temp Indication)|Engines? (?:N1|N2|EGT|Fuel Flow) Indication|Engine 1-2 AVM Indication)/i.test(name))return 'ENGINE';
  return null;
 };
 function createRegistry(bridge,owners={}){
  if(!bridge?.subscribeDevice||!bridge?.subscribe)throw Error('ATA24 event bridge required');
  const state=new Map(),unsubscribers=[],pending=new Set();
  let registered=false,scheduled=false,active=true,registrationCount=0,groupCalls=0;
  const doFlush=()=>{
   scheduled=false;
   if(!active)return;
   const groups=[...pending];pending.clear();
   if(groups.includes('ISN')&&groups.includes('ANTIICE'))
    groups.splice(groups.indexOf('ANTIICE'),1); // ISN render updates alpha too
   for(const group of groups){
    const handler=owners[group];
    if(typeof handler!=='function')continue;
    try{handler(state);groupCalls++;}catch(e){console.warn('ATA24 owner group '+group,e);}
   }
  };
  function mark(group){
   if(!group||!active)return;
   pending.add(group);
   if(scheduled)return;scheduled=true;
   Promise.resolve().then(doFlush);
  }
  function attach(snapshot){
   if(!active||registered||!snapshot?.devices)return false;
   // 322 known logical devices (including variants not fitted in current model).
   // An entry in the registry means power telemetry is connected, NOT that
   // an unimplemented aircraft component has been magically simulated.
   const names=Object.keys(snapshot.devices);
   if(names.length!==322)throw Error('ATA24 expected 322 MRG logical devices, found '+names.length);
   for(const name of names){
    const group=groupFor(name);
    const stop=bridge.subscribeDevice(name,event=>{
     const d=event?.value;if(!d)return;
     state.set(name,{state:d.state,topology:d.topology,
      capabilities:d.capabilities||{},group,
      channelCount:d.feedChannels?.length||0,sequence:event.sequence});
     if(group)mark(group);
    });
    unsubscribers.push(stop);registrationCount++;
   }
   registered=true;
   return true;
  }
  // The legacy aggregate callback fires only on actual electrical changes,
  // not on every ECU observation. We use it solely for one-time registration.
  const off=bridge.subscribe(s=>{if(!registered)attach(s);});
  unsubscribers.push(off);
  return Object.freeze({
   version:VERSION,get ready(){return registered&&active;},
   getRegistrationCount:()=>registrationCount,
   getState:name=>{const d=state.get(name);return d?{...d,capabilities:{...d.capabilities}}:null;},
   getStats:()=>({registered:registrationCount,cached:state.size,
    ownerActions:groupCalls,pendingGroups:pending.size,ready:registered&&active}),
   destroy:()=>{active=false;pending.clear();
    for(const fn of unsubscribers)try{fn?.();}catch(e){console.warn(e);}
    unsubscribers.length=0;state.clear();}
  });
 }
 let runtime=null;
 function install(win){
  if(runtime)return runtime;
  const bridge=win.B737UnifiedBusConsumerLiveV1;
  if(!bridge?.subscribeDevice||!bridge?.subscribe)return null;
  const owner={
   ISN:()=>win.B737ISNCockpitV1?.reconcileElectricalConsumers?.('ATA24_EVENT_DELTA'),
   ANTIICE:()=>win.B737ISNCockpitV1?.refreshElectricalAnnunciations?.(),
   WINDOW:()=>{
    const feeds={};let complete=true;
    for(const [name,voltage]of [['generator1','115VAC'],['generator2','115VAC'],
     ['main1','115VAC'],['main2','115VAC'],['dc1','28VDC'],['dc2','28VDC']]){
     const value=bridge.getBus(name,voltage)?.powered;
     if(typeof value!=='boolean'&&value!==null)complete=false;
     feeds[name]=value;
    }
    if(complete)win.B737WindowHeatUnifiedV1?.setElectricalBusSnapshot?.(feeds);
   },
   ENGINE:()=>win.B737UnifiedEngineIndicationsV2?.onElectricalPowerChange?.(),
   CDU:state=>win.B737UnifiedCduBusFailureGateV1?.receiveElectricalAvailability?.(
    state.get('CDU FO')?.state??null),
   AUTOBRAKE:state=>win.B737AutobrakeUnified?.receiveElectricalAvailability?.(
    state.get('Autobrake Control')?.state??null)
  };
  runtime=createRegistry(bridge,owner);
  win.B737UnifiedElectricalRuntimeV1=runtime;
  return runtime;
 }
 return Object.freeze({VERSION,OWNER_GROUPS,groupFor,createRegistry,install,
  isReady:()=>runtime?.ready===true,getStats:()=>runtime?.getStats()||null});
});