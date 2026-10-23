# CPCS — Classic cabin pressure controller (system #03, training V5)

**Not the EP-FSI pressurization system.** The source-indexed Sepehran Classic FCOM differentiates **CPCS** effectivity (FSA/FSB/FSF/FSK/FSG/FST/FSE) from **DCPCS** (FSQ/FSI/FSL/FSU/FSV); the project aircraft **EP-FSI** is in the DCPCS group. The preceding DCPCS V4 module remains separate. The CPCS module is for generic older-equipment cockpit switching instruction, not claimed installation on FSI.

## Delivered files

- `engine/systems/cpcs-v5.js`: deterministic immutable control-state, labeled electrical/pressure inputs, AUTO/STBY/MAN_AC/MAN_DC selector, FLT/GRD airborne inhibit, AUTO FAIL/STBY transfer, selected cabin rate, mechanical relief signals, AC-dependent valve position gauge; physical pressures are never synthesized.
- `engine/systems/cpcs-integration-v5.js`: connects the source-limited CPCS to existing `audio/warning-engine.js` for cabin-altitude intermittent horn, horn cutout and rearm. Provides a short training-only AUTO FAIL/standby/manual fallback checklist based on the **CPCS branches** of indexed QRH 2.4–2.6. Actual cabin controllability must be supplied as an instructor observation, not a guessed result.
- `cpcs-lab/`: independent responsive browser demonstrator with momentary valve switch, sensors, power faults, lamp indications, QRH training checkpoints and event trace.
- `tests/cpcs-v5.test.cjs`: 54 single-system and integration assertions run against real audio warning module in CI.

## Source-linked rules (indexed from the existing private Technical Database, not re-opened source PDFs)

| Source location | CPCS meaning | Implementation |
| --- | --- | --- |
| FCOM 2.10.11–13 (DB pages 992–994) | AUTO/STBY/MAN AC/MAN DC/CHECK; FLT/GRD; rate target 50/300/2000 ft/min; horn cutout; valve position indicator loses valid AC display | Discrete state and known target value; CHECK detailed stimulus unavailable |
| FCOM 2.40.1–3 (DB pages 1014–1016) | One auto and one standby controller; AC motor for AUTO / MAN AC, DC for STBY / MAN DC; pressure, air-ground and Stall Management functional inputs | Functional links, **not** wiring pin map; stall output payload unresolved |
| FCOM 2.40.5–7 (DB pages 1018–1020) | Main/forward outflow and flow-control valve roles; FLT/GRD logic, ground prepressurization; flight/landing altitude selection | Commands only; no physical valve speed or cabin airflow integration |
| FCOM 2.40.8 (DB page 1021) | AUTO FAIL with AC loss, >1890 sea-level ft/min cabin rate, or >13875 ft cabin altitude; automatic STBY transfer while selector stays AUTO | Numeric detection, mode/lamp feedback |
| FCOM 2.40.10 (DB page 1023) | STBY and MANUAL lights; standby cab-alt schedule selected by pilot | Control/output state, no actual pressure trace |
| FCOM 2.40.1 / 2.40.5 | Positive relief 8.65 psi; negative relief; cooling airflow flow valve below 2.5 psi | Trigger/status representation only |
| QRH 2.4–2.6 (DB pages 78–80) | CPCS-specific AUTO FAIL → STBY → cabin-alt control check; conditional MAN AC fallback | Brief *original training* paraphrase, not full QRH; instructor observes actual controllability |

### Explicit development gaps

Exact AC/DC bus wiring, ADC/baro ambiguity in mixed FCOM CPCS/DCPCS sections, controller trip latched behavior, detailed CHECK procedure, physical valve position/speed, outflow air flow and cabin pressure, exact logic for OFF SCHED DESCENT, Stall Management signal contents, measured horn audio asset mapping, and main cockpit hot-spot integration all remain **unverified / not modeled**.

Private graph: `/Technical Database/Subsystems/CPCS-V5/CPCS_NETWORK_V5.sqlite`. This source-bearing SQLite and private FCOM/QRH evidence are **not committed** to public GitHub. Parent Technical Network V2 and preceding DCPCS / Stall V3 subgraphs are unchanged.

Status: `SOURCE_MAPPED_TRAINER_TESTED_PARTIAL`, **not** aircraft-validated.