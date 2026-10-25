/* Unified overhead physical event adapter — single ECU instance.
 * Small, pure host-agnostic routing layer, tested against real overhead
 * toggle model/registry. Never manufactures a bus, pneumatic source or fuel.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ISNUnifiedControlRouterV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const ENGINE_START=Object.freeze({'engine-start-1':'engine1','engine-start-2':'engine2'});
 function dispatch(ecu,event){
  if(!ecu?.chain?.event||!ecu?.core?.refreshFuelDelivery||!event||typeof event.id!=='string')
   throw Error('Unified ECU and physical overhead event required');
  const id=event.id,next=event.kind==='guarded'?event.next?.value:event.next;
  if(typeof next!=='string')return {accepted:false,reason:'UNSUPPORTED_CONTROL_VALUE'};
  if(id==='apu-start'&&next==='START')return ecu.startAPU();
  if(Object.hasOwn(ENGINE_START,id)&&next==='GRD')return ecu.engineStart(ENGINE_START[id]);
  const result=ecu.chain.event(event);
  ecu.core.refreshFuelDelivery();
  return result;
 }
 function synchronize(ecu,packet){
  if(!packet?.toggles||!packet?.guards||!packet?.rotaries)throw Error('Unified overhead controls snapshot required');
  ecu.chain.synchronize(packet);
  ecu.core.refreshFuelDelivery();
  const recovered=[];
  // The APU START switch is spring-loaded. A snapshot of START is a
  // genuine held control that must not be ignored if its transient event was
  // emitted before the parent registered a listener.
  if(packet.toggles['apu-start']==='START'&&['OFF','BLOCKED'].includes(ecu.chain.get().phase.apu)){
   dispatch(ecu,{id:'apu-start',kind:'toggle',next:'START',reason:'SNAPSHOT_RECOVERY'});
   recovered.push('apu-start');
  }
  for(const [id,engine] of Object.entries(ENGINE_START))if(packet.rotaries[id]==='GRD'&&
   ecu.chain.get().phase[engine]==='OFF'){
    dispatch(ecu,{id,kind:'rotary',next:'GRD',reason:'SNAPSHOT_RECOVERY'});
    recovered.push(id);
   }
  return {recovered,apu:ecu.chain.get().phase.apu,
   engines:{engine1:ecu.chain.get().phase.engine1,engine2:ecu.chain.get().phase.engine2}};
 }
 return Object.freeze({dispatch,synchronize,ENGINE_START});
});
