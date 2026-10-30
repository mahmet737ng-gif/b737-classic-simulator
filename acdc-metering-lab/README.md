# P5-13 · Classic AC/DC Metering — Design Contract v0.1

## Scope / source
- Boeing 737 Classic 300/400/500, **analog** installation. Not a 737NG or later alphanumeric P5-13.
- Source: owner-provided Lufthansa Technical Training, ATA 24 `ELECTRICAL POWER CONTROL PANEL`, printed pages 24–25 and Figure 12, PDF pages 28–29; external cross-check in Classic FCOM 6.10.
- Standalone interactive proof-of-concept: [index.html](index.html). This is not the approved photorealistic master or a certified electrical model.

## Visible control inventory
| Item | Behaviour | Prototype |
|---|---|---|
| DC AMPS | ±50A analog, selector-dependent | demo derived from Electrical V7 bus states |
| DC VOLTS | 0–40V analog, selector-dependent | demo |
| CPS/FREQ | analog, nominal 400 CPS | demo |
| AC VOLTS | normal 100–130V range, residual 0–30V range | separate interpretation fixed in QA |
| DC selector | STBY PWR / BAT BUS / BAT / TR1 / TR2 / TR3 / TEST | clickable 7 detents |
| AC selector | STBY PWR / GRD PWR / GEN1 / APU GEN / GEN2 / optional INV / TEST | clickable detents |
| BAT | guarded ON / OFF; source of truth must remain shared electrical core | demo; existing locked guarded switch artwork untouched |
| GALLEY | ON/OFF | demo; load management details remain unverified |
| RESID VOLTS | momentary press, meaningful only for disconnected GEN1/GEN2 | protected test-lab interpretation |

## Integration / lock rules
1. No changes to protected 18 guarded-switch masters, IRS red zone, existing artwork or Unified settings.
2. The current atlas registry names `OH-10 ELECTRICAL DC / AC` but marks its **geometryStatus as rejected**. Do not mount automatically at those coordinates.
3. Place only after a high-resolution source panel is approved and all four meter pivot centers, rotary-center coordinates, control holes, screw-hole positions, seams and exact panel colors are measured in native-image pixels.
4. Keep background text/screw heads/static sockets in image; needles, rotary knobs, BAT/GALLEY toggle parts and RESID button as separate movable layers. Lock accepted baselines only after explicit owner approval.
5. Build a narrow adapter that **reads** `engine/systems/electrical-v7.js` for bus power states; no invented numeric load physics. AC/DC meter-selector measurement logic must be separately validated against ATA 24, FCOM and equipment-specific wiring before claiming accuracy.
6. Prevent residual-test damage scenario: the trainer warns and inhibits an invalid generator-on-bus test; it does not simulate destructive behaviour.

## QA ledger
- [x] Original manual layout verified against page 29 image.
- [x] Distinct analog Classic vs digital variant documented.
- [x] AC scale bug found and fixed (100–130V regular, 0–30V residual).
- [x] Inline JavaScript syntax check passed; IDs checked for duplicates and unresolved direct references.
- [ ] Real browser / touch QA.
- [ ] 1:1 pixel/center/color/scale QA against original approved asset.
- [ ] Verified dual-battery or INV installation for selected airframe.
- [ ] Validate volt/amp conversion with electrical engineering sources and actual sensor scaling.
- [ ] Mount into Unified; verify overlay, interaction, CB integration and regression tests.
- [ ] Owner review; approval; lock.

**Important:** all numeric live readings are simplified training values, not calibrated aircraft measurements. This page must not be used to operate an aircraft.
