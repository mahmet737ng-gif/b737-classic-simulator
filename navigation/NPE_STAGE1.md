# Navigation Procedure Engine (NPE) — Stage 1 / AIRAC 2610 Rev.1

**Status:** Source-faithful decoder and read-only catalogue completed. **NOT an executable FMC leg engine. NOT for real-world navigation.**

The user-provided global PMDG NAVDATA and SidStars are private, licensing-restricted data and never belong in this public repository. The normalized **541,843,456-byte** private SQLite plus its decoder tests/report is saved in ChatGPT Library:

`/B737/NAVDB/NPE_STAGE1/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1_PRIVATE.zip`

See [source_registry.json](source_registry.json) for checksum and authoritative private paths. No derived navigation content is committed.

## Mandatory parsing rule

For every individual SidStars TXT, the only data eligible for import must begin at the EXACT marker:

```text
//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1
```

All preceding bytes are ignored, including for calculation, even if they resemble useful records. A missing or different marker is an error. The Stage 1 decoder refuses a source SQLite lacking the same import-batch marker and post-marker provenance.

## Verified Stage 1 results

| Criterion | Result |
|---|---:|
| Input SID/STAR/APP identities | 100,562 |
| Source BASE/TRANSITION/RUNWAY_CLAUSE expressions | 236,879 |
| Losslessly parsed source expressions | 236,879 |
| Clean-source procedures | 100,525 |
| Source-incomplete procedures | 37 (ZYYJ only) |
| Unknown token spans | 0 |
| Executable FMC legs generated | **0** |
| Automated tests (with private integration fixture) | 15 |
| SQLite integrity, foreign keys, and token SHA-256 roundtrip | PASS |

The decoder creates lossless AST instructions for FIX/OVERFLY, runway references, tracks, headings, turns/directs, radial intercepts, holds, ATC vectors, altitude/speed source tokens, and source transition/runway variants.

**Critical:** Passing token coverage is NOT verification of path terminators, unit systems, geometry, altitude/speed applicability, ATC vector behavior, hold entry/circuit, procedure chaining or airborne safety. Runway reference position may mean different things in SID, STAR or APP, so the AST explicitly does not invent that role. Named fixes can collide with instruction words (e.g. FIX TRK); their syntactic position is preserved.

## Source code and API

- [procedure_decoder.py](procedure_decoder.py): immutable-source AST importer into a new SQLite copy; source is never overwritten.
- [npe_reader.py](npe_reader.py): query procedure catalogues and variants by ICAO, kind, runway, transition; blocks incomplete, unsupported or ambiguous variants.
- [qa_npe_stage1.py](qa_npe_stage1.py): full reconstruction of all source expressions against their AST and source SHA-256.
- [tests/test_procedure_decoder.py](tests/test_procedure_decoder.py), [tests/test_npe_reader.py](tests/test_npe_reader.py): unit/integration tests, with optional private fixture path in `NPE_FIXTURE_DB`.

After obtaining the private SQLite file locally:

```bash
python navigation/npe_reader.py --db /private/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite list OIII --kind SID --runway 29R
python navigation/npe_reader.py --db /private/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite get OIII SID DAXI1A --runway 29R
NPE_FIXTURE_DB=/private/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite python -m unittest discover -s navigation/tests -p 'test_*npe*.py' -v
```

The read-only results may be used to develop CDU page selection but **cannot yet be used as real-time, flyable LEGS**.

## Next stage (not implemented)

1. Resolve FIX coordinates using local airport-specific definitions first; verify global duplicate identifiers and source conflicts.
2. Implement flight-path geometry, turns, holds, leg/track terminators and origin/missed-approach semantics.
3. Validate RTE/DEP-ARR/LEGS and EHSI drawing against the documented FMC fitted to EP-FSI. Do not enable active navigation until all verification gates pass.

The previous Iran-only community import remains a separate fallback; it is not silently mixed into AIRAC 2610 worldwide PMDG data.
