# EP-FSI N1 v10 — Chart source routing and CDU adapter

Airplane profile: EP-FSI / ASN 29340 / Boeing 737-33V / CFM56-3B-1 / 20K (user-specified). Primary document: AFM D6-8730.33V R32, private source archive.

Image checked: PDF pp126–130, 755–756, 862–864. Scope: **education / simulator, not real flight**.

Runtime support:
- TAKEOFF with PMC NORMAL → base AFM p128. Input OAT, pressure altitude, IAS 40–60 knots and bleed/anti-ice configuration.
- TAKEOFF with PMC OFF → Appendix 2UK p756, with separate maximum N1 cap.
- GO-AROUND with either PMC mode → base AFM p129. The chart refers to TAT and Mach 0.22, not the Takeoff OAT table.
- MAX CONTINUOUS with either PMC mode → base AFM p130. Pressure and temperature limiting branches must be compared and converted through the nomogram.
- Appendix 2UK p755 states all settings other than takeoff unchanged; this corrects the v9 behavior that blocked GA/MCT when PMC was OFF.

Staged code: `engine/fmc/performance/afm-epfsi-n1-v10.cjs`; deterministic source selector and closed-fail CDU adapter. **No verified numeric performance curves or interpolator** in the public repository. Invalid aircraft, unknown PMC and missing inputs do not return a synthetic N1. The standalone trainer's manually entered N1 is a training input and never an AFM-calculated result or autothrottle target.

Test: `node tests/afm-epfsi-n1-v10.test.cjs` checks 24 relevant conditions. Visual CDU testing and verified curve extraction are distinct tasks.

Private v10 library archives the source images, calibration analysis, QA worksheet, and source-based curve-digitization backlog; proprietary scans must not be committed to public GitHub.
