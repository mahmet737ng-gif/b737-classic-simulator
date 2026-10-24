(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B737ScaleCalibration = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  // Clockwise degrees from twelve o'clock in the unscaled source image.
  function bearing(pivot, point) {
    if (![pivot?.x, pivot?.y, point?.x, point?.y].every(Number.isFinite))
      throw Error('A pivot and tick point in source-image pixels are required');
    if (pivot.x === point.x && pivot.y === point.y) throw Error('Tick cannot be on pivot');
    return Math.atan2(point.x - pivot.x, pivot.y - point.y) * 180 / Math.PI;
  }

  function create(spec) {
    if (!spec || !spec.id || !spec.unit || !spec.pivot || !Array.isArray(spec.ticks))
      throw Error('Gauge ID, unit, pivot and ticks are required');
    if (spec.ticks.length < 2) throw Error('At least two measured ticks are required');
    const ticks = spec.ticks.map(t => {
      if (!Number.isFinite(t.value) || !Number.isFinite(t.x) || !Number.isFinite(t.y))
        throw Error('Every calibration tick needs a finite value and source-image position');
      return Object.freeze({ ...t, angle: bearing(spec.pivot, t) });
    });
    for (let i = 1; i < ticks.length; i++) {
      if (ticks[i].value <= ticks[i - 1].value) throw Error('Ticks must be in increasing value order');
      // Unwrap a genuine 360-degree crossing without changing the image positions.
      let angle = ticks[i].angle;
      while (angle - ticks[i - 1].angle > 180) angle -= 360;
      while (angle - ticks[i - 1].angle < -180) angle += 360;
      ticks[i] = Object.freeze({ ...ticks[i], angle });
    }
    const direction = Math.sign(ticks.at(-1).angle - ticks[0].angle);
    if (!direction) throw Error('Scale has no angular travel');
    for (let i = 1; i < ticks.length; i++)
      if (Math.sign(ticks[i].angle - ticks[i - 1].angle) !== direction)
        throw Error('Tick angles must progress monotonically along the selected scale');
    const min = ticks[0].value, max = ticks.at(-1).value;
    if (spec.min !== min || spec.max !== max) throw Error('Endpoint ticks must match printed min/max');
    function angleFor(value) {
      if (!Number.isFinite(value)) throw Error('Reading must be finite');
      const v = Math.min(max, Math.max(min, value));
      for (let i = 1; i < ticks.length; i++) if (v <= ticks[i].value) {
        const a = ticks[i - 1], b = ticks[i];
        return a.angle + (v - a.value) * (b.angle - a.angle) / (b.value - a.value);
      }
      return ticks.at(-1).angle;
    }
    return Object.freeze({ id: spec.id, unit: spec.unit, pivot: Object.freeze({ ...spec.pivot }),
      min, max, ticks: Object.freeze(ticks), angleFor });
  }

  return Object.freeze({ bearing, create });
});
