# AFM EP-FSI N1 — v14 labelled source anchors and reference-case templates

Scope: EP-FSI 737-33V, MSN 29340, CFM56-3B-1 / 20K. Private original AFM D6-8730.33V R32.

**Source correction:** Inspection of the original AFM PDF p756 shows **ten** printed pressure-altitude labels on the left-hand curve starters: -2, -1, 0, 1, 2, 3, 4, 6, 8 and 10 (thousand feet). The v13 claim that 13 pressure-altitude curves were identified is not supported by that labelled portion of the page and must be superseded. The actual complete curve family/branch association and bold MAXIMUM N1 line still require trace review.

## What v14 established
- PDF pages **130 and 756** were rendered anew at 3× resolution; both matched the prior source image **pixel-for-pixel**.
- Source-labelled p756 starter leaders: **10 distinct first-pass visual identifications**, anchored to image pixels and checked for horizontal ink support. These are **not complete, approved numerical N1 curves**. Image annotations and source coordinates remain private.
- MCT p130 Pressure Limit **nine** visually read Mach legend labels indexed independently from corrected-N1 gauge readouts.
- **Eight reference-case templates** now specify aircraft config, phase, PMC mode, pressure altitude and which AFM page to consult. Their expected numeric N1 fields intentionally remain **NULL** pending proper curve readout and independent verification.
- Python SQLite/source-identity suite: **20 PASS**. Prior 104 v11 preliminary N1 samples, 16 v12 preliminary bleed samples and 46 unassigned v13 strokes are retained without false promotion.

Private active source: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v14/epfsi_afm_scoped_v14.sqlite`.

## Incomplete (do NOT mark as done)
Confirm continuity of each labelled p756 starter through intersections with bold maximum N1 cap; complete full-published-temperature numeric readout; verify PMC-off bleed correction, MCT nomogram intersections and independent numerical golden vectors. **Zero approved final N1 values.** CDU remains guarded and automatic N1/Autothrottle outputs remain disabled.

Test source routing separately: `node tests/afm-epfsi-source-vectors-v14.test.cjs`. This test verifies correct source selection and no invented N1 using public code only; it does not validate numerical Boeing performance curves. Never put original Boeing pages or their proprietary digitized curve coordinates into this public repo.
