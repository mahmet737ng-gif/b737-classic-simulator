(async()=>{
;
/* ../../flight-controls-panel/fcom-control-mechanics.js */
try{
/* B737 Classic guarded and horizontal control mechanics.
 * FCOM references: Sepehran 737CL FCOM 9.10.1-3, 11.10.25-26, 10.40.13.
 * FCOM confirms guarded detents. Physical "guard drives lever" is a
 * simulator visualization inference, not a verbatim FCOM mechanical claim.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B737ControlMechanics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const definitions = Object.freeze({
    flightA: { detents:['stby','off','on'], guarded:'on', close:'force_on', fcom:'9.10.1' },
    flightB: { detents:['stby','off','on'], guarded:'on', close:'force_on', fcom:'9.10.1' },
    spoilerA: { detents:['off','on'], guarded:'on', close:'force_on', fcom:'9.10.2' },
    spoilerB: { detents:['off','on'], guarded:'on', close:'force_on', fcom:'9.10.2' },
    alternateFlapsArm: { detents:['off','arm'], guarded:'off', close:'force_off', fcom:'9.10.2-3' },
    emergencyExitLights: { detents:['off','armed','on'], guarded:'armed', close:'force_armed', fcom:'1.30.9 / 1.40.5' }
  });
  const horizontal = Object.freeze({
    vhfNav: Object.freeze(['left','normal','right']),
    irs: Object.freeze(['left','normal','right']),
    efi: Object.freeze(['left','normal','right'])
  });
  function guardTransition(id, current, action, value) {
    const definition = definitions[id];
    if (!definition) return { ok:false, reason:'UNKNOWN_CONTROL', state:current };
    if (!current || !definition.detents.includes(current.value) || !['open','closed'].includes(current.guard))
      return { ok:false, reason:'INVALID_INITIAL_STATE', state:current };
    if (action === 'open') return {ok:true, state:{value:current.value,guard:'open'}};
    if (action === 'set') {
      if (current.guard !== 'open') return {ok:false,reason:'GUARD_CLOSED',state:current};
      if (!definition.detents.includes(value)) return {ok:false,reason:'INVALID_DETENT',state:current};
      return {ok:true,state:{value,guard:'open'}};
    }
    if (action === 'close') {
      // Per-control policy only: unknown policy is fail-closed, not generic OFF.
      const next = definition.close === 'force_on' ? 'on'
        : definition.close === 'force_off' ? 'off'
        : definition.close === 'force_armed' ? 'armed'
        : definition.close === 'preserve_current' ? current.value : null;
      if (next === null || !definition.detents.includes(next))
        return {ok:false,reason:'UNVERIFIED_CLOSE_POLICY',state:current};
      return {ok:true,state:{value:next,guard:'closed'}};
    }
    return {ok:false,reason:'UNKNOWN_ACTION',state:current};
  }
  function horizontalTransition(id, current, event, input) {
    if (!horizontal[id] || !horizontal[id].includes(current))
      return {ok:false,reason:'UNKNOWN_OR_INVALID_SELECTOR',value:current};
    const states=horizontal[id];
    let next=null;
    if (event === 'choose') next=input;
    if (event === 'step') {
      const step = input > 0 ? 1 : input < 0 ? -1 : 0;
      next=states[Math.max(0,Math.min(2,states.indexOf(current)+step))];
    }
    if (!states.includes(next)) return {ok:false,reason:'INVALID_DETENT',value:current};
    return {ok:true,value:next};
  }
  return Object.freeze({ definitions, horizontal, guardTransition, horizontalTransition });
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/interaction/rotary-motion-rm0002.js?v=RM-0004 */
try{
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

  function createDetentGesture(onStep, { firstThreshold = 4, nextThreshold = 18, minTravelPixels = 0 } = {}) {
    if (typeof onStep !== 'function' || !(firstThreshold > 0 && nextThreshold > 0 && minTravelPixels >= 0)) {
      throw new Error('Invalid detent gesture');
    }
    let direction = 0, travel = 0, stepped = false, pixels = 0, pendingDegrees = 0;
    function feed(deltaDegrees, deltaPixels = 0) {
      if (!Number.isFinite(deltaDegrees) || !Number.isFinite(deltaPixels) || deltaPixels < 0) return 0;
      if (minTravelPixels && pixels < minTravelPixels) {
        pixels += deltaPixels;
        pendingDegrees += deltaDegrees;
        if (pixels < minTravelPixels) return 0;
        deltaDegrees = pendingDegrees;
        pendingDegrees = 0;
      }
      if (!deltaDegrees) return 0;
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
    function reset() { direction = 0; travel = 0; stepped = false; pixels = 0; pendingDegrees = 0; }
    return { feed, reset, snapshot: () => ({ direction, travel, stepped }) };
  }
  return Object.freeze({ deltaAngle, anglesFromMarks, createDetentGesture });
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
