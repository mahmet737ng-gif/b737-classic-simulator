# B737 Classic — Stage 3 & 4 source-pixel geometry report

**Aircraft:** B737-33V EP-FSI. **Date:** 25 October 2026.  
**Result:** Computer-assisted read-only extraction completed for the entire 54-face inventory; final per-pixel image acceptance is **not** complete.

## Work executed

- Verified original PNG SHA-256 and native image dimensions on GitHub Actions before scanning; original locked assets remained unchanged.
- Used neutral-white radial run segmentation in original coordinates and restricted half-dial arc sectors to reduce text/rim noise.
- Registered **1,808 candidate segments** on **49 rotary faces** / **50 radial bands**; 232 classified as long-like, 748 short-like, rest medium-like. These are **NOT** 1,808 confirmed tick marks; lettering/rims and fragmented strokes can still be included.
- Added transverse Hough + directional morphology extraction for **five linear travel indicators**, registering **29 candidate line segments**, including 10 FO LEFT and 11 FO RIGHT. Incomplete on some pedestal strips.
- Compared candidate lines with 52 pre-existing source photo angle anchors: 23 single angular matches, 29 ambiguous multiple matches. Neither is approval of physical tick coordinates.
- Compared initial 49 pivot locations with case/rim Hough fits: **40 faces** had a nearby rim proposal (49 proposals total); the other **9** did not. Optical case center must not automatically replace a needle's physical shaft center.
- Generated contact sheets for all 54 faces and preserved source-photo original-pixel identifiers and scale geometry in five machine-readable data shards.
- Regression test and locked-overhead checks both passed in [GitHub Actions QA](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40222423883).

## Main-pivot review priorities

The largest *rim-versus-existing pivot* discrepancies exceed 20 native pixels. This is a signal to re-check, **not evidence that the rim fitter's result is correct**.

| Face | Displacement (px) |
|---|---:|
| `capt.rmi` | 49.47 |
| `oh.drive_oil.1` | 37.65 |
| `eng.fuel_qty.center` | 34.67 |
| `eng.fuel_qty.1` | 32.33 |
| `capt.clock` | 31.69 |
| `oh.elec.ac_volts` | 29.64 |
| `capt.vertical_speed` | 28.10 |
| `fo.airspeed` | 26.14 |
| `capt.altimeter` | 24.13 |
| `capt.airspeed` | 22.11 |
| `oh.elec.dc_volts` | 21.83 |

Historical OH10 pivot inconsistencies (DC AMPS and CPS) must also be resolved against the immutable source and actual needle shaft.

## Linear indicator source review

| Face | Candidate transverse marks | Main outstanding risk |
|---|---:|---|
| `fo.left_linear` | 10 | line_values_unassigned |
| `fo.right_linear` | 11 | line_values_unassigned |
| `ped.stab_trim.left` | 2 | linear_minor_ticks_incomplete, line_values_unassigned |
| `ped.stab_trim.right` | 0 | no_transverse_lines_detected, linear_minor_ticks_incomplete, line_values_unassigned |
| `ped.rudder_trim` | 6 | line_values_unassigned |

## Geometry exceptions

- OH11 GEN DRIVE OIL TEMP 1 and 2: RISE and IN are two numeric interpretations of the same physical tick ring. Both mappings need independent source and effectivity review before signoff.
- OH19 CABIN ALT and DIFFERENTIAL PRESSURE: two distinct concentric radial scales, separately scanned in the native source; do not mix their numeric values.
- Captain combined ALT/IAS: source has separated indicator regions; a single shared needle pivot is NOT established.
- Engine EGT/N2 blank face: colored continuous sectors must not be mislabeled as discrete ticks.
- RMI: rotating compass card and independently-shaped bearing needles must be checked separately.
- The oxygen dial photo lacks printed tick anchors in this source; the electrical state does not determine retained bottle pressure.

## Acceptance and current gate

**0/54 faces are fully source-pixel-certified at this checkpoint.** A fully approved instrument requires actual shaft center, full exact native major/minor endpoint coordinates, unambiguous source-backed tick values, needle tip reach QA, multi-scale rules, and cross-validation of continuous values and failures. These cannot be inferred solely from a run of CV detections or case circles.

No Unified cockpit live gauge mapping, sprite, artwork, source asset, or previous owner-approved panel layout has been replaced.

### Repository outputs

- `engine/instruments/stage34-native/manifest-v1.json`
- `engine/instruments/stage34-native/*-candidates-v1.json` (five region shards)
- `engine/instruments/stage34-native/qa-review-queue-v1.json`
- `tools/gauge-stage34-native-refinement-v1.py`
- `tools/gauge-stage34-visual-sheets-v1.py`
- `engine/instruments/stage34-native/native-stage34-qa-v1.test.cjs`
