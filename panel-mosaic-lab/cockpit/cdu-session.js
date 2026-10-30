/* One shared FMC dataset, with separate CDU display/input state. Unified only. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.B737CduSession=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const keys=Object.freeze(['active','pending','stagedRoute','navdbActive','navdbPending','navdbStage','stage5Pending','stage5Committed','stage5AwaitingExec','stage6BasePlanId','stage6Selections','stage6PendingPlan','stage6AwaitingExec','fmcNavDataBanks']);
 const copy=value=>JSON.parse(JSON.stringify(value));
 function extract(state){const shared={};for(const key of keys)if(Object.hasOwn(state,key))shared[key]=copy(state[key]);return shared;}
 function apply(state,shared){for(const key of keys){if(Object.hasOwn(shared,key))state[key]=copy(shared[key]);else delete state[key];}}
 function create(){
  const peers=new Map();let shared=null,revision=0;
  function deliver(peer){peer.write(copy(shared));peer.refresh();}
  function attach(seat,peer){
   if(!['CAPT','FO'].includes(seat)||!peer||!['read','write','refresh'].every(k=>typeof peer[k]==='function'))throw Error('Invalid CDU session peer');
   if(shared===null)shared=extract(peer.read());
   peers.set(seat,peer);deliver(peer);
   return Object.freeze({
    publish(){if(peers.get(seat)!==peer)return;const next=extract(peer.read());if(JSON.stringify(next)===JSON.stringify(shared))return;shared=next;revision++;for(const [other,p]of peers)if(other!==seat)deliver(p);},
    snapshot:()=>copy(shared),
    revision:()=>revision
   });
  }
  return Object.freeze({attach});
 }
 return Object.freeze({create,extract,apply,keys});
});
