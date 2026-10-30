/* ISN Pack 01 — Electrical V7 -> Loads V8 -> Fuel/Hyd electric pump states
 * -> source-labeled warning indications. Educational/discrete only.
 * Never converts the trainer's assumed pump-to-transfer-bus map into verified
 * aircraft wiring. Source-gated mode is the default; UNKNOWN stays UNKNOWN.
 */
(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B737ISNElectricalPackV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : null, function() {
  'use strict';
  const SCHEMA = 'b737-isn-electrical-pack/1';
  const MODES = Object.freeze(['SOURCE_GATED', 'TRAINING_SURROGATE']);
  const PUMP_REGISTRY = Object.freeze([
    ['fuel.main1FwdPump', 'leftFwd', 'FUEL', 'MAIN 1 FWD', 'MAIN'],
    ['fuel.main1AftPump', 'leftAft', 'FUEL', 'MAIN 1 AFT', 'MAIN'],
    ['fuel.main2FwdPump', 'rightFwd', 'FUEL', 'MAIN 2 FWD', 'MAIN'],
    ['fuel.main2AftPump', 'rightAft', 'FUEL', 'MAIN 2 AFT', 'MAIN'],
    ['fuel.centerLeftPump', 'centerLeft', 'FUEL', 'CENTER LEFT', 'CENTER'],
    ['fuel.centerRightPump', 'centerRight', 'FUEL', 'CENTER RIGHT', 'CENTER'],
    ['hyd.electricPumpA', 'elecA', 'HYDRAULIC', 'HYD ELEC A', 'ELECTRIC'],
    ['hyd.electricPumpB', 'elecB', 'HYDRAULIC', 'HYD ELEC B', 'ELECTRIC']
  ].map(([id, legacyId, system, label, group]) => Object.freeze({id, legacyId, system, label, group,
    source: 'FCOM-SEPEHRAN-1937', pdfPage: system === 'FUEL' ? 1826 : 1842,
    folio: system === 'FUEL' ? '12.10.2-3' : '13.10.1'})));
  const BY_ID = Object.freeze(Object.fromEntries(PUMP_REGISTRY.map(entry => [entry.id, entry])));
  const copy = value => JSON.parse(JSON.stringify(value));
  const tri = value => value === true || value === false || value === null;
  function tAnd(values) { if (values.includes(false)) return false; if (values.includes(null)) return null; return true; }
  function tOr(values) { if (values.includes(true)) return true; if (values.includes(null)) return null; return false; }
  function pressureWarning(pump, operating) {
    if (pump.group === 'CENTER' && !pump.switchOn) return false;
    if ((pump.group === 'MAIN' || pump.group === 'ELECTRIC') && !pump.switchOn) return true;
    return operating === null ? null : !operating;
  }
  function warningInputs() { return {
    onGround: true, flaps: 5, gearDownLocked: true, leadingEdgeTakeoff: true,
    speedbrakeDown: true, parkingBrakeSet: false, stabilizerTrimTakeoff: true,
    takeoffThrust: false, thrustLever1Angle: 45, thrustLever2Angle: 45,
    cabinAltitudeFt: 0, engine1Fire: false, engine2Fire: false, apuFire: false
  }; }
  const SENSOR_FIELDS = Object.freeze({onGround: 'boolean', cabinAltitudeFt: 'number',
    engine1Fire: 'boolean', engine2Fire: 'boolean', apuFire: 'boolean'});

  class Session {
    constructor({Electrical, Loads, TrainerCore, WarningEngine} = {}) {
      if (!Electrical?.initialState || !Electrical?.apply || !Electrical?.evaluate ||
          !Loads?.project || !TrainerCore?.CONFIG?.loadBus || !TrainerCore?.FUEL || !TrainerCore?.HYD ||
          typeof WarningEngine !== 'function') throw Error('Electrical V7, Loads V8, Trainer Core and WarningEngine required');
      this.Electrical = Electrical;
      this.Loads = Loads;
      this.TrainerCore = TrainerCore;
      this.WarningEngine = WarningEngine;
      this.reset();
    }
    reset() {
      const previousBattery=this.electricalState?.battery;
      this.mode = 'SOURCE_GATED';
      this.electricalState = this.Electrical.initialState();
      // Resetting switches/scenarios must not refill the installed battery.
      if(this.batteryEngine)this.electricalState.battery=previousBattery||this.batteryEngine.initial();
      this.pumps = Object.fromEntries(PUMP_REGISTRY.map(p => [p.id, {switchOn: false, failed: false, overheat: false, observedPower: null}]));
      this.sensors = warningInputs();
      // 737-400 suppresses an unverified takeoff-flap threshold; fire and cabin
      // alerts have separate, source-located behavior in the existing engine.
      this.warningEngine = new this.WarningEngine({variant: '737-400'});
      this.seq = 0;
      this.events = [];
      this.snapshot = this.compute(null);
      return this.get();
    }
    attachBattery(Battery,restored=null) {
      if(!Battery?.initial||!Battery?.step||!Battery?.snapshot)throw Error('Battery dynamics engine required');
      if(this.batteryEngine)return this.getBattery();
      const state=Battery.step(restored||Battery.initial(),0);
      this.batteryEngine=Battery;this.electricalState.battery=state;this.electricalState.rev++;
      this.snapshot=this.compute(null);return this.getBattery();
    }
    advanceBattery(dtSec,inputs) {
      if(!this.batteryEngine)throw Error('Live battery not attached');
      const next=this.batteryEngine.step(this.electricalState.battery,dtSec,inputs);
      this.electricalState={...this.electricalState,battery:next,rev:this.electricalState.rev+1};
      this.snapshot=this.compute(null);return this.getBattery();
    }
    getBattery(){return this.batteryEngine?this.batteryEngine.snapshot(this.electricalState.battery):null;}
    send(command) {
      if (!command || typeof command.type !== 'string') throw Error('ISN command required');
      if (command.type === 'RESET') return this.reset();
      if (command.type === 'ELECTRICAL') {
        this.electricalState = this.Electrical.apply(this.electricalState, command.action);
      } else if (command.type === 'MODE') {
        if (!MODES.includes(command.value) || command.instructor !== true) throw Error('Explicit instructor mode selection required');
        this.mode = command.value;
      } else if (['PUMP_SWITCH', 'PUMP_FAULT', 'PUMP_OVERHEAT', 'OBSERVED_POWER'].includes(command.type)) {
        const pump = this.pumps[command.id];
        if (!pump || !tri(command.value)) throw Error('Unknown pump or invalid three-valued input');
        if (command.type === 'PUMP_SWITCH') {
          if (typeof command.value !== 'boolean') throw Error('Pump switch requires boolean');
          pump.switchOn = command.value;
        } else if (command.type === 'OBSERVED_POWER') {
          if (command.instructor !== true) throw Error('Observed pump power is an instructor/sensor input');
          pump.observedPower = command.value;
        } else {
          if (typeof command.value !== 'boolean' || command.instructor !== true) throw Error('Instructor-only pump failure/overheat');
          if (command.type === 'PUMP_FAULT') pump.failed = command.value;
          else {
            if (!command.id.startsWith('hyd.')) throw Error('Overheat training input is only defined for hydraulic electric pumps');
            pump.overheat = command.value;
          }
        }
      } else if (command.type === 'WARNING_SENSOR') {
        const kind = SENSOR_FIELDS[command.key];
        if (!kind || typeof command.value !== kind || (kind === 'number' && !Number.isFinite(command.value))) throw Error('Unrecognized warning sensor');
        this.sensors[command.key] = command.value;
      } else if (command.type === 'CUTOUT_CABIN') {
        this.warningEngine.cutoutCabin();
      } else if (command.type === 'ACK_FIRE') {
        this.warningEngine.acknowledgeFire();
      } else throw Error('Unknown ISN command ' + command.type);

      this.seq++;
      const previous = this.snapshot;
      this.snapshot = this.compute(command);
      const changes = this.diff(previous, this.snapshot);
      this.events.push({seq: this.seq, command: copy(command), changes});
      if (this.events.length > 250) this.events.shift();
      return this.get();
    }
    compute(command) {
      const electrical = this.Electrical.evaluate(this.electricalState);
      const loads = this.Loads.project(electrical);
      const pumps = {};
      for (const spec of PUMP_REGISTRY) {
        const input = this.pumps[spec.id];
        const projected = loads.loads[spec.id];
        let power = projected.powered;
        let powerEvidence = projected.powered === false ? 'GLOBAL_CLASS_POWER_ABSENT' : 'UNKNOWN_EQUIPMENT_FEED';
        let sourceBus = null;
        if (this.mode === 'TRAINING_SURROGATE') {
          sourceBus = 'transfer' + this.TrainerCore.CONFIG.loadBus[spec.legacyId];
          power = electrical.bus[sourceBus];
          powerEvidence = 'TRAINING_SURROGATE_UNVERIFIED_BUS_ASSIGNMENT';
        } else if (projected.powered !== false && input.observedPower !== null) {
          // This is independently observed/instructor-provided, NOT a guessed
          // electrical bus mapping. It never mutates the original V8 results.
          power = input.observedPower;
          powerEvidence = 'INDEPENDENT_INSTRUCTOR_SENSOR';
        }
        let operating = !input.switchOn || input.failed || input.overheat ? false : power;
        if (input.switchOn && !input.failed && !input.overheat && power === true) operating = true;
        const lowPressure = pressureWarning({...spec, ...input}, operating);
        pumps[spec.id] = {...spec, ...input, powered: power, operating, lowPressure,
          sourceBus, powerEvidence, powerQuality: this.mode === 'TRAINING_SURROGATE' ? 'EDUCATIONAL_ASSUMPTION' :
            input.observedPower !== null ? 'OBSERVED_NOT_BUS_VERIFIED' : 'UNRESOLVED',
          qa: 'TRAINER_DISCRETE_INDICATION_NOT_MEASURED_PRESSURE'};
      }
      const low = id => pumps[id].lowPressure;
      const main1 = tAnd([low('fuel.main1FwdPump'), low('fuel.main1AftPump')]);
      const main2 = tAnd([low('fuel.main2FwdPump'), low('fuel.main2AftPump')]);
      const center = tOr(['fuel.centerLeftPump', 'fuel.centerRightPump']
        .filter(id => pumps[id].switchOn).map(low));
      const fuelCautionCandidate = tOr([main1, main2, center]);
      const warning = this.warningEngine.update(this.sensors);
      return {schema: SCHEMA, seq: this.seq, mode: this.mode, electrical, loads, pumps,
        warnings: {
          fuelSystemAnnunciatorCandidate: fuelCautionCandidate,
          masterCautionFuelCandidate: fuelCautionCandidate,
          masterCautionHyd: null,
          lowPressureLights: Object.fromEntries(PUMP_REGISTRY.map(p => [p.id, pumps[p.id].lowPressure])),
          audio: {active: warning.active, events: warning.events, lamps: warning.lamps},
          qa: {fuelCaution: 'TRAINER_CORE_CANDIDATE_NOT_SOURCE_APPROVED_MASTER_CAUTION',
            hydraulicMasterCaution: 'NOT_MODELED', fuelHydAuralWarning: 'NOT_DOCUMENTED_NOT_SYNTHESIZED'}
        },
        sensors: {...this.sensors},
        limitations: ['NO_FUEL_HYD_INSTALLED_BUS_MAP', 'UNKNOWN_IS_NOT_FALSE',
          'NO_SYNTHETIC_FUEL_HYD_AURAL_ALARM', 'NO_MEASURED_PRESSURE_OR_FLOW_PHYSICS',
          'TRAINING_SURROGATE_NEVER_PROMOTED_TO_VERIFIED']};
    }
    diff(before, after) {
      if (!before) return [];
      const changes = [];
      const check = (path, oldValue, newValue, evidence) => {
        if (oldValue !== newValue) changes.push({path, from: oldValue, to: newValue, evidence});
      };
      for (const [bus, state] of Object.entries(after.electrical.bus)) {
        check('elec.bus.' + bus, before.electrical.bus[bus], state, 'ELECTRICAL_V7_SOURCE_LOCATED');
      }
      for (const [id, pump] of Object.entries(after.pumps)) {
        for (const key of ['switchOn', 'powered', 'operating', 'lowPressure']) {
          check(id + '.' + key, before.pumps[id][key], pump[key], pump.powerEvidence);
        }
      }
      check('warnings.masterCautionFuelCandidate', before.warnings.masterCautionFuelCandidate,
        after.warnings.masterCautionFuelCandidate, 'TRAINER_CANDIDATE');
      for (const kind of ['fireBell', 'intermittentHorn']) {
        const old = before.warnings.audio.active.some(a => a.id === kind);
        const now = after.warnings.audio.active.some(a => a.id === kind);
        check('warnings.audio.' + kind, old, now, 'WARNING_ENGINE');
      }
      return changes;
    }
    get() { return {...copy(this.snapshot), recentEvents: copy(this.events)}; }
    replay(commands) { this.reset(); for (const action of commands) this.send(action); return this.get(); }
  }
  return Object.freeze({SCHEMA, MODES, PUMP_REGISTRY, tAnd, tOr, Session});
});
