# FMC Navigation Stage 4 — CDU-native route entry + EHSI PLAN reference map

**AIRAC 2610 Rev.1 · October 23, 2026 · simulator development only.**

This is an **incremental working integration**, NOT a complete executable FMC or LNAV guidance system. All privately supplied PMDG/Navigraph source data and Stage-1/Stage-2 SQLite are kept in the user’s private Library. No restricted data copied to GitHub Pages.

## Implemented and connected

1. `navigation/fmc_route_engine.py` validates source header/provenance and derives real WGS/source-coordinate DCT/AIRWAY reference segments with their source file and line IDs. No guessed procedure legs.
2. Local `navigation/fmc_server.py` responds on loopback `127.0.0.1:8765`; private SQLite is loaded from the existing private Stage-2 ZIP, separate from the web folder.
3. `cdu-standalone-v6/nav-route-adapter.js` now reads typed **ORIGIN/DEST in RTE**, and up to four ordered `VIA1/TO1…VIA4/TO4` entries from **FLIGHT PLAN**. `draft()` builds a typed request; `stageFromDraft()` verifies that the returned source route matches the unchanged CDU draft and rejects unrelated CDU pending edits. No silent modification, no automatic EXEC.
4. `navigation/fmc-lab/` adds **Read route entered in CDU**. Then **Compute true-track reference legs → Stage into CDU RTE**. User must manually press `<ACTIVATE` (LSK L5) and `EXEC` before the legs are stored as ACT reference data.
5. `cdu-standalone-v6/nav-map-overlay.js` paints a source-coordinate, north-up geographic overview of an **already committed** route on the rectangular EHSI **PLAN** mode. It draws no route for pending-only entries. The image is auto-fit and explicitly labelled **NOT AIRCRAFT-CENTERED / NO IRS / NO LNAV**. WPT names are optional according to existing WPT/range controls. Source identity and lat/lon bounds checked before drawing; anti-meridian unwrapping supported.
6. Existing locked **EFIS CP v3** is entirely unchanged. No approved EFIS assets/hitboxes/animation have been modified.

## Verified against actual private database

The source database for AIRAC 2610 and its geometry overlay were opened read-only, checked by existing `NavigationEngine` source marker and Stage-2 source SHA-256 link.

Example: `OIII → DCT REVUR → OIIE`:
- 2 real-source coordinate legs, **29.148 NM + 16.081 NM**, total **45.229 NM** (spherical great-circle reference, not magnetic nor flyable guidance).
- EHSI PLAN projection yields `OIII → REVUR → OIIE` with no autopilot or LNAV command.
- SID catalogue for OIII can be queried, but no source SID is automatically stitched into these legs.

## Local startup (Windows)

You need Python 3.10+, a checkout of this repository, and the existing private ZIP from your Library:
`/B737/NAVDB/NPE_STAGE2/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE2_PRIVATE.zip`.

From the repository root:

```powershell
python navigation/fmc_server.py --private-zip "C:\Private\B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE2_PRIVATE.zip" --root . --port 8765
```

Open `http://127.0.0.1:8765/navigation/fmc-lab/index.html`.

On the right-hand CDU: RTE → enter ORIGIN, DEST; NEXT PAGE → enter your explicit VIA/TO pairs. In the left lab choose **Read route entered in CDU**, **Compute**, **Stage**; then press CDU `<ACTIVATE`, `EXEC`; open **LEGS**, and turn EFIS MODE to **PLAN** to see the reference map.

No private navigation database is served by GitHub Pages; an ordinary public Pages link cannot compute private-data routes. This is deliberate, not a deployment failure.

## Tests

```bash
python tests/fmc-route-engine.test.py
node tests/cdu-nav-integration.test.cjs
node tests/cdu-nav-draft.test.cjs
node tests/cdu-nav-map.test.cjs
```

Last local check: all 9 synthetic Python route tests and all three Node integration/route-map suites passed. Real private source sample test passed.

## Unimplemented and blocked

- Full verified EP-FSI FMC path terminators / inbound/outbound sequencing for SID, STAR, approach, hold, turn, intercept, vectors, RF/CF/DF/TF legs.
- Reliable magnetic variation and track/heading translation per source date.
- Live aircraft position and IRS/ADC state; leg activation / turn anticipation / cross-track steering.
- LNAV / VNAV coupling to AFDS and autothrottle, auto sequencing, altitude/speed restrictions, missed approach.
- Correct aircraft-centered/range-scaled live MAP geometry. PLAN is **source-coordinate auto-fit** until real ownship and FMC path geometry are implemented.
- Browser live acceptance on user's Windows computer.

**Product terminology:** completed **NAVDB reference-route → CDU / EHSI integration Stage 4**, NOT completed aircraft-accurate navigation or automatic flight.
