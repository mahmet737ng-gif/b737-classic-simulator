const assert = require('node:assert/strict');
const { test } = require('node:test');
const { bearing, create } = require('./scale-calibration-v1.js');

test('maps measured major and minor ticks, including a nonuniform scale', () => {
  const gauge = create({ id: 'test', unit: 'psi', pivot: { x: 100, y: 100 }, min: 0, max: 100,
    ticks: [{ value: 0, x: 50, y: 100 }, { value: 20, x: 100, y: 50 },
      { value: 100, x: 150, y: 100 }] });
  assert.equal(gauge.angleFor(0), -90);
  assert.equal(gauge.angleFor(20), 0);
  assert.equal(gauge.angleFor(60), 45);
  assert.equal(gauge.angleFor(100), 90);
  assert.equal(gauge.angleFor(200), 90);
});

test('rejects missing endpoints, reversed values and unlocated ticks', () => {
  const base = { id: 'x', unit: 'C', pivot: { x: 0, y: 0 }, min: 0, max: 20,
    ticks: [{ value: 0, x: -1, y: 0 }, { value: 20, x: 1, y: 0 }] };
  assert.equal(bearing(base.pivot, base.ticks[0]), -90);
  assert.throws(() => create({ ...base, max: 30 }), /Endpoint/);
  assert.throws(() => create({ ...base, ticks: [...base.ticks].reverse() }), /increasing/);
  assert.throws(() => create({ ...base, ticks: [{ value: 0 }, base.ticks[1]] }), /source-image/);
});
