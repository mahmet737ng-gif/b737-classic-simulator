# Private AIRAC 2610 NAV DATA ↔ Stage6 ↔ CDU / Unified bridge

**Implementation:** Local/private source-reference integration. The source is the owner's AIRAC 2610 Stage1 SQLite (within the private Stage3 archive); not a certified/flight-executable FMC bank. AIRAC 2611 remains **calendar metadata only** unless the owner supplies validated 2611 NAVDATA.

## Run on Windows (from this GitHub repository checkout)

Keep both previously supplied licensed private ZIP archives OUTSIDE the repository/webroot. Python 3.10+:

```powershell
python navigation/npe_stage6_server.py --stage3-zip "C:\Private\B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE3_PRIVATE.zip" --stage4-zip "C:\Private\B737_NAVDB_AIRAC2610_NPE_STAGE4_PRIVATE.zip" --root . --port 8766
```

Open the **Unified cockpit with two embedded CDUs**:
`http://127.0.0.1:8766/panel-mosaic-lab/cockpit/index.html`

Or test the standalone CDU:
`http://127.0.0.1:8766/cdu-standalone-v6/index.html`

The localhost requirement is intentional: opening the CDN/GitHub Pages deployment does **not** attach the private source. The source is mounted temporarily for the local process; no SQLite, SID/STAR archive or derived licensed record is committed to public git.

## Real-source RTE / DEP-ARR behavior

1. On RTE enter `OIII` at L1 (ORIGIN), `OIMM` at R1 (DEST), and `29R` at L3 (RUNWAY). The source-indexed API must verify the airport records and the runway belongs to the selected ORIGIN before updating the normal CDU staged fields. Unknown identifiers display `NOT IN NAV DATA`. A disconnected or invalid source rejects the entry rather than silently accepting an invented airport.
2. On RTE page 2 (`FLIGHT_PLAN`), the four VIA entries query the real AIRWAY index. TO entries query the real waypoint **and** navaid indexes. Ambiguous global identifiers are blocked with `DUPLICATE WAYPOINT`; there is no implicit arbitrary coordinate selection.
3. Open the existing FCOM DEP/ARR index. Without a saved Stage4 plan, L1 opens SID for origin, R1 opens STAR for origin, and R2 opens STAR for destination, using the existing physical key positions. On a read-only destination STAR list, R4 switches to Approach for that same airport. LSK L1–L5 select listed procedures, runway and transition; L6 returns.
4. The read-only procedure selector records `state.navdataReferenceProcedures` and displays `SID SOURCE ONLY` or equivalent. It **does not** set `stage6PendingPlan`, switch an ACTIVE FMC NAV DATA bank, turn on EXEC or connect procedure legs to LNAV.
5. If a genuine saved Stage4 private reference plan has been selected and committed, the earlier Stage6 select → compose → RTE L5 ACTIVATE → EXEC *reference-only* flow remains available; unresolved discontinuities remain hard stops. This is a separate workflow from browsing source procedures without a plan.

### Private localhost lookup contract

Strict GET `/api/stage6/navdata`:
- `?kind=airport&ident=OIII`
- `?kind=runways&airport=OIII`
- `?kind=waypoints&ident=FIX1`
- `?kind=navaids&ident=VOR`
- `?kind=airways&ident=A1`
- `?kind=procedures&airport=OIII&ident=SID`

Responses preserve `airac: "2610"`, `mode: "SOURCE_REFERENCE_ONLY"`, `fmc_executable: false`, and `lookup.rows`, `lookup.has_more`. No query accepts duplicate query parameters, unsupported extra fields or a missing verified local source. Existing `/api/stage6/catalog`, `/semantics` and `/compose` remain available.

## Verification

- The actual private Stage1 SQLite was inspected for correct schema, marker, six indexed categories, and `PRAGMA quick_check=ok`; local catalog regression: **6 passed**.
- The updated CDU factory was evaluated against the existing core/pages in an isolated JS harness: OIII, OIMM, 29R lookup-to-staged-route and no-plan SID source-only selection succeeded.
- The source contains additional Python loopback API and Node CDU tests, run automatically by `.github/workflows/navdata-stage6-bridge.yml` once GitHub Actions executes it. **Their GitHub-run PASS status has not yet been independently verified.**
- There has been **no real Windows browser/hardware acceptance test**. The original CDU physical artwork, 70 control hitboxes and typography assets remain unchanged.

## Future blockers

AIRAC 2610 NAVDATA contains narrative procedures and reference geometry, but no verified ARINC 424 terminal-leg path-terminator encoding to generate executable aircraft-specific SID/STAR/APP flight legs. FMC/AFDS/LNAV/VNAV must not silently activate these. A clean ARINC source, actual EP-FSI aircraft semantics and resolved duplicate waypoint selection are future prerequisites.
