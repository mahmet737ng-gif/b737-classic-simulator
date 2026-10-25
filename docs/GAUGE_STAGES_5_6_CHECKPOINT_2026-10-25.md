# B737 Classic — Stage 5 / Stage 6 engineering checkpoint
**Airframe:** 737-33V EP-FSI | **Date:** 2026-10-25
**Status:** Working candidate engines and machine-readable registries published on `main`. Numerical/photo calibration has **NOT** been finally approved or deployed to live Unified needles.

## Stage 5 — value-to-angle

Implemented `engine/instruments/stage5-scale-mapping-v1.js` and `stage5-numeric-scale-candidates-v1.json`, backed by existing native photo-angle references and exact original image provenance.

- All **54** instrument faces registered, representing **59** distinct mathematical scale modes including GEN DRIVE OIL RISE vs IN, OH19 concentric CAB ALT vs DIFFERENTIAL PRESSURE, bidirectional CABIN RATE, ALT/IAS and 5 non-rotating strips.
- **7** scale modes across **6** faces have at least two source-angle candidate anchors and can be preview-interpolated without assigning numerical values to unknown minor strokes.
- Total numeric/photo angle anchor records: **52**. **0** fully source-photo-certified; 52 source anchors are not equivalent to 52 approved ticks.
- All remaining scale modes explicitly return missing/incomplete calibration. We do **not** silently spread numbers across unlabeled, uncounted white strokes.
- Piecewise interpolation preserves CPS 400-to-420 nonuniform angles and pressure-gauge angle unwrapping through the bottom of the dial.
- Live reads are blocked by default; preview requires an explicit `preview:true` flag, and out-of-range policy is explicit `reject` or `clamp`.
- A linear travel window is not a rotary needle and gets no pivot or inferred numeric map until its actual numbered graduation coordinates are reviewed.

### Provisional preview examples

| Face | Input | Candidate target | Note |
|---|---:|---:|---|
| Cabin altitude | 66 ft | 4.146° | Provisional OH19 inner scale only |
| Cabin altitude | 3,260 ft | 61.787° | From 3,000–10,000 ft anchor segment; gaps incomplete |
| Cabin altitude | 3,963 ft | 66.674° | From 3,000–10,000 ft anchor segment; gaps incomplete |
| CPS | 410 Hz | 41.805° | Halfway between 400/420 source angle candidates |
| Fuel temperature | 12.5 °C | 29.750° | Between +10 and +20 native reference candidates |

Degrees measured clockwise from twelve o'clock. None is certified hardware geometry.

## Stage 6 — sprite pivot and tip-reach

Implemented `engine/instruments/stage6-needle-fit-v1.js` and `stage6-needle-fit-candidates-v1.json`.

- **38** known logical pointer identities registered across 54 faces. A registered logical pointer is **not** evidence that the corresponding overlay is physically installed.
- **13** pointer identities have known *provisional visual-model* needle-tip radii from previous fitting/sprite work. The others remain null, not guessed.
- **5** owner-approved/locked sprite identities preserved from the existing fit audit; no silhouette, needle shape, SVG, source image or panel background was replaced.
- Calculates source-pixel tip vector, radial error to a photo tick, nominal rotation offset from a supplied sprite local pivot and sprite tip, and transforms native coordinates into montage placement.
- Detects nonuniform X/Y panel scaling and flags it rather than pretending the sprite is transformed uniformly.
- OH19 CAB ALT and differential-pressure needle/ring geometry explicitly separated; inner CAB ALT pointer is never fitted to outer PSI marks.
- Per-tick exact endpoint and mechanically correct pivot remain pending image QA, so **0** final approved fits and **0** live motion changes.

## Existing dependencies from Stage 3 / 4

Our source scans detected 1,808 rotary radial *white line candidates* and 29 transverse linear strokes; some are false positives or incomplete. Native centre and exact inner end of each printed major/minor stroke are still unapproved. Never use candidate values to enable `realReadingsEnabled`.

## QA and release

CI run: [Gauge stage5/6 QA](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40223688478): all nine Node assertions passed after correcting the equivalent signed/unsigned bearing comparison; frozen Overhead photo verification passed.

Release blockers:
1. Independently sign off native-pixel shaft pivots and exact tick tips for each scale and mechanism.
2. Complete actual printed tick count, value sequence and system effectivity; separate multiple scale modes.
3. Verify each installed sprite's local shaft center and local tip point, radial fit at every graduation, and min/max/overrange.
4. Integrate only passed numerical and geometry maps into ISM and Unified (no unapproved automatic activation).

No operational gauge calibration, avionics dynamics or aircraft-system controls have been changed by this milestone.
