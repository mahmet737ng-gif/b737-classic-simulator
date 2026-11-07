/* TOUCH-ROTARY-0001: iPad/stylus horizontal swipe controls for live cockpit knobs.
 * Reuses each control's existing wheel handler: no duplicate state/backend owner.
 * Mouse, keyboard, native scroll outside knobs and two-finger gestures are unchanged.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B737TouchRotarySwipeV1 = api;
  if (typeof document !== 'undefined') api.install(document);
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SELECTOR = [
    '.mounted-rotary:not(.ignition-toggle)',
    '.aircon400-knob',
    '.oh22-pressure-controls [data-role="actuator"]:not(.oh22-pressure-actuator-spring):not(.oh22-pressure-hotspot)',
    '.mcp-ias-mach-knob',
    '.mcp-v3-knob',
    '.irs-upper-outer',
    '.irs-upper-brt',
    '.irs-msu-mini',
    '.irs-live-msu-control',
    '.asp-vbr-selector',
    '[data-acdc-selector]',
    '.asp-photo-control[data-kind="volume"]'
  ].join(',');
  const REVERSE = '.mcp-ias-mach-knob,.mcp-v3-knob,.irs-upper-brt,.asp-photo-control[data-kind="volume"]';

  // Both distance and finger velocity matter: deliberate swipes produce fine
  // adjustment while quick strokes produce several existing backend steps.
  // There is no momentum after lifting a finger, and a reversal is immediate.
  function createMotion(options = {}) {
    const pixelsPerStep = options.pixelsPerStep ?? 14;
    const maxSteps = options.maxSteps ?? 36;
    if (!(pixelsPerStep > 0 && maxSteps >= 1)) throw new Error('Invalid touch rotary motion');
    let travel = 0;
    return Object.freeze({
      feed(dx, dt) {
        if (!Number.isFinite(dx) || !Number.isFinite(dt) || !dx) return 0;
        const velocity = Math.abs(dx) / Math.max(8, dt);
        const gain = Math.min(2.8, 1 + 0.85 * velocity);
        travel += dx * gain;
        const steps = Math.min(maxSteps, Math.trunc(Math.abs(travel) / pixelsPerStep));
        if (!steps) return 0;
        const result = Math.sign(travel) * steps;
        travel -= result * pixelsPerStep;
        return result;
      },
      reset() { travel = 0; },
      pending() { return travel; }
    });
  }

  function tapDirection(clientX, rect) {
    return clientX < rect.left + rect.width / 2 ? -1 : 1;
  }

  function install(doc) {
    if (!doc || doc.__b737TouchRotarySwipeV1) return false;
    doc.__b737TouchRotarySwipeV1 = true;
    let active = null;
    const suppressClicks = new WeakMap();
    const style = doc.createElement('style');
    style.id = 'b737-touch-rotary-swipe-style-v1';
    style.textContent = SELECTOR + '{touch-action:none!important;-webkit-user-select:none!important;user-select:none!important}';
    (doc.head || doc.documentElement).appendChild(style);

    function stop(e) {
      if (e.cancelable) e.preventDefault();
      e.stopImmediatePropagation();
    }
    function step(el, count) {
      const reversed = el.matches(REVERSE);
      const direction = Math.sign(count);
      for (let i = 0; i < Math.abs(count); i++) {
        // Standard knobs: swipe right = clockwise/increase. The MCP IAS/MACH
        // and ASP volume wheel handlers have opposite native wheel polarity.
        const deltaY = direction * (reversed ? -100 : 100);
        el.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true, cancelable: true, deltaY, deltaMode: 0
        }));
      }
    }
    function clear(e, cancelled) {
      if (!active || (e && e.pointerId !== active.id)) return;
      const current = active;
      active = null;
      if (e) stop(e);
      suppressClicks.set(current.el, (typeof performance === 'object' ? performance.now() : Date.now()) + 650);
      if (!cancelled && !current.moved) {
        const x = e && Number.isFinite(e.clientX) ? e.clientX : current.startX;
        step(current.el, tapDirection(x, current.el.getBoundingClientRect()));
      }
      try {
        if (current.el.hasPointerCapture?.(current.id))
          current.el.releasePointerCapture(current.id);
      } catch (_) { /* A removed or replaced knob has already lost capture. */ }
    }

    doc.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      if (active) {
        // Second finger is not interpreted as a second knob or rapid turn.
        clear(null, true);
        return;
      }
      if (e.isPrimary === false || e.button !== 0) return;
      const el = e.target?.closest?.(SELECTOR);
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      stop(e);
      active = {
        el, id: e.pointerId, startX: e.clientX, startY: e.clientY,
        lastX: e.clientX, lastTime: e.timeStamp,
        moved: false, motion: createMotion()
      };
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      el.focus?.({ preventScroll: true });
    }, true);
    doc.addEventListener('pointermove', e => {
      if (!active || e.pointerId !== active.id) return;
      stop(e);
      const item = active;
      const dx = e.clientX - item.lastX;
      const dt = e.timeStamp - item.lastTime;
      item.lastX = e.clientX;
      item.lastTime = e.timeStamp;
      if (Math.hypot(e.clientX - item.startX, e.clientY - item.startY) > 5)
        item.moved = true;
      if (!item.moved || !dx) return;
      const count = item.motion.feed(dx, dt);
      if (count) step(item.el, count);
    }, true);
    doc.addEventListener('pointerup', e => clear(e, false), true);
    doc.addEventListener('pointercancel', e => clear(e, true), true);
    doc.addEventListener('lostpointercapture', e => {
      if (active && e.pointerId === active.id) clear(e, true);
    }, true);
    doc.addEventListener('click', e => {
      if (e.detail === 0) return; // keyboard accessibility stays functional
      const el = e.target?.closest?.(SELECTOR);
      if (!el) return;
      const now = typeof performance === 'object' ? performance.now() : Date.now();
      if (now <= (suppressClicks.get(el) || 0)) stop(e);
    }, true);
    doc.defaultView?.addEventListener('blur', () => clear(null, true));
    return true;
  }
  return Object.freeze({ createMotion, tapDirection, install, selector: SELECTOR });
});
