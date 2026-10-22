# B737 Classic — Concentric / Dual-Shaft Controls v1

**2026-10-22. Status: data model and pure state logic implemented and tested; photographed part geometry and real AFDS/IRS systems remain unimplemented.**

## Locked decision

A common physical assembly may contain multiple controls, including independent internal and external coaxial shafts. Each shaft has its own stable ID, mechanical model, hit region, accepted actions, and value. No generic click-over-the-whole-knob is valid. Foreground images are the **exact original user-supplied panel photos**; overlays must not replace or redraw base art.

## Two functional examples checked against FCOM

| Assembly | Inner shaft | Outer shaft | Source |
| --- | --- | --- | --- |
| IRS ISDU DSPL SEL / BRT | BRT — continuous display brightness | DSPL SEL — TEST (momentary), TK/GS, PPOS, WIND, HDG/STS | Sepehran FCOM 11.10.13–11.10.14 |
| MCP Heading / Bank Angle | Heading encoder — 000–359 (wraps) | Bank Angle limit — 10, 15, 20, 25, 30 degrees | Sepehran FCOM 4.10.13–4.10.15 |

**Terminology clarification:** The above IRS compound is the *ISDU display selector*, not the separate IRS mode selectors (OFF / ALIGN / NAV / ATT). The latter remain distinct rotary controls.

## Art coordinate / geometry QA

Native-pixel **candidate** pivots and ring radii are in `engine/atlas/compound-controls.v1.json`. Photos confirm visible concentric assemblies but do NOT establish exact 3D shaft detents, angles, stop forces, or alternate knob sprites. The numerical brightness range 0–1 is an abstract UI normalization, **not a hardware calibration**.

Caution: extracted 2026-10-22 atlas v0.4 used one registry entry per concentric physical location. It must retain its existing `existingAtlasId` as parent/compatibility alias, while issuing separately addressable IDs for each child. Do not count those logical shaft records as new unique positions on the original artwork.

## State mechanics / interaction

- Clicking or dragging *inside* the inner radius modifies only the inner control; acting on the outer annulus modifies only the outer control. Resolve hit region at pointer-down and retain pointer capture while dragging.
- Desktop, mobile and keyboard accessibility need independent discoverable controls for each shaft, since a narrow annulus can be hard to target on touch screens.
- IRS DSPL TEST automatically returns to TK/GS **on RELEASE** as documented. There is no such spring return on BANK, HEADING, or BRT.
- The heading value wraps between 359 and 000. Bank-angle selector has hard stops at 10 and 30 and discrete intermediate positions.
- Keep model state separate from physical animation and aircraft system effects. The demo changes state and inspector output only; it does not claim real instrument illumination, IRS computation or AFDS roll modeling.

## Files and tests

- `engine/atlas/compound-controls.v1.json` — two parent assemblies / four separately operable shafts.
- `engine/mechanics/compound-controls.js` — pure hit-test, reducer, validation, no browser dependency.
- `tests/compound-controls.test.cjs` — run with `node tests/compound-controls.test.cjs`.
- Local ZIP supplied to owner contains `demo/index.html`, the same two unmodified master PNGs, geometry overlay, mode controls and a small inspector. **Not deployed onto live website.**

## Open items

- Inspect the rest of the panel controls for more compound shafts. Examples may include *some* COM/NAV tuning assemblies, but no new pair should be classified without matching photo and FCOM variant.
- Hand-calibrate full clickable areas and extraction masks in the original source at native resolution; confirm physical knob rotation visually in at least two states.
- Connect ISDU output to actual 737CL sensor/IRS logic and MCP heading/bank constraints to true AFDS/flight dynamics.
- Add browser gesture and visual screenshot regression tests. Current Node assertions test geometry addressing and state isolation, **not pixel-perfect alignment**.