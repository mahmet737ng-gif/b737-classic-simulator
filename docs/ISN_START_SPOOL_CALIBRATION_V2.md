# ISN ECU Start Spool Calibration V2 — 2026-10-25

**Status:** code and deterministic CI test present; this is an owner-requested **simulator training calibration**, **NOT** a source-verified Boeing 737 Classic / CFM56-3 system-performance dataset. These values do not authorize operation, maintenance or aircraft-specific wiring claims. Applies to **both engines** in the standalone ISN-13–18 ECU bench and to the common training EGT start-dynamics curve.

## Startup behavior

| Signal | Training calibration | Scope |
|---|---|---|
| Engine EGT | After fuel lever IDLE, climbs to **620°C** at ~75% of simulated lightoff, then falls to **420°C** at starter cutout; subsequently converges to ground idle **445°C** | Separate engine1 and engine2; 725°C abnormal-start gate unchanged |
| APU EGT | Climbs to **620°C** at ~64% of APU door-open to ready phase, then falls to **390°C** at APU READY | Surrogate curve; no inferred installed APU hot-start protections |
| Engine oil pressure | 0 PSI before **N2 18%**, rises rapidly between **18% and 22%** to target ~45 PSI at 22%; higher N2 then drives a capped 95 PSI training target | Per-engine: physical spool curve not verified |
| LOW OIL PRESSURE lamp | OFF at **>=13 PSI**, ON at **<=11.75 PSI**, holds existing state between | Simulator Schmitt thresholds, not established aircraft sensing/annunciator calibration |
| Engine-driven hydraulic pressure | Ramps from **N2 4.5%** to **3,000 PSI at N2 6%**, and stays at 3,000 while N2 remains >=6% | Independent computed pump indicator: engine1 -> A, engine2 -> B. **Not** a verified hydraulic manifold sensor or electric-pump bus |
| APU rated speed | **95.5% RPM** maximum at READY after nominal 85 s | Simulated APU speed, not source-verifiable installed APU gauge scale |
| APU generator | At READY / rated >=95% RPM, if no generator fault, generator output indication **115 V AC, 400 Hz** | Generation is **not** automatic GEN-to-BUS connection. Explicit APU GEN selection still required |

## Start timing and independence

- Existing ECU REALTIME_TRAINING timeline stays APU READY ~85 seconds; Engine N2 ~25% after 40 s GRD; manual fuel lever IDLE then 50 s simulated LIGHT_OFF_SEQUENCE; RUNNING around 90 s from GRD and stable idle around 100 s (assuming immediate manual IDLE).
- Oil and engine-driven hydraulic pressure derive from each engine's own N2; no pressure should be projected as source-verified sensor input. Loss of oil pump still drops oil pressure and re-lights lamp; faults are independent per engine.
- APU generator failure removes its modeled 115 V/400 Hz availability and disconnects selected APU sources in the existing training bridge. The engine's EGT profile is independent of APU GEN selection.
- The engine ramp is shared via `engine/integration/isn-engine-start-dynamics-v1.js`; APU, oil, hydraulics and generator projections in `engine/integration/isn-13-18-ecu-testbench-v1.js`. The bench UI shows HYD PRESS and APU generator AC.
- Real hydraulic, oil, APU speed, EGT performance at ambient/altitude/load, bus voltage and frequency transient validation against aircraft-specific technical references **remains open**.

## QA

The deterministic acceptance test `tests/isn-start-spool-calibration-v2.test.cjs` verifies the APU EGT rise/fall, 95.5% RPM and 115V/400Hz after READY, pre-ready generator selection rejection, independent bus selection, engine hydraulic output 3,000 PSI by N2 6, no oil pressure before N2 18, LOW OIL PRESSURE out by N2 22, 620°C engine peak, cooldown, and generator-failure disconnect. It runs within the `ISN 13-18 ECU Startup Acceptance` CI gate.

The default Unified 737 cockpit artistic layout, cockpit sprites and frozen OH01–OH25 atlas were not modified. Publishing source files is not physical pilot acceptance.
