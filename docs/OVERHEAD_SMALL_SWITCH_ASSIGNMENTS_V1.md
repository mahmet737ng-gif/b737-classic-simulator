# OVERHEAD-SMALL-001 — owner-directed overhead sizing

User instruction: 2026-10-26. **Small** means the existing approved **Small White** five-pose toggle family. The Standard five-pose artwork remains immutable, and the Silver alternative is NOT selected.

## 21 Small White toggle IDs

- `alternate-flaps-position`
- `yaw-damper`
- `drive-temp-rise`
- `galley`
- `wing-anti-ice`
- `window-l-side`
- `window-l-fwd`
- `window-r-fwd`
- `window-r-side`
- `window-power-test`
- `pitot-a`
- `pitot-b`
- `recirc-fan`
- `runway-turnoff-l`
- `runway-turnoff-r`
- `taxi`
- `logo`
- `strobe`
- `anti-collision`
- `wing-lights`
- `wheel-well`

The four window-heater switches plus the three-position WINDOW HEAT TEST total five Window Heat controls. PITOT STATIC HEAT A/B are both Small. In the 737-300/500, RECIRC FAN is Small; in the 737-400, that switch becomes R RECIRC FAN and the additional L RECIRC FAN clone uses the identical Small White sprite.

## Small rotary visual sizes

- `engine-start-1`: 0.82 artwork scale
- `engine-start-2`: 0.82 artwork scale
- `ignition-source`: 0.86 artwork scale

These three remain rotary selectors; their original pivot, states, detent angles, legend-click polygons, interaction hitboxes, simulator logic and electrical routing are preserved.

## Guarantees

- Frozen `panel-mosaic-lab/all-overhead/` and locked image assets are untouched.
- The Small White source remains the same existing 5120x1024 RGBA WebP with five 1024px cells LEFT/CENTER/RIGHT/UP/DOWN; metal-bezel center (512,512), metal-bezel diameter 390px, invariant in every frame.
- Standard assets and controls that the owner did not designate stay unchanged.
- Verify with `node panel-mosaic-lab/interactive-overhead/test.cjs`, `node panel-mosaic-lab/interactive-overhead/rotary-guards.test.cjs`, and `python3 panel-mosaic-lab/verify-final-overhead.py`.
