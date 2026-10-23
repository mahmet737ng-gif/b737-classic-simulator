# B737 Classic — NPE Route Geometry Engine, Stage 2

**AIRAC 2610 Rev.1 | Global PMDG/Navigraph private user data | Simulator development only.**

This stage builds a **read-only reference geometry overlay**, not executable FMC/ARINC-424 legs. Source data are privately provided and must not be re-published. The worldwide Stage-1 database remains unchanged. The Stage-2 overlay is explicitly linked by the Stage-1 database SHA-256, AIRAC marker and the import revision. It is impossible to join an overlay to a different Stage-1 file without detection in the reader.

## Deliverables

- `B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite`: original normalized worldwide navdata and SID/STAR/APP AST; SHA-256 `9f8a491a7bce9fc4709a15e7576b0bc990cc4fa4b5d483074f7ce4d4ceb5520e`
- `B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE2_GEOMETRY.sqlite`: geometry reference overlay (no duplicated flight procedure source text).
- `route_geometry.py`: geographic point resolver, spherical great-circle reference distances/initial/final TRUE bearings; local-source-before-global resolution, reject ambiguous global duplicates, quarantine incomplete sources.
- `geometry_reader.py`: filter source procedure, runway and transition, then return separate geometry segments; no artificial stitching.
- `qa_geometry.py`, `test_geometry.py`, `geometry_report.json`, `qa_report.json`, `private_sample_geojson.json`.
- Stage-1 `procedure_decoder.py` and `npe_reader.py` are provided for reproducible reading.

## Measured results

| Quality measure | Result |
|---|---:|
| Worldwide SID/STAR/APP procedures | 100,562 |
| Source expressions processed | 236,879 |
| Explicit point references | 756,736 |
| Uniquely positioned points from approved files | 756,524 |
| Quarantined points (incomplete ZYYJ source) | 212 |
| Read-only reference chords between consecutive fixes within same source expression | 360,425 |
| Non-executable event instructions | 189,226 |
| Very long chords >200 NM, flagged for review | 187 |
| Missing or ambiguous point identifiers in complete source files | **0** |
| Executable FMC LEGS created | **0** |
| Independent synthetic unit tests | 13 / 13 passed |
| Full edge-source consistency check | 360,425 / 360,425 passed |
| SQLite integrity / FK checks | PASS |

The reference-chord lengths and TRUE courses are **spherical geodesic estimates**. They are not magnetic courses, verified turn paths, glide paths, ARINC path terminators, procedural sequence connectors or autopilot guidance. No interpretation of `TRK` vs `HDG`, `INTERCEPT RADIAL`, `TURN DIRECT`, holds, missed approach, runway role or transitions is activated here.

## Exact source rule (mandatory)

The only allowed source text starts at the exact line:

`//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1`

Everything preceding that marker is excluded at the source importer. Stage-2 will accept only Stage-1 files whose batch records guarantee the marker as the first eligible line. Incomplete `ZYYJ` records are preserved only for audit, with no coordinates or displayed chords.

## Read-only commands

```bash
python route_geometry.py B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE2_GEOMETRY.sqlite --report geometry_report.json --sha256 9f8a491a7bce9fc4709a15e7576b0bc990cc4fa4b5d483074f7ce4d4ceb5520e
python geometry_reader.py --db B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite --geometry B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE2_GEOMETRY.sqlite OIII APP ILS29R --runway 29R
python qa_geometry.py B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE2_GEOMETRY.sqlite --output qa_report.json
python -m unittest test_geometry -v
```

## Handoff — Stage 3

1. Validate path terminator grammar for TRK, HDG, RADIAL INTERCEPT, TURN DIRECT, HOLD and runway/missed-approach sequence against equipment-specific AFM/FCOM and authoritative source rules.
2. Confirm magnetic variation/datum and units, leg transition selection, and lateral/nav guidance logic.
3. After cross-check with charts, issue certified simulator flight legs for CDU/EFIS on a separately gated path. **Do not activate by treating reference chords as flight legs.**

**Never use these data for real-world navigation.**