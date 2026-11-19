/* FCOM 12.10.1 / Lufthansa LAN ATA 28-40.
 * The fuel valve is driven by engine START LEVER and ENGINE FIRE SWITCH.
 * No measured valve position is available from the current ECU. When the
 * observedPositions input is omitted, model an explicitly training-only
 * 820ms valve transit; do not mistake a command for a real sensor reading.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ISNFuelShutoffIndicatorV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const sides=Object.freeze(['engine1','engine2']),allowed=Object.freeze(['CLOSED','OPEN','TRANSIT']);
 function create({travelMs=820}={}){
  if(!Number.isFinite(travelMs)||travelMs<=0)throw Error('Invalid training transit time');
  const states=Object.fromEntries(sides.map(id=>[id,{position:'CLOSED',command:'CLOSED',from:'CLOSED',startedAt:null}]));
  function observe({levers,fireHandles={},observedPositions={},nowMs}={}){
   if(!levers||!Number.isFinite(nowMs)||nowMs<0)throw Error('Fuel lever feedback and monotonic time required');
   const frames={},positions={},commands={};let transitionStarted=false;
   for(const id of sides){
    const lever=levers[id],s=states[id];
    if(!['IDLE','CUTOFF'].includes(lever))throw Error('Missing engine fuel start lever '+id);
    const commanded=fireHandles[id]===true||lever==='CUTOFF'?'CLOSED':'OPEN';
    if(s.startedAt!==null&&nowMs-s.startedAt>=travelMs){s.position=s.command;s.startedAt=null;}
    if(s.command!==commanded){
     const previous=s.position==='TRANSIT'?s.from:s.position;
     s.from=previous;s.command=commanded;
     if(previous===commanded){s.position=commanded;s.startedAt=null;}
     else{s.position='TRANSIT';s.startedAt=nowMs;transitionStarted=true;}
    }
    const actual=observedPositions[id]??s.position;
    if(!allowed.includes(actual))throw Error('Invalid actual valve position '+id);
    frames[id]=actual==='TRANSIT'||actual!==commanded?'BRIGHT_BLUE':actual==='CLOSED'?'DIM_BLUE':'OFF';
    positions[id]=actual;commands[id]=commanded;
   }
   return {frames,positions,commands,transitionStarted,travelMs,source:'ECU_COMMAND_WITH_TRAINING_TRANSIT_UNLESS_OBSERVED'};
  }
  return Object.freeze({observe});
 }
 return Object.freeze({create,sides});
});
