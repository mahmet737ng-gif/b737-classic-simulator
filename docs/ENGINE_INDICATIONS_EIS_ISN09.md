# ISN-09 — Engine Instrument System (EIS), EP-FSI

**Date:** 2026-10-23. **Branch:** `design/integrated-systems-network-v01`. **Target:** B737-300 EP-FSI, MSN 29340, CFM56-3B-1 20K. Status: **source-indexed development pilot**. Main/live website and locked primary cockpit artwork not changed.

## EP-FSI instrument choice

Sepehran 737 Classic FCOM §7.10.8, physical PDF p.1179 identifies **FSI** in the EIS secondary panel group; the relevant EIS primary indicators are §7.10.3–7 pp.1174–1178, and secondary indicators §7.10.9–11 pp.1180–1182. Conventional instruments shown for other registrations must **not** be substituted for FSI.

## Implemented source-to-display mapping

| Reading / protection | FCOM ref (PDF page) | Implemented |
| --- | --- | --- |
| N1 % with manual-reference bug interface pending | §7.10.3–4 (1174–75), limitations L.10.7 (86) | Measured N1; red at >=106%. No synthetic FMC target or N1 computation. |
| N2 % | §7.10.5 (1176), L.10.7 (86) | Sole authoritative N2 from ISN-06 engine/start sensor; red >=105%. |
| EGT °C and abnormal-start flash | §7.10.4–5 (1175–76), L.10.7 (86) | Sole authoritative EGT from ISN-07 start-protection sensor; max start 725°C, max takeoff 930°C, continuous limit 895°C. Thrust context unresolved, so red EGT limit is unknown outside identified start/running regimes. |
| Fuel Flow and Fuel Used | §7.10.6–7 (1177–78) | Observed kg/h, display in ×1000 kg/h, 10-second USED mode and one-second reset-preview; integrates kg only after explicit reset and valid flow samples with explicit elapsed-time steps. Data loss sets integration unknown instead of assuming zero fuel. |
| Oil Pressure | §7.10.9–10 (1180–81), L.10.7 (86) | Observed psi, LOW oil light demand <=13 psi; no imaginary oil pressure from N2. Yellow takeoff band left unresolved without verified thrust indication. |
| Oil Temp | §7.10.10 (1181), L.10.7 (86) | °C; >160°C time-limited caution, >=165°C at/above max, explicit elapsed temperature time counter, no thermal solver. |
| Oil Quantity / Vibration | §7.10.10–11 (1181–82) | %FULL and VIB measured, missing remains NO_DATA. No invented thresholds. |
| Primary EIS signal failure | §7.10.3, 5–7 (1174,1176–78) | Injected signal loss: lower stop during first 2 seconds, then dashes; internal failure blanks. The 2s behavior is source-defined and only advances on explicit clock events. |
| Secondary EIS failure | §7.10.11 (1182) | Dashes-or-blank for missing sensor signal, blank for internal failure. No fake zero reading or resulting false low-oil indication. |

These limits are general reference values in the uploaded FCOM. They **do not replace effectivity-specific AFM performance calculations**, which must be validated against serial 29340, 20K engine rating and installed instrumentation. The upper validation envelopes for external input fields are software sanity checks, **not claimed certified aircraft maximums**.

## Network contracts

- `engine/network/engine-indication-eis.cjs`: two-engine measured-channel registry; primary/secondary projection; EIS signal quality, timer, and FF/FU buttons.
- `integrated-aircraft-kernel.cjs`: shares state, timestamp-free explicit event order, `SET_ENGINE_INDICATION` (N1, oil, fuel flow, oil qty, vibration), `SET_INSTRUMENT_SIGNAL`, `PUSH_FUEL_USED`, `RESET_FUEL_USED`; N2 and EGT must use the **existing** authoritative `SET_ENGINE_N2` and `SET_ENGINE_EGT_C`, avoiding contradictory measurements. Only `ADVANCE_SECONDS` progresses timers and accumulated fuel used.
- `annunciation-output-engine.cjs`: projects per-engine N1/N2/EGT red-limit demand and low oil pressure lamp from actual observed state; never invents MASTER CAUTION, general sound or WDM lamp power.
- `power-consumers-lab/index.html`: separate branch-only test layout with two compact Primary/Secondary readout groups, numeric sensor controls, signal-loss testing, FF/FU and reset, and 2-second clock. Display is **functional EIS schematic, not pixel-matched cockpit artwork**.
- `tools/build-power-consumers-lab.cjs` regenerates `runtime.js` from Node modules, preserving one engine.
- `tests/engine-indications-eis.test.cjs` verifies limits, engine authoritative sensor reuse, EGT, oil, timed indication modes, source-informed two-second failures and strict input validation.
- `tests/power-consumers-browser.test.cjs` compares Node versus browser results and checks UI script syntax.

## Open fidelity gates

1. Instrument calibration, actual color/scale geometry, bezel and display pixel positions from FSI FCOM photos and approved cockpit art; EIS readout cards are not the final cockpit.
2. Real EGT/N1/N2 and fuel/oil dynamic models linked to the accepted AFM/technical database, engine rating 20K and installed CFM56-3B-1; this stage deliberately displays measured inputs, not fabricated start/performance curves.
3. Takeoff reference N1 bug, FMC inputs, A/T limit authority, EGT thrust-limit-context and external sensor/power WDM topology.
4. Installed aircraft signal-failure transitions, timers and totalizer behavior under power interruption; existing timing is sourced at pilot scope.
5. Human browser/phone/iPad visual E2E and actual audible quality/switch animations before production release.

**No proprietary manual or audio binaries were copied into GitHub. Production main/live cockpit remains unchanged.**
