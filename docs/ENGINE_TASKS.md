# B737 Engine Delivery Register — 2026-10-22

This ledger is used by future developers or AI agents to resume work. DO NOT mark a rule 'DONE' without commit SHA, automated test and validation evidence. Only architecture work is newly completed here.

| Task | Priority | Status | Completion / acceptance evidence |
| --- | --- | --- | --- |
| ENG-000 Architecture and dependency graph | P0 | DONE (DESIGN) | docs/ENGINE_BLUEPRINT.md |
| ENG-001 Machine-readable control / event / state contracts | P0 | DONE (DESIGN) | engine/spec/*.schema.json |
| ENG-002 Preserve exact user PNG 6424×2212 in repo | P0 | BLOCKED (BINARY TRANSFER) | SHA-256 b6c206418feb44b43bd134cb57a51dddd8bbe928859382d3864f3fbcc5cbc1c8; verify actual repo blob after upload |
| ENG-003 Mechanical part atlas from original PNG | P0 | IN PROGRESS (DRAFT ROI/ALPHA) | 516 candidate crops with pixel-preserved source (local atlas ZIP); transparent contours and background repairs NOT yet verified |
| ENG-004 Source manual revision & 737CL option database | P0 | SOURCE ARCHIVE EXTRACTED IN PRIVATE LIBRARY; VARIANT RULES PENDING | FCOM 1,937/1,937 pages extracted; 1,937 SVG + 1,937 PNG, 1,829 table candidates, 968 embedded assets, searchable SQLite; page coverage VERIFIED, exact table cells and switch/system traceability NOT YET VERIFIED. See docs/FCOM_ARCHIVE_STATUS.json |
| ENG-005 Deterministic state store, kernel and replay | P0 | NOT STARTED | Unit tests and deterministic command replay |
| ENG-006 Command / mechanical interlock bus | P0 | NOT STARTED | Guard, detent, lever lock, pull, spring tests |
| ENG-007 Full image coordinate calibration | P0 | IN PROGRESS (DRAFT CENTERS) | 516 screenshot-derived center coordinates in engine/atlas/control-points.v0.1.json; final pixel alignment QA pending |
| ENG-008 Electrical buses, battery and generator laws | P1 | NOT STARTED | Traced FCOM cases, dependencies and tests |
| ENG-009 Fuel, APU, engine starter/engine laws | P1 | NOT STARTED | Tested electrical/fuel/bleed dependencies |
| ENG-010 Hydraulics A/B/standby and actuators | P1 | NOT STARTED | Correct source priority and actuator reactions |
| ENG-011 Landing gear engine | P1 | NOT STARTED | UP/OFF/DN, ground lock, manual override, gear position and indicators |
| ENG-012 Brakes/antiskid/autobrake | P1 | NOT STARTED | Pull-to-MAX, RTO conditions, disarm and indicator conditions |
| ENG-013 Pneumatics, packs, pressurization | P1 | NOT STARTED | Source and pressure state scenarios |
| ENG-014 MCP / FD / AFDS / A/T | P1 | NOT STARTED | Mode logic with equipment/sensor inputs, FCOM review |
| ENG-015 Navigation/IRS/Air Data/COM/FMC | P1 | NOT STARTED | Powered behavior, source selection, variant rules |
| ENG-016 Flight controls/flaps/spoilers/trim | P1 | NOT STARTED | Valid aircraft movement under power/hydraulics |
| ENG-017 Anti-ice, fire warnings, cabin/external lights | P1 | NOT STARTED | Sensor/fault-derived outputs and tests |
| ENG-018 All panels control registry and verified sprites | P1 | IN PROGRESS (516 CANDIDATES) | Three-panel registry, labels and candidate detents; ALL poses and mechanical shapes pending independent verification |
| ENG-019 Scenario engine incl. cold/dark through shutdown | P1 | NOT STARTED | Replayable and FCOM-traceable test cases |
| ENG-020 External simulator adapter | P2 | NOT STARTED | Clear data ownership/units, telemetry and sync tests |
| ENG-021 Offline/browser state restore and migrations | P2 | NOT STARTED | Deterministic snapshots across code versions |
| ENG-022 Hardware-faithful audio/feedback engine | P2 | NOT STARTED | Source-consistent sound and motion review |
| ENG-023 Performance/accessibility/mobile QA | P2 | NOT STARTED | Touch/cancel tests, screenshots, performance |
| ENG-024 Independent private/preview deployment | P0 | NOT STARTED | New URL without replacing main simulator site |
| ENG-025 Final owner review / approved root switch | P0 | NOT STARTED | Explicit acceptance; never assume approval |

## Locked implementation order

Phase A — Source/art and mechanical engine: ENG-002,003,004,005,006,007,024.
Phase B — First real interlocking subsystem pilot: ENG-010,011,012.
Phase C — Foundation of aircraft energy: ENG-008,009,013.
Phase D — Controls/avionics/flight systems: ENG-014,015,016,017,018.
Phase E — Scenarios, integration, replay and acceptance: ENG-019,020,021,022,023,025.

## Known prototype limitations (must not be hidden)

- The old root 'sim-engine.js' only computes visual classroom selection summaries; not a real aircraft systems engine.
- 'main-panel-lab/panel.js' represents touch motion and a *partial* antiskid/disarm indication demonstration. It does NOT meet verified FCOM model criteria.
- The PNG the user selected is available from the conversation, but NOT yet verified in GitHub. The old 'assets/main-panel.webp' is the image seen in the screenshot.
- Prior visual/vector experiments must remain backups. Do not replace the chosen PNG with them.
- Until full FCOM rule and ground/air context are implemented, do not claim an actual airplane reaction.

## Instructions for next AI agent

1. Open docs/ENGINE_BLUEPRINT.md and this task ledger; inspect latest main commit and existing tests.
2. Do not edit the deployed site's current image without explicit user approval.
3. Verify actual original source image file and SHA-256 before wiring a web asset.
4. Write code in proposed new engine/ directories; keep the live demo separately.
5. After each feature, add its manual-page reference, tests, visual comparison, status, commit hash, and any open discrepancy here.
6. Request user sign-off on accuracy before promoting a component to USER_ACCEPTED.

## 2026-10-22 — Partial stages 1/2 deliverables

- 516 control/display candidates identified: 90 Main, 196 Overhead, 230 Pedestal. GitHub: `engine/atlas/control-points.v0.1.json` (initial full-source pixel coordinates); QA note `docs/ATLAS_STAGES_1_2_AUDIT.md`.
- Standalone offline ZIP generated in conversation with the ORIGINAL THREE source PNG files, 516 lossless source ROI tiles, 516 draft geometric alpha masks, JSON/CSV and a local HTML coordinate-adjustment viewer. The ZIP **is not deployed in GitHub Pages**.
- Draft state names do NOT imply known ON/OFF photographic poses, accurate silhouettes, validated FCOM references, or complete coverage; all mechanical pose geometry remains UNVERIFIED.
- ENG-002 original PNG transfer to GitHub is still not complete; manifest names and SHA-256s do not mean original blobs uploaded.

## 2026-10-22 — Concentric/dual-shaft control contract v1

- DONE (DESIGN + UNIT TEST): FCOM-backed split of two coaxial assemblies into 4 independent logical controls: IRS ISDU display selector/BRT and MCP heading/bank-angle selector. See `engine/atlas/compound-controls.v1.json`, `engine/mechanics/compound-controls.js`, `tests/compound-controls.test.cjs`, `docs/COMPOUND_CONTROLS.md`.
- Current suite passed locally for split-hit routing, independent states, heading wrap (359→000), hard stops (bank angle 10–30), and IRS TEST spring-return.
- Geometry radii/centers are provisional. This is NOT photo-perfect clipping or simulator integration. Original three master photos unchanged and not uploaded to GitHub; local offline demo ZIP supplied separately.
- Remaining: scan ALL three photos and FCOM for additional nested knobs, calibrate pixels, get real alternate-angle sprites, implement engine systems and browser-level gesture test.

## FCOM archive toolchain — 2026-10-22

- Code: `tools/fcom-archive/` with full-page renders, text/lines, embedded image extraction, heuristic table CSV+crops, SQLite FTS, resume, hashes and localhost browser.
- Local smoke-test status: PASS (3-page synthetic manual, 1 vector table, 1 embedded figure, FTS, 100% page coverage, resume) and local viewer HTTP API PASS. Not a production Boeing FCOM extraction.
- Full 1,937-page source PDF: NOT materialized; indexing service exposes text snippets only; full raw access failed. Full Boeing text, schematics and tables are **NOT on the public GitHub repository**.
- Constraint: GitHub repository is PUBLIC, whereas source FCOM says Boeing Proprietary / Export Controlled. Do not upload source-derived complete corpus without explicit permission to distribute and appropriate compliant storage.
- Exit criteria: authorized raw PDF, authorized destination, archive `manifest.json` 1937/1937 with no errors and human table/figure QA. Do not mark ENG-004 DONE prematurely.

## 2026-10-22 — Complete FCOM source extraction (private archive)

- The user re-uploaded the raw Sepehran Boeing 737CL FCOM (1,937 pages). Extracted every page's UTF-8 text, layout JSON, PNG page preview, full standalone vector SVG, detected table CSV/crops, and deduplicated embedded image assets.
- **Verified machine coverage 1937/1937**; 1,829 detected table candidates (not a guarantee of correct CSV cell boundaries), 968 unique embedded image assets, and full-text indexed SQLite. The verifier reported zero missing pages, zero missing page images, zero source-hash mismatches, and zero empty-text pages.
- User-facing offline browser and 7-part ZIP stored in the user's private Library; full text and SQLite also persist there for future reference. The public GitHub repository contains only extraction tooling and source-free status metadata.
- This completes raw source extraction, NOT FCOM-derived semantic modeling of all switches or systems; equipment-specific effectivity and page-by-page interpretation remain open. See docs/FCOM_ARCHIVE_STATUS.json.

## 2026-10-22 — Integrated Systems Network (ISN) design branch

Branch: `design/integrated-systems-network-v01` (NOT merged to main / NOT deployed).

| Task | Status | Evidence |
| --- | --- | --- |
| ENG-026 Source-traced directed systems graph | DONE (DRAFT DATASET ONLY) | `engine/network/b737cl-system-graph.v0.1.json`: 15 groups, 78 pilot nodes, 81 directed links and 7 fault cases. Every existing link reference has a valid source page index; graph completeness and physical wire paths NOT verified. |
| ENG-027 Fire detector dual-loop fault/vote pure pilot | DONE (ISOLATED PROTOTYPE ONLY) | `engine/network/fire-detection-pilot.cjs`; source §8.20.1-2/PDF pages 1234-1235; 5 focused smoke checks passed through an isolated JS harness, full Node test runner still requires CI verification. |
| ENG-028 Graph integrity / fault regression tests | WRITTEN; CI VERIFICATION PENDING | `tests/system-network.test.cjs`; NOT yet part of the root npm test script, no production integration. |
| ENG-029 Interactive read-only network inspector | WRITTEN; BROWSER QA PENDING | `systems-network-lab/index.html`; loads graph JSON locally when served at repo root; intentionally not deployed / integrated. |
| ENG-030 Full 200-leaf sensor/wiring/actuator coverage | NOT STARTED | Existing 200 leaf categories are taxonomy, not verified circuit/sensor implementations; requires aircraft-specific equipment effectivity and reviewed WDM/AMM/SSM where FCOM not sufficient. |

Next: validate the prototype independently, reconcile graph edges with aircraft options, model signal quality/known vs unknown, then only in a separate preview connect network outputs to panels and audio. No existing web/iPad/Android code was changed.

## 2026-10-23 — Electrical network integration pilot #01 (branch only)

**Verified source context:** Sepehran 737CL FCOM Vol. 2 §6.20.1-19, PDF pages 1150–1168; fire §8.20.1 PDF p1234. Public code includes source references and paraphrased engineering logic only. Current Library includes AFM, FCTM, QRH, WBM, FPPM and MRG; no AFM numerical performance rule is enabled here.

| Task | Status | Evidence / known limitation |
| --- | --- | --- |
| ENG-028 Graph integrity + fire loop regression | DONE (AUTOMATED TEST ONLY) | `node tests/system-network.test.cjs` passed in GitHub Actions run [39859470764](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/39859470764). This does not validate physical aircraft wiring. |
| ENG-031 Electrical source, main/transfer bus logic | DONE (STANDALONE PILOT) | `engine/network/electrical-power-pilot.cjs` §6.20.1–4; GEN1/GEN2 failure and AUTO vs OFF transfers. No physical GCU transient, breaker, or generator load simulation. |
| ENG-032 TR, DC bus and standby behavior | DONE (BOUNDED PILOT) | §6.20.8–12; TR1/2/3 source and glideslope DC bus isolation, AUTO ground inhibit, manual BAT, flight battery/inverter fallback. Degraded TR3 backup relay route and partial-ground standby remain **UNRESOLVED** rather than guessed. |
| ENG-033 Cross-system equipment loss and fire detector power | DONE (CONDITIONAL TEST MAPPING ONLY) | §6.20.18–19 + §8.20.1. Fuel/hydraulic load failures applied only when documented one-generator-in-flight/normal-transfer preconditions hold; bus output drives existing fire-loop pilot power input. Does not compute hydraulic/fuel pressure, bus warning lights, or full detector annunciation physical power. |
| ENG-034 Electrical integration regression suite | DONE (NODE CI) | `tests/electrical-integration.test.cjs`; `.github/workflows/electrical-integration.yml`; run [39859470764](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/39859470764) conclusion `success`. An isolated JS shim previously passed 86 assertions. |
| ENG-008 Full electrical physical model | **IN PROGRESS; NOT COMPLETE** | Pilot above does **not** meet full ENG-008 acceptance criteria. Need source-transfer events, live state kernel, real quality/voltage/relays, fault propagation to all consumers, variant audit and independent visual QA. |
| ENG-035 Full cross-system aircraft kernel | NOT STARTED | Isolated pure-function outputs are not yet connected to live cockpit, CDU/EHSI, fuel/hydraulic actuators, master warning or flight dynamics. |

Companion report: `docs/ELECTRICAL_INTEGRATION_TEST_01.md`. **Do not merge or deploy to main without separate review**; main may contain newer CDU/EHSI/AFM files that must not be overwritten.

## 2026-10-23 — Coupled Electrical → Fuel/Hydraulic Pumps → Sensors → Warnings (branch pilot #02)

| Task | Status | Evidence / guardrails |
| --- | --- | --- |
| ENG-036 Fuel AC pump consumer interface | DONE (TEST PILOT) | `engine/network/pump-sensor-warning-engine.cjs`; 6 pump channels, source case gating §6.20.18-19 (pp1167-68), switches/sensor lamps §12.10.2–3 (pp1826–1827). Nominal fluid/pressure assumptions labeled, not physical engine model. |
| ENG-037 Hydraulic A/B electric pump consumer interface | DONE (TEST PILOT) | §13.10.1,13.10.4,13.20.2–3 (pp1842/1845/1847–48); source-specific pump output sensor, engine-driven independence, conditional combined system pressure and fire-switch inhibition. No numerical PSI. |
| ENG-038 Fuel/Flt Cont warning cause engine | DONE (TEST PILOT) | §12.10.2–3 + §15.20.2–4 (pp1906–08); main single-pump recall, main dual-low caution, center low with switch logic, FLT CONT/HYD system-pressure caution, master caution ACK & new-fault re-arm. Exact annunciator bus/power provisional. |
| ENG-039 Deterministic command/replay integration | DONE (TEST PILOT) | `engine/network/integrated-aircraft-kernel.cjs` + `tests/pump-warning-network.test.cjs`. Atomic input events, sensor changes, warning transitions, recovery, invalid input rejection. Not cockpit command system. |
| ENG-040 Browser network demo using same runtime | DONE (ISOLATED PREVIEW CODE) | `power-consumers-lab/index.html`, generated `runtime.js`, `tools/build-power-consumers-lab.cjs`, `tests/power-consumers-browser.test.cjs`; runtime parity verified in Node VM, **real browser visual E2E not verified**. No deployment to Pages. |
| ENG-041 Power/pressure system full model | NOT COMPLETE | Need contactor event engine, real AC feeder mapping/WDM, pump sensor independent faults, timing/cavitation/leak/PSI, full FUEL/HYD warning power and source QA, panel/CDU integration, browser QA. |

Full case walkthrough and exact FCOM source references: `docs/POWER_PUMPS_WARNINGS_INTEGRATION.md`. Keep `main` and deployed UI untouched pending approval. The AFM/FCTM/QRH/WBM/FPPM corpus remains in private Library, not in public GitHub.

## 2026-10-23 — ISN-03 Stages 1+2 source-traced feeder & pressure integration

| Task | Status | Evidence |
| --- | --- | --- |
| ENG-042 Pump Electrical Functional Feeder Registry | **DONE — bounded pilot** | `engine/network/electrical-feeder-audit.v0.2.cjs`; 8 consumer states plus physical feeder/circuit breaker/relay fields marked WDM/SSM-unverified. FCOM §6.20.18–19 PDF 1167–1168. |
| ENG-043 Fuel/Hyraulic pressure distribution | **DONE — qualitative pilot** | `engine/network/pressure-distribution.v0.2.cjs`; per-pump outlets, independent engine and electric hydraulic A/B paths, individual engine-side fuel source priority, source-provenance. Dynamic actual PSI intentionally null absent validated physics. |
| ENG-044 Feed/Pressure → Sensor/Warnings + transitions | **DONE — test pilot** | `engine/network/integrated-aircraft-kernel.cjs` computes pressure and rebinds the sensor truth before caution. Change events include AC bus/feed deltas and undelayed pressure transitions. |
| ENG-045 Stage 1+2 regression, source/dynamic QA | **DONE — automated tests** | `tests/electrical-pressure-stage12.test.cjs`; GitHub CI [39864242355](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/39864242355) success; existing pump, fire network, AC/DC and browser parity tests also pass. |
| ENG-046 Quantitative aircraft-calibrated pressures / WDM | **BLOCKED — missing verified source specifics** | WDM/SSM feeder IDs, selected aircraft effectivity, pump displacement/pressure curves, hydraulic fluid/reservoir/PTU/accumulator model, suction/feed performance, pressure switch thresholds and timing. No fabricated engineering values. |

See `docs/ELECTRICAL_FEEDER_PRESSURE_STAGE12.md` for exact source traceability and 10 end-to-end fault/recovery cases. Parallel experimental source adapters `electrical-consumer-feeders.cjs` and `fluid-pressure-engine.cjs` are retained but not authoritative warning pathways. This stage has not merged to `main` or deployed to the cockpit site.

## 2026-10-23 — ISN-04 Sensor and Failure Engine (stage 3)

| ID | Status | Evidence |
| --- | --- | --- |
| ENG-042 Independent fuel/hydraulic discrete sensor injection | DONE (ISOLATED TRAINING PILOT) | `engine/network/sensor-failure-engine.cjs`: 12 channels, HEALTHY, OPEN_CIRCUIT, UNPOWERED, STUCK_LOW, STUCK_NORMAL, INTERMITTENT, explicit settling; source §12.10.2-3 and §13.10.1/4. Not installed avionics fault-detection claims. |
| ENG-043 Pressure truth separated from reported pressure | DONE (TEST PILOT) | `engine/network/integrated-aircraft-kernel.cjs` + fault engine; source pressure remains owned by v0.2 pressure-distribution. Warnings use observed pressure, not physical truth directly. |
| ENG-044 Warning quality/ACK/recovery regression | DONE (NODE CI TESTS) | `tests/sensor-failure-network.test.cjs`: false caution stuck-low, masked real failure stuck-normal, invalid dropouts, full system pressure unchanged, hydraulic fire/valve inhibits, deterministic replay and strict commands. |
| ENG-045 Browser injector with same simulator core | DONE (BRANCH-ONLY UI PROTOTYPE) | `power-consumers-lab/index.html`; `power-consumers-lab/runtime.js` autogenerated and verified by `tests/power-consumers-browser.test.cjs`. No private host/site deployment, no browser visual E2E. |
| ENG-046 Physical wiring/delay/sensor power accuracy | BLOCKED (REFERENCE QA) | Need applicable WDM/SSM/AMM, fault threshold/time evidence, sensor power circuits and option/ASN effectivity. No numerical delays or sensor circuit responses invented. |

Source-backed summary: `docs/SENSOR_FAILURE_ENGINE_STAGE_3.md`. Private Technical Database retains reference PDFs. GitHub public repo stores small source citations and independent logic, not proprietary full-page scans. Do not change `main` or the live cockpit without separate user approval.

## 2026-10-23 — ISN-05 cockpit annunciation and aural output interface

| Task | Status | Implemented result and follow-up |
| --- | --- | --- |
| ENG-047 Source-traced lamp projection from live pumps/sensors | DONE (ISOLATED PILOT) | `engine/network/annunciation-output-engine.cjs`, 23 lamp channels (amber caution, red FIRE WARN, per-pump LOW, FLT CONT, OVHT DET), clear ON/OFF/UNKNOWN and separate tentative physical visibility. WDM and panel exact placement still pending. |
| ENG-048 Warning cause -> ACK and recall -> annunciator | DONE (TEST PILOT) | New adapter uses warning-cause/ACK state; clears master and system annunciator requests on ACK while retaining underlying local pressure-low. Single main pump remains simple recall-only. |
| ENG-049 Battery-bus Engine 1 fire alert and fire-bell intent | DONE (PILOT ONLY) | `integrated-aircraft-kernel.cjs` uses `fire-detection-pilot.cjs`, two loops, selector, FIRE WARN cutout and re-arm, separate fireBell audio START/STOP/HOLD, OVHT DET caution; Engine 2/APU fire not yet integrated. |
| ENG-050 Browser panel + user-gated audio mapping | DONE (ISOLATED TEST UI) | `power-consumers-lab/index.html` draws grouped warning outputs and fire-loop controls. Aural requests use preexisting `PhraseSelector` and opt-in player. **Mapped real fire sample not verified at repo asset path**, so actual audio file playback remains unverified. |
| ENG-051 CI and source parity tests | DONE (NODE CI) | `tests/annunciation-integration.test.cjs` and updated `tests/power-consumers-browser.test.cjs`; confirmed branch workflow pass. Real browser visual E2E still pending. |
| ENG-052 Production cockpit lamp wiring and effects | BLOCKED | Need approved cockpit coordinate/image mappings, verified annunciator WDM/SSM circuits, local real audio clips and owner release approval. Do not edit `main`/live website on pilot status. |

Reference: `docs/ANNUNCIATION_AUDIO_INTEGRATION_ISN05.md`. This stage is *functional signal integration*, not final installed aircraft-electronics fidelity or live cockpit deployment.
