# Reusable animation contract

### Input -> Aircraft command -> State -> Render

1. Pointer gestures emit intent (`press`, `release`, `stepCW`, `stepCCW`, `select`).
2. Aircraft systems engine or trainer computes **accepted state** (interlocks, power, failure states). Animation engine cannot override it.
3. Pass accepted value to `motor.input(controlId, 'select', acceptedValue)` (or `step` for controls with no aircraft numeric feedback yet).
4. The sprite element receives an interruptible CSS transform transition, not a teleport.
5. Annunciators remain independently driven by sensor/system logic; no assumption that moving a switch instantly energizes downstream equipment.

### Example

```js
const reg = globalThis.B737_ANIMATION_REGISTRY;
const motor = B737_MOTION.createRegistryEngine(reg);
const efisMode = document.querySelector('[data-animation-id="EFIS.EHSI_MODE"]');
motor.attach('EFIS.EHSI_MODE', efisMode);
B737_POINTER.bind(efisMode, motor, 'EFIS.EHSI_MODE');

// When simulator state confirms new selection:
motor.input('EFIS.EHSI_MODE', 'select', 'MAP');
```

For proprietary aircraft-artwork apps, use a separate approved graphic with calibrated sprite pivot and per-detent angles. The registry's preview angles are NOT part of aircraft control logic. More detailed physical behavior must be separately evidenced, not extrapolated from a generic easing curve.

**Known validation needed:** MCP lever center pivots and hitboxes; EFIS preview angles; conditions for magnetically retained switches; exact electrical behaviour; real iPad Safari touch QA.