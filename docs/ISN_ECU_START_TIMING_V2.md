> **SUPERSEDED — 2026-10-25:** Engine REALTIME_TRAINING timing is now 28+37=65 s to RUNNING at nominal 35 PSI, with per-engine duct-pressure dependence; APU remains 85 s. Fuel Lever IDLE is not N2-locked and main-tank suction feed is available with boost pumps OFF. See [ISN_START_DUCT_AND_FUEL_V3.md](ISN_START_DUCT_AND_FUEL_V3.md) and [ISN_FUEL_SUCTION_FEED_V1.md](ISN_FUEL_SUCTION_FEED_V1.md). Earlier 40+50=90 and pump-only/lever-lock instructions below are archival only.

# ISN 13–18 ECU Start Bench: longer owner-selected training timeline (V2)

**Status:** simulator calibration, not aircraft-certified start data. The B737 Classic FCOM controls start prerequisites and the approximate N2 25% fuel cue / 46% starter cutout; it does NOT establish the 85-second APU / 100-second engine schedule selected for this demonstration. Do not present these chosen durations as AFM/FCOM operating requirements.

## Root cause and fixed behavior

The ECU testbench previously inherited the deliberately **compressed** ISN-03 classroom timing profile: APU INLET_DOOR at 0–0.4 s, APU READY at 1.4 s; engine motoring to 25% N2 in 0.85 s, then waiting indefinitely for manual START LEVER IDLE; light-off to 46% N2 in 1 s. A user can see low **N1** (about 2–4%) while N2 is spooling and mistake it for an N2 stall. A fuel lever can also be refused if commanded before 25% N2, if the training fuel pump switches are OFF, or if power to the pumps is unresolved. Such refusal was not explained in the engine panel.

The ISN-03 start chain now accepts a constructor **timing profile**:

| Setting | CLASSROOM_COMPRESSED (existing default) | REALTIME_TRAINING (ECU testbench default) |
| --- | ---: | ---: |
| APU inlet door phase | 0.4 s | 9 s |
| APU READY | 1.4 s | **85 s** |
| Engine motor to N2 25% (from GRD) | 0.85 s | **40 s** |
| Fuel lever cue | 25% N2 plus N1 rotation | **manual** at or after ~40 s |
| Light-off, starter cutout ~46% N2 (after IDLE) | 1 s | **50 s** |
| Approximate stable ground idle after GRD with prompt lever movement | ~12 s | **100 s** |

If manual fuel introduction is delayed, the total engine startup takes longer than 100 seconds. This is correct: the timer must not force fuel lever movement automatically. Both engines are independent and can start simultaneously or sequentially. Default compressed timings elsewhere in Unified and its existing tests are preserved.

- Motoring N2 is smoothly resampled to 25% across 40 seconds; N1 trails, so a small N1 reading early in the start is not evidence of a stall.
- On reaching the fuel introduction cue, the engine stage becomes `AWAIT_FUEL_LEVER_IDLE` and the testbench shows **MOVE FUEL LEVER TO IDLE NOW** if pumps/fuel are ready. The motor does not silently advance past 25% N2 while the lever stays at CUTOFF.
- Start lever IDLE is rejected early and returns the actual N2 reading. Even after 25%, fuel must be independently available from the selected pump network; the fuel gate is not bypassed.
- After accepted IDLE, fuel flow appears and EGT rises through an explicitly simulated transient toward 620°C, then settles. N2 passes to ~46% starter cutout, and the RUNNING idle dynamics settle to around 22% N1 / 60% N2 on ground.
- APU RPM/EGT now transition gradually across the 85-second timebase instead of jumping after 1.4 s. Battery, APU GEN, APU BLEED and pumps remain explicit operator actions.
- Start commands start the lab simulation clock automatically; PAUSE/RESET remain available. No physical cockpit image or frozen panel asset changes.

## Test procedure in the ECU lab

1. BATTERY ON → APU START; wait for APU READY after around 85 seconds.
2. APU GEN → BUS 1, APU BLEED ON, Enable training pump supply.
3. ENG 1 START GRD. Watch **N2** rise; N1 may initially read 2–4% while motoring.
4. At N2 25% (about 40 s after GRD), select ENG 1 LEVER IDLE. Fuel-feed readiness and stage are shown on the corresponding engine card.
5. Observe EGT rising, N2 continuing to ~46%, start valve closing and stabilizing toward N1 22 / N2 60 / EGT ~445 °C, over about 100 seconds after GRD when the lever was moved promptly.
6. Repeat with ENG 2; test pump failure, abnormal EGT, or loss of bleed independently. Do not perform such tests on real aircraft.

## Implementation / QA

- `engine/integration/isn-apu-start-chain-v1.js`: opt-in `TIMING_PROFILES`; externally owned observations still take precedence, existing timed fault ordering preserved and rescaled.
- `engine/integration/isn-13-18-ecu-testbench-v1.js`: selects `REALTIME_TRAINING`, exposes start readiness/status and spool display with correct clock.
- `engine/integration/isn-09-12-runtime-v1.js`: lever acceptance reports truthfully whether the chain moved into `LIGHT_OFF_SEQUENCE`, not merely whether a method returned.
- `isn-ecu-start-lab/app.js` and `index.html`: visible stage cue, elapsed time, pump-feed availability and clear error messages.
- `tests/isn-ecu-realtime-start-v1.test.cjs`: asserts APU 85 s, engine 25% N2 at 40 s, denied early/without-fuel lever, accepted at fuel-ready, EGT transient, starter cutoff at ~90 s, and settled idle by ~100 s.
- `tests/isn-13-18-ecu.test.cjs` explicitly uses `CLASSROOM_COMPRESSED` to preserve legacy regression speed.
- GitHub Actions `ISN 13-18 ECU Startup Acceptance` executes both plus locked overhead guard.

**Not for actual flight, ground operations, or certified ECU maintenance.** A true start simulator would need validated spool/EGT profiles, ambient and bleed-air sensitivity, fuel characteristics and the specific aircraft's variant/effectivity.


**2026-10-25 recalibration:** EGT engine startup peak now ~620°C, APU transient also ~620°C and settles ~390°C. APU READY indicated RPM is capped at 95.5%; availability of 115 V/400 Hz AC at READY is distinct from GEN->BUS selection. Engine oil and EDP pressure follow N2 thresholds described in [ISN_START_SPOOL_CALIBRATION_V2.md](ISN_START_SPOOL_CALIBRATION_V2.md). Older ~600°C or 100% APU test notes are superseded for this standalone ECU bench.
