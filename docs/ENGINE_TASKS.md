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

## 2026-10-23 — ENG-TRAINER-001 standalone electrical/fuel/hydraulic training slice

- **PROTOTYPE implemented, unit tested:** `engine/trainer/core.js` immutable state, source selection, generator/transfer buses, six fuel and two electric hydraulic pumps, derived annunciations, faults, original educational BUS OFF checklist flow, deterministic event log and replay.
- **Independent interface:** `trainer-lab/` — instructor presets, fault controls, electrical/bus status, fuel/hydraulic status, lamps and checklist UI. Root cockpit and user artwork unchanged.
- **Verification:** 28 local Node.js tests passed; suite included in `npm test` deployment gate. Browser smoke test could not run due execution environment's blocked local URL/file access; interactive published-site QA pending.
- **Sources:** FCOM 6.10.8–9 (PDF 1147–1148), 6.20.1–4 (PDF 1150–1153), 12.10.2–3 (PDF 1826–1827), 13.10.1 (PDF 1842); QRH 6.1–6.4 (PDF 133–136). See `engine/trainer/README.md`.
- **Open modeling assumptions:** approximate equipment-to-AC-bus mapping, selected generator logic, simplified hydraulic availability and QRH paths. No audio output, engine startup physics, or real cockpit event adapter implemented. Do not call source-validated or flight ready.
- **Next task:** trace the detailed bus wiring; connect cockpit switch IDs and warning audio; add complete state-aware QRH branching and automated browser tests.

## 2026-10-23 — ENG-TRAINER-002 three-seat LAN collaboration

- **IMPLEMENTED / NETWORK INTEGRATION TESTED:** One authoritative in-memory state kernel on a Node.js HTTP host; Captain, First Officer, Instructor each get an exclusive role and synchronized derived states, warning lights, and checklist via SSE + POST. See `docs/NETWORK_CLASSROOM.md`.
- Source code `sync-server/server.js`; network classroom UI `trainer-lab/network.html`, `network.js`, `network.css`, Windows entry `start-classroom.cmd`.
- **25 real three-client HTTP+SSE integration assertions passed locally** (permissions, two PINs, stale-state conflict, fault scenarios, state reconciliation and reconnect). Add tests to `npm test` CI. Prior **28 core engine tests** also passed.
- Server host command: `npm run classroom`. Classroom URL is printed from PC LAN address. **Static GitHub Pages cannot operate this multi-seat server**. No Internet needed on LAN, no external Node packages.
- `PROTOTYPE / TRAINER_TESTED_NETWORK`; actual browser interactions and iPad display **not yet independently validated** because test environment blocks loopback Chromium navigation. No actual cockpit photo/hotspots synchronized until subsequent integration.
- Security: classroom-only HTTP; two distinct randomized PINs; role-restricted instructor commands; no public Internet exposure, persistent logs or multiple-room scale. Original root cockpit and panel images unchanged.

## EP-FSI AFM N1 delivery checkpoint — 2026-10-23 (v10)

Do not equate a source selector or training field with fully calculated performance. All rows are airframe-specific (EP-FSI, MSN 29340, CFM56-3B-1 20K).

| Task | Priority | Status | Acceptance evidence |
| --- | --- | --- | --- |
| N1-FSI-01 Source chart / effectivity routing | P0 | DONE (SOURCE SELECTOR) | `engine/fmc/performance/afm-epfsi-n1-v10.cjs`, 24 guarded source-selector unit tests PASS; original AFM PDF pages 126–130, 755–756, 862–864; 6 PMC/phase modes |
| N1-FSI-02 Standalone CDU N1 LIMIT / TAKEOFF REF source state | P0 | DONE (GUARDED READ-ONLY) | `cdu-standalone/app.js` and `data/afm-epfsi-n1-v10.js`, headless CDU integration test PASS, same original unlit panel artwork; [CI run 39869327746](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/39869327746) |
| N1-FSI-03 Takeoff / go-around curve contour digitization | P0 | BLOCKED (NUMERIC QA) | Graph images retained private; 14 chart components cataloged; **zero** independently validated N1 points |
| N1-FSI-04 Bleed / anti-ice / max-N1 corrections | P0 | BLOCKED (NUMERIC QA) | Source conditions indexed and checked, numerical correction polylines not fully digitized |
| N1-FSI-05 Maximum Continuous nomogram multi-branch math | P0 | BLOCKED (CURVE + GOLDEN VECTORS) | Pressure/temperature/altitude/bleed/TAT nomogram components catalogued; no approved numeric engine |
| N1-FSI-06 Real installed PMC option/state | P1 | UNVERIFIED | User confirmed airframe and engine/rating, not PMC option; training selector does not prove aircraft hardware |
| N1-FSI-07 Calculated N1 feed to FMC & autothrottle | P0 | BLOCKED UNTIL N1-FSI-03–06 | No automatic N1; manual entered N1 is marked MAN for button-training only, never a published calculated target |

Private active dataset: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v10/epfsi_afm_scoped_v10.sqlite` (SHA256 40812cae7042c2c3c83135236883ea477d7b35fa7a6e0b25872ab31ac7f9b830). The public repository contains no Boeing scans or proprietary chart data. Browser screenshot visual QA remains unverified; CI covers the headless state machine only.

## 2026-10-23 — Owner priority change: LAN classroom paused

**Owner decision:** The three-seat local-network mode (Captain / First Officer / Instructor) is **DEFERRED**, not cancelled or deleted. Preserve all previously committed server, session synchronization, permissions and tests; do not spend current development cycles on network transport, pairing or networking UI unless the owner explicitly reactivates this work. The existing `sync-server/` and `trainer-lab/network.*` stay as a future reusable capability.

**Immediate active priorities (single-device / standalone first):**
1. Connect actual cockpit switches, selectors and knob animation events to `engine/trainer/core.js` without changing the owner's locked artwork or the root deployed cockpit.
2. Extend deterministic electrical, fuel and hydraulics state/sensor rules tied to documented FCOM references; simulate equipment faults and indications.
3. Integrate already implemented warning/audio phrase selection, including acknowledgment, suppression and source-driven event rules.
4. Build state-aware instructor faults, Normal/Non-Normal QRH practice, checklist branches and repeatable scenario scoring/reset.
5. Verify each vertical slice via automated state tests and a separate preview before any change to the main cockpit.

**Status:** Priority decision recorded; no implementation of the above new integration milestones is claimed by this entry. LAN module retains its prior tested prototype status.

## N1-FSI v11 numerical extraction checkpoint (2026-10-23)

| Task | Status | Evidence |
| --- | --- | --- |
| N1-FSI-03a Source-image cold-side stroke sampling | DONE — PROVISIONAL ONLY | AFM PDF p128 and p129; 26 altitude-labelled left-side strokes and **104 provisional sampled graph coordinates**, private v11 SQLite, 104 same-source dual-raster checks; independent human review not completed. |
| N1-FSI-03b Complete pressure/temperature curve family | BLOCKED | Only one cold-side stroke segment per labelled altitude sampled. Need full curves, branch intersection logic and independent readout. |
| N1-FSI-04 Bleed / anti-ice corrections | BLOCKED | Source notes indexed; no validated numerical curves. |
| N1-FSI-05 MCT nomogram | BLOCKED | Original AFM p130 staged, no numerical full solution. |
| N1-FSI-07 CDU performance value | BLOCKED | v10 displays source status/manual MAN; no v11 automatic numeric output. |
| N1-FSI-08 Generic guarded interpolation math | DONE (SYNTHETIC TEST ONLY) | `engine/fmc/performance/n1-interpolation-guard-v11.cjs`, tests `tests/n1-interpolation-guard-v11.test.cjs`; public module contains no Boeing numerical curves. |

Private source snapshot: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v11/epfsi_afm_scoped_v11.sqlite`; SHA256 `e7ba3e2df4ffeb7677ebe631f8b1a854a8ee49dbc1b857d2fd5e3f00aa45786a`. Reference: `docs/AFM_EP_FSI_N1_V11.md`. All 104 source N1 samples remain ineligible for runtime until complete independent QA.

## 2026-10-23 — Technical Database machine-readable system/warning network V1

- **PERSISTED IN PRIVATE LIBRARY:** `/Technical Database/Technical-Network-V1/` now contains one SQLite combining the existing 8 manuals / 5,067 indexed pages, source-page provenance and the first typed equipment network. See `docs/TECHNICAL_DATABASE.md`.
- **SOURCE-LINKED GRAPH INCREMENT:** 91 nodes (including 26 lexical tags, not real devices), 104 ports, 56 documented functional connections, 43 original-expression warning/control conditions, 173 rule symbols, 11 explicit unresolved gaps. 39 rule predicates can be deterministically evaluated; 4 remain disabled where exact algorithms or full trigger details are unavailable.
- **TESTS:** 25 Python rule/traceability checks PASS; SQLite PRAGMA integrity and standalone HTML viewer JS syntax PASS. Tests are in the private bundle and have **not** been integrated into the public CI.
- **IMPLEMENTATION LIMIT:** No live connection yet from graph rules to `audio/warning-engine.js` or `engine/trainer/core.js`. The graph's 76 proposed consumer mappings are **NOT COMPLETE or ACTIVE**. No changes to the approved cockpit visual assets, original UI, or postponed LAN capability.
- **Next work:** map source-documented switch and sensor keys to the deterministic cockpit state engine; exercise each warning/alarm from instructor fault injection; map checklist conditions; validate missing pin/channel/rating details only where they affect this educational trainer.

## EP-FSI v12 three-track performance checkpoint (2026-10-23)

| Track | Status | Evidence |
| --- | --- | --- |
| Takeoff / Go-Around digitization | PARTIAL, PROVISIONAL | Private v12 AFM pp128–129: 10 bleed curves catalogued, 16 preliminary correction samples, v11 104 source-image main-chart samples preserved |
| PMC OFF takeoff chart | SOURCE IDENTIFIED / FULL DIGITIZATION PENDING | AFM Appendix 2UK PDF p756; alternate source and separate MAX N1 cap |
| MCT formula/nomogram | SIX STEPS MODELED / NUMERICAL VALUES PENDING | AFM PDF p130; lower of pressure/temperature limits then altitude, bleed, final nomogram |
| QA / CDU | SOURCE ROUTING ONLY, NUMERIC N1 BLOCKED | 14 private SQLite checks, guarded conditions module, independent human numeric review 0, runtime eligible points 0 |

Private active reference: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v12/epfsi_afm_scoped_v12.sqlite`. Existing CDU source selector remains on v10 until fully signed numeric curves and golden source vectors are available. No proprietary Boeing numerical curves in public GitHub.

## 2026-10-23 — TECH-NET-V2 six-stage execution slice

- **Source archive protected in private Library:** 8 manuals, 5,067 pages, 33,767 segments in `/Technical Database/Technical-Network-V2/B737_TECHNICAL_NETWORK_V2.sqlite`; V1 graph retained (91 nodes incl. 26 lexical tags, 104 ports, 56 documented links, 43 rule expressions; 39 structurally evaluable, 4 blocked).
- **Expanded CANDIDATE catalog:** 3,553 name occurrences and 1,959 distinct text strings across all eight manuals. They are NOT identified unique aircraft LRUs nor proof of physical wiring. 65 non-topic nodes retained.
- **Software contracts:** 16 labeled mappings, 14 instructor fault IDs, 10 training scenarios and QA gates; standalone `engine/trainer/integration-v2.js` and generic three-valued `source-rule-evaluator.js`.
- **Isolated browser lab:** `systems-integration-lab/` provides 21 mapped command IDs, derived electrical/fuel/hydraulic indications, current warning engine fire/cabin/stall-instructor audio REQUESTS, DCPCS timed N1/N2 ground behavior and educational BUS OFF checklist progress. Original cockpit image/website root and deferred LAN networking unchanged.
- **QA:** 26 private SQLite tests PASS and 40 local JavaScript contract/integration tests PASS (local WarningEngine-compatible stub). `npm test` now runs the actual repository WarningEngine module via CI; any CI failures must be addressed. Browser visual QA and real audio-asset playback not yet done.
- **Outstanding:** full 737 component-by-component mapping, exact bus wiring, numerical Stall AOA law, exact QRH branching, cockpit photo hotspot mapping, MP3 phrase playback and end-user acceptance. Do not mark the six stages globally COMPLETE; this is a **partial working slice for each stage**.
