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


## OH10 Photo Stage — UPD-2026-10-30-ACDC-01

- Stage: [photo-stage.html](photo-stage.html) · [native geometry](photo-geometry.v1.json) · [strict QA test](test.cjs).
- Backdrop is the ORIGINAL owner-locked OH10 1095×1436 PNG at `../panel-mosaic-lab/assets/locked/2026-10-23/OH10-ELEC-LOSSLESS-9a1ca4d6cfb2.png` (SHA-256 `9a1ca4d6cfb277ec1404f3a464e957d81be9d9689a0810883364342d57b0f1ea`). The file is never modified.
- Four meter pivot *candidates* and per-meter tip radii are imported from the existing Unified `panel-mosaic-lab/cockpit/ac-dc-metering-model.js`, not invented from layout proportions. DC AMPS (308.453, 281.608), CPS (774.2, 191.4), DC VOLTS (310.307, 682.818), AC VOLTS (785.143, 702.386). Existing model notes that bezel-circle centers alone do not prove needle-shaft center; photo confirmation remains outstanding.
- The stage **reuses the existing** `ac-dc-metering-needle.svg` from Unified. It displays the source photograph's dial faces by default; a *diagnostic-only* generated dial layer is opt-in for comparisons. No duplicate physical gauges are mounted over the panel.
- Native-pixel selection, drag calibration, 0.5 px keyboard nudging, size tuning, zoom, JSON export, source loading feedback, and local-only changes are available. Drag and residual momentary input capture remains stable while SVG nodes rerender.
- Battery, galley, residual and both selector centers remain *provisional*, and their stage control skins do not replace any red-zone approved masters.
- The DC AMPS and DC VOLTS visual needles use the photographic 11-tick bearing maps already present in Unified. CPS and AC VOLTS are **angle QA only**, despite demo numeric side readouts: neither is connected to an approved physical sensor mapping. The stage's V7 electrical scenario values are illustrative, not load modeling.
- The actual Unified route is `panel-mosaic-lab/cockpit/`. It ALREADY has four separate AC/DC white needle instances and inspector controls. This stage does not replace or remount them. The new stage's five switch/knob placements are not yet authorized for installation.
- The versioned geometry file explicitly has `ownerApproved: false`, `photoPixelAuditPassed: false` and `unifiedMountAllowed: false`. Actual browser photo QA, measured control sockets, locked guard skin reuse, integrated logic and CB fault tests must pass before any Unified change.
- `node acdc-metering-lab/test.cjs` checks the PNG dimensions and SHA256, source link, marker constraints and safe source isolation; now wired to `npm test` for GitHub Pages gating. Test source code is committed, but its GitHub Actions result has not yet been independently observed.

### Geometry acceptance gate (next)
1. Inspect 1095×1436 owner photo at true 100% in the stage.
2. Compare photograph needle pivots, dial rims, selector bores, battery/galley/residual mounting holes against the overlay crosshairs and radius circles.
3. Export calibrated geometry. Before promoting, inspect change set and require explicit QA approval; preserve existing Unified meter calibration if its geometry is already correct.
4. Integrate only verified rotaries/toggles/buttons with the shared backend and current red-zone assets, then test all detents, keyboard/touch interactions, APU/battery/ground source states, residual interlock and electrical CB faults.
