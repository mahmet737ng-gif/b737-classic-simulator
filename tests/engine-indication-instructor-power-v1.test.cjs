/* Regression: quick RUNNING preset does not implicitly power engine instruments.
 * Validate the actual Electrical V7 + Engine Indications V1 contract.
 */
const assert = require('node:assert/strict');
const Electrical = require('../engine/systems/electrical-v7.js');
const Instruments = require('../engine/instruments/engine-indication-backend-v1.js');
const db = require('../engine/instruments/engine-indication-technical-db-v1.json');

const sample = {
  quality: 'TRAINING_SIMULATION_ONLY',
  engines: Object.fromEntries([1, 2].map(n => ['engine'+n, {
    n1Percent: 87, n2Percent: 90, egtC: 520, fuelFlowKgHr: 2400,
    oil: {pressurePsi: 55, temperatureC: 95, quantityPct: 80}
  }]))
};
const observed = Instruments.fromEcu(sample);
assert.equal(observed.engine1.n1.value, 87, 'ECU actually provides running N1');
const run = (electrical, mode='CONVENTIONAL') =>
  Instruments.calculate(db,{mode,electrical:Electrical.evaluate(electrical),observed});

let state = Electrical.initialState({coldDark:true});
for (const n of [1, 2])
  state = Electrical.apply(state,{type:'CONTROL',key:'engine'+n+'Running',value:true});
const dark = run(state);
assert.equal(dark.engines.engine1.indications.n1.status,'POWER_LOSS',
 'RUNNING without battery/connected GEN must not fabricate a powered N1 gauge');
assert.equal(dark.engines.engine2.indications.n1.status,'POWER_LOSS');
assert.equal(dark.engines.engine1.indications.egt.status,'POWER_LOSS');
assert.equal(Electrical.evaluate(state).bus.transfer1,false);
state = Electrical.apply(state,{type:'CONTROL',key:'batterySwitch',value:true});
const battery = run(state);
assert.equal(battery.engines.engine1.indications.n1.status,'VALID',
 'BAT ON restores battery-fed N1 while gens remain unselected');
assert.equal(battery.engines.engine1.indications.n2.status,'POWER_LOSS',
 'battery alone must not pretend the engine generator is on an AC bus');
for(const [n,source] of [[1,'GEN1'],[2,'GEN2']])
  state = Electrical.apply(state,{type:'SELECT_SOURCE',source,side:n});
const powered=run(state);
for(const n of [1,2])
 for(const p of ['n1','egt','n2','fuelFlow','oilPressure','oilTemperature','oilQuantity'])
  assert.equal(powered.engines['engine'+n].indications[p].status,'VALID',n+' '+p);
console.log('PASS: engine ECU RUNNING vs electrical supply and restored photo instruments');
