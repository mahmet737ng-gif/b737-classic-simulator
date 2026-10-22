# Integrated Power → Pumps → Pressure Sensors → Warning System — Test 02

Date: 2026-10-23. **Status: executable branch-only integrated pilot, Node CI verified, interactive browser source parity tested; no live cockpit deployment.**

## Actual implementation

- `engine/network/electrical-power-pilot.cjs` produces power-source and bus states, plus applicability-gated equipment loss from the FCOM generator-failure tables.
- `engine/network/pump-sensor-warning-engine.cjs` consumes those **real calculated electrical outputs**, computes the running/stopped/unknown states of **six AC fuel pumps and hydraulic electric pumps A/B**, includes independent engine-driven hydraulic pump paths, computes *discrete pump output-pressure states*, and derives warnings using the source-specific lamp and MASTER CAUTION rules.
- `engine/network/integrated-aircraft-kernel.cjs` is the deterministic state owner for this subset. It offers initial state, derive, atomic event transitions, crew acknowledgement and replayable event logs.
- `tests/pump-warning-network.test.cjs` exercises failure/recovery, sensors, annunciator demand, recall, ACK and unknown-state safeguards.
- `power-consumers-lab/index.html` contains interactive controls and consumes `runtime.js`, a **generated bundle from the exact tested engine modules**; `tools/build-power-consumers-lab.cjs --check` verifies they match.
- `tests/power-consumers-browser.test.cjs` uses Node VM to verify browser/Node output and replay parity and syntax-checks the actual embedded browser UI code.

## Verified source rules / provenance

All pages are **physical PDF pages of the private Sepehran Airlines B737CL FCOM**, not a public copy of source material:

| Rule | FCOM section | PDF page | Applied behavior |
| --- | --- | ---: | --- |
| Electrical source change, alternate transfer and supply | 6.20.1–4 | 1150–1153 | GEN1/GEN2 source and bus state |
| Generator No. 1 inoperative in flight, normal transfers | 6.20.18 | 1167 | No.1 main forward, center RIGHT and HYD B electrical pump inoperative |
| Generator No. 2 inoperative in flight, normal transfers | 6.20.19 | 1168 | No.2 main forward, center LEFT and HYD A electrical pump inoperative |
| Fuel pump switches and center low light | 12.10.2 | 1826 | Center LOW PRESSURE lamp requires switch ON and low output; center pump low produces FUEL caution under described switch conditions |
| Main fuel pump low and caution / simple fault recall | 12.10.3 | 1827 | Main lamp LOW if low output **or switch OFF**; two low in same tank → FUEL caution; one low → recall-only simple fault |
| AC-powered fuel pumps and pressure sensors | 12.20.1 | 1834 | Two AC pumps per tank, sensor at each pump; automatic center shutoff modeled only via explicit event (no fabricated delay) |
| Hydraulic pump / output lights and switch | 13.10.1 | 1842 | Electric pump ON connects power; each pump's LOW PRESSURE light reflects output |
| Flight control low pressure sensor | 13.10.4 | 1845 | Low *combined system* pressure drives related FLT CONTROL low output |
| Hydraulic engine vs electric pump sources | 13.20.2–3 | 1847–1848 | Independent engine-driven pumps; fire switch inhibits related engine pump low pressure indication; output switches independent of system transmitter |
| Master caution and simple-fault recall | 15.20.2 | 1906 | Separate cause vs warning demand vs acknowledged state; new fault after reset re-triggers |
| Fuel, HYD, FLT CONT system annunciators | 15.20.3–4 | 1907–1908 | HYD+FLT CONT projected only for qualifying full system pressure loss; otherwise individual pump LOW does not automatically assert HYD annunciator |

## Sensor and annunciation contracts

Fuel and hydraulic pump **output sensors** return `NORMAL`, `LOW`, or `UNKNOWN`. Outputs are **simulated qualitative conditions**, not physical PSI measurements, and depend on pump command, verified supply, pump health, input fuel/fluid and explicit center auto cutout. Hydraulic A/B additionally return independent **combined system pressure** (`AVAILABLE`, `LOW`, `UNKNOWN`); analog PSI is deliberately `null`.

Source power is `POWERED`, `UNPOWERED`, or `UNKNOWN`. If AC feeder identity is not verified in the bus configuration, the pump/sensor status remains unknown rather than inventing a result. Availability of *other* pumps during the exact single-generator fault cases is marked as an inference from the FCOM inoperative-equipment table, **not a physical WDM wiring verification**.

Warnings are tiered:
1. `pumpLampDemands`: request from the pump's own pressure sensor and switch/inhibit logic.
2. `warningCauses.active` and `simple`: logic for qualified fuel/flight-control warnings; only a simple fault is shown on recall.
3. `masterCaution.logicalDemand`: current non-acknowledged cause or explicit recall.
4. `masterCaution.visible`: **null** if annunciator panel electrical supply cannot be established; otherwise projected under an explicitly labeled *provisional* normal DC-power assumption. Does not claim an exact physical warning circuit.
5. Acknowledging removes a warning *demand* without changing the pump, fault, sensor or fuel pressure. A cleared fault that recurs is a new warning; deterministic replay preserves this distinction.

## End-to-end scenarios

### GEN1 failed in flight, GEN2 remains, BUS TRANS AUTO

- Generator and main bus 1 **unpowered**; transfer bus 1 automatically fed by bus 2.
- Main tank No.1 forward fuel pump **STOPPED_NO_AC**, output LOW and low-pressure lamp requested. Main tank No.1 aft pump remains running under the documented fixture case → this is **one main low-pressure simple/recall condition**, not in itself an immediate fuel master caution.
- Center tank RIGHT **STOPPED_NO_AC**, low-pressure lamp requested. With center switch ON, independent hard FUEL caution is active; **MASTER CAUTION logically demanded**.
- Hydraulic B electric pump **STOPPED_NO_AC**; output sensor LOW and its own LOW PRESSURE lamp demanded.
- Hydraulic B **engine-driven** pump can still maintain combined hydraulic B pressure. No false assumption that autopilot, brakes or all B hydraulic consumers necessarily fail when its electric pump loses power.

### GEN2 failed in flight, GEN1 remains, BUS TRANS AUTO

- Corresponding effect on Main No.2 FWD, Center LEFT and Hydraulic A electric pump; TR3 loses its normal main bus 2 supply.

### Other tests

- GEN1 power recovery clears low-output faults and FUEL caution.
- MASTER CAUTION acknowledgement masks warning demand only; recurrence triggers a new warning.
- One main fuel pump low is recall-only; two main fuel pumps in the same tank low demand a caution.
- Center pump switch OFF extinguishes its own low-output lamp; the main fuel pump switch OFF does not.
- Hydraulic combined system pressure requires **both** its engine- and electrically driven input paths to fail under fixture conditions.
- Engine fire-switch pull inhibits corresponding engine hydraulic pump LOW PRESSURE light.
- Dual AC loss leaves engine-driven hydraulic pumps separate; master caution *display* is UNKNOWN if annunciator supply cannot be verified.
- Unknown AC feeders under unverified BUS TRANS OFF failure are **UNKNOWN**, not an invented powered/unpowered state.
- In-flight dual AC loss, standby and DC bus characteristics are covered by the previous electrical test suite.

## Run

From repository root:

```sh
node tests/system-network.test.cjs
node tests/electrical-integration.test.cjs
node tests/pump-warning-network.test.cjs
node tools/build-power-consumers-lab.cjs --check
node tests/power-consumers-browser.test.cjs
```

For the graphical lab, open `power-consumers-lab/index.html` in a browser using a clone of the development branch. The HTML uses the exact generated `runtime.js`, not a separate collection of demo physics. GitHub Pages for `main` is not changed.

## Engineering boundaries / next work

- The fuel and hydraulic discrete **NORMAL** sensor output when healthy, AC energized and fluid present is an **explicit nominal test-fixture assumption**. It is not guaranteed under real pump loading/cavitation/leakage or failed pressure-switch contacts. Independent hardware sensor faults are not yet modeled.
- Center tank pump's automatic low pressure trip delay, flicker behavior and anti-nuisance MASTER CAUTION timing are **not** invented. Explicit `SET_CENTER_AUTO_CUTOFF` can emulate a trip after separate future timing research.
- Fuel suction feed, engine fuel flow, hydraulic volume/pressure transients, accumulator effects, PTU, reservoir leak models and pump thermal cutout are not implemented.
- Exact hydraulic/fuel AC feeder bus and switch breaker mapping require the appropriate aircraft WDM/SSM/AMM. Current source-grounded generator-inoperative table effects are conditional.
- Full MASTER CAUTION FUEL/HYD alert timing/power and recall event edge cases require independent source/real-cockpit review; visual "lamp ON" projection is a tested logical command, **not a claimed hardware-accurate light output**.
- Aircraft installed-option/serial gating is not yet wired into the kernel. AFM performance and flight limitations are not used to derive these pump results.
- Node CI plus static browser bundle parity **is not full browser E2E visual QA**. Separate user-side browser tests and eventual cockpit UI integration are still needed.
- Live primary website, Android, iPad and GitHub `main` were not changed.

**Progress state:** connected systems pilot is operational in isolated code and a local interactive lab; production-grade aircraft engine and integrated cockpit are **not complete**.
