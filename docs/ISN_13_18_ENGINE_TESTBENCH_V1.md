# B737 Classic ISN-13 ... ISN-18 — integrated ECU / engine startup testbench V1

## Delivery classification

**Training-only executable testbench**, built on existing ISN-01/03/09-12. It is *not* an actual FADEC/ECU model, aircraft maintenance test or complete operational certified systems suite. The 737 Classic CFM56-3 uses hydromechanical MEC with optional PMC-related thrust control rather than modern all-authority FADEC. The lab is a **simulation of test commands and displayed engine measurements**.

Source lineage: Sepehran 737 Classic FCOM §7.20.5 engine oil/fuel system, §7.20.7–9 engine start, §7.30.2–3 APU, §12.20.2 fuel tank pumping/crossfeed, §7.10.9–11 oil pressure lamp red-radial and N2 dependence. Numeric calibration is owner-approved *training estimate*, not recovered from AFM. No scanned reference assets are reproduced.

## Module coverage

| ISN | Implemented in standalone training rig | Limit |
|---|---|---|
| 13 | Independent engine1/engine2 oil pressure from N2 and pump availability; evolving oil temperature/quantity; simulated oil pump failure, leakage and filter restriction; LOW OIL PRESSURE hysteresis 12.25 PSI ON / 15.25 PSI OFF | Training thresholds; reference FCOM uses red radial, fitted sender/hysteresis not independently verified |
| 14 | APU sequence/readout from actual ISN03 start Chain phase; source-selected electrical GEN, selected bleed, injected APU bleed/gen/overheat faults, approximate APU RPM/EGT | APU display profile not an engine-specific hardware simulation. Injected overheat is advisory, not a physical automatic shutdown |
| 15 | Aggregated engine start anomalies, fuel-starvation, oil and APU fault advisories with explicit source tags; no synthetic FIRE bell from EGT or oil failures | Partial non-normal system: no QRH procedure selection or master caution electronics claims |
| 16 | Connected the existing unified ISN thrust-performance planner to train-only engine throttle through ISN09–12 Runtime; returns selected N1 mode, N1 required/command/limit | Not wired to physical CDU N1 LIMIT screen or flight/autothrottle sensors |
| 17 | Actual train-only engine spool state from existing Chain plus independent visual coast-down after fuel CUTOFF and low/high idle transition; oil/fuel driven by the same engine state | Coast-down visualization is separate and tagged; not a high-fidelity turbine thermodynamic model |
| 18 | Executable separate mobile-friendly `/isn-ecu-start-lab/` with BAT/APU/GEN/BLEED/PUMPS/GRD/IDLE/CUTOFF, motor 1/2 gauges, oil lamps, throttle, fault injection, replayable trace and automated start/end-to-end tests | User browser/hardware acceptance not yet independently performed; normal Unified panel not modified |

## Specific invariants

- Every engine numeric value belongs to the existing ISN03 engine source or a distinctly labeled training calculation. The new Bench **does not write new N1/N2/EGT to externally owned sensor ports**.
- Low oil lamp is pressure-dependent, not time- or N2-detent dependent. Lamp ON at <=12.25 PSI, OFF at >15.25 PSI, otherwise previous state persists. Separate filter bypass lamp.
- APU electrical GEN selection and BLEED selection require distinct button actions. Fuel pumps require instructor-enabled surrogate bus power; unknown physical feeder stays unresolved by default.
- GRD starter without APU air/power blocks; engine fuel lever IDLE before N2 cue blocks; fuel lever IDLE with missing fuel path blocks. No arbitrary automatic lever action.
- EGT typical compressed start reaches ~620°C transient and settles; normal user envelope 22/60 ground, 32/78 flight, 97% max training N1. The injected >725°C start advisory is **not** a fire sensor.
- Operating engine fuel flow drains its selected simulated tank; flameout can occur on loss. Crossfeed is explicit and does not invent physical line pressure.
- Shutdown of the original Chain drops observations per the earlier contract; the rig overlays a **training-only indicated coastdown**, preserving source ownership.
- Frozen approved OH-01 to OH-25 and overhead images are unchanged.

## Running the test

Open repository's `/isn-ecu-start-lab/` GitHub Pages route (after deployment).

1. Click BATTERY ON, APU START, then advance/run clock at least 1.4 simulated seconds until READY.
2. Select APU GEN → BUS1, APU BLEED ON, and Enable training pump supply.
3. ENG1 START GRD, step clock 0.85s (N2 25%), ENG1 LEVER IDLE, step ~1s (EGT rises to near 620 then ~420 at cutout), continue until ground idle 22 N1/60 N2 and oil LOW PRESSURE is out.
4. Repeat for engine 2. Switch FLIGHT, set IAS/ALT/OAT and command an N1 Schedule, or move throttle sliders.
5. Inject oil pump failure, filter restriction, bleed loss or hot start to test advisories and no invalid sensor ownership. Finally CUTOFF and advance to see coastdown and the LOW OIL PRESSURE lamp return.

### Automated acceptance

- `node tests/isn-13-18-ecu.test.cjs` (requires original ISN components, new module and existing regression files)
- `node tests/isn-09-12-integration.test.cjs`
- `node tests/isn-engine-envelope-v1.test.cjs`
- `node tests/isn-start-abnormal-scenarios-v2.test.cjs`
- `node --check isn-ecu-start-lab/app.js`
- `python3 panel-mosaic-lab/verify-final-overhead.py`

Known remaining production work: wiring actual CDU display and selected lever detents, physical needle interpolation overlay, full oil system sources/limits, mature APU dynamics, simulator position/IAS dynamics, fuel pressure sensor calibration, complete Master Caution/QRH mapping, engine start timing/real ECU hardware test. The model does not imply that ISN-13...18 are complete for real-world operations or that the Unified app has native integration.

## 2026-10-25 spool calibration follow-up

New owner-selected engine/APU EGT, oil, engine-driven hydraulic and APU AC outputs are documented in [ISN_START_SPOOL_CALIBRATION_V2.md](ISN_START_SPOOL_CALIBRATION_V2.md). These are simulated indicated values, **not measured or aircraft-source-validated pressure dynamics**, and do not certify Unified cockpit integration.
