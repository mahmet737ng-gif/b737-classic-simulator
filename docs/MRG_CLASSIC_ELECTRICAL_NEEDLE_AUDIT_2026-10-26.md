# B737 Classic — MRG Electrical numeric/needle audit, 26 Oct 2026

**Effectivity:** Classic (CL) only, on user-supplied screenshots of B737 MRG High Quality Chapter IV.6, PRINTED pp.142–161, original PDF indices 151–170. The screenshots are *spreads*: any adjacent NG column or (NG)-marked paragraph is excluded. This is a simulator data-validation record; do not use for flight.

**Scope:** Numeric electrical-meter signal and fault/state audit across OH10 (DC amps, DC volts, AC volts, CPS), OH11 (GEN DRIVE OIL TEMPERATURE 1/2) and OH12 (AC AMPS 1/2 and APU). Geometry (pivot, zero angle, full major/minor ticks) is **not** calibrated by an MRG electrical text table; original photo art and 54-gauge physical angle maps remain untouched.

## Source-derived numeric facts

| Printed p. | Classic source observation | Expected logic and scope | Risk/gate |
| --- | --- | --- | --- |
| 142–143 | CSD LOW OIL PRESSURE <120 psi, HIGH OIL TEMP >157 °C / 315 °F; constant drive speed 6,000 RPM; DRIVE high-pressure indications with drive disconnect | DriveOil 1/2 **measured temp** drives their respective needles; pressure drives *annunciator*, not temperature needle. Do **not** copy NG IDG thresholds 165 psi, 182 °C or 24,000 RPM | Inlet/rise scale printed in °F; confirm which of oil inlet / oil rise instrument faces are represented |
| 148 | TR1/TR2 DC Volts 24–30 V and DC Amps 20–25 A; TR3 24–30 V, 10–15 A; Battery 22–30 V, 0 A; as installed Aux Battery 22–30 V, 0 A; BAT BUS and STBY PWR 24–30 V, current *not indicated* | Inspector references are **normal observed ranges**, not exact synthetic needle values. The voltage is the respective DC bus voltage, **not the raw TR output** | If no observed voltage/current is supplied, report NO OBSERVATION, never force needle to 27 V |
| 148 | With BATTERY OFF + EXT AC (CL), engine-generator-fed AC remains with battery OFF, but external AC is disconnected; APU on ground auto-shuts due loss of protection | Source-dependent meter behavior; do not globally set all AC meter needles to zero merely because BAT is OFF | APU engine plant shutdown command must be separately wired and validated |
| 149 | External DC supply in E&E parallels battery; external DC is **not** battery charger; ground service bus feeds charger, cooling, cabin services | Future source/lamp meter dependencies, not new physical CB wire | Installed options depend on model/effectivity |
| 151–152 | Classic bus transfer and visible electrical schematic: opposite generator backs up TRANSFER BUS; TR2/TR3 can feed DC BUS1 when TR1 fails; TR3 disconnect relay opens on G/S capture or BUS TRANS OFF | A failed TR1 can show **DC volts in range** while TR1 amps falls to 0, because selected voltage is DC BUS1; a disconnection of the backup path must be resolved separately | V7 source graph is *discrete educational*, not meter-sensor telemetry |
| 143, 149 | AC residual voltage inner scale while associated generator disconnected; e.g., 12–15 VAC in flight can indicate GCR tripped while rotating | Must use observed residual AC measurement to move AC voltmeter; never interpret DC amps as residual AC current | DO NOT disconnect CSD for a meter test |
| 146 | Failure of AC/DC buses can give fuel pump LOW PRESS annunciations, but low pressure of *motor* and *control feed* are distinct possible causes | Indicator logic should distinguish pump power from control/annunciator power; not enough evidence to map each light wiring directly | Pending installed aircraft circuit analysis |
| 144–145,154 | Bus partial-failure, 2-phase generator: some heavy consumers may trip with bus still energized | Voltage cannot alone prove every 3-phase motor powered. Avoid forcing all needles/loads off or on from one lamp | Phase-by-phase source physics not present in V7 |
| 159 | For Classic, STANDBY PWR OFF amber primarily signals standby **AC** missing; standby DC may or may not remain powered; false warning possible when standby bus still powers equipment | Distinguish AC standby lamp from DC standby measurement. False warning is an annunciator circuit fault, not a direct needle voltage fall | Need actual voltage measurement for DC standby |
| 161–162 | TR indications distinguish failed TR vs unpowered DC BUS; tie relay opens on G/S capture | AC/DC meter selector must use bus-status and TR-source independent semantics | Full pixel native calibration still unresolved |
| 150 | In image of Classic electrical overhead, AC CPS ~400 Hz and voltage 115 VAC shown; p152 nominal 115 VAC bus | Nominal contextual values ONLY, not an exact measured tolerance band, and not an angle conversion | Need instrument scale tick/arc data |

## Known needle geometry blockers

From \`engine/instruments/needle-zero-reference-stage1-v1.json\`:

- OH10 DC AMPS: overlay center (310,168), photo candidate (310,192); 24 px vertical conflict.
- OH10 CPS: overlay center (715,190), photo candidate (780,192); 65 px horizontal conflict.
- OH10 DC VOLTS/AC VOLTS complete tick and zero-angle QA still outstanding.
- OH11 Drive Oil Temp pair and OH12 AC Amps pair/APU require independent full-scale native-pixel ticks and endpoint fitting.
- 54-face registry explicitly reports **0 fully certified full-scale gauge faces**. New MRG numeric windows do NOT resolve those conflicts.

## New audited implementation

- \`engine/instruments/mrg-electrical-needle-audit-v1.js\`: numeric source monitor with observation-required, read-only ranges; preserves UNKNOWN and zero-amp TR with voltage present.
- \`panel-mosaic-lab/cockpit/mrg-electrical-needle-qa-unified.js\`: optional Unified *inspector* QA with manually entered meter observations and an isolated TR1 failure demonstration; **does not modify the live needle angles or original panel images**.
- \`tests/mrg-electrical-needle-audit-v1.test.cjs\`: 18 MRG source/fault/standby/geometry/battery-switch regression tests.
- To test: \`npm run test:mrg-needle\`. Labels \`WITHIN_MRG_REFERENCE\` and \`OUTSIDE_MRG_REFERENCE\` are QA bands, **not calibrated glass pointer angles**.

The rule for promotion remains: confirm 54 native image pivots and every printed major/minor tick independently; use actual observed system quantity plus sensor power routing; only then unlock a value→angle calibration for the corresponding needle. Source ranges never determine 0°.


## V7 correction after audit

Classic MRG printed p.148 specifically states BAT OFF with the APU generator supplying system buses **on ground** causes APU automatic shutdown / AC power loss; in flight APU continues to supply. `engine/systems/electrical-v7.js` now gates the affected APU generator output on ground and emits `apuAutomaticShutdownRequested`, leaving the separate APU plant physical spool/stop integration pending. Tests protect both ground and flight branches and ensure BAT OFF does not turn off engine-driven generator AC. The MRG regression suite now comprises **18 tests**, with **47 legacy Electrical V7 tests** passing in the same compatible JavaScript test harness.
