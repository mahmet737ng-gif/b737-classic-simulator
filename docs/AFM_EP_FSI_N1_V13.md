> **v14 correction (2026-10-23):** Later examination of the original p756 chart established 10 explicitly printed pressure-altitude starter labels, rather than the 13 claimed in this historical v13 report. The v13 automatic stroke dataset is still unassigned, and does not prove 13 distinct source curves. See [v14 review](AFM_EP_FSI_N1_V14.md).

# EP-FSI AFM N1 — v13 / PMC OFF and MCT diagram QA

Aircraft scope: **EP-FSI, Boeing 737-33V ASN 29340, CFM56-3B-1 20K**. Source: private AFM D6-8730.33V R32.

## PMC OFF Takeoff — source PDF page 756

The **alternate PMC OFF takeoff chart** includes 13 pressure-altitude traces (-2 to +10 thousand feet), an independently labeled MAXIMUM N1 envelope, and a distinct bleed adjustment figure. The original chart describes **0–60 kt chart applicability**, separate from setting takeoff power at 40–60 kt in Section 4.2 page 2 (PDF p126). The maximum cap cannot be inferred from the base chart, and one cannot assume the bold cap represents any individual pressure-altitude trace.

Private v13 stored original chart pixels, first-pass axis tick calibrations, and computer-detected stroke segments. Line crossings prevent trustworthy airframe curve labeling; these remain **unassigned provisional graph pixels**, not verified N1 values.

## Maximum Continuous — source PDF page 130

The six AFM steps are modeled in order:
1. Pressure-limited **N1 / sqrt(theta1)** at altitude/Mach.
2. Temperature-limited corrected N1 plus TAT correction when published conditions apply (2500–10000 ft).
3. Choose the **lower** of the two corrected limits.
4. Apply the published altitude correction.
5. Add the **sum** of the applicable bleed corrections.
6. Read final **N1 GAGE** from the TAT nomogram.

The intermediate corrected-unit quantity is intentionally distinct from the final gauge N1. The public engine `engine/fmc/performance/afm-epfsi-mct-v13.cjs` implements **test-only** numeric stage execution using explicit synthetic fixtures. Its actual source-data request **fails closed**: no automated N1 is delivered to CDU or autothrottle until a full source-qualified data family and independent reference cases exist. The synthetic regression arithmetic is a software contract test, never a Boeing performance value.

## Status

Source graph grids partially calibrated in private Technical Database. Source trace segments still lack independently reviewed altitude/curve assignment and full numerical interpolation. Bleed, anti-ice, PMC OFF maximum N1 and MCT nomogram final numerical signoff remain pending. Verified AFM N1 outputs: **0**. Source images and proprietary graph-readout data remain private.

Private Library location: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v13/`.
