# B737 Classic — Fire Protection Panel V3

**Scope:** isolated interactive test panel and ATA 26 training state engine, published independently of the immutable overhead mosaic.

## Source hierarchy

1. Owner-provided private Sepehran 737-300/400/500 FCOM **Chapter 8**, Controls and Indicators **8.10.1–8.10.4** (source PDF pages 1222–1225).
2. Same Classic FCOM, System Description **8.20.1–8.20.8** (source PDF pages 1234–1241).
3. NG panel photographs / diagram as **geometric and styling comparison only**. NG installation/configuration differences must not override 737 Classic FCOM logic.
4. Two owner-uploaded MP4 reference clips (`1000166701.mp4`, 222 frames; `1000166702.mp4`, 689 frames) were fully decoded and sampled for temporal change analysis, with specific visual frames inspected at key events (see `video-evidence-2026-10-26.json`). The original user video files and screenshots are **not** stored in the public repository. They supersede the previously inaccessible YouTube embed as an actual reviewed visual reference.

Do not publish the private manual scan, extensive copyrighted text, or video frames.

## Layout

- The approved source artwork remains **read-only**: `panel-mosaic-lab/assets/locked/2026-10-23/Fire_Protection_Panel_Blank_With_Buttons.png`.
- `geometry-v2.js` is the actual **V3 slot registry**, with 18 independently sized bounding boxes and a zero-intersection geometry gate.
- Correct central column, top to bottom: **WHEEL WELL** (red), **FAULT** (amber), **APU DET INOP** (amber), **APU BOTTLE DISCHARGED** (amber).
- The missing APU BOTTLE DISCHARGED amber face is now **newly produced** as a separate OFF/ON pair in `assets/` and should receive a close-up appearance/pixel acceptance check; it is not falsely attributed to previously approved art.
- Three independent EXT test lenses are drawn in the separate layer and light green on circuit continuity.
- Four camera-verified small white-capped toggle/spring switches now occupy the previously blank holes on the photographic background: independent ENG1/ENG2 OVHT DET, FAULT/INOP vs OVHT/FIRE, and EXT TEST 1/2. The new artwork is CSS-only, and a click/keyboard/pointer interaction drives the isolated engine's detents; the momentary switches release to center.
- Existing approved assets for the ENG OVERHEAT, FAULT, APU DET INOP, WHEEL WELL, L/R BOTTLE, and fire handles are referenced unchanged.
- Idle fire handle overlays are hidden because the photo background itself contains those handles. Illuminated/pulled overlays remain **provisional**, especially pivot and duplicate-image occlusion. Do not declare pixel QA passed.
- Configurable layer positions are stored in browser-local storage with a new V3 key; no original art is changed.

## Behavior / FCOM-backed modeling

- **Independent** ENG1 and ENG2 OVHT DET selectors (NORMAL / A / B).
- With both healthy, NORMAL requires concurrence of dual-loop conditions; if one fails, the remaining loop can provide detection with no single-loop cockpit fault; if both fail, FAULT and system caution; manual selection of a failed loop raises FAULT without those cautions.
- Engine fire indications include engine overheat alerts and related caution; engine overheat or fire unlocks its handle.
- APU detector fault, wheel well detection dependency on AC transfer bus 1, APU auto-shutdown on fire, ground horn dependence on ground mode, separate master fire warning and bell cutout.
- Momentary FAULT/INOP and OVHT/FIRE tests and momentary EXT 1/2 continuity tests; physical extinguisher bottles remain available after a test.
- Separate engine L/R bottle and APU bottle pressure/discharge states; rotating a pulled handle arms a discharge request. Indication follows a **2.5-second simulated delay** (implementation estimate; FCOM states only a delay of a few seconds, not a certified fixed time).
- Inputs expose battery bus, hot battery and AC transfer bus 1 trainer conditions, individual loop integrity, bottle pressure low, and squib channels in the engine.
- Outputs model engine fuel/hydraulic/bleed valve shutoff, generator trip and reverser inhibit and the APU valve/inlet/generator consequences.
- No signal is forwarded to the main aircraft runtime or real aircraft.

## Visual references and verification

`video-evidence-2026-10-26.json` records exact uploaded file digests, 911 decoded video frames, visible switch/lamp events and their approximate timestamps. Distinguish visual evidence from timing assumptions: e.g., the `2.5 s` modeled extinguisher indication delay is a teaching approximation, not derived from the clip.

## Verification

`node fire-protection-lab/tests/engine.test.cjs` — 65 positive logic assertions and 3 invalid-command cases.

`node fire-protection-lab/tests/geometry-v2.test.cjs` — bounding boxes, overlap, 14-slot registration and inline browser JS syntax.

`node fire-protection-lab/tests/assets.test.cjs` — required image paths (approved source and new generated APU lamp).

GitHub Actions: `.github/workflows/fire-protection-panel.yml`.

## Release gates still open

1. Final **full-resolution reference-to-panel** pixel and font comparison, not just screenshot-derived provisional coordinates.
2. Physical handle IN/UP/LEFT/RIGHT visual states with pivot calibration and no duplicate handle pixels from the background.
3. Actual live simulation integration for bus failure, APU engine shutdown, audio and annunciations, tested end to end.
4. Configuration-specific variations (if an actual 737-300, -400 or -500 submodel differs) verified by applicability.
5. Confirm animation, interaction and relative sizing in desktop/mobile browsers with user-view screenshot before signoff.

**Status:** V3 isolated engineering test bench / not flight validated / not approved for Unified integration.
