# B737 Classic — OH19 Cabin Altitude native-pixel QA / Stage 12
**Date:** 2026-10-26 · **Airframe:** 737-33V EP-FSI · **Release:** BLOCKED

## What was implemented
- Reconciled the existing original-photo source identity: `OH19-PRESS-DIFF-ALT-HORN-d6719ce57cef.png`, **1267 × 1241** native px, SHA-256 `4c667d96ea7652e52784f5c06ee3cdde0879ca37631abf19969861afecc45fed`.
- Cross-matched the native extraction of **47 CAB ALT inner-scale strokes** and **51 DIFF PRESS outer-scale strokes** against the 15 preview cabin altitude anchors.
- All 15 anchor angles matched the previous 47-point inner candidate registry. Seven 0–3000 ft anchor angles were previously visually reviewed, and eight are higher-scale anchor candidates. This is *cross-registry consistency*, not independent pixel approval.
- **32 inner ticks remain without a source-verified numeric value.** Prior numbers such as 4400, 5800, 7200, 8600 and 15833.33 ft were mechanically interpolated, not printed-value readings. The new audit deliberately exposes `anchorPreviewValueFt:null` for these 32 instead of silently promoting inferred values.
- The stored pivot at original pixel `(489,365)` is explicitly **optical estimate / not physical shaft-certified**. Inner and outer scales remain independent.
- New `oh19-photo-evidence-v2.js` audits geometric residual, source SHA, original dimensions, ring separation, 98-coordinate containment, unapproved values and frozen release gates.
- New `oh19-photo-evidence-v2.test.cjs` runs four non-invasive registry tests, all passing in an isolated CommonJS-compatible execution in this work session.
- New `oh19-photo-overlay-v2.cjs` verifies the versioned original PNG bytes and creates two 2× self-contained SVG artifacts with the **actual original photo embedded** and location markers for the inner/outer rings. The red centre is intentionally marked provisional.
- New `oh19-source-pixel-intensity-v2.py` samples true RGB pixels around each of 98 candidate stroke positions (on the original source photo) and reports contrast against adjacent angular samples. White contrast is supporting evidence, not label or pivot certification.
- Updated `.github/workflows/oh19-cab-alt-photo-qa.yml` to invoke original-image QA, source hash checking, numeric guard tests, overlay generation, pixel intensity scan, and upload an **OH19-native-photo-candidate-overlays** artifact.

## Provenance and honest limits
The immutable original PNG's binary was not accessible for personal visual inspection inside this work session. As of writing, the new GitHub Actions pixel-measurement job has **not** supplied a verified run result. Therefore the image overlay and pixel-intensity script have been committed, but original-image spatial alignment must not be reported as visually approved.

New invariants:
- No change to locked background, needle sprites, Stage 5/9/10 operational motion, control art or user-approved visual assets.
- **0/54** source faces are fully mechanically certified; **0** newly released physical needles.
- Future inspector must verify actual shaft centre, every labeled/unlabeled minor tick classification, independent PRESS scale, inner rim contact, full sweep, and needle-tip geometry before production authorization.
- The new scan output is QA evidence only and must never automatically raise `productionApproved`, `shaftPivotPhotoReviewed`, `allNativeTicksReviewed` or `liveNeedleAuthorized`.

## Important paths
- `engine/instruments/oh19-photo-evidence-v2.js`
- `engine/instruments/oh19-photo-evidence-v2.test.cjs`
- `engine/instruments/oh19-photo-overlay-v2.cjs`
- `engine/instruments/oh19-source-pixel-intensity-v2.py`
- `.github/workflows/oh19-cab-alt-photo-qa.yml`

**Next physical-calibration gate:** Examine the two original-image overlays and the 98 real RGB contrast observations, then individually resolve the physical shaft and 32 remaining unlabeled CAB ALT stroke values against original-photo labels and tick geometry. Do not generate guessed values.
