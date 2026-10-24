const assert = require('node:assert/strict');
const { ORDER, geometry, createEngineStartSelectors } = require('../engine-start-detents.js');

assert.deepEqual(ORDER, ['GRD', 'OFF', 'CONT', 'FLT']);
for (const engine of [1, 2]) {
  const angles = geometry(engine).angles;
  assert.equal(angles.length, 4);
  for (let i = 1; i < angles.length; i++) assert.ok(angles[i] > angles[i - 1]);
  assert.ok(angles[3] - angles[2] >= 30, 'FLT has meaningful angular spacing after CONT');
}
const s = createEngineStartSelectors();
assert.equal(s.get(1), 'OFF');
assert.equal(s.get(2), 'OFF');
assert.equal(s.step(1, +1), 'CONT');
assert.equal(s.release(1), 'CONT', 'release cannot produce another step');
assert.equal(s.step(1, +1), 'FLT');
assert.equal(s.step(1, +1), 'FLT', 'cannot wrap past FLT');
assert.equal(s.step(1, -1), 'CONT');
assert.equal(s.step(1, -1), 'OFF');
assert.equal(s.step(1, -1), 'GRD');
assert.equal(s.step(1, -1), 'GRD', 'cannot wrap past GRD');
assert.equal(s.get(2), 'OFF', 'engine switches are independent');
const events = [];
const unsubscribe = s.subscribe(v => events.push(v));
s.set(2, 'FLT', 'external');
assert.equal(events.length, 1);
assert.equal(events[0].engine, 2);
assert.equal(events[0].state, 'FLT');
assert.equal(events[0].angle, geometry(2).angles[3]);
unsubscribe();
assert.throws(() => s.set(2, 'invalid'));
assert.throws(() => geometry(3));
console.log('Engine start detent / direction / independence / spacing tests: OK');
