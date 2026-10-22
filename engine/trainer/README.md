# B737 Classic — standalone system/fault trainer core v0.1

## Scope and correctness

**Educational cockpit switching/procedure training only.** No flight dynamics and no operational / maintenance authorization. This deterministic JS module has no DOM dependency and does not change the root cockpit.

What is already functional in this **prototype**:

- Immutable command handling, explicit switch vs. equipment operational states, scenario/fault log and deterministic replay.
- Engine generators, APU and external-power source selection for two generator buses; generator bus vs. transfer bus split and bus crossfeed when BUS TRANS is AUTO.
- 6 fuel pumps and 2 electric hydraulic pumps connected to logical transfer-bus availability; warning state is a pure derived projection.
- Selected annunciators: BUS OFF, TRANSFER BUS OFF, GEN OFF BUS; MAIN and CENTER FUEL LOW PRESSURE distinctions; hydraulic electric LOW PRESSURE / OVERHEAT.
- One original **trainer** flow for BUS OFF single-side, mapped to QRH section 6.1–6.4 rather than copying airline checklists.
- Synthetic fault injection including GEN, external/APU, AC transfer buses, hydraulic motor pumps, fuel pumps, and overheat.
- No audio played in this version; the computed warning state is ready for connection to `audio/warning-engine.js` in a subsequent integration.

## Source locations

| Prototype behavior | Reference | Local PDF page | Printed folio |
|---|---|---:|---|
| GRD PWR, GEN switch and bus annunciators | Sepehran 737CL FCOM | 1147–1148 | 6.10.8–6.10.9 |
| Main/transfer buses, no AC source paralleling, power source transfer | Sepehran 737CL FCOM | 1150–1153 | 6.20.1–6.20.4 |
| Main vs. center fuel low-pressure light conventions | Sepehran 737CL FCOM | 1826–1827 | 12.10.2–12.10.3 |
| Hydraulic ELEC pumps A/B, low-pressure and overheat indicators | Sepehran 737CL FCOM | 1842 | 13.10.1 |
| BUS OFF (single) conditional educational flow | Sepehran 737CL QRH | 133–136 | 6.1–6.4 |

## Training assumptions / not implemented

- **Equipment-to-AC-transfer-bus mapping** in `CONFIG.loadBus` is a **training surrogate**. Exact installed pump wire/bus schedules have not been verified; inspect the electrical load schedule before treating those assignments as aircraft facts.
- Source priority is a simplified two-bus model, not a complete AC electrical protection/GCU/BTB simulation. The model does **not** represent all generator excitation, relay trips, voltage quality, TR relays, battery capacity, overload shedding, DC standby and circuit breakers.
- APU readiness, engine running, external power availability and pump output are instructor-controlled booleans rather than physical dynamics; hydraulic pressure at the system level is a coarse availability boolean, not a hydraulic accumulator or gauge model.
- `indicators.masterCautionHyd` is intentionally always false because the precise derived Master Caution logic is not yet modeled. All displayed fuel caution logic is a limited subset.
- No engine fire switch, actual cockpit event adapter, sound-phrase selector, auto-shutoff fuel center logic, automatic standby hydraulics or complex QRH deferred steps yet.
- Existing QRH is a **licensed source reference** held privately; code does not reproduce full procedures. Some procedure branching is simplified to a single training scenario and requires further review. The exact same serial/equipment effectivity has **not** been asserted.
- No instrument art or cockpit controls have been modified; `trainer-lab/` operates on its own page.

## Development and tests

`node tests/trainer-core.test.cjs` from repository root; 28 isolated deterministic tests, plus Node syntax checks. The GitHub Pages workflow's `npm test` must run these tests before deploying. Local browser automation was blocked by the execution environment, so UI/browser QA is still **pending**, even though JS core tests pass.

New files: `engine/trainer/core.js`, `trainer-lab/{index.html,style.css,app.js}`, `tests/trainer-core.test.cjs`.

## Next increments

1. Independently validate control-switch positions + full generator bus/transfer topology from the Technical Database.
2. Connect actual original cockpit switch event IDs to this central state reducer without changing panel artwork.
3. Wire warning engine/recorded audio utterance IDs and real annunciator light models.
4. Replace original educational BUS OFF script with a checked, branching interactive QRH state machine; expand to hydraulic and fuel faults.
5. Enable reproducible browser screenshot/gesture tests before promoting the independent lab to the main cockpit.