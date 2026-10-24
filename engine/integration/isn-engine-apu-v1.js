/* ISN-03 / stage 1: Engine/APU observed-source bridge.
 * Reuses existing Electrical V7, ISN-01 fuel/hyd/warnings and Pneumatics V6.
 * A START request is never proof of a running engine/APU; UNKNOWN stays UNKNOWN.
 * Functional associations are from existing FCOM-scoped engines, not WDM wiring.
 */
(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B737ISNEngineAPUV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : null, function() {
  'use strict';
  const SCHEMA = 'b737-isn-engine-apu/1';
  const DEVICES = Object.freeze(['engine1', 'engine2', 'apu']);
  const SENSOR_ORIGINS = Object.freeze(['INSTRUCTOR_OBSERVATION', 'EXTERNAL_SENSOR_OBSERVATION',
    'TRAINING_SEQUENCE_SIMULATED']);
  const SOURCE_LINKS = Object.freeze({
    electrical: 'FCOM 6.20.1-4 / Electrical V7 source readiness (functional, not feeder wiring)',
    pneumatics: 'FCOM 2.20.1-2 / Pneumatics V6 bleed source readiness (no duct pressure physics)',
    fuel: 'FCOM 12.10.2-3 / ISN-01 electric pump states (no engine fuel supply inference)',
    warning: 'FCOM 15.20 / WarningEngine fire indications use independent fire sensors'
  });
  const clone = value => JSON.parse(JSON.stringify(value));
  const validDevice = device => DEVICES.includes(device);
  const validObserved = value => value === true || value === false || value === null;

  class Session {
    constructor({ElectricalPack, Electrical, Loads, TrainerCore, WarningEngine, Pneumatics} = {}) {
      if (typeof ElectricalPack?.Session !== 'function' || !Pneumatics?.initial ||
          !Pneumatics?.apply || !Pneumatics?.derive) throw Error('ISN Electrical Pack and Pneumatics V6 required');
      this.Pneumatics = Pneumatics;
      this.dependencies = {Electrical, Loads, TrainerCore, WarningEngine};
      this.ElectricalPack = ElectricalPack;
      this.reset();
    }
    reset() {
      this.pack = new this.ElectricalPack.Session(this.dependencies);
      this.pneumaticState = this.Pneumatics.initial();
      this.observed = Object.fromEntries(DEVICES.map(id => [id, {running: null, origin: null}]));
      this.requests = Object.fromEntries(DEVICES.map(id => [id, null]));
      this.seq = 0;
      this.events = [];
      this.snapshot = this.compute();
      return this.get();
    }
    complete() { return DEVICES.every(id => this.observed[id].running !== null); }
    // Avoid using the legacy educational defaults (both engines running) as
    // evidence. Nothing derived is published until all three statuses are known.
    compute() {
      const ready = this.complete();
      const p = ready ? this.pack.get() : null;
      const n = ready ? this.Pneumatics.derive(this.pneumaticState) : null;
      return {
        schema: SCHEMA, seq: this.seq, status: ready ? 'SOURCE_GATED_ACTIVE' : 'WAITING_FOR_SOURCE_OBSERVATIONS',
        source: clone(this.observed), requests: clone(this.requests),
        unresolved: DEVICES.filter(id => this.observed[id].running === null),
        electrical: p ? p.electrical : null,
        fuelAndHydraulicPumps: p ? p.pumps : null,
        warnings: p ? p.warnings : null,
        pneumatics: n,
        engineFuelFeed: null,
        apuElectricalSelectionAutomatic: false,
        sourceReferences: SOURCE_LINKS,
        qa: {
          statusInputs: 'OBSERVATION_NOT_START_PREDICTION',
          missingStatus: ready ? null : 'NO_DERIVED_STATES_EXPOSED_UNTIL_ALL_3_OBSERVED',
          pumpFeeder: 'UNKNOWN_INSTALLATION_SPECIFIC_WIRING',
          engineFuelFeed: 'UNKNOWN_NO_START_FUEL_FLOW_MODEL',
          apuDuctRouting: 'UNKNOWN_PER_PNEUMATICS_V6',
          flightDynamics: 'NOT_MODELED',
          warnings: 'NO_AUTOMATIC_FIRE_OR_AURAL_WARNING_FROM_ENGINE_STOP',
          status: 'EDUCATIONAL_FUNCTIONAL_LINKS_NOT_INSTALLATION_VERIFIED'
        }
      };
    }
    differences(before, after) {
      const changes = [];
      const check = (path, a, b, evidence) => {
        if (a !== b) changes.push({path, from: a, to: b, evidence});
      };
      check('network.status', before.status, after.status, 'ALL_3_SOURCE_STATUS_GATE');
      for (const id of DEVICES) {
        check('source.' + id + '.running', before.source[id].running, after.source[id].running,
          after.source[id].origin || 'OBSERVATION_RETRACTED');
      }
      if (before.electrical && after.electrical) {
        for (const [bus, value] of Object.entries(after.electrical.bus)) {
          check('electrical.bus.' + bus, before.electrical.bus[bus], value, SOURCE_LINKS.electrical);
        }
      }
      if (before.pneumatics && after.pneumatics) {
        for (const key of ['engine1ValveOpen', 'engine2ValveOpen', 'apuBleedValveOpen', 'dualBleed']) {
          check('pneumatics.bleed.' + key, before.pneumatics.bleed[key], after.pneumatics.bleed[key], SOURCE_LINKS.pneumatics);
        }
        for (const side of ['L', 'R']) {
          check('pneumatics.pack.' + side + '.operational', before.pneumatics.pack[side].operational,
            after.pneumatics.pack[side].operational, SOURCE_LINKS.pneumatics);
        }
      }
      if (before.fuelAndHydraulicPumps && after.fuelAndHydraulicPumps) {
        for (const [id, pump] of Object.entries(after.fuelAndHydraulicPumps)) {
          check(id + '.operating', before.fuelAndHydraulicPumps[id].operating,
            pump.operating, pump.powerEvidence);
        }
      }
      return changes;
    }
    send(command) {
      if (!command || typeof command.type !== 'string') throw Error('ISN-03 command required');
      if (command.type === 'RESET') return this.reset();
      const before = this.snapshot;
      if (command.type === 'SOURCE_REQUEST') {
        if (!validDevice(command.device) || !['START', 'SHUTDOWN'].includes(command.request)) throw Error('Invalid source request');
        // Intent only: no N2/EGT/starter law is implemented or inferred.
        this.requests[command.device] = command.request;
      } else if (command.type === 'SOURCE_OBSERVATION') {
        if (!validDevice(command.device) || !validObserved(command.running) ||
            !SENSOR_ORIGINS.includes(command.origin) ||
            (command.origin === 'INSTRUCTOR_OBSERVATION' && command.instructor !== true) ||
            (command.origin === 'TRAINING_SEQUENCE_SIMULATED' && command.training !== true)) {
          throw Error('Valid explicit source observation and origin required');
        }
        const id = command.device;
        this.observed[id] = {running: command.running, origin: command.running === null ? null : command.origin};
        if (command.running !== null) {
          const key = id === 'apu' ? 'apuRunning' : id + 'Running';
          this.pack.send({type: 'ELECTRICAL', action: {type: 'CONTROL', key, value: command.running}});
          this.pneumaticState = this.Pneumatics.apply(this.pneumaticState,
            {type: 'SENSOR', key, value: command.running});
        }
      } else if (command.type === 'ELECTRICAL') {
        const action = command.action;
        if (!action || action.type === 'RESET' ||
            (action.type === 'CONTROL' && ['engine1Running','engine2Running','apuRunning'].includes(action.key))) {
          throw Error('Use SOURCE_OBSERVATION for running state; use RESET for a full session reset');
        }
        this.pack.send({type: 'ELECTRICAL', action});
        if (action.type === 'CONTROL' && action.key === 'onGround') {
          this.pneumaticState = this.Pneumatics.apply(this.pneumaticState,
            {type: 'SENSOR', key: 'onGround', value: action.value});
        }
      } else if (command.type === 'PNEUMATIC') {
        const action = command.action;
        if (!action || action.type === 'RESET' ||
            (action.type === 'SENSOR' && ['engine1Running','engine2Running','apuRunning','onGround'].includes(action.key))) {
          throw Error('Shared source and ground signals are centrally owned');
        }
        this.pneumaticState = this.Pneumatics.apply(this.pneumaticState, action);
      } else if (command.type === 'PACK') {
        if (!command.action || !['PUMP_SWITCH','PUMP_FAULT','PUMP_OVERHEAT',
          'OBSERVED_POWER','WARNING_SENSOR','CUTOUT_CABIN','ACK_FIRE'].includes(command.action.type)) {
          throw Error('ISN-03 permits only source-gated ISN-01 consumer/warning actions; no guessed surrogate');
        }
        this.pack.send(command.action);
      } else throw Error('Unsupported ISN-03 command');
      this.seq++;
      this.snapshot = this.compute();
      const changes = this.differences(before, this.snapshot);
      this.events.push({seq: this.seq, command: clone(command), changes});
      if (this.events.length > 250) this.events.shift();
      return this.get();
    }
    get() { return {...clone(this.snapshot), recentEvents: clone(this.events)}; }
    replay(commands) { this.reset(); for (const command of commands) this.send(command); return this.get(); }
  }
  return Object.freeze({SCHEMA, DEVICES, SENSOR_ORIGINS, SOURCE_LINKS, Session});
});
