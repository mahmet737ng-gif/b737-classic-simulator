# ISN-17 Engine start duct pressure and altitude-dependent fuel schedule V3

**Date:** 2026-10-25 · **Owner-selected TRAINING simulation only**, not a source-verified AFM/CFM56-3 fuel-performance or ground-start schedule.

## Start-pressure dependency

The ECU standalone bench's `REALTIME_TRAINING` setting now uses a nominal **65-second** start to observed RUNNING after ENGINE START GRD, provided the pilot opens the fuel lever at the N2 ~25% cue and there is fuel/ignition/air available. It is made of **28 seconds** nominal pneumatic motoring (N2 0→25%) and **37 seconds** lightoff / spool to about N2 46% and starter cutout, followed by roughly 8 more seconds for idle-indication settling (~73 seconds after GRD). The independent **APU startup remains 85 seconds**. Delay selecting IDLE lengthens the engine start. The physical lever is never interlocked with N2; premature fuel introduction still carries the simulated low-N2 EGT risk.

For the standalone ECU bench, the owner can select a **training duct pressure** of 20–50 PSI independently for Engine 1 or Engine 2 **before starting that engine**. The simulator uses 35 PSI as the reference and estimates the start-stage duration by

```
motoring duration = 28 s × (35 / duct training PSI)
lightoff duration = 37 s × (35 / duct training PSI)
```

Thus, a 35-PSI start should reach RUNNING ~65 s, 45 PSI in ~50.6 s, and 25 PSI in ~91 s (with prompt lever movement). Greater available pressure makes N2 accelerate faster at a given elapsed time, not merely change a UI timer. Two simultaneously starting engines can have different rates. Rates in the **legacy CLASSROOM_COMPRESSED** test chain are not changed.

**Provenance:** Pressure values in the current pneumatic V6 layer are `UNKNOWN` unless a sensor is supplied; the bench slider is **not** a fabricated measured duct sensor or a verified bleed-duct pressure source. The pressure→rate relationship and the 35-PSI calibration are owner-selected approximations. Actual installed APU/starter limitations, available air mass flow, operating starter characteristics, engine-dependent bleed, and real pressure-vs-spool data remain to be sourced and verified. The current test takes pressure as an input before GRD and holds that start profile through the sequence.

## Fuel flow and flight response

The owner asked for around **4000 kg/h per engine near sea level at high takeoff thrust**, declining substantially through climb, approaching **1000 kg/h per engine at high-altitude cruise**. The model distinguishes **takeoff/high thrust** from **ground idle**. It does **not** erroneously assert that an idling engine burns 4000 kg/h. Each engine independently calculates a provisional flow from its throttle, altitude and indicated airspeed:

- `fuelFlowBase = idleFuel + (4000 - idleFuel) * throttle^1.35`
- `altitudeFactor = 1 - 0.65*(clamp(pressureAltitudeFt/35000,0,1)^0.85)`
- `speedFactor = 1 - 0.1*clamp(iasKt/300,0,1)`
- `target fuelFlowKgHr = fuelFlowBase * altitudeFactor * speedFactor`

Ground idle keeps its prior **360 kg/h** sea-level target; nominal flight idle uses **430 kg/h** before altitude/IAS adjustment. Thus full sea-level takeoff throttle, 0 kt reference -> 4000 kg/h, takeoff roll 145 kt -> ~3807 kg/h, and illustrative 35,000 ft / IAS 250 kt / throttle .78 -> ~957 kg/h per engine. These are illustrative simulator-only figures, not AFM performance chart points. Higher throttle at high altitude continues to burn more than typical cruise; flight consumption is never determined by altitude alone.

The pure engine envelope and the running-engine observation route into the ISN-12 fuel network, so **modeled fuel burned is deducted from the appropriate tank**, not only displayed. The ECU has a **SET FLIGHT IAS / ALT** action separate from thrust planning, so users can test the altitude/speed dependence without the N1 planner. All values are **per engine**, not combined aircraft total.

## Implementation and QA

- `engine/integration/isn-engine-start-dynamics-v1.js`: fuelFlowTarget and pressure/IAS-aware runningTarget.
- `engine/integration/isn-apu-start-chain-v1.js`: independent starter duct training input, 35-PSI nominal 28+37 timing, pressure-sensitive N2/lightoff curves, flight-condition forwarding, legacy compressed timing preserved.
- `engine/integration/isn-13-18-ecu-testbench-v1.js`: public per-engine pressure setter, start timing fields and forwarding IAS/altitude.
- `isn-ecu-start-lab/index.html` and `app.js`: duct-pressure sliders plus updated conditions action and live fuel flow indications.
- `tests/isn-duct-pressure-start-and-flight-fuel-v1.test.cjs`: verifies high/low pressure behavior, 65s nominal, unchanged APU time, dual-engine independence, and live engine fuel flow and consumption.
- `tests/isn-ecu-realtime-start-v1.test.cjs` and `tests/isn-start-spool-calibration-v2.test.cjs`: new nominal times; stage-specific N2 oil pressure, EGT peak and starter cutoff remain enforced.

**Safety/accuracy:** Not certified aviation operating data. Aircraft-specific sea-level/thrust fuel flows, high-altitude engine map, speed/altitude lapse rate, motoring-pressure relationship and installed bleed-air system performance require independent validation with the user's FCOM/AFM manuals. Any later fitted effectivity-specific data must supersede these simulation numbers. Simulator startup is not a pilot instruction.
