# EP-FSI AFM N1 v12 — Three-track continuation

Scope exclusively Boeing 737-33V EP-FSI, MSN 29340, CFM56-3B-1 rating 20K. Source: user-supplied AFM D6-8730.33V R32.

## Track 1 — digitization
Private v12 SQLite retains the original v11 104 source-image provisional samples, plus extracted bleed-correction figure candidates in AFM PDF pp128–129. Bleed curves 1–4 are listed for Takeoff; 1–6 for Go-Around. Cross-render/threshold reproducibility is not independent aircraft-performance numerical verification. No samples are approved for automatic flight simulation performance.

## Track 2 — calculation conditions
Six source-ordered Maximum Continuous steps (AFM PDF p130) are implemented as a constrained stage graph: pressure limit; temperature limit with conditional TAT correction; pick lower bound; altitude correction; add applicable bleeds; final N1 nomogram. Appendix 2UK p756 is a separate PMC OFF takeoff source with a separate MAXIMUM N1 cap. Source-indexed bleed/anti-ice conditions are represented in the public metadata-only module `engine/fmc/performance/afm-epfsi-n1-conditions-v12.cjs` (no Boeing numerical curves).

## Track 3 — validation and CDU
The public conditions module has explicit test cases for EP-FSI identity, alternate PMC chart, 6 MCT step order, bleed curve selection, anti-ice applicability and zero numeric output. Existing CDU N1 LIMIT / TAKEOFF REF remain source-status only; no real computed N1 and no autothrottle target. Continued numerical enablement requires completed curves across the source chart, at least one independent non-raster QA pass, exact bleed/anti-ice applicability (including multiple simultaneous conditions), 2UK cap and MCT nomogram golden reference vectors.

Private source data: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v12/`.
Neither Boeing pages nor proprietary extracted numerical curves should be uploaded publicly.

**No numerical N1 calculation is represented as signed-off or ready for operational use.**
