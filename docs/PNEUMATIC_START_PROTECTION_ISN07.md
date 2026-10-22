# ISN-07 — Pneumatic Distribution, Start Guards and APU Protections

**Date:** 2026-10-23  
**Status:** Integrated, source-referenced **development-branch training pilot**, not a released production aircraft-systems model. No merge into `main` and no live cockpit deploy. Target: B737 Classic EP-FSI / MSN 29340; serial-dependent WDM and optional configurations are still not established.

## Implementation

The existing `engine/network/integrated-aircraft-kernel.cjs` remains the sole replayable state owner:

```
Electrical / Engine & APU state / observed duct pressure
  -> engine-apu-integration.cjs
     -> pneumatic-start-protection.cjs (ISN-07)
        -> left/right APU/ground cart/crossbleed start-air availability
        -> isolation-valve command, bleed-trip closure, dual-bleed demand
        -> APU protection signals, APU generator and bleed removal
        -> starter duty counter, cooldown, observed engine-start abort cues
           -> propulsion state and safe checklist advisory
           -> annunciation-output-engine.cjs
              (DUAL BLEED, BLEED TRIP 1/2, ENG1/2 EGT DISPLAY FLASH)
```

The isolated `power-consumers-lab/index.html` now offers the same live state for experimenting with pneumatic switches, bleed trips, APU faults, starter clocks, and observed EGT. The checked-in `runtime.js` is generated from the **same CommonJS source modules** used for Node tests and source-parity verification.

## Primary FCOM references

Private Sepehran B737CL FCOM, physical PDF page numbers:

| Rule | Section | PDF page |
|---|---|---:|
| Isolation AUTO closes with both engine BLEED switches ON and both packs AUTO/HIGH; opens when either BLEED or PACK OFF | 2.10.2, 2.20.2 | 983, 1001 |
| DUAL BLEED illuminates when APU bleed valve open and engine 1 BLEED switch ON, or engine 2 BLEED switch ON with isolation valve open | 2.10.2, 2.20.2 | 983, 1001 |
| BLEED TRIP OFF senses excessive bleed temperature/pressure, closes related engine valve and remains latched until reset after correction | 2.10.3, 2.20.1 | 984, 1000 |
| Duct pressure transmitters drive left/right indicators; isolation valve AC operated, engine/APU bleed valve operation not interchangeable with switch state | 2.20.1–2 | 1000–1001 |
| APU overspeed, low oil pressure, high oil temperature, fire, FCU failure trigger automatic shutdown | 7.30.3 | 1218 |
| APU overtemperature closes bleed valve; APU itself continues operating | 7.30.3 | 1218 |
| Engine start advisory: 725°C EGT threshold or calculated dynamic limit, slow acceleration after 32% N2 | 7.20.7 | 1208 |
| Aborted Engine Start cues: no EGT increase in 10s after lever IDLE, no oil-pressure indication at stabilized idle, slow N1/N2 acceleration after EGT rise, abnormal EGT | NP.21.34 | 134 |
| Starter duty limit 2 minutes per attempt, minimum 20s before 2nd attempt, 3 minutes between 2nd and subsequent attempts; no re-engagement above 20% N2 after premature release | NP.21.33 | 133 |
| Engine start airflow/fuel/ignition and 46% N2 starter cutoff | NP.21.34–35, 7.20.7–8 | 134–135, 1208–1209 |

B737-300/-500 Air System references include applicable FSI schematic identification on FCOM §2.20.3 (PDF p1002), but installed valve feedback wiring, exact transfer bus architecture, sensor thresholds, and actuator delay remain unverified for EP-FSI.

## Pneumatic signal contract

The separate module `engine/network/pneumatic-start-protection.cjs` returns:
- `isolation.switch` crew position AUTO/OPEN/CLOSE
- `isolation.command` derived requested position
- `isolation.nominalProjectedPosition` training actuator approximation only when an AC generator bus is powered, otherwise UNKNOWN
- `isolation.actualValveFeedback: null` until actual aircraft telemetry is available
- `engineValves[1/2].command/available/bleedTripCondition/bleedTripLatched`
- `apuBleedValve.command/projectedOpen/overTemperatureShutdown`
- `dualBleedLightDemand` boolean or null
- `engines[1/2].source/access` (APU / ground cart / engine crossbleed / local engine bleed / none / unknown)

Ground-cart coupling and isolation transition pressure are **qualitative**; the model uses supplied duct PSI, **not** a simulated pneumatic mass-flow solver. The existing `30 - 0.5 PSI × (field elevation in thousands of feet)` start criterion is inherited from ISN-06 NP.21.34. No guess about temperature/pressure thresholds for BLEED TRIP: `SET_BLEED_TRIP_CONDITION` injects a **confirmed fault detection result**, not a raw temperature threshold.

## Protection input / effect table

| Input | Effect | Not modeled |
| --- | --- | --- |
| `SET_APU_PROTECTION_SIGNAL(OVERSPEED / LOW_OIL_PRESSURE / HIGH_OIL_TEMPERATURE / FIRE / FCU_FAILURE)` | APU OFF, its generator unavailable, APU BLEED OFF, condition recorded | Automatic fault sensing threshold, lockout reset procedure |
| `SET_APU_PROTECTION_SIGNAL(BLEED_OVERTEMP)` | APU remains operating; APU bleed valve closes in pilot until observed condition clears | Bleed valve dynamic modulation |
| `SET_BLEED_TRIP_CONDITION(engine, true)` | Engine bleed valve unavailable, BLEED TRIP OFF command ON latched | Exact pressure/temperature trip thresholds |
| `PUSH_BLEED_TRIP_RESET` | Clears only faults whose detected condition is no longer active | Latent hardware faults |
| `ADVANCE_SECONDS` while starter in GRD | Accumulates actual commanded starter seconds and flags >120 seconds | Invented automatic 120-second starter cutout |
| `SET_ENGINE_EGT_C` = 725°C during start | EGT digital flash command and engine start advisory | Automatically stopping engine or sounding nonexistent horn |
| `SET_ENGINE_EGT_RISE_CONFIRMED=false` + 10s after IDLE | Source-indexed Aborted Engine Start checklist cue | Automatic EGT change or oil pressure trajectory |
| `SET_ENGINE_N2_ACCELERATION=SLOW` after EGT confirmed rising and N2 >=32% | Checklist cue | Inferring acceleration without valid N2 samples |
| `SET_ENGINE_OIL_PRESSURE_INDICATED=false` at stable idle | Checklist cue | Oil PSI physics |

**Important correction for source fidelity:** the FCOM states the two-minute starter duty as an *operating limitation*, not an automatic aircraft starter cutoff at exactly 120 seconds. The engine reports a `STARTER_DUTY_LIMIT` procedure fault after overrun but **does not automatically move the start switch or cutoff the fuel**. The operator must command OFF/abort; that transition begins the cooldown before another GRD attempt. The normal starter self-release remains approximately **46% N2** as described in ISN-06.

The warnings are kept as separate outputs from MASTER CAUTION and audio. An observed abnormal engine-start condition does **not** automatically create a general caution bell or force an aircraft fire warning.

## CI regression and cockpit boundaries

- `tests/pneumatic-start-protection.test.cjs` covers isolation AUTO, pack interaction, APU bleed routing, DUAL BLEED, latched trip reset, five independent APU shutdown faults, bleed-overtemperature closure without APU shutdown, observed 725°C EGT, 10-second no-EGT-rise gate, slow N2 after EGT rise, 120s starter duty procedural flag, 20s/180s cooldown, N2<20 retry gate.
- `tests/engine-apu-integration.test.cjs` from ISN-06 remains in the same workflow.
- `tests/power-consumers-browser.test.cjs` verifies identical Node/browser replay of new ISN-07 commands, source bundle parity and UI script parse.
- `.github/workflows/electrical-integration.yml` runs these suites on every push to `design/integrated-systems-network-v01` and **never publishes the main website**.

Still pending:
- Actual aircraft pneumatic manifold topology and WDM/SSM valve inputs/outputs, physical valve feedback, per-engine left/right duct PSI measurement, dynamic pneumatic/thermal equations.
- Installed APU/engine variant sensor trip thresholds and automatic start abort hardware (if any), starter relay/cooldown timing handling beyond source limits.
- Manual/human browser visual/touch test, actual cockpit overhead image coordinate mapping, 737CL-specific checklist rendering and connection of Engine 2/APU Fire Detector sensors.
- Full engine operating characteristics, fuel shutoff valve feedback, EGT growth, starter mechanical inertia, hot/hung/wet-start dynamics, anti-ice/pack bleed load interactions.

**This module supplies bounded, source-referenced event logic only; it is not a complete aircraft engineering simulator or flight-use system.** 
