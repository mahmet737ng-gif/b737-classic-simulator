/* ASP electrical / CB source evidence V2. FCOM 5.20.2; MRG IV.5 p123,
 * MRG IV.6 p139; actual project photo catalog P6-2 is different.
 * Read-only. No physical CB may be remapped to another system.
 */
(function(root,factory){'use strict';const api=factory(typeof module==='object'&&module.exports?require('../systems/asp-audio-v1.js'):root.B737ASPAudioLogicV1);
if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ASPCBSourceAuditV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(A){'use strict';
const EXPECTED=Object.freeze({CAPT:'AUDIO CAPTAIN',FO:'AUDIO FO',OBS:'AUDIO OBS'});
const PHOTO=Object.freeze({CAPT:'EXT BOTTLES RIGHT',FO:'AURAL WARN',OBS:'EXT BOTTLES LEFT'});
function lookup(catalog,key){
 if(!catalog?.panels)return null;
 const [panel,,pos]=key.split('|');const entry=catalog.panels.find(p=>p.id===panel);
 if(!entry)return null;
 const m=String(entry.breakers||'').match(new RegExp('(?:^|;)\\s*'+pos.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')+':(?:\\d+(?:\\.\\d+)?)\\|([^;]+)'));
 return m?m[1].trim():null;
}
function examine({catalog=null,cbNetwork=null,electrical=null}={}){
 const stations={};
 for(const seat of A.SEATS){
  const key=A.CB_CANDIDATES[seat],actual=lookup(catalog,key);
  const label=actual??PHOTO[seat],agree=label===EXPECTED[seat];
  const cb=cbNetwork?.state?.(key)||null;
  const bus=electrical?.bus||null;
  stations[seat]={seat,candidate:key,expectedMRG:EXPECTED[seat],
   actualCatalogLabel:label,source:actual?'LIVE_CB_CATALOG':'REPOSITORY_CB_CATALOG_REFERENCE',
   catalogMatch:agree,sourceStatus:agree?'CANDIDATE_MATCH_NOT_WIRING_VERIFIED':'QUARANTINED_CATALOG_CONFLICT',
   candidateCB:cb?{pulled:Boolean(cb.pulled),tripped:Boolean(cb.tripped)}:null,
   dc2:bus?.dc2??null,battery:bus?.battery??null,
   devicePower:null,cbCanControlASP:false,wireTracing:'EP_FSI_EFFECTIVITY_WDM_REQUIRED',
   notes:'MRG list alone cannot override actual photo catalog or prove alternate ASP power path'};
 }
 return {schema:'B737_ASP_CB_AUDIT_V2',stations,mutatesElectrical:false,
  sourceRefs:['FCOM Vol 2 5.20.2','MRG IV.5 p123','MRG IV.6 p139','Existing CB photo catalog P6-2'],
  activeCBConnections:0,unverifiedSources:true};
}
return Object.freeze({examine,EXPECTED,PHOTO,lookup});
});