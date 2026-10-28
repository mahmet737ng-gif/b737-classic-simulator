# B737 Classic IRS L/R — lightweight procedure / QRH trainer (V1)

**Status (2026-10-28):** additive standalone executable reference engine, NOT connected to live Unified / FMC CDU or simulator, NOT suitable for real navigation. The approved 13-cell ISDU display, lower SYS DSPL L/R, other frozen switches, overhead photograph and all Owner18 guards are unmodified.

## Goal and fidelity boundary

Reproduce the *crew-facing* effects of FMC/ISDU position entry, OFF/ALIGN/NAV/ATT, time, validity, standby bus faults, independent IRS L/R positions, true track/GS and 7-minute capped HDG/STS countdown **accurately enough for checklist / QRH training**. Do **not** simulate laser ring gyros, accelerometer coning, inertial earth-rate/Schuler loops or flight-certified navigation. Horizontal position update consumes a dedicated simulator truth-motion feed as a *proxy for inertial mechanization*, with independently drifting estimates. It never re-initializes by copying ground-truth coordinates on each frame.

**Sources:**
- B737 Classic FCOM (Sepehran D6-27370-300/400/500-SHI) **11.10.15–17** (ISDU fields; ISDU keyboard N/S/E/W + ENT; SYS DSPL L/R; BRT).
- **11.20.7–10** (independent L/R IRS, stationary normal OFF→NAV ~10min, high-latitude OFF→ALIGN 17min then select NAV, power buses and backup).
- **SP.11.4–5** (FMC POS INIT / ISDU fallback).
- **11.40.11–17**, [POS INIT/POS REF derived database](CDU_FMC_POS_INIT_POS_REF_2013_2020_FA.md) (LSK 4R SET IRS POS, source validity, VERIFY POSITION if more than 4 NM from ORIGIN airport).
- Owner-approved deviation: **HDG/STS countdown capped at 7** (FCOM revision says 10). See [mode policy](IRS_ISDU_FCOM_MODES_AND_DISPLAY_LOCK.md).

## Input paths — same internal position command, distinct crew workflow

### A. FMC (normal)

1. Select both **IRS MODE** selectors appropriately: OFF → NAV for normal alignment while parked. The two physical MSU selectors are **not** the five-position DSPL SEL switch.
2. In FMC/CDU POS INIT 1/3, use known airport/gate or reliable last position as a reference. Type a *present position* into scratchpad and use **SET IRS POS (4R)**. This dispatches one initialization with L and R candidates independently; the engine must never equate a successful L entry with a healthy R unit.
3. Validate coordinate ranges and minutes. The message **VERIFY POSITION** is a CDU warning when the entered position is more than 4NM from the ORIGIN airport, not by itself a reason to label the IRS failed. Internal IRS consistency tests may additionally cause flashing ALIGN / faults; these remain a future separate state machine, not a guessed absolute-distance rejection.
4. The airplane must remain stationary. At ~10min and with valid initialization, a normal unit reaches NAV; otherwise it displays a prompt or blocked condition.

### B. IRS keypad (fallback, separately selected side)

1. Choose **PPOS** on DSPL SEL and **L/R** on the lower SYS DSPL (the latter is owner-locked artwork). The selected IRS must be powered and in the ALIGN/position-entry phase.
2. Type **N/S plus latitude digits**, then ENT; type **E/W plus longitude digits**, then ENT. Both values form one valid initialization *for that selected IRS only*. Change SYS DSPL to the other unit if independent entry is required.
3. A sample educational format is **N35395 E051254** = latitude N 35°39.5′, longitude E 051°25.4′. These examples are synthetic examples, NOT actual aircraft present position. Last physical display digit is the tenths position (fixed decimal indicator).
4. Position-entry keyboard overrides display mode while active. The ENT white cue accompanies hemisphere entry, and failed entries illuminate CLR; reasonableness checks and cue wiring are future adapters. Invalid minutes (e.g. 65.0), latitude >90° or longitude >180° must be rejected without committing a position.
5. **SET IRS HDG** / H key in ATT is separate **magnetic heading input** and must never be reused as lat/lon initialization.

## Two independently initialized engines

| Mode or phase | Preconditions | Result / trainer handling |
| --- | --- | --- |
| OFF | No active navigation | No position output. Approx. 30s shutdown sequence after turning OFF while powered. |
| OFF → NAV | Valid power, parked | NORMAL ALIGN, nominal 600s, needs valid PPOS. |
| OFF → ALIGN, high latitude | Between 70°12′ and 78°15′ | 1020s and subsequent manual NAV selection. Enforce source-specific latitude/mode rules before wiring live. |
| ALIGNING | Parked, powered, valid progress | Independent countdown by unit; valid entered position required for NAV_READY. |
| WAIT_POSITION | Alignment time elapsed but no position | No valid nav output. |
| BLOCKED_MOVEMENT | Moved while aligning | Invalid, report IRS MOTION. Real aircraft pre/post-1990 re-start effectivity not yet implemented. |
| NAV_READY | Completed valid alignment, NAV | Latitude, longitude, GS, true track, true heading (if source valid), status. |
| NAV → ALIGN | Parked | Optional fast realignment (~30s) and position update; separate from initial full alignment. |
| ATT | Mode selector ATT | No normal NAV position. Magnetic heading entry and ATT re-level are a **future** separate feature; don't claim ready NAV. |
| Power loss | Both selected feeds unavailable | Alignment and NAV outputs invalid. External electrical feed adapter required. |

Each unit stores its own mode, phase, entered origin, position estimate, elapsed alignment/navigation time, valid flag, speed, track, heading, error offsets and last warning. **Never publish true position for an unaligned or faulted unit.**

## Motion inputs and precedence

**Preferred per-frame telemetry (1Hz recommended, <=5s time step):**
`{dtSec, valid:true, gsKt, trueTrackDeg, trueHeadingDeg, altitudeFt, windFromDeg, windKt, stationary}`

A valid `gsKt+trueTrackDeg` pair drives horizontal integration. **Heading and GS alone cannot determine geographic course in a crosswind**; this is an explicit failure. If there is no GS/TRK pair, use **TAS + TRUE HDG + true wind FROM direction/speed**, vector addition:

```text
V_N = TAS*cos(heading) + Wind*cos(windFrom + 180°)
V_E = TAS*sin(heading) + Wind*sin(windFrom + 180°)
GS  = hypot(V_N, V_E)
TRK = atan2(V_E, V_N)
distanceNM = GS * deltaSeconds / 3600
newLatLon  = geodesicDestination(oldLatLon, trueTrack, distanceNM)
```

The great-circle destination formula uses reference radius **3440.065 nautical miles**. With **GS 180 KT**, movement for 1 minute is ~**3 NM**, regardless of nose heading; ALTITUDE does **not** move horizontal geographic position. Altitude is passed through as vertical telemetry only. Use true heading rather than magnetic heading for vectors; calculate magnetic separately only with a reliable variation source.

Missing/stale/invalid source frame -> **no inferred motion** and mark source stale. Resume via explicit source frames; do not silently snap the IRS to simulator latitude/longitude.

## Synthetic L/R drift: ~1 NM *training target*, not a permanent 1-NM offset

Initial position L and R can match exactly on the parking stand. After NAV begins, their estimates integrate common proxy motion but accumulate **oppositely oriented low-frequency biases**. Both errors are smooth, deterministic and repeatable. V1 default drift-rate coefficient is **0.42 NM/hour**, with independent L/R north/east bias and gentle time variation. Their separation after a nominal one-hour run at 180KT is generally **on the order of 0.5–1NM**; it fluctuates/grows gradually.

**Do not hard-code a permanent 1NM difference** from T=0 and do not claim 1NM as a published FCOM gyro tolerance. Configurable instructor presets could set slower/faster drift or change start-position error. V1 does not hard-clip separation at 1NM; a hard clip would teleport one system and falsify independent inertial behavior. `POS REF` can show the two independent sources side by side once integrated.

## Electrical systems, L/R and quality

FCOM: LEFT IRS normal supply **AC STANDBY BUS**; RIGHT IRS normal supply **AC TRANSFER BUS 2**; DC backup from **SWITCHED HOT BATTERY BUS**. With AC absent, RIGHT IRS DC backup has a **five-minute cutoff**. Initial power-up also needs battery bus. Engine's current `POWER` command is **explicit instructor/test input only**; eventual adapter must consume the real results of `engine/systems/electrical-v7.js` and preserve its `null`/unknown states (never treat unknown as definitely powered). ON DC / DC FAIL / ALIGN / FAULT indicators must be derived from independent sides' power and phase; do not infer a full fault implementation just from this V1 engine.

## ISDU 13-cell / modes integration

The photo-locked one-row **13-cell** display, four upper dots and two lower decimal lamps remains **completely immutable**. Create an **independent read-only adapter** in a later phase to map:
- **PPOS**: chosen IRS latitude/longitude with per-source validity.
- **TRK/GS**: chosen IRS true track and ground speed.
- **WIND**: inflight true wind from a valid source only.
- **HDG/STS**: true heading / maintenance code or owner's **7→6→5→4→3→2→1** countdown, separately selected L/R.
- **TEST**: segment and lamp self-test; spring returns to TRK/GS as source rules require.

FMC's `POS REF` must display valid IRS L and IRS R independently, with GS and flags; effectivity-dependent LSK positions must be honored instead of inventing a single variant.

## Implementation and strict boundaries

Standalone reference engine: `engine/systems/irs-trainer-core-v1.cjs`.

Unit-level test: `tests/irs-trainer-core-v1.test.cjs`.

Existing seven-minute format contract: `engine/contracts/irs-hdg-sts-seven-minute-v1.cjs`.

**Not implemented or connected yet:** live Unified keypad event adapter, FMC CDU 4R connector, actual simulator telemetry bridge, electrical feed adapter and 5-minute R DC limit, gyro BITE, full ATT/heading drift model, effectivity-specific movement auto-restart, ARINC output, sensor failure injection, instrument/AFDS integration or real-device acceptance. Until these exist, do **not** report the IRS as a complete working airplane system.

The separate frozen visual locks must always PASS on deployment:
`python3 panel-mosaic-lab/cockpit/verify-irs-13seg-owner-lock-v1.py --negative-self-test`,
`python3 panel-mosaic-lab/cockpit/verify-irs-sys-dspl-owner-lock-v1.py`,
`python3 panel-mosaic-lab/verify-final-overhead.py`,
`python3 panel-mosaic-lab/cockpit/verify-guard-redzone.py --negative-self-test`.
