# B737 NAVDB — AIRAC 2610 Reference Progress Monitor

An **additive, simulator-only Stage 8 extension** to the existing Stage 4–7 private B737 Classic NAVDB/CDU test system. It implements a *read-only* geographic cross-track/along-track diagnostic for **explicit, adjacent FIX-to-FIX reference chords** of a saved Stage-4 private flight-plan draft. Unlike verified ARINC procedure legs, the user-supplied narrative SidStars data does **not** prove a TF/DF/CF path-terminator type.

## Exact source gate

For each source TXT, everything before the exact per-file marker is ignored, as required by the user:

`//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1`

This monitor only reads Stage-4 plans already built and validated against that marker and refuses another cycle, missing provenance, activated FMC flags, malformed coordinates, incomplete/missing leg distances or deleted discontinuities.

## Implemented and tested

- WGS84-compatible spherical great-circle segment length and true initial bearing, signed **right-positive** cross-track, along-track, direct distance to the chosen next FIX and span status.
- A private, **loopback-only** service: `/api/stage8/reference` (GET) and `/api/stage8/position` (POST), plus original Stage5 source-only endpoints.
- A standalone source geometry lab where a tester selects a *saved private Stage-4 plan*, selects a reference chord **manually**, enters arbitrary test latitude/longitude and sees a north-up display. This is **not ownship data from GPS or the simulator bridge**.
- Button to stage the **same saved plan in the same embedded CDU** (after which manual RTE L5 ACTIVATE → EXEC is required), then show selected reference progress on its existing **PROG** page, with 'NOT LNAV' and 'NO AUTO SEQ'.
- Strict client-side duplicate source/position checks. If the CDU route changes or there is a pending/modified route, the reference readout is suppressed.
- **22 Python tests** (including conditional one private AIRAC data integration check, and six synthetic HTTP origin/gap tests), **8 Node JS tests**, no navigation-control outputs.

The global user-provided NAVDATA and derived SQLite are NOT included in this source release or committed publicly; reference data is returned only from a private local service. Approved CDU and EFIS artwork and control coordinates are unchanged.

## Run on Windows

Prerequisites: checkout of `mahmet737ng-gif/b737-classic-simulator`, Python 3.10+, and user-owned private Stage4 archive.

```powershell
python navigation/reference_progress_server.py --stage4-zip "C:\Private\B737_NAVDB_AIRAC2610_NPE_STAGE4_PRIVATE.zip" --root . --port 8769
```

Open `http://127.0.0.1:8769/navigation/reference-progress/index.html`.

Choose the saved plan, click Load, then Stage in this CDU. Use embedded CDU RTE L5 `<ACTIVATE` and EXEC. Type a sample position, manually select reference chord, calculate, then click Show on CDU PROG.

Source-only reference programs and real-source procedure data are not served on public GitHub Pages.

## Limitations to finish actual FMC navigation

This does NOT enable any operational or simulation-aircraft guidance. In particular, no automatic fix sequencing, source ARINC path-terminator type inference, turn anticipation, magnetic variation, IRS/GPS ingestion, wind/bank flight dynamics, LNAV/VNAV, AFDS or A/T coupling. A credible executable EP-FSI FMC needs **source-coded** leg termination semantics and aircraft-equipment-specific end-to-end tests, including missed approach / vectors / discontinuities, before any automation. Current test data covers only one **sampled** actual private route for which 10 valid adjacent FIX chords and 4 DISCONTINUITIES were observed.