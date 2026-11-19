(async()=>{
;
/* ./eis-cold-dark-glass-v1.js?v=EIS-COLD-DARK-0001 */
try{
/* EIS-COLD-DARK-0001. Non-destructive optical blackout for the embedded
 * EIS instrument glass only. The approved source bitmap and all needles,
 * instrument coordinates, engine state, and guarded switches remain intact.
 * Hot Battery and ground-service power alone cannot keep EIS glass illuminated.
 */
(function(){
'use strict';
const ID='eisColdDarkGlassV1',ns='http://www.w3.org/2000/svg';
const feeds=['generator1','generator2','transfer1','transfer2','dc1','dc2','acStandby','battery','switchedHotBattery','dcStandby'];
let piece=null,layer=null,last=null;
function paint(){
 const bus=window.B737ISNCockpitV1?.getState?.()?.state?.electrical?.bus;
 if(!bus||!feeds.every(id=>Object.hasOwn(bus,id)))return;
 const absent=feeds.every(id=>bus[id]===false);
 if(absent!==last){last=absent;if(layer)layer.dataset.unpowered=String(absent);}
}
function mount(){
 if(layer&&layer.isConnected)return true;
 piece=document.querySelector('#region-main .texture-piece[data-piece="engine"]');
 const specs=window.B737ISNEngineGaugeModel?.eisGauges;
 if(!piece||!Array.isArray(specs)||specs.length!==16)return false;
 layer=document.createElementNS(ns,'svg');
 layer.id=ID;layer.classList.add('eis-cold-dark-glass-v1');
 layer.setAttribute('viewBox','0 0 1235 1274');
 layer.setAttribute('preserveAspectRatio','none');
 layer.setAttribute('aria-hidden','true');
 layer.dataset.unpowered=String(last===true); // preserve a power-off state observed before the DOM mounted
 const defs=document.createElementNS(ns,'defs');
 const gradient=document.createElementNS(ns,'radialGradient');
 gradient.setAttribute('id','eisColdDarkLensGradientV1');
 for(const [offset,color] of [['0%','#0a1011'],['84%','#070c0e'],['100%','#12181b']]){
  const stop=document.createElementNS(ns,'stop');
  stop.setAttribute('offset',offset);stop.setAttribute('stop-color',color);
  gradient.appendChild(stop);
 }
 defs.appendChild(gradient);layer.appendChild(defs);
 for(const spec of specs){
  const circle=document.createElementNS(ns,'circle');
  circle.setAttribute('cx',spec.cx);
  circle.setAttribute('cy',spec.cy);
  circle.setAttribute('r',spec.radius+9);
  circle.setAttribute('fill','url(#eisColdDarkLensGradientV1)');
  circle.setAttribute('stroke','#182125');
  circle.setAttribute('stroke-width','1');
  layer.appendChild(circle);
 }
 piece.appendChild(layer);
 paint();
 return true;
}
function sync(){mount();paint();}
window.addEventListener('b737:cockpit-mounted',sync);
for(const event of ['b737:electrical-network','b737:electrical-v7-state',
 'b737:unified-ecu-observation','b737:electrical-owner-ready'])
 window.addEventListener(event,sync);
document.addEventListener('DOMContentLoaded',sync,{once:true});
if(document.readyState!=='loading')sync();
window.B737EISColdDarkGlassV1=Object.freeze({
 refresh:sync,snapshot:()=>({mounted:!!layer?.isConnected,unpowered:last,faces:layer?.querySelectorAll('circle').length||0})
});
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/instruments/stage8-ism-signal-bridge-v1.js?v=ISM-GAUGE-78-A */
try{
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

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/instruments/stage7-cold-dark-state-v1.js?v=ISM-GAUGE-78-A */
try{
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

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/instruments/stage8-pointer-routing-v1.js?v=ISM-GAUGE-78-B */
try{
/* Stage 8 — connect known visual pointer identities to signal envelopes.
 * This is only a source-aware observability map, not a render command.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737InstrumentPointerRoutingV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){'use strict';
 function create(registry){
  if(registry?.schema!=='b737.stage8.pointer-routing.v1'||registry.routes?.length!==38)
   throw Error('Known 38-pointer routing inventory required');
  function project(signalSnapshot,{selectors={}}={}){
   if(signalSnapshot?.schema!=='b737.stage8.signal-snapshot.v1')
    throw Error('Stage8 signal snapshot required');
   const readings={};
   for(const route of registry.routes){
    const id=route.spriteId;
    const face=signalSnapshot.signals[route.faceId];
    if(!face)throw Error('Unknown face '+route.faceId);
    let channel=route.channel;
    if(route.modeSelector){
     const mode=selectors[route.faceId];
     channel=['rise','inlet'].includes(mode)?mode:null;
    }
    const signal=channel?face.channels[channel]:null;
    const reason=channel===null?(route.modeSelector?'selector_unconfirmed':route.mappingRule):
      signal?.valid?'calibration_and_equipment_feed_unverified':signal?.reason||'source_missing';
    readings[id]=Object.freeze({spriteId:id,faceId:route.faceId,
      channel,signal:signal??null,
      status:signal?.valid?'source_only_not_renderable':'blocked',
      reason,ownerGeometryState:route.ownerGeometryState,
      liveNeedleAuthorized:false});
   }
   return Object.freeze({schema:'b737.stage8.pointer-route-snapshot.v1',
     pointers:Object.freeze(readings),knownPointerIdentities:registry.routes.length,
     authorizedLiveMovements:0});
  }
  return Object.freeze({project});
 }
 return Object.freeze({create});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/instruments/stage5-scale-mapping-v1.js?v=ISM-GAUGE-910-A */
try{
/* B737 Classic stage 5: physically anchored numerical scale preparation.
 * Never authorizes real instrument readings from candidate photo measurements.
 * Works as a UMD module in the cockpit and Node tests, without side effects.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737Stage5ScaleMappingV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const bearing=(p,pt)=>Math.atan2(pt.x-p.x,p.y-pt.y)*180/Math.PI;
 const circDiff=(a,b)=>Math.abs((((a-b+180)%360)+360)%360-180);
 function compile(candidate){
  if(!candidate||!candidate.source||!/^[a-f0-9]{64}$/i.test(candidate.source.sha256||''))
   throw Error('Immutable source hash required');
  const {id,mode,kind='rotary',unit,pivot,anchors}=candidate;
  if(!id||!mode||!unit||!['rotary','linear'].includes(kind))
   throw Error('Source-backed ID/mode/unit and mechanical kind required');
  if(!Array.isArray(anchors)||anchors.length<2)throw Error('Two photo-number anchors required');
  if(kind==='rotary'&&(!pivot||![pivot.x,pivot.y].every(finite)))
   throw Error('Uncertified or absent rotary pivot');
  const order=candidate.increasingDirection;
  if(kind==='rotary'&&!['clockwise','counterclockwise'].includes(order))
   throw Error('Rotary direction required');
  if(kind==='linear'&&!['increasing_x','decreasing_x','increasing_y','decreasing_y'].includes(order))
   throw Error('Linear direction required');
  const marks=anchors.map((v,i)=>{
   if(!finite(v.value)||!v.origin||v.origin==='assumed'||!v.status)
    throw Error('Value and provenance required for anchor '+i);
   if(kind==='rotary'){
    if(!finite(v.angleDeg)&&(!v.point||![v.point.x,v.point.y].every(finite)))
     throw Error('Measured candidate bearing required');
    if(v.point&&![v.point.x,v.point.y].every(finite))throw Error('Invalid candidate pixel point');
    const derived=v.point?bearing(pivot,v.point):null;
    if(finite(v.angleDeg)&&finite(derived)&&circDiff(v.angleDeg,derived)>(candidate.maxPhotoBearingErrorDeg??0.4))
     throw Error('Point/angle disagree');
    return Object.freeze({...v,angleDeg:finite(v.angleDeg)?v.angleDeg:derived});
   }
   if(!v.point||![v.point.x,v.point.y].every(finite))throw Error('Linear pixel point required');
   return Object.freeze({...v});
  });
  for(let i=1;i<marks.length;i++)
   if(!(marks[i].value>marks[i-1].value))
    throw Error('Anchors must increase strictly by numeric value');
  const turn=order==='clockwise'?1:-1;
  const unwrapped=marks.map((m,i)=>{
   if(kind!=='rotary')return m;
   let a=m.angleDeg;
   if(i>0){
    while((a-marks[i-1].angleUnwrappedDeg)*turn<=0)a+=360*turn;
    const span=(a-marks[i-1].angleUnwrappedDeg)*turn;
    if(span>(candidate.maxGapDeg??125))throw Error('Angular gap needs independent source review');
   }
   marks[i]=Object.freeze({...m,angleUnwrappedDeg:a});
   return marks[i];
  });
  if(kind==='rotary'&&Math.abs(unwrapped.at(-1).angleUnwrappedDeg-unwrapped[0].angleUnwrappedDeg)>360)
   throw Error('Implausible full sweep');
  // An approved map must be tied to independent exact shaft and all tick review;
  // schema cannot be promoted merely by swapping status='approved'.
  const approved=candidate.approval?.allNativeTicksReviewed===true &&
       candidate.approval?.shaftPivotPhotoReviewed===true &&
       candidate.approval?.sourceGeometryReviewed===true &&
       marks.every(x=>x.status==='measured_source_pixels_approved') &&
       candidate.approval?.reviewerEvidence?.length>0;
  function locate(value,{preview=false,outOfRange='reject'}={}){
   if(!approved&&!preview)return Object.freeze({status:'blocked',reason:'stage5_geometry_not_certified',id,mode});
   if(!finite(value))return Object.freeze({status:'unavailable',reason:'invalid_value',id,mode});
   let v=value;
   const min=marks[0].value,max=marks.at(-1).value;
   if(value<min||value>max){
    if(outOfRange==='reject')return Object.freeze({status:'out_of_range',id,mode,input:value,min,max});
    if(outOfRange!=='clamp')throw Error('Use explicit reject or clamp policy');
    v=Math.min(max,Math.max(min,v));
   }
   let i=1;
   while(i<marks.length-1&&v>marks[i].value)i++;
   const a=marks[i-1],b=marks[i],t=(v-a.value)/(b.value-a.value);
   let tip=null, angleDeg=null;
   if(kind==='rotary'){
    angleDeg=a.angleUnwrappedDeg+(b.angleUnwrappedDeg-a.angleUnwrappedDeg)*t;
    // Pixel tip is a *radial arc*, never the chord between two marks.
    if(a.point&&b.point){
     const ra=Math.hypot(a.point.x-pivot.x,a.point.y-pivot.y);
     const rb=Math.hypot(b.point.x-pivot.x,b.point.y-pivot.y);
     const radius=ra+(rb-ra)*t,r=angleDeg*Math.PI/180;
     tip={x:pivot.x+radius*Math.sin(r),y:pivot.y-radius*Math.cos(r)};
    }
   }else{
    tip={x:a.point.x+(b.point.x-a.point.x)*t,
         y:a.point.y+(b.point.y-a.point.y)*t};
   }
   return Object.freeze({status:v!==value?'pegged':approved?'ok':'preview_unverified',
    id,mode,value:v,angleDeg,tip,bracket:[a.value,b.value],fraction:t,certified:approved});
  }
  return Object.freeze({id,mode,unit,kind,pivot,approved,
   marks:Object.freeze(unwrapped),min:marks[0].value,max:marks.at(-1).value,
   locate});
 }
 return Object.freeze({compile,bearing,circDiff});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/instruments/stage9-needle-dynamics-v1.js?v=ISM-GAUGE-910-A */
try{
/* B737 Classic / Stage 9 — deterministic, source-gated analogue needle dynamics.
 * Parameter defaults are TRAINING TEST ONLY, never claimed as instrument LRU
 * transfer functions. No DOM or Unified needle write APIs are used.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737Stage9NeedleDynamicsV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){'use strict';
 const valid=n=>typeof n==='number'&&Number.isFinite(n);
 const clip=(n,min,max)=>Math.max(min,Math.min(max,n));
 const MODES=Object.freeze(['direct','slew','first_order','second_order']);
 const failures=Object.freeze(['none','sensor_lost','sensor_disagree','needle_jammed','power_lost','data_stale']);
 function create({id,profile,limits,initialAngleDeg=null}={}){
  if(typeof id!=='string'||!id||!profile||!MODES.includes(profile.mode))
   throw Error('Explicit needle ID and response model required');
  const {mode}=profile;
  if(mode==='slew'&&(!valid(profile.speedDegPerSec)||profile.speedDegPerSec<=0))
   throw Error('Slew rate required');
  if(mode==='first_order'&&(!valid(profile.tauSeconds)||profile.tauSeconds<=0))
   throw Error('First-order time constant required');
  if(mode==='second_order'&&(!valid(profile.omegaRadSec)||profile.omegaRadSec<=0||
      !valid(profile.dampingRatio)||profile.dampingRatio<=0))
   throw Error('Second-order frequency and damping required');
  if(!limits||!valid(limits.minAngleDeg)||!valid(limits.maxAngleDeg)||
      limits.minAngleDeg>=limits.maxAngleDeg)
   throw Error('Source-constrained mechanical stops required');
  if(initialAngleDeg!==null&&!valid(initialAngleDeg))throw Error('Initial angle must be finite');
  if(profile.lossBehavior!==undefined&&!['hold','invalidate'].includes(profile.lossBehavior))
   throw Error('Unsupported loss behavior: no invented zero/reset');
  if(profile.staleThresholdMs!==undefined&&
     (!valid(profile.staleThresholdMs)||profile.staleThresholdMs<=0))
   throw Error('Invalid freshness threshold');
  let angle=initialAngleDeg===null?null:clip(initialAngleDeg,limits.minAngleDeg,limits.maxAngleDeg);
  let velocity=0,lastTarget=null,status='uninitialized',steps=0,lastEvidence=null;
  const snapshot=()=>Object.freeze({id,status,angleDeg:angle,targetAngleDeg:lastTarget,
    velocityDegPerSec:velocity,direction:Math.abs(velocity)<1e-6?'stationary':velocity>0?'clockwise':'counterclockwise',
    steps,lastEvidence,liveNeedleAuthorized:false,physicalCertification:'UNVERIFIED_TRAINING_DYNAMICS'});
  function update({targetAngleDeg=null,validSample=false,dtSeconds=0,
      sampleAgeMs=null,power='unknown',fault='none',source=null}={}){
   if(!valid(dtSeconds)||dtSeconds<0||dtSeconds>30)throw Error('Invalid elapsed interval');
   if(!['on','off','unknown','not_required'].includes(power))throw Error('Explicit power state required');
   if(!failures.includes(fault))throw Error('Unrecognised fault');
   if(sampleAgeMs!==null&&(!valid(sampleAgeMs)||sampleAgeMs<0))throw Error('Invalid sample age');
   if(validSample&&(!valid(targetAngleDeg)||typeof source!=='string'||!source))
     throw Error('Qualified sample must have finite angle and source provenance');
   const stale=validSample&&sampleAgeMs!==null&&valid(profile.staleThresholdMs)&&
       sampleAgeMs>profile.staleThresholdMs;
   const failure=fault!=='none'?fault:
      power==='off'?'power_lost':(profile.requiresPower!==false&&power!=='on'?'power_unverified':
       stale?'data_stale':!validSample?'signal_unavailable':null);
   steps++;
   if(failure){
    status=failure;
    lastEvidence=source;
    // HOLD is the only generic fail-safe without a verified per-instrument
    // loss-of-power park or spring-rest mechanic. Do not synthesize rest zero.
    if(profile.lossBehavior==='invalidate'){angle=null;velocity=0;lastTarget=null;}
    else velocity=0;
    return snapshot();
   }
   const target=clip(targetAngleDeg,limits.minAngleDeg,limits.maxAngleDeg);
   lastTarget=target;lastEvidence=source;
   if(angle===null){angle=target;velocity=0;status='initialized';return snapshot();}
   if(fault==='needle_jammed'){status='needle_jammed';velocity=0;return snapshot();}
   if(mode==='direct'){
    const prev=angle;angle=target;velocity=dtSeconds>0?(target-prev)/dtSeconds:0;
   }else if(mode==='slew'){
    const prev=angle;
    const permitted=profile.speedDegPerSec*dtSeconds;
    angle+=clip(target-angle,-permitted,permitted);
    velocity=dtSeconds>0?(angle-prev)/dtSeconds:0;
   }else if(mode==='first_order'){
    const prev=angle;
    const fraction=1-Math.exp(-dtSeconds/profile.tauSeconds);
    angle+=(target-angle)*fraction;
    velocity=dtSeconds>0?(angle-prev)/dtSeconds:0;
   }else{
    // Deterministic sub-stepping avoids instability at variable render FPS.
    let remaining=dtSeconds;
    while(remaining>0){
     const h=Math.min(remaining,0.008);
     const accel=profile.omegaRadSec**2*(target-angle)-
        2*profile.dampingRatio*profile.omegaRadSec*velocity;
     velocity+=accel*h;
     angle+=velocity*h;
     if(angle<=limits.minAngleDeg&&velocity<0)velocity=0;
     if(angle>=limits.maxAngleDeg&&velocity>0)velocity=0;
     angle=clip(angle,limits.minAngleDeg,limits.maxAngleDeg);
     remaining-=h;
     if(remaining<1e-10)remaining=0;
    }
   }
   if(angle<=limits.minAngleDeg&&velocity<0)velocity=0;
   if(angle>=limits.maxAngleDeg&&velocity>0)velocity=0;
   angle=clip(angle,limits.minAngleDeg,limits.maxAngleDeg);
   status=Math.abs(angle-target)<1e-7?'settled':'tracking';
   return snapshot();
  }
  function reset({angleDeg=null}={}){
   if(angleDeg!==null&&!valid(angleDeg))throw Error('Reset angle invalid');
   angle=angleDeg===null?null:clip(angleDeg,limits.minAngleDeg,limits.maxAngleDeg);
   velocity=0;lastTarget=null;status='uninitialized';steps=0;lastEvidence=null;
   return snapshot();
  }
  return Object.freeze({update,snapshot,reset,id,limits:Object.freeze({...limits}),
    profile:Object.freeze({...profile})});
 }
 return Object.freeze({create,MODES,failures});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/instruments/stage10-needle-workbench-v1.js?v=ISM-GAUGE-910-A */
try{
/* B737 Classic / Stage 10: read-only unified analogue motion sandbox.
 * Stage8 signal -> Stage5 provisional scale -> Stage9 simulated response.
 * Does NOT contain any DOM mutation, needle renderer, sprite write, or
 * escalation path from candidate calibration to a released instrument.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737Stage10NeedleWorkbenchV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){'use strict';
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const units=u=>({knots:'kt',kt:'kt',hertz:'Hz',CPS:'Hz','°C':'°C',
    'PSI':'psi',psi:'psi',ft:'ft',A:'A',Hz:'Hz'}[u]||u);
 const selectMode=route=>route.channel==='cabAlt'?'cabinAltitude':
    route.channel==='press'?'diffPressure':route.modeSelector?'UNVERIFIED_MODE':'primary';
 function create({routes,scales,scaleEngine,dynamics,profileRegistry=null,
    previewPowerPolicy='require_verified_feed',observedMaxAgeMs=5000}={}){
  if(routes?.schema!=='b737.stage8.pointer-routing.v1'||routes.routes?.length!==38||
     scales?.schema!=='b737.stage10.candidate-calibration-subset.v1'||
     scales.counts?.scaleModes!==7||scaleEngine?.compile===undefined||!dynamics?.create)
   throw Error('Exact stage8 routing, stage5 draft map and stage9 model required');
  if(!['require_verified_feed','training_qa_assume_power'].includes(previewPowerPolicy))
   throw Error('Invalid preview-only power option');
  if(!finite(observedMaxAgeMs)||observedMaxAgeMs<=0||observedMaxAgeMs>60000)
   throw Error('QA observed signal freshness window invalid');
  if(scales.readiness!=='PREVIEW_ONLY_0_PHOTO_APPROVAL'||routes.counts?.liveApproved!==0)
   throw Error('Geometry authorisation must remain blocked');
  if(profileRegistry&&(profileRegistry.schema!=='b737.stage9.pointer-response-contracts.v1'||
      profileRegistry.pointers?.length!==38||profileRegistry.counts?.certifiedMechanicalResponseProfiles!==0))
   throw Error('Invalid source stage9 response profile registry');
  const registryProfiles=new Map((profileRegistry?.pointers||[]).map(r=>[r.pointerId,r]));
  // Source-time evidence is independent from the monotonic animation clock.
  // Observed sensor timeMs MUST be Unix milliseconds; training plant values
  // remain QA-only and are never interpreted as certified live sensor feeds.
  const drivers=new Map(),results={},blocked={},lastObserved=new Map();
  for(const route of routes.routes){
   const mode=selectMode(route),key=route.faceId+':'+mode;
   const c=route.channel===null?null:scales.calibrations[key];
   if(!c){blocked[route.spriteId]=route.channel===null?'channel_not_resolved':'no_two_anchor_scale';continue;}
   if(c.approval?.allNativeTicksReviewed||c.approval?.shaftPivotPhotoReviewed)
    throw Error('Preview registry must not include promoted geometry');
   const compiled=scaleEngine.compile({...c,id:c.faceId});
   if(compiled.approved)throw Error('Stage10 preview must never load an approved map');
   const a=compiled.marks[0].angleUnwrappedDeg,b=compiled.marks.at(-1).angleUnwrappedDeg;
   if(!finite(a)||!finite(b)||a>=b)throw Error('Source scale direction ambiguous');
   const trainingProfile=route.faceId.startsWith('oh.elec.')?
     {mode:'slew',speedDegPerSec:120,requiresPower:true,lossBehavior:'hold'}:
     route.faceId==='oh.fuel.temperature'?
       {mode:'first_order',tauSeconds:2.0,requiresPower:true,lossBehavior:'hold'}:
       {mode:'second_order',omegaRadSec:5,dampingRatio:1.1,requiresPower:true,lossBehavior:'hold'};
   const entry=registryProfiles.get(route.spriteId);
   if(profileRegistry&&(!entry||entry.faceId!==route.faceId||!entry.response||entry.approvedForOperationalMotion))
    throw Error('Unverified stage9 response profile for '+route.spriteId);
   const profile=entry?entry.response:trainingProfile;
   drivers.set(route.spriteId,{route,compiled,profile,
     motion:dynamics.create({id:route.spriteId,profile,limits:{minAngleDeg:a,maxAngleDeg:b}})});
  }
  let priorTimeMs=null,priorObservationNowMs=null;
  function evaluate(pointerSnapshot,{nowMs=null,observationNowMs=null}={}){
   if(pointerSnapshot?.schema!=='b737.stage8.pointer-route-snapshot.v1'||
     Object.keys(pointerSnapshot.pointers||{}).length!==38)
    throw Error('Stage8 38-pointer snapshot required');
   if(nowMs!==null&&(!finite(nowMs)||nowMs<0))throw Error('Positive simulation clock required');
   if(observationNowMs!==null&&(!finite(observationNowMs)||observationNowMs<0))
    throw Error('Observed sensor wall clock invalid');
   if(nowMs!==null&&priorTimeMs!==null&&nowMs<priorTimeMs)
    throw Error('Source clock moved backward; reset workbench explicitly');
   if(observationNowMs!==null&&priorObservationNowMs!==null&&
      observationNowMs<priorObservationNowMs)
    throw Error('Observed source clock moved backward; reset workbench explicitly');
   const dt=nowMs!==null&&priorTimeMs!==null?
     Math.min(1,(nowMs-priorTimeMs)/1000):0;
   if(nowMs!==null)priorTimeMs=nowMs;
   if(observationNowMs!==null)priorObservationNowMs=observationNowMs;
   const output={},counts={total:38,geometryPreviewCapable:drivers.size,withQualifiedSignal:0,
      dynamicsEvaluated:0,blockedNoCalibration:0,missingData:0,powerUnknown:0,
      liveNeedlesMoved:0,observedRejected:0,staleObservations:0,
      replayedObservations:0};
   for(const [id,route] of Object.entries(pointerSnapshot.pointers)){
    if(!drivers.has(id)){
     output[id]=Object.freeze({status:'blocked',reason:blocked[id]||'unreviewed_geometry',
       angleDeg:null,targetAngleDeg:null,liveNeedleAuthorized:false});
     counts.blockedNoCalibration++;
     continue;
    }
    const driver=drivers.get(id),reading=route.signal;
    const observed=reading?.provenance==='OBSERVED_SENSOR_WITH_VALIDATION';
    let observedFault='none',sourceIntegrity='not_observed',observationAgeMs=null;
    if(observed){
     const at=reading.timeMs,prev=lastObserved.get(id);
     if(!finite(at)||at<0){
      observedFault='sensor_lost';sourceIntegrity='observed_timestamp_missing';
     }else if(observationNowMs===null){
      observedFault='sensor_lost';sourceIntegrity='observation_clock_missing';
     }else{
      const age=observationNowMs-at;
      if(age < -250){
       observedFault='sensor_lost';sourceIntegrity='observed_timestamp_future';
      }else if(age>observedMaxAgeMs){
       observedFault='data_stale';sourceIntegrity='observed_timestamp_stale';
       counts.staleObservations++;
      }else if(prev&&at<prev.timeMs){
       observedFault='sensor_lost';sourceIntegrity='observed_timestamp_replay';
       counts.replayedObservations++;
      }else if(prev&&at===prev.timeMs&&reading.value!==prev.value){
       observedFault='sensor_lost';sourceIntegrity='observed_timestamp_mutated';
       counts.replayedObservations++;
      }else{
       sourceIntegrity='fresh_observed';observationAgeMs=Math.max(0,age);
       lastObserved.set(id,{timeMs:at,value:reading.value});
      }
     }
     if(observedFault!=='none')counts.observedRejected++;
    }else if(reading?.provenance==='TRAINING_SIMULATION_ONLY'){
     sourceIntegrity='training_only_not_timestamp_certified';
    }
    const validSignal=!!reading?.valid&&finite(reading.value)&&
       units(reading.unit)===units(driver.compiled.unit)&&observedFault==='none';
    if(validSignal)counts.withQualifiedSignal++;
    else counts.missingData++;
    let target=null,angleTarget=null;
    if(validSignal){
     target=driver.compiled.locate(reading.value,{preview:true,outOfRange:'reject'});
     if((target.status==='preview_unverified')&&finite(target.angleDeg))
       angleTarget=target.angleDeg;
    }
    const trainingPowerAssumed=previewPowerPolicy==='training_qa_assume_power';
    const observedPower=reading?.electricalFeedStatus==='verified_equipment_feed_input'&&
       typeof reading?.powered==='boolean'?(reading.powered?'on':'off'):'unknown';
    const power=trainingPowerAssumed?'on':observedPower;
    if(power==='unknown')counts.powerUnknown++;
    const motion=driver.motion.update({
      targetAngleDeg:angleTarget,validSample:finite(angleTarget),dtSeconds:dt,
      sampleAgeMs:observationAgeMs,
      power,source:reading?.origin||route.spriteId,
      fault:observedFault!=='none'?observedFault:
       (reading?.status==='invalid_observed'?'sensor_disagree':'none')
    });
    if(finite(angleTarget))counts.dynamicsEvaluated++;
    output[id]=Object.freeze({
      status:observedFault!=='none'?motion.status:
       (finite(angleTarget)?motion.status:(target?.status||'source_unavailable')),
      sourceStatus:reading?.status||'unknown',sourceValue:validSignal?reading.value:null,
      sourceIntegrityStatus:sourceIntegrity,observedAgeMs:observationAgeMs,
      sourceUnit:reading?.unit||null,simulationAngleDeg:motion.angleDeg,
      simulationTargetDeg:motion.targetAngleDeg,
      simulatedVelocityDegPerSec:motion.velocityDegPerSec,
      sourceCandidateStatus:target?.status||null,
      previewPowerAssumed:trainingPowerAssumed,
      simulatedPowerStatus:power,
      previewOnly:true,
      liveNeedleAuthorized:false,
      spriteUnchanged:true
    });
   }
   Object.assign(results,output);
   return Object.freeze({
     schema:'b737.stage10.readonly-motion-snapshot.v1',
     counts:Object.freeze(counts),pointers:Object.freeze(output),
     releaseStatus:'RENDER_OUTPUT_BLOCKED_STAGE3_6_PIXEL_CERTIFICATION',
     previewPowerPolicy
   });
  }
  function reset(){
   priorTimeMs=null;priorObservationNowMs=null;lastObserved.clear();
   for(const x of drivers.values())x.motion.reset();
   for(const k of Object.keys(results))delete results[k];
  }
  return Object.freeze({evaluate,reset,getPreparedModels:()=>Object.freeze({count:drivers.size,
    ids:Object.freeze([...drivers.keys()])}),getLast:()=>Object.freeze({...results})});
 }
 return Object.freeze({create});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
