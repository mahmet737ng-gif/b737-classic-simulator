# B737 Classic — DCPCS / Cabin Pressurization — System module 02 (V4)

**2026-10-23 · IMPLEMENTED TRAINER SLICE / NOT FULL PHYSICAL PRESSURIZATION MODEL**

DCPCS is for the configured FSI/FSQ/FSL/FSU/FSV digital pressurization family in the supplied Sepehran 737 Classic manual. **Do not mix with CPCS** AUTO/STBY/MAN AC/MAN DC; DCPCS modes are AUTO/ALTN/MAN, uses DC motors, and comprises two normally alternating automatic controllers.

## Code, access and test

- `engine/systems/dcpcs-v4.js`: deterministic independent DCPCS state machine (no DOM).
- `engine/systems/dcpcs-integration-v4.js`: connection to existing `audio/warning-engine.js`; optional functional N1/N2 software handoff from Stall Warning V3 (`feedStallManagement`). Does not claim hardware pin/channel layout.
- `dcpcs-lab/`: separate interactive fault/pressurization/cabin horn laboratory. The cockpit's approved imagery and root website are unchanged.
- `tests/dcpcs-v4.test.cjs`: **37 Node.js behavior/integration tests** covering boundaries, time-delay, selector roles, single/dual channel failures, qualified AUTO FAIL triggers, horn cutout, manual motor movement, replay and software bridge.
- Private database: `/Technical Database/Subsystems/DCPCS-V4/DCPCS_NETWORK_V4.sqlite`. Private archive contains the distinct equipment, ports, source IDs, relationships, conditions, QA gaps and derived training assumptions; original eight-source database V2 remains unchanged.

## Source-located behaviors

| Rule | Printed folio (FCOM), Technical Database PDF page | Modeling confidence |
|---|---|---|
| AUTO/ALTN/MAN selector, MANUAL/ALTN/AUTO FAIL/OFF SCHED indications and dual-failure distinction | 2.10.14–16, 995–997 | Functional behavior/source-located |
| Digital dual-controller system and controller alternation each new flight | 2.40.1–2,7; 1014–1015,1020 | Source-located; internal transfer logic simplified |
| N1 >60%, N2 >89%, ground, qualified for 1.5 seconds prepressurization | 2.40.7; 1020 | Strict thresholds and timer implemented |
| Taxi-in N1 <50% opens valve slowly | 2.40.9; 1022 | Command-level implementation only |
| AUTO FAIL: DC power loss, internal controller fault, outflow control fault | 2.40.9; 1022 | Explicit source predicates; fault-to-controller selection simulation policy |
| AUTO FAIL conditional: differential >8.30 psid, absolute rate >2,000 ft/min, cabin altitude >15,800 ft, **only when controller not responding properly** | 2.40.9; 1022 | Qualifier preserved; strict inequalities |
| AUTO→ALTN automatic transfer and ALTN switch extinguishing AUTO FAIL with ALTN remaining | 2.40.9; 1022 | Source-located; detailed latch behavior approximate |
| Automatic cruise max differential schedule 7.45/7.80 psid across 28,000 ft flight-alt setting | 2.40.8; 1021 | Source-listed schedule |
| Passive mechanical relief at 8.65 psid, not a computer-driven valve position | 2.40.1; 1014 | Informational status, no fluid mechanics |
| MAN DC motor with full stroke taking *up to* 20 seconds | 2.40.11; 1024 | Visual test uses a **fixed illustrative 20 s** stroke; *not* installed actuator's measured rate |
| Cabin altitude warning horn above 10,000 ft and cutout re-arm | 2.10.11; 992; WarningEngine Ch15 | Existing warning engine input projected from explicit cabin-altitude sensor |
| FLT ALT -1000 to 37000 steps 500; LAND ALT -1000 to 14000 steps 50 | 2.10.15; 996 | Input validation |

## Persisted I/O and incomplete areas

The private child graph carries 33 entities, 52 ports, 25 curated functional links, 18 conditions, 12 source page links, 6 synthetic instructor faults and 12 runtime projections. Nine gaps remain open, including DCPCS power bus wiring, exact Stall Management N1/N2 channel/payload, automatic valve motion and inflow/pressurization aerodynamics, exact sensor-failure reactions, full flight-stage detection and QRH branching.

**Important:** In this lab cabin altitude, differential pressure and rate are instructor/sensor inputs, *not* calculated consequences of valve or pack motion. No flight-dynamics, airworthiness, or real-world pressurization procedure claims. A checked Node test is evidence of software consistency, not signoff on manufacturer-specific system behavior.

## Next system and acceptance

The next high-priority integration is source-verified BLEED/PACK/airflow dependency, then actual cabinet pressurization indications, and linking approved panel control hotspots/animations in a separate preview only. AC/DC wiring and numerical servo laws must remain externally supplied or visibly unknown.