# B737 Classic — needle source-integrity checkpoint (2026-10-26)

**Aircraft:** 737-33V EP-FSI  
**Scope:** read-only Stage 9/10 QA and Unified diagnostics. No original panel image, owner-locked pointer sprite, calibration approval, or displayed needle was modified.

## Confirmed defect and correction
Before this patch, Stage 10 did not pass observed-sensor age or a trustworthy wall-clock reference to the Stage 9 dynamics model. A numerically valid but old observation could continue driving the *QA* target angle. A replayed sample could also overwrite a newer read.

Stage 10 now:
- requires explicit `observationNowMs` (Unix wall-clock milliseconds) and valid `timeMs` for independently observed sensor envelopes;
- keeps wall-clock freshness separate from `nowMs` animation monotonic time, rejecting either clock if it moves backward;
- rejects observed samples more than **5,000 ms old** (configurable QA window), more than 250 ms in the future, missing timestamps, earlier than a previously accepted sample, or same-time samples whose value changed;
- holds the previous QA angle rather than inventing a zero/resting position when these faults occur, and reports the rejection reason;
- clears replay history on explicit workbench reset and clears obsolete Unified QA snapshots after an exception;
- continues to treat un-timestamped training-plant readings as *training-only*, not as validated live equipment sensors.

**This time window is a QA safeguard, not an aircraft-certified instrument lag, sensor tolerance, or electrical-feed mechanic.** It does not authorize physical needle movement.

## Verified test scope
The existing Stage 9/10 test suite plus new cases was executed in a local ECMAScript CommonJS-compatible test harness using exact UTF-8 sources fetched from the default branch: **15 passed, 0 failed**. The Unified script was also syntax-compiled. GitHub Actions completion and browser visual flight QA were *not* verified by this checkpoint.

Regression cases include stale, missing, future, replayed, and mutated timestamps; backward clocks; reset; QA hold behavior; no live sprite writes; and equalized cabin-altitude examples:
- OIAW Ahwaz: **66 ft**
- OIMM Mashhad: **3,260 ft**
- OIII Mehrabad: **3,963 ft**

## Release gates — unchanged
- **54 instrument faces** are indexed, but **0/54 mechanically certified**.
- **38 pointer identities**: only **8** QA scale previews exist; **30** have unresolved response/scale coverage.
- **0 live needle movements authorized**.
- OH19 Cabin Altitude pixel/shaft pivot and all graduations remain *source-photo candidates*, not approved angle geometry. An airport elevation correctly drives a QA target but is not proof of photometric calibration.
- Priority geometry backlog: verify the true shaft centers (not instrument bezel/case-circle centers) of 14 high-risk rotary faces; classify major/minor scale ticks; verify the alternate STAB TRIM right track; expand to all 54 faces.
- The prior 15-face native-image report remains authoritative for locked source photographs and unresolved pixel conflicts: `docs/GAUGE_HIGH_PRIORITY_PIXEL_QA_2026-10-25.md`.

## Changed runtime/test files
- `engine/instruments/stage10-needle-workbench-v1.js`
- `engine/instruments/stage9-stage10.test.cjs`
- `panel-mosaic-lab/cockpit/stage78-readonly-unified.js`

**Next actual-release priority:** photo-grounded individual shaft/tick certification of OH19 Cabin Altitude, then the remaining high-risk faces. Keep every unapproved pointer blocked rather than guessing zero position, mechanical stops or power-off behavior.
