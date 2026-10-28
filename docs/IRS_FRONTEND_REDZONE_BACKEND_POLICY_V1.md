# IRS — FRONT-END-ONLY RED ZONE, BACKEND FREE TO EVOLVE (OWNER POLICY)

**Owner clarification 2026-10-28.** This policy corrects any earlier interpretation that the IRS switches, keys, lamps or modes are functionally frozen. **Only the approved physical appearance, panel graphics and geometry are in the RED ZONE.** The owner explicitly authorizes ongoing inspection, refactoring and modification of *backend behavior*, including switch and key actions and the computed states that illuminate the already-approved lamps/display. No per-change visual-asset approval is needed for a behavior-only change.

## Visual / physical contract — never change unless specifically requested and separately approved

- IRS bare panel photographic/background artwork, color, texture, printed labels and all decorations.
- Exact position, width, height, angle, top-view perspective, orientation, mounting and hitbox alignment of switches, rotary knobs, keypad, lamps and the display.
- Knob/rotary/key/guard sprites and the visual form, size, fonts, colors and lighting style of physical annunciators and 13-segment display.
- Existing committed owner RED ZONE inventory of 93 Git blobs and its fail-closed integrity checks stay valid **without modifying their bytes**.
- **User interaction is not prohibited** by a visual asset lock: knob rotation across existing physical detents, button press, lamp on/off and display character updates are operating states, not visual redesigns.

## Functional/software contract — NOT locked; backend changes explicitly allowed

- OFF / ALIGN / NAV / ATT state transitions, interlocks, selected mode meaning and timing.
- The logical effect of every IRS switch, pushbutton, rotary detent, keypad digit, ENT/CLR, DSPL SEL and SYS DSPL selection.
- IRS L/R independent power, electrical bus/CB gating, 3.5-second initial ON DC test, 10/17-minute alignment logic, backup-power logic, fast realignment, drift, failures and QRH procedures.
- Conditions under which the existing ON DC, ALIGN, FAULT and DC FAIL lamp assets are driven (including flashing/brightness states within existing visual style).
- 13-cell display *content* (digits, valid position, track/GS, countdown), data validity and CDU/FMC/other backend inputs and outputs.
- Tests, mappings and logic modules in `engine/` and `tests/` may be modified freely during approved backend development. They must not attempt to modify protected visual geometry/assets as a side effect.

## Important technical constraint: the old live file mixes two concerns

`panel-mosaic-lab/cockpit/irs-trainer-unified-v1.js` contains **both** presentation code and some event-handling/power/keypad behavior. Its **whole file** is currently pinned in the 93-blob owner lock. Therefore the implementation must not edit this file casually just because the behavior is editable in principle.

For future behavior changes, use and test independent backend behavior modules and a stable adapter/event/data boundary. Leave the locked renderer/mount geometry unchanged. A behavior-only extension may be integrated through an unprotected hook/loader or by an explicitly authorized scoped extraction that **preserves all physical pixel/geometry invariants**; until such a route is implemented, do not claim the new backend's runtime behavior or lamp outputs are already connected to the existing Unified physical controls.

The two separate questions are:
1. **May the switch do something different? YES** — freely update its backend logic and tests.
2. **May its physical image, hitbox, placement or visual artwork change? NO** — requires an explicit separate owner request/confirmation.

A backend change's QA passes only if the functional tests pass **and** the 93-file visual RED ZONE check remains green. Visual preservation does NOT mean freezing functional behavior or preventing live switch positions/annunciation updates.

**Scope:** Boeing 737 Classic IRS procedure/QRH trainer; simulation only, not for operational flight use.
