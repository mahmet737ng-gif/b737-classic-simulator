# NPE Stage 5 — CDU RTE/DEP-ARR/LEGS and EHSI PLAN source preview

Boeing 737 Classic EP-FSI — AIRAC **2610 Rev.1** (2026-10-01 to 2026-10-29, exclusive).

This stage **integrates the private Stage-4 draft flight-plan models into the existing approved CDU v6 interface** via new additive, read-only presentation and MOD/ACTIVATE/EXEC reference-state tracking. The existing cockpit photo, clickboxes, EFIS photo controls and animation remain unchanged.

## What runs

- `navigation/npe_stage5_server.py`: private loopback-only local server (default port **8766**) with `GET /api/stage5/status`, `/plans`, `/plan?id=N`, `/procedures` (when Stage 1–3 configured), and `POST /api/stage5/compose` (requires private Stage 1–3). All payloads fail closed on source marker, AIRAC, activation and discontinuity-count integrity. No private SQLite is copied under webroot.
- `navigation/npe-stage5/`: test lab with approved CDU v6 iframe, source-verified saved flight plans, and optional source-runway/transition selector + Stage4 compose.
- `cdu-standalone-v6/stage5-model.js`: pure source-locked plan validator, source-only RTE/LEGS/DEP-ARR presentation, non-connectable discontinuity boundaries.
- `cdu-standalone-v6/stage5-adapter.js`: additive display in existing CDU image, keeps pending `MOD` until captain clicks physical LSK L5 `<ACTIVATE` then `EXEC`. After that `ACT` is **ACT REFERENCE ONLY**, never active FMC/LNAV. Blocks premature EXEC and unrelated field changes.
- `cdu-standalone-v6/stage5-map.js`: only committed/sourced FIX-to-FIX reference chords on the EHSI PLAN display, **breaks at every discontinuity**, no ownship/IRS/range claims.
- `navigation/tests/test_stage5_service.py` and `cdu-standalone-v6/tests/stage5-model.test.cjs`: synthetic-only tests safe to commit publicly.

## Mandatory source boundary

Every source procedure must have been imported only from this precise per-file marker:

```
//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1
```

All bytes before it are ignored. An absent or changed marker fails closed. Source-cycle, procedure identity, and data-count integrity gates are not bypassed by page switching. The truncated `ZYYJ` source is never made executable.

## How to launch on Windows

1. Clone the simulator repository (or update it) and install Python 3.10+.
2. Obtain the **private** `B737_NAVDB_AIRAC2610_NPE_STAGE4_PRIVATE.zip` from the user's Library; do NOT add private data to a public GitHub directory.
3. From the repository root run:

```powershell
python navigation/npe_stage5_server.py --stage4-zip "C:\Private\B737_NAVDB_AIRAC2610_NPE_STAGE4_PRIVATE.zip" --root . --port 8766
```

4. Open **http://127.0.0.1:8766/navigation/npe-stage5/index.html**. Load an existing saved draft and press **Stage as MOD in CDU**. On CDU: `RTE` → `<ACTIVATE` (LSK L5) → `EXEC`. Then `LEGS` or `DEP/ARR`; set EHSI MODE to `PLAN` to view discontinuity-separated source/reference chords. It cannot command the aircraft.

For building *new* Stage-4 plans, add all of the already-imported **private** Stage 1, 2, and 3 SQLite filenames using `--stage1 ... --stage2 ... --stage3 ...`. This enables source catalogue lookup and `POST /api/stage5/compose`. It does not magically make procedure path-terminator geometry executable.

## QA completed

- Synthetic JS test: source identity, strict cycle, corrupted ACTIVE flag, discontinuity count, page pagination, reference chord gaps, EHSI PLAN-only, MOD→ACTIVATE→EXEC and rejection of premature EXEC.
- Synthetic Python service tests: original provenance metadata, invalid marker, old/active data and saved plan retrieval.
- Private real Stage-4 data: OIII→OIMM, 20 items, 11 source enroute FIXes, **4 mandatory discontinuities**, 1 contiguous reference enroute geometry chain, never an executable leg.
- This is **not yet full Boeing FCOM verified LSK-based procedure selection**, not LNAV/VNAV, magnetic track/heading, speed/alt constraints, leg sequencing, capture logic, TOD/TOS, AFDS or simulator ownship.

Private data and derivative sample are retained **only** in the user's private Library. Public repo contains engine and synthetic tests only. Simulator development use only; never for actual navigation.