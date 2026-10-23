# B737 Classic / EP-FSI — NPE Stage 9 simulated guidance core

**AIRAC 2610 Rev.1 · 23 October 2026 · SIMULATOR DEVELOPMENT ONLY**

## Deliverables

Stage 9 adds a *stateful* guidance training model on top of the private Stage-4 flight-plan database and Stage-8 audited source-coordinate reference chords. All data ultimately comes from the user's PMDG/Navigraph AIRAC 2610 sources; the strict per-file marker must be exactly:

```text
//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1
```

No text before this marker participates in NAVDB import, route construction, or guidance.

- `navigation/npe_stage9_guidance.py`: validates source-only WGS84 chord chains, calculates true-track target, signed cross-track, along-track/DTG, heading/track error and capped **simulated flight-director bank preview**. Automatic leg sequencing is **only** within the same proven source group and only when the aircraft reaches the selected fix. No early fly-by turns without verified waypoint semantics. Invalid/stale simulator sensors, out-of-capture positions and group ends suspend guidance.
- `navigation/npe_stage9_training_aircraft.py`: an optional independent point-mass physics sandbox uses the Stage9 bank preview to close the lateral training feedback loop; it **never** connects to the actual simulator or AFDS. The simulated heading/position dynamic model is NOT from the EP-FSI AFM.
- `navigation/npe_stage9_server.py`: isolated private loopback service with explicit arm/disengage, opaque sessions, and `SIMULATOR_INTERNAL` position samples. No real aircraft adapter, no actuator endpoint. Private SQLite is extracted only to an OS temporary directory.
- `navigation/npe-stage9/`: browser lab for a simulated ownship, route segments, gaps and guidance readout. It embeds the existing approved CDU/EHSI without changing its photo assets, EFIS controls, hitboxes, or knob animation.
- `cdu-standalone-v6/stage9-advisory.js`: same-origin, read-only **SIM REF** annotation on EHSI PLAN; no control input or flight mode updates.
- `navigation/tests/test_npe_stage9_*.py`, `cdu-standalone-v6/tests/stage9-advisory.test.cjs`: safety, geometry, source-provenance and HTTP integration QA.

## Current capabilities and remaining limits

| Capability | Status |
|---|---|
| Real source Enroute reference guidance law | **Implemented for simulator diagnostics** |
| User-opt-in arm / disengage | **Implemented** |
| Leg sequencing within one documented contiguous route group | **Implemented, fly-over style** |
| Fly-by turn anticipation | Preview geometry only; not active |
| No crossing SID/STAR/APP or ROUTE DISCONTINUITY | **Enforced** |
| Invalid GPS/IRS, stale sensor, out of route | **Suspends** |
| Synthetic vertical target for an explicit verified altitude | **Advisory only** |
| Optional sandbox closed-loop lateral capture | **Implemented in a synthetic, deliberately non-aircraft-specific kinematic model** |
| Actual sourced ARINC-coded SID/STAR/APP flyable legs | **Blocked: absent from supplied narrative** |
| True VNAV / autothrottle / thrust integration | **Not implemented** |
| AFDS/AP servo actuation or real LNAV coupling | **Not connected** |
| User device CDU/EHSI flight acceptance | **Not performed in this environment** |

The controller may output `desired_true_track_deg` and `sim_fd_bank_preview_deg` **only as training references**. All outputs include empty `aircraft_actuator_commands`, `afds_commands`, `lnav_commands`, and `vnav_commands` lists and `fmc_legs_executable=false`. These fields are **not** physical FD/AP controls. The P/PI/D dynamic control laws, AFDS control authority, aircraft limits, roll-mode changes, wind state, pitch/thrust and cross-system failure modes must be verified from the fitted EP-FSI FCOM/AFM before any real simulator-actuator coupling.

The FAA distinguishes TF, DF and CF path terminators: two fixes alone cannot establish which coded leg is correct. [FAA AIM](https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap1_section_2.html). Our imported SidStars narrative has zero explicit source-coded ARINC path-terminator records; no leg is fabricated.

## Run on Windows

Use Python 3.10+ and a clone of the main simulator repo. Keep the downloaded private ZIP **outside** the public repo. It includes a limited private Stage-4 fixture, not an entire public nav database.

```powershell
python navigation/npe_stage9_server.py --stage4-zip "C:\Private\B737_NAVDB_AIRAC2610_NPE_STAGE9_PRIVATE.zip" --root . --port 8769
```

Open `http://127.0.0.1:8769/navigation/npe-stage9/index.html`. Choose the saved test plan, explicitly accept **SIMULATOR TEST ONLY**, ARM, input simulated lat/lon/true-track/GS and increase `sim_time_s` with each frame. EHSI PLAN then shows only **SIM REF** and the reference values. One can disengage at any time. The private source ZIP is also available in Project Library path `/B737/NAVDB/NPE_STAGE9/`.

## API (local same origin, NOT public)

- `GET /api/stage9/status`, `GET /api/stage9/plans`, `GET /api/stage9/reference?id=1`
- `POST /api/stage9/start` `{ "plan_id":1, "leg_index":0, "sim_only_consent":true }`
- `POST /api/stage9/step` `{ "session":"opaque-token", "sensor": { "source":"SIMULATOR_INTERNAL", "integrity":"VALID", "lat":35.4455, "lon":50.9054, "gs_kt":220, "track_true_deg":51, "sim_time_s":1 } }`
- `POST /api/stage9/disengage` `{ "session":"opaque-token" }`

Strict Host/Origin checking, localhost bind and payload size caps apply. Private source files are not served under the web folder. Untrusted frame or loss of route capture makes the state `SUSPENDED`; rearm requires deliberate opt-in. `END_OF_CONTIGUOUS_GROUP` is terminal; it will not automatically start a SID, STAR or APP.

## Tests

```powershell
python -m unittest discover -s navigation/tests -p 'test_npe_stage9*.py' -v
node cdu-standalone-v6/tests/stage9-advisory.test.cjs
```

Private integration tests need the Stage4 SQLite path in `NPE_STAGE9_PRIVATE_STAGE4`. All **28 Python tests** (22 synthetic including synthetic point-mass model, one real private database test, five live HTTP cases), plus read-only JS tests, passed locally at the time of this release. Chromium DOM QA passed with database-derived mock API responses; browser direct localhost was blocked. Chromium direct `localhost` was `ERR_BLOCKED_BY_ADMINISTRATOR` in the authoring sandbox; no claim of real-device browser acceptance is made.