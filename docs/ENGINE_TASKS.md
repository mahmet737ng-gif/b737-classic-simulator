# B737 Engine Delivery Register — 2026-10-22

This ledger is used by future developers or AI agents to resume work. DO NOT mark a rule 'DONE' without commit SHA, automated test and validation evidence. Only architecture work is newly completed here.

| Task | Priority | Status | Completion / acceptance evidence |
| --- | --- | --- | --- |
| ENG-000 Architecture and dependency graph | P0 | DONE (DESIGN) | docs/ENGINE_BLUEPRINT.md |
| ENG-001 Machine-readable control / event / state contracts | P0 | DONE (DESIGN) | engine/spec/*.schema.json |
| ENG-002 Preserve exact user PNG 6424×2212 in repo | P0 | BLOCKED (BINARY TRANSFER) | SHA-256 b6c206418feb44b43bd134cb57a51dddd8bbe928859382d3864f3fbcc5cbc1c8; verify actual repo blob after upload |
| ENG-003 Mechanical part atlas from original PNG | P0 | NOT STARTED | Exact transparent original pieces, repair backgrounds, verified travel axes/pivots |
| ENG-004 Source manual revision & 737CL option database | P0 | NOT STARTED | Every rule references FCOM page/edition/variant |
| ENG-005 Deterministic state store, kernel and replay | P0 | NOT STARTED | Unit tests and deterministic command replay |
| ENG-006 Command / mechanical interlock bus | P0 | NOT STARTED | Guard, detent, lever lock, pull, spring tests |
| ENG-007 Full image coordinate calibration | P0 | NOT STARTED | Original PNG matching screenshots at 1×/2×/3× |
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
| ENG-018 All panels control registry and verified sprites | P1 | NOT STARTED | Each physical switch mechanically accurate |
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
