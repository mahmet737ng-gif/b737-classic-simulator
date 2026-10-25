# B737 Classic — Stage 7 (Cold & Dark) and Stage 8 (ISM instrument signals)
**Airframe:** B737-33V EP-FSI
**Date:** 2026-10-25
**Branch:** `main`
**Status:** Read-only functional runtime integrated in Unified; production needle motion remains gated by unapproved stage 3–6 image geometry and missing per-instrument electrical bus mapping.

## Stage 7 physical initial state

- Refactored physical initial-condition evaluation around explicitly qualified signal channels, independent of photo angle and UI "zero."
- The 54-face inventory covers **62 independent channels**. No unpowered electrical meter is assigned a universal zero bearing or drive command.
- Cabin altitude and differential pressure are separate on OH19: differential pressure is zero *only when pressure equalization is confirmed*; cabin altitude uses the known airport elevation only when equalization is confirmed. Tested 66 ft (Ahwaz), 3,260 ft (Mashhad) and 3,963 ft (Mehrabad).
- Fuel quantity persists from actual stored tank mass; crew oxygen and hydraulic accumulator pressure remain unknown unless individually measured; APU/engine temperature is not reset to 0°C.
- Engine shutdown is assessed per engine, not as one global running flag. A running engine 2 is not zeroed because engine 1 has stopped.
- Airspeed below displayed scale minimum is a low-stop physical state, not an invented angle; altimeter requires QNH confirmation for field-elevation indicated altitude.
- Stable cabin vertical speed and empty duct pressure zero only with supporting environmental observations. Clock, navigation needles, selector-dependent instrumentation and unknown window identity are not reset to a fake zero.
- Device-specific power supply is a **tristate** `true/false/unknown` and requires an explicitly verified per-instrument equipment feed. Broad DC/AC bus "ON" is not enough to claim that a particular gauge is powered.
- CPCS and DCPCS remain strictly selectable independently. The selected pressurization pressure plant is a **provisional trainer model**, never a certified pressure source, and no pressure is fabricated from bleed/pack state.

## Stage 8 signal contracts and Unified wiring

- `stage8-signal-contracts-v1.json` declares 54 faces, 62 channel IDs, paths, provider, unit, provenance and unknown LRU feeds.
- **23 channels** are mapped to existing ECU or selected cabin-plant model outputs as **TRAINING_SIMULATION_ONLY**; the others remain unknown pending actual subsystem/provider outputs.
- Per-engine data includes N1, N2, EGT, Fuel Flow (kg/h), Oil Pressure and Temperature, and hydraulic pressures. ISN fuel storage outputs tank *mass in kg*, not the fuel-gauge face "%" calibration; no forbidden conversion to a live pointer.
- Airspeed is a training IAS source; without actual static instrument and QNH calibration, altimeter readout is not synthesized from pressure altitude.
- Source provenance and units are checked. A present explicit observed sensor with `valid:false` blocks fallback to a training surrogate. Invalid/absent samples never default to zero.
- Added a read-only monitor to the actual Unified HTML, listening for the existing `b737:unified-ecu-observation` event and the existing `b737:pressurization-state` / `b737:ground-airfield-changed` events. This uses selected CPCS/DCPCS plant output only, without mixing their internal state.
- The monitor is exposed as `window.B737UnifiedInstrumentSignalsV1` with `getSignals()`, `getColdDarkState()`, `getPointerSignals()`, `getStatus()`, `setExplicitContext()`, `setValidatedObservations()`, and `setPointerSelectors()`. Setter methods update **read-only snapshots**, not aircraft controls, sprites or needles.
- The stage8 pointer routing registry names all **38** existing logical pointer sprites. **34** have structurally unambiguous candidate channel routes, but these are NOT approvals. Two VMO pointers need distinct VMO/MMO computation; two GEN DRIVE OIL pointers need confirmed RISE/IN selector choices. Geometry and bus power remain blocked for all.

## QA evidence

- [Successful Stage 7+8 continuous integration — 15 tests passed](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40225363544)
- Automated tests cover ECU N1/N2 differentiation, parked altitude baseline, pressure separation, per-gauge bus unknown, invalid observations, temperature/fuel/oxygen retention, selector gating, and real Unified read-only event smoke testing.
- Original immutable Overhead assets check passed.
- `liveNeedleAuthorized=false` for every signal and pointer. No needle angle, image, sprite, baseline position or system dynamics was overwritten.

## Incomplete and deliberately not faked

1. The full EP-FSI device-level wiring diagram (actual feeder/circuit breaker per gauge) is still not verified; no bus-to-LRU entitlement is inferred.
2. Remaining model providers — oxygen PSI, AC/DC meter selector readings, fuel temperature, navigation bearings, physical flaps/trim, real duct sensors, clocks, and other indicated values — require validated signals.
3. Stage 3–6 exact major/minor tick, shaft pivot and owner needle tip fit remain incomplete (0 fully approved faces). Therefore **no stage 7/8 display calibration is marked release-ready**.
4. CPCS and DCPCS currently share the selected provisional physical plant without turning that simulator estimate into a real-flight sensor.
5. Operational flight use is not supported.

## Committed files

- `engine/instruments/stage7-cold-dark-state-v1.js`
- `engine/instruments/stage8-signal-contracts-v1.json`
- `engine/instruments/stage8-ism-signal-bridge-v1.js`
- `engine/instruments/stage8-pointer-routing-v1.json`
- `engine/instruments/stage8-pointer-routing-v1.js`
- `panel-mosaic-lab/cockpit/stage78-readonly-unified.js` and `panel-mosaic-lab/cockpit/index.html`
- `engine/instruments/stage7-stage8.test.cjs`
- `engine/instruments/stage78-unified-integration.test.cjs`
- `.github/workflows/gauge-stage78-qa.yml`

**Milestone wording:** Implemented and integrated read-only stage7–8 infrastructure, tested. Full aircraft-system-to-needle **operational connection not yet approved**.
