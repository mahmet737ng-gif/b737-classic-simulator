# OH12 A.C. AMPS — two source-photo numeric gauge calibrations
**B737 Classic EP-FSI · 26 October 2026 · Unified preview**

## What changed
Two OH12 A.C. AMPS gauges had an incorrect assumption that the physical needle centre coincides with the metal dial bezel. The user's screenshots showed both pointer-origin offset and slider reading mismatch. **Original photo**: `panel-mosaic-lab/assets/locked/2026-10-23/OH12-BUS-TRANS-09319c17e7d0.png`, native 1024×1536, immutable SHA-256 `709cb15a86f9038ca082136c4db59af83c7800107dfe320182bf7f4c56837e9f`.

A native pixel 21-stroke connected-component (grayscale >163), per-line PCA regression, and least-squares intersection of **the radial tick lines themselves**, rather than circular metal rims, produce:

| Quantity | A.C. AMPS 1 | A.C. AMPS 2 |
|---|---:|---:|
| Previous metal-bezel fit pivot (px) | (261.0, 252.2) | (753.4, 252.2) |
| New radial-line centre (px) | **(266.515, 296.991)** | **(753.481, 297.342)** |
| Photo line-axis least squares RMS error | **2.79px** | **1.95px** |
| Tick strokes independently detected | **21** | **21** |
| Photo-registered original major numeric marks | 0,50,100,150,200 A | 0,50,100,150,200 A |
| Visible divisions between each adjacent pair of majors | 5 | 5 |
| Value of each minor graduation | **10 A** | **10 A** |
| Owner-provided white SVG path | unchanged | unchanged |
| Sprite source-pixel effective tip scale parameter | 102 → **125** | 102 → **125** |
| Minimum painted tip to source-line clearance | **2.617px** | **4.060px** |

The registered 42 line-by-line photo angles are in `engine/instruments/oh12-ac-amps-photo-graduations-v1.json`. They are **independent** for each gauge, using measured angle at each 10A tick; the interpolation *between two real adjacent ticks* is for the smooth preview, not fabricated unknown strokes. Mechanical shaft is under the gray lower masking plate, cannot be physically measured from this photo. The radial source geometry is a strong source-native pivot **estimate**, not a certified mechanical spindle.

### Unified behavior changed
- The two A.C. AMPS inspector sliders read **0 to 200 amperes**, never arbitrary -90 to +90 degrees.
- They map independently through `bearingForAmps('acAmps1', valueA)` and `bearingForAmps('acAmps2', valueA)`, respectively, with inverse mapping for faithful numeric output.
- Each pointer starts precisely at **0 A** at its respective true printed major mark; 1A changes interpolate between neighboring *measured* 10A ticks.
- Both effective pointer tips now terminate short of every one of the 42 actual source white strokes (not 30px short due the incorrectly centred display).
- `GEN DRIVE OIL TEMP 1/2` and `APU A.C. AMPS` retain the old, clearly labelled **ANGLE-ONLY** controls until their independent scales are measured. Other OH10/20/21 face calibration is not falsely promoted.
- No approved SVG image, frozen original panel photograph, or shared HTML atlas positioning has been edited.

### Actual automated acceptance tests
**Successful GitHub Actions run:** https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40394142946

Steps that passed:
1. Original OH12 source image hash, exact 1024×1536 image dimensions, independent 42-component re-identification.
2. Reconstructed both pivot centres from image pixel masks, measured fitting error and tested actual sprite painted tip clearance at every tick.
3. 0–200A integer sweep for both faces with forward (amp→bearing) and inverse (bearing→amp) within 1e-9 A, full source-angle correspondence with all 42 real graduations.
4. Unified DOM slider uses actual amperes for these two gauges; remaining controls still explicitly use degrees.
5. Legacy OH11/OH12, Stage 7–10 and frozen overhead artwork regression and source photo integrity.
6. APU A.C. AMPS rejected experimental shift remains rolled back and passes the original-image QA.

**Photos and JSON report:** https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40394142946/artifacts/12685557395 (artifacts/native-arc-audit/oh12-ac-amps).

### Remaining acceptance blockers
The source photo does not expose the hidden metallic shaft axis, so **physical spindle certification still absent**. The indicated scale is photo-faithful, but full aircraft instrument dynamics / damping, electrical feeds and independent simulator-versus-hardware position flight testing are still outstanding. Six previously adjusted meters (OH10 DC AMPS, CPS, DC VOLTS, AC VOLTS; OH11 GEN DRIVE TEMP 1/2) still require source tick-by-tick extraction; they are not counted as fully graduated. APU AC AMPS remains unchanged after its bezel-only error. **Do not label all 54 instruments flight-certified**.

This record is explicit about which measurements are proven from immutable photographic pixels and which are not.
