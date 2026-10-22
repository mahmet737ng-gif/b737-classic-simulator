# B737 Classic — Cockpit Systems & Procedures Trainer

**Owner scope decision — 2026-10-23**. This project is an interactive **cockpit systems, faults, emergencies, and checklist trainer**, **not** a full-flight or certification-grade simulator.

## Product goal

Enable a learner to operate every meaningful cockpit switch/selector/knob, see causal changes in power, fuel, hydraulic and other system states, inject malfunctions/emergencies, hear/see the correct indications and warnings for the simulated configuration, and perform interactive Normal / Non-Normal checklist flows.

**Core causal loop:** `Control Action -> System/Equipment/Sensor State -> Fault/Annunciation/Audio -> Checklist Step -> Updated System State`.

## Implementation priorities

1. **P0** Working cockpit switching and state transitions; preserve reference panel artwork.
2. **P0** Connected electrical, fuel-pump, hydraulic-electric-pump, sensor and annunciation model.
3. **P0** Deterministic fault-injection engine, alarms, fault persistence, clear and reset logic.
4. **P0** Real state-aware QRH/Normal checklist training: conditions, branches, deferred steps, feedback.
5. **P1** EFIS, CDU, MCP and instrument state that enables meaningful cockpit-procedure practice.
6. **P2/defer** Flight dynamics, routes, V-speeds, takeoff/climb/landing performance and high-precision airplane flight model except simplified values needed to test an indicator or warning.

## Data / acceptance policy

- Existing FCOM, AFM, QRH, FCTM, FPPM, WBM and MRG archive and source references remain intact. Follow document location, model and effectivity where available; explicitly identify surrogate / approximated training values.
- For simulator training, **737 Classic source data from another serial/variant is allowed**. Do not present a 737-400/22K curve or a GE Capital WBM number as measured/approved facts for EP-FSI 737-300/20K. Do not silently merge NG with Classic.
- **Outstanding full performance/chart engineering QA must not block unrelated switching, indication, fault and checklist simulator development.** Reclassify those QA items as out-of-scope for the current training slice without deleting the underlying issue or lowering its factual verification status.
- `PROTOTYPE` = coded simulation; `SOURCE_MAPPED` = linked to relevant reference passage; `TRAINER_TESTED` = actual end-to-end functional test; `EXPERT_REVIEWED` = independent semantic review when available. These are not flight/airworthiness approvals.
- A completed training scenario must specify its initial conditions, control inputs, simulated fault, relevant system state transitions, alert/light/audio effects, checklist decisions/steps, successful/unsuccessful action behavior, and reset. Automated repeatable tests should cover those transitions.
- **No claim of real-aircraft or flight safety suitability**. The primary user goal is interactive cockpit practice.

## First vertical integration target

`Electrical -> Hydraulic Electric Pumps + Fuel Pumps -> Indications/Warning System -> Inject Fault -> Interactive QRH response -> Reset/Recovery`.

Use [the Technical Database provenance guide](TECHNICAL_DATABASE.md) and project task ledger for implementation details.
