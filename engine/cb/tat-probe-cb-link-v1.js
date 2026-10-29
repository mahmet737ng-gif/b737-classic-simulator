/* Canonical TAT CB link: P18-3 C5, shared with the photo CB Panel Lab.
 * Uses its exact persisted BreakerNetwork schema; never invents a new CB.
 * Only the requested key is modified and every unrelated pull/fault is retained.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737TatCbLinkV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const STORAGE='b737classic.cb.v1',CB_ID='P18-3|ALL|C5';
 function valid(s){return !!s&&s.schema===1&&['CPCS','DCPCS'].includes(s.variant)&&Array.isArray(s.breakers)&&Array.isArray(s.buses);}
 function read(s){const record=valid(s)?s.breakers.find(x=>x.id===CB_ID):null;return {key:CB_ID,pulled:!!(record?.pulled||record?.tripped),tripped:!!record?.tripped,fault:record?.fault||null};}
 function setPulled(snapshot,pulled,variant='CPCS'){
  if(typeof pulled!=='boolean')return {ok:false,reason:'INVALID_ACTION'};
  if(snapshot&&!valid(snapshot))return {ok:false,reason:'INVALID_SNAPSHOT'};
  const next=snapshot?JSON.parse(JSON.stringify(snapshot)):{schema:1,variant:variant==='DCPCS'?'DCPCS':'CPCS',breakers:[],buses:[]};
  const record=read(next);
  if(!pulled&&(record.tripped||record.fault))return {ok:false,reason:'TRIPPED_CB_REQUIRES_FAULT_CLEAR',state:record};
  next.breakers=next.breakers.filter(x=>x.id!==CB_ID);
  if(pulled)next.breakers.push({id:CB_ID,pulled:true,tripped:false,fault:null});
  return {ok:true,snapshot:next,state:read(next)};
 }
 return Object.freeze({STORAGE,CB_ID,read,setPulled,valid});
});
