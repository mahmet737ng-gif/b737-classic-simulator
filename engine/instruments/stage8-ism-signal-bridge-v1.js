/* B737 Classic Stage 8 — read-only ISM-to-gauge signal envelope.
 * Source-backed paths ONLY. No LRU wiring inferred from system-level buses.
 * Simulation quality is explicit; no numerical calibration promoted to live.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737InstrumentSignalBridgeV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){'use strict';
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const own=(o,k)=>o!==null&&typeof o==='object'&&Object.prototype.hasOwnProperty.call(o,k);
 const norm=u=>typeof u==='string'?({Hz:'Hz',CPS:'Hz',hertz:'Hz',kt:'kt',knots:'kt',percent:'%',pct:'%',degC:'°C',celsius:'°C',PSI:'psi',fpm:'ft/min',kgph:'kg/h'}[u]||u):null;
 const exact=(root,path)=>{
  if(typeof path!=='string'||!/^[A-Za-z0-9_.]+$/.test(path))return null;
  let node=root;
  for(const key of path.split('.')){
   if(!own(node,key))return null;
   node=node[key];
  }
  return node;
 };
 function create(contracts){
  if(!contracts||contracts.schema!=='b737.stage8.instrument-signals.v1'||
    Object.keys(contracts.faces||{}).length!==54||contracts.activation!=='BLOCKED')
   throw Error('Authoritative 54-face signal contract required');
  function read({ecu=null,cabinPlant=null,observed={},timeMs=null}={}){
   const output={},stats={faces:0,channels:0,training:0,observed:0,missing:0,invalid:0,readyForLiveRendering:0};
   for(const [id,face] of Object.entries(contracts.faces)){
    const readings={};
    for(const ch of face.channels){
     stats.channels++;
     const override=own(observed,id)&&own(observed[id],ch.id)?observed[id][ch.id]:undefined;
     let reading;
     if(override!==undefined){
      // Invalid authoritative readings must not silently fall back to a simulator surrogate.
      if(override&&override.valid===true&&finite(override.value)&&
          norm(override.unit)&&typeof override.origin==='string'&&override.origin.trim()&&
          (!ch.source.unit||norm(override.unit)===norm(ch.source.unit))){
       reading={value:override.value,unit:override.unit,valid:true,
        provenance:'OBSERVED_SENSOR_WITH_VALIDATION',origin:override.origin,
        status:'available_observed',timeMs:finite(override.timeMs)?override.timeMs:null};
       stats.observed++;
      }else{reading={value:null,unit:ch.source.unit,valid:false,
       status:'invalid_observed',reason:'explicit_observation_failed_validation'};stats.invalid++;}
     }else{
      const provider=ch.source.provider;
      const source=provider==='ecu'?ecu:provider==='cabinPlant'?cabinPlant:null;
      const quality=provider==='ecu'&&ecu?.quality==='TRAINING_SIMULATION_ONLY'?
        'TRAINING_SIMULATION_ONLY':
        provider==='cabinPlant'&&(cabinPlant?.source==='PROVISIONAL_IDEAL_GAS_TRAINER'||
          cabinPlant?.quality==='TRAINING_SIMULATION_ONLY')?'TRAINING_SIMULATION_ONLY':null;
      const value=source?exact(source,ch.source.path):null;
      if(quality&&finite(value)){
       reading={value,unit:ch.source.unit,valid:true,
         provenance:'TRAINING_SIMULATION_ONLY',origin:provider+':'+ch.source.path,
         status:'available_training',timeMs:finite(source.timeMs)?source.timeMs:null};
       stats.training++;
      }else{reading={value:null,unit:ch.source.unit??null,valid:false,
       status:'missing_source',reason:provider&&!quality?'quality_unverified_or_source_missing':
         'not_mapped_or_not_a_finite_source'};stats.missing++;}
     }
     readings[ch.id]=Object.freeze({...reading,
       electricalFeedStatus:'UNKNOWN_PER_INSTRUMENT_BUS_MAP',
       liveNeedleAuthorized:false});
    }
    output[id]=Object.freeze({id,system:face.system,kind:face.kind,
      channels:Object.freeze(readings),displayGeometry:'CALIBRATION_NOT_APPROVED',
      liveNeedleAuthorized:false});
    stats.faces++;
   }
   return Object.freeze({schema:'b737.stage8.signal-snapshot.v1',
     timeMs:finite(timeMs)?timeMs:null,signals:Object.freeze(output),stats:Object.freeze(stats),
     quality:'READ_ONLY_CHANNEL_ENVELOPES_NOT_INSTALLED_NEEDLE_TARGETS'});
  }
  return Object.freeze({read,contracts});
 }
 return Object.freeze({create,exact,norm});
});
