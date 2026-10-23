# AFM N1 / EP-FSI 20K — Direct source audit and unified private v16

**Date:** 2026-10-23. **Purpose:** account for the user's request to finish all source N1 charts without representing unreadable or unmatched curve coordinates as approved numeric performance.

## Authentic AFM PDF rechecked
Private source: `AFM R32 With CDL r43 I FSI.pdf`, 978 scanned PDF pages, SHA-256 `3c7002212482f0c47a1735c2302ee304ef41ef4ca270591281b72f5f2a714105`. Correct aircraft model B737-33V, EP-FSI, MSN 29340, CFM56-3B-1, 20K rating. Four principal chart pages rendered and visually inspected from the original:
- **p128:** TAKEOFF N1 POWER SETTING, A/C AUTO, PMC ON, OAT; labelled pressure-altitude curves and bleed corrections.
- **p129:** GO-AROUND N1 POWER SETTING, A/C AUTO, TAT, nominal Mach 0.22; pressure-altitude lines and anti-ice/pack corrections.
- **p130:** MAXIMUM CONTINUOUS, multi-stage diagram: pressure limit; temperature limit with Mach; altitude correction, TAT correction, bleed correction; N1 nomogram. Final MCT number **requires all stages**, not just a plotted line.
- **p756:** Appendix 2UK A/C AUTO PMC OFF takeoff power; ten printed altitude starter labels and a **separate MAXIMUM N1 cap**, plus bleed corrections. An earlier “13 approved curves” claim was incorrect; v14 label audit reconciled ten printed starters.

## Unified Technical Database v16 (private)
Path: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v16/`

The unified private v16 SQLite preserves all data from the existing v15 private cap/crossing study and adds the four-chart source mapping and QA overlay work:
- 13 diagram components, with input/output units and dependencies.
- 45 labelled source altitude/Mach indicators (26 from takeoff/go-around, 10 from PMC OFF and 9 from MCT Mach).
- 104 previously provisional cold-left altitude samples, 16 provisional bleed adjustment samples, 138 prior unassigned plot readouts.
- **5** single-source MAXIMUM N1 cap candidates from PMC OFF (not final takeoff N1); **10** earlier starter crossing candidates, some extrapolated/unassigned (not eligible).
- 301 additional Hough-identified diagonal source pixel strokes across all four charts; these may include grid crossings and are intentionally **not assigned** to altitude or used as N1 output.
- Original AFM source image render/annotated QA comparisons, SQLite database, status manifest and review queue; raw 221 MB AFM PDF kept private outside the zip.
- SQLite integrity check passed. `n1_numeric_point` table **still 0**. No automatically engine-eligible final N1 values.

A v15 scoped QA package was also retained under the existing `v15/` library folder; the v16 directory is the newest merged, non-destructive record.

## Gate state
The repository file `engine/network/epfsi-afm-n1-source-gate.v16.json` exposes provenance and the unresolved QA state, while the engine `AFM_GATE.qaVersion` is updated to 16. `getAFMTargetN1` still fails closed with `AFM_N1_QA_BLOCKED`. Supplying `verified:true` never bypasses that gate. No change to the simulation's actual thrust/N1 performance curves, FMC output, main branch or deployed cockpit.

### Outstanding requirements for numerically final curves
1. Trace **complete** altitude-labelled graphs through the warm/hot curved segments and their intersections for both p128/p129, and separate the pressure-altitude leader geometry from operative envelopes.
2. Independently digitize p128/p129/p756 **bleed adjustment curves** under the correct pack/cowl/wing anti-ice and altitude applicability rules.
3. Independently digitize all six stages of p130 MCT nomogram including high Mach and temperature correction and verify nominal `N1/sqrt(theta1)` to final N1.
4. Verify whether the EP-FSI installed PMC is ON/available and the operative Appendix 2UK selection, so a 20K curve is applied only to the right configuration.
5. Have an **independent numerical reader** approve complete curves and golden vectors. Multiple computer scans of the *same* plotted line are not independent engineering QA.

**Conclusion:** Source scope and prior proposals have been consolidated, but **full final N1 curves and final FMC N1 are not complete**. There is no defensible way to declare the existing single-source crossover/nomogram candidates as authoritative numbers without these checks. The 20K effectivity, image provenance, and remaining work are now documented and machine-readable.

For training/simulator research only. No certified navigation/performance use.
