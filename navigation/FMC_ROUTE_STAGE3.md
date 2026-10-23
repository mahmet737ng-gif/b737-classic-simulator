# FMC navigation integration — source-linked Stage 3 (local/private)

**Status:** implemented/tested for source-identical waypoint/airway and reference geometry **only**, *not a verified flyable FMC, LNAV, VNAV, or AFDS guidance system*. For simulator training, not actual navigation.

## What has been built

- `fmc_route_engine.py`: read-only SQLite Stage-1 importer access, exact AIRAC 2610 marker check, optional Stage-2 SHA-256 source linkage and integrity gate, typed DCT/AIRWAY route parser, FIX coordinate resolution with source line provenance and fail-closed ambiguity handling, airway-sequence walk with gap rejection, true geodesic distance and initial course, airport and procedure catalogue and source-segment preview.
- `fmc_server.py`: Python standard-library HTTP service *only* on `127.0.0.1`, with 32 KiB JSON request limit and Origin check. The `/api/position` endpoint calculates **reference** cross-track/along-track from an explicitly supplied position and leg index; neither automatic sequencing nor LNAV guidance is enabled. No data uploaded to GitHub.
- `fmc-lab`: a separate route-builder UI with local source status, DCT/AIRWAY input, true-coordinate reference visualization, read-only SID/STAR/APP source preview, **diagnostic ownship-to-great-circle geometry** (explicit selected leg, cross-track and distance), and real CDU v6 iframe.
- `../cdu-standalone-v6/nav-route-adapter.js`: stage source-qualified route into existing RTE (pending); pilot manually presses RTE `<ACTIVATE` then `EXEC`; source-qualified reference legs appear in CDU LEGS. A staged route cannot silently replace an existing route. Distinct MOD/ACT states and `REF ONLY / NO LNAV` label.
- Isolated synthetic tests and real private AIRAC 2610 integration checks. Source simulator art and **EFIS CP v3 locked assets are untouched**.

## Start on Windows

Requirements: Python 3.10+, a local checkout/download of the `b737-classic-simulator` repo, and **your own existing private** Stage-2 ZIP stored outside the repository/public server directory:

`/B737/NAVDB/NPE_STAGE2/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE2_PRIVATE.zip` from the user Library (146 MB ZIP; ~825 MB temporary extraction).

In PowerShell from the repository root:

```powershell
python navigation/fmc_server.py --private-zip "C:\Private\B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE2_PRIVATE.zip" --root . --port 8765
```

Open: `http://127.0.0.1:8765/navigation/fmc-lab/index.html`

Alternate mode if you already extracted the private ZIP elsewhere:

```powershell
python navigation/fmc_server.py --stage1 "C:\Private\B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite" --stage2 "C:\Private\B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE2_GEOMETRY.sqlite" --root .
```

All data reads are local. `--private-zip` extracts only the two named SQLite files to a temporary directory outside the website root, validates provenance and deletes the temporary copies on normal shutdown. No public GitHub Pages deployment can access your private SQLite. The plain online GitHub Pages UI is not a functional private source server.

## Sample

- ORIGIN `OIII`, DESTINATION `OIIE`, Via `DCT REVUR`.
- Press **Compute** (reads source-linked FIX coordinates and computes great-circle reference geometry).
- Press **Stage into CDU RTE**.
- In original CDU, press RTE `<ACTIVATE` (left L5), then physical `EXEC`, then `LEGS`.
- LEGS displays **reference** ground distances and TRUE initial bearings; data are not equivalent to flyable ARINC legs or live FMC guidance. CDU modifications remain user-controlled and not sent to autopilot.

## Hard limitations / blockers for full user-requested goal

- Existing Stage-2 comprises 756,524 resolved source coordinates and 360,425 *reference chords*. It contains **0 verified flyable FMC legs**. Code refuses to label chords ARINC route legs.
- Stage-3 **does not yet generate** ARINC path terminators (TF/CF/DF/AF/VA/VI etc.), magnetic courses, intercept/turn/hold geometry, SID/STAR/APP variant/runway stitching, vertical restrictions/VNAV, nav source availability / IRS/ADC position dynamics, moving EHSI map, or AFDS steering.
- DCT/AIRWAY point-to-point reference geometry is from the provided worldwide private dataset, while `CduNavAPI` readout is a source-based **trainer reference layer**; do not confuse with a navigation-capable FMC. Procedures are listed and can be inspected with exact original source segment and Stage-2 chord references but **cannot be staged into ACT LEGS**.
- No default use of public/non-AIRAC Iran-only OurAirports when the private worldwide source fails. No extrapolation for absent fixes, discontinuities or missing source.
- AIRAC 2610 Rev.1 effective 2026-10-01 through 2026-10-28 inclusive; cycle validation does not replace ongoing data update validation.

## Acceptance test evidence

- `python tests/fmc-route-engine.test.py` tests synthetic valid DCT/airway, non-existent airway connection, source marker, procedure identity, source read-only protection and cross-track geometry without enabling steering.
- `node tests/cdu-nav-integration.test.cjs` tests RTE pending → EXEC commit → LEGS presentation, no early activation, source identity gate.
- Real private Stage-1+Stage-2 runtime was checked with OIII / REVUR / OIIE and OIII SID listing; source SHA-256 of Stage-1 matched Stage-2 declared SHA-256.
- Do not mark **complete real FMC guidance** until the full path-terminator grammar, equipment-specific FCOM variants, magnetic variation, manoeuvre geometry, LNAV/AFDS behavior and independent reference vectors are all verified.