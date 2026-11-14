# B737 Classic — Switches asset library

Central asset folder for the `2026-10-23` locked cockpit panel set.

- **Toggle/**: global white-handle vertical ON/OFF/CENTER sprites and standard definition.
- **Toggle/Horizontal/**: NAV TRANSFER LEFT/CENTER/RIGHT lever assets.
- **Rotary/**: approved reusable rotary knob and front-facing **Cross Feed** knob (transparent PNG).
- **Guarded/**: red/black guards, all positions, references and manifests.
- **Fire_Handles/**: ENG1, APU, ENG2, illuminated/unilluminated and left/right 45° states.

The 48 binary and supporting files were imported without modifying their original image pixels. The single newly added Cross Feed knob is front-facing.

**Compatibility:** Existing deployed asset paths remain present so switch-lab, panel-mosaic-lab, fuel-panel, and flight-controls-panel continue to work. The new `catalog.json` provides a central inventory for new integrations. Once all consumers have been migrated and tested, legacy duplicates can be retired in a separate reviewed change.

See `catalog.json` for each canonical path, original source and Git blob SHA.
