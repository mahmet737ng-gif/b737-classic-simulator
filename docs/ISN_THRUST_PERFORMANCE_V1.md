# ISN — weather/speed N1 demand and CDU N1 LIMIT contract V1

**Status:** BACKEND IMPLEMENTED, SIMULATION_APPROX_ONLY. These percentages are tunable numerical *training* parameters, NOT AFM/real-flight performance or real engine limitations. Frontend, panel art and CDU presentation are unchanged.

## Source-documented structure versus simulator numeric assumptions

The owner-provided Sepehran B737 Classic FCOM volume 2, §11.41.42–43 (PDF pages 1666–1667), describes AUTO, GA, CON, CLB, CRZ and reduced CLB-1 / CLB-2 N1 limit modes. The manual specifies CLB-1 = CLB minus **3 N1 percentage points** and CLB-2 = CLB minus **6 points** when installed, with deletion above 15,000 ft on applicable configurations; other configurations do not offer CLB-2. FCOM §11.42.39 (PDF page 1713) states CON N1 uses bleed conditions. Real N1 limits need actual aircraft/variant, thrust rating, air temperature, bleed/anti-ice and flight context. Illustrated FCOM N1 values do **not** establish fixed global percentage limits or a universal order between CON and CLB.

User-selected training reference limits at standard sea-level, **not FCOM values**:

| Mode | N1 reference cap | Notes |
|---|---:|---|
| TO | 97% | Full training takeoff N1 |
| GA | 97% | Full training go-around N1; not an assumption that GA/TO values always equal in reality |
| CON | 94% | Maximum continuous training cap |
| CLB | 91% | Climb training cap |
| CLB-1 | CLB − 3 pp | Reduced climb if installed |
| CLB-2 | CLB − 6 pp | Variant/option-conditional |
| CRZ | 86% | Cruise **ceiling**, not cruise required thrust |

The placeholder limit environmental adjustment is `0.08 N1 pp per 1000 ft positive pressure altitude + 0.025 N1 pp per degree above ISA`, subtracted from these reference caps, bounded at 97%. This arbitrary surrogate is isolated in `CONFIG` so an AFM-interpolated schedule can replace it later. Avoid equating a real temperature derate with a fixed N1 decrement.

## Physics-inspired demand, not an airframe-validated drag polar

Inputs: pressure altitude (ft), OAT (°C), IAS (kt), gross weight (kg), target IAS, acceleration seconds (required for a speed change), vertical speed (ft/min), true track, true wind-from direction/speed, engine count, configuration (packs/anti-ice), ground/flight status and thrust-limit mode. Inputs requiring weight **must not use a hidden default**.

Use ISA pressure and actual-temperature density; approximate IAS as equivalent airspeed; `TAS ≈ IAS/sqrt(sigma)`. Approximate drag as parasite + induced components:

`D = q S Cd0 + k W^2 / (q S), q = 0.5 rho0 IAS^2`.

Required aircraft force includes drag, climb `W * VS / TAS`, and acceleration `mass * (targetTAS-currentTAS)/seconds`. Split among operative engines, apply a configurable **training** thrust-to-N1 curve and fuel/bleed penalties. Three different outputs are needed for FMC/auto-throttle integration:

- `requiredN1NowPercent`: estimated N1 to perform the requested maneuver now.
- `requiredN1HoldTargetPercent`: estimated N1 once target IAS is reached, with zero acceleration.
- `selectedN1CommandPercent`: requested N1 clamped by chosen mode limit and the ground/flight idle floor; reports `thrustLimited` if the demand exceeds the cap.

Headwind/tailwind **does not change air-mass-relative thrust required** at identical IAS/altitude/OAT/weight/climb, but alters groundspeed/time/distance. For crosswind, compensate crab: `GS = sqrt(TAS² - crosswind²) - headwind`, when the desired ground track can be held. The speed and wind inputs use **true angles consistently**.

## Reproducible demonstration

Configuration: 10,000 ft pressure altitude; 55,000 kg; 240 KIAS; level; two running engines; PACKs ON; anti-ice OFF. Wind-aligned head/tail component 30 knots.

| OAT | TAS kt | Groundspeed with HW 30 kt | Calm GS | Tailwind 30 kt GS | Level N1 required | CRZ cap |
|---:|---:|---:|---:|---:|---:|---:|
| −15 °C | 273.93 | 243.93 | 273.93 | 303.93 | 69.20% | 85.20% |
| 0 °C | 281.77 | 251.77 | 281.77 | 311.77 | 69.83% | 85.08% |
| +20 °C | 291.91 | 261.91 | 291.91 | 321.91 | 70.64% | 84.58% |

At 10,000 ft / 0°C, same weight/configuration and zero VS:
- 200 KIAS steady ≈ 69.41% N1.
- 240 KIAS steady ≈ 69.83% N1.
- Accelerating 200 → 240 KIAS over 30 seconds, at initial speed ≈ 83.89% N1, before airspeed is dynamically updated.

The drag polar is U-shaped; a speed increase does *not* automatically imply proportionally more steady N1 near minimum drag. Acceleration requires extra thrust; that is the key distinction.

## Backend/ISN/CDU architecture

`engine/integration/isn-thrust-performance-v1.js` exports `ratings`, `wind`, `atmosphere`, `performance` and **opt-in** `applyToTrainingChain`.

It is a pure computation API that produces mode-specific N1 limits and demand plus provenance; it **does not** modify external sensors, set actual running state or silently start autothrottle. A future CDU N1 LIMIT page can consume `mode.limitTable` and display a selected mode, while engine indications remain produced by their existing sole state owner.

The optional `applyToTrainingChain(chain,engineId,input)` verifies: engine RUNNING, synthetic training source owner, on-ground state agreement and number of operating engines; only then applies `throttleDemand` through the existing `setThrottle` API. Calling it intentionally is required—nothing automatically maintains IAS until a flight-dynamics integrator and closed-loop speed controller are added.

Regression: `tests/isn-thrust-performance-v1.test.cjs`. Scope excludes engine installation-specific AFM curves, aircraft-certificated performance, actual aerodynamic coefficients, speeds/V-limits, and real-world flight use. Existing Overhead locked files remain unchanged.
