# B737 Classic EP-FSI — Stage 9 Motion / Stage 10 Unified Integration

**Checkpoint:** 2026-10-25 — `main`  
**Status:** Motion and runtime observation pipeline implemented, tested, and loaded in Unified. No owner-locked analogue pointer artwork, image, initial angle or operational actuator has been overwritten. **Not yet certified for live physical needle animation.**

## Stage 9 — physical response engine

`engine/instruments/stage9-needle-dynamics-v1.js` supplies a deterministic model for any instrument pointer with a source-proven scale:

- direct target application;
- maximum angular velocity (slew), CW and CCW;
- first-order lag with a physical response time constant;
- numerically bounded second-order damping (up to 8ms substeps), including velocity and mechanical stops;
- engine reset/initialisation with an explicitly known starting position;
- separation of valid sensor value, age/freshness, electrical feed qualification, and fault state;
- sensor unavailable, inconsistent sensor, jam, stale sample and power-loss states;
- **hold last physical position**, never fabricate an angle-zero/off-scale rest without LRU evidence; explicitly configured invalidation is also available;
- hard clamps at the declared source scale end stops. Never extrapolate beyond unapproved markings.

All coefficients are **TRAINING / QA ONLY**. `engine/instruments/stage9-dynamics-registry-v1.json` separately records every one of the **38** known owner pointer identities: **8** provisional response profiles and **30** blocked due to missing source-calibrated mechanical/scale information. There are **0** certified instrument-specific response models.

Known source-level limitations: bus/circuit-breaker feeds, mechanical rest spring behaviour, instrument damping constants and certified sensor time response for the EP-FSI equipment are not established.

## Stage 10 — operational path integration in Unified

A source-isolated **read-only** instrument workbench has been added:

1. Existing `b737:unified-ecu-observation` and `b737:pressurization-state` messages and original ground context feed the existing Stage 7/8 bridge.
2. Stage 8 exposes 54 faces, 62 signal channels and 38 pointer routes. Invalid/non-existent data never converts to zero, and source provenance/units remain visible.
3. Stage 5 candidate numerical tick data is read from the compact, immutable-source traceable `stage10-preview-scale-subset-v1.json`.
4. Stage 9 motion is evaluated by `stage10-needle-workbench-v1.js`, using the versioned per-pointer response policy and a QA-only power assumption explicitly shown as such.
5. Unified `panel-mosaic-lab/cockpit/stage78-readonly-unified.js` exposes:
   - `window.B737UnifiedInstrumentSignalsV1.getMotionPreview()`
   - `getSignals()`, `getPointerSignals()`, `getColdDarkState()`, `getStatus()`
   - a new inspector indicator showing the number of provisional motion models.
6. **No call** to any existing `setAngle`, `setValues`, sprite transform, pointer element or owner-approved bitmap is executed by Stage 9/10. Real pointer activation remains gated until fully reviewed geometry, electrical feed and mechanical response have been approved.

**54 registered gauge faces** are tracked throughout the signal registry. **38** actual, separately identifiable owner sprites have signal routes; **8** can calculate *provisional* angular motion from currently available Stage 5 reference anchors, namely Fuel Temperature, DC AMPS, CPS, OH19 inner CAB ALT, OH19 outer differential pressure, Cabin Temperature and the two Duct Pressure needles. The other **30** sprites remain blocked for source-driven angular preview. Some of the eight still lack live source values; their preview remains unavailable until an explicit qualified reading is present.

### Important source correction made during integration

Stage 10 tests caught a cumulative signed-angle unwrapping bug in Stage 5 for Differential Pressure (crossing +180°). Fixed the original Stage 5 interpolation algorithm to use **the previous unwrapped bearing** rather than the previous raw bearing. This preserves continuous monotonic motion between marks 6–10 psi.

### QA evidence

[Successful Stage 9/10 integration and regressions — run 40226699892](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40226699892)

- Stage 9/10 response QA: 12/12 tests passed.
- Stage 5/6 numerical/interpolation and actual Unified script event smoke test: 13/13 passed.
- Stage 7/8 physical initial state and bus/source quality checks: 11/11 passed.
- Original Overhead source image hash and locked-asset check: passed.

**Total: 36/36 automated tests passed for this gated milestone.** This is a coding/integration milestone, **not** a flight simulator calibration signoff.

## Remaining for truly operational analog needles

- Finish and manually certify all native-pixel major/minor tick positions and actual shaft centers in Stage 3/4.
- Certify numeric values, units, all scale interpretations and sprite tip reach in Stage 5/6 (still 0/54 complete).
- Validate the individual instrument feed wiring and failure response against the aircraft technical references, including RISE/IN selection and VMO input.
- Once dependencies are signed off, add a separate, explicitly gated owner-approved production rendering adapter, calibrate every remaining pointer, and run all cold/dark, startup, cruise and failure scene flight tests in Stage 11 before Stage 12 release.

### Relevant files

- `engine/instruments/stage9-needle-dynamics-v1.js`
- `engine/instruments/stage9-dynamics-registry-v1.json`
- `engine/instruments/stage10-needle-workbench-v1.js`
- `engine/instruments/stage10-preview-scale-subset-v1.json`
- `engine/instruments/stage9-stage10.test.cjs`
- `engine/instruments/stage5-scale-mapping-v1.js` (unwrapped-angle fix)
- `panel-mosaic-lab/cockpit/stage78-readonly-unified.js`
- `panel-mosaic-lab/cockpit/index.html`
- `.github/workflows/gauge-stage910-qa.yml`
