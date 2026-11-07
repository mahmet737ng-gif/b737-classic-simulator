/* Deterministic, DOM-free regression checks for touch rotary gain and detents. */
const assert = require('node:assert/strict');
const { createMotion, tapDirection, selector } = require('./touch-rotary-swipe-v1.js');
const slow = createMotion();
const fast = createMotion();
assert.equal(slow.feed(28,300), 2, 'slow right swipe makes two fine steps');
assert.ok(fast.feed(28,12) > 2, 'fast swipe over same distance makes more steps');
const left = createMotion();
assert.equal(left.feed(-28,300), -2, 'left swipe reverses rotary');
assert.equal(left.feed(0,10), 0, 'stationary finger never rotates');
const tiny = createMotion();
assert.equal(tiny.feed(3,200), 0, 'micro-movements accumulate without jitter');
assert.equal(tiny.feed(11,200), 1, 'slow motion eventually crosses one detent');
tiny.reset();
assert.equal(tiny.pending(), 0, 'new gestures do not inherit fractional travel');
assert.equal(tapDirection(30, { left: 0, width: 100 }), -1);
assert.equal(tapDirection(70, { left: 0, width: 100 }), 1);
assert.ok(selector.includes('.mounted-rotary'));
console.log('TOUCH-ROTARY-0001 motion tests passed');
