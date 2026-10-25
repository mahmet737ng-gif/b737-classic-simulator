# B737 Classic — high-priority dial geometry source-audit checkpoint
**Date:** 2026-10-25 · **Airframe:** 737-33V EP-FSI · **Branch:** `main`

## Executed

Reviewed the **15 high-risk original dial faces** in five **3-up native-source photo sheets**, using independent SHA-256 and pixel-size verification of **seven source files**. Work used the actual locked source images, not stock artwork. Original assets and owner-locked needle sprites were not modified.

### Verified root photograph correction
The previously reported 'missing source' for:
- `fo.outer_altimeter`
- `fo.outer_vertical_speed`
- `fo.outer_clock`

was a **metadata error**, not missing file content. All three reference the versioned root PNG `file_000000006c00820ab145b3682f686256.png` (1123×1400 px; SHA-256 `b2439666f75ddbcab15835b532d26a7ad2d1ab669be5f48774d656c1b8915a3c`). The file exists in the repository tree and was independently verified at runtime by OpenCV, and the earlier source-missing gate was corrected.

### 15 source image diagnosis and protective decisions

- **DC AMPS OH10:** reject the previous overlay origin (310,168) as an unverified 24-pixel upward displacement; retain (310,192) as a **provisional** photographic reference only.
- **CPS OH10:** reject the previous overlay origin (715,190), displaced 65 pixels from the newer centered candidate; retain (780,192) as a **provisional** photographic reference only.
- **Captain RMI:** the black center cap is visible near the earlier approximate pivot; a Hough circle for the case rim, 49 pixels away, does not prove a physical shaft center.
- **STAB TRIM RIGHT:** the older (961–1063, 609–965) candidate window misses the visible scale. Source-image dark-region segmentation identified an alternative (895–998,609–965). The old window yielded zero detected transverse marks, whereas the alternate ROI produced **five unclassified horizontal edges** (pixel rows 657,775,880,923,928). **Neither this window nor those edges is approved for physical motion.**
- **Fuel quantity 1/center:** photographed gauge arcs do not show a shaft. Do not assume that the center of the rim is the pointer pivot.
- **Remaining high-priority gauges:** source-scanned and inspected in the five sheets; case centers and ambiguous text-like strokes remain candidate-only until point-by-point scale review.

**Native-scan totals:** 15 high-risk faces (14 rotary, one linear), two historical pivot disagreements, 11 displacements between rim and prior center greater than 20 native pixels, six previous numbered-angle references, 733 non-semantic white radial fragments. None of those fragments is individually certified as a major or minor graduation.

## QA

[Latest passing GitHub Actions — high-risk native image review and ledger gates](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40229454126)

- Seven JS tests verify 15 source audits, both disqualified stale pivots, root image provenance, and the unapproved right STAB TRIM alternative.
- Python performs original-source cryptographic hash and dimension checks and emits a five-sheet artifact for all 15 cases.
- Locked Overhead art verification passes.
- `engine/instruments/stage11-acceptance-matrix-v1.json` was corrected to remove the false three-missing-images claim, while retaining **0/54 mechanically calibrated faces** and **0 approved active pointers**.
- `engine/instruments/stage11-highrisk-native-review-v2.json` records the human-image findings and rejects suspect historical overlays without rewriting the source assets.

## Remaining prerequisites for actual Unified needle release

1. Certify the **real shaft center** from source photography or original mechanical reference for the 14 rotating priority gauges, rather than simply substituting the outer case circle.
2. Manually classify and record **all** major/minor graduations, values, units, inner endpoints, scale-direction and mode for each dial.
3. Confirm the alternative STAB TRIM track on a pixel-perfect enlarged photo, distinguish actual scale lines from adjacent text and trim housing, and then validate its measured travel axis.
4. Complete the remaining Stage 3–8 original measurements and equipment-feed mapping for all 54 faces.
5. Only after that, enable instrument-by-instrument visible Unified motion with QA screenshots and failure-state test flights.

**Approval:** Native photo provenance and source triage complete for the priority batch; physical geometry certification remains **BLOCKED**. This is not a 100% needle motion fix or flight-validated release.
