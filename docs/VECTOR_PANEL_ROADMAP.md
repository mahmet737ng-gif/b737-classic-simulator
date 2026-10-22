# Vector panel rebuild — task register

## Decision (2026-10-22)
- Replace the flat photograph + hotspot approach with individually constructed panel surfaces and 3D-look moving controls.
- Supplied single-page PDF is a layout reference only (overhead, main, pedestal); handwritten annotations are ignored.
- Existing Beta 0.3 retained at site root as backup. New path: /vector-lab/
- No changes to JeppIran.

## Implemented (prototype v0.4)
- [x] Standalone page with **zero cockpit photograph assets**
- [x] Animated two-position physical levers
- [x] Guard lifts before lever becomes interactive; guard closes
- [x] Rotary selector tap, drag, mouse wheel and +/- keyboard-accessible controls
- [x] Momentary power switch with spring-back animation
- [x] Pushbutton with visible travel and lamp-test feedback
- [x] Local saved state, demo reset, action log, simplified bus indicators
- [x] Responsive smartphone layout

## Next (not yet done)
- [ ] Verify every panel geometry, caption, switch detent and direction against high-resolution panel references and B737 Classic FCOM
- [ ] Reproduce complete overhead subpanels, one at a time
- [ ] Separate **physics/mechanical motion** from FCOM-verified systems logic
- [ ] Create fully vectorized main instrument panel and pedestal
- [ ] Add guarded three-position controls, spring-loaded positions, rotary detents, push/pull knobs, circuit breaker mechanics
- [ ] Connect control-to-bus, annunciator and instrument logic using traceable FCOM section identifiers
- [ ] Add explicit accessibility, automated screenshot and state-transition regression tests
- [ ] Replace the main root site only after the new interface has been reviewed and approved

**Caution:** The existing labels and electrical-bus responses in the prototype are an interaction demonstration, *not* a flight-qualified or faithfully verified 737 Classic model.
