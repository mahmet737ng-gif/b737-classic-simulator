/* ASP-PHYSICAL-0001 — FCOM 5.10.3/5.10.6.
 * Physical detents map directly to the single ASP audio backend.
 * This helper contains NO second state machine or aircraft-power assumptions.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ASPPhysicalCommandsV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const SEATS=Object.freeze(['CAPT','FO','OBS']);
 const CONTROLS=Object.freeze({
  PTT:Object.freeze({x:145,y:747,positions:Object.freeze(['ASP_RT',null,'ASP_IC']),spring:true}),
  MASK_BOOM:Object.freeze({x:410,y:747,positions:Object.freeze(['MASK','BOOM']),spring:false}),
  ALT_NORM:Object.freeze({x:980,y:747,positions:Object.freeze(['ALT','NORM']),spring:false})
 });
 function validate(seat,kind,value){
  if(!SEATS.includes(seat))throw Error('Unknown ASP station');
  if(!Object.hasOwn(CONTROLS,kind))throw Error('Unknown ASP physical control');
  if(!CONTROLS[kind].positions.includes(value))throw Error('Invalid ASP detent '+kind);
  return true;
 }
 function command(seat,kind,value){
  validate(seat,kind,value);
  return Object.freeze({seat,type:kind==='PTT'?'PTT':kind==='MASK_BOOM'?'MIC_SOURCE':'MODE',value});
 }
 function topBottom(kind,yFraction){
  if(!Object.hasOwn(CONTROLS,kind)||!Number.isFinite(yFraction))throw Error('Invalid ASP pointer');
  const detents=CONTROLS[kind].positions;
  return yFraction<.5?detents[0]:detents[detents.length-1];
 }
 function visualFromBackend(backend,seat){
  if(!backend||backend.schema!=='b737-asp-audio-v1')throw Error('ASP V1 backend required');
  if(!SEATS.includes(seat))throw Error('Unknown station');
  const s=backend.stations[seat];validate(seat,'PTT',s.ptt);
  validate(seat,'MASK_BOOM',s.microphone);validate(seat,'ALT_NORM',s.mode);
  return {seat,PTT:s.ptt,MASK_BOOM:s.microphone,ALT_NORM:s.mode,
   mic:s.mic,receivers:{...s.receivers},volumes:{...s.volumes}};
 }
 return Object.freeze({version:'ASP-PHYSICAL-0001',SEATS,CONTROLS,validate,command,topBottom,visualFromBackend});
});
