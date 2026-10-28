/* B737 Classic LE DEVICES — future system integration ports.
 * This file is intentionally OUTSIDE the owner-frozen core.
 * No automatic connection. Future authoritative systems explicitly create a port
 * and provide snapshots; it reuses the existing LE trainer without duplicating engines.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737LEIntegrationPortsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const bool3=v=>v===true||v===false||v===null;
 const required=(object,keys)=>!!object&&typeof object==='object'&&keys.every(x=>Object.hasOwn(object,x));
 const field=(v,name)=>{if(!bool3(v))throw Error(name+' must be true, false or null');return v;};
 function create(trainer){
  if(!trainer||typeof trainer.dispatch!=='function'||typeof trainer.setHydraulicPressure!=='function'||
    typeof trainer.setElectricalSnapshot!=='function')throw Error('Existing authoritative LE trainer required');
  let electrical=null,circuitBreakers=null;
  let last={hydraulics:null,electrical:null,circuitBreakers:null,aircraftDynamics:null};
  const copy=x=>JSON.parse(JSON.stringify(x));
  function effectivePower(upstream,cb){
   if(upstream===false||cb===false)return false;
   if(upstream===null||cb===null)return null;
   return true;
  }
  function reconcilePower(){
   // CBs are broad panel/channel gates, not a claim of actual Boeing wiring.
   // Never fabricate a bus feed: electrical is mandatory before applying a CB gate.
   if(electrical===null)return null;
   const cb=circuitBreakers||{overheadAnnunciator:true,centerAnnunciators:true};
   const bus={transfer1:effectivePower(electrical.transfer1,cb.overheadAnnunciator),
              dc1:effectivePower(electrical.dc1,cb.centerAnnunciators)};
   trainer.setElectricalSnapshot({bus});
   return bus;
  }
  function setElectrical(snapshot){
   if(!required(snapshot,['transfer1','dc1']))throw Error('Complete electrical snapshot required');
   electrical={transfer1:field(snapshot.transfer1,'transfer1'),dc1:field(snapshot.dc1,'dc1')};
   last.electrical={...electrical};
   return reconcilePower();
  }
  function setCircuitBreakers(snapshot){
   if(!required(snapshot,['overheadAnnunciator','centerAnnunciators']))throw Error('Two grouped CB gates required');
   if(electrical===null)throw Error('Electrical snapshot required before CB feed');
   circuitBreakers={
    overheadAnnunciator:field(snapshot.overheadAnnunciator,'overheadAnnunciator'),
    centerAnnunciators:field(snapshot.centerAnnunciators,'centerAnnunciators')
   };
   last.circuitBreakers={...circuitBreakers};
   return reconcilePower();
  }
  function setHydraulics(snapshot){
   if(!required(snapshot,['A','B','standby','ptuAvailable','pressurePsi']))throw Error('Complete hydraulic snapshot required');
   for(const name of ['A','B','standby','ptuAvailable'])
    if(typeof snapshot[name]!=='boolean')throw Error('Hydraulic '+name+' must be boolean');
   if(typeof snapshot.pressurePsi!=='number'||!Number.isFinite(snapshot.pressurePsi)||
     snapshot.pressurePsi<0||snapshot.pressurePsi>3500)throw Error('Invalid pressure psi');
   for(const name of ['A','B','standby'])
    trainer.dispatch({type:'HYDRAULIC',system:name,value:snapshot[name]});
   trainer.dispatch({type:'PTU',value:snapshot.ptuAvailable});
   trainer.setHydraulicPressure(snapshot.pressurePsi);
   last.hydraulics={...snapshot};
   return copy(last.hydraulics);
  }
  function setAircraftDynamics(snapshot){
   if(!required(snapshot,['onGround','autoslatRequested']))throw Error('Complete dynamics snapshot required');
   if(typeof snapshot.onGround!=='boolean'||typeof snapshot.autoslatRequested!=='boolean')
    throw Error('Dynamics flags must be boolean');
   trainer.dispatch({type:'GROUND',value:snapshot.onGround});
   trainer.dispatch({type:'AUTOSLAT',value:snapshot.autoslatRequested});
   last.aircraftDynamics={...snapshot};
   return copy(last.aircraftDynamics);
  }
  return Object.freeze({
   setHydraulics,setElectrical,setCircuitBreakers,setAircraftDynamics,
   snapshot:()=>copy({...last,effectivePower:electrical===null?null:{
    transfer1:effectivePower(electrical.transfer1,(circuitBreakers||{overheadAnnunciator:true}).overheadAnnunciator),
    dc1:effectivePower(electrical.dc1,(circuitBreakers||{centerAnnunciators:true}).centerAnnunciators)
   }}),
   description:Object.freeze({
    version:'LEDEV-PORTS-0001',status:'UNCONNECTED_FUTURE_INTEGRATION',
    channels:Object.freeze(['hydraulics','electrical','circuitBreakers','aircraftDynamics'])
   })
  });
 }
 return Object.freeze({create});
});
