/* Read-only adapter for the approved Owner18 hardware outputs. It changes no
 * guarded-switch source, geometry, detents, close policy or latched effect.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737Owner18ElectricalInputV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const DETENTS=Object.freeze({'battery-master':['OFF','ON'],'standby-power':['BAT','OFF','AUTO'],
  'bus-transfer':['OFF','AUTO'],'generator-disconnect-1':['NORMAL','DISCONNECT'],
  'generator-disconnect-2':['NORMAL','DISCONNECT']});
 function merge(packet,mounted={}){
  if(!packet?.guards)throw Error('Physical overhead snapshot required');
  const next={...packet,guards:{...packet.guards}};
  for(const [id,positions]of Object.entries(DETENTS)){
   const actual=mounted[id];if(!actual)continue;
   if(!positions.includes(actual.value)||typeof actual.closed!=='boolean')throw Error('Invalid Owner18 electrical output '+id);
   const latched=/^generator-disconnect-/.test(id)&&actual.effects?.[id+'-drive-disconnected']===true;
   next.guards[id]={value:latched?'disconnect':actual.value.toLowerCase(),guard:actual.closed?'closed':'open'};
  }
  return next;
 }
 return Object.freeze({DETENTS,merge});
});
