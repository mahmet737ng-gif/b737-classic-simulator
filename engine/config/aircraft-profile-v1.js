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
  const FIELDS = Object.freeze(['aircraftFamily', 'pressurization', 'engineInstruments']);
  const CATALOG = Object.freeze({
    aircraftFamily: Object.freeze([
      Object.freeze({id: 'B737-300-500', label: '737-300 / 737-500', variants: Object.freeze(['737-300', '737-500'])}),
      Object.freeze({id: 'B737-400', label: '737-400', variants: Object.freeze(['737-400'])})
    ]),
    pressurization: Object.freeze([
      Object.freeze({id: 'DCPCS', label: 'DCPCS', engine: 'B737DCPCSV4', version: 4, lab: 'dcpcs-lab/', backgroundAsset: 'panel-mosaic-lab/assets/locked/2026-10-23/DCPCS_Background_Owner.png'}),
      Object.freeze({id: 'CPCS', label: 'CPCS', engine: 'B737CPCSV5', version: 5, lab: 'cpcs-lab/'})
    ]),
    engineInstruments: Object.freeze([
      Object.freeze({id: 'EIS', label: 'EIS · Electronic Engine Instruments', imageStatus: 'AWAITING_APPROVED_ASSETS'}),
      Object.freeze({id: 'CONVENTIONAL', label: 'Conventional Engine Instruments', imageStatus: 'AWAITING_APPROVED_ASSETS'})
    ])
  });
  // Deliberate simulator defaults, not an EP-FSI installation declaration.
  const DEFAULTS = Object.freeze({schema: SCHEMA, aircraftFamily: 'B737-300-500', pressurization: 'DCPCS', engineInstruments: 'CONVENTIONAL'});
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function validate(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Aircraft profile must be an object');
    if (value.schema !== SCHEMA) throw Error('Unsupported aircraft profile schema');
    for (const key of Object.keys(value)) if (key !== 'schema' && !FIELDS.includes(key)) throw Error('Unknown aircraft profile field: ' + key);
    for (const key of FIELDS) {
      if (!CATALOG[key].some(option => option.id === value[key])) throw Error('Invalid aircraft profile option: ' + key);
    }
    return true;
  }
  function normalize(data) {
    const result = {...DEFAULTS};
    if (data && data.schema === SCHEMA) for (const field of FIELDS) {
      if (CATALOG[field].some(option => option.id === data[field])) result[field] = data[field];
    }
    return result;
  }
  function resolve(input) {
    const profile = normalize(input);
    const byId = key => CATALOG[key].find(option => option.id === profile[key]);
    return {
      profile: {...profile},
      family: byId('aircraftFamily'),
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
  function createPressurizationSession(profile, engines) {
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
    let state = engine.initial(), plantState = hasPlant ? plant.initial() : null;
    function read() {
      const logical = engine.derive(state);
      return hasPlant ? {...logical,physical:plant.observe(plantState)} : logical;
    }
    function dispatch(command) {
      state = engine.apply(state, command);
      if (command.type === 'RESET' && hasPlant) plantState = plant.initial();
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
      reset() { state = engine.initial();if (hasPlant) plantState=plant.initial();return read(); }
    });
  }

  return Object.freeze({SCHEMA, STORAGE_KEY, CATALOG, DEFAULTS, FIELDS, validate, normalize, resolve, createStore, createPressurizationSession});
});
