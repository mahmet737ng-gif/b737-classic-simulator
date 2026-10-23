# B737 Classic NAVDB — NPE Stage 3 / Flight-leg Mathematical Engine

**AIRAC 2610 Rev.1 (01 Oct 2026–29 Oct 2026).** Simulator engineering only. **NOT for real-world navigation.**

## What is implemented

- Verified source-chain intake: private Stage 1 source AST, private Stage 2 spatial references and new private Stage 3 classification overlay.
- Exactly **189,226** event-intent rows classified (TRK, HDG, TURN DIRECT, HOLD, RADIAL INTERCEPT and ATC VECTORS), each with source identity, optional known anchor, original source token, required inputs and individual blockers.
- Independent mathematical engine: WGS84-like spherical reference destination, great-circle distance/course, directed great-circle ray intersection, explicit magnetic-to-true conversion with supplied east variation, heading-versus-track wind vector, constant-bank turn integration, and **one synthetic established holding circuit**. Holding entry/exit, vertical guidance and actual FMC path sequencing are *not* implemented.
- Fail-closed query interface: source airport/procedure/runway/transition selection without implicit variant stitching. Example hold preview only with explicit frame, sourced and confirmed time/distance units, TAS, bank, wind and known fix coordinates.
- 21 tests (15 mathematical, 2 classification, 4 private-dataset integration), complete database QA for all source event identities, SQLite integrity, and source hash chain.
- **Zero activated FMC legs.** `geometry_readiness=PARAMETERIZED_MATH_ONLY` is not a flight-path approval; `NOT_EXECUTABLE` remains mandatory.

## Important distinction: mathematical model vs real aircraft

A source phrase such as `TRK 285 UNTIL 4360` does not supply the current position, route leg entry state, verified magnetic variation or climb profile needed to locate its end on Earth. In this dataset the raw path-terminator semantics for the installed EP-FSI FMC must still be checked; no bearing, altitude termination, turn arc or intercept is auto-converted into guidance. All 50 special commands belonging to incomplete `ZYYJ.txt` source remain blocked.

Heading and track are different: a heading with wind yields a *ground track*; a track is the desired ground direction. Bearing conversions use `true = magnetic + easterly variation` and **reject missing variation**. Turn simulation requires caller-supplied TAS, bank, wind; no general aircraft bank limits or proprietary FMC algorithms have been inferred. A hold preview is a **single stable racetrack**, assumes explicit zero wind and cannot enter or leave a hold.

## Private package structure

```
private_data/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite
private_data/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE2_GEOMETRY.sqlite
private_data/NPE_STAGE3_INTENTS.sqlite
engine/flight_leg_math.py
engine/leg_intent_overlay.py
engine/leg_preview_reader.py
engine/qa_stage3.py
engine/npe_reader.py
engine/procedure_decoder.py
engine/test_flight_leg_math.py
engine/test_stage3_integration.py
engine/README.md
engine/import_report.json
engine/qa_report.json
engine/manifest.json
```

Run the source DBs locally in separate files; do **not** overwrite Stage 1/2 data. Add `engine/` to `PYTHONPATH` before using reader/API.

### Read a procedure's unresolved intents

```bash
python engine/leg_preview_reader.py \
  --stage1 private_data/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite \
  --stage2 private_data/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE2_GEOMETRY.sqlite \
  --stage3 private_data/NPE_STAGE3_INTENTS.sqlite \
  OIII SID DAXI1A --runway 29R
```

### Tests and QA

```bash
cd engine
python -m unittest -v test_flight_leg_math
NPE_STAGE1=../private_data/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite \
NPE_STAGE2=../private_data/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE2_GEOMETRY.sqlite \
NPE_STAGE3=../private_data/NPE_STAGE3_INTENTS.sqlite \
python -m unittest -v test_stage3_integration
```

The public GitHub repository contains **code only**, not the copyright-restricted source or derived NAVDB SQLite files. The private copies are retained in ChatGPT Library `/B737/NAVDB/NPE_STAGE3/` with a provenance manifest.

## Next approval gates

1. Determine authentic EP-FSI installed FMC path-terminator capabilities and source syntax meaning per instruction (not automatically ARINC-equivalent).
2. Validate local bearing reference and magnetic variation at source date; do not assume one default for the whole world.
3. Model flight-state-dependent termination, airspeed/altitude, wind, roll-in/out, turn anticipation and hold entry/exit per documented aircraft behavior.
4. Validate procedure variant ordering and connections against real SID/STAR/APP chart semantics; fail on mismatches.
5. Only after aircraft-specific FMC tests can the data be used to populate active CDU LEGS and paint verified guidance on EHSI.