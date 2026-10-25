# B737 Classic Unified — Cold & Dark instrument defaults and photo-zero QA
Revision: 2026-10-25

**Coverage:** 53 initial instrument faces plus the separately installed crew oxygen gauge = **54 tracked indicating faces**. The approved original cockpit photos, frozen overhead geometry, and owner-approved pointer SVG sprites remain unchanged. No face has passed *all minor-tick positions to source-pixels* final numerical certification yet.

## Physical state is not needle zero

| Instrument family | Correct physics in Cold & Dark | Display strategy |
| --- | --- | --- |
| N1/N2 | Zero after the rotating engines stop | N2 starts at physical zero; actual tick angles not yet final |
| Engine fuel flow / vibration | Zero when fuel cut/rotors stopped | Numeric zero only, not guessed visual position |
| Engine / APU EGT, oil/fuel/cabin temperature | Actual retained temperature or cooling to ambient | Don't fabricate 0 Celsius |
| Engine oil pressure | Zero after residual pressure dissipates | Conditional numeric zero |
| GEN DRIVE OIL TEMP | IN measures inlet oil temperature, RISE measures difference | Two independently registered modes, never a universal zero |
| AC/DC metering | Depends on bus supply/selector/mechanical stop | Per-gauge tentative resting pose; unknown power signals flagged |
| Crew oxygen | Bottle PSI remains with electricity off | Retain real PSI when available, reference 1200 is visual training only |
| Cabin differential pressure | Zero when cabin/outside equalize | Numeric zero; requires verified photo scale for exact tip |
| Cabin altitude | Airport/ambient pressure altitude, not always zero | Actual static condition, don't force 0 ft |
| Cabin climb / VSI | Zero rate at stable pressure | Left-side zero on cabin climb; relevant mechanical 0 on VSI |
| L/R duct pressure | Zero only after duct fully depressurized | Reset both to 0 when condition true |
| Airspeed | Actual 0 kt while parked; printed current scale starts 60 kt | Low mechanical peg at printed 60, NOT imaginary zero at noon |
| Altimeter | QNH on ground generally field elevation | Do not force 0 ft |
| Fuel quantity | Retained physical tank quantity | Never discard when buses off |
| Hyd brake accumulator | May retain pressure with pumps off | No artificial zero |
| Flaps/stabilizer/rudder trims | Last mechanical positions persist | Do not force UP/0 unless physically there |
| Clocks/RMI | Actual time/retained heading/receiver validity | Never force midnight or heading 0 |

Boeing B737 Classic FCOM Electrical identifies generator oil IN vs RISE scales. FAA Instrument Procedures Handbook Ch2 defines QNH field elevation indication. The airspeed low-peg behavior follows the actual supplied photographic scale rather than inventing a printed 0.

## Native original-image visual review

20 mounted/known pivots were checked through read-only original PNG crops. Printed photographs and frozen panel geometry are unchanged.

- OH09 Fuel Temperature: actual white major tick scan reveals 9 provisional bearings in source pixel coordinates, respectively for -40/-30/-20/-10/0/+10/+20/+30/+40 Celsius: -92, -69, -47.5, -24.5, +0.5, +24, +47, +69, +91 degrees. The old uniform -70 to +70 mapping was not aligned with original marks. Now the angle is piecewise-interpolated across the nine source-derived provisional anchors for every integer and fractional temperature. All minor tick positions still await source QA.
- OH10 DC AMPS printed zero is at 12 o'clock, CPS zero on left and AC/DC voltage have separate scales and mechanical rests.
- OH19 cabin climb zero is to the left (9 o'clock), not up at noon. Cabin altitude and differential pressure use separate pointers and numeric states.
- OH11/12 GEN DRIVE OIL TEMP and A.C. AMPS: directly compared old vs too-long vs too-short pointer rays on original immutable PNGs. 128/135 source-pixel radii were too long; 64px too short. Retained near-original 98px oil, 102px generator AC amps and 124px APU AC amps; corrected A.C. AMPS 2 native pivot from x698 to x705. These are visual-zero **candidates**, not certification of complete sweep.
- Captain/F/O RMI needle sprites stay owner-locked with previously accepted fit tests. No blanket size edit.

## Installed implementation and QA

Cold-dark physical policy covers all 54 faces. An independent resolver checks source inputs and returns physical value, missing-sensor, retained-state, selector-mode or unpowered status. Unified automatically applies only known safe initial visual states using existing public interfaces (cabin climb zero, duct zero once pressure exhausted, airspeed low peg, etc.) and exposes a QA summary. ISM start indications override fallback N2 0; unprovided EGT stays unavailable.

Source files:
- engine/instruments/cold-dark-indicator-policy-v1.json
- engine/instruments/cold-dark-indicator-v1.js and .test.cjs
- panel-mosaic-lab/cockpit/cold-dark-indicators-unified.js
- engine/instruments/cold-dark-needle-fit-audit-v1.json
- tools/gauge-source-visual-review.py
- tools/fuel-temperature-tick-scan.py
- panel-mosaic-lab/cockpit/fuel-temperature-needle-model.js
- .github/workflows/gauge-stage-2-4.yml
- .github/workflows/gauge-source-visual-qa.yml

## Outstanding approval blockers

**54/54 physical baseline categories exist, but 0/54 have a final all-ticks native-photo angle map.** Several main-panel needles are still missing entirely; 34 faces lack approved pivot measurements. Even for installed faces, identifying the exact inner endpoint of every minor mark, scale mode, signal wiring and power-off park behavior remains necessary. Do not enable realReadingsEnabled for unverified faces or claim all needles hit all ticks from mathematical tests alone.
