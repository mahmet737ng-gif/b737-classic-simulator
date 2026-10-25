# ISN Engine Operating Envelope — simulator calibration V1

Status: **IMPLEMENTED, SIMULATION_APPROX_ONLY; not an AFM/N1 calibration.** 
Scope: Boeing 737 Classic cockpit trainer. Source of these target values: **owner-selected approximate behavior** (2026-10-25), not aircraft-certified engineering measurements.

## Target idle/thrust values

| Engine state | N1 % | N2 % | EGT °C | Quality |
| --- | ---: | ---: | ---: | --- |
| Normal start, light-off transient | increasing | up to 46 for starter cutout | approximately 600 peak, then decreases to 420 at completion of compressed classroom sequence | Training approximation |
| Ground low idle (steady) | 22 | 60 | 445 (within 400–500) | Training approximation |
| Flight high idle (steady) | 32 | 78 | 495 (within 400–500) | Training approximation |
| Full normalized thrust command | 97 maximum | 101 training target | 695 training target | Training approximation |

**EGT and N2 takeoff endpoints beyond those explicitly requested are provisional model parameters, not published engine limits.** The user-requested N1 maximum in this training model is 97%, not a claim about the aircraft's actual redline or allowable thrust on a given day.

## Dynamics and transition contract

Backend implementation: `engine/integration/isn-engine-start-dynamics-v1.js`; ISN adapter: `engine/integration/isn-apu-start-chain-v1.js`.

- `sample('MOTORING',elapsedMs)` produces rising starter N2 to 25% in the compressed classroom timeline. Fuel introduction remains a separate, guarded Start Lever command; never infer ignition solely from the RPM display.
- `sample('LIGHT_OFF_SEQUENCE',elapsedMs)` produces an explicitly simulated EGT rise to 600°C at 75% of the compressed light-off interval, then falls to 420°C as the nominal 46% N2 starter-cutout point is reached. The injected `egtHigh` fault follows a separate >725°C path and does not cause a false RUNNING result.
- The observed source owner, **not the thrust demand**, changes engine status to RUNNING. On RUNNING the adapter initializes a numerical training envelope and thereafter calls `stepRunning` with elapsed simulation milliseconds, throttle in [0,1] and an explicit ground/flight condition.
- Ground idle is the minimum **steady-state target** when on ground; flight idle is the minimum **steady-state target** when airborne. When the engine is newly started or the high-idle regime is first selected, N1 and N2 ramp *toward* the target rather than teleport to it. When reducing power **from above idle**, rates are monotonic toward idle and do not undershoot it.
- The response uses a stable first-order exponential approach, with configurable speed constants: N1 acceleration 2200ms/deceleration 3500ms; N2 3000ms/4600ms; EGT 1600ms/3200ms; fuel 1800ms/2500ms. These values are only simulation tuning knobs.
- The normalized throttle-to-N1 curve is nonlinear. Increasing throttle increases N1, N2, EGT and computed simulated fuel flow together. Two engines remain independent.
- `setThrottle('engine1'|'engine2', value)` and `setOnGround(boolean)` expose the backend inputs. They are not evidence of physical cockpit lever mapping or of an external simulator's aircraft state. No frontend sprite/artwork change is required.
- Engine CUTOFF ends RUNNING and withdraws numerical feedback from the current start-session model; a full numeric shutdown coast-down is **not yet implemented** in this adapter. The low/high-idle floor does not constrain an engine that is shut down, stalled or failed.
- External instructor/sensor observations take precedence over simulated running feedback when those fields are externally owned.

## Verification and rollout boundary

Regression file: `tests/isn-engine-envelope-v1.test.cjs` checks 600°C light-off peak, returning EGT, ground/flight idle convergence, 97% N1 ceiling, throttle up/down, start conditions, two-engine isolation, and CUTOFF. The existing ISN start-failure and E2E tests remain authoritative for guards and aborts. Passing synthetic tests does not validate these percentages against the AFM or certify them for flight.

The original Overhead mosaic and all locked cockpit artwork must remain byte-identical. CDU and visual needle connections are follow-on work, not a prerequisite for the backend envelope. The single live authority remains the ISN dynamics/start-chain files above; do not introduce a second competing engine envelope implementation.
