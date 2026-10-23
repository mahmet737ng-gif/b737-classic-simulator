# EP-FSI AFM N1 — v15 source-chart component trace

Airframe and installed engine **owner-specified**: EP-FSI / Boeing 737-33V / ASN 29340 / CFM56-3B-1 rated 20,000 lbf. Primary AFM: Boeing D6-8730.33V R32, physical PDF p756 (Appendix 2UK Section 4.2 p2).

## Numeric progress — NOT final N1

Private source image p756 (3×) was re-rendered directly from original AFM and compared **pixel-for-pixel** with the preexisting source scan, confirming unchanged source pixels. Source OAT x-axis and N1 GAGE y-axis were calibrated from **22 manually observed printed axis ticks** (11+11); fitted per-tick residuals were below 1 px on both axes.

The isolated bold `MAXIMUM N1` *limit line*, rather than the airplane altitude-dependent takeoff N1, was sampled at five OAT positions. Each first-pass numerical **CAP COMPONENT CANDIDATE** stores pixel x/y, axis-derived value, linear ink-centre fit cross-check, source reference and lack of independent signoff. Each local pixel vs global fit discrepancy is less than 0.16 percentage point; that is a consistency check **from the same PDF**, not independent engineering validation. Estimated chart-readout uncertainty is approximately ±0.2 percentage point. **The five exact numerical candidate values are private and must not be committed to this public repo.**

10 source-labelled pressure-altitude leaders (-2 through +10 thousand feet at listed AFM increments) were inspected for diagonal continuation with Hough line analysis. **9** have candidate geometric continuation, **1** remains ambiguous, **6** candidate geometric intersections with the separate bold MAXIMUM N1 line are within Hough-supported observed segments and **3** require extrapolation and cannot count as observed intersections. Geometry alone does not prove the AFM performance branch or correct N1 result.

## Explicit state / next release gates

- 0 independently reviewed final takeoff N1 numeric golden vectors.
- 0 independently approved corrected N1 values for FMC/CDU.
- 0 runtime eligible candidate chart values.
- PMC OFF bleed corrections, pressure-altitude selection beyond crossings, and MCT p130 full nomogram remain unvalidated numerically.
- The source-registry v10 guarded CDU routes to the appropriate chart but returns `---.-` for calculated N1. No A/T target is emitted.
- Source-image QA and v15 SQLite regressions: 30 PASS. No external reference examples or independent source signoff claimed.
- Private active file: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v15/epfsi_afm_scoped_v15.sqlite`.
- Previous v14 preserved as an immutable archived snapshot.
- These scans are proprietary. The original PDF, visual overlays and numerical graph coordinates stay in private Technical Database, **not GitHub**.

The first draft source-derived numerical *component* cases exist, but **no complete takeoff N1 golden vector is approved**. To finish, independently QA the bold cap readings and continuation/selector of each altitude curve, apply Bleed corrections, and compare full final N1 against manually sourced test examples. Not for real flight.
