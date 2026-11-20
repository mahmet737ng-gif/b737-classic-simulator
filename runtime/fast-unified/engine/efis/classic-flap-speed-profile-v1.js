/* B737 Classic Speed Tape — owner-provided flap visual-training schedule.
 * NOT AFM-verified. An instructor/visual detent may display TRAINING markings,
 * but must not be presented as a certified FCC/AFDS speed limit.
 * Flap 30 discrepancy: 180 kts from screenshot statement (default), 185 kts
 * from the written list (explicit alternate). Both preserve the 25kt buffer.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicFlapSpeedProfileV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='FLAP-SPEED-PROFILE-0001';
 const ROWS=Object.freeze({
  1:Object.freeze({maximumKt:230,bufferKt:null}),
  2:Object.freeze({maximumKt:230,bufferKt:5}),
  5:Object.freeze({maximumKt:225,bufferKt:15}),
  10:Object.freeze({maximumKt:210,bufferKt:15}),
  15:Object.freeze({maximumKt:195,bufferKt:5}),
  25:Object.freeze({maximumKt:190,bufferKt:5}),
  30:Object.freeze({maximumKt:180,bufferKt:25}),
  40:Object.freeze({maximumKt:158,bufferKt:0})
 });
 const DETENTS=Object.freeze([0,...Object.keys(ROWS).map(Number).sort((a,b)=>a-b)]);
 function get(detent,{flap30MaximumKt=180}={}){
  const n=Number(detent);
  if(!Number.isInteger(n)||!DETENTS.includes(n))throw Error('INVALID_FLAP_DETENT');
  if(![180,185].includes(flap30MaximumKt))throw Error('INVALID_FLAP30_VARIANT');
  if(n===0)return Object.freeze({detent:0,maximumKt:null,bufferKt:null,
   bufferStartKt:null,source:'OWNER_VISUAL_TRAINING',variant:'UP'});
  const row=ROWS[n],maximumKt=n===30?flap30MaximumKt:row.maximumKt;
  return Object.freeze({detent:n,maximumKt,bufferKt:row.bufferKt,
   bufferStartKt:row.bufferKt===null?null:maximumKt-row.bufferKt,
   source:'OWNER_VISUAL_TRAINING',variant:n===30?String(flap30MaximumKt):null});
 }
 return Object.freeze({VERSION,ROWS,DETENTS,get});
});