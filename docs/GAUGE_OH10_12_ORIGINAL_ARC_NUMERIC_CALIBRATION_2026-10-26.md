# B737 Classic — original photo ARC-based gauge calibration
**Date:** 2026-10-26 · **Original panels OH10 and OH12 · EP-FSI trainer**

## Original user bug
Manual test bars changed pointer angles rather than actual displayed amperage/voltage, and the photo metal rim was incorrectly treated as the pointer spindle. Therefore `22°` in inspector was unrelated to an indicated `22 A` or `22 V`. An AC AMPS pointer even rotated about a cosmetic bezel centre ~45px away from the actual radial tick convergence.

## Three calibration operations implemented
1. Read **unmodified original source PNGs** with SHA-256 and source native dimensions.
2. Independently segment white radial tick contours from each original image using grayscale thresholds; fit their principal axes using PCA and intersect the lines by least squares. Never substitute the metal bezel centre for the hidden pivot.
3. Register every actual printed tick, visually classify source major numerals and count equal intervals between each pair. Set the manual test inspector to physical-value units and map input to the *observed angle of that gauge's own tick*, interpolating only between adjacent observed marks. Maintain gauge-specific source sprite shape and length, with no intersection with printed lines.

## New native-pixel centre, tip and numeric division evidence
| Original face | Numeric photo ticks | Photo radial pivot (native X,Y) | Line-fit RMS | Photo-verifiable numeric interval | Minimum painted tip clearance |
|---|---:|---|---:|---|---:|
| OH10 DC AMPS | 11 | 308.453, 281.608 | 2.182 px | −50 to +50 A; 10 A/mark | 3.217 px |
| OH10 DC VOLTS | 11 | 310.307, 682.818 | 1.654 px | 0 to 40 V; 4 V/mark | 2.775 px |
| OH10 AC VOLTS | 16 | 785.143, 702.386 | 4.420 px | 100 to 130 V; 2 V/mark | 3.117 px |
| OH12 A.C. AMPS 1 | 21 | 266.515, 296.991 | 2.790 px | 0 to 200 A; 10 A/mark | 2.617 px |
| OH12 A.C. AMPS 2 | 21 | 753.481, 297.342 | 1.950 px | 0 to 200 A; 10 A/mark | 4.060 px |

**Total real marked native-pixel tick stroke candidates reidentified: 80/80.** The two panels' original bitmap files and original two shared pointer SVG files were not modified.

## Unified behavior and guardrails
- Four **real numeric manual QA controls**: `DC AMPS`, `DC VOLTS`, `A.C. AMPS 1`, `A.C. AMPS 2`. Test bar value is now physical scale number A/V, and the pointer maps to that number's specific registered angular ray.
- `AC VOLTS`: true 16-mark photo geometry is identified, **but** physical 0 V is not printed within the photographed 100–130 V range. The powerless `-70°` park is preserved; a fabricated 100 V cold/dark reading is not allowed. Therefore its slider remains honestly **ANGLE QA ONLY** until observed 115 V source/electrical feed and state transition tests.
- `CPS`: 0 / 400 / 420 asymmetric printed labels need a separate careful scale/condition check. The bezel-centre and angle-only preview remain provisional, never misrepresented as frequency sensor physics.
- `GEN DRIVE OIL TEMP 1/2`: dual `RISE 0/10/20/30` and `IN 80/120/160°C` scales must be resolved independently. Current photo rim preview remains, numerical sliders continue to be explicitly angle-only.
- `APU A.C. AMPS` photo rim offset attempt remains rolled back after contrast became worse.
- No model or UI change changes the frozen overhead art or immutable pointer SVGs; only source-pivot coordinate/scaling and standalone manual QA mapping.
- Hidden hardware spindle, actual sensor BUS/LRU feeds, and real actuator damping are still uncertified; numerical correctness of a photo QA slider is **not aircraft sensor validation**.

## Source data and deterministic tests
- `engine/instruments/oh10-source-radial-graduations-v1.json` — 38 individual source-pixel white graduation marks, major labels and native coordinates.
- `engine/instruments/oh12-ac-amps-photo-graduations-v1.json` — 42 individual source-pixel white graduation marks and numeric labels.
- `engine/instruments/oh10-38-tick-source-pixel-qa-v1.py` + `engine/instruments/oh12-ac-amps-original-photo-qa-v1.py` — recomputes the centres independently from unmodified photo pixels and checks 80 original white source strokes.
- `engine/instruments/oh10-source-radial-calibration-v1.test.cjs` + `engine/instruments/oh12-ac-amps-photo-calibration-v1.test.cjs` — cross-check numerical every-small-tick mapping, reverse interpolation and UI controls.
- [Verified QA CI success](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40396481166).
- [Original source photographic annotations and numeric reports](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40396481166/artifacts/12685594460) — if the artifact ID changes on re-run, use the CI run's Artifacts section.
- [Unified build deployed](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40396158843).
  
## Acceptance status
**Five gauges' photographed tick arcs and real scale angles have been indexed; four have active value-based manual test sliders. None has a fully photograph-certified hidden mechanical spindle or source-certified flight sensor integration.** It would be inaccurate to label all eight initial gauges, let alone 54 faces, fully certified at this stage.
