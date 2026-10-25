/* Stage 8 — connect known visual pointer identities to signal envelopes.
 * This is only a source-aware observability map, not a render command.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737InstrumentPointerRoutingV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){'use strict';
 function create(registry){
  if(registry?.schema!=='b737.stage8.pointer-routing.v1'||registry.routes?.length!==38)
   throw Error('Known 38-pointer routing inventory required');
  function project(signalSnapshot,{selectors={}}={}){
   if(signalSnapshot?.schema!=='b737.stage8.signal-snapshot.v1')
    throw Error('Stage8 signal snapshot required');
   const readings={};
   for(const route of registry.routes){
    const id=route.spriteId;
    const face=signalSnapshot.signals[route.faceId];
    if(!face)throw Error('Unknown face '+route.faceId);
    let channel=route.channel;
    if(route.modeSelector){
     const mode=selectors[route.faceId];
     channel=['rise','inlet'].includes(mode)?mode:null;
    }
    const signal=channel?face.channels[channel]:null;
    const reason=channel===null?(route.modeSelector?'selector_unconfirmed':route.mappingRule):
      signal?.valid?'calibration_and_equipment_feed_unverified':signal?.reason||'source_missing';
    readings[id]=Object.freeze({spriteId:id,faceId:route.faceId,
      channel,signal:signal??null,
      status:signal?.valid?'source_only_not_renderable':'blocked',
      reason,ownerGeometryState:route.ownerGeometryState,
      liveNeedleAuthorized:false});
   }
   return Object.freeze({schema:'b737.stage8.pointer-route-snapshot.v1',
     pointers:Object.freeze(readings),knownPointerIdentities:registry.routes.length,
     authorizedLiveMovements:0});
  }
  return Object.freeze({project});
 }
 return Object.freeze({create});
});
