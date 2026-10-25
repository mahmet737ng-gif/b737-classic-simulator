# OH19 — Cabin Pressure / Cabin Altitude needle stack correction
**Date:** 2026-10-26 · **737-33V EP-FSI** · **Scope:** Unified OH19 drawing order only.

## Owner-confirmed visible stack
- **PRESS / cabin differential pressure** = **rear, physically underneath**; model `layer:0`.
- **CAB ALT / cabin altitude** = **front, physically above**; model `layer:1`.
- SVG source drawing order is now explicitly sorted by `needle.layer` instead of relying on the previous `CAB ALT then PRESS` asset order.
- This stack ordering is **not the same concept as the printed radial tick rings**: the original immutable photographed OH19 face labels outer ring `DIFF PRESS PSI`, and inner ring `x1000 FT` (cabin altitude). The ring-to-sensor binding is deliberately not reversed.
- Physical tip-radius candidates remain `press:207`, `cabAlt:123` source-image pixels, **not physically approved**. Original needle SVG geometry and original OH19 panel background are untouched.
- `panel-mosaic-lab/cockpit/index.html` now loads both scripts with `CDN-0002` cache token.

## Regression
The previous test hardcoded `['cabAlt','press']` and treated that order as correct. This has been replaced by checks of rear/front stack, preserved inner/outer scale labels, 47+51 native tick candidates, and stable independent physical data bindings. GitHub Actions run: https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40240566348 — **success**.

## Next priority
Perform **source-pixel pointer tip fit** at original image scale, comparing both currently mounted SVG tips against real photographed scale tick interiors for the complete sweep, and verify geometry before any tip-length change. Existing geometry gives an advance warning: the PRESS needle nominal radius 207 source pixels while photographed outer strokes have approximate inner radius 226–231; ALT nominal tip radius 123 with inner photographed strokes near 115–128. These are *candidate* figures, not a mechanical flightworthy calibration. Do not simply swap SVG lengths: it would place both needles against the wrong printed scale. Once sprite fit is photo-confirmed, independently resolve the 32 unknown inner CAB ALT numeric minor-mark assignments. Both CPCS and DCPCS physical altitude signals remain independent of drawing layer.
