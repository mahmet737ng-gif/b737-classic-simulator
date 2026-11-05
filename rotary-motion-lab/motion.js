(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.B737RotaryMotion = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const deltaAngle = (from, to) => ((to - from + 540) % 360 + 360) % 360 - 180;
  function create(spec, emit = () => {}) {
    const detent = spec.mode === 'detent';
    if (!['detent', 'continuous'].includes(spec.mode)) throw Error('Unknown rotary mode');
    if (detent && (!Array.isArray(spec.angles) || spec.angles.length < 2 ||
        spec.angles.length !== spec.labels?.length || spec.angles.some((a, i) => !Number.isFinite(a) || (i && a <= spec.angles[i - 1])))) throw Error('Invalid detents');
    if (!detent && !(Number.isFinite(spec.min) && Number.isFinite(spec.max) && spec.min < spec.max && spec.step > 0 && spec.angleMin < spec.angleMax)) throw Error('Invalid continuous range');
    const min = detent ? 0 : spec.min, max = detent ? spec.angles.length - 1 : spec.max;
    const lo = detent ? spec.angles[0] : spec.angleMin, hi = detent ? spec.angles.at(-1) : spec.angleMax;
    const normalize = n => detent ? clamp(Math.round(n), min, max) : Number(clamp(spec.min + Math.round((n - spec.min) / spec.step) * spec.step, min, max).toFixed(8));
    if (!Number.isFinite(spec.initial)) throw Error('Missing initial value');
    let value = normalize(spec.initial), preview = angleFor(value), start = null;
    function angleFor(v) { return detent ? spec.angles[v] : lo + (v - min) / (max - min) * (hi - lo); }
    function valueFor(a) {
      if (!detent) return normalize(min + (a - lo) / (hi - lo) * (max - min));
      return spec.angles.reduce((best, n, i) => Math.abs(n - a) < Math.abs(spec.angles[best] - a) ? i : best, 0);
    }
    function set(next, reason = 'set') {
      if (!Number.isFinite(next)) return false;
      const previous = value;
      value = normalize(next); preview = angleFor(value);
      if (previous === value) return false;
      emit(Object.freeze({ id: spec.id, previous, value, angle: preview, reason, kind: 'selector-command' }));
      return true;
    }
    return {
      get value() { return value; }, get angle() { return preview; }, get min() { return min; }, get max() { return max; },
      get text() { return detent ? spec.labels[value] : String(value) + (spec.unit || ''); },
      set,
      step(direction, reason = 'step') { return direction ? set(value + Math.sign(direction) * (detent ? 1 : spec.step), reason) : false; },
      begin() { start = { value, angle: angleFor(value) }; preview = start.angle; },
      drag(degrees) {
        if (!start || !Number.isFinite(degrees)) return;
        preview = clamp(preview + degrees, lo, hi);
        if (!detent) { const a = preview; set(valueFor(a), 'drag'); preview = a; }
      },
      finish(cancel = false) {
        if (!start) return;
        const target = cancel ? start.value : valueFor(preview);
        start = null; set(target, cancel ? 'cancel' : 'release'); preview = angleFor(value);
      }
    };
  }
  return Object.freeze({ create, deltaAngle });
});
