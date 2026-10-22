'use strict';

/**
 * 737 Classic engine overheat/fire detection: isolated, testable pilot model.
 * FCOM Sepehran D6-27370-300/400/500-SHI, §8.20.1-2,
 * private source PDF physical pages 1234-1235.
 *
 * NOT a full thermal detector model: A/B overheat and fire flags are outputs
 * of a yet-to-be-implemented sensor physics layer. No temperatures, debounce
 * times or wiring assumptions are invented here.
 *
 * No UI effects; never directly writes lamps or plays audio.
 */
const VALID_SELECTORS = new Set(['NORMAL', 'A', 'B']);

function checkLoop(loop, side) {
  if (!loop || typeof loop !== 'object') {
    throw new TypeError('loop ' + side + ' must be provided');
  }
  for (const field of ['healthy', 'overheat', 'fire']) {
    if (typeof loop[field] !== 'boolean') {
      throw new TypeError('loop ' + side + '.' + field + ' must be boolean');
    }
  }
}

/**
 * @param {Object} input
 * @param {'NORMAL'|'A'|'B'} input.selector
 * @param {'POWERED'|'UNPOWERED'} input.power
 * @param {{A:{healthy:boolean,overheat:boolean,fire:boolean},
 *          B:{healthy:boolean,overheat:boolean,fire:boolean}}} input.loops
 * @param {boolean} [input.fireWarnAcknowledged]
 * @param {boolean} [input.masterCautionAcknowledged]
 * @returns {Object} derived detector/alert conditions (no mutable state)
 */
function evaluateEngineFireDetection(input) {
  if (!input || !VALID_SELECTORS.has(input.selector)) {
    throw new TypeError('selector must be NORMAL, A or B');
  }
  if (!['POWERED', 'UNPOWERED'].includes(input.power)) {
    throw new TypeError('power must be POWERED or UNPOWERED');
  }
  if (typeof (input.fireWarnAcknowledged ?? false) !== 'boolean' ||
      typeof (input.masterCautionAcknowledged ?? false) !== 'boolean') {
    throw new TypeError('acknowledgement values must be boolean');
  }
  if (!input.loops) throw new TypeError('loops A and B are required');
  checkLoop(input.loops.A, 'A');
  checkLoop(input.loops.B, 'B');

  // The FCOM documents detector dependence on the battery bus, but
  // not the complete cockpit indication behavior with that bus dead.
  // UNKNOWN is intentional: do not fabricate a lit FAULT or a clear warning.
  if (input.power === 'UNPOWERED') {
    return {
      sensorStatus: 'UNPOWERED', operational: false,
      activeLoops: [], silentlyDegraded: null, detectorFault: null,
      overheatDetected: null, fireDetected: null,
      alerts: {
        engOverheat: null, ovhtDet: null, masterCaution: null,
        engFireSwitch: null, masterFireWarn: null, fireBell: null
      },
      reason: 'DETECTION_BUS_UNPOWERED_INDICATION_UNVERIFIED'
    };
  }

  const l = input.loops;
  const healthy = input.selector === 'NORMAL'
    ? ['A','B'].filter(side => l[side].healthy)
    : (l[input.selector].healthy ? [input.selector] : []);
  const operational = healthy.length > 0;
  const silentlyDegraded = input.selector === 'NORMAL' && healthy.length === 1;
  const detectorFault = !operational;

  // In NORMAL, healthy A AND B must agree. If one fails, it is automatically
  // excluded and the surviving loop operates alone without a failure light.
  const vote = field => !operational ? false :
    (healthy.length === 1 ? l[healthy[0]][field] :
      l.A[field] && l.B[field]);
  const fire = vote('fire');
  const overheat = vote('overheat') || fire;
  const fa = input.fireWarnAcknowledged ?? false;
  const ca = input.masterCautionAcknowledged ?? false;
  return {
    sensorStatus: detectorFault ? 'FAULT' : silentlyDegraded ? 'DEGRADED' : 'VALID',
    operational, activeLoops: healthy, silentlyDegraded, detectorFault,
    overheatDetected: overheat, fireDetected: fire,
    alerts: {
      engOverheat: overheat,
      ovhtDet: overheat,
      masterCaution: overheat && !ca,
      engFireSwitch: fire,
      masterFireWarn: fire && !fa,
      fireBell: fire && !fa
    },
    reason: detectorFault ? 'SELECTED_DETECTORS_INOPERATIVE' :
      silentlyDegraded ? 'ONE_LOOP_AUTOMATICALLY_ISOLATED' : 'NOMINAL'
  };
}

module.exports = { evaluateEngineFireDetection };
