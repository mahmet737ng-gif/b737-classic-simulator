# 737 Classic Simulator — Project Roadmap

Status is recorded as DONE only for present files/features. Future FCOM/FCTM integration is not claimed.

| ID | Milestone | Status | Verification |
| --- | --- | --- | --- |
| B737-001 | New independent GitHub repository | DONE | `b737-classic-simulator` exists |
| B737-002 | Extract clean reference artwork, excluding handwritten annotations | DONE | Three independent panel images included |
| B737-003 | Desktop/mobile three-panel cockpit explorer | DONE | `index.html`, `styles.css` |
| B737-004 | Data-driven clickable switch overlays and inspector | DONE (prototype) | `cockpit-data.js`, `app.js` |
| B737-005 | Scenario presets and local state persistence | DONE (prototype) | Cold/Dark, ground, flight; localStorage |
| B737-006 | Upload and enable GitHub Pages | DEPLOY PENDING | Check live site, Actions workflow and Pages settings |
| B737-007 | High-res image hotspot verification of every switch | IN PROGRESS | Per-switch QA required |
| B737-008 | FCOM/FCTM/QRH extract to versioned source DB | PLANNED | Page-based traceability and provenance |
| B737-009 | Aircraft-accurate electrical and power-source model | PLANNED | Unit tests and FCOM review |
| B737-010 | Hydraulic, fuel, bleed and pressurization models | PLANNED | Unit tests and FCOM review |
| B737-011 | Flight control, MCP, autopilot, instruments and FMC models | PLANNED | Unit tests and FCOM review |
| B737-012 | Complete switch guard/knob behavior and annunciator states | PLANNED | System integration acceptance tests |
| B737-013 | Pilot lessons and operator-specific procedural scenarios | PLANNED | Manual citation and review |

When updating the project, keep this ledger and the corresponding source data current. Never mark a visual-only control as FCOM-validated.