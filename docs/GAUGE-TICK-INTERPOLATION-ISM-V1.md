# B737 Classic — Tick inference and ISM needle positioning v1

**Status: numerical logic tested, individual original-image calibrations NOT approved.** This work updates logic and typed calibration data; it does not change any locked OH images, sprite shapes, or installed cockpit controls.

## Inference procedure

1. Locate each full-length, medium and short graduation stroke in the immutable image. Persist its pixel endpoints, radial angle, length, image hash, scale ID, and observation source. A longer tick is NOT automatically ten units and a short tick is NOT automatically five: these meanings come from printed numeric anchors.
2. Order marks in the direction of **increasing numerical reading** for that scale; declare clockwise, counterclockwise, or linear explicitly. The physical pointer may move in either direction depending on whether the sensor value rises or falls.
3. Between two adjacent printed numbers, count **gaps** rather than unlabeled ticks. If there are `n` unlabeled lines, there are `n+1` gaps. Initial numeric increment = (right reading − left reading) / (n+1). Mark these as *inferred* until the whole dial pattern and source confirm regular numerical subdivision. Example: 20–40 with one unlabeled line → 30; three → 25,30,35. 30–40 with three → 32.5,35,37.5.
4. Once all ticks have their numerical values and their *individual physical angles*, map any continuous sensor value between its two **adjacent numbered or inferred ticks**, not with one global dial-angle formula. The pointer must follow its actual rotational arc; the display does not snap to each tick.
5. Distinguish tick-index interpolation (to infer an *unprinted* value from neighboring printed ones) from physical-angle interpolation (to position the pointer for an arbitrary sensor value). Equal numerical increments do not imply equal physical angles.
6. For two scales sharing one pointer (GEN DRIVE OIL TEMP RISE/IN), map each scale mode independently. Do not interpret an IN reading using the RISE tick values.
7. For source values under/over the approved range, use the mechanism's documented overrange policy; do not invent an overshoot, malfunction position or inertial constant.
8. Require a reviewed native-image tick registry and a verified calibration before allowing ISM readings to drive the actual indicator. Preserve the current visual-only overlays until then.

## Concrete candidate patterns visible in the enlarged Unified screenshot

| Face | Printed anchors | Inferred intermediate strokes | Current trust level |
|---|---|---|---|
| GEN DRIVE OIL TEMP 1, 2 — RISE | 0, 10, 20, 30 °C | 5, 15, 25 | Screenshot-observed; native image tick coordinates unverified |
| Same dial, IN mode | 60, 80, 120, 160 °C | 70, 100, 140 | Same physical strokes but **different numeric scale** |
| A.C. AMPS 1, 2 | 0, 50, 100, 150, 200 A | Four presumed small strokes per 50 A; candidates 10, 20, 30, 40, etc. | Candidate count from screenshot; still requires full-resolution source verification |
| Fuel Temperature | −40, −30, …, +40 °C | Values −39, −38, …, +39 are **continuous positions**, not a claim of 80 extra printed strokes | Nine numerical anchors confirmed by user; previous -70° to 70° visualization not source-angle calibrated |

There are **81 integer readings** inclusive from −40 to +40, and infinitely many fractional readings between them. The engine uses piecewise interpolation between actual registered tick angles; it does *not* create 81 physical marks. The existing legacy visual formula for fuel temperature yields nominal 1.75°/°C but **must not** be treated as an approved per-tick image measurement.

## Runtime modules

- `engine/instruments/scale-tick-inference-v1.js`: infer unprinted numeric tick values based on surrounding label anchors; accept unequal angular gaps, clockwise/CCW growth, long/short tick lengths and 1-unit dense target tables.
- `engine/instruments/gauge-scale-engine-v2.js`: compile a measured rotary/linear calibrated scale, enforce image origin and full scale positions, reject unread/invalid readings by default.
- `engine/instruments/gauge-ism-target-v1.js`: calculate direction from the **signed current-vs-target angular error**. Supports configurable direct, rate-limited or damped motion; per-gauge dynamic parameters remain unapproved pending aircraft references. Rejects mismatched sensor units, invalid readings, and unpowered displays; CPS and Hz are explicitly recognized as synonymous frequency units.
- `engine/instruments/gauge-graduation-patterns-v1.json`: screenshot-backed candidate tick series. Not yet approved physical pixels.
- `engine/instruments/gauge-survey-stage2-3.json`: the 53-face source registry, including approved-by-user numbers, inferred candidate ticks, and the remaining native-source image QA blockers.

## Release gate

The numeric tests are NOT the final visual calibration test. For a gauge to be released, inspect the original immutable image at full resolution, locate every visible tick and min/max endpoint, confirm the mapping is consistent with aircraft source/effectivity, and check every tick's tip position visually (plus center/quarter/fractional tests) with a documented tolerance. Only then can `realReadingsEnabled` be set to true. **As of this work, 0/53 faces meet this standard.**
