# ISN Thrust Schedule V1 — educational N1 reference and speed-hold model
Status: **IMPLEMENTED SURROGATE, NOT AFM-VALIDATED, NOT CONNECTED TO CDU OR A/T**. Backend only. No image/panel modifications.

## Distinguish three independent outputs

1. **N1 LIMIT**: reference ceiling by selected TO/GA/CON/CLB/CRZ mode, weather/altitude assumptions, bleed/pack/anti-ice controls.
2. **N1 REQUIRED**: estimate of per-engine power for steady IAS and current flight path; depends on mass, pressure altitude, actual OAT, IAS, vertical speed, flap/gear and number of running engines.
3. **N1 ACTUAL**: owned by the ISN running-engine dynamics/observations, which this module does not overwrite.

FCOM 11.41.42–43 lists AUTO, GA, CON, CLB, CRZ and CLB-1, and on suitably equipped aircraft CLB-2, with approximately 3/6 percentage-point N1 climb derates that progressively disappear at 15,000 ft. FCOM identifies bleed and present conditions as N1 limit inputs; it does **not** validate this project's invented numerical surface.

### Tunable approximate reference N1 (%)

|Mode|Base reference before corrections|
|---|---:|
| TO |97.0|
| GA |96.5|
| CON (MCT) |94.0|
| CLB |92.0|
| CRZ |88.0|
| CLB-1 |CLB minus 3 × max(0,(15000-altitudeFt)/15000)|
| CLB-2 |CLB minus 6 × same fading fraction, only if installed|

Numbers above implement the project owner's desired **training-mode hierarchy**, not a universal Boeing thrust law. No automatic AFM data activation. Small N1-limit adjustments for ISA deviation, pressure altitude, bleed, high-pack and anti-ice are approximate configurable policies, not authoritative aircraft corrections.

## Model calculation

Inputs: pressure altitude ft, OAT °C, IAS kt, airplane mass kg, climb/descent fpm, engine count (1/2), flap and gear state, anti-ice/bleed/pack selections, selected N1 mode, wind speed plus FROM direction and desired track. Missing values use **explicitly returned simulator defaults** (10,000 ft, −5°C, 240 KIAS, 55 t, level, gear up, flaps 0, two engines, CRZ, no wind, packs not high, bleed on, antiice off). Unsupported inputs throw errors instead of being silently clamped.

- ISA atmosphere estimates static pressure; actual OAT sets approximate air density. Approximate TAS = IAS / sqrt(density ratio); IAS treated as EAS, so compressibility/CAS corrections are not modeled.
- Wind: headwind = wind speed × cos(wind FROM − track); crosswind = wind speed × sin(same angle). Along-track GS = sqrt(TAS² − crosswind²) − headwind, assuming a track-holding crab angle. Wind changes GS, not steady N1 at fixed IAS, weight and flight path.
- Demand force = parasitic drag + induced drag + weight × vertical speed / TAS. The test drag polar uses assumed CD0=0.030, k=0.055, wing area 91.04 m², simplistic flap and gear factors.
- Available engine thrust reference = 20,000 lbf × (air density ratio)^0.72 per engine, then a deliberately estimated nonlinear thrust-to-N1 mapping.
- N1 required minimum for airborne RUNNING is 32% in this approximation. If N1 required exceeds selected reference limit, the result reports an insufficiency flag and caps N1 command; it does not falsely promise speed hold.
- Return a normalized throttle **recommendation** compatible with the current \`ISN Engine Start Dynamics V1\` ground/flight idle N1 curve. No state-changing start/throttle action is issued here.

Weather condition CLEAR/RAIN/SNOW/ICING is metadata, not a direct arbitrary numerical multiplier; anti-ice or configuration must actually be selected. Rain/snow ground performance, windshear/gust dynamics, Mach compression, aerodynamic stall and high-altitude engine performance require separate future physical models.

## Worked example (training only)

| At 10,000 ft, −5°C, 55 t, flaps 0, gear UP, two engines, level, CRZ | N1 required | TAS | Ground speed |
|---|---:|---:|---:|
| 200 KIAS, calm |58.3%|233 kt|233 kt|
| 240 KIAS, calm |58.1%|279 kt|279 kt|
| 280 KIAS, calm |60.0%|326 kt|326 kt|
| 240 KIAS, 30 kt direct headwind |58.1%|279 kt|249 kt|
| 240 KIAS, 30 kt direct tailwind |58.1%|279 kt|309 kt|
| 240 KIAS, 1,000 fpm climb |66.4%|279 kt|279 kt|

A change from 200 to 240 KIAS does not necessarily increase **steady level-flight** power in a quadratic parasite-plus-induced drag model: the induced-drag decrease can offset the parasite increase. Different airplane polar coefficients or weight change that result. Numbers are not AFM-derived or for real flight.

## Code/QA/interface

Implementation: \`engine/fmc/performance/isn-thrust-schedule-v1.cjs\`. Tests: \`tests/isn-thrust-schedule-v1.test.cjs\` (local Node assertions of wind invariance, temp/altitude, configuration, 1/2 engines, climb/descent, derate availability, cap, bad inputs).

\`const result = require('./engine/fmc/performance/isn-thrust-schedule-v1.cjs').compute({iasKt:240,pressureAltitudeFt:10000,oatC:-5,massKg:55000,mode:'CRZ'})\`

Returns \`quality: SIM_ESTIMATE_NOT_AFM\`, \`atmosphere\`, \`navigation\`, \`required\`, \`limits\`, \`command\`, \`flags\`, and normalized applied \`inputs\`.

**Integration next**: Add a single shared N1 schedule service. Reconcile current CDU v19 display surrogate (which uses different 92/94 starting TO/GA display values) with this user's revised ~97% train-only ceiling. Connect \`n1LimitPct\` to CDU reference pages and \`normalizedThrottle\` only to explicitly requested speed-hold training control; measured N1 should always override visual estimates, and manual throttle control must never be overwritten unintentionally.
