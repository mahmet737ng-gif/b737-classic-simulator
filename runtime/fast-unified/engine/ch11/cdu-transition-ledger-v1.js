/* Deterministic, read-only CDU interaction ledger.
 * Records observed ACT/MOD/EXEC/page/scratch transitions from the EXISTING
 * CDU engine. Never becomes a competing FMC writer or controls flight systems.
 * A useful preflight/QRH procedure regression record for both CDU seats.
 */
(function(root,factory){'use strict';const a=factory();if(typeof module==='object'&&module.exports)module.exports=a;if(root)root.B737CDUTransitionLedgerV1=a;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const ROUTE=['ORIGIN','DEST','RUNWAY','CO_ROUTE','FLIGHT','CRZ_ALT','CI'];
 const clean=x=>typeof x==='string'?x:null;
 const snapshot=state=>{
  if(!state||typeof state.page!=='string')throw Error('CDU_STATE_REQUIRED');
  const active=state.active||{},pending=state.pending||{},stage=state.stagedRoute||{};
  const route=Object.fromEntries(ROUTE.map(k=>[k,clean(active[k])]));
  return Object.freeze({page:state.page,route,changedFields:Object.keys(pending).sort(),
   routeStaged:Object.keys(stage).sort(),scratchLength:String(state.scratch||'').length,
   message:String(state.message||''),awaitingExec:!!state.stage6AwaitingExec,
   pendingCount:Object.keys(pending).length+Object.keys(stage).length,
   navStage:state.navdbStage||null,referenceOnly:!!state.depArrSelection?.referenceOnly});
 };
 function create({seat='CAPT',validPages=[],limit=256,now=()=>0}={}){
  if(!['CAPT','FO'].includes(seat))throw Error('INVALID_CDU_SEAT');
  const known=new Set(validPages),events=[],errors=[];let revision=0;
  function capture(state){const x=snapshot(state);if(known.size&&!known.has(x.page))throw Error('UNREGISTERED_CDU_SCREEN_'+x.page);return x}
  function record(key,before,after){
   if(typeof key!=='string'||!/^CDU_CAPT_/.test(key))throw Error('CDU_CONTROL_ID_REQUIRED');
   if(!before||!after)throw Error('PRE_AND_POST_STATE_REQUIRED');
   if(after.scratchLength>24)errors.push({type:'SCRATCHPAD_OVER_24',key,actual:after.scratchLength});
   if(known.size&&!known.has(after.page))errors.push({type:'UNKNOWN_NEXT_PAGE',key,page:after.page});
   const item={seq:++revision,seat,key,atMs:now(),fromPage:before.page,toPage:after.page,
    fromScratchLength:before.scratchLength,toScratchLength:after.scratchLength,
    beforePending:before.pendingCount,afterPending:after.pendingCount,
    beforeRoute:before.route,afterRoute:after.route,
    message:after.message,source:'CDU_ENGINE_OBSERVATION_ONLY',guidanceCommanded:false};
   events.push(item);if(events.length>limit)events.shift();
   return item;
  }
  return Object.freeze({capture,record,getTrace:()=>JSON.parse(JSON.stringify(events)),
   audit:()=>({seat,revision,events:events.length,errors:JSON.parse(JSON.stringify(errors)),
    activePage:events.at(-1)?.toPage||null,commandsIssued:0}),
   clear:()=>{events.splice(0);errors.splice(0);revision=0;}});
 }
 return Object.freeze({snapshot,create});
});
