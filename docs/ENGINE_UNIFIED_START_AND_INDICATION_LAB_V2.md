# B737 Classic — Unified engine start, Conventional/EIS indications and test laboratory V2

**Date:** 2026-11-05. **Scope:** B737-300/400/500 with CFM56-3 training envelope.

**Status:** Live source-indexed training engine front/back integration. NOT certified, NOT an approved EP-FSI AFM/WDM wiring diagram, NOT an operational flight/maintenance checklist.

## Single-owner signal flow

1. A **real** OH control is operated from the cockpit or the instructor Engine Test Lab. The Lab uses `B737RotaryGuards.setEngineLabDetent` in the existing same-origin overhead frame; it does not mirror independent shadow switches.
2. Existing `b737:rotary-change` and `b737:guarded-change` events enter the existing `B737UnifiedLiveGatewayV1` and `B737ISN1318ECUTestbenchV1`. START is owned by `engine/integration/isn-apu-start-chain-v1.js` and source-linked `isn-start-sequence-v1.js`.
3. Actual ECU N1/N2/EGT/FF/OIL values are published by `b737:unified-ecu-observation`; the same `B737ElectricalV7.evaluate(existingPackState).bus` supplies the instrument electrical dependencies.
4. `engine/instruments/engine-indication-backend-v1.js` applies `engine-indication-technical-db-v1.json` and decides `VALID`, `POWER_LOSS`, `NO_SENSOR_DATA`, `SENSOR_FAILED`, `SENSOR_FAILURE_TRANSIENT`, `UNIT_FAILED`, or `POWER_EFFECT_UNVERIFIED`.
5. `panel-mosaic-lab/cockpit/engine-indication-live-v2.js` drives **existing** `B737EISNeedlesV1`, `B737EISDotReadoutsV1`, and `B737ConventionalNeedlesV1`, with existing photo geometry left untouched. Engine low-oil pressure and filter warning inputs are forwarded to the existing lamp state engine.

## Engine-start physical detents

| Physical control | Observable training logic |
|---|---|
| IGN SOURCE L / BOTH / R | Physical small three-position toggle, ignition channels independently supplied; left igniter AC Transfer, right igniter AC Standby, subject to FCOM effectivity and source availability. No automatic starter valve command from IGN alone. |
| ENG START GRD | Source-dependent starter air-valve command; requires battery bus and available APU bleed or observed eligible opposite-engine crossbleed with isolation OPEN, plus training packs OFF gate. N2 increases under available air even if ignition is unavailable. |
| ENG START OFF | No requested starter engagement. In-progress motoring is aborted safely; operating engines do **not** stop merely because start selector is OFF. |
| ENG START CONT | Continuous-ignition functional selection; supplies the eligible selected channel(s), **not** an air-starter command. |
| ENG START FLT | Flight-ignition functional selection; left and right are demanded independently of the IGN SOURCE toggle but still require their respective bus power. No automatic in-flight restart performance is asserted. |
| Fuel Start Lever CUTOFF / IDLE | Physically changes engine fuel shutoff state. Fuel entry, fuel availability, N2 criterion and igniter eligibility remain separate. A start lever at IDLE alone does not establish combustion. |
| Starter cutout | Existing source-linked Start.Session release at approximately 46% N2, with actuator OFF event sent to the existing physical OH selector. Exact installed engine/starter tolerances remain aircraft-specific. |
| APU / external air / crossbleed | APU start and GEN / bleed retain their existing plant/valve sequence; crossbleed only when opposite engine bleed and source-side manifold route are indicated available. Ground-air cart side allocation is unknown and must not be fabricated. |

Functional references: Sepehran B737CL FCOM 6.20, 7.10, 7.20 and NP.21; B737 MRG IV.6 and IV.7; Lufthansa LAN ATA74, ATA77, ATA79, ATA80. Source claims are **classroom abstractions**; the exact effectivity/serial WDM is not verified.

## Bus-dependent engine indications

| Reading | Conventional | EIS functional supply |
|---|---|---|
| ENG1 / ENG2 N1 | Battery Bus | Battery Bus |
| ENG1 / ENG2 EGT | DC Standby Bus | DC Standby Bus |
| ENG1 / ENG2 N2 | DC1 / DC2 respectively | DC Standby Bus |
| ENG1 / ENG2 Fuel Flow | DC1 / DC2 respectively | Battery Bus |
| ENG1 / ENG2 Oil Pressure | AC Transfer 1 / 2 | Functionally tied to Transfer 1 / 2, but EIS unit pin feed remains WDM-unverified |
| ENG1 / ENG2 Oil Temperature | AC Transfer 1 / 2 | Functionally tied to Transfer 1 / 2, WDM-unverified |
| ENG1 / ENG2 Oil Quantity | AC Transfer 1 / 2; Conventional USG approximation | EIS % full; display unit 28VDC/115VAC pin-out unknown |
| Vibration | LAN AVM Transfer Bus 1 reference | AVM exact installation feed and MRG voltage references are in conflict |

A generator OFF/FAILED does **not** by itself mean its Transfer Bus has failed; actual Electrical V7 bus topology after transfer decides instrument availability. A missing sensor is NOT physical zero. Conventional oil-pressure indication may hold its previous value when its transfer feed is lost, and unresolved EIS unit wiring must report `POWER_EFFECT_UNVERIFIED`.

Fuel USED integrates **observed ECU fuel flow** with the same ECU clock. EIS numeric display switches temporarily to USED and returns to RATE after ten seconds, while the analogue FF pointer remains on instantaneous flow. Conventional RATE/USED hardware hold/return geometry and detailed displayed text have not been independently validated.

## Unified test laboratory

Use the **ENGINE TEST LAB** header button within `panel-mosaic-lab/cockpit/`.

- **Normal**: real OH ENG START GRD/OFF/CONT/FLT and IGN SOURCE L/BOTH/R movement; instructor APU ready, single engine running, fuel lever and shutdown, independent thrust/duct-PSI trainer controls.
- **Abnormal**: N2 stall, hot start, hung start, no light-off, premature starter cutout, flameout, oil pump failure/leak/filter restriction; per-engine N1, N2, EGT, FF, oil and vibration sensor validation/failure.
- **Emergency**: independent GEN1/GEN2, APU GEN, TR1/TR2/TR3, inverter, battery and transfer relay fault injections, fuel cutoff. This is a fault-injection trainer, **not** a QRH substitute.
- **EIS / System**: primary vs secondary EIS failure, individual channel invalidity, power validity, BITE eligibility (N1 both below 10% / oil pressure both below 13 psi), fuel USED/RESET, and explicit oil filter switch differential threshold for instructor QA.
- **Scenario library**: 39 named source-indexed teaching cases with prerequisites, expected effect, inject and clear commands. These cases drive the single ECU/physical owner and should be manually checked against the live indications and start-logic table.

The laboratory shows both engines' physical measurements, bus feed, power state, actual start valve vs commanded position, ignition selector and electrical eligibility, warning lamps and quality status. A start fault should normally be **armed before** operating physical GRD; this UI does not auto-run the pilot's normal procedures.

## Tests

- `node tests/engine-indication-tech-db-v1.test.cjs`
- `node tests/engine-indication-unified-live-v2.test.cjs`
- `node tests/engine-start-crossbleed-ignition-v2.test.cjs`
- `node tests/isn-start-fcom-rules-v1.test.cjs`
- `node tests/isn-ecu-realtime-start-v1.test.cjs`
- `node tests/isn-unified-ecu-physical-v1.test.cjs`
- `.github/workflows/engine-indication-unified-live-v2.yml` CI validates this cohort.
- Protected imagery/Owner18 switch guard and IRS locks were preserved by working additively around existing assets.

## Remaining effectivity/accuracy limits — do not silently treat as complete

1. EP-FSI **specific** WDM/CB/pin feeds, independent EIS LRU supplies and oil filter bypass 24/26 PSID exact switch setting remain unverified. The active 737 model/engine is a selectable training configuration, not a claimed installed serial certificate.
2. Real engine EGT/N1/N2 performance, in-flight engine restart, engine fire suppression, external air cart distribution, vibration from actual accelerometer and selected serial AFM limits still need independently sourced data and regression scenarios.
3. The legacy engine spool-calibration test expecting 20°C for a cold APU conflicts with current 0°C trainer baseline; the legacy fuel high-altitude suction test also disagrees with current fuel runtime. They are separate known legacy-suite discrepancies, not grounds to silently change aircraft physics.
4. Web CI is a simulated source/DOM bridge test; it does not prove photo-pixel accuracy under every browser zoom or physically validate every part of the cockpit. Use the visual runtime QA once deployment completes.

The engine control paths added for the lab never overwrite the locked overhead images, IRS front-end or the 18 owner-protected guarded switches.
