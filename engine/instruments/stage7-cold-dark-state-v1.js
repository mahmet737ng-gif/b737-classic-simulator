/* B737 Stage 7: Cold & Dark physical indicator state from explicit evidence.
 * No guessed sensor zero, no synthetic per-LRU bus, and no live needle writes.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737Stage7ColdDarkV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){'use strict';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const safe=(v,unit,origin)=>Object.freeze({value:v,unit,origin,valid:true,
   status:'physical_initial_condition',provenance:'EXPLICIT_CONDITION',liveNeedleAuthorized:false});
 const unknown=(reason,unit)=>Object.freeze({value:null,unit:unit??null,valid:false,
   status:'initial_condition_unknown',reason,liveNeedleAuthorized:false});
 const truth=(x,k)=>x?.[k]===true;
 const engineIndex=id=>(id.endsWith('.1')?'engine1':id.endsWith('.2')?'engine2':null);
 const engineOff=(c,id)=>{
  const eng=engineIndex(id);
  return !!eng&&c.engineStopped?.[eng]===true;
 };
 function create({contracts,policy}={}){
  if(!contracts||Object.keys(contracts.faces||{}).length!==54||
    !policy||Object.keys(policy.entries||{}).length!==54)
   throw Error('Complete face policy and signal contract required');
  const frozen=new Set(Object.keys(contracts.faces));
  if(Object.keys(policy.entries).some(x=>!frozen.has(x)))
   throw Error('Cold-dark and signal contract inventories diverge');
  function evaluate({signalSnapshot,conditions={}}={}){
   if(signalSnapshot?.schema!=='b737.stage8.signal-snapshot.v1'||
      Object.keys(signalSnapshot.signals).length!==54)
    throw Error('Stage8 54-face signal snapshot required');
   const cold=conditions.coldDarkConfirmed===true;
   const out={},counts={faces:0,channels:0,withSourceValue:0,knownBaseline:0,
     unknown:0,conflictingEvidence:0,liveTargetsApproved:0};
   for(const [id,entry] of Object.entries(contracts.faces)){
    const policyKind=policy.entries[id].kind;
    const inputs=signalSnapshot.signals[id].channels;
    const channels={};
    for(const ch of entry.channels){
     const src=inputs[ch.id];
     if(!src)throw Error('Missing source channel '+id+'/'+ch.id);
     let initial=null;
     if(cold){
      // Cabin altitude is a physical altitude, NEVER zeroed because the
      // aircraft is parked. Field elevation is usable only when equalized.
      if(id==='oh.cabin.diff_pressure_altitude'){
       if(ch.id==='press'&&truth(conditions,'cabinEqualized'))
        initial=safe(0,'psi','explicit_equalized_cabin_to_ambient');
       if(ch.id==='cabAlt'&&truth(conditions,'cabinEqualized')&&finite(conditions.fieldElevationFt))
        initial=safe(conditions.fieldElevationFt,'ft','field_elevation_equalized_pressure_assumption');
      }else if(id==='oh.cabin.rate'&&truth(conditions,'cabinPressureStable'))
       initial=safe(0,'ft/min','confirmed_stable_cabin_pressure');
      else if(id==='oh.duct.pressure_lr'&&truth(conditions,'bleedSourcesOff')&&truth(conditions,'ductPressureDissipated'))
       initial=safe(0,'psi','confirmed_duct_manifold_depressurized');
      else if(id.startsWith('eng.')){
       if(['rotor_zero','fuel_flow_zero','vibration_zero'].includes(policyKind)&&engineOff(conditions,id))
        initial=safe(0,ch.source.unit||policy.entries[id].unit,'confirmed_engine_stationary');
       if(policyKind==='oil_pressure_zero'&&engineOff(conditions,id)&&conditions.oilPressureDissipated?.[engineIndex(id)]===true)
        initial=safe(0,'psi','confirmed_oil_pressure_dissipated');
      }else if(policyKind==='mechanical_low_stop'&&truth(conditions,'aircraftStationary'))
       initial=safe(0,'kt','confirmed_stationary_below_first_printed_ias_tick');
      else if(policyKind==='zero_on_stable_static_pressure'&&truth(conditions,'aircraftStationary'))
       initial=safe(0,'ft/min','confirmed_stationary_static_pressure');
      else if(policyKind==='static_pressure_altitude'&&conditions.baroSettingMatchesQnh===true&&finite(conditions.fieldElevationFt))
       initial=safe(conditions.fieldElevationFt,'ft','field_elevation_with_confirmed_qnh_setting');
      else if(policyKind==='selector_dual_temperature'&&ch.id==='rise'&&
         conditions.driveOilSelector?.[id]==='rise'&&conditions.csdTemperatureEqualized?.[id]===true)
       initial=safe(0,'°C','confirmed_csd_thermal_equilibrium');
     }
     let physical;
     let conflict=false;
     if(src.valid){
       physical={value:src.value,unit:src.unit,origin:src.origin,
         provenance:src.provenance,valid:true,status:src.status,liveNeedleAuthorized:false};
       if(initial&&initial.unit===src.unit&&Math.abs(initial.value-src.value)>0.001){
        conflict=true;
        physical={...physical,status:'conflicting_explicit_initial_condition',reason:'observed_or_training_value_disagrees_with_cold_dark_condition'};
       }
       counts.withSourceValue++;
     }else if(initial){
       physical=initial;counts.knownBaseline++;
     }else{
       physical=unknown(src.status==='invalid_observed'?'invalid_observation':
         cold?'no_proven_cold_dark_physical_reading':'no_qualified_system_source',ch.source.unit);
       counts.unknown++;
     }
     if(conflict)counts.conflictingEvidence++;
     const power=conditions.perInstrumentPowerWiringVerified===true&&
       typeof conditions.perInstrumentPower?.[id]==='boolean'?
       conditions.perInstrumentPower[id] : null;
     channels[ch.id]=Object.freeze({...physical,powerKnown:power!==null,powered:power,
       electricalFeedEvidence:power!==null?'verified_equipment_feed_input':'UNKNOWN_PER_INSTRUMENT_BUS_WIRING',
       // A physical value is not a valid needle command before calibrated geometry.
       liveNeedleAuthorized:false});
     counts.channels++;
    }
    out[id]=Object.freeze({id,kind:policyKind,channels:Object.freeze(channels),
      sourceCalibration:'UNVERIFIED',coldDark: cold,
      pressurizationArchitecture:conditions.pressurizationArchitecture==='CPCS'?'CPCS':
        conditions.pressurizationArchitecture==='DCPCS'?'DCPCS':'UNSELECTED',
      liveNeedleAuthorized:false});counts.faces++;
   }
   return Object.freeze({schema:'b737.stage7.initial-indicator-snapshot.v1',
     faces:Object.freeze(out),counts:Object.freeze(counts),
     safety:'No case-center substitution, zero-for-missing-data, or unverified needle movement'});
  }
  return Object.freeze({evaluate});
 }
 return Object.freeze({create});
});
