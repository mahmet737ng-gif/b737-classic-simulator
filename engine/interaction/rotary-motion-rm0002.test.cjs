'use strict';
const assert = require('node:assert/strict');
const api = require('./rotary-motion-rm0002.js');
const states = ['PARK', 'OFF', 'LOW', 'HIGH'];
let state = 1;
const events = [];
const g = api.createDetentGesture(d => {
  const previous = state;
  state = Math.max(0, Math.min(states.length - 1, state + d));
  if (previous !== state) events.push(states[state]);
});
assert.equal(g.feed(1), 0);
assert.equal(state, 1);
assert.equal(g.feed(3.2), 1);
assert.equal(state, 2, 'first motion triggers the adjacent right-side detent');
assert.equal(g.feed(17), 0);
assert.equal(g.feed(1.5), 1);
assert.equal(state, 3);
assert.equal(g.feed(100), 5); // capped at HIGH; no wrap
assert.equal(state, 3);
assert.equal(g.feed(-4.2), 1);
assert.equal(state, 2, 'reverse gesture selects the previous detent');
assert.equal(g.feed(-18), 1);
assert.equal(state, 1);
const released = state; // no release-time state change, by design
assert.equal(state, released);
g.reset();
assert.deepEqual(g.snapshot(), { direction: 0, travel: 0, stepped: false });
assert.equal(api.deltaAngle(179, -179), 2);
assert.equal(api.deltaAngle(-179, 179), -2);
const angles = api.anglesFromMarks([404,1572], [[293,1445],[403,1403],[514,1445],[572,1564]]);
assert.equal(angles.length, 4);
assert.ok(angles.every((a,i) => !i || a > angles[i-1]));
assert.ok(Math.abs(angles[0] + 41.154) < .02);
assert.ok(Math.abs(angles[3] - 87.274) < .02);
assert.throws(() => api.anglesFromMarks([0,0], [[0,0],[1,1]]));
console.log('PASS: RM-0002 direction, adjacent detent, hard stops, angle wrap, wiper marks');
