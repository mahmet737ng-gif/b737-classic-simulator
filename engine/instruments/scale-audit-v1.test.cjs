const { test } = require('node:test');
const assert = require('node:assert/strict');
const audit = require('./scale-audit-v1.json');
const acdc = require('../../panel-mosaic-lab/cockpit/ac-dc-metering-model.js');
const drive = require('../../panel-mosaic-lab/cockpit/drive-amps-needle-model.js');
const cabin = require('../../panel-mosaic-lab/cockpit/cabin-dual-needles-model.js');
const duct = require('../../panel-mosaic-lab/cockpit/duct-pressure-needles-model.js');
const engine = require('../../panel-mosaic-lab/cockpit/isn-engine-gauge-model.js');

test('audit enumerates every currently mounted needle in the known model groups', () => {
  const ids = new Set(audit.gauges.map(g => g.id));
  assert.equal(ids.size, 23);
  for (const group of [acdc.meters, drive.needles, cabin.needles, engine.gauges])
    for (const item of group) assert.ok(ids.has(item.id), item.id);
  for (const item of duct.needles) assert.ok(ids.has(`duct${item.id}`), item.id);
  for (const id of ['apuEgt','cabinRate','cabinTemperature','fuelTemperature','flapL','flapR'])
    assert.ok(ids.has(id), id);
  assert.match(audit.status, /incomplete/);
});
