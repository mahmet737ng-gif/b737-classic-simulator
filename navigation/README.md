> **NPE STAGE 1 COMPLETED (AIRAC 2610 R1):** All 100,562 SID/STAR/APP procedures and 236,879 source segments now have a lossless, read-only AST in a **private** worldwide SQLite. 100,525 source-structure clean; 37 from incomplete ZYYJ are blocked. 0 unknown tokens, 0 active FMC flight legs. Exact post-AIRAC marker reading is mandatory. See [NPE Stage 1](NPE_STAGE1.md), [decoder](procedure_decoder.py), [source registry](source_registry.json). Do not confuse decoded source expressions with verified flyable FMC legs.

> **SID/STAR/APP UPDATE — AIRAC 2610 Rev.1:** The private global SQLite now includes 36,231 SID, 31,107 STAR, and 33,224 Approach procedure identities, plus 91,267 transitions, local fixes and runway clauses. Source scope: 7,319 TXT files, all parsed **only after** the exact `//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1` marker. **Never parse or use preceding lines** in any flight-data calculation; fail closed if the header is missing. ZYYJ has a truncated source and is quarantined. All procedures are source-exact, NOT FMC-executable verified legs. Data + importer are private in Library `/B737/NAVDB/B737_NAVDB_WORLD_AIRAC2610_WITH_SID_STAR_APP_PRIVATE.zip`. For current source priority, see [registry](source_registry.json).

> **WORLDWIDE DATA UPDATE (AIRAC 2610 R1):** The user-supplied PMDG/Navigraph/Jeppesen navigation dataset has been imported into a **private 491,889-row SQLite database** saved in ChatGPT Library `/B737/NAVDB/`. See [source registry](source_registry.json) and [worldwide private import notes](PMDG_WORLD_PRIVATE_IMPORT.md). The earlier OurAirports-based **Iran-only importer below remains a separate fallback**, not the active worldwide importer. No restricted binary data is in this public repo; FMC/CDU integration remains gated.

# B737 Classic Iran-only Navigation Database (NAVDB IR v0.3)

**Simulator training only — NOT for operational flight navigation.**

The importer accepts only `iso_country=IR` airports and navaids from the OurAirports public-domain CSVs. Runways and communications frequencies are accepted only when their `airport_ref` belongs to an imported Iranian airport. Airport inclusion is **not** defined by ICAO prefix, allowing any valid Iranian airport record (including local/unregistered codes). No non-Iran records appear in the SQLite file.

## Sources and provenance

- [OurAirports](https://ourairports.com/data/): public-domain worldwide source CSV files (downloaded whole because provider offers bulk CSV), **filtered before SQLite import**; all source-file SHA-256 and retrieval timestamps are preserved. The raw worldwide CSVs are neither part of the release ZIP nor the GitHub Actions output artifact.
- **No FAA CIFP staging** in Iran-only builds. Legacy `--faa-file` and `--faa-cycle` arguments deliberately fail closed.
- Iranian waypoints, airways, SID, STAR, approaches, and their verified path terminators/constraints still need a rights-cleared Iranian AIP/ARINC source. Empty tables are not evidence of missing real-world procedures.

## Build and query

Requires Python 3.10+ (standard library only):

```bash
# Download source CSV files; filter IR before inserting into the DB
python navigation/navdb.py build --download --data-dir navigation/data --db navigation/navdb-iran.sqlite

# Rebuild offline from source CSV cache
python navigation/navdb.py build --data-dir navigation/data --db navigation/navdb-iran.sqlite

# Inspect Iranian airports and QA metadata
python navigation/navdb.py summary --db navigation/navdb-iran.sqlite
python navigation/navdb.py airport OIII --db navigation/navdb-iran.sqlite
python navigation/navdb.py export OIII OIIE OIMM --db navigation/navdb-iran.sqlite --output navigation/iran-airports.json

# Unit tests (synthetic fixtures, not real navigation data)
python -m unittest discover -s navigation/tests -v
```

## QA and safety gates

- Missing source-country columns fail closed. Non-Iran rows are counted separately as `skipped_outside_iran`, not invalid/rejected data.
- The build is atomic; on download, parsing or validation failure the previous SQLite DB remains intact.
- Source provenance and `metadata.iso_country=IR` are mandatory. No foreign airport, navaid or associated runway/frequency may enter the released DB.
- This is a **source library**, not a verified FMC navigation cycle. `waypoints`, `airways`, `procedures` and `procedure_legs` remain empty until a validated Iran-specific importer is implemented. No auto-generation of fake legs/altitude constraints.
- Cockpit UI, existing systems and active CDU/FMC data are unchanged.

## GitHub Actions

[.github/workflows/navdb.yml](../.github/workflows/navdb.yml) runs unit tests, downloads source CSVs, builds the **Iran-only** database, checks country isolation/integrity and exports Iranian sample airports. The artifact contains the SQLite database and reports only (no global CSVs). This workflow runs on pushes affecting navigation code, weekly, or manually.
