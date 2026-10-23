# AFM N1 v17 — Semantic Curve Roles & Bounded Numeric Next Step

2026-10-23 | EP-FSI ASN29340 | CFM56-3B-1 | 20K | Private source AFM Rev32 (SHA256 3c7002212482f0c47a1735c2302ee304ef41ef4ca270591281b72f5f2a714105)

## Implemented and privately stored

Private Technical Database: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v17/`

- Preserved v16 original AFM source metadata, plotted samples, labels, and source hash.
- Associated **all 301 Hough source fragments with a graph component/semantic role**. No lines were discarded.
- Identified **30 specific printed altitude-label leader fragments** across p128/p129, with pixel residual <=3 and margin from the second-best label >=12.
- Mapped **all 10 p756 PMC OFF altitude-label starts**, including 18 downstream leader segments, with near-unique label start geometry.
- Registered **36 altitude label families** across p128, p129 and p756.
- p130 separated 19 pressure-limit Mach plot fragments, 21 temperature-limit fragments and 60 final TAT nomogram fragments.
- Mapped 5 geometric MAXIMUM N1 CAP source fragments to earlier independent-as-function single-source p756 cap candidate geometry.
- **Important correction:** 104 previous cold-side v11 provisional ordinate samples were taken along printed **altitude label leaders**, NOT the operating N1-versus-temperature curves. v17 marks all 104 as invalid for operational N1 output, without deleting their source traces.

## Stage 2 performed — numerical research-only preview

`n1_numeric_preview.py` in the private zip/SQLite runs a strict **five-knot MAXIMUM N1 CAP** research interpolation for p756 from -20 to +20°C. It checks EP-FSI effectivity, engine 20K, PMC OFF research branch, finite temperature, and prohibits out-of-range extrapolation. Return includes `candidate_cap_n1_pct`, chart page, supporting interval and `approved_for_fmc:false`. The source-provenance role is **maximum cap**, not required takeoff power. `takeoff_n1` and `mct_n1` explicitly refuse to calculate unfinished aircraft performance.

The repo also includes the *generic, source-data-free* `engine/network/afm-n1-research-preview.cjs` with a synthetic unit test. Real source data are kept private in the Technical Database; no raw source pages or real curve coordinates were pushed to GitHub.

## What remains uncompleted

**Categorizing fragments by figure/component and assigning the printed altitude labels is not the same as mapping full operative curves.** Hot ascending, peak, and descending N1-temperature segments on p128/p129/p756 still cross leader lines. The source does not yet provide independent, unequivocal end-to-end join for each altitude. None of these have been invented or auto-labelled as complete. MCT p130 must still map each Mach/TAT isoline through all correction stages and independent numerical signoff. The 5 p756 candidate cap points are also single-source and unapproved.

`n1_numeric_point` remains **zero**, FMC N1 remains blocked. Existing `AFM_GATE` numerical release remains intentionally closed. This work is an intermediate engineering research artifact for the simulator, not flight software.

## Automated QA

- Private `test_numeric_preview.py` exercises recorded endpoints, interpolated midpoints, effectivity, PMC OFF, range rejection, SQLite integrity, 301 records, 36 labels, and FMC rejection.
- Branch CI `tests/afm-n1-v17-preview.test.cjs` tests generic isolated research helper with **synthetic knots only**.
- All previous ISN source and simulator behavior must continue passing.

Do not declare operational Takeoff/MCT N1 until the complete chart envelope, configuration, corrections and independent QA are complete.
