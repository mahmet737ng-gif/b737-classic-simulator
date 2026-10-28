# IRS ISDU display selector — FCOM mode specification

**Source:** Boeing 737 Classic (300/400/500), Sepehran Airlines FCOM, D6-27370-300/400/500-SHI, 15 October 2020, **11.10.15–11.10.17**. For alignment state and valid solution prerequisites: **11.20.7–11.20.9**.

**Status:** reference / interface contract, **NOT** an implemented IRS navigation engine.

## The five outer selector modes, clockwise

| Mode | First FCOM field | Second FCOM field | Behavior |
| --- | --- | --- | --- |
| TEST | All-segment and light test | Self-test indication | Momentary test; lasts 10 s after lamps momentarily illuminate; spring-loaded back to TK/GS; use only during ALIGN |
| TK/GS | **True track** in degrees true | **Ground speed** in knots | Track over ground, not aircraft true heading |
| PPOS | **Present latitude** | **Present longitude** | Valid only with usable present-position data |
| WIND | **In-flight true wind direction** in degrees true | **In-flight wind speed** in knots | Do not invent wind values on the ground or without a solution |
| HDG/STS | **True heading** in degrees true | **Maintenance codes** or **alignment time remaining** | During alignment bottom field shows 10 until remaining time reaches 9, then decrements each minute |

### Physical display and owner approval

The user approved and locked the **13 illuminated filament/segment positions, one row, left 6 and right 7, four upper points and two lower decimal points**. The FCOM describes the two logical fields as *top* and *bottom*. A physical-model/display-effectivity difference exists: **do not redraw or rearrange the owner-locked visual display** to match the FCOM's description of lines. The simulator's existing one-row field presentation remains fixed. The final character of each logical window is a **tenths/decimal position**.

### Shared controls and input precedence

- **SYS DSPL L/R** selects the LEFT or RIGHT IRS for all display functions, independent of the five modes. This lower selector has its own separate owner hard lock.
- **BRT** adjusts the data-display brightness (not an arbitrary system or cockpit light without separate documentation).
- Manual keyboard entry of present position or magnetic heading **overrides** the chosen display temporarily.
- **N, S, E, W** arm a latitude/longitude entry; the **ENT** white cue indicates compass-letter entry, and **CLR** white cue indicates failed ENT. Numerics allow latitude/longitude entry while ALIGN is illuminated or magnetic heading in ATT.
- **ENT** attempts a reasonableness-checked entry to the selected IRS. **CLR** clears pending/unaccepted data and extinguishes cue lights, if illuminated.

### Integration contract (future backend)

Approved front-end geometry and artwork are IMMUTABLE. Backend adapters must be additive, consume available IRS and electrical states, and expose fields with quality/validity flags. **Never use demonstration digits as actual navigation values.** Unknown or unavailable IRS data remain blank/invalid until source states permit their display. No automatic backend edits to the 13-segment sprite, intensity curves, point positions, count, size, color, animations or mounting slots.

Machine-readable mode schema: `engine/contracts/irs-isdu-fcom-modes-v1.json`. Owner freeze: `panel-mosaic-lab/cockpit/irs-13seg-owner-lock-v1.json`; compliance check: `panel-mosaic-lab/cockpit/verify-irs-13seg-owner-lock-v1.py`.
