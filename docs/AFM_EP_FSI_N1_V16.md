# EP-FSI N1 v16

Profile: Boeing 737-33V EP-FSI, MSN 29340, CFM56-3B-1 20K (owner-provided).

AFM D6-8730.33V R32, private PDF pages 755–756 Appendix 2UK.

## Done
- Source confirms final N1 GAGE with or without bleed must not exceed MAXIMUM N1.
- New generic gated computation module: `engine/fmc/performance/afm-epfsi-pmc-off-v16.cjs`.
- Compute: interpolated altitude/OAT baseline + applicable bleed correction; clamp to chart MAXIMUM N1.
- Deny mismatched serial, engine, rating or PMC, missing bleed, temperature/altitude extrapolation and unreviewed source.
- Local synthetic test suite: 24 passed. No actual Boeing numeric chart data distributed in public repository.
- Private v16 SQLite retains historical sample provenance and adds 7 source-backed procedural rules, 6 release gates and 11 final-N1 reference templates.

## Open
Complete and independently verify source curve continuations, numeric bleed corrections, cap and final AFM Golden vectors. Actual PMC state not yet confirmed. **Final approved source-based N1 outputs: 0.** Live CDU and autothrottle remain blocked for automatically computed N1.

Private archive: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v16/`.
Public code is for an educational simulator only; not for actual aircraft operations.