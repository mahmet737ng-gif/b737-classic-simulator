# Unified Cockpit — ECU/ISN-18 start integration (2026-10-25)

**Status:** committed into `panel-mosaic-lab/cockpit/`; dedicated GitHub Actions acceptance passed for the ISN-13–18 ECU and Engine Testbench suites. Live manual pilot acceptance in browser is a separate check. Simulator only; not for aircraft navigation, operations or maintenance.

## Architectural change

The Unified page previously instantiated a separate compressed ISN-03 training chain. The approved Engine/APU Testbench had a DIFFERENT `REALTIME_TRAINING` ECU/ISN-18 engine. They are now unified: `panel-mosaic-lab/cockpit/isn-cockpit.js` instantiates **one** `B737ISN1318ECUTestbenchV1.Testbench` and reuses its `start`, `chain`, `core` and `start.core.pack` for both the physical cockpit and the existing `B737ISNCockpitBridgeV1.Bridge`. There is no duplicated independent start-state machine.

Sources:
- `engine/integration/isn-apu-start-chain-v1.js` — 65-second engine / 85-second APU training sequences; pneumatic start, independent ignition.
- `engine/integration/isn-09-12-runtime-v1.js` — tank, boost pumps, B737 Classic engine-driven suction feed and real fuel consumption.
- `engine/integration/isn-engine-start-dynamics-v1.js` — 620°C EGT startup transient and N1/N2/fuel behavior.
- `engine/integration/isn-13-18-ecu-testbench-v1.js` — central state and read-only indications, oil/hydraulic, APU governor/generation, fault flags.
- `engine/integration/isn-apu-load-dynamics-v1.js` — APU electric and pneumatic load response.
- `engine/integration/isn-thrust-performance-v1.js` — training thrust schedule.

## Physical controls and visualization

| User controls in Unified | Wiring |
|---|---|
| Battery MASTER, STANDBY POWER, generator selections, pump switches | Existing ISN-02 bridge uses the same ECU electrical/pump session |
| APU START / OFF, BLEED, isolation and PACK L/R | Real OH controls update ECU APU/ISN pneumatic start state |
| ENG1 / ENG2 START GRD rotary on overhead | Calls ECU `engineStart` and records engine clock |
| Fuel Start Lever 1/2 on pedestal | Calls ECU `fuelLever` at any N2; suction fuel path is permitted |
| Throttle levers (five-position PNG assets) | Per-engine physical throttle event sets ECU running power demand |
| Main panel N2/EGT mounted gauges | Existing approved needle geometry receives the new shared ECU observations |
| Live engine indication strip | N1, N2, EGT, Fuel Flow, Oil Pressure, valve state and start phase |
| APU start indication | APU RPM, EGT, 115 V / 400 Hz, BLEED, generator state on instructor inspector |
| Instructor start duct inputs | Independent 20–50 PSI `TRAINING` inputs per engine, default 35 PSI (not measured pressure) |

The existing owner-locked cockpit artwork, motor-panel pivots, approved engine-start lever positions, throttle silhouettes and overhead image are **not modified**. APU EGT and other non-calibrated physical needles are deliberately not assigned invented angular scales; the APU numeric output is visible in the inspector. The main-panel needle layer can animate N2/EGT through its *existing training projection*; this does not prove aircraft-specific scale calibration.

## Training timeline

- Battery ON; APU START through the physical overhead; the APU takes ~85 s to READY.
- Select an eligible ignition path; the right igniter may use AC STANDBY sourced from battery/static inverter.
- Set APU BLEED ON, PACK L/R OFF and appropriate isolation, then ENG1/ENG2 START GRD. Engine motoring/spool is ~28 s to N2=25% at 35 PSI.
- Move each physical Fuel Lever to IDLE. Fuel delivery occurs on available boost-pump feed **or** independent engine-driven suction from the corresponding main tank, once rotating. For timely IDLE, engine reaches RUNNING at ~65 s from GRD and stabilizes over subsequent seconds.
- Fuel Lever is mechanically free at any N2, but premature IDLE can yield abnormal EGT under low-N2 training assumptions. Remaining source guards and 725°C advisory are preserved.
- Once running, physical throttles adjust observed N1, N2, EGT and Fuel Flow. Ground high power aims at ~4000 kg/h per engine; altitude/IAS/power-dependent flight cruise may approach ~1000 kg/h, both training assumptions.
- ENGINE START rotary returns automatically on starter cutout via the existing unchanged overhead message adapter.

## Testing and limitations

The dedicated `tests/isn-unified-ecu-physical-v1.test.cjs` validates shared object ownership, control wiring paths, battery/APU, bleed, both engines starting at 35 PSI, fuel suction with electric pumps OFF, throttle-derived high-power flow, and independent engine shutdown. The `ISN 13-18 ECU Startup Acceptance` and `ISN 13–18 Engine Testbench QA` GitHub workflows run the test with their existing cold-dark, geometric and regression guards.

**Not yet verified:** manual full-pilot acceptance across overhead frame/UI under every fitted 737-300/400/500 configuration; pixel-level/photo-calibrated N1 and Fuel Flow needle mapping; aircraft-certified fuel/pneumatic curves. Changes in concurrent work streams must not silently overwrite this wiring; re-run CI after changes.
