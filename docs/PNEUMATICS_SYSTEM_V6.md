# B737 Classic Pneumatics, Bleed Air & Air Conditioning Packs — V6

**System #04 · ATA 21 · training-only source-located discrete engine.**

## Delivery

- `engine/systems/pneumatics-v6.js`: deterministic source-located switches, engine/APU bleed readiness, AUTO isolation, DUAL BLEED, sticky BLEED TRIP/PACK TRIP/DUCT OVERHEAT, independent wing-body leak/test lamps, pack AUTO/HIGH, recirc fan and guarded pressure-display inputs.
- `engine/systems/pneumatics-integration-v6.js`: existing `audio/warning-engine.js` integration for independent sensed cabin-altitude horn and cutout. Pack availability provides a status contract for existing DCPCS V4 **without** changing cabin pressure.
- `pneumatics-lab/`: standalone Overhead controls, instructor sensors/faults, source/duct/pack network, and original non-operational checklist practice UI.
- `tests/pneumatics-v6.test.cjs`: 41 executable core/integration checks with the actual WarningEngine in CI.
- **Private** `/Technical Database/Subsystems/PNEUMATICS-V6/PNEUMATICS_NETWORK_V6.sqlite`: 46 components, 126 typed ports, 63 functional edges (including several explicitly route-unverified edges), 23 source-located rule descriptions (18 discrete, 5 blocked), 11 verified source page references, 8 educational instructor faults, 16 integration bindings, 12 open gaps. Child overlay; the 8 manuals / 5,067 pages remain in original private Technical-Network-V2 database.

## Source pointers — existing private Technical Database, not embedded manuals

| FCOM folio (private page) | Implemented functional behavior |
|---|---|
| 2.10.2 (983) | Isolation CLOSE/AUTO/OPEN, DUAL BLEED source-signal logic |
| 2.10.3 (984) | Engine/APU bleed selections, wing-body test, BLEED TRIP OFF and reset, AC duct gauge indication |
| 2.10.7–8 (988–989) | Pack AUTO/HIGH, mix valve full cold, PACK TRIP OFF, duct overheat, recirc fan |
| 2.20.1–2 (1000–1001) | Engine bleed, 5th/9th stage, AC isolation, APU bleed, DUAL BLEED and duct PSI |
| 2.20.5 (1004) | Wing-body duct leak indication |
| 2.30.1–2 (1006–1007) | Single-pack flow, APU high-flow, cooling cycle and pack trips |
| 2.30.5 (1010) | Duct temperature effect, recirc, temperature indications |

## Source-backed versus intentionally unresolved

Source-confirmed switch rules and annunciation responses are separately marked from deliberately synthetic instructor failures. **Physical duct pressure, source pressure, flow/mass balance, actual pack/ram-air heat transfer, valve response time, installed electrical supply routing, full master caution, automatic fuel/hydraulic/pressurization consequences and QRH aircraft-approved instructions are NOT implemented.**

In particular, the original FCOM identifies engine, APU and external cart as bleed sources but does not make every L/R duct source route unambiguous in indexed text. The trainer does not invent pack availability for APU-only/external-only cases; it emits `null`/UNKNOWN. Source link labels remain distinct from verified physical wiring. `packConditionedAirAvailable` is a discrete educational status — not calculated cabin pressure.

This module is not evidence the EP-FSI aircraft installation has every generic Classic option. It does not modify the approved root cockpit artwork or the deferred three-seat LAN code.