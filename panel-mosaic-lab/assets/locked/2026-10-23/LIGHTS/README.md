# B737 Classic — LIGHTS asset drop

This is the owner-designated upload folder for individual B737 Classic annunciator faces (2026-10-23).

## Filename contract

For each legend upload a matched pair named `<ID>_OFF.png` and `<ID>_ON.png` (or `.svg`), for example:

- `LOW_PRESSURE_OFF.png` / `LOW_PRESSURE_ON.png`
- `LOW_OIL_PRESSURE_OFF.png` / `LOW_OIL_PRESSURE_ON.png`
- `BUS_OFF_LAMP_OFF.png` / `BUS_OFF_LAMP_ON.png` (the legend itself is BUS / OFF)
- `NOT_ARMED_VERTICAL_OFF.png` / `NOT_ARMED_VERTICAL_ON.png`

The last `_ON` or `_OFF` is the illuminated **state**, even when the wording contains ON or OFF. Both files in a pair must have exactly identical face dimensions, geometry and dark background. Only the lettering changes color. Regular faceplates are 600 × 300 px; the special vertical NOT / ARMED faceplate is 300 × 600 px. In the unlit state, letters are extremely faint; lit lettering is amber. Do not change the approved font.

Other files and previously locked artwork must not be modified. New test assets may be appended here without changing the OH-01…OH-25 panel geometry or photographs.

## Visual QA

[Open the auto-discovery LIGHTS test page](../../../../lights-test/).

The separate test page discovers matching image pairs from this GitHub directory. Use **Sync** after uploading: it reports missing pairs and lets you switch every annunciator independently or all at once. It is an asset-level visual test; exact mounting positions and aircraft-system condition mappings require their own validated registry.
