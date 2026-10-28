/* ASP CB-EVIDENCE-0003
 * Dynamic photo-label discovery and safe isolation; NEVER overrides the current CB system.
 * No EP-FSI WDM available: actual ASP feed remains unverified and disconnected.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.B737ASPCBTraceV3=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const TARGETS=Object.freeze(['VHF-1','VHF-2','VHF-3','INTERPHONE BAT','INTERPHONE NO.2 BUS','INTERPHONE CAPT & OBS','INTERPHONE OBS AUDIO']);
function parse(catalog){
 const r=[];
 if(!Array.isArray(catalog?.panels))return r;
 for(const panel of catalog.panels){
  for(const entry of String(panel.breakers||'').split(';')){
   const m=entry.trim().match(/^([A-Z]+\d+):([\d.]+)\|(.+)$/);
   if(m)r.push({key:panel.id+'|ALL|'+m[1],panel:panel.id,position:m[1],amps:Number(m[2]),label:m[3].trim()});
  }
 }
 return r;
}
function inspect(catalog,network){
 const all=parse(catalog);
 const labels={};
 for(const label of TARGETS){
  const candidates=all.filter(e=>e.label===label);
  labels[label]={count:candidates.length,status:candidates.length===1?'PHOTO_LABEL_ONLY':candidates.length===0?'NOT_IN_CATALOG':'AMBIGUOUS',
   matches:candidates.map(c=>({...c,breaker:typeof network?.state==='function'?safeState(network,c.key):null}))};
 }
 const bySeat={CAPT:{audioCB:'P6-2|ALL|D23',photoLabel:'EXT BOTTLES RIGHT'},
 FO:{audioCB:'P6-2|ALL|D22',photoLabel:'AURAL WARN'},
 OBS:{audioCB:'P6-2|ALL|D24',photoLabel:'EXT BOTTLES LEFT'}};
 return {schema:'B737_ASP_CB_TRACE_V3',labels,bySeat,activeConnections:0,
  actualASPDevicePower:null,mayConnect:false,
  reason:'MRG P6-2 D22/D23/D24 conflicts with project photo catalogue; EP-FSI effectivity-specific WDM not supplied',
  electricalPolicy:'READ_ONLY_PHOTO_EVIDENCE'};
}
function safeState(n,key){try{const x=n.state(key);return x?{pulled:Boolean(x.pulled),tripped:Boolean(x.tripped)}:null;}catch(_){return null;}}
return Object.freeze({TARGETS,parse,inspect});
});