# EP-FSI AFM N1 — v11 numerical trace checkpoint

Aircraft fixed to **Boeing 737-33V EP-FSI, ASN 29340, owner-reported CFM56-3B-1 / 20K**. Source: AFM D6-8730.33V Revision 32, PDF SHA-256 `3c7002212482f0c47a1735c2302ee304ef41ef4ca270591281b72f5f2a714105`.

Private v11 Technical Database: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v11/epfsi_afm_scoped_v11.sqlite` (SHA-256 `e7ba3e2df4ffeb7677ebe631f8b1a854a8ee49dbc1b857d2fd5e3f00aa45786a`).

## Extracted from source image

- **AFM PDF p128, Section 4.2 p4:** 13 altitude-labeled segments of normal PMC takeoff N1 graphic; 4 provisional cold-temperature sampling positions for each segment = 52.
- **AFM PDF p129, Section 4.2 p5:** 13 altitude-labeled segments of go-around N1 graphic; 4 provisional sampling positions per segment = 52.
- **104 total source-image graph samples**, each storing PDF-page link, pixel coordinates, altitude label, temperature and two raster-derived N1 readouts. Same original PDF rendered by two independent software paths; the 104 cross-raster differences pass the implemented image-consistency threshold. This is NOT an independent human review, validated aircraft N1, or complete curve envelope.
- Samples only cover the **left descending labeled stroke portions**, with sampled temperature -35 to -20 °C; this does not prove which complete pressure/temperature limit branch applies at a given condition.
- AFM PDF p126 says Takeoff power is **set at 40–60 kt**; plotted p128 chart header says **0–60 kt**. Treat the operational setting procedure and chart-coverage label as distinct. Do not silently replace one with the other.

## Software

- **Private** `n1_provisional_reader.py` returns source-labelled engineering preview only; its `numeric_n1` is null and its actual calculation function fails closed (9 tests PASS).
- **Public** `engine/fmc/performance/n1-interpolation-guard-v11.cjs` is generic, non-proprietary interpolation machinery with signed-source gates. The accompanying tests use **synthetic numbers**, never actual Boeing AFM output.
- Existing CDU **N1 LIMIT** and **TAKEOFF REF** continue to show `---.-` for unapproved calculated N1. A manual N1 entry remains marked `MAN`. No A/T coupling is enabled.

## Release blockers

Full operating envelope of p128/p129 and curve intersections, exact bleed/cowl anti-ice corrections, PMC-OFF takeoff chart plus independent MAXIMUM N1 limit (p756), complete MCT nomogram (p130), independent numerical signoff and golden vectors, and actual PMC option/state remain unresolved.

**QA counts:** 26 provisional segments, 104 provisional samples, 104 dual-raster checks, 0 independent-human signed values, 0 complete curves, 0 runtime-approved numeric N1 points. The private database and original proprietary graphs must not be committed to this public repo. Educational simulator only, not actual flight operations.