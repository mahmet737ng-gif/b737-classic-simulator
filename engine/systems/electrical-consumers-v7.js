/* Explicit consumer power adapter. No undocumented electrical feed may be inferred.
 * Empty bindings are intentional. Validation belongs to private technical network.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ElectricalConsumersV7=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const REQUIRES_VERIFICATION=Object.freeze(['stall.test115vac','dcpcs.controller1','dcpcs.controller2','cpcs.acServo','cpcs.dcServo','pneumatics.packLeft','pneumatics.packRight','fuel.mainLeftFwdPump','hyd.elecPumpA','hyd.elecPumpB']);
 const contract=Object.freeze(Object.fromEntries(REQUIRES_VERIFICATION.map(x=>[x,{bus:null,status:'UNVERIFIED',value:null}])));
 const validBus=new Set(['generator1','generator2','transfer1','transfer2','main1','main2','dc1','dc2','battery','hotBattery','switchedHotBattery','acStandby','dcStandby','groundService']);
 function project(electrical,bindings=[]){if(!electrical||!electrical.bus)throw Error('Electrical output required');if(!Array.isArray(bindings))throw Error('Bindings must be a list');
   const result=Object.fromEntries(REQUIRES_VERIFICATION.map(x=>[x,{...contract[x]}]));
   for(const b of bindings){
     if(!b||!REQUIRES_VERIFICATION.includes(b.id))throw Error('Unrecognized equipment ID');
     if(!validBus.has(b.bus))throw Error('Unknown electrical bus');
     if(b.status!=='VERIFIED'||typeof b.sourceRef!=='string'||!b.sourceRef.trim()||b.reviewedForAirframe!=='EP-FSI')throw Error('Exact EP-FSI bus routing needs a reviewable sourceRef');
     result[b.id]={bus:b.bus,status:'VERIFIED',value:electrical.bus[b.bus],sourceRef:b.sourceRef};
   }
   return result;
 }
 return Object.freeze({REQUIRES_VERIFICATION,contract,project});
});