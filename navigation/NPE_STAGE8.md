# NPE Stage 8 — ARINC Evidence Gate + Reference Position Diagnostics

**AIRAC 2610 Rev.1 · Boeing 737 Classic / EP-FSI simulator development only. Not for operational navigation.**

## Verified capabilities

- Mandatory provenance marker: `//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1`. No information before this header is used in data import or navigation calculation.
- Independently validates *explicit, separately supplied* ARINC-424-style leg records (IF/TF/DF/CF and named remaining types) with source file, line, source checksum, original coded record, and fix geometry. Fails closed on missing evidence. The current supplied SID/STAR/APP narratives do **not** supply the explicit codes needed to populate this importer.
- Supports reference geometry for explicit TF; IF anchor; DF terminating fix; CF specified terminating course. Aircraft operational leg execution is **always disabled** regardless of typed source evidence until aircraft compatibility/source coding is independently checked.
- Reads a saved Stage-4 private draft flight plan, checks AIRAC 2610, source provenance, fixed route distances and order, and extracts individual contiguous airway-to-airway WGS84 **reference chords**.
- Uses no connection through *any* stored `ROUTE DISCONTINUITY`, SID, STAR, APP procedure marker or gap. No path inference across unresolved transition, hold, heading, track, radar vector, intercept, or altitude conditional instruction.
- Computes signed cross-track error (right of inbound course positive), along-track distance, distance to selected FIX, and whether the selected position is before/on/past the reference chord. The user explicitly selects the chord; **no automatic leg sequencing, turn anticipation or aircraft-control commands**.
- Private localhost-only HTTP API and source-coordinate QA map. Original approved CDU/EHSI visual/photo assets unchanged.

## Complete private source audit

All **100,562** procedure identities, **236,879** source expression records and **866,183** decoded nodes scanned. No explicit ARINC path-terminator-coded row found in the existing `procedure_legs` table or decoded AST (`source_424_coded_legs=0`, `explicit_arinc_types_in_ast=0`). Accordingly **zero** FMC-approved procedural legs can be asserted from these source files alone. Uncertainty is preserved, not guessed.

Stage-4 private test case OIII → OIMM: **10 contiguous enroute reference chords** from **11 waypoint records** and **4 hard discontinuities**. All source coordinate and stored-distance checks passed.

QA: **25 Python tests passed**, including 1 real private SQLite integration test and 6 live localhost HTTP endpoint/error checks. Chromium **DOM rendering passed using responses from the real private SQLite with browser network mocked**, because the execution environment blocked Chromium direct localhost access. **Windows/iPad real-device acceptance not performed.**

## Start locally on Windows

From the simulator repository root, install Python 3.10+ (stdlib-only server). Download and keep the private Stage-4 archive outside the public checkout, then run:

```powershell
python navigation/npe_stage8_server.py --stage4-zip "C:\Private\B737_NAVDB_AIRAC2610_NPE_STAGE4_PRIVATE.zip" --root . --port 8768
```

Open in browser: **http://127.0.0.1:8768/navigation/npe-stage8/index.html**

The Stage-8 private archive contains the original small Stage-4 SQLite fixture in the same `NPE_STAGE4/NPE_STAGE4_FLIGHT_PLANS_PRIVATE.sqlite` path, so it can also be passed to `--stage4-zip`. The server extracts that file to an operating-system temporary directory **outside** the website root and deletes it on exit. It does not publish any private data through GitHub Pages.

Endpoints: `GET /api/stage8/status`, `GET /api/stage8/plans`, `GET /api/stage8/reference?id=1`, `POST /api/stage8/position` with `{ "plan_id":1, "reference_leg_index":0,"position":{"lat":35.7,"lon":51.3}}`. Only `127.0.0.1` / `localhost` Host accepted; no CORS.

Unit/integration checks:

```powershell
python -m unittest discover -s navigation/tests -p "test_npe_stage8*.py" -v
# private integration additionally requires the Stage-4 extracted SQLite:
$env:NPE_STAGE8_PRIVATE_STAGE4="C:\Private\NPE_STAGE4_FLIGHT_PLANS_PRIVATE.sqlite"
python -m unittest discover -s navigation/tests -p "test_npe_stage8*.py" -v
```

## Still blocked / required for complete FMC

The user-supplied PMDG SID/STAR zip contains source narrative statements but **no confirmed per-leg explicit ARINC-424 path terminator code**. A verified authorized ARINC-424 terminal coding source (or OEM FMC source-level leg coding) for AIRAC 2610 is required to identify real TF/DF/CF/FA/VA/etc, turns, fly-by/fly-over, altitudes/speeds, missed approaches, holds and transitions. A proper EP-FSI fitted-FMC AFM/FCOM feature and sensor/IRS/AFDS model must then be cross-checked with actual simulator behavior. **No code developed here claims that a source narrative FIX is a true TF leg.** A browser test on the user's hardware is still required.

Historical official FAA descriptions explain TF, DF and CF differences: [FAA AIM](https://www.faa.gov/air_traffic/publications/atpubs/aim/aim0102.html). These are interpretive references, not evidence that this particular private dataset carries correct per-leg coding.

*Flight safety:* All outputs are read-only diagnostics for a simulator; cannot command LNAV, VNAV, flight directors, autothrottle, or AFDS.