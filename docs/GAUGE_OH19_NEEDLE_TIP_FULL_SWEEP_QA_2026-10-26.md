# B737 Classic · OH19 physical pointer length — source-pixel clearance QA
**Date:** 2026-10-26 · **Airframe:** B737-33V EP-FSI · **Branch:** main

## Executed changes

The **original locked OH19 panel PNG and both approved SVG pointer path shapes remain unchanged**. Only how large the existing sprites are drawn at the native-image pivot changed:
- Rear **PRESS** / outer PSI: nominal scale parameter `tipRadius` **207 → 222.7** source-image px. Actual painted SVG tip (from source `M252 35` at 512×512, including 2.6 px stroke) reaches **225.065 px** from the common provisional pivot.
- Front **CAB ALT** / inner `x1000 FT`: `tipRadius` **123 → 114.3**. Actual painted SVG tip (source `M242 39` and 3.2 px stroke) reaches **113.807 px**. Its broad flat tip is not interpreted as the nominal 220px point.
- The cockpit manual preview slider now covers **0–360° clockwise**, rather than an incorrect ±166° limit which prevented native 322–327° positions from being visually checked.
- Unified resource versions increased to `CDN-0003`, preserving PRESS **behind** CAB ALT physically and preserving the outer PSI vs inner altitude printed scale mappings.

## Photo source and physical QA

The image and sprite geometry gate reads the **immutable, exact 1267×1241 PNG** with SHA-256 `4c667d96ea7652e52784f5c06ee3cdde0879ca37631abf19969861afecc45fed`. The new `engine/instruments/oh19-needle-tip-fit-v1.py` parses the **actual SVG path endpoints and stroke width**, reconstructs renderer scale, inspects source-image white-stroke starts along source-native radial rays and compares tip reach to the prior stroke-position ledger.

| QA measurement | PRESS / PSI outer | CAB ALT / 1000 FT inner |
|---|---:|---:|
| Indexed tick candidates | 51 | 47 |
| Native-source RGB stroke start rediscovered | 44 | 47 |
| Tip-to-inner tick min gap after correction | **0.935 px** | **1.193 px** |
| Tip-to-inner tick max gap after correction | **5.935 px** | **14.193 px** |
| Tip overlaps with candidate scale strokes after correction | **0** | **0** |
| Prior nominal painted tip reached | 209.198 px | 122.470 px |
| New painted tip reaches | 225.065 px | 113.807 px |

**Physical limitation:** The inner radial ends vary from 115px to 128px across the photographed dial. A single *rigid* pointer cannot be simultaneously exactly tangent to all 47 unequal inner endpoints. The present fit prioritizes no intersection at any angle and documents a remaining maximum 14.193px gap on the longest-radius inner strokes. We must not silently warp the immutable needle or introduce angle-dependent length to force every contact. The seven outer strokes not automatically rediscovered at this white-threshold setting remain source candidates, not individually re-certified photo lines.

## Verified CI execution
GitHub Actions [OH19 Cabin Altitude Photo Anchors run 40241476659](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40241476659) **passed** the original-image hash, locked-overhead check, pointer/pressurization QA, radial tip geometry assertions and the three full-graphic replay snapshots (`ZERO_END`, `MIDDLE_ARCS`, `FULL_SWEEP`). All tests passed. Original camera art and owner SVG source are still unchanged.

[CI-produced original-photo PNG/SVG visual QA and JSON numerical report](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40241476659/artifacts/12616524620)

## Restricted release
- New scaling is installed in the Unified OH19 **visual preview** and available via the QA controls. No claim of cockpit flight validation or completed equipment electrical approval.
- **0/54** fully mechanically certified faces, **0** operationally released needles remain the full-project acceptance status.
- The optical pivot remains provisional pending hidden physical spindle verification.
- Values for **32 inner CAB ALT tick positions** remain explicitly unknown, not interpolated to certified values.
- Ground cabin altitude remains input from the selected CPCS/DCPCS plant, with OIAW 66 ft, OIII 3963 ft, and OIMM 3260 ft preserved.

## Next engineering gate
Visually verify tip clearances on the full original photo at all 98 indexed angles and then close the 32 missing tick-value identifications without extrapolating unknown printed values. When actual shaft and the source-to-sprite offset are proven, lock exact shape/length and enable photo-certified per-gauge motion after electrical feed QA.
