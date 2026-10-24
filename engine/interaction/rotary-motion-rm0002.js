/* RM-0002: tactile, direction-triggered detent stepping. No free-follow rotation. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B737RotaryMotionRM0002 = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const deltaAngle = (from, to) => ((to - from + 540) % 360 + 360) % 360 - 180;
  const anglesFromMarks = (pivot, marks, pointerZero = 0) => {
    if (!Array.isArray(pivot) || pivot.length !== 2 || !pivot.every(Number.isFinite)
      || !Array.isArray(marks) || marks.length < 2
      || marks.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)
        || Math.hypot(p[0] - pivot[0], p[1] - pivot[1]) < 1)) {
      throw new Error('Invalid panel pivot / label marks');
    }
    return marks.map(p => Math.atan2(p[0] - pivot[0], pivot[1] - p[1]) * 180 / Math.PI - pointerZero);
  };

  function createDetentGesture(onStep, { firstThreshold = 4, nextThreshold = 18 } = {}) {
    if (typeof onStep !== 'function' || !(firstThreshold > 0 && nextThreshold > 0)) {
      throw new Error('Invalid detent gesture');
    }
    let direction = 0, travel = 0, stepped = false;
    function feed(deltaDegrees) {
      if (!Number.isFinite(deltaDegrees) || !deltaDegrees) return 0;
      const sign = Math.sign(deltaDegrees);
      if (sign !== direction) { direction = sign; travel = 0; stepped = false; }
      travel += Math.abs(deltaDegrees);
      let count = 0;
      while (count < 12 && travel >= (stepped ? nextThreshold : firstThreshold)) {
        travel -= stepped ? nextThreshold : firstThreshold;
        onStep(sign);
        stepped = true;
        count += 1;
      }
      return count;
    }
    function reset() { direction = 0; travel = 0; stepped = false; }
    return { feed, reset, snapshot: () => ({ direction, travel, stepped }) };
  }
  return Object.freeze({ deltaAngle, anglesFromMarks, createDetentGesture });
});
