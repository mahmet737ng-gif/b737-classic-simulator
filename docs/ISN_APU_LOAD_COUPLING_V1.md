# ISN-14 APU dynamic electrical/bleed load coupling — simulator V1

**As implemented on 2026-10-25 in the standalone ECU start bench.**
The user's word "CPU" in the load discussion is interpreted as the **APU**. All dynamics and kVA values are *training assumptions* pending AFM/AMM and effectivity-specific calibration, not verified physical parameters. No changes are made to frozen instrument photography or OH01–OH25.

## Rule

When loads receive their electrical supply from a selected APU generator source, the APU's **required shaft power and FCU fuel demand increase**; **EGT rises** after a response lag. When electrical or bleed loads are removed, EGT and estimated fuel use return smoothly toward base. The APU speed governor holds the operating RPM around the user's 95.5% calibration: a brief small speed droop on load application (~0.35 percentage points at a full simulated load step, decaying), **not** indefinite N1/RPM growth. The APU gauge is not a turbofan N1 display. The regulated generator remains at **115 V AC / 400 Hz** while ready and healthy.

For the B737 Classic, the relevant FCOM source is the owner-supplied Sepehran 737CL FCOM engine/APU sections §7.30.2–3, with a fuel control unit that controls speed and EGT and protection/bleed modulation at excessive EGT. The precise numerical behavior here is not taken from a source curve.

## Ownership and model

- **Actual selected AC sources:** `snap.selectedSources` from ISN Electrical V7; merely operating the APU without generator selection must **not** count installed electrical load.
- **Explicit standalone training consumers:** AVIONICS (8 estimated kVA, bus 1), CABIN_LIGHTS (3 kVA, bus 1), GALLEY (16 kVA, bus 2) and AIR_CONDITIONING_FANS (10 kVA, bus 2). These device→bus associations and weights are **illustrative test-bank assignments, not EP-FSI WDM findings**.
- **Existing pump network:** ISN-01 Pack pumps may add estimated load *only* in explicitly enabled TRAINING_SURROGATE mode, where that pump is `operating:true` and the projected transfer feeder is powered by a bus whose selected source is APU. No `SOURCE_GATED` UNKNOWN pump is promoted to a known load.
- **Pneumatic bleed:** separately increases the FCU work/EGT target when the actual APU BLEED valve projection is OPEN. APU BLEED switch ON alone without verified valve OPEN is not an invented airflow measurement.
- **Dynamic response:** electrical demand smoothing ~2.5 s, EGT ~6 s, fuel ~4 s; user-configured model baseline 390°C and 110 kg/h; full estimated electrical-load allowance +130°C / +85 kg/h, pneumatic-bleed allowance +55°C / +38 kg/h, with separate component fractions. These are tunable training estimates, **not aircraft limits or EGT maximum**.
- **Fuel consumption bookkeeping:** ISN-12 continues to burn the estimated baseline APU fuel from main tank 1. The ECU bench charges only extra modeled flow above the baseline, to avoid double count. Does not imply installed APU fuel-feed wiring was proven.
- **Startup:** prior 85-second sequence and transient EGT to 620°C remains. This new response begins only once APU READY, without rewriting 620°C as a limit.
- **Generator failure / APU shutdown:** APU source unavailability disconnects the selected electrical buses using existing bridge. Load calculation then drops; shutdown resets governor state.
- **Outputs:** `apu.load.loadDemandKva`, `actualLoadKva`, `generatorLoadPercent`, `powerDemandPercent`, `connectedBuses`, `consumers`; `apu.rpmPct`, `apu.egtC`, and `apu.fuelFlowEstimatedKgHr`. All return `SIM_APU_LOAD_ESTIMATE_NOT_FCOM_CALIBRATED` provenance.

## Code and QA

- `engine/integration/isn-apu-load-dynamics-v1.js` — pure catalog, source-aware load projector, first-order governor and EGT/fuel model
- `engine/integration/isn-13-18-ecu-testbench-v1.js` — integrated per-step updates and training fuel accounting
- `isn-ecu-start-lab/` — standalone controls and visible load/EGT/RPM/fuel readings
- `tests/isn-apu-electrical-load-v1.test.cjs` — checks no electrical load without selected source, per-bus consumers, EGT / fuel rise, near-constant RPM and recovery, bleed, generator failure, and surrogate pumps

These updates do **not** claim accurate APU kVA limit, load shedding at hot EGT, actual aircraft CSD/EGT limitations, installed pump feeder wiring or production-ready Unified cockpit integration. These require dedicated source review and QA.
