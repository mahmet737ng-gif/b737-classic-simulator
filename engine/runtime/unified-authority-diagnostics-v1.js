/* Non-mutating runtime diagnostics for the existing live Unified ECU+ISN bridge.
 * NO second electrical engine, NO writes to cockpit controls or reference art. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737UnifiedAuthorityDiagnosticsV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const ELECTRICAL_LAMPS=Object.freeze({busOff1:'busOff1',busOff2:'busOff2',
  transferBusOff1:'transferBusOff1',transferBusOff2:'transferBusOff2',
  genOffBus1:'gen-off-bus-1',genOffBus2:'gen-off-bus-2'});
 function audit({bridge,ecu,profile=null}={}){
  const findings=[],checks=[];
  const record=(id,severity,detail)=>findings.push({id,severity,detail});
  if(!bridge?.state?.electrical||!bridge?.lamps){
   record('MISSING_LIVE_BRIDGE','P0','Unified ISN bridge snapshot missing');
   return {status:'BLOCKED',findings,checks};
  }
  const state=bridge.state,e=state.electrical;
  if(e.schema!=='B737_ELECTRICAL_V7_RESULT')record('WRONG_ELECTRICAL_OWNER','P0','Unified live electrical projection is not V7');
  else checks.push('ELECTRICAL_V7_PROJECTED');
  for(const [input,display] of Object.entries(ELECTRICAL_LAMPS)){
   // null has distinct meaning: source conflict/unknown must never be forced OFF.
   if(!Object.hasOwn(e.lamps,input)||!Object.hasOwn(bridge.lamps,display)){
    record('LAMP_NOT_PROJECTED','P1',display+' is absent');
   }else if(e.lamps[input]!==bridge.lamps[display]){
    record('LAMP_STATE_MISMATCH','P0',display+' differs from Electrical V7');
   }else checks.push('LAMP_MATCH_'+display);
  }
  if(bridge.coverage?.busTransferPhysicalControl===false)
   record('BUS_TRANSFER_NOT_PHYSICALLY_WIRED','P0','Unified uses a separate instructor/test control');
  if(Array.isArray(bridge.rejected)&&bridge.rejected.length)
   record('REJECTED_COMMANDS','P0',bridge.rejected.length+' cockpit commands rejected by legacy bridge');
  if(!ecu||ecu.schema!=='b737.isn.ecu-start-test.v1')
   record('ECU_NOT_OBSERVED','P0','Live engine/APU ECU snapshot unavailable');
  else checks.push('ECU_OBSERVED_READONLY');
  if(profile==='B737-300'||profile==='B737-500')
   record('WARN_VARIANT_HARDCODED_400','P1','Legacy ISN pack instantiates 737-400 warning engine; variant-aware injection pending');
  // Equipment bus source is still unknown even when its voltage class is powered.
  if(state.loads?.coverage?.loadsPending>0)
   checks.push('UNVERIFIED_EQUIPMENT_FEEDS_REMAIN_EXPLICIT');
  return {status:findings.some(x=>x.severity==='P0')?'BLOCKED':findings.length?'REVIEW':'PASS',
   findings,checks,source:'READ_ONLY_UNIFIED_AUTHORITATIVE_DIAGNOSTIC'};
 }
 return Object.freeze({audit,ELECTRICAL_LAMPS});
});
