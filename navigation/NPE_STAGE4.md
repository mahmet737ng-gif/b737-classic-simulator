# Boeing 737 Classic — NPE Stage 4 / Flight Plan Draft Engine

**AIRAC 2610 Rev.1 (01 Oct–29 Oct 2026). Simulator engineering only; not for real navigation.**

## Completed

- A **fail-closed source-chain** gate checks the exactly matching AIRAC 2610 marker on Stage 1, the private Stage 1 and Stage 2 SHA-256 values pinned into Stage 3, and prohibits unexpected active FMC rows.
- A Route Composer accepts explicit **origin/destination ICAO**, optional **SID, STAR, APP** identities with optional user-selected runway/transition, ordered **AIRWAY** sections with exact entry/exit identifiers, and **DCT** selections with a unique worldwide `waypoint_id` and matching ident.
- Airways are read forward/reverse by their published ordered `seq`, with missing and ambiguous IDs/waypoints rejected. When two airway sections meet on the same named FIX within 0.25 NM, only the **identical shared FIX** is consolidated. Missing junctions generate an explicit discontinuity.
- All airport/procedure and enroute/procedure interfaces are kept as **ROUTE DISCONTINUITY** unless independently verified. The software **does not infer the order** of BASE/RUNWAY/TRANSITION source expressions and never creates artificial SID/STAR/APP connectors.
- Generates **read-only CDU RTE/LEGS page models** (five data rows per paginated page), with source-specific path and true-course reference values labeled non-executable. No automatic altitude/speed constraints, magnetic variations, missed-approach chaining or route activation.
- A small **Stage 4 private SQLite overlay** stores the candidate plan, provenance, route items and per-page source references. It can be read without modifying any Stage 1–3 data.
- Independent tests cover reversed airway traversal, repeated identifiers, discontinuities, atomic SQLite preservation, page pagination, corrupted AIRAC metadata, tampered activation and antimeridian distance. Private real-data integration and QA tests verify actual AIRAC 2610 selections and row provenance.

## Validation

Synthetic unit tests **17 PASSED**. Private dataset integration tests **8 PASSED**. End-to-end OIII → OIMM **LAB EXAMPLE ONLY**: 11 enroute FIX rows and 4 intentional discontinuities; all 11 rows traced back to imported source line/file, every remaining discontinuity verified. **No simulated FMC legs active**.

**The example is only a software integration test. It is not a verified flight route or departure/arrival clearance.**

## Files

`flight_plan_engine.py`, `flight_plan_reader.py`, and `qa_stage4.py` are general reusable code. `test_flight_plan_engine.py` and `test_flight_plan_reader.py` use only synthetic fixtures and can be published to the public simulator repo. The following belong **only in the private package / Library**:

- `NPE_STAGE4_FLIGHT_PLANS_PRIVATE.sqlite` — private output overlay
- `sample_request_OIII_OIMM.json` and `sample_flight_plan_PRIVATE.json` — private licensed source extract and selection example
- `test_stage4_private_integration.py` — private data tests
- `qa_report.json` and `manifest.json` — private release provenance

## Build and read

Place the three previous **private** databases from Stages 1, 2 and 3 at the paths below, or point the flags at their locations. No new global data is downloaded or redistributed.

```bash
python flight_plan_engine.py \
  --stage1 /private/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite \
  --stage2 /private/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE2_GEOMETRY.sqlite \
  --stage3 /private/NPE_STAGE3_INTENTS.sqlite \
  --request sample_request_OIII_OIMM.json \
  --output flight_plan_private.json \
  --sqlite-output NPE_STAGE4_FLIGHT_PLANS_PRIVATE.sqlite

python flight_plan_reader.py --db NPE_STAGE4_FLIGHT_PLANS_PRIVATE.sqlite --page RTE --number 1
python flight_plan_reader.py --db NPE_STAGE4_FLIGHT_PLANS_PRIVATE.sqlite --page LEGS --number 2
python qa_stage4.py --stage1 /private/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite --stage4 NPE_STAGE4_FLIGHT_PLANS_PRIVATE.sqlite
python -m unittest -v test_flight_plan_engine test_flight_plan_reader
```

The source data is user-supplied Navigraph/Jeppesen/PMDG and carries redistribution restrictions; **never commit the SQLite or its licensed sample extracts to a public GitHub repository.** Public repository contains code and synthetic tests only.

## Future gate — Stage 5

Build the **CDU navigation adapter** for RTE/DEP-ARR/LEGS preview and explicit MOD/EXEC flows. Authentic EP-FSI FMC leg path terminator semantics, magnetic bearings, source transitions, the airborne geometry of heading/holds/turns, performance/altitude/speed constraints and navigation display validation must all be approved before enabling active FMC guidance. This Stage 4 release is a **draft route editor**, not a verified FMC.