/* B737 Stage 2-4 source-pixel calibration engine.
   Independent of immutable cockpit images and simulator system state. */
(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.B737GaugeScaleEngineV2 = engine;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const isFiniteNumber = x => typeof x === 'number' && Number.isFinite(x);
  const finite = (x, name) => {
    if (!isFiniteNumber(x)) throw Error(name + ' must be finite');
    return x;
  };
  const xy = (p, name, source) => {
    if (!p || !isFiniteNumber(p.x) || !isFiniteNumber(p.y))
      throw Error(name + ' requires native x/y');
    if (source && (p.x < 0 || p.y < 0 || p.x >= source.width || p.y >= source.height))
      throw Error(name + ' lies outside its source image');
    return Object.freeze({ x: p.x, y: p.y });
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // Screen image Y grows DOWN; clockwise from 12:00 => 0 up, 90 right.
  const bearing = (pivot, point) =>
    Math.atan2(point.x - pivot.x, pivot.y - point.y) * 180 / Math.PI;

  function compile(spec) {
    if (!spec || typeof spec.id !== 'string' || !spec.id.trim()) throw Error('Scale ID required');
    if (!['rotary', 'linear'].includes(spec.kind)) throw Error('Unknown scale kind');
    if (typeof spec.unit !== 'string' || !spec.unit.trim()) throw Error('Scale unit required');
    if (!spec.source || !isFiniteNumber(spec.source.width) || !isFiniteNumber(spec.source.height) ||
        spec.source.width <= 0 || spec.source.height <= 0)
      throw Error('Native image source dimensions required');
    const source = Object.freeze({
      asset: spec.source.asset || null,
      sha256: spec.source.sha256 || null,
      width: spec.source.width, height: spec.source.height
    });
    const pivot = spec.kind === 'rotary' ? xy(spec.pivot, 'Pivot', source) : null;
    const marks = (spec.marks || []).map((m, i) => {
      if (!m || !isFiniteNumber(m.value)) throw Error('Mark '+i+' missing numeric value');
      const pt = xy(m, 'Mark '+i, source);
      return Object.freeze({
        value: m.value, x: pt.x, y: pt.y,
        major: m.major === true, label: m.label == null ? null : String(m.label),
        evidence: m.evidence || 'unverified',
        ...(pivot ? { angle: bearing(pivot, pt) } : {})
      });
    });
    if (marks.length < 2) throw Error('At least two actual scale marks required');
    for (let i = 1; i < marks.length; i++)
      if (marks[i].value <= marks[i-1].value)
        throw Error('Mark values must be strictly increasing');
    if (spec.min !== marks[0].value || spec.max !== marks.at(-1).value)
      throw Error('Printed min/max must equal first and last registered mark');
    const verified = spec.status === 'verified';
    if (verified && (!source.sha256 || !/^[a-f0-9]{64}$/i.test(source.sha256) ||
        !marks.every(m => m.evidence === 'measured_source_pixels') || !spec.review?.approved))
      throw Error('Verified calibration requires source hash, measured marks and approval');

    let direction = null;
    if (pivot) {
      if (!['clockwise','counterclockwise'].includes(spec.direction))
        throw Error('Rotary scales require declared positive-value direction');
      direction = spec.direction === 'clockwise' ? 1 : -1;
      for (let i = 1; i < marks.length; i++) {
        let b = marks[i].angle;
        let delta = b - marks[i-1].angle;
        while (delta * direction <= 0) { b += 360 * direction; delta = b - marks[i-1].angle; }
        if (delta * direction > (spec.maxGapDeg ?? 120))
          throw Error('Scale has an unmeasured angular gap or reversed mark at index '+i);
        marks[i] = Object.freeze({ ...marks[i], angle: b });
      }
      if ((marks.at(-1).angle - marks[0].angle) * direction > (spec.maxTravelDeg ?? 360))
        throw Error('Unexpected total scale travel');
    }
    function locate(value, options) {
      finite(value, 'Sensor value');
      const outside = value < spec.min || value > spec.max;
      if (outside && options?.outOfRange === 'reject')
        return Object.freeze({ status: 'out_of_range', value, min: spec.min, max: spec.max });
      const v = clamp(value, spec.min, spec.max);
      let i=1;
      while (i < marks.length-1 && v > marks[i].value) i++;
      const a=marks[i-1], b=marks[i], t=(v-a.value)/(b.value-a.value);
      const x=a.x+(b.x-a.x)*t, y=a.y+(b.y-a.y)*t;
      const angle=pivot ? a.angle+(b.angle-a.angle)*t : null;
      return Object.freeze({status: outside ? 'pegged' : 'ok', value: v, input: value,
        position: Object.freeze({x,y}), angleDeg: angle,
        rotationDeg: pivot ? angle - (spec.needleReferenceBearing ?? 0) : null,
        bracket: Object.freeze([a.value,b.value]), fraction:t });
    }
    function read(sample, options) {
      if (spec.status !== 'verified' && !options?.allowUnverifiedPreview)
        return Object.freeze({status:'blocked',reason:'calibration_unverified',id:spec.id});
      if (!sample || sample.valid !== true || !isFiniteNumber(sample.value))
        return Object.freeze({status:'unavailable',reason:'invalid_signal',id:spec.id});
      if (sample.powered !== true)
        return Object.freeze({status:'unavailable',reason:'power_unconfirmed',id:spec.id});
      return locate(sample.value, options);
    }
    return Object.freeze({ id:spec.id, kind:spec.kind, unit:spec.unit, source,pivot,
      direction, min:spec.min, max:spec.max,
      marks:Object.freeze(marks), verified, locate, read });
  }

  // Do NOT invent failure parking or dynamic rate; these must be supplied by a
  // source-backed mechanism model. Renderer uses the verified target returned by read().
  function stepRotation(currentDeg, targetDeg, seconds, maxDegreesPerSecond) {
    finite(targetDeg,'Target angle'); finite(seconds,'Delta time');
    if (seconds < 0) throw Error('Delta time must be nonnegative');
    finite(maxDegreesPerSecond,'Pointer slew rate');
    if (maxDegreesPerSecond <= 0) throw Error('Slew rate must be positive');
    if (currentDeg == null) return targetDeg;
    finite(currentDeg,'Current angle');
    return currentDeg + clamp(targetDeg-currentDeg,
      -maxDegreesPerSecond*seconds, maxDegreesPerSecond*seconds);
  }
  return Object.freeze({compile, bearing,stepRotation});
});