/* B737 Classic Audio Warning Engine — logic prototype v0.1
 * Training simulator only. Audible timbres are placeholders, not aircraft recordings.
 * Grounded in owner-provided Sepehran 737-300/400/500 FCOM Ch 15.
 * All measurements in ft/kt; thrust lever angles in approximate degrees.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.B737WarningEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const RADIO_CALLOUTS = [2500, 1000, 500, 100, 50, 40, 30, 20, 10];
  const GPWS = new Set([
    "PULL UP", "SINK RATE", "TERRAIN", "TERRAIN AHEAD",
    "CAUTION TERRAIN", "DON'T SINK", "TOO LOW GEAR",
    "TOO LOW FLAPS", "TOO LOW TERRAIN", "GLIDESLOPE",
    "WINDSHEAR", "BANK ANGLE"
  ]);
  const AUDIO = Object.freeze({
    altitude: { asset: "altitude-tone", group: "tone", priority: 35 },
    intermittentHorn: { asset: "intermittent-horn", group: "alarm", priority: 70 },
    gearHorn: { asset: "landing-gear-horn", group: "alarm", priority: 65 },
    fireBell: { asset: "fire-bell", group: "alarm", priority: 95 },
    overspeed: { asset: "overspeed-clacker", group: "alarm", priority: 82 },
    shaker: { asset: "stick-shaker", group: "alarm", priority: 86 },
    apDisconnect: { asset: "autopilot-disconnect", group: "tone", priority: 55 },
    atDisconnect: { asset: "autothrottle-disconnect", group: "tone", priority: 40 },
    gpws: { asset: "egpws-voice", group: "voice", priority: 100 },
    tcas: { asset: "tcas-voice", group: "voice", priority: 80 },
    radioAltitude: { asset: "radio-altitude-voice", group: "voice", priority: 15 },
    minimums: { asset: "minimums-voice", group: "voice", priority: 30 }
  });
  const finite = (v) => typeof v === "number" && Number.isFinite(v);
  const truth = (v) => v === true;
  const normalize = (s) => typeof s === "string" ? s.trim().toUpperCase() : "";

  class WarningEngine {
    constructor(options) {
      const opt = options || {};
      this.variant = opt.variant || "737-300";
      this.takeoffFlapMinimum = this.variant === "737-500" ? 5 : this.variant === "737-300" ? 1 : null;
      this.reset();
    }
    reset() {
      this.previous = null;
      this.cabinCutout = false;
      this.gearCutout = false;
      this.fireAcknowledged = false;
      this.altitudeDeviationArmed = false;
      this.deviationActive = false;
      this.bankTriggered = new Set();
      this.radioCalled = new Set();
    }
    cutoutCabin() { this.cabinCutout = true; }
    cutoutGear() { if (this.lastGearCutoutEligible) this.gearCutout = true; }
    acknowledgeFire() { this.fireAcknowledged = true; }

    update(input) {
      const s = { ...input };
      const p = this.previous;
      const events = [];
      const active = [];
      const lamps = {};
      const push = (id, message) => events.push({ id, message: message || id, ...AUDIO[id] });
      const flag = (id) => active.push({ id, ...AUDIO[id] });
      const gearDown = truth(s.gearDownLocked);
      const ground = truth(s.onGround);
      const flap = finite(s.flaps) ? s.flaps : 0;
      const lever1 = finite(s.thrustLever1Angle) ? s.thrustLever1Angle : 45;
      const lever2 = finite(s.thrustLever2Angle) ? s.thrustLever2Angle : 45;

      // Cabin altitude uses exactly the same audible intermittent horn as T/O configuration.
      const cabinHigh = finite(s.cabinAltitudeFt) && s.cabinAltitudeFt > 10000;
      if (!cabinHigh) this.cabinCutout = false;
      lamps.cabinAltitude = cabinHigh;

      // Takeoff configuration evaluation is only valid with actual discrete inputs.
      // 737-400 flap-minimum remains configuration-dependent until its variant documentation is verified.
      const tcfg = this.takeoffFlapMinimum !== null &&
        [s.leadingEdgeTakeoff, s.speedbrakeDown, s.parkingBrakeSet, s.stabilizerTrimTakeoff].every(v => typeof v === "boolean");
      const min = this.takeoffFlapMinimum;
      const badConfig = tcfg && (
        flap < min || flap > 15 || !s.leadingEdgeTakeoff ||
        !s.speedbrakeDown || s.parkingBrakeSet || !s.stabilizerTrimTakeoff
      );
      const takeoffConfig = ground && truth(s.takeoffThrust) && badConfig;
      lamps.takeoffConfig = takeoffConfig;
      if ((cabinHigh && !this.cabinCutout) || takeoffConfig) flag("intermittentHorn");

      // Landing gear horn from FCOM 15.20.5-6; different silencing rules by flap setting.
      let gearAlert = false;
      let cutoutEligible = false;
      if (!ground && !gearDown) {
        if (flap >= 1 && flap <= 10 && (lever1 <= 10 || lever2 <= 10)) {
          gearAlert = true; cutoutEligible = true;
        } else if (flap === 15) {
          const asymmetric = finite(s.radioAltitudeFt) && s.radioAltitudeFt < 1000 &&
            ((lever1 <= 10 && lever2 > 30) || (lever2 <= 10 && lever1 > 30));
          const bothLow = lever1 < 30 && lever2 < 30;
          gearAlert = asymmetric || bothLow;
          cutoutEligible = asymmetric && !bothLow;
        } else if (flap > 15) gearAlert = true;
      }
      if (!gearAlert || !cutoutEligible) this.gearCutout = false;
      this.lastGearCutoutEligible = cutoutEligible;
      lamps.gearUnsafe = gearAlert;
      if (gearAlert && !(cutoutEligible && this.gearCutout)) flag("gearHorn");

      // Each separate fire condition can re-arm master FIRE WARN after previous cutout.
      const fireKeys = ["engine1Fire", "engine2Fire", "apuFire", "wheelWellFire", "cargoFire"];
      const fireNow = fireKeys.filter(k => truth(s[k]));
      const fireBefore = p ? fireKeys.filter(k => truth(p[k])) : [];
      if (fireNow.some(k => !fireBefore.includes(k))) this.fireAcknowledged = false;
      if (!fireNow.length) this.fireAcknowledged = false;
      lamps.fireWarn = fireNow.length > 0 && !this.fireAcknowledged;
      if (lamps.fireWarn) flag("fireBell");
      // External APU fire horn is not mixed into cockpit sound.
      lamps.remoteApuFireHorn = truth(s.apuFire) && ground && !this.fireAcknowledged;

      // Vmo/Mmo are model/condition inputs; no guessed constants.
      const overspeed = (finite(s.iasKt) && finite(s.vmoKt) && s.iasKt > s.vmoKt) ||
        (finite(s.mach) && finite(s.mmo) && s.mach > s.mmo);
      if (overspeed) flag("overspeed");
      if (!ground && truth(s.stallWarning)) flag("shaker");

      // Altitude capture/deviation. Both alerts inhibited at flaps >= 25 or G/S capture.
      const altValid = finite(s.pressureAltitudeFt) && finite(s.selectedAltitudeFt);
      const altInhibit = flap >= 25 || truth(s.glideslopeCaptured);
      const d = altValid ? Math.abs(s.pressureAltitudeFt - s.selectedAltitudeFt) : Infinity;
      const pd = p && finite(p.pressureAltitudeFt) && finite(p.selectedAltitudeFt)
        ? Math.abs(p.pressureAltitudeFt - p.selectedAltitudeFt) : Infinity;
      const selectedChanged = !!p && s.selectedAltitudeFt !== p.selectedAltitudeFt;
      if (selectedChanged || altInhibit) {
        this.altitudeDeviationArmed = false;
        this.deviationActive = false;
      }
      if (!altInhibit && altValid) {
        if (p && !selectedChanged && pd > 900 && d <= 900 && d > 300) push("altitude", "ALTITUDE ACQUISITION");
        if (d <= 300) { this.altitudeDeviationArmed = true; this.deviationActive = false; }
        if (this.altitudeDeviationArmed && !this.deviationActive && d > 300 && d <= 900) {
          this.deviationActive = true;
          push("altitude", "ALTITUDE DEVIATION");
        }
        if (d > 900) { this.altitudeDeviationArmed = false; this.deviationActive = false; }
      }
      lamps.altitudeSteady = !altInhibit && altValid && d <= 900 && d > 300 && !this.deviationActive;
      lamps.altitudeFlashing = !altInhibit && this.deviationActive;

      // External GPWS/TCAS systems supply their evaluated alert, not invented terrain logic.
      const gpws = normalize(s.egpwsMessage);
      const tcas = normalize(s.tcasMessage);
      if (gpws && GPWS.has(gpws) && (!p || gpws !== normalize(p.egpwsMessage))) push("gpws", gpws);
      if (tcas && (!p || tcas !== normalize(p.tcasMessage))) push("tcas", tcas);
      if (p && truth(p.autopilotEngaged) && s.autopilotEngaged === false) push("apDisconnect");
      if (p && truth(p.autothrottleEngaged) && s.autothrottleEngaged === false) push("atDisconnect");

      // Altitude callouts require a prior valid sample and a downward crossing.
      const ra = s.radioAltitudeFt;
      const pra = p && p.radioAltitudeFt;
      if (!finite(ra) || !finite(pra) || ra > pra + 50 || ground) this.radioCalled.clear();
      if (truth(s.approachActive) && !ground && finite(ra) && finite(pra) && ra < pra) {
        for (const threshold of RADIO_CALLOUTS) {
          if (pra > threshold && ra <= threshold && !this.radioCalled.has(threshold)) {
            this.radioCalled.add(threshold);
            push("radioAltitude", threshold === 2500 ? "TWO THOUSAND FIVE HUNDRED" :
              threshold === 1000 ? "ONE THOUSAND" : String(threshold));
          }
        }
      }
      const dh = s.minimumsRadioFt;
      if (truth(s.approachActive) && !ground && finite(dh) && finite(ra) && finite(pra) && ra < pra) {
        if (pra > dh + 80 && ra <= dh + 80) push("minimums", "APPROACHING MINIMUMS");
        if (pra > dh && ra <= dh) push("minimums", "MINIMUMS");
      }

      const bank = Math.abs(s.bankAngleDeg || 0);
      if (bank <= 30) this.bankTriggered.clear();
      for (const n of [35, 40, 45]) {
        if (bank > n && !this.bankTriggered.has(n)) {
          this.bankTriggered.add(n);
          push("gpws", "BANK ANGLE");
        }
      }
      this.previous = s;
      return { active, events, lamps, status: { takeoffConfigEvaluated: tcfg, altitudeInhibited: altInhibit } };
    }
  }
  return { WarningEngine, AUDIO, RADIO_CALLOUTS };
});
