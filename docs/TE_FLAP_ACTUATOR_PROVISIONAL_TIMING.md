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


## LE actual-TE sequence (owner override, Oct 2026)
For the **physical Unified lever** only, individual LE flap and slat target detents follow measured actual trailing-edge flap travel, not the selected lever demand. On UP→40, LE flap and slats first travel to FULL / EXT respectively (~10 s nominal), hold with slats green EXT while the measured TE flaps remain at or below 5°, then move slats from EXT to FULL after measured TE passes 5° (~6 s provisional). During 40→UP, slats remain FULL until measured TE falls below 10°, then TRANSIT to EXT and remain there until TE falls below 1°, then TRANSIT to fully RETRACTED with all lamps extinguished. The main-panel LE FLAPS TRANSIT and EXT lights receive direct whole-system status from the same actual LE model, **not a shortcut using lever selection**. Hydraulic, jamming and TEST handling remain active. Manual standalone scenario controls keep their original selected-lever semantics. User timing calibration pending.
