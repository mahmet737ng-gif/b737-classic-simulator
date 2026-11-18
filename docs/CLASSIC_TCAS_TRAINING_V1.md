> Superseded for active Unified behavior by [CLASSIC_TCAS_TRAINING_V2.md](CLASSIC_TCAS_TRAINING_V2.md). This file describes the prior timed prototype.

# Classic TCAS II 7.1 instructor encounters

This release adds an explicitly scripted TCAS trainer to Unified FLT PHASE. It does not implement RTCA DO-185B surveillance, interrogation, Mode S coordination, threat tracking, horizontal miss-distance filtering or a certified collision avoidance computer. The displayed encounter stages and their changes are instructor authored, rather than calculated predictions of a real aircraft collision. The current flight scenario supplies MSL altitude; unless a separate `pressureAltitudeFt` is supplied, it is explicitly used as a pressure-altitude surrogate (`altitudeSource: SCENARIO_MSL_SURROGATE`). No QNH-to-standard conversion or real TCAS pressure source is claimed. The warning-time table is reference data and controls the nominal TA-to-RA interval of the scripts; it is not the full CAS algorithm.

## Sources and effectivity

- Owner's SEPEHRAN AIRLINES 737CL FCOM, D6-27370-300/400/500-SHI: 10.30.12–13 (PDF 1332–1333, red avoid pitch cue); 10.32.29–34 (PDF 1386–1391, traffic symbols, altitude/trend, no-bearing, offscale, status colors); 15.20.29–32 (PDF 1933–1936, traffic classification, inhibits and 7.1 callouts). FSI is included in the EHSI-display effectivity in 15.20.29. PDF pages were read and pitch-cue figures visually inspected.
- EUROCONTROL ACAS Guide edition 5.0 (April 2025), sections 5.4–5.7, 6–8 and tables 15–16: https://www.eurocontrol.int/sites/default/files/2025-09/eurocontrol-safety-acas-guide-5-0.pdf . This supplies supporting 7.1 RA progression, initial/subsequent restrictions and altitude-dependent nominal thresholds.
- Owner-supplied screenshot: EADI red TRAFFIC placement and two-sided pitch restriction presentation. This annotation is retained as an owner-requested visual reference; the Classic FCOM pitch illustration itself documents the avoid cue rather than this text placement.

## Available encounter families

| Encounter | Scripted reason / progression |
|---|---|
| TA only | Passing traffic remains an advisory, no RA |
| Climb / descend | TA progresses to initial vertical separation RA, then weakening level-off |
| Increase climb / descent | Initial RA is insufficient; the script strengthens the same sense |
| Climb / descend reversal | Initial sense is defeated by an intruder maneuver; the subsequent RA changes direction with NOW |
| Crossing climb / descend | Avoidance crosses the intruder's altitude; crossing wording is used |
| Level off from climb / descent | Reduce vertical rate to zero, rather than continue toward the conflict |
| Preventive monitor | Do not enter the prohibited climb or descent region |
| Maintain / crossing maintain | Existing rate must already be at least 1500 fpm in the commanded sense; otherwise use initial climb/descend wording |
| Multiple threats | Authored level-off corridor with two avoid pitch boundaries and two RA targets |
| No bearing | RA/TA range, relative altitude and trend appear as text; no invented bearing |
| Offscale | Target lies beyond the usual range; OFFSCALE appears only with TFC selected |
| No altitude | No altitude label, trend or RA; TA suppressed at/above FL155 |

Scripts begin with other traffic, then TA. A nominal altitude-dependent TA interval precedes the initial RA; subsequent changes occur seven seconds later. Instructor-defined completion removes RA guidance and generates CLEAR OF CONFLICT only if an RA actually occurred. Completion is timed, not a claim of computed separation. PAUSE follows the existing flight time; NEXT EVENT advances only the encounter. CLEAR ENCOUNTER does not stop the flight telemetry.

## Inhibits and display contract

- Below nominal 1000 ft radio altitude: TA ONLY, no RA. DESCEND below 1100 ft is inhibited; INCREASE DESCENT below 1500 ft retains the permitted initial descent RA. Values are approximate installed-system boundaries, without reproducing manufacturer hysteresis.
- Voices are suppressed below nominal 500 ft RA. The instructor GPWS/WINDSHEAR inhibit suppresses advisory guidance and voice. Actual aircraft GPWS inputs are not asserted by this new trainer; the priority control is an explicit instructor input.
- No airborne valid flight/radio-height/attitude/vertical-speed source: no guidance. A stale flight publisher withdraws TCAS guidance. Existing EFIS electrical power, SG, attitude and navigation validity remain authoritative.
- EADI: bank/pitch-card-referenced red trapezoid with edge hatching marks attitudes to avoid. Pitch boundaries are a labeled training conversion of vertical rate and TAS using observed pitch/flight-path angle, not a certified TCAS pitch algorithm. No green fly-to director or AP/FD coupling is added.
- EHSI: red solid RA square, amber solid TA circle, white solid proximate diamond, white outline other diamond; altitude in hundreds of feet, trend arrow at absolute rate >=500 fpm. Supported traffic formats: MAP, CTR MAP, EXP NAV, EXP VOR/ILS. TRAFFIC remains in all modes even with TFC off. TA ONLY green, TEST white, FAIL amber, OFF white follow FCOM 10.32.33.
- Training speech is optional, synthetic English, once per advisory change. Installed aircraft recordings are not claimed.
- FLT PHASE retains airport, runway, start location, flight targets, telemetry, takeoff, pause and stop controls. Only the redundant GROUND/AIRBORNE selector is removed. READY FOR TAKEOFF initializes ground; final/manual starts initialize airborne. Public loadScenario(config) retains explicit airborne input for existing integrations.

## Verification

`tests/classic-tcas-v1.test.cjs` covers all encounter families, subsequent-only changes, nominal inhibit boundaries, pitch sense/TAS conversion, source stop/pause, runtime mode changes, stale-source handling and removal of only the requested selector. `tests/classic-tcas-display-v1.test.cjs` exercises the real EHSI SVG and Unified EADI canvas path, TFC/mode behavior, colors, labels, no bearing, offscale and power suppression. Both run with Flight Scenario CI and the EFIS continuity regression added in the preceding fix.
