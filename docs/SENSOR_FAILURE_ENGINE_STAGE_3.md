# ISN-04 — Sensor & Failure Engine / Stage 3

**Date:** 2026-10-23  
**Scope:** deterministic, FCOM-referenced *training fault-injection* engine connected to Electrical → Fuel & Hydraulic Pumps → Physical Pressure → Discrete Sensors → Warning System.  
**Status:** development branch only; not installed into the primary cockpit or published Pages site.  
**Airframe target:** B737 Classic (user's target EP-FSI, ASN 29340, CFM56-3B-1 20K). **Option-specific wiring and protection remain unverified**.

## Implementation

- `engine/network/sensor-failure-engine.cjs`: owns 12 independently controllable observation channels: six fuel-pump outlet pressure channels; hydraulic A/B electric-pump outlet, engine-pump outlet, and combined system pressure switch channels. Pump physics remains in `pressure-distribution.v0.2.cjs`.
- `engine/network/integrated-aircraft-kernel.cjs`: one deterministic state owner and event reducer. New commands `SET_SENSOR_MODE`, `SET_SENSOR_SAMPLE`, `SET_SENSOR_SETTLING`, with strict sensor IDs and valid inputs. A command produces sensor signal changes, warning causes, caution demand and replayable event history.
- `engine/network/pump-sensor-warning-engine.cjs`: existing FCOM warning logic still determines main/center fuel LOW PRESSURE and hydraulic flight-control indication using the **sensor-reported pressure** and already existing switch/valve inhibit rules. No direct `setWarning(true)` or automatic pump-stop on sensor failure.
- `power-consumers-lab/index.html`: independent visual injector with sensor/mode selectors, explicit intermittent sample controls, pending/settling switch, physical-vs-reported table and existing pump/warning displays.
- `power-consumers-lab/runtime.js`: mechanically generated from the same source as Node test runner; `tools/build-power-consumers-lab.cjs --check` and `tests/power-consumers-browser.test.cjs` confirm bundle parity.
- `tests/sensor-failure-network.test.cjs`: physical versus observed, false indications, hidden real failures, sensor dropout, hydraulic pressure independence, valve/fire-switch inhibits, ACK/recurrence, explicit pending states, strict inputs and deterministic replay.

## Source provenance

- `FCOM-SEPEHRAN-1937` Ch. 12 §12.10.2-3 (physical PDF pp.1826-1827): low fuel pump pressure and switch-dependent lights; dual main tank low vs single pump on master-caution recall; distinct center tank low switch logic.
- §12.20.1 (p.1834): per-pump fuel outlet sensors and center pump automatic cutoff/flicker behavior. The source does **not** prescribe one universal threshold/latency for injected electric sensor faults.
- Ch. 13 §13.10.1 and §13.10.4 (pp.1842,1845): hydraulic pump output low pressure and flight control/system low pressure indicators, inhibit conditions.
- §13.20.3 (p.1848): independent pump output pressure switches vs combined hydraulic system pressure transmitter.
- Ch. 15 §15.20.2 (p.1906): distinction between observed condition, master caution, acknowledgement and recall.

**Source scope:** These manual sections document pressure indications and warning behavior, **not the sensor electronics' electrical failure signatures, circuit breakers, wire path, automatic detection of an open circuit, or arbitrary delays**. OPEN_CIRCUIT and STUCK_* are therefore **instructor/test-injected behaviors**, never marked Boeing-verified avionics fault detection.

## Fault contract

| Fault mode | Simulator's reported sensor value | Physical pump/pressure remains unchanged |
| --- | --- | --- |
| HEALTHY | Physical qualitative pressure (NORMAL/LOW/UNKNOWN) | yes |
| OPEN_CIRCUIT | UNKNOWN, injected invalid | yes |
| UNPOWERED | UNKNOWN, injected sensor-power loss | yes |
| STUCK_LOW | LOW, even when physical pressure is normal | yes |
| STUCK_NORMAL | NORMAL, even when physical pressure is low | yes |
| INTERMITTENT | Explicit selected LOW, NORMAL or DROPOUT (UNKNOWN) | yes |
| `settling=true` | UNKNOWN, PENDING_UNVERIFIED_DURATION | yes |

The sensor's outputs separate `physicalPressure`, `reportedPressure`, `quality`, `injectedFault`, `trainingDiagnosticMismatch`, `delaySeconds: null` and source provenance. **Quality and discrepancy are instructor ground truth**, not assertions that installed Boeing annunciators can recognize the injected discrepancy.

The warning chain consumes `reportedPressure`. An injected stuck-low center pump pressure sensor with a healthy pump can lead to a **false observed FUEL LOW PRESSURE and caution demand**, and stuck-normal can hide a real failure. A sensor disconnected/unpowered/settling produces UNKNOWN, not an invented forced ON/OFF warning. Center tank switch OFF, hydraulic flight control valve inhibit and engine fire-switch related hydraulic pump light inhibit are preserved.

## Timing

Neither a pump motor time constant nor a pressure switch debounce is invented. In particular, FCOM §12.20.1 discusses possible center pump low light flicker and conditions that may persist up to several minutes; this is **not** a universal deterministic alarm-delay timer. Instructor controls can explicitly mark sensor `settling` until released; durationSeconds is `null`.

## Reproduction

```bash
node tests/system-network.test.cjs
node tests/electrical-integration.test.cjs
node tests/pump-warning-network.test.cjs
node tests/electrical-pressure-stage12.test.cjs
node tests/feeder-pressure-stages.test.cjs
node tests/sensor-failure-network.test.cjs
node tools/build-power-consumers-lab.cjs --check
node tests/power-consumers-browser.test.cjs
```

For a local browser, check out branch `design/integrated-systems-network-v01` and serve the repository root over HTTP; then navigate to `/power-consumers-lab/`. Do not assume a private deployed URL exists.

## Open gates

1. Specific WDM/SSM/AMM circuit and installed-serial effectivity for physical sensor power/ground/feed and electronic fault detection.
2. Confirmed pump pressure and gauge/pressure-switch thresholds, failure modes, dynamic lag/damping and center-tank low-pressure timing.
3. A physical time-step integrator for pressure decay/build rather than stepwise steady-state derived pressure, once reference constants are available.
4. Separate sensor `quality` (observable by controller) vs instructor-only truth when avionics fault discrimination is actually documented.
5. True full browser visual interaction test; GitHub CI now checks syntax, script integration and browser-versus-Node runtime parity, but not rendered cockpit artwork or mobile touch behavior.
6. Production cockpit lamp pixels/audio routing and main deployment require **separate approval**.

**No private Boeing PDF scans or copyrighted manual pages have been pushed to GitHub.**
