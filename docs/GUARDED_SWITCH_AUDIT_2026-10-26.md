> **Scope update, 2026-10-26:** The 12 entries below were the *installed* live interactive guard registry, **not all Classic cockpit guarded controls**. The expanded Phase 1–2 audit identifies **17** flight-deck guarded/protected controls in the available FCOM (12 installed + 5 missing): [FCOM / visual audit](GUARDED_SWITCH_PHASE1_PHASE2_AUDIT_2026-10-26.md) and [machine registry](../engine/maps/guarded-switches-fcom-visual-audit-v1.json). Six internal hinge contradictions are NOT real-hardware hinge confirmation.

# 737 Classic — Guarded Switch Audit (2026-10-26)
**Status: PARTIALLY CORRECTED / NOT PIXEL-OR-HARDWARE APPROVED**

## Ground truth and limits
- Aircraft: B737-300/-400/-500 Classic, owner Sepehran FCOM D6-27370-300/400/500-SHI.
- Screens: two owner-provided 1920×1080 screenshots of the Unified Cockpit at 161% zoom, second annotated with three red guard-aperture rectangles.
- Reference: FCOM `Controls and Indicators` identifies control names, detents and guarded positions; it **does not by itself** establish hinge side, exact millimetre dimensions or all guard colors. Hardware photographs and precise reference pixels must resolve these independently.
- Preservation: `panel-mosaic-lab/all-overhead/` and all approved/locked bitmap assets **must not change** (see root `AGENTS.md`); changes live exclusively in interactive overlays.
- The OH11 aperture coordinates below are **approximate source-image coordinates inferred from the owner's markup**. They are not independently calibrated mechanical measurements or proof of visual accuracy in browser.

## Twelve-entry live guarded-control inventory
| Live registry id | Panel | Color currently used | Detents (order in code) | FCOM guarded/normal detent | Hinge evidence | Audit state |
|---|---|---|---|---|---|---|
| `flight-control-a` | OH07 | black | STBY RUD / OFF / ON | ON (9.10.1) | Registry FCOM layout says TOP, live asset BOTTOM | **FAIL**: geometry and hinge conflict |
| `flight-control-b` | OH07 | black | STBY RUD / OFF / ON | ON (9.10.1) | Same conflict | **FAIL** |
| `spoiler-a` | OH07 | black | OFF / ON | ON (9.10.2) | Same conflict | **FAIL** |
| `spoiler-b` | OH07 | black | OFF / ON | ON (9.10.2) | Same conflict | **FAIL** |
| `alternate-flaps-master` | OH07 | red | OFF / ARM | OFF (9.10.2–3) | TOP in flight-controls registry, BOTTOM in overlay asset | **FAIL** |
| `battery-master` | OH10 | black | OFF / ON | ON (6.10.5) | Not source-photo-validated | **PENDING** |
| `generator-disconnect-1` | OH11 | red | NORMAL / DISCONNECT | Guarded and safetied, must not reconnect in flight (6.10.6) | Not photo-validated; overlay currently bottom-hinge asset | **PARTIAL**: outer recess coordinates mapped |
| `generator-disconnect-2` | OH11 | red | NORMAL / DISCONNECT | Same (6.10.6) | Not photo-validated | **PARTIAL** |
| `standby-power` | OH11 | black | BAT / OFF / AUTO | AUTO (6.10.7) | Actual hinge unresolved; do not infer from rotated bitmap | **PARTIAL**: horizontal display added; mechanical hinge pending |
| `emergency-exit-lights` | OH14 | black | OFF / ARMED / ON | ARMED (1.40.5) | TOP in flight-controls registry, BOTTOM in overlay asset | **FAIL** |
| `passenger-oxygen` | UPPER | red | NORMAL / ON | Confirm against oxygen chapter before safety sign-off | Not independently validated | **PENDING** |
| `flight-recorder-test` | UPPER | black | TEST / NORMAL | NORMAL (10.10.20) | LEFT hinge, right free edge swings LEFT, per owner reference | **PARTIAL**: custom CSS exists; live visual QA pending |

### OH11 geometrical calibration
Each panel rectangle is `[x, y, width, height]` in native OH11 image pixels (`sourceDimensions=[1203,1308]`). Frozen atlas placement: x=500, y=1703, w=496, h=545.
| Control | Native OH11 aperture | Approx target at screenshot's 161% display scale | Source center error |
|---|---|---|---|
| GEN 1 DISCONNECT | [154,334,200,418] | 132.76×280.41 px | (0.17, 0.18) px |
| GEN 2 DISCONNECT | [847,334,200,418] | 132.76×280.41 px | (0.24, 0.18) px |
| STANDBY POWER | [391,232,421,184] | 279.46×123.43 px | (0, 0.38) px |

Independent geometry validation passes 1/2/3: **PASS** each time. Tested original plate bounds, center registration, separate native X/Y transforms, and non-overlapping aperture rectangles. These tests verify *coordinate mathematics only*, not live browser appearance and not 0% physical-geometry error.

## Root-cause analysis
1. Generic `bezelSourceDiameter` scales all approved 261×359-ish guard artwork uniformly even when mounting recesses have very different aspect ratios. Such artwork is **never** to be stretched independently on X and Y to cover a wider opening.
2. STANDBY POWER is horizontal, with distinct BAT/OFF/AUTO detents. Previous `rotation:-90` on a narrow vertical image is not sufficient to reproduce its switch guard and recess proportions.
3. Physical hinge location and guard sweep are independent of toggle-axis orientation. The guard and underlying lever require independent hitboxes, z-order, pivot and motion.
4. The flight-control registry records top hinges on 5 guards while the currently installed source sprites are bottom-hinged; no source-backed reconciliation exists.
5. Existing `closePolicy.force` implementations for some controls are a SIMULATOR INFERENCE from their FCOM protected detents, not FCOM proof that closing the cover mechanically forces lever motion.
6. Current 12 guards comprise the 10 primary registry guards plus 2 additional controls in `lights-controls.json`; checks over the primary ten alone are **not** a complete cockpit audit.

## Changes applied, limited to the interactive layer
- `rotary-guards.json`: three independent OH11 native-image recess rectangles; modified STANDBY POWER presentation to horizontal instead of rotating the vertical PNG.
- `rotary-guards.js`: source-to-atlas mapping of aperture corners; separate housing for calibrated controls; separate guard/lever hit geometry for horizontal STANDBY POWER.
- `rotary-guards.css`: photo-informed standalone housing layers with separate wide standby representation; not final hardware-approved graphics.
- `rotary-guards-model.js`: rejects invalid/out-of-bounds or off-center aperture data.
- `rotary-guards.test.cjs`: three-pass OH11 coordinate mapping, non-overlap and renderer-presence checks.

## Release gates — all are required
- [x] No change to frozen/locked overhead mosaic or approved sprite bytes in above commits.
- [x] All three OH11 rectangles mapped/centered and arithmetic validated in three consecutive independent passes.
- [x] GitHub Actions: Interactive overhead toggle QA passed at e9b4361 (includes updated three-pass tests); Panel Mosaic Atlas QA passed at e9b4361; deployment at 4e19d6a succeeded, including FINAL overhead lock, interactive overhead controls, and Unified cockpit checks. This verifies the CI suites those workflows execute; it is not evidence that every possible integration test was run.
- [ ] Capture real browser screenshots at 100%, 161%, 200% and landscape/portrait; compare native opening outlines, lever centers, text collisions and guard frame across closed/open states.
- [ ] For each of 12 guards, photo-confirm hinge side, vertical/horizontal sweep, cover shape, mounting footprint, detents, guarded detent, material and color.
- [ ] Replace mechanically incorrect source sprites with separate *versioned* correct hardware-approved assets, not modifications of locked originals.
- [ ] Verify state-machine transitions: closed blocks switching; open permits all legal detents; special single-use disconnect / oxygen safety behaviors; simultaneous noninterference of neighbors.
- [ ] Run regression in 737-300, -400 and -500 profiles and CPCS/DCPCS configurations.
- [ ] Only mark FINISHED after all visual and functional gates pass. Mathematical three-pass reproducibility does **not** establish 0% accuracy.

## Confirmed GitHub Actions evidence
- Interactive overhead toggle QA — PASS: https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40337626224
- Panel Mosaic Atlas QA — PASS: https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40337626156
- GitHub Pages deployment — PASS at audit-document commit: https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40338677388
- The successful deploy workflow explicitly passed `Enforce FINAL overhead UPD-0012 lock`, `Verify interactive overhead lights and controls`, `Verify unified cockpit assembly`, and `Run actions/deploy-pages@v4`.
- **Browser photorealism, measured true hinge geometry, interaction-state screenshots and hardware validation are still UNVERIFIED.**

## High-priority operator observations
- The two owner's marked GEN DRIVE DISCONNECT openings are **narrow and tall**; the red guard *lid itself* occupies only part of each recess. Do not overscale the lid merely to fill the outer black backplate.
- The marked STANDBY POWER opening is **wide and low**; use a dedicated horizontal face rather than stretched, rotated standard vertical guard.
- FLIGHT RECORDER on UPPER must have the **LEFT-side vertical hinge**, with the free/right edge opening to the left (owner-provided photographic direction), and the TEST/NORMAL two-position lever below.
- Physical dimensions in millimetres and unpictured switch hinge directions remain UNKNOWN: do not fabricate them.

**Verdict:** Whole set **FAIL** for final photographic authenticity; OH11 three aperture registrations **PASS** for geometry only. All remaining unknowns stay explicitly open.
