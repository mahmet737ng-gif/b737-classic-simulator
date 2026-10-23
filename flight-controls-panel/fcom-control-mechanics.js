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
    alternateFlapsArm: { detents:['off','arm'], guarded:'off', close:'force_off', fcom:'9.10.2-3' ,
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
