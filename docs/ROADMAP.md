# 737 Classic Simulator — Project Roadmap

## Product focus decision — interactive procedures trainer (2026-10-23)

Owner explicitly clarified that this is **not a complete flight simulator**. The delivery goal is working switches, causal system responses, fault and emergency injection, indications and audio, and interactive Normal / Non-Normal checklists. See [TRAINER_SCOPE.md](TRAINER_SCOPE.md).

**New execution order:** (1) finish control-to-state connection, (2) Electrical -> electric hydraulic/fuel pumps and warnings end-to-end, (3) inject faults/emergencies, (4) checklist branch and system-response engine, (5) expand to remaining cockpit systems and EFIS/CDU. Detailed aerodynamic, route, certified V-speed/CG/flight performance modeling is deferred unless needed as a simplified input to an educational scenario.

Prior backlog statuses are historical records; this scope decision does **not** falsely mark any implementation DONE. Track scenario-level functional tests independently from source engineering verification.

Status is recorded as DONE only for present files/features. Future FCOM/FCTM integration is not claimed.

| ID | Milestone | Status | Verification |
| --- | --- | --- | --- |
| B737-001 | New independent GitHub repository | DONE | `b737-classic-simulator` exists |
| B737-002 | Extract clean reference artwork, excluding handwritten annotations | DONE | Three independent panel images included |
| B737-003 | Desktop/mobile three-panel cockpit explorer | DONE | `index.html`, `styles.css` |
| B737-004 | Data-driven clickable switch overlays and inspector | DONE (prototype) | `cockpit-data.js`, `app.js` |
| B737-005 | Scenario presets and local state persistence | DONE (prototype) | Cold/Dark, ground, flight; localStorage |
| B737-006 | Upload and enable GitHub Pages | DONE | Actions run `39711530482` succeeded; live browser interaction not independently verified |
| B737-007 | High-res image hotspot verification of every switch | IN PROGRESS | Per-switch QA required |
| B737-008 | FCOM/FCTM/QRH extract to versioned source DB | PLANNED | Page-based traceability and provenance |
| B737-009 | Aircraft-accurate electrical and power-source model | PLANNED | Unit tests and FCOM review |
| B737-010 | Hydraulic, fuel, bleed and pressurization models | PLANNED | Unit tests and FCOM review |
| B737-011 | Flight control, MCP, autopilot, instruments and FMC models | PLANNED | Unit tests and FCOM review |
| B737-012 | Complete switch guard/knob behavior and annunciator states | IN PROGRESS | 40 photo-overlay controls; gear, autobrake, rotary and lamp-test visual layer committed; FCOM/interlock validation pending |
| B737-013 | Pilot lessons and operator-specific procedural scenarios | PLANNED | Manual citation and review |

When updating the project, keep this ledger and the corresponding source data current. Never mark a visual-only control as FCOM-validated.

## 2026-10-22 — Main panel animation increment

- [x] Published `main-panel-lab/` and linked it from the main explorer toolbar.
- [x] Added 40 separately defined, touch-selectable visual control layers.
- [x] Gear lever has animated UP/OFF/DOWN movement, drag gesture and transient indicator visualization.
- [x] Autobrake rotary has RTO/OFF/1/2/3/MAX detents and smooth visible rotation.
- [x] MCP selectors, annunciator lamps, brightness selectors, pushbuttons and toggle positions animate in the photo overlay.
- [x] Persist visual states locally; support zoom and reset; syntax-check JavaScript during Pages deployment.
- [ ] Verify that the **newly supplied 2026-10-22 PNG image** is the exact artwork committed to assets; currently the lab uses the pre-existing `assets/main-panel.webp` reference, so pixel-for-pixel identity is not established.
- [ ] Cut out every original physical knob/switch from the new high-resolution base into independent transparent raster/vector assets, avoiding visible duplicates behind animated overlays.
- [ ] Recalibrate coordinates for **every** control against the actual full-resolution final source; run visual QA at mobile/desktop zoom.
- [ ] Implement and check every remaining P1/P2/P3/glareshield switch and lamp against approved 737 Classic FCOM, with chapter/page provenance.
- [ ] Model interlocks, gear position/hydraulics, autobrake arming/disarm, electrically driven annunciations and true AFDS modes. Current visual lamps are MANUAL TEST and are **not actual system states**.
- [ ] Establish automated browser gesture tests and physical-state transition tests; verify rendering on the published URL.

All future development must preserve the original photo layers and add real independently operable control layers. Do not replace user's exact cockpit art with an AI-generated image.

## Engine-first design decision — 2026-10-22

- [x] Design engine-first architecture and immutable contracts: see [ENGINE_BLUEPRINT.md](ENGINE_BLUEPRINT.md).
- [x] Create status-driven implementation task ledger: see [ENGINE_TASKS.md](ENGINE_TASKS.md).
- [x] Add prototype machine-readable control/state/command schemas in engine/spec/.
- [ ] Implement validated systems. **Existing UI and original image import remain pending and unchanged by this design-only commit.**
