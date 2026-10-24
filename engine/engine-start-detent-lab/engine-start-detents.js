/* B737 Classic engine start selector visual contract. Aircraft/system logic is external. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B737_ENGINE_START_DETENTS = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const ORDER = Object.freeze(['GRD', 'OFF', 'CONT', 'FLT']);
  const PIVOTS = Object.freeze({
    1: Object.freeze({ x: 964, y: 328 }),
    2: Object.freeze({ x: 1292, y: 328 }),
  });
  // Centers of the printed labels in the standalone corrected engine-start plate.
  // These are image-space measurements, not assumed equal-angle mechanical stops.
  const MARKS = Object.freeze({
    1: Object.freeze({
      GRD: [914, 263], OFF: [954, 263], CONT: [1000, 263], FLT: [1031, 299],
    }),
    2: Object.freeze({
      GRD: [1252, 263], OFF: [1287, 263], CONT: [1334, 263], FLT: [1355, 299],
    }),
  });

  function angleFromLabel(pivot, mark) {
    // Clockwise degrees from 12 o'clock. A north-pointing sprite is 0 degrees.
    return Math.atan2(mark[0] - pivot.x, pivot.y - mark[1]) * 180 / Math.PI;
  }

  function geometry(engine) {
    const pivot = PIVOTS[engine];
    if (!pivot) throw new Error('Unknown engine: ' + engine);
    const marks = MARKS[engine];
    const angles = ORDER.map(state => angleFromLabel(pivot, marks[state]));
    if (!angles.every(Number.isFinite) || !angles.every((angle, i) => !i || angle > angles[i - 1])) {
      throw new Error('Detent marks must be ordered counterclockwise to clockwise');
    }
    if (angles[3] - angles[2] < 30) throw new Error('CONT / FLT remain too close');
    return { pivot, marks, angles, labels: ORDER };
  }

  function createEngineStartSelectors(initial = { 1: 'OFF', 2: 'OFF' }) {
    const positions = { 1: initial[1] || 'OFF', 2: initial[2] || 'OFF' };
    for (const state of Object.values(positions)) {
      if (!ORDER.includes(state)) throw new Error('Invalid initial state: ' + state);
    }
    const subscribers = new Set();
    function notify(engine, from, source) {
      const to = positions[engine];
      if (from === to) return;
      const detail = { engine: Number(engine), previous: from, state: to, angle: angle(engine), source };
      for (const fn of subscribers) fn(detail);
    }
    function get(engine) {
      if (!PIVOTS[engine]) throw new Error('Unknown engine: ' + engine);
      return positions[engine];
    }
    function angle(engine) {
      return geometry(engine).angles[ORDER.indexOf(get(engine))];
    }
    function set(engine, state, source = 'external') {
      const old = get(engine);
      if (!ORDER.includes(state)) throw new Error('Unknown detent: ' + state);
      positions[engine] = state;
      notify(engine, old, source);
      return get(engine);
    }
    function step(engine, direction, source = 'gesture') {
      const old = get(engine);
      const delta = Math.sign(direction);
      if (!delta) return old;
      const next = Math.min(ORDER.length - 1, Math.max(0, ORDER.indexOf(old) + delta));
      return set(engine, ORDER[next], source);
    }
    function release(engine) { return get(engine); } // No release-time extra step.
    function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
    return { get, angle, set, step, release, subscribe };
  }
  return { ORDER, geometry, angleFromLabel, createEngineStartSelectors };
});
