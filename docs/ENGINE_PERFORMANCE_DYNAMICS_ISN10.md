# ISN-10 — Engine Performance & Dynamics Integration (Source-gated pilot)

**Date:** 2026-10-23  
**Aircraft:** Boeing 737-33V / EP-FSI / MSN 29340 / CFM56-3B-1 / 20K (20,000 lbf user-confirmed installed rating).  
**Status:** isolated development branch implementation of AFM quality gating and observed transient replay; **NOT a final thrust, N1, N2, EGT or fuel-flow predictive physics model.** No main-branch merge or deployment.

## Source audit and the numerical N1 decision

The private Technical Database AFM v13 was inspected and its read-only source QA summary was connected as source metadata, not copied as proprietary chart images. The original AFM source is Rev 32, reference `AFM-73733V-D6-8730.33V-R32-20180214`, SHA256 `3c7002212482f0c47a1735c2302ee304ef41ef4ca270591281b72f5f2a714105`. v13 has **0 independently approved numeric final N1 points**, **0 release gates active**, **9 outstanding blockers**, **no independent human validation** and explicitly disabled FMC calculated N1. Graph image segments, provisional ticks and 104/16 historical samples do **not** constitute a final numeric curve or transient model. Their direct use for rated N1 would be a made-up performance answer.

| Task | State |
| --- | --- |
| Effectivity matching MSN 29340 / EP-FSI / CFM56-3B-1 / 20K | Guarded |
| Raw AFM v13 chart QA metadata | Recorded (source provenance only) |
| Final AFM Takeoff N1 / MCT N1 | **BLOCKED**; no numeric output |
| PMC OFF, bleed, anti-ice and reduced-thrust correction | **BLOCKED** by source/effectivity |
| Throttle command to N1/EGT/Fuel Flow response | **BLOCKED**; no approved engine-response maps |
| External recorded time-series interpolation | **Implemented, source-labelled user-supplied training replay** |
| Quantitative fuel used from observed recorded flow | **Implemented inside source interval only** |

The `getAFMTargetN1` API does not accept a caller's `verified:true`/QA override. It **always** throws `AFM_N1_QA_BLOCKED` for the current v13 release gate; it also rejects another serial, model or rating. This enforces the prior Performance Engine safety rule rather than claiming an invented value.

## New modules

- `engine/network/engine-performance-dynamics.cjs` — source effectivity check, track metadata and finite-range validation, recorded interpolator, bounded replay clock, trapezoidal fuel burn integral and strict performance-mode authority. The explicit synthetic fixture mode is training-only and requires `allowSyntheticFixture:true`.
- `engine/network/epfsi-performance-source-gate.v13.json` — plain provenance, thresholds and release blockers for future agents and simulator systems. Does not include scanned pages or proprietary graphs.
- `engine/network/integrated-aircraft-kernel.cjs` — source-of-truth event integration: `SET_ENGINE_THRUST_COMMAND`, `LOAD_ENGINE_OBSERVED_TRACK`, `STOP_ENGINE_OBSERVED_TRACK`, and existing `ADVANCE_SECONDS`. Time affects sensor values only when an external trace exists; when absent, N1/EGT/fuel flow remain uncalculated.
- `engine/network/engine-indication-eis.cjs` — FF/FU accumulation can consume integrated fuel from the actual observed track instead of holding the last end-point flow rate. The N2 and EGT owner modules remain unique; manual concurrent writes are rejected during replay.
- `power-consumers-lab/index.html` — a separate, non-deployed functional lab with JSON import for a measured source-attributed N1/N2/EGT/FF time-series, throttle command (no calibration), per-engine stop and step-advance, plus existing EIS indicators. It shows *blocked* AFM N1 and source quality persistently.

## Trace contract and state ownership

```
{
  "aircraft":{"registration":"EP-FSI","msn":29340,"engine":"CFM56-3B-1","ratingLbf":20000},
  "sourceType":"OBSERVED_TELEMETRY",
  "sourceId":"your-log-file-and-recording-run-id",
  "samples":[
    {"timeSec":0,"n1Pct":<observed>,"n2Pct":<observed>,"egtC":<observed>,"fuelFlowKgHr":<observed>},
    {"timeSec":<later>,"n1Pct":<observed>,"n2Pct":<observed>,"egtC":<observed>,"fuelFlowKgHr":<observed>}
  ]
}
```

The above is a *schema illustration*, not literal JSON or proposed aircraft values. Each sample must supply all four observed numerical channels, increasing time, starting at 0. Up to 500 source observations and 36,000s maximum time span; values within software sanity envelopes. At an exact sample timestamp, the observation is replayed; strictly between adjacent samples **linear interpolation** is used and explicitly labelled `INTERPOLATED_BETWEEN_SUPPLIED_SAMPLES` (not certified or physically predicted). No interpolation/extrapolation beyond the final sample. If the clock oversteps that endpoint, the replay closes with `REPLAY_ENDED`, and fuel-use accumulation changes to UNKNOWN rather than pretending engine burn outside coverage. Sensor manual override is available only after `STOP_ENGINE_OBSERVED_TRACK`. Both engines have independent track clocks and inputs.

Thrust command `0..100%` is stored as a cockpit command only: no guessed lever-angle conversion, N1 gain, EGT rise, N2 acceleration, fuel flow rate or engine-generator event. Mechanical start and generator source conditions from ISN-06/07 are not silently overridden by the replay profile.

## Tests and QA

`tests/engine-performance-isn10.test.cjs` covers:
- Strict airframe/engine/rating effectivity; AFM N1 fails closed even with untrusted QA flags.
- Invalid trace metadata, NaN, mismatched serial, invalid time order, AFM claims and unapproved synthetic fixture injection rejected.
- Exact observations, mid-interval N1/N2/EGT/FF values and absence of extrapolation.
- Manual throttle command has no numeric engine-output authority.
- Uniqueness of EIS/propulsion authoritative signals.
- Explicit reset timing and exact fuel-use integration between source points.
- End-of-track unknown consumption and ability to return to manual sensor mode.
- Deterministic replays.

`tests/power-consumers-browser.test.cjs` compares a complete trace import/interpolation/stop sequence between Node and the source-generated browser `runtime.js`, while also checking the UI controls and JavaScript parser. Branch GitHub Actions runs this along with every prior ISN integration test.

## Still required for predictive engine dynamics (next physical-engine stage)

1. Complete FCOM/AFM effectivity-verified N1 takeoff and MCT chart digitization with independent human QA and golden vectors; confirm aircraft PMC configuration. Existing v13 release has no eligible final N1.
2. Recorded validated CFM56-3B-1 20K engine transient datasets (spool, inertia, fuel flow, EGT, oil pressure/temp across states, altitude/temperature/bleed/throttle). AFM flight/performance charts **alone** are not time-domain engine response curves.
3. Design and calibrate an identified dynamics model against multiple recordings; validate out-of-envelope behavior and stable numerical integration. Do not treat a user-supplied time series as a certified turbine model.
4. Attach true thrust-lever animation and calibrated cockpit EIS art positions, QRH start limits and FMC target delivery to the corresponding simulator systems; no authority conflict.
5. Human visual/browser acceptance; CI passing tests do not establish aircraft hardware/operational fidelity.

**This is a training and engineering development artifact, not navigation/flight software.**
