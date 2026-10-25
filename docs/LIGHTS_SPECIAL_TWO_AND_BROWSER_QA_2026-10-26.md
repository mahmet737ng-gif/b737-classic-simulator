# B737 Classic: 37 shared-lens per-position vectors + two special glass photo checks

Date: 2026-10-26

## Installed state

- The immutable, source-photo derived 37 per-instance vector lens faces with 74 signed light states are available in `panel-mosaic-lab/interactive-overhead/instance-faces.json` and `panel-mosaic-lab/cockpit/instance-faces.json`.
- Original 68 overhead and 23 main-panel catalogue assets and electrical controller rules remain unchanged.
- A rendering-path bug has been corrected: when `B737ImageLoader` is absent, the overhead must still resolve its registered `instanceFaces.instances[id].states[state].url`. It must not silently fall back to the older shared image.
- This path is now covered by `instance-faces.test.cjs`.
- **Passed headless Chromium QA:** 112/112 overhead and 30/30 main lamp DOM mounts, with **all 74 physical-instance SVG states decoded in Chromium** (70 overhead, 4 main), exact native socket dimensions, seven real-mounted image samples and no reported lamp JavaScript errors. This validates live browser resource integrity, not photographic pixel position.

## Interactive overhead routing

The overhead reference HTML deliberately redirects to Unified unless `standalone=1`. It also uses `<base href="../all-overhead/">` to serve the **existing approved atlas-stage engine**. An exploratory duplicate stage file was removed after this behavior was confirmed; the approved stage/source mosaic is unchanged. The browser smoke exercise explicitly visits `/interactive-overhead/?standalone=1&debugLights=1` to test the overhead itself instead of following the normal redirect.

## Two unresolved source-photo apertures — no guessed coordinate edits

### FLIGHT RECORDER OFF (UPPER)
- Original photo: `panel-mosaic-lab/assets/locked/2026-10-23/OH01-06-source-9d8ac0ac86bd.png`
- Current source rectangle: `[1485,439,40,31]`
- The 6× nearest-neighbour photo crop shows a narrow black lens with a strong right and bottom edge, but the left rim cannot be reliably distinguished from adjacent dark image pixels.
- Independent multi-scanline RGB analysis: **UNRESOLVED_PHOTO_BOUNDARY**.
- Decision: **Keep current sourceRect; do not certify 3-pixel four-sided glass registration or invent a one-pixel offset.**

### PULL UP — Captain
- Original photo: `panel-mosaic-lab/assets/locked/2026-10-23/B737_Captain_Panel_Blank_4K.png`
- Current source rectangle: `[1284,389,164,68]`
- The source has a tinted brown lens, a wider perspective/bezel outline and reflections that can be mistakenly measured as the actual glass face.
- Independent 3× RGB multiband scan detects a centre displacement near **0px horizontally / +3.5px vertically**, but the measurement uses **outer rim contrast**, not proof of the true inner glass corners.
- Decision: **Keep current sourceRect, pending manually identified inner-glass boundary or reliable perspective mask.** Do not translate an outside-bezel measurement directly into a mounted lens position.

## Evidence, code and limits

- [Targeted photo scan source](../tools/lamp-photo-special-qa.py)
- [Original-photo annotated crops and recorded evidence](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40241991857)
- [Live-browser functional image smoke test](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40243089156)
- [Historical 142-position native-source evidence](../panel-mosaic-lab/lights-test/photo-pixel-registration-v4.json)
- [Per-position SVG derivation and tests](../panel-mosaic-lab/lights-test/instance-faces-rollout.json)

**Current exact-source-photo count remains 140 / 142**, with two special photo conditions explicitly OPEN, until genuine inner-lens boundaries are proven. An acceptable browser image decode proves resource validity and state selection, not photographic geometry. Alternate CPCS/DCPCS and 737-400 photo variants require their own separate visual QA.
