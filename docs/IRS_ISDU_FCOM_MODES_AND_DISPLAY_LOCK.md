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

## Project-owner correction — HDG/STS alignment countdown: SEVEN-minute display cap (2026-10-28)

**SIMULATOR REQUIREMENT (explicit project-owner instruction):** When the selected **L or R** IRS is actively aligning and the ISDU display selector is at **HDG/STS**, the time remaining shown in the status field **must never show 8, 9, 10, or any greater minute number**. It holds **7** for all real remaining times above six minutes (including 17, 10, 9, 8, 7, and 6:59), then at **exactly 6:00 remaining** changes to **6**, followed by **5, 4, 3, 2, 1** at the whole-minute boundaries. The **0** is not a held countdown value.

For a positive valid remaining-time estimate in seconds:

```text
shownMinute = min(7, ceil(secondsRemaining / 60))
secondsRemaining <= 0 => no countdown
```

**FCOM SOURCE DIFFERENCE — DO NOT CONFLATE:** The archived 15 October 2020 Sepehran B737 Classic FCOM at **11.10.16** specifies a ceiling of **10** until 9 minutes remain. That source wording is preserved separately in the machine-readable contract. **The simulator intentionally implements the project owner's directly observed SEVEN-minute rule.** Do not silently revert the simulation to 10 by treating the older FCOM text as implementation precedence.

The display countdown is strictly gated by all of the following: HDG/STS selected, an explicitly selected L/R IRS actually in a valid ongoing `ALIGNING` or `HIGH_LAT_ALIGNING` phase, available IRS power and trustworthy positive remaining-time estimate. No countdown is produced for OFF/shutdown, completed NAV, ATT, missing power, unknown time, movement/invalid-position blocking, a fault, a temporary keypad-entry override, a display self-test, or unverified fast realignment. A lit ALIGN annunciator by itself does **not** prove valid ongoing alignment. Left/right counts must be independent.

**Implementation boundary:** `engine/contracts/irs-hdg-sts-seven-minute-v1.cjs` provides the pure formatter and `panel-mosaic-lab/cockpit/irs-hdg-sts-seven-minute-v1.test.cjs` tests it. This is **not yet connected to a real IRS backend**. The final owner-locked 13-character display (its exact art, light behavior, color, geometry, TEST and input control) and the locked lower SYS DSPL selector are completely unchanged; future integration must use a separate validated state adapter.
