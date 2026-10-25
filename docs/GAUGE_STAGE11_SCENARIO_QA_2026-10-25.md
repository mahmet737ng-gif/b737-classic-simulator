# B737 Classic EP-FSI — Stage 11 source-to-needle integrated scenario QA
**Checkpoint:** 2026-10-25 · **Branch:** `main`
**Result:** **SCENARIO QA PASS / ANALOG NEEDLE RELEASE BLOCKED**
**Verified successful CI:** https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40228007355

## Scope actually completed

Executed real simulation-module source snapshots rather than constructing unrealistic angle-only animation:
- ECU `ISN-13–18 Testbench` actual startup and source values, in the explicitly accelerated `CLASSROOM_COMPRESSED` scenario coverage mode. Separate real-time ECU test preserves user-selected **85-second APU / 65-second nominal engine-start** training cycle.
- Sensor outputs pass through the **54-face/62-channel Stage8 bridge**, Stage8's **38 known sprite IDs**, the **7 previewable numeric scale modes** (8 logical pointers), and the Stage9 preview dynamics engine. Not a single production sprite is written.
- Ten stage11 scenario tests cover startup and engine-out distinction, equalised ground pressurisation at OIAW 66 ft / OIMM 3260 ft / OIII 3963 ft, independent differential and cabin altitude, two-engine flight, loss and recovery of source, mechanism jamming, unknown electrical equipment feed, no forced zero, and source-photo/regression lock protections.
- The scenario tool emitted **12 trace scenarios** with per-scene ECU quality, cabin and engine values, source route counts and release gating. JSON artifact archived by GitHub Actions as `stage11-needle-scenario-evidence-v1`.
- Cross-stage regressions and known ISN realtime/dynamics unit/e2e tests were run without changing their previously locked timing parameters, model equations or artwork.

## Verified test outcome

| Test family | Pass | Fail |
|---|---:|---:|
| Stage11 scenarios using actual ECU module and alternate ground pressure states | 10 | 0 |
| Stage11 all-face source/photo/release matrix | 3 | 0 |
| Stage5–10 numerical, read-only Unified adapter and dynamics regressions | 36 | 0 |
| Existing real-time ECU startup regression | pass | 0 |
| Existing dual-engine flight/oil/fault regression | pass | 0 |
| Immutable original Overhead asset validation | pass | 0 |

**49 Node test cases**, plus two preexisting standalone ECU regression scripts and the overhead immutable-source checker, all succeeded. This is a **software QA result** only, *not flight or actual instrument certification*.

## Review and release matrix

The source-linked `engine/instruments/stage11-acceptance-matrix-v1.json` has one row for each of **54** source instrument faces (49 rotary, 5 linear). Each row keeps native source reference, prior source-image inspection results, candidate pivot, potential source-vs-rim conflict, numerical scale readiness, associated sprite identities, ISM providers and individual blockers. Counts:

- **54 / 54** photo pixel and shaft-centre checks **not fully signed off**; 15 highest-priority, 14 medium, 25 normal queue.
- **6 faces / 7 numeric scale modes** can produce *preview-only* numeric rotation candidates; these are neither released nor pixel-certified.
- **38** logical pointer IDs, with 8 provisional response models and 30 missing complete scale/response calibration.
- **62** expected system channels; 23 are mapped to existing training-source providers, 39 remain unmapped. The 62 channels have **zero independently signed-off instrument electrical feed circuits**. A model's known value does not mean the equipment is correctly powered.
- **3** outer-first-officer source-image references (`fo.outer_altimeter`, `fo.outer_vertical_speed`, `fo.outer_clock`) have only an original `file_*.png` filename, not a *verified repository-relative original source location*. Such files remain blocked and should not be treated as accessible/final photo calibrations without source path reconciliation.
- Owner-approved RMI sprite shapes and other locked imagery were not edited or redrawn.
- **0/54 fully calibrated faces**, **0 live analogue-pointer releases**, **0 changes to the existing production display angles**.

## Specific regressions and physical correctness

One-engine START and fuel-flow tests distinguish a **sourced stopped-engine N2 of 0** from **missing engine2 fuel-flow observation (`null`)**; absent sensor data is never replaced with a synthetic zero. CAB ALT stays at field-elevation only under equalised pressure evidence. Outer differential pressure and inner cabin altitude remain separate pointer mappings. A test in QA preview mode explicitly exposes the synthetic-power bypass; default source-restricted mode blocks all unknown equipment feeds. The simulator's real-time timebase and physically validated needle inertia coefficients still need certification.

## Prioritised photo calibration blockers

High: `oh.elec.dc_amps`, `oh.elec.cps`, `oh.elec.dc_volts`, `oh.elec.ac_volts`, `oh.drive_oil.1`, `capt.airspeed`, `capt.rmi`, `capt.altimeter`, `capt.alt_ias_combined`, `capt.vertical_speed`, `capt.clock`, `eng.fuel_qty.center`, `eng.fuel_qty.1`, `fo.airspeed`, `ped.stab_trim.right`.

Before Stage12 flight-test release, manually sign exact pixel endpoints for all major/minor ticks and the *actual shaft*, assign source-backed values/modes to every scale, confirm needle-tip reach and failure positions, verify actual equipment wiring and render instrument-by-instrument screenshots/video + simulated flight maneuvers. No blanket "all gauges calibrated" claim can pass this acceptance matrix.

## Files

- `tests/stage11-needle-scenario-gate.test.cjs`
- `tests/stage11-acceptance-matrix.test.cjs`
- `engine/instruments/stage11-acceptance-matrix-v1.json`
- `.github/workflows/gauge-stage11-scenarios.yml`
- Stage11 evidence: GitHub Action `40228007355` → artifact `stage11-needle-scenario-evidence-v1`.

**Release gate status: BLOCKED.** This gate is intentional; code-level success is not a proxy for unseen pixel-approved geometry and equipment-specific physics.
