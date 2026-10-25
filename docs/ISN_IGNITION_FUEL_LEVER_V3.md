# ISN Engine Start: Ignition, Early Fuel and Hot-Start Response V3
**Date:** 2026-10-25. **Status:** executed ISN training model; source/effectivity constraints below.

## Airframe-source ignition wiring
B737 Classic source FCOM §7.10.22, §7.20.7–9 (owner's private Sepehran FCOM):
- Engine ignition selector **IGN L**, **BOTH**, **IGN R**, with individual left/right demand subject to the engine's start-switch detent and start lever state.
- **Left ignition** draws from the associated **AC transfer bus**.
- **Right ignition** draws from **AC standby bus**. In an enabled **STANDBY POWER BAT** configuration, the battery supplies the standby AC bus **via the static inverter**; no APU/engine AC *generator* needs to be connected for this ignition source. Do **not** label the igniter a direct 28 VDC exciter. AUTO selection is separately evaluated by Electrical V7 and can preserve UNKNOWN ground-power conflicts.
- Motoring/starter valve and ignition/combustion are separate: engine may motor from available APU pneumatic air and battery-powered starter valve even when neither igniter is eligible; if fuel is opened and ignition absent, fuel flow and lightoff outcomes remain distinct.
- Ignition's right AC standby feed does **not** automatically energize AC booster pumps. Engine fuel supply must still be available through selected/powered pumps or an explicitly enabled verified/simulator suction path.

## Fuel lever / N2 distinction
- The physical pilot **Fuel Start Lever IDLE/CUTOFF** command is now independent of engine N2, start phase and fuel pump status. It immediately commands the wing/MEC fuel shutoff valves as appropriate.
- The FCOM NP.21.33–35 **N2 >=25%** start cue (or eligible max motoring >=20%) is kept strictly as a *procedural recommendation*, **not** a code lock that refuses IDLE. No forced delay, coaching banner or hidden N2 interlock.
- Fuel **delivery** remains separate from lever movement. IDLE with an unpowered/unavailable fuel path leaves observed lever IDLE and reported `NO_AVAILABLE_FUEL_PATH` but does **not** magically produce measured fuel flow. Once pumps become available, the ISN-12 fuel network updates and the ECU can begin lightoff without another lever click.
- Actual combustion requires start-air/motoring, available fuel and at least one selected/powered igniter. The standalone trainer starts lightoff at a minimum synthetic N2 of 5% after fuel delivery and eligibility; this **5% is not a source-backed safe start limit**.
- IDLE can also be positioned **before GRD**; with GRD requested subsequently and prerequisites established, the same fuel/ignition rules apply. Mechanical lever position is not automatically cancelled or reset.

## Training-only low-N2/Hot-start risk
- Owner instruction: early fuel below N2 20% may produce a hot start, not necessarily always.
- Continuous training EGT curve uses entry N2 and a tunable risk increment; at N2 around 18% normal lightoff can occur with somewhat higher peak EGT, while very low N2 around 5% may exceed the existing ground-start **725°C abnormal EGT criterion**. Do not interpret this quantitative curve as an AFM/engine-manufacturer calibrated hot-start probability or a certification limit.
- One peak sample is forced at 75% simulated lightoff progress so that large simulation-clock steps cannot skip the critical transient.
- When EGT >=725°C, latch `ABNORMAL_EGT` / ground-start advisory and **do not** promote engine to RUNNING. The lever remains IDLE until a pilot CUTOFF command; it is **not** an automatically triggered fire alarm. EGT stays indicated hot until shutdown/coastdown instead of decaying invisibly while the lever remains IDLE.
- Normal start duration remains the user's ~85s APU/~100s engine settings in REALTIME_TRAINING with timely start.

## Integration / provenance
- `engine/integration/isn-start-sequence-v1.js`: existing source-located FCOM discrete ignition power/valve rules, unchanged; AC standby is the right power source.
- `engine/systems/electrical-v7.js`: standbySelector and battery/inverter AC standby routing unchanged.
- `engine/integration/isn-apu-start-chain-v1.js`: explicit actual igniter eligibility checks before combustion; starter motoring separately powered; early fuel EGT state and start warnings.
- `engine/integration/isn-engine-start-dynamics-v1.js`: owner-selected N2/EGT transient risk curve, labeled training surrogate.
- `engine/integration/isn-09-12-runtime-v1.js`: real runtime fuel source guards, lever independent of N2; it never turns UNKNOWN pump power into TRUE.
- `engine/integration/isn-13-18-ecu-testbench-v1.js`: right AC standby BAT/AUTO/OFF and L/BOTH/R selector controls; per-engine ignition status, lever status, engine fuel and alerts.
- `isn-ecu-start-lab/`: visible ignition selector/power and source-gated fuel flow for pilot test.
- `tests/isn-early-fuel-battery-ignition-v1.test.cjs`: battery-inverter ignition with no AC generator, motor without ignition generator, early IDLE below N2 20 with normal lightoff or abnormal EGT, pump source arrival after lever IDLE, dual engine independence.
- Existing tests: `tests/isn-ecu-realtime-start-v1.test.cjs`, `tests/isn-ecu-fuel-lever-ui.test.cjs`, `tests/isn-start-fcom-rules-v1.test.cjs`, `tests/isn-start-abnormal-scenarios-v1.test.cjs` and V2.

**Explicit remaining limitations:** real engine-driven fuel pump pressure at zero N2, aircraft-effective left/right igniter feeder variations, battery endurance, installed static-inverter failures and true CFM56-3 EGT/N2 response need effectivity-specific evidence. The dedicated training model does not claim aircraft certification or change locked cockpit artwork.
