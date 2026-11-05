# Pedestal start lever travel

The owner's front-view ivory grips are mounted over the existing two source
slots. Each has one straight vertical silver support arm at its outer edge.
The top circular hardware was explicitly removed. The hidden shaft reference
stays fixed while the frontal arm projection shortens toward IDLE.

Mouse/touch dragging follows continuous hand position, corrected for cockpit
zoom. CUTOFF is 0%, IDLE 100%; these are travel percentages, not fuel-metering
commands. Intermediate movement sends no ECU command. Reaching an endpoint
requests the existing `PEDESTAL_PHYSICAL` detent from the shared ECU; only its
feedback changes the accepted state. Releasing early or losing the pointer
returns smoothly to the last accepted endpoint. Drag-generated clicks cannot
toggle a just-completed movement back. The two engines remain independent.

Arrow keys move 5% per press. Home/End select CUTOFF/IDLE; Escape cancels
partial travel; Enter/Space and a single tap retain direct detent selection.
Only active settling uses animation frames; there is no idle animation loop.

Assets: `engine-start-grips-front-v2.png` is the unmodified transparent generated
master (2172 × 724). SVG viewports show its two halves without resampling the
source. `engine-start-lever-reference-v2.png` records the corrected visual brief.
Background panels, guarded switches, throttles, fire handles and ECU laws are
not changed by this presentation/interaction update.

Checks: `node tests/engine-start-lever-continuous-v2.test.cjs` exercises partial
travel, stationary straight arms, zoom, mouse/touch, endpoint-only commands,
ECU rejection, feedback during dragging, cancellation, keyboard and remounts.
