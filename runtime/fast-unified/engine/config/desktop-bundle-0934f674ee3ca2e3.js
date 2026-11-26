(async()=>{
;
/* ../../engine/config/aircraft-profile-v1.js?v=FAMILY-IDENT-400-22K-0001 */
try{
/* B737 Classic selectable training configuration.
 * The selection is independent of airframe serial/effectivity. It is NOT an
 * assertion that a particular aircraft has all selectable installations.
 * Both pressurization engines retain their own state and source limitations.
 */
(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B737AircraftProfileV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : null, function() {
  'use strict';

  const SCHEMA = 'b737-classic-aircraft-profile/1';
  const STORAGE_KEY = 'b737classic.aircraft-profile.v1';
  const FIELDS = Object.freeze(['aircraftFamily', 'aircraftModel', 'engineVariant', 'pressurization', 'engineInstruments']);
  const CATALOG = Object.freeze({
    aircraftFamily: Object.freeze([
      Object.freeze({id: 'B737-300-500', label: '737-300 / 737-500', variants: Object.freeze(['737-300', '737-500'])}),
      Object.freeze({id: 'B737-400', label: '737-400', variants: Object.freeze(['737-400'])})
    ]),
    aircraftModel: Object.freeze([
      Object.freeze({id:'737-300',label:'Boeing 737-300 · EP/FSI',registration:'EP/FSI',family:'B737-300-500'}),
      Object.freeze({id:'737-400',label:'Boeing 737-400 · EP/AOA',registration:'EP/AOA',family:'B737-400'}),
      Object.freeze({id:'737-500',label:'Boeing 737-500 · EP/FSQ',registration:'EP/FSQ',family:'B737-300-500'})
    ]),
    engineVariant: Object.freeze([
      Object.freeze({id:'CFM56-3B1',label:'CFM56-3 B1',rating:'18.5K',ratingLbf:18500}),
      Object.freeze({id:'CFM56-3B3',label:'CFM56-3 B3',rating:'20K',ratingLbf:20000}),
      Object.freeze({id:'CFM56-3B2',label:'CFM56-3 B2',rating:'22K',ratingLbf:22000}),
      Object.freeze({id:'CFM56-3C1',label:'CFM56-3 C1',rating:'23.5K',ratingLbf:23500})
    ]),
    pressurization: Object.freeze([
      Object.freeze({id: 'DCPCS', label: 'DCPCS', engine: 'B737DCPCSV4', version: 4, lab: 'dcpcs-lab/', backgroundAsset: 'panel-mosaic-lab/assets/locked/2026-10-23/DCPCS_Background_Owner.png'}),
      Object.freeze({id: 'CPCS', label: 'CPCS', engine: 'B737CPCSV5', version: 5, lab: 'cpcs-lab/'})
    ]),
    engineInstruments: Object.freeze([
      Object.freeze({id: 'EIS', label: 'EIS · Electronic Engine Instruments', imageStatus: 'AWAITING_APPROVED_ASSETS'}),
      Object.freeze({id: 'CONVENTIONAL', label: 'Non-EIS · Analog Engine Instruments', imageStatus: 'AWAITING_APPROVED_ASSETS'})
    ])
  });
  // Deliberate simulator defaults, not an EP-FSI installation declaration.
  const DEFAULTS = Object.freeze({schema: SCHEMA, aircraftFamily: 'B737-300-500', aircraftModel:'737-300', engineVariant:'CFM56-3B3', pressurization: 'DCPCS', engineInstruments: 'EIS'});
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  // Simulator-specific fixed IDENT configuration. Family is the only editable aircraft model choice.
  const assignedModel = (family,preferred) => family === 'B737-400' ? '737-400' : preferred==='737-500'?'737-500':'737-300';
  const assignedEngine = family => family === 'B737-400' ? 'CFM56-3B2' : 'CFM56-3B3';

  function validate(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Aircraft profile must be an object');
    if (value.schema !== SCHEMA) throw Error('Unsupported aircraft profile schema');
    for (const key of Object.keys(value)) if (key !== 'schema' && !FIELDS.includes(key)) throw Error('Unknown aircraft profile field: ' + key);
    for (const key of FIELDS) {
      if (!CATALOG[key].some(option => option.id === value[key])) throw Error('Invalid aircraft profile option: ' + key);
    }
    if (value.aircraftModel !== assignedModel(value.aircraftFamily,value.aircraftModel))
      throw Error('IDENT aircraft model must match the selected family');
    if (value.engineVariant !== assignedEngine(value.aircraftFamily))
      throw Error('IDENT engine rating must match the selected family');
    return true;
  }
  function normalize(data) {
    const result = {...DEFAULTS};
    if (data && data.schema === SCHEMA) for (const field of FIELDS) {
      if (CATALOG[field].some(option => option.id === data[field])) result[field] = data[field];
    }
    // Always migrate old saved manual selections to the family-derived IDENT model/rating.
    result.aircraftModel=assignedModel(result.aircraftFamily,result.aircraftModel);
    result.engineVariant=assignedEngine(result.aircraftFamily);
    return result;
  }
  function resolve(input) {
    const profile = normalize(input);
    const byId = key => CATALOG[key].find(option => option.id === profile[key]);
    return {
      profile: {...profile},
      family: byId('aircraftFamily'),
      aircraftModel: byId('aircraftModel'),
      engineVariant: byId('engineVariant'),
      pressurization: byId('pressurization'),
      engineInstruments: byId('engineInstruments'),
      configurationNote: 'Independent educational selections; not a serial-specific installation or verified performance model.'
    };
  }
  function createStore(options = {}) {
    const storage = options.storage || null;
    const emitter = options.emitter || null;
    const subscribers = new Set();
    let current = {...DEFAULTS};
    if (storage) {
      try { current = normalize(JSON.parse(storage.getItem(STORAGE_KEY))); } catch (_) { current = {...DEFAULTS}; }
    }
    function notify(reason) {
      const detail = {profile: {...current}, resolved: resolve(current), reason};
      for (const listener of subscribers) listener(detail);
      if (emitter && typeof emitter.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        emitter.dispatchEvent(new CustomEvent('b737:aircraft-profile-change', {detail}));
      }
    }
    function set(patch) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw Error('Invalid aircraft profile update');
      for (const key of Object.keys(patch)) if (!FIELDS.includes(key)) throw Error('Cannot update aircraft profile field: ' + key);
      const next = {...current, ...patch};
      if (has(patch,'aircraftModel') && !has(patch,'aircraftFamily')) {
        const model=CATALOG.aircraftModel.find(x=>x.id===patch.aircraftModel);
        if(!model)throw Error('Unknown aircraft model');
        next.aircraftFamily=model.family;
      }
      // No independent model or thrust-rating selection: engine / IDENT always follow family.
      next.aircraftModel=assignedModel(next.aircraftFamily,next.aircraftModel);
      next.engineVariant=assignedEngine(next.aircraftFamily);
      validate(next);
      if (FIELDS.every(key => next[key] === current[key])) return {...current};
      if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(next));
      current = next;
      notify('updated');
      return {...current};
    }
    function handleStorage(event) {
      if (event.key !== STORAGE_KEY) return;
      let next;
      try { next = normalize(JSON.parse(event.newValue)); } catch (_) { next = {...DEFAULTS}; }
      if (FIELDS.every(key => next[key] === current[key])) return;
      current = next;
      notify('external-update');
    }
    if (emitter && typeof emitter.addEventListener === 'function') emitter.addEventListener('storage', handleStorage);
    return Object.freeze({
      get: () => ({...current}),
      set,
      resolve: () => resolve(current),
      subscribe(listener) { if (typeof listener !== 'function') throw Error('Expected profile subscriber'); subscribers.add(listener); return () => subscribers.delete(listener); },
      destroy() { subscribers.clear(); if (emitter && typeof emitter.removeEventListener === 'function') emitter.removeEventListener('storage', handleStorage); }
    });
  }
  function createPressurizationSession(profile, engines, options = {}) {
    const selected = resolve(profile).pressurization;
    const engine = engines && engines[selected.engine];
    if (!engine || typeof engine.initial !== 'function' || typeof engine.apply !== 'function' || typeof engine.derive !== 'function') {
      throw Error('Selected pressurization engine not loaded: ' + selected.engine);
    }
    // The physical model is OPTIONAL: existing source-linked controller labs
    // continue accepting direct instructor sensor values without synthesized
    // pressure. In Unified it is separately enabled and explicitly provisional.
    const plant = engines && engines.B737CabinPressurePlantV1;
    const hasPlant = !!(plant && typeof plant.initial === 'function' && typeof plant.step === 'function' && typeof plant.observe === 'function');
    // Ground-field reference is an initial PHYSICAL state, not a universal
    // indicated-altitude zero. The field value must come from selected airport
    // or a live aircraft-location input, never a guessed geographic position.
    let groundFieldElevationFt = Number.isFinite(options.fieldElevationFt)
      ? options.fieldElevationFt : null;
    function makeInitialState() {
      let fresh=engine.initial();
      if (groundFieldElevationFt===null) return fresh;
      for (const [key,value] of [
        ['airplaneAltitudeFt',groundFieldElevationFt],
        ['cabinAltitudeFt',groundFieldElevationFt],
        [selected.id==='DCPCS'?'cabinDifferentialPsid':'differentialPsid',0],
        ['cabinRateFtMin',0]
      ]) fresh=engine.apply(fresh,{type:'INPUT',key,value});
      return fresh;
    }
    function makeInitialPlant() {
      return hasPlant ? plant.initial({aircraftAltitudeFt:groundFieldElevationFt??0}) : null;
    }
    let state=makeInitialState(),plantState=makeInitialPlant();
    function read() {
      const logical = engine.derive(state);
      return hasPlant ? {...logical,physical:plant.observe(plantState)} : logical;
    }
    function dispatch(command) {
      state = engine.apply(state, command);
      if (command.type === 'RESET') {
        state=makeInitialState();
        if (hasPlant) plantState=makeInitialPlant();
      }
      return read();
    }
    function stepPhysics(ms, environment = {}) {
      if (!hasPlant) throw Error('Pressure plant dependency not supplied');
      const logical = engine.derive(state), sensor = state.input || state.inputs;
      const aircraftAltitudeFt = environment.aircraftAltitudeFt ?? sensor.airplaneAltitudeFt;
      const onGround = environment.onGround ?? sensor.onGround;
      const plantInput = {
        ms, aircraftAltitudeFt, onGround,
        packsAvailable: environment.packsAvailable,
        bleedAirAvailable: environment.bleedAirAvailable ?? sensor.bleedAirAvailable,
        packMassFlowKgS: environment.packMassFlowKgS,
        outflowCommand: logical.outflowCommand || logical.outflow?.command || 'HOLD',
        mode: logical.operatingMode,
        landingAltitudeFt: state.settings?.landingAltitudeFt ?? sensor.landingAltitudeFt,
        standbyCabinAltitudeFt: state.settings?.standbyCabinAltitudeFt,
        cabinTargetFt: logical.outflow?.cabinTargetFt,
        prepressurized: Boolean(logical.prepressQualified)
      };
      // Compute before mutating the controller, so failure cannot leave a
      // partly-applied input set on a malformed instructor environment.
      const nextPlant = plant.step(plantState,plantInput);
      const measurement = plant.observe(nextPlant);
      const map = selected.id === 'DCPCS' ?
        {cabinAltitudeFt:'cabinAltitudeFt',cabinRateFtMin:'cabinRateFtMin',differentialPsid:'cabinDifferentialPsid'} :
        {cabinAltitudeFt:'cabinAltitudeFt',cabinRateFtMin:'cabinRateFtMin',differentialPsid:'differentialPsid'};
      let nextState = engine.apply(state,{type:'ADVANCE',ms});
      for (const [key,sensorKey] of Object.entries(map)) {
        nextState = engine.apply(nextState,{type:'INPUT',key:sensorKey,value:measurement[key]});
      }
      if (onGround !== sensor.onGround) nextState=engine.apply(nextState,{type:'INPUT',key:'onGround',value:onGround});
      if (aircraftAltitudeFt !== sensor.airplaneAltitudeFt) nextState=engine.apply(nextState,{type:'INPUT',key:'airplaneAltitudeFt',value:aircraftAltitudeFt});
      plantState=nextPlant;state=nextState;
      return read();
    }
    return Object.freeze({
      system: selected.id,engineVersion: selected.version,
      read, snapshot: () => JSON.parse(JSON.stringify(state)),
      physical: () => hasPlant ? plant.observe(plantState) : null,
      dispatch, stepPhysics,
      reset() { state=makeInitialState();if (hasPlant) plantState=makeInitialPlant();return read(); },
      rebaseGround(fieldElevationFt) {
        // Explicit trainer location change is a cold/dark INITIALIZATION,
        // not an in-flight teleport of a sealed or pressurized cabin.
        if (!Number.isFinite(fieldElevationFt)||fieldElevationFt< -2000||fieldElevationFt>14000)
          throw Error('Invalid field elevation in feet');
        const i=state.input||state.inputs;
        if (!i.onGround) throw Error('Cannot reset ground baseline in flight');
        if (hasPlant&&Math.abs(plant.observe(plantState).differentialPsid)>0.05)
          throw Error('Cannot reset a pressurized cabin to the outside field elevation');
        groundFieldElevationFt=fieldElevationFt;
        state=makeInitialState();
        if (hasPlant) plantState=makeInitialPlant();
        return read();
      },
      groundReference:()=>({fieldElevationFt:groundFieldElevationFt,
        known:groundFieldElevationFt!==null})
    });
  }

  return Object.freeze({SCHEMA, STORAGE_KEY, CATALOG, DEFAULTS, FIELDS, validate, normalize, resolve, createStore, createPressurizationSession});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/config/cdu-ident-installation-v1.js?v=FAMILY-IDENT-400-22K-0001 */
try{
/* Shared Unified Settings -> dual CDU IDENT installation mapping.
 * This is an explicitly selected TRAINER configuration; it does not certify
 * S/N 29340's real engine installation, FMC software, or AFM performance.
 */
(function(root,factory){'use strict';const a=factory();
 if(typeof module==='object'&&module.exports)module.exports=a;
 if(root)root.B737CDUIdentInstallationV1=a;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='CDU-ENGINE-IDENT-0001';
 const RATINGS=Object.freeze({
  'CFM56-3B1':Object.freeze({label:'CFM56-3 B1',rating:'18.5K',ratingLbf:18500}),
  'CFM56-3B3':Object.freeze({label:'CFM56-3 B3',rating:'20K',ratingLbf:20000}),
  'CFM56-3B2':Object.freeze({label:'CFM56-3 B2',rating:'22K',ratingLbf:22000}),
  'CFM56-3C1':Object.freeze({label:'CFM56-3 C1',rating:'23.5K',ratingLbf:23500})
 });
 const MODELS=Object.freeze(['737-300','737-400','737-500']);
 const family=model=>model==='737-400'?'B737-400':'B737-300-500';
 const assignedEngine=model=>model==='737-400'?'CFM56-3B2':'CFM56-3B3';
 function select(profile){
  const model=profile?.aircraftModel,variant=profile?.engineVariant;
  if(!MODELS.includes(model)||!Object.hasOwn(RATINGS,variant))
   throw Error('INVALID_TRAINER_INSTALLATION');
  if(profile.aircraftFamily&&profile.aircraftFamily!==family(model))
   throw Error('INCONSISTENT_AIRCRAFT_MODEL_AND_FAMILY');
  if(variant!==assignedEngine(model))throw Error('ENGINE_RATING_MUST_FOLLOW_AIRCRAFT_FAMILY');
  const engine=RATINGS[variant];
  return Object.freeze({version:VERSION,aircraftModel:model,aircraftFamily:family(model),registration:({'737-300':'EP/FSI','737-400':'EP/AOA','737-500':'EP/FSQ'})[model],
   engineVariant:variant,engineLabel:engine.label,engineRating:engine.rating,
   ratingLbf:engine.ratingLbf,provenance:'FAMILY_DERIVED_TRAINER_CONFIGURATION',
   MODEL:Object.freeze({quality:'VALID',origin:'SELECTED_TRAINER_AIRCRAFT_MODEL',value:model}),
   ENG_RATING:Object.freeze({quality:'VALID',origin:'SELECTED_TRAINER_ENGINE_RATING',value:engine.rating})
  });
 }
 function verify(value){
  try{
   if(!value||value.version!==VERSION||
      value.provenance!=='FAMILY_DERIVED_TRAINER_CONFIGURATION')return false;
   const expected=select(value);
   return ['aircraftModel','aircraftFamily','registration','engineVariant','engineLabel','engineRating','ratingLbf'].every(k=>value[k]===expected[k])&&
      ['MODEL','ENG_RATING'].every(k=>['quality','origin','value'].every(f=>value[k]?.[f]===expected[k][f]));
  }catch{return false;}
 }
 return Object.freeze({VERSION,RATINGS,MODELS,select,verify});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/ch11/cdu-airac-banks-v1.js?v=CDU-AIRAC-BANKS-0001 */
try{
/* Training-only FMC IDENT navigation database banks.
 * Calendar validity != NAVDB installation. An expired private 2610 source
 * remains archived, NEVER silently copied or relabeled as 2611.
 * No navigation, active legs, LNAV/VNAV or aircraft guidance is authorized.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737CDUAiracBanksV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='CDU-AIRAC-BANKS-0001';
 const CALENDAR=Object.freeze({
  '2610':Object.freeze({cycle:'2610',start:'2026-10-01',endExclusive:'2026-10-29',lastValid:'2026-10-28'}),
  '2611':Object.freeze({cycle:'2611',start:'2026-10-29',endExclusive:'2026-11-26',lastValid:'2026-11-25'}),
  '2612':Object.freeze({cycle:'2612',start:'2026-11-26',endExclusive:'2026-12-24',lastValid:'2026-12-23'})
 });
 const PRIVATE2610=Object.freeze({cycle:'2610',revision:1,sourceId:'PMDG_WORLD_2610_WITH_PROCEDURES_R1',
  marker:'//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1',
  status:'PRIVATE_SOURCE_REFERENCE_ONLY',fmcInstalled:false,fmcExecutable:false,
  privateLicense:true,redistributable:false});
 const EXPECTED2611=Object.freeze({cycle:'2611',status:'SOURCE_ARCHIVE_NOT_AVAILABLE',
  imported:false,fmcInstalled:false,fmcExecutable:false,airacCalendarKnown:true});
 function date(iso){
  if(typeof iso!=='string'||!/^\d{4}-\d\d-\d\d$/.test(iso))throw Error('ISO_UTC_DAY_REQUIRED');
  const t=Date.parse(iso+'T00:00:00Z');
  if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==iso)throw Error('INVALID_UTC_DAY');
  return iso;
 }
 function current(asOfIso){
  const day=date(asOfIso);
  const record=Object.values(CALENDAR).find(v=>v.start<=day&&day<v.endExclusive);
  return record?{...record}:null;
 }
 function archive(){
  return Object.freeze({old:{...PRIVATE2610},requested:{...EXPECTED2611},
   sourceScope:'AIRAC_EFFECTIVITY_METADATA_ONLY',privateDataPublished:false});
 }
 const noBank=()=>null;
 function validateBank(record){
  if(!record||typeof record!=='object'||Array.isArray(record))throw Error('NAVBANK_RECORD_REQUIRED');
  const reference=CALENDAR[record.cycle];
  if(!reference)throw Error('UNSUPPORTED_AIRAC_CYCLE');
  if(record.schema!=='B737_PRIVATE_NAVDATA_VALIDATED_V1')throw Error('UNVERIFIED_NAVDATA_SCHEMA');
  if(record.importStatus!=='COMPLETE'||record.integrityCheck!=='PASS'||
     record.procedureCoverage!=='VALIDATED'||record.fmcInstalled!==true||
     record.fmcExecutable!==true||record.approvedForTraining!==true)
   throw Error('FMC_NAVDATA_NOT_VERIFIED_OR_NOT_INSTALLED');
  if(typeof record.sourceSha256!=='string'||!/^[a-f0-9]{64}$/i.test(record.sourceSha256))
   throw Error('NAVDATA_SHA256_REQUIRED');
  if(record.start!==reference.start||record.endExclusive!==reference.endExclusive)
   throw Error('NAVDATA_DATE_MISMATCH');
  if(!Number.isInteger(record.airportCount)||record.airportCount<=0||
     !Number.isInteger(record.waypointCount)||record.waypointCount<=0||
     !Number.isInteger(record.procedureCount)||record.procedureCount<=0)
   throw Error('NAVDATA_CONTENT_COUNTS_REQUIRED');
  if(typeof record.signedBy!=='string'||!record.signedBy.trim())
   throw Error('NAVDATA_VERIFICATION_SIGNOFF_REQUIRED');
  return Object.freeze({...record});
 }
 function install(readout,asOfIso){
  // A preflight projection never changes the real engine or switches banks.
  const now=current(asOfIso);
  const banks={ACTIVE:noBank(),INACTIVE:noBank()},failures=[];
  for(const name of ['ACTIVE','INACTIVE']){
   if(!readout?.[name])continue;
   try{banks[name]=validateBank(readout[name]);}
   catch(e){failures.push({slot:name,reason:e.message});}
  }
  if(banks.ACTIVE&&banks.INACTIVE&&banks.ACTIVE.cycle===banks.INACTIVE.cycle){
   failures.push({slot:'INACTIVE',reason:'DUPLICATE_NAVDATA_IN_BOTH_BANKS'});
   banks.INACTIVE=null;
  }
  return Object.freeze({version:VERSION,effectiveCalendarCycle:now?.cycle||null,
   effectiveCalendar:now,ACTIVE:banks.ACTIVE,INACTIVE:banks.INACTIVE,
   sourcesImported:['ACTIVE','INACTIVE'].filter(k=>!!banks[k]),
   failures,activeStatus:banks.ACTIVE?'INSTALLED_BANK':'NO_VERIFIED_ACTIVE_BANK',
   calendarIsNotFmcInstall:true});
 }
 function fcomIdent(readout,asOfIso){
  const resolved=install(readout,asOfIso);
  const stamp=iso=>{const mo=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];return iso.slice(8,10)+mo[Number(iso.slice(5,7))-1];};
  const signed=slot=>resolved[slot]?{
   quality:'VALID',origin:'VERIFIED_NAV_DATABASE',
   value:stamp(resolved[slot].start)+'-'+stamp(CALENDAR[resolved[slot].cycle].lastValid),
   airac:resolved[slot].cycle,
   dateStart:resolved[slot].start,dateEndExclusive:resolved[slot].endExclusive,
   sourceSha256:resolved[slot].sourceSha256,bank:slot
  }:null;
  return Object.freeze({schema:VERSION,calendarIsNotFmcInstall:true,currentCalendarCycle:resolved.effectiveCalendarCycle,
   ACTIVE:signed('ACTIVE'),INACTIVE:signed('INACTIVE'),
   NAV_DATA:resolved.ACTIVE?{
    quality:'VALID',origin:'VERIFIED_NAV_DATABASE',value:'AIRAC'+resolved.ACTIVE.cycle,
    sourceSha256:resolved.ACTIVE.sourceSha256
   }:null,
   currentCycleInstalled:!!(resolved.ACTIVE&&resolved.ACTIVE.cycle===resolved.effectiveCalendarCycle),
   importRequired:!resolved.ACTIVE,errors:resolved.failures});
 }
 return Object.freeze({VERSION,CALENDAR,PRIVATE2610,EXPECTED2611,current,archive,validateBank,
  install,fcomIdent});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/config/ground-airfield-elevation-v1.js?v=FIELD-0001 */
try{
/* B737 Classic trainer: initial on-ground airport reference. User-supplied
 * scenario elevations in feet; not a replacement for a navigation database.
 * Aircraft GNSS/airport source data may override these presets explicitly. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737GroundAirfieldElevationV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const AIRFIELDS=Object.freeze({
   OIAW:Object.freeze({icao:'OIAW',name:'Ahwaz',elevationFt:66,origin:'USER_SCENARIO_VALUE'}),
   OIII:Object.freeze({icao:'OIII',name:'Mehrabad',elevationFt:3963,origin:'USER_SCENARIO_VALUE'}),
   OIMM:Object.freeze({icao:'OIMM',name:'Mashhad',elevationFt:3260,origin:'USER_SCENARIO_VALUE'})
 });
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function altitude(ft){
   if(!finite(ft)||ft< -2000||ft>14000)throw Error('Ground elevation must be finite feet in [-2000,14000]');
   return ft;
 }
 function resolve(icao,overrideFt){
   const code=typeof icao==='string'?icao.trim().toUpperCase():'';
   if(code&& !/^[A-Z0-9]{4}$/.test(code))throw Error('Airport ICAO must be four alphanumerics');
   if(overrideFt!==undefined&&overrideFt!==null){
     altitude(overrideFt);
     return Object.freeze({icao:code||null,fieldElevationFt:overrideFt,
       source:'EXPLICIT_FIELD_ELEVATION_FT',groundReferenceKnown:true});
   }
   const preset=AIRFIELDS[code];
   if(preset)return Object.freeze({icao:code,fieldElevationFt:preset.elevationFt,
     source:preset.origin,groundReferenceKnown:true});
   return Object.freeze({icao:code||null,fieldElevationFt:null,
     source:'AIRPORT_ELEVATION_NOT_PROVIDED',groundReferenceKnown:false});
 }
 function cabinBaseline(selection,{onGround=true,cabinEqualized=true}={}){
   if(!selection||!selection.groundReferenceKnown||!onGround||!cabinEqualized)
     return Object.freeze({status:'requires_pressure_sensor',cabinAltitudeFt:null,differentialPsid:null});
   return Object.freeze({status:'ground_equalized',
     cabinAltitudeFt:selection.fieldElevationFt,differentialPsid:0,
     cabinRateFtMin:0,unit:'ft',source:selection.source});
 }
 return Object.freeze({AIRFIELDS,resolve,cabinBaseline,altitude});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/cpcs-v5.js?cb=CB-UNIFIED-0001 */
try{
/* B737 Classic CPCS training module v5 (NOT DCPCS / EP-FSI installation).
 * Source-indexed FCOM 2.10.11-13, 2.40.1-2, .3, .5-.8, .10.
 * No undocumented relay/wiring, cabin physics or valve motion timings.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737CPCSV5=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const SOURCE={configuration:'FCOM 2.40.1 / DB page 1014 (CPCS listed for FSA, FSB, FSF, FSK, FSG, FST, FSE; FSI uses DCPCS)',control:'FCOM 2.10.11-13 / DB pages 992-994',sensors:'FCOM 2.40.1-3 / DB pages 1014-1016',automatic:'FCOM 2.40.6-8 / DB pages 1019-1021',standby:'FCOM 2.40.10 / DB page 1023',outflow:'FCOM 2.40.5 / DB page 1018',cabinHorn:'FCOM 2.10.11 / DB page 992'};
 const FAULTS=Object.freeze(['autoControllerFailed','standbyControllerFailed','autoAcPowerFailed','manualAcMotorFailed','dcMotorFailed','valveMechanismFailed','airGroundSensorInvalid','cabinSenseInvalid']);
 const INPUT_TYPES=Object.freeze({onGround:'boolean',acPowerAvailable:'boolean',dcPowerAvailable:'boolean',airplaneAltitudeFt:'number',cabinAltitudeFt:'number',cabinRateFtMin:'number',differentialPsid:'number',baroCaptainInHg:'number',baroFirstOfficerInHg:'number',recircFanOn:'boolean',mainOutflowNearlyClosed:'boolean',ambientPressureExceedsCabin:'boolean',bleedAirAvailable:'boolean',stallManagementSignalPresent:'boolean',offScheduleDescent:'boolean'});
 const LIMITS=Object.freeze({autoFailRateFtMin:1890,autoFailCabinAltitudeFt:13875,reliefPsid:8.65,flowValvePsid:2.5,standbyRatesFtMin:{DECR:50,INDEX:300,INCR:2000},groundFlightPressurizationOffsetFt:-200});
 const deepcopy=x=>JSON.parse(JSON.stringify(x));const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);const validNumber=x=>typeof x==='number'&&Number.isFinite(x);
 function initial(){return {schema:'b737-cpcs/5',seq:0,clockMs:0,selectedMode:'AUTO',flightGround:'GRD',valveSwitch:'NEUTRAL',cabinRate:'INDEX',autoFailTriggered:false,autoCbLossSinceMs:null,events:[],faults:Object.fromEntries(FAULTS.map(x=>[x,false])),settings:{flightAltitudeFt:28000,landingAltitudeFt:0,standbyCabinAltitudeFt:0},inputs:{onGround:true,acPowerAvailable:true,dcPowerAvailable:true,airplaneAltitudeFt:0,cabinAltitudeFt:0,cabinRateFtMin:0,differentialPsid:0,baroCaptainInHg:29.92,baroFirstOfficerInHg:29.92,recircFanOn:false,mainOutflowNearlyClosed:false,ambientPressureExceedsCabin:false,bleedAirAvailable:true,stallManagementSignalPresent:true,offScheduleDescent:false}};}
 function validate(s){if(!s||s.schema!=='b737-cpcs/5'||!s.settings||!s.inputs||!s.faults||!Array.isArray(s.events))throw Error('Invalid CPCS state')}
 function faultsAndSignals(s){const i=s.inputs,f=s.faults;const cb=globalThis.B737UnifiedCB;const autoPower=cb?.available('press.autoAC')!==false&&cb?.available('press.autoDC')!==false;const cbLossConfirmed=!autoPower&&s.autoCbLossSinceMs!==null&&s.clockMs-s.autoCbLossSinceMs>=1000;const causes={autoAcPowerLoss:!i.acPowerAvailable||f.autoAcPowerFailed||cbLossConfirmed,excessiveCabinRate:Math.abs(i.cabinRateFtMin)>LIMITS.autoFailRateFtMin,highCabinAltitude:i.cabinAltitudeFt>LIMITS.autoFailCabinAltitudeFt,autoControllerFailed:f.autoControllerFailed};return {causes,anyAutoFailure:Object.values(causes).some(Boolean)};}
 function apply(state,command){validate(state);if(!command||typeof command.type!=='string')throw Error('Invalid CPCS command');if(command.type==='RESET')return initial();const s=deepcopy(state);switch(command.type){
 case 'MODE':if(!['AUTO','STBY','MAN_AC','MAN_DC'].includes(command.value))throw Error('Invalid CPCS selector mode');s.selectedMode=command.value;if(command.value==='STBY')s.autoFailTriggered=false;break;
 case 'AUTO_CHECK':if(command.pressed!==true)throw Error('CHECK is a momentary test request');if(s.selectedMode!=='AUTO')throw Error('AUTO CHECK only modeled with selector in AUTO');s.events.push({seq:s.seq+1,atMs:s.clockMs,command:{type:'AUTO_CHECK',pressed:true},policy:'CHECK_FUNCTION_NOT_SOURCE_SPECIFIED'});s.seq++;return s;
 case 'FLIGHT_GROUND':if(!['FLT','GRD'].includes(command.value))throw Error('Invalid FLT/GRD setting');s.flightGround=command.value;break;
 case 'VALVE_SWITCH':if(!['OPEN','CLOSE','NEUTRAL'].includes(command.value))throw Error('Invalid outflow switch');s.valveSwitch=command.value;break;
 case 'CABIN_RATE':if(!['DECR','INDEX','INCR'].includes(command.value))throw Error('Invalid cabin rate');s.cabinRate=command.value;break;
 case 'ALTITUDE':if(!['flightAltitudeFt','landingAltitudeFt','standbyCabinAltitudeFt'].includes(command.key)||!validNumber(command.value))throw Error('Invalid altitude setting');s.settings[command.key]=command.value;break;
 case 'INPUT':if(!own(INPUT_TYPES,command.key)||typeof command.value!==INPUT_TYPES[command.key]||(INPUT_TYPES[command.key]==='number'&&!validNumber(command.value)))throw Error('Invalid sourced sensor');s.inputs[command.key]=command.value;break;
 case 'FAULT':if(!FAULTS.includes(command.id)||typeof command.active!=='boolean'||command.instructor!==true)throw Error('Instructor-only CPCS fault');s.faults[command.id]=command.active;break;
 case 'ADVANCE':if(!Number.isInteger(command.ms)||command.ms<0||command.ms>600000)throw Error('Invalid elapsed time');s.clockMs+=command.ms;break;
 default:throw Error('Unknown CPCS command '+command.type);
 }
 // Wait out short CB initialization gaps before recording a real AUTO FAIL.
 const cb=globalThis.B737UnifiedCB;
 const cbLoss=cb?.available('press.autoAC')===false||cb?.available('press.autoDC')===false;
 if(cbLoss&&s.autoCbLossSinceMs===null)s.autoCbLossSinceMs=s.clockMs;
 else if(!cbLoss)s.autoCbLossSinceMs=null;
 const ff=faultsAndSignals(s);
 if(s.selectedMode==='AUTO'&&ff.anyAutoFailure)s.autoFailTriggered=true;
 s.seq++;s.events.push({seq:s.seq,atMs:s.clockMs,command:deepcopy(command)});if(s.events.length>400)s.events.shift();return s;
 }
 function derive(s){validate(s);const i=s.inputs,f=s.faults,ff=faultsAndSignals(s);const manuallySelected=s.selectedMode.startsWith('MAN_');
 const autoTrip=s.selectedMode==='AUTO'&&(s.autoFailTriggered||ff.anyAutoFailure);
 const operatingMode=manuallySelected?s.selectedMode:s.selectedMode==='STBY'||autoTrip?'STBY':'AUTO';
 const drive=operatingMode==='AUTO'?'AC':operatingMode==='STBY'?'DC':operatingMode==='MAN_AC'?'AC':'DC';
 const voltage=drive==='AC'?i.acPowerAvailable && (operatingMode==='AUTO'?!f.autoAcPowerFailed:!f.manualAcMotorFailed):i.dcPowerAvailable&&!f.dcMotorFailed;
 const controllerWorking=operatingMode==='AUTO'?!f.autoControllerFailed:operatingMode==='STBY'?!f.standbyControllerFailed:true;
 const required=operatingMode==='AUTO'?['autoAC','autoDC']:operatingMode==='STBY'?['standbyDC']:operatingMode==='MAN_AC'?['manualAC']:['manualDC'];
 const circuitAvailable=required.every(name=>globalThis.B737UnifiedCB?.available('press.'+name)!==false);
 const actuationAvailable=voltage&&controllerWorking&&!f.valveMechanismFailed&&circuitAvailable;
 const flightEffective=s.flightGround==='GRD'&&!i.onGround?'FLT':s.flightGround;
 let outflowCommand='HOLD_OR_UNDETERMINED';
 if(!actuationAvailable)outflowCommand='NO_ACTUATION_AVAILABLE';
 else if(manuallySelected)outflowCommand=s.valveSwitch;
 else if(flightEffective==='GRD')outflowCommand='DRIVE_FULL_OPEN';
 else if(i.onGround&&operatingMode==='STBY')outflowCommand='RATE_CONTROL_TO_SELECTED_CABIN_ALT';
 else if(i.onGround)outflowCommand='MODULATE_TOWARD_CLOSE_GROUND_PREPRESS';
 else if(operatingMode==='STBY')outflowCommand='RATE_CONTROL_TO_SELECTED_CABIN_ALT';
 else outflowCommand='AUTO_PRESSURE_SCHEDULE_NOT_NUMERICALLY_MODELED';
 const cabinTarget=operatingMode==='STBY'?s.settings.standbyCabinAltitudeFt:i.onGround&&flightEffective==='FLT'?i.airplaneAltitudeFt+LIMITS.groundFlightPressurizationOffsetFt:null;
 // AC-powered valve position indication is a *display*, not a physical position model.
 const valveIndicator=i.acPowerAvailable?'UNKNOWN_ACTUAL_POSITION':'FULL_LEFT_NO_AC';
 const fwdValveCloses=i.mainOutflowNearlyClosed||i.recircFanOn;
 const flowValveExhaust=i.onGround||i.differentialPsid<LIMITS.flowValvePsid;
 return {schema:'b737-cpcs-output/5',clockMs:s.clockMs,selectedMode:s.selectedMode,operatingMode,flightGroundRequested:s.flightGround,flightGroundEffective:flightEffective,standbyRateSelected:s.cabinRate,standbyRateTargetFtMin:LIMITS.standbyRatesFtMin[s.cabinRate],controller:{autoHealthy:!f.autoControllerFailed,standbyHealthy:!f.standbyControllerFailed,autoFailure:ff.causes,autoTrip,activeController:manuallySelected?'PILOT_MANUAL':operatingMode==='AUTO'?'AUTO_CONTROLLER':'STANDBY_CONTROLLER'},outflow:{drive,actuationAvailable,command:outflowCommand,manualSwitch:s.valveSwitch,display:valveIndicator,measuredPosition:'UNKNOWN',cabinTargetFt:cabinTarget},lamps:{autoFail:autoTrip,standby:operatingMode==='STBY',manual:manuallySelected,offSchedDescent:i.offScheduleDescent},relief:{positiveReliefAtLimit:i.differentialPsid>=LIMITS.reliefPsid,limitPsid:LIMITS.reliefPsid,negativeReliefRequired:i.ambientPressureExceedsCabin},airflow:{bleedAirAvailable:i.bleedAirAvailable,forwardValveClosedRequested:fwdValveCloses,flowValveExhaustRequested:flowValveExhaust},inputContract:{autoStaticPorts:'SOURCE_DESCRIBED_NOT_NUMERICALLY_INTERPRETED',standbyADC:'MIXED_CPCS_DCPCS_SECTION_NEEDS_VARIANT_QA',baroAuto:i.baroCaptainInHg,baroStby:i.baroFirstOfficerInHg,cabinSenseValid:!f.cabinSenseInvalid,airGroundSensorValid:!f.airGroundSensorInvalid,stallManagementComputerFunctionalSignal:i.stallManagementSignalPresent,stallManagementSignalPayload:'SOURCE_UNSPECIFIED'},cabAltitudeWarningSensorFt:i.cabinAltitudeFt,qa:{configuration:'CPCS_NOT_INSTALLED_ON_EP_FSI_FSI_DCPCS',physicalPressure:'NOT_CALCULATED',motorSpeed:'NOT_SOURCE_QUANTIFIED',valvePosition:'NOT_CALCULATED',faults:'INSTRUCTOR_TRAINING_FAULTS_NOT_HARDWARE_FAILURE_EFFECTS',autoCheck:'TEST_DETAILS_NOT_SOURCE_VERIFIED',source:SOURCE}};
 }
 function replay(commands){let s=initial();for(const cmd of commands)s=apply(s,cmd);return s;}
 return Object.freeze({SOURCE,FAULTS,INPUT_TYPES,LIMITS,initial,apply,derive,replay});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/dcpcs-v4.js?cb=CB-UNIFIED-0001 */
try{
/* B737 Classic DCPCS systems/procedure trainer v4 — source-linked discrete logic.
 * Private DB: FCOM Sepehran 2.10.14-16 (pages 995-997), 2.40.1-11
 * (pages 1014-1024) and 15.20 Cabin Altitude warning.
 * DOES NOT simulate actual cabin pressure dynamics, physical valve rates or wiring.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737DCPCSV4=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const SOURCES=Object.freeze({indicators:'FCOM 2.10.14-16 / DB 995-997',controllers:'FCOM 2.40.1-2,7,9 / DB 1014-1015,1020,1022',manual:'FCOM 2.40.11 / DB 1024',relief:'FCOM 2.40.1 / DB 1014',horn:'FCOM 15.20 / source-indexed WarningEngine'});
 const FAULTS=Object.freeze(['controller1Fault','controller2Fault','outflowControlFault','pressureSensorInvalid','altitudeSensorInvalid','rateSensorInvalid']);
 const INPUT_TYPES=Object.freeze({onGround:'boolean',taxiIn:'boolean',dcPowerAvailable:'boolean',engineN1Pct:'number',engineN2Pct:'number',cabinAltitudeFt:'number',cabinRateFtMin:'number',cabinDifferentialPsid:'number',airplaneAltitudeFt:'number',flightAltitudeFt:'number',landingAltitudeFt:'number',controllerNotResponding:'boolean',descentBeforeCruise:'boolean'});
 const LIMITS=Object.freeze({prepressN1GreaterThan:60,prepressN2GreaterThan:89,prepressHoldMs:1500,taxiOpenN1LessThan:50,autoFailDiffGreaterThan:8.30,autoFailRateAbsGreaterThan:2000,autoFailCabinAltitudeGreaterThan:15800,mechanicalReliefPsid:8.65,maxSelectedFlightAltitudeFt:37000,cruiseLimitBelowEqual28000Psid:7.45,cruiseLimitAbove28000Psid:7.80,manualFullTravelIllustrativeMs:20000});
 const clone=v=>JSON.parse(JSON.stringify(v));
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 function initial(){return {schema:'b737-dcpcs/4',seq:0,clockMs:0,selector:'AUTO',manualCommand:'NEUTRAL',flightNumber:0,primary:1,autoFailLatched:false,acknowledged:false,prepressQualifiedSince:null,manualValveFraction:1,events:[],faults:Object.fromEntries(FAULTS.map(f=>[f,false])),input:{onGround:true,taxiIn:false,dcPowerAvailable:true,engineN1Pct:25,engineN2Pct:70,cabinAltitudeFt:0,cabinRateFtMin:0,cabinDifferentialPsid:0,airplaneAltitudeFt:0,flightAltitudeFt:28000,landingAltitudeFt:0,controllerNotResponding:false,descentBeforeCruise:false}};}
 function validateInput(k,v){if(!(k in INPUT_TYPES))throw Error('Unknown DCPCS input '+k);if(INPUT_TYPES[k]==='boolean'&&typeof v!=='boolean')throw Error('Expected Boolean for '+k);if(INPUT_TYPES[k]==='number'&&!finite(v))throw Error('Expected finite number for '+k);if((k==='flightAltitudeFt'&&(v < -1000||v>37000||v%500!==0))||(k==='landingAltitudeFt'&&(v < -1000||v>14000||v%50!==0)))throw Error('FCOM selector range/increment not met');}
 function apply(state,cmd){if(!state||state.schema!=='b737-dcpcs/4'||!cmd||typeof cmd.type!=='string')throw Error('Invalid DCPCS state/command');if(cmd.type==='RESET')return initial();const s=clone(state),i=s.input;
  switch(cmd.type){
   case 'INPUT':validateInput(cmd.key,cmd.value);i[cmd.key]=cmd.value;break;
   case 'MODE':if(!['AUTO','ALTN','MAN'].includes(cmd.value))throw Error('Invalid DCPCS mode');s.selector=cmd.value;if(cmd.value==='ALTN'&&s.autoFailLatched)s.acknowledged=true;if(cmd.value==='AUTO')s.acknowledged=false;break;
   case 'MANUAL_SWITCH':if(!['OPEN','CLOSE','NEUTRAL'].includes(cmd.value))throw Error('Invalid manual valve switch');s.manualCommand=cmd.value;break;
   case 'FAULT':if(!FAULTS.includes(cmd.id)||typeof cmd.active!=='boolean'||cmd.instructor!==true)throw Error('Instructor-only fault expected');s.faults[cmd.id]=cmd.active;break;
   case 'NEW_FLIGHT':s.flightNumber++;s.primary=s.primary===1?2:1;s.prepressQualifiedSince=null;s.autoFailLatched=false;s.acknowledged=false;s.selector='AUTO';s.manualCommand='NEUTRAL';break;
   case 'ADVANCE':if(!Number.isInteger(cmd.ms)||cmd.ms<0||cmd.ms>600000)throw Error('Invalid time delta');s.clockMs+=cmd.ms;break;
   default:throw Error('Unsupported DCPCS command '+cmd.type);
  }
  const qualified=i.onGround&&i.engineN1Pct>LIMITS.prepressN1GreaterThan&&i.engineN2Pct>LIMITS.prepressN2GreaterThan;
  if(!qualified)s.prepressQualifiedSince=null;else if(s.prepressQualifiedSince===null)s.prepressQualifiedSince=s.clockMs;
  // Instructor model uses explicit power/health inputs; not an inferred DC bus connection.
  const abnormalities=i.controllerNotResponding&&((!s.faults.pressureSensorInvalid&&i.cabinDifferentialPsid>8.30)||(!s.faults.rateSensorInvalid&&Math.abs(i.cabinRateFtMin)>2000)||(!s.faults.altitudeSensorInvalid&&i.cabinAltitudeFt>15800));
  const activeFault=s.faults['controller'+s.primary+'Fault'];
  if(s.selector!=='MAN'&&(!i.dcPowerAvailable||s.faults.outflowControlFault||abnormalities||activeFault))s.autoFailLatched=true;
  if(s.selector==='MAN'&&s.manualCommand!=='NEUTRAL'&&i.dcPowerAvailable&&globalThis.B737UnifiedCB?.available('press.manual')!==false&&!s.faults.outflowControlFault&&cmd.type==='ADVANCE'){
    // Deliberate trainer approximation: fixed upper-bound full travel, not a measured installed speed.
    const dx=cmd.ms/LIMITS.manualFullTravelIllustrativeMs*(s.manualCommand==='OPEN'?1:-1);
    s.manualValveFraction=Math.max(0,Math.min(1,s.manualValveFraction+dx));
  }
  s.seq++;s.events.push({seq:s.seq,atMs:s.clockMs,command:clone(cmd)});if(s.events.length>500)s.events.shift();return s;
 }
 function derive(s){if(!s||s.schema!=='b737-dcpcs/4')throw Error('Invalid DCPCS state');const i=s.input,f=s.faults,nominal=s.primary,other=nominal===1?2:1;
  const health={1:i.dcPowerAvailable&&globalThis.B737UnifiedCB?.available('press.auto1')!==false&&!f.controller1Fault&&!f.outflowControlFault,2:i.dcPowerAvailable&&globalThis.B737UnifiedCB?.available('press.auto2')!==false&&!f.controller2Fault&&!f.outflowControlFault};
  const thresholdProblem=i.controllerNotResponding&&((!f.pressureSensorInvalid&&i.cabinDifferentialPsid>8.30)||(!f.rateSensorInvalid&&Math.abs(i.cabinRateFtMin)>2000)||(!f.altitudeSensorInvalid&&i.cabinAltitudeFt>15800));
  const currentIsFailed=!health[nominal]||thresholdProblem;
  const autoTransferNeeded=s.autoFailLatched||currentIsFailed;
  const manual=s.selector==='MAN';
  let channel=manual?null:s.selector==='ALTN'?other:autoTransferNeeded?other:nominal;
  const channelHealthy=channel!==null&&health[channel]&&!(thresholdProblem&&channel===nominal);
  if(!channelHealthy)channel=null;
  const operatingMode=manual?'MAN':channel===null?'NO_AUTO_CONTROL':(channel===nominal?'AUTO':'ALTN');
  const autoFail= !manual && (autoTransferNeeded||!health[nominal]||!health[other]) && !(s.selector==='ALTN'&&channel!==null&&s.acknowledged);
  const altn= !manual && channel===other;
  const prepress=i.onGround&&i.engineN1Pct>60&&i.engineN2Pct>89&&s.prepressQualifiedSince!==null&&s.clockMs-s.prepressQualifiedSince>=1500;
  let outflow='UNDETERMINED_NO_PRESSURE_PHYSICS';
  if(manual)outflow=i.dcPowerAvailable&&globalThis.B737UnifiedCB?.available('press.manual')!==false&&!f.outflowControlFault?(s.manualCommand==='NEUTRAL'?'HOLD':s.manualCommand):'NO_DRIVE_AVAILABLE';
  else if(channel===null)outflow='NO_AUTO_COMMAND';
  else if(i.onGround)outflow=prepress?'MODULATE_TOWARD_CLOSED':(i.taxiIn&&i.engineN1Pct<50?'SLOWLY_OPEN_FULL':'DRIVE_FULL_OPEN_LOW_POWER');
  else outflow='AUTO_RATE_CONTROL_NO_NUMERIC_SCHEDULE';
  const detected={powerLoss:!i.dcPowerAvailable,controller1:f.controller1Fault,controller2:f.controller2Fault,outflowControl:f.outflowControlFault,controllerNotResponding:i.controllerNotResponding,
   differentialHigh:i.cabinDifferentialPsid>8.30,rateHigh:Math.abs(i.cabinRateFtMin)>2000,cabinAltitudeHigh:i.cabinAltitudeFt>15800,
   triggerByQualifiedAbnormality:thresholdProblem};
  return {clockMs:s.clockMs,selectedMode:s.selector,operatingMode,primary:nominal,activeController:channel,controllerHealthy:health,
   lamps:{autoFail,altn,manual,offSchedDescent:i.descentBeforeCruise},detected,
   prepressQualified:prepress,outflowCommand:outflow,manualValveFraction:s.manualValveFraction,
   relief:{limitPsid:8.65,aboveMechanicalReliefThreshold:i.cabinDifferentialPsid>8.65,mechanicalNotSoftwareControlled:true},
   maxCruiseDifferentialPsid:i.flightAltitudeFt<=28000?7.45:7.80,
   cabinHornSensorFt:i.cabinAltitudeFt,
   statuses:{pressureDynamics:'NOT_MODELED',manualTravel:'ILLUSTRATIVE_UPPER_BOUND_20S',dcPowerFeed:'EXPLICIT_TRAINER_INPUT_BUS_NOT_VERIFIED',engineSignals:'AGGREGATE_CHANNEL_UNKNOWN',sensorFaultHandling:'SOURCE_UNKNOWN_TRAINER_PROJECTION',dualControllerFailure:'AUTO_FAIL_ALONE_WHEN_NO_ALTN',source:SOURCES}};
 }
 function replay(commands){let s=initial();for(const c of commands)s=apply(s,c);return s;}
 return Object.freeze({SOURCES,FAULTS,INPUT_TYPES,LIMITS,initial,apply,derive,replay});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/cabin-pressure-plant-v1.js?v=PRESS-PLANT-0001 */
try{
/* Educational closed-loop cabin air plant for B737 Classic CPCS / DCPCS.
 * Separate from the FCOM-grounded controller state machines and from OH22 art.
 * First-principles ideal-gas pressure integration, with UNVERIFIED trainer
 * cabin volume, pack mass flow, leakage, outflow area and servo dynamics.
 * NEVER use for real aircraft calculations, QRH decisions or performance.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737CabinPressurePlantV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const P0=101325,RGAS=287.05,TEMP_K=293.15,FT=0.3048,PSI=6894.757293168;
 const PARAMETERS=Object.freeze({cabinVolumeM3:220,packMassFlowKgS:0.62,maxValveAreaM2:0.006,leakAreaM2:0.00008,autoFullStrokeSeconds:24,manualFullStrokeSeconds:20,positiveReliefPsid:8.65,negativeReliefPsid:-0.5,maxCabinScheduleFt:8000,nominalCabinClimbFtMin:450,nominalCabinDescentFtMin:350});
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function pressureAtFt(altFt){if(!finite(altFt))throw Error('Invalid aircraft pressure altitude');return P0*Math.pow(Math.max(0.04,1-altFt*FT/44330.77),5.25588);}
 function altitudeFromPressureFt(p){if(!finite(p)||p<=0)throw Error('Invalid cabin absolute pressure');return 44330.77/FT*(1-Math.pow(p/P0,1/5.25588));}
 function initial(options={}){
  const altitudeFt=finite(options.aircraftAltitudeFt)?options.aircraftAltitudeFt:0;
  return {schema:'b737-cabin-plant/1',timeMs:0,aircraftAltitudeFt:altitudeFt,pressurePa:pressureAtFt(altitudeFt),valveOpenFraction:1,cabinAltitudeFt:altitudeFt,cabinRateFtMin:0,targetCabinAltitudeFt:altitudeFt,packFlowKgS:0,lastMode:'GROUND_OPEN',source:'PROVISIONAL_IDEAL_GAS_TRAINER'};
 }
 function observe(state){
  if(!state||state.schema!=='b737-cabin-plant/1')throw Error('Invalid pressure plant state');
  const ambientPa=pressureAtFt(state.aircraftAltitudeFt);
  return {cabinAltitudeFt:state.cabinAltitudeFt,cabinRateFtMin:state.cabinRateFtMin,differentialPsid:(state.pressurePa-ambientPa)/PSI,
   cabinPressurePa:state.pressurePa,ambientPressurePa:ambientPa,valveOpenFraction:state.valveOpenFraction,
   targetCabinAltitudeFt:state.targetCabinAltitudeFt,packFlowKgS:state.packFlowKgS,
   status:'PROVISIONAL_TRAINING_PHYSICS_NOT_AIRCRAFT_VALIDATED'};
 }
 function targetFt(env,state){
  if(finite(env.cabinTargetFt))return clamp(env.cabinTargetFt,-1000,14000);
  if(env.onGround)return env.prepressurized?env.aircraftAltitudeFt-200:env.aircraftAltitudeFt;
  if(env.mode==='STBY'&&finite(env.standbyCabinAltitudeFt))return clamp(env.standbyCabinAltitudeFt,-1000,14000);
  const dest=finite(env.landingAltitudeFt)?env.landingAltitudeFt:0;
  return clamp(Math.max(dest,env.aircraftAltitudeFt*0.255),-1000,PARAMETERS.maxCabinScheduleFt);
 }
 function step(old,env={}){
  if(!old||old.schema!=='b737-cabin-plant/1')throw Error('Invalid pressure plant state');
  const ms=env.ms;
  if(!Number.isInteger(ms)||ms<0||ms>60000)throw Error('Invalid pressure integration period');
  const altitudeFt=finite(env.aircraftAltitudeFt)?env.aircraftAltitudeFt:old.aircraftAltitudeFt;
  if(!finite(altitudeFt)||altitudeFt< -2000||altitudeFt>60000)throw Error('Aircraft altitude outside trainer envelope');
  const s={...old,aircraftAltitudeFt:altitudeFt};
  if(ms===0)return s;
  const command=String(env.outflowCommand||'HOLD');
  const failed=/NO_AUTO_COMMAND|NO_ACTUATION|UNDETERMINED|HOLD_OR_UNDETERMINED/.test(command);
  const opening=/DRIVE_FULL_OPEN|SLOWLY_OPEN_FULL/.test(command);
  const prepress=/PREPRESS|MODULATE_TOWARD_CLOSE/.test(command);
  const manual=env.mode==='MAN'||env.mode==='MAN_AC'||env.mode==='MAN_DC';
  const hasPacks=env.packsAvailable!==false&&env.bleedAirAvailable!==false;
  const packs=hasPacks?clamp(finite(env.packMassFlowKgS)?env.packMassFlowKgS:PARAMETERS.packMassFlowKgS,0,2):0;
  const target=targetFt({...env,aircraftAltitudeFt:altitudeFt,prepressurized:prepress},s);
  s.targetCabinAltitudeFt=target;s.packFlowKgS=packs;s.lastMode=manual?'MAN':opening?'GROUND_OPEN':failed?'FAILED_HOLD':'AUTO';
  const n=Math.max(1,Math.ceil(ms/250)),dt=ms/n/1000;
  let previousAlt=old.cabinAltitudeFt;
  for(let k=0;k<n;k++){
   const ambient=pressureAtFt(altitudeFt),rho=clamp(s.pressurePa/(RGAS*TEMP_K),0.1,1.5);
   const delta=s.pressurePa-ambient;
   // A reversible opening allows pressure equalization, including descending
   // flight when outside pressure exceeds cabin pressure.
   const flowAtFull=PARAMETERS.maxValveAreaM2*Math.sqrt(2*rho*Math.max(0,delta));
   let demanded=s.valveOpenFraction;
   if(opening)demanded=1;
   else if(manual){
    if(command==='OPEN')demanded=1;
    if(command==='CLOSE')demanded=0;
   }else if(!failed){
    const currentAlt=altitudeFromPressureFt(s.pressurePa);
    const desiredRate=clamp((target-currentAlt)*0.22,-PARAMETERS.nominalCabinDescentFtMin,PARAMETERS.nominalCabinClimbFtMin);
    const pressurePerFt=-s.pressurePa*5.25588*FT/(44330.77*(Math.max(0.04,1-currentAlt*FT/44330.77)));
    const desiredDpdt=pressurePerFt*desiredRate/60;
    const desiredOutflow=packs-desiredDpdt*PARAMETERS.cabinVolumeM3/(RGAS*TEMP_K);
    demanded=flowAtFull>0.015?clamp(desiredOutflow/flowAtFull,0,1):0;
    if(env.onGround&&!prepress)demanded=1;
   }
   const motorRate=dt/(manual?PARAMETERS.manualFullStrokeSeconds:PARAMETERS.autoFullStrokeSeconds);
   s.valveOpenFraction=clamp(s.valveOpenFraction+clamp(demanded-s.valveOpenFraction,-motorRate,motorRate),0,1);
   const area=PARAMETERS.leakAreaM2+PARAMETERS.maxValveAreaM2*s.valveOpenFraction;
   const massRate=area*Math.sqrt(2*rho*Math.abs(delta))*(delta>=0?1:-1);
   const dpdt=(packs-massRate)*(RGAS*TEMP_K)/PARAMETERS.cabinVolumeM3;
   s.pressurePa=Math.max(5000,s.pressurePa+dpdt*dt);
   // Mechanical relief valves work passively, even when DCPCS/CPCS failed.
   s.pressurePa=Math.min(s.pressurePa,ambient+PARAMETERS.positiveReliefPsid*PSI);
   s.pressurePa=Math.max(s.pressurePa,ambient+PARAMETERS.negativeReliefPsid*PSI);
  }
  s.timeMs+=ms;s.cabinAltitudeFt=altitudeFromPressureFt(s.pressurePa);
  s.cabinRateFtMin=(s.cabinAltitudeFt-previousAlt)*60000/ms;
  return s;
 }
 return Object.freeze({PARAMETERS,initial,step,observe,pressureAtFt,altitudeFromPressureFt});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/ch11/fmc-airac-banks-v1.js?v=AIRAC-2611-BANKS-0001 */
try{
/* Boeing 737 Classic FMC NAV DATA bank management (trainer only).
 * AIRAC calendar metadata is NOT a navigation database. Two FMC banks are
 * activated ONLY after a private, parsed, integrity-verified installation.
 * FCOM 11.40.8-9: on-ground date transfer, previous active becomes inactive,
 * route data must be cleared; expired active retained during flight.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FMCAiracBanksV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const SCHEMA='B737_FMC_AIRAC_BANKS_V1',VERSION='AIRAC-2611-BANKS-0001';
 const CALENDAR=Object.freeze({
  '2610':Object.freeze({cycle:'2610',start:'2026-10-01',endExclusive:'2026-10-29',endInclusive:'2026-10-28',sourceStatus:'PRIVATE_2610_REFERENCE_NOT_FMC_ACTIVE'}),
  '2611':Object.freeze({cycle:'2611',start:'2026-10-29',endExclusive:'2026-11-26',endInclusive:'2026-11-25',sourceStatus:'CALENDAR_ONLY_AWAITING_2611_NAVDATA'}),
  '2612':Object.freeze({cycle:'2612',start:'2026-11-26',endExclusive:'2026-12-24',endInclusive:'2026-12-23',sourceStatus:'FUTURE_CALENDAR_ONLY'})
 });
 const date=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')?x:null;
 const copy=v=>JSON.parse(JSON.stringify(v));
 function currentCycle(utcDay){const s=date(utcDay);if(!s)throw Error('AIRAC_UTC_DAY_REQUIRED');
  return Object.values(CALENDAR).find(c=>s>=c.start&&s<c.endExclusive)?.cycle||null;
 }
 function fmt(ymd){const [yy,mm,dd]=ymd.split('-').map(Number);
  return ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][mm-1]+String(dd).padStart(2,'0');
 }
 function dateRange(cycle){const c=CALENDAR[cycle];if(!c)throw Error('UNKNOWN_AIRAC_CYCLE');
  return fmt(c.start)+fmt(c.endInclusive)+'/'+c.endInclusive.slice(2,4);
 }
 function initial(){return {schema:SCHEMA,activeCycle:null,inactiveCycle:null,installed:{},
  lastTransition:null,sourceStatus:'NO_FMC_NAVDATA_INSTALLED'};}
 function validSource(pkg,verifyPackage){
  if(!pkg||!CALENDAR[pkg.cycle]||typeof verifyPackage!=='function')
   throw Error('NAVDATA_PACKAGE_AND_TRUSTED_IMPORT_VALIDATOR_REQUIRED');
  if(pkg.cycle!=='2610'&&pkg.cycle!=='2611')throw Error('CYCLE_NOT_ACCEPTED_FOR_IMPORT');
  if(!/^[0-9a-f]{64}$/i.test(pkg.sourceSha256||''))throw Error('MISSING_SOURCE_SHA256');
  if(!/^[A-Z0-9._-]{4,12}$/.test(pkg.navDataIdentifier||''))throw Error('MISSING_REAL_NAVDATA_IDENTIFIER');
  if(pkg.effectiveStart!==CALENDAR[pkg.cycle].start||
     pkg.effectiveEndExclusive!==CALENDAR[pkg.cycle].endExclusive)
    throw Error('NAVDATA_AIRAC_DATES_MISMATCH');
  if(pkg.proceduresParsed!==true||pkg.legEncodingValidated!==true||
     !Number.isSafeInteger(pkg.records?.airports)||pkg.records.airports<=0||
     !Number.isSafeInteger(pkg.records?.waypoints)||pkg.records.waypoints<=0)
    throw Error('NAVDATA_RECORDS_OR_PROCEDURE_LEGS_UNVALIDATED');
  // Actual SHA-256 and parser trust MUST be validated by the private import
  // pipeline. A string or calendar declaration by itself cannot pass.
  if(verifyPackage(pkg)!==true)throw Error('NAVDATA_PRIVATE_IMPORT_VERIFICATION_FAILED');
  return {cycle:pkg.cycle,sourceSha256:pkg.sourceSha256.toLowerCase(),
   navDataIdentifier:pkg.navDataIdentifier,effectiveStart:pkg.effectiveStart,
   effectiveEndExclusive:pkg.effectiveEndExclusive,records:copy(pkg.records),
   provenance:'PRIVATE_PARSED_AND_VERIFIED_NAVDATA',fmcExecutable:true};
 }
 function install(s,pkg,verifyPackage){
  validate(s);const record=validSource(pkg,verifyPackage),next=copy(s);
  next.installed[record.cycle]=record;next.sourceStatus='BANKS_PRESENT';
  // Adding a bank never silently activates it.
  if(record.cycle!==next.activeCycle&&next.inactiveCycle!==record.cycle)
   next.inactiveCycle=record.cycle;
  return next;
 }
 function activate(s,cycle,{onGround,utcDay}={}){
  validate(s);
  if(onGround!==true)throw Error(onGround===false?'NAVDATA_SWITCH_IN_FLIGHT':'GROUND_STATE_NOT_VERIFIED');
  const d=date(utcDay);if(!d)throw Error('NAVDATA_SWITCH_NEEDS_VALID_UTC_DATE');
  const bank=s.installed[cycle];
  if(!bank||bank.provenance!=='PRIVATE_PARSED_AND_VERIFIED_NAVDATA'||bank.fmcExecutable!==true)
    throw Error('NAVDATA_CYCLE_NOT_INSTALLED_OR_NOT_VERIFIED');
  const next=copy(s);
  if(next.activeCycle===cycle)return {state:next,changed:false,clearRoute:false};
  const previous=next.activeCycle;
  next.activeCycle=cycle;
  next.inactiveCycle=previous||Object.keys(next.installed).find(x=>x!==cycle)||null;
  next.lastTransition={atUtc:d,previousActive:previous,newActive:cycle,
   requiresRouteClear:true,approvedOnGround:true};
  return {state:next,changed:true,clearRoute:true};
 }
 const ROUTE_FIELDS=Object.freeze(['ORIGIN','DEST','CO_ROUTE','FLIGHT','RUNWAY','WPT1','WPT2','OFFSET']);
 const ROUTE_STATE=Object.freeze(['navdbActive','navdbPending','navdbStage',
  'stage5Pending','stage5Committed','stage5AwaitingExec','stage6PendingPlan',
  'stage6Selections','stage6AwaitingExec','stage6BasePlanId','depArrSelection']);
 function switchFmc(fmc,cycle,environment){
  if(!fmc||!fmc.fmcNavDataBanks)throw Error('FMC_NAVDATA_BANKS_REQUIRED');
  const decision=activate(fmc.fmcNavDataBanks,cycle,environment);
  const next=copy(fmc);
  next.fmcNavDataBanks=decision.state;
  if(decision.changed){
   for(const key of ROUTE_FIELDS)if(Object.hasOwn(next.active||{},key))next.active[key]='';
   for(const key of ROUTE_FIELDS)if(Object.hasOwn(next.pending||{},key))delete next.pending[key];
   next.stagedRoute={};
   for(const key of ROUTE_STATE)delete next[key];
   next.message='';next.scratch='';
  }
  return {state:next,changed:decision.changed,clearedRoute:decision.clearRoute};
 }
 function validate(s){
  if(!s||s.schema!==SCHEMA||!s.installed||typeof s.installed!=='object')
   throw Error('INVALID_AIRAC_BANK_STATE');
  for(const x of [s.activeCycle,s.inactiveCycle])if(x!==null&&!s.installed[x])throw Error('NAVDATA_BANK_REFERENCE_NOT_INSTALLED');
  if(s.activeCycle&&s.activeCycle===s.inactiveCycle)throw Error('DUPLICATED_ACTIVE_AND_INACTIVE_NAVDATA');
  return true;
 }
 function ident(s){
  validate(s);
  const active=s.activeCycle?s.installed[s.activeCycle]:null;
  const inactive=s.inactiveCycle?s.installed[s.inactiveCycle]:null;
  return {
   NAV_DATA:active?{quality:'VALID',origin:'VERIFIED_NAV_DATABASE',value:active.navDataIdentifier}:null,
   ACTIVE:active?{quality:'VALID',origin:'VERIFIED_NAV_DATABASE',value:dateRange(active.cycle)}:null,
   INACTIVE:inactive?{quality:'VALID',origin:'VERIFIED_NAV_DATABASE',value:dateRange(inactive.cycle)}:null
  };
 }
 function status(s,utcDay){
  validate(s);
  const cycle=currentCycle(utcDay);
  return {version:VERSION,calendarCurrentCycle:cycle,activeCycle:s.activeCycle,
   inactiveCycle:s.inactiveCycle,installedCycles:Object.keys(s.installed).sort(),
   activeStatus:s.activeCycle?(s.activeCycle===cycle?'ACTIVE_IN_DATE':'ACTIVE_EXPIRED_OR_NONCURRENT'):'NO_FMC_ACTIVE_NAVDB',
   pendingCycle2611:!s.installed['2611'],cycle2611DateRange:dateRange('2611'),
   statusFromMetadataOnly:s.installed['2611']===undefined};
 }
 return Object.freeze({SCHEMA,VERSION,CALENDAR,initial,currentCycle,dateRange,install,activate,switchFmc,validate,ident,status});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
