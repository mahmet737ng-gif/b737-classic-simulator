# ISN-06 — Engine, APU, Fuel, Pneumatic and Electrical Integration

**Date:** 2026-10-23  
**Status:** Implemented **isolated deterministic training pilot**, developed only on branch `design/integrated-systems-network-v01`. No merge to `main` or live cockpit deployment. Target airframe EP-FSI, 737-300, MSN 29340; verify installed option/effectivity before describing full physical fidelity.

## Overview

The existing single-snapshot simulator kernel is now a discrete procedure-driven powerplant source of truth **when** `ENTER_COLD_DARK` activates `propulsion.mode='INTEGRATED'`. All old baseline tests stay in `LEGACY_FIXTURE` mode for backward compatibility. This is not a turbine performance/EGT simulator.

A coordinated command transition now follows:

```
BATTERY + APU FIRE INTERLOCK + NO. 1 TANK FUEL
  -> APU START (inlet door commanded/confirmed)
  -> APU governed/ready sensor confirmation
  -> APU AC generator available (not automatically paralleled)
  -> select APU on bus 1 / bus 2 on GROUND
  -> APU BLEED, measured duct pressure
  -> engine starter switch GRD (battery bus start-valve command)
  -> measured N2 and N1 rotation
  -> engine start lever IDLE (fuel feed and ignition checked)
  -> instructor/sensor-confirmed lightoff
  -> observed N2 reaches ~46% (starter GRD->OFF automatic cutoff)
  -> instructor/sensor-confirmed stable idle
  -> corresponding engine generator now electrically available
  -> crew explicitly connects GEN1 or GEN2 to its bus
  -> engine-driven hydraulic A/B pump receives engine operating input
  -> pressure sensors -> warning logic -> annunciation
```

No source is paralleled. In flight the preexisting electrical evaluator does not accept APU powering both generator buses. APU shutdown removes APU bleed, trips its generator availability; when the two engines are operating with their generators selected, both buses remain energized.

## FCOM provenance (private Technical Database)

| Physical PDF page(s) | FCOM section | Evidence applied |
|---:|---|---|
| 134–135 | NP.21.34–35 | 30 PSI sea-level start pressure, reduced 0.5 PSI per 1,000 ft; N2 ~25% and N1 rotation to move start lever to IDLE (max motoring 20% N2 minimum); at ~46% N2 starter cutout |
| 1193 | 7.10.22 | ENGINE START GRD switch commands start-valve open and closes engine bleed; OFF/CONT/FLT meaning |
| 1208 | 7.20.7 | Starter requires bleed air and battery-bus DC to actuate start valve; APU, ground cart or the other running engine supplies pneumatic source |
| 1209 | 7.20.8 | IGN L from AC transfer bus, IGN R from AC standby; FLT bypasses selector |
| 1216–1218 | 7.30.1–3 | APU supplies both buses on ground or one in flight; No.1/left manifold fuel supply, automatic DC boost pump; battery and fire handle interlocks; inlet-door-before-start, governed/ready output, generator off-bus indication; on-ground battery OFF and pulled fire switch shut APU down |
| 1217 | 7.30.2 | Recommended 60s APU stabilization before bleed usage; an advisory, not a hardware lockout |
| 1150–1153 | 6.20.1–4 | Electrical source selection, nonparalleling and generator/transfer bus logic |
| 1834–1835 | 12.20.1–2 | Fuel boost pump outlet pressure and per-engine source priority |
| 1847–1848 | 13.20.2–3 | Independent engine-driven and AC electric hydraulic supply |

**Limitations on citations:** These are applicable procedural/general 737CL manual rules, not verified WDM pin diagrams for EP-FSI. No copyrighted source manual pages copied into GitHub.

## Implementation

- `engine/network/engine-apu-integration.cjs`: isolated state/command evaluator. Commands: `ENTER_COLD_DARK`, APU switch/door/ready/bleed/fire/generator input, explicit warmup-clock advance, ground cart/crossbleed and measured duct pressure, ignition selection, N2/N1 input, start lever/switch and valve sensor input, lightoff/idle confirmation, generator health and engine shutoff.
- `engine/network/integrated-aircraft-kernel.cjs`: integrates those commands into the *same* electrical and pressure graph as ISN-01–05. In integrated mode GEN1/GEN2/APU cannot be independently marked available by a caller; they follow verified engine/APU state. Engine-driven hydraulic pumps follow engine running state. APU-on-ground battery-switch OFF shuts it down. Original legacy inputs remain supported outside integrated mode.
- `engine/network/annunciation-output-engine.cjs`: logical `APU_GEN_OFF_BUS` and `ENG1/2_START_VALVE_OPEN` signals; actual START VALVE OPEN lamp is **UNKNOWN until physical feedback is explicitly provided**, never equated to the switch's commanded state.
- `power-consumers-lab/index.html`: interactive, branch-only test panel to enter cold/dark, start APU, energize both buses, provide measured duct PSI, switch fuel pump and per-engine N2, confirm lightoff and idle, connect engine generators and shut off an engine.
- `tools/build-power-consumers-lab.cjs`: bundles the same Node source for browser use.
- `tests/engine-apu-integration.test.cjs`: complete stepwise procedure and failure modes including GEN1/GEN2 takeover, APU interlock failure, low bleed PSI, early N2 gate and effect on hydraulic pump, bus transfer, fuel loss.
- `tests/power-consumers-browser.test.cjs`: browser/Node deterministic replay parity including end-to-end cold/dark -> APU -> engine generator.

## Specific safeguards and engineering boundaries

1. **No synthetic engine performance:** N2, N1, lightoff, governed APU condition, stable idle and duct PSI must be explicitly provided/confirmed. EGT and fuel flow are not computed. No invented spool time, fuel burn or engine start temperature.
2. **N2 sequence gating:** Normal lever introduction condition at 25% N2 + N1 rotation; the FCOM documented max-motoring exception uses N2 20% minimum, explicit `maxMotoring` input. Starter GRD releases at 46% N2.
3. **Pneumatic 30 PSI at field elevation:** Minimum is a verified *procedural* sea-level 30 PSI reference reduced by 0.5 PSI per 1,000 feet. Duct PSI is external observation, so without it engine lightoff cannot be confirmed. No automatic APU bleed pressure estimate.
4. **Starter vs actual valve indication:** Battery bus provides start-valve actuation supply; display does not assume valve is physically open just because GRD is selected. Feedback defaults `null`.
5. **Ignition:** Right igniter uses AC standby; for L-only operation with a partial generator bus electrical state, the exact feeder side is unresolved (not invented).
6. **APU:** Starts from the aircraft battery with fire handles in, uses No.1/left manifold fuel, and has automatic DC boost pump during start. Source model uses qualitative input rather than guaranteed fuel pressure in PSI. APU ready is an **external confirmation**, not an invented timer: the FCOM notes start may take up to ~135s; the pilot does not assume it always completes at a fixed second. APU 60s pre-bleed stabilization is **advisory**, not an invented electrical interlock.
7. **No forced engine heat/EGT warnings:** Without EGT/oil/fuel flow sensors, the model does not automatically assert ABORTED ENGINE START, hot start, or EGT limit.
8. **Visual correctness:** Existing cockpit UI graphics/precise panel positions are not changed; the isolated laboratory is a functional test UI, not a verified Boeing panel.
9. **Audio:** ISN-05 sound intents remain connected; the sample files must exist and be verified separately. No made-up start sound output.
10. **Aircraft completeness:** Engine/APU fail mechanics, starter-duty/cooldown clocks, actual turbine acceleration, engine bleed duct regulators, pneumatic valves/duct routing, engine fuel shutoff valves and fire handles beyond these explicit pilot rules remain future tasks.

## Test reproduction

From the repository root on the development branch:

```sh
node tests/system-network.test.cjs
node tests/electrical-integration.test.cjs
node tests/pump-warning-network.test.cjs
node tests/electrical-pressure-stage12.test.cjs
node tests/feeder-pressure-stages.test.cjs
node tests/sensor-failure-network.test.cjs
node tests/annunciation-integration.test.cjs
node tests/engine-apu-integration.test.cjs
node tools/build-power-consumers-lab.cjs --check
node tests/power-consumers-browser.test.cjs
```

The single branch-scoped GitHub Actions workflow runs all these regression and parity tests. **A CI success does not replace a human visual/physical-systems test.**

## Next engineering objective

**ISN-07**: Full pneumatic and engine start-failure/fault protection, including APU shutdown fault reasons, bleed valves and full start interlocks, pneumatic source selection on each engine, quantitative controls where the applicable FCOM/AFM/AMM provides effectivity-verified data, then extend engine fire/shutdown and fuel valve actuation into checklist scenario events. Keep the same replayable state owner and source citations.
