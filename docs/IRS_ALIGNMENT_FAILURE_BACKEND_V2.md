# 737 Classic IRS — ALIGN warnings, status codes and recovery (backend V2)

**Date:** 2026-10-28. **Scope:** QRH/procedure simulator, not for real flight navigation.

## Approved interface boundary
- The **93 owner-pinned IRS front-end blobs** remain byte-for-byte frozen. No change to switch/knob geometry, sprites, typography, panel labels, lamps or ISDU display artwork.
- Functional changes are in `engine/systems/irs-trainer-web-v1.js`, the independent IRS L/R core. The approved physical Unified renderer already reads `Core.status().alignLamp` every render, so the backend now produces a deterministic ON/OFF flashing waveform **without modifying the protected front-end**.
- In the existing CDU behavior-only adapter `panel-mosaic-lab/cockpit/cdu-irs-adapter-v1.js`, a poll of the parent IRS state displays the active text on the unchanged FMC CDU scratchpad when no unrelated FMC message is being displayed.

## Normal OFF → NAV / OFF → ALIGN
- 3.5s ON DC initial self-test as the owner training calibration (FCOM calls it a short test, not exactly 3.5s).
- ALIGN steady when an ordinary full or fast alignment is running, waiting ready for manual NAV, or during powered OFF shutdown.
- Below **50°N**, the owner-selected default allows OFF→NAV and automatic NAV upon completed alignment and accepted position.
- **50°N and above**, the owner-selected default requires OFF→ALIGN and manual NAV after the alignment completes. This is distinct from the published FCOM high-latitude **70°12'** limit: alignment is 10 minutes until 70°12', 17 minutes beyond that boundary.
- In an ALIGN-selected normal readiness state, ALIGN remains steady until the crew moves the selector to NAV.
- Existing 7-minute-capped Honeywell-style HDG/STS countdown remains unchanged for normal alignment.

## Blocked ALIGN: source-conditioned indications
| Problem | MRG ISDU HDG/STS | CDU scratchpad | ALIGN | FAULT |
| --- | --- | --- | --- | --- |
| No accepted present position after the alignment timer expires | 08 | ENTER IRS POS | Flash | Off |
| Movement detected during alignment | 03 | IRS MOTION | Flash | Off |
| Stored-vs-entered position fails internal check | 12 | ENTER IRS POS | Flash | Off |
| Computed-latitude internal consistency fails | 04 | ENTER IRS POS | Flash | Off initially |
| Same computed-latitude check fails on a second consecutive entry of identical position | 04 | ENTER IRS POS | Flash | On (latched) |

The lamp is a **white physical ALIGN lamp** whose existing approved sprite is toggled from the IRS core output. Flash period is **1 second**, a training setting (the FCOM/MRG do not prescribe a cadence). The independent `alignLampMode` output is `OFF`, `STEADY` or `FLASHING`. `alignLamp` is the instantaneous boolean used by the frozen renderer, `alignStatusCode` is numeric and `alignStatusText` is zero-padded.

The existing Unified HDG/STS display uses `Core.hdgStsCountdown().value` for both the ordinary countdown and exceptional codes. When blocked, `'03'`, `'04'`, `'08'`, or `'12'` replaces the countdown on the same 13-cell approved hardware, **with no display geometry edit**.

## Position-check evidence and intentional omissions
FCOM requires internal comparison to the last stored position and a computed-latitude check but the sources do not give numeric thresholds suitable for our training model. The core does **not** fake a numerical difference threshold. An instructor or trustworthy telemetry/test scenario explicitly supplies these checks with:

`Core.apply(state, {type:'SET_ALIGNMENT_CHECKS', side:'L'|'R', evidence:{storedPositionConsistent:true|false|null, computedLatitudeConsistent:true|false|null}})`

Missing/unknown evidence is **not evidence of failure**. Any existing CDU >4 NM ORIGIN check is **only** `VERIFY POSITION`, not an automatic 12/04 fault. The first unacceptable stored comparison produces 12; a second identical entry is accepted per the FCOM stored-position re-entry behavior (as long as the separately supplied computed-latitude check passes). First failed computed-latitude comparison produces 04; two consecutive failed same-position entries cause a latched system FAULT that requires OFF and full alignment.

The normal hardware physical keys remain wired through the frozen trainer's existing FMC/ISDU entry paths; additional instructor position-evidence injection is a **backend API**, not a newly added physical control.

## Motion effectivity
FCOM states different behaviors by airframe build effectivity:
- Post-January 1990: automatic full alignment restarts after movement stops; the trainer's default `motionRecoveryPolicy:'AUTO_FULL_RESTART'` resets the timer, clears invalid PPOS, and requests a fresh accepted PPOS.
- Earlier aircraft: use `initialState({motionRecoveryPolicy:'REQUIRE_OFF_RESET'})`; movement stays blocked with code 03 until the pilot cycles OFF and begins full alignment.
- Both behaviors avoid a false system FAULT and prevent publication of NAV position during the interruption.
- Exact implementation/effectivity of airframe S/N 29340 must be checked with its applicable FCOM/WDM before claiming that default is certified.

## QA
- `node tests/irs-trainer-core-v1.test.cjs`
- `node tests/irs-align-annunciator-v2.test.cjs`
- `node tests/irs-unified-integration-v1.test.cjs`
- `node tests/cdu-irs-adapter-v1.test.cjs`
- `python3 panel-mosaic-lab/cockpit/verify-irs-complete-redzone-v1.py --negative-self-test`

All are wired to the repository GitHub Actions IRS QA or RED ZONE checks.

**Primary references:** Sepehran 737CL FCOM 11.10.18–20, 11.20.7–9, 11.40.13, SP.11.4–5, and project-stored B737 Classic/NG MRG p.298–300. The MRG contains type-specific CL/NG variants; do not apply NG-specific features indiscriminately.
