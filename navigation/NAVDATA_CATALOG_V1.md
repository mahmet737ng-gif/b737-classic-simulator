# AIRAC 2610 — NAV DATA Indexed Catalog v1

**Status:** Backend catalog implementation, read-only/private; not an FMC-operational NAVDB installation and not a new CDU screen. No locked CDU artwork, fonts, geometry, or key mappings changed.

## Verified input (user-provided private NPE Stage1)

- Source header (strict): `//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1`
- SQLite integrity: `ok` in local source inspection.
- 17,214 airports, 42,644 runway rows, 15,800 navaids, 310,806 waypoints, 105,425 airway fix rows, 100,562 procedure records.
- **0 validated FMC procedure legs**. These are *source records*, not executable ARINC 424 paths.
- Existing source indexes are reused: `idx_airports_icao`, `idx_rwy_icao`, `idx_navaids_ident`, `idx_waypoints_ident`, `idx_airways_ident_seq`, and `navdb_procedure_ident_idx`.
- The local 2610 source is restricted licensed/user-provided material. Do **not** commit, redistribute, or place it in a public Pages asset directory.
- AIRAC 2611 dates and the bank shell do not constitute imported 2611 source data. No source is relabeled 2611.

## Implemented contract

`navigation/navdata_catalog_v1.py` reads the owner-provided Stage1 SQLite directly via `mode=ro` and `PRAGMA query_only=ON`. Constructor rejects wrong AIRAC source marker/status, missing required indexes, or unexpected executable leg rows. Public API: `NavCatalog(db).airport(icao)`, `runways(icao)`, `fix(ident,kind='waypoints'|'navaids')`, `airway(ident)`, `procedures(icao,kind)`, and `summary()`.

- No fuzzy or invented source matches; raw global duplicate FIX idents require exact source ID disambiguation before future RTE use.
- Input identifiers are uppercase/allowlisted; lookup returns bounded results (maximum 100), `has_more` and `fmc_executable:false`.
- Procedure rows retain their decoded-source status; no automatic joins, route discontinuity removal, TF/CF/DF assignment, LNAV, VNAV or AFDS command.
- This stage does not switch the live ACTIVE NAV DATA bank and does not bypass `engine/ch11/fmc-airac-banks-v1.js`.

## Local use on Windows with the private source

Extract the user's already-owned `B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1_PRIVATE.zip` **outside** the public repository and webroot. Then, from the simulator checkout (Python 3.10+):

```powershell
python navigation/navdata_catalog_v1.py --db "C:\Private\B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite" summary
python navigation/navdata_catalog_v1.py --db "C:\Private\B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite" airport OIII
python navigation/navdata_catalog_v1.py --db "C:\Private\B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite" runways OIII
python navigation/navdata_catalog_v1.py --db "C:\Private\B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite" procedures OIII SID
python navigation/navdata_catalog_v1.py --db "C:\Private\B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite" fix THR --kind navaids
python -m unittest discover -s navigation/tests -p "test_navdata_catalog_v1.py" -v
```

## Acceptance results

- Six synthetic tests passed in the development runtime, covering real lookup interfaces, duplicated FIX identifiers, invalid requests/read-only writes, mismatched AIRAC, missing indexes, and unexpected procedural legs.
- Real private SQLite `summary`, `procedures OIII SID`, and multiple category lookups were exercised; `PRAGMA quick_check` returned `ok`.
- CI on GitHub and real CDU display were **not** confirmed by this local test alone.

## Next integration gate

Connect this private-only catalog to the existing Stage6 local server via a strictly localhost API with no static source exposure; then connect RTE, DEP/ARR and LEGS via reference-only selectors. The code does not treat partial source semantics as an executable FMC NAV DATA bank. A separately sourced and fully decoded AIRAC 2611 import remains outstanding.
