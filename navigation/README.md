> **STAGE 10 — AIRCRAFT STATE BUS + LIVE REFERENCE NAVIGATION + CDU/EHSI + AFDS BOUNDARY (AIRAC 2610 Rev.1):** Four bench-level interfaces committed and tested: validated explicit IRS/GPS telemetry schema, fresh-frame true-track/XTK/DTG reference sequencer with hard discontinuity stop, same-origin CDU/EHSI **SIM REF** overlay preserving approved cockpit artwork, and an AFDS/FD preview-only port which always denies aircraft actuator engagement. **23 Python tests with private fixture, 7 Node checks, mocked Chromium DOM PASS.** Live physical FSX/MSFS/X-Plane adapter NOT installed; device acceptance NOT verified, no aircraft AFDS/LNAV/VNAV servo commands, and no inferred coded terminal legs. Run `navigation/npe_stage10_server.py` locally with the private Stage10 ZIP; [technical notes](NPE_STAGE10.md), [bus](npe_stage10_bus.py), [live controller](npe_stage10_live.py), [lab](npe-stage10/index.html). User NAVDATA SQLite remains private in Library `/B737/NAVDB/NPE_STAGE10/`.

> **NPE STAGE 9 — SIMULATOR LATERAL REFERENCE GUIDANCE (AIRAC 2610 Rev.1):** A stateful operator-armed, fail-closed TRUE-track/XTK guidance **advisory** now sequences contiguous source-coordinate enroute reference chords, stops at any unknown procedure boundary, rejects sensor faults/stale frames, displays SIM REF on existing EHSI PLAN and includes a separate synthetic closed-loop aircraft tester. Local: **29 Python tests + JS advisory tests PASS**; Chromium DOM mock PASS, browser direct localhost and on-device trials not yet verified. **No actual FMC-approved legs or AFDS/LNAV/VNAV actuator output**; ARINC explicit coding remains absent from supplied SIDSTAR narratives. [Stage9 docs](NPE_STAGE9.md) · [guidance core](npe_stage9_guidance.py) · [private training lab](npe-stage9/index.html) · [registry](source_registry.json). The private archive is available only in Library `/B737/NAVDB/NPE_STAGE9/`.

> **NPE STAGE 8 — SOURCE CODING AUDIT + MANUAL REFERENCE POSITION LAB:** Audited 100,562 procedures, 236,879 source statements and 866,183 decoded nodes; **0 explicit source ARINC-424 path-terminator codes** in the current private narrative dataset. Implemented an evidence gate for future separately coded data and read-only reference-route position diagnostics (10 chords, 4 hard gaps in OIII→OIMM sample); **25 Python tests PASS**, Chromium DOM with private SQL response/network mock PASS, actual device acceptance not performed. No automatic sequencing, FMC executable legs, LNAV/VNAV or AFDS. [Stage8 docs](NPE_STAGE8.md), [engine](npe_stage8.py), [localhost viewer](npe-stage8/index.html), [registry](source_registry.json). Private package saved only to Library `/B737/NAVDB/NPE_STAGE8/`.

> **NPE STAGE 7 — SOURCE-FAITHFUL PROCEDURE REFERENCE GEOMETRY (AIRAC 2610 Rev.1):** Validated per-file post-marker source AST tokens and airport-file FIX coordinates; independent straight reference chords only between adjacent explicit FIX tokens in one source statement. New private localhost [geometry lab](npe-stage7/index.html) + [source leg compiler](procedure_reference_leg_engine.py) + [Stage7 report](NPE_STAGE7.md). 13 local tests, 250 worldwide source-procedure samples, 7 HTTP checks and Chromium DOM QA passed (browser network fixtures mocked; full CDU device acceptance **not verified**). No TF/DF/CF/HOLD inference, active guidance, LNAV/VNAV or AFDS; fully verified aircraft-specific path-terminator source still required. Private artifact: Library `/B737/NAVDB/NPE_STAGE7/`.

> **NPE STAGE 6 — NATIVE CDU SID/STAR/APP SELECTION (AIRAC 2610 Rev.1):** New physical LSK DEP/ARR lists and source-confirmed runway/transition selection, Stage4 reference plan recomposition, and an explicit MOD → RTE L5 ACTIVATE → EXEC reference-only commit. Backend accepts only private Stage3/4 SQLite sources on `127.0.0.1:8766`, preserves all route discontinuities, and classifies uncertain path terminators WITHOUT inventing active ARINC legs. 10 Python, 5 JS and 3 local HTTP endpoint tests passed; live browser/device visual acceptance remains unverified. Approved cockpit graphics/hitboxes and EFIS controls are unchanged; zero LNAV/VNAV/AFDS outputs. [Stage6](NPE_STAGE6.md) · [CDU selector](../cdu-standalone-v6/stage6-selector.js) · [private server](npe_stage6_server.py) · [registry](source_registry.json). Private release in Library `/B737/NAVDB/NPE_STAGE6/`.

> **NPE STAGE 5 — CDU INTEGRATION (AIRAC 2610 R1):** Added a private loopback Stage-4 draft source adapter to approved CDU v6 RTE / DEP-ARR / LEGS, with explicit MOD → LSK L5 ACTIVATE → EXEC **reference-only commit** and EHSI PLAN reference chords broken at verified ROUTE DISCONTINUITIES. The approved CDU/EFIS visuals and hitboxes remain unchanged. Private browser lab: `http://127.0.0.1:8766/navigation/npe-stage5/index.html` after starting the local Python service. **No active FMC legs, LNAV, VNAV or AFDS.** [Stage 5 documentation](NPE_STAGE5.md) · [CDU model](../cdu-standalone-v6/stage5-model.js) · [Private server](npe_stage5_server.py). Licensed binary is kept in Library `/B737/NAVDB/NPE_STAGE5/`, never GitHub.

> **FMC ↔ CDU/EHSI STAGE 4 (AIRAC 2610 R1):** Local private source DCT/AIRWAY reference routes can now be entered in CDU RTE/FLIGHT PLAN, validated before staging, committed with manual ACTIVATE → EXEC, viewed as LEGS REF, and plotted north-up in EHSI PLAN from real source coordinates. Locked EFIS CP v3 unchanged. **NOT** full FMC/LNAV/AFDS or validated SID/STAR/APP path-terminator execution. See [Stage 4](FMC_ROUTE_STAGE4.md) and [local test](fmc-lab/index.html); local Python server and private Stage-2 ZIP required.

> **NPE STAGE 4 — FLIGHT PLAN DRAFT ENGINE (AIRAC 2610 R1):** Complete: ordered AIRWAY sections including reverse traversal and shared-fix joins; exact-waypoint-ID DCT selections; source-only SID/STAR/APP selections; fail-closed runway/transition checks; mandatory ROUTE DISCONTINUITY for every unverified procedure boundary; paginated read-only CDU RTE and LEGS page models. 17 synthetic + 8 private integration tests passed; private example has 11 enroute fix references, 4 discontinuities, **ZERO active FMC legs**. [Stage 4 docs](NPE_STAGE4.md) · [Flight Plan Engine](flight_plan_engine.py) · [Page Reader](flight_plan_reader.py) · [Source Registry](source_registry.json). Private overlay stored only in Library `/B737/NAVDB/NPE_STAGE4/` (licensed data not in public GitHub).

> **NPE STAGE 3 (AIRAC 2610 R1):** 189,226 non-executable source intents now classified with strict provenance and individual blockers. Explicit-input mathematical support for true/magnetic bearing conversion, wind-corrected heading ground track, directed great-circle intercepts, constant-bank turn previews and a one-circuit synthetic hold; 21 local tests and all-source event identity QA PASS. **0 FMC-executable LEGS**, 50 source-incomplete commands blocked. Proprietary SQLite and private release preserved only in Library `/B737/NAVDB/NPE_STAGE3/`; public GitHub contains code only. See [Stage 3](NPE_STAGE3.md), [engine](flight_leg_math.py), [reader](leg_preview_reader.py), [source registry](source_registry.json).

> **NPE STAGE 2 COMPLETED — REFERENCE GEOMETRY (AIRAC 2610 R1):** The private geometry overlay geolocates 756,524 point references from approved source files and calculates 360,425 straight great-circle reference chords (TRUE bearing / distance), with 189,226 unexecuted special instructions. A total of 212 point references from incomplete ZYYJ are quarantined, and 187 >200 NM chords are flagged for review. Full integrity QA and 13 synthetic tests passed. This is **not FMC leg geometry** and no CDU/autopilot guidance has been activated. [Stage 2 details](NPE_STAGE2.md) · [Geometry engine](route_geometry.py) · [Reader API](geometry_reader.py) · [Source registry](source_registry.json). Proprietary source/derived SQLite remains private in Library `/B737/NAVDB/NPE_STAGE2/`.

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
