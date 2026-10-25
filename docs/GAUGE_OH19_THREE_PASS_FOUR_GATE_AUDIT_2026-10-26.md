# B737 Classic EP-FSI · OH19 Stage 13 — three four-gate validation passes
**Date:** 2026-10-26 · **Scope:** owner-locked OH19 Cabin Pressure / Cabin Altitude; only provisional Unified preview

## What changed in source
- `panel-mosaic-lab/cockpit/cabin-dual-needles-model.js`: independent `differentialPressurePreviewBearing(psid)` for PRESS/PSI, with 11 source-photo candidate printed major anchors (0–10). Sub-nanopsi IEEE754 endpoint noise is tolerated without permitting genuine beyond-scale values. `resolvePhysicalReadings` rejects missing/nonfinite inputs and marks *all* outputs unapproved.
- `panel-mosaic-lab/cockpit/cabin-dual-needles-unified.js`: both PRESS and CAB ALT preview pointers now respond to independent measurements from the **active** selected CPCS/DCPCS trainer; events from inactive installations are ignored; invalid/out-of-dial inputs retain last angle. Stacked order is frozen: **PRESS rear, CAB ALT front**, while PHOTO PRINTED rings remain **PRESS outer PSI / CAB ALT inner x1000 FT**.
- `panel-mosaic-lab/cockpit/index.html` scripts refreshed to `CDN-0004`.
- `engine/instruments/oh19-three-pass-integration.test.cjs`: twelve separate tests, three cycles of four gates. Each cycle mounts a fake-but-structural SVG in the Unified JS environment and verifies the actual blade CSS transform, not just stored angle.
- `engine/instruments/oh19-three-pass-pixel-qa-v1.py`: tests original locked photo's all 98 registered line sites at three different white-pixel thresholds.
- `engine/instruments/oh19-numeric-ambiguity-audit-v1.cjs`: lists the exact numeric brackets around each of **32 undetermined CAB ALT marks**, preserving null unknown values instead of copying older invented interpolations. Crosschecks the 11 PRESS major angles against an independent older registry.
- `tests/cabin-field-elevation-v1.test.cjs`: updates a stale source-text assertion to the new selected-system event handler.
- `.github/workflows/oh19-cab-alt-photo-qa.yml`: runs all of the above with original-photo hash, unchanged owner artwork, original sprite length scan and visual QA.

## Three full passes and their measured result

| Gate | Pass 1 OIAW, 66 ft | Pass 2 OIMM, 3260 ft | Pass 3 OIII, 3963 ft |
|---|---|---|---|
| 1 — photo geometry, layers, native source checksum | PASS | PASS | PASS |
| 2 — 32 unknown cabin altitude minor line values remain unapproved | PASS | PASS | PASS |
| 3 — independent 0–50k ft / 0–10 PSI continuous photo-preview maps and out-of-range guards | PASS | PASS | PASS |
| 4 — CPCS and DCPCS isolated session, correct field altitude, active-only event, true mounted SVG rotation | PASS | PASS | PASS |
| Native photo site detection at RGB light thresholds | 155: **47 inner + 51 outer** | 175: **47+51** | 195: **47+51** |

These are three validation passes on **one immutable source photo**, not three independent aircraft images. The checks are reproducible by CI and contain 12 pass-specific tests, plus existing ambient pressure/electrical pressure suite and native source image scans.

**Verified GitHub run:** https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40243344131
**Original photo annotations and machine-readable per-pass reports:** https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40243344131/artifacts/12618050910

A first CI exercise correctly caught an IEEE754 edge at PSI 10; a second identified a stale test expecting the old event source line. Both were fixed and then **all** three rounds and all legacy gate tests passed. No exceptions are suppressed in the final pipeline.

## Remaining source contradictions and limits

1. **32 CAB ALT mark values are NOT certified.** They are photo-visible strokes but the numbers (older 4400, 15833 etc.) were derived by interpolation, not read from printed original ticks. Count per printed numeric bracket: 3–10k: 4; 10–15k: 4; 15–20k: 5; 20–25k: 5; 25–30k: 4; 30–35k: 4; 35–40k: 3; 40–50k: 3. These values are explicitly null in the new report.
2. **PRESS 3-PSI source-angle disagreement:** native source stroke scan suggests **96.06°** while the earlier independent source registry lists **89.52°** (difference **6.54°**). The OH19 pressure angle map remains a preview, and no per-tick numerical approval is claimed. Do not hide this failure or auto-average the two.
3. **Shaft mechanical centre** is not certified: visible black aperture optical centre ~488.82, 364.19 px, while existing render uses 489,365 px. Optical 0.835-px correspondence does not prove needle shaft or every sprite mounting offset.
4. **Needle tip fit** is a candidate, not a flight-approved dimension: the last source-native sweep had 0 registered stroke intersections but maximum inner ring clearance remains >14 px in some sectors. Original approved SVG paths and whole panel background are unchanged.
5. **Plant output remains** `PROVISIONAL_TRAINING_PHYSICS_NOT_AIRCRAFT_VALIDATED`; exact aircraft bus feed, actual physical time response, live flight/simulator instrument behavior and full browser screenshot verification are still unapproved. GitHub's VM DOM integration covers JS render transforms but is not a physical flight test.

**Release decision:** OH19 dual training-preview wiring and repeatability checks PASSED. Full geometry 0/54 accepted faces; zero flight-authorized instruments. Do not upgrade preview to operational calibration until the unresolved 32 values, 3-PSI conflict, spindle and tip clearance are independently physically resolved.
