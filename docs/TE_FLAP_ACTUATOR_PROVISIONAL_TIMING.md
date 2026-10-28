# 737 Classic TE Flap Actuator — preliminary timing (2026-10-28)

The actual trailing-edge flap mechanism is separate from the lever demand. The two L/R needles show the **continuous simulated actual position** rather than jumping directly to the selected stop. The existing LE DEVICES annunciators remain driven by their own physical position and agreement state. All approved visual/guard assets stay unchanged.

| Segment | Provisional duration (seconds) |
|---|---:|
| UP → 1 | 20 |
| 1 → 2 | 15 |
| 2 → 5 | 12 |
| 5 → 10 | 9 |
| 10 → 15 | 7 |
| 15 → 25 | 2 |
| 25 → 30 | 1.25 |
| 30 → 40 | 1.25 |

15 → 40 totals 4.5 seconds. Reverse motions use the same numbers until measured. These numbers are **owner estimates / implementation placeholders, not published 737 limitations**.

Trainer hydraulic factor = clamp(pressurePsi / 3000, 0, 1.1), and Hydraulic B OFF freezes TE and normal LE travel. Thus 1500 psi gives half normal speed. These are temporary trainer parameters, NOT a validated hydraulic pressure relationship; an authoritative pressure feed is not connected.

Pure state/action model: `engine/systems/te-flap-actuator-v1.js`. To calibrate an adjacent segment: `B737TEFlapActuatorV1.apply(state,{type:'CALIBRATE',from:1,to:2,seconds:14.6})`, or running bridge `B737LEDevicesTrainer.calibrateFlapSegment(1,2,14.6)`. Instructor pressure input: `B737LEDevicesTrainer.setHydraulicPressure(1500)`. Read actual TE position: `B737LEDevicesTrainer.flapActuator()`.

Unified physics projections carry `tePosition` (actual), `teTarget` (lever demand), `hydraulicPsi` and `teMoving` from the overhead bridge back to the existing L/R Flap Indicator in the main panel. LE lamp transitions are concurrently slowed on the physical-lever path (20 s retract↔EXT and 16 s EXT↔FULL EXT at nominal pressure), while instructor tests retain prior manual tick timing. This is non-certified simulator behavior for owner timing review.
