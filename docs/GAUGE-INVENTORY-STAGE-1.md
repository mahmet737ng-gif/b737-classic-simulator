# Gauge program — Stage 1: complete visual inventory

Scope: the frozen Overhead atlas plus every active source-panel placement in `panel-mosaic-lab/cockpit/assembly.json`. This is a complete **visual-source inventory for the current Unified assembly**, not a claim that every aircraft instrument has been calibrated, modeled, or powered. The background photographs and unused archive assets are not counted again as installed gauges.

Machine-readable source of truth: `engine/instruments/gauge-inventory-v1.json`. Each face has a stable ID, region, panel/source image, number of visible scales, expected/known needle count where defensible, and the currently mounted needle-overlay IDs. `null` means not yet confirmed; it is not zero.

| Region | Confirmed indicating faces | Unresolved candidate faces | Existing mounted needle overlays |
| --- | ---: | ---: | ---: |
| Overhead | 15 | 3 | 17 |
| Main instrument panel | 35 | 0 | 6 |
| Pedestal | 3 | 0 | 0 |
| **Total** | **53** | **3** | **23** |

## Face-by-face groups

| Source panel | Identified faces | Face count | Existing overlays / issue |
| --- | --- | ---: | --- |
| OH09 | Fuel temperature | 1 | `fuelTemperature` |
| OH10 | DC amps, CPS, DC volts, AC volts | 4 | Four mounted needles; printed endpoints still require measurement |
| OH11 | Generator-drive oil 1 and 2 | 2 | Two mounted needles; each face has distinct RISE and IN scales |
| OH12 | AC amps 1, 2 and APU; APU EGT | 4 | Four mounted needles |
| OH19-DIFF | Differential pressure/cabin altitude dual face; cabin rate | 2 | Three mounted needles across two faces |
| OH20 | Cabin temperature | 1 | One mounted needle |
| OH21 | L/R duct pressure on one shared scale | 1 | Two mounted needles |
| CAPTAIN | Airspeed, RMI, altimeter, combined ALT/IAS face, vertical speed, clock | 6 | No calibrated overlay; pointer count/identity unresolved on some faces |
| ENGINE | Upper-left 20/20 face, fuel quantity center/1/2, N1 1/2, EGT 1/2, N2 1/2, fuel flow 1/2, oil pressure 1/2, oil temperature 1/2, vibration 1/2, hydraulic pressure A/B | 20 | EGT and N2 have four temporary overlays; the upper-left face and fuel pointers need identification |
| FO-INNER | Flap dual-pointer face, hydraulic brake pressure, airspeed, RMI, LEFT/RIGHT linear windows | 6 | Two flap needles mounted |
| FO-OUTER | Altimeter, vertical speed, clock | 3 | No mounted needles |
| THROTTLE | Left/right STAB TRIM linear position windows | 2 | Mechanism pending; flap and speed-brake *lever detents* are not gauge needles |
| RADIO | Rudder-trim LEFT/RIGHT linear position strip | 1 | Mechanism pending |

Three possible additional indicating faces need an approved reference before inclusion as active gauges: the voice-recorder test meter (`OH19-VOICE`) and two AIR MIX VALVE position arcs (`OH20`). This is separate from static CAB/FLT reference numbers on `OH22`, flap/speed-brake detents, and MCP rotary-selector legends, which are deliberately not counted as needle gauges.

Stage 1 is **inventory only**. No min/max, tick position, mapping curve, sensor binding, failure flag, or power behavior is approved by this file. Stage 2 is the native-pixel survey of each face: pivot, every labeled number and minor/major tick, true endpoints, units, and source/page/effectivity. The temporary overlays must not be interpreted as confirmed aircraft readings.
