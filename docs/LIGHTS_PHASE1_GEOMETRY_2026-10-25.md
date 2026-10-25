# B737 Classic — LIGHTS Phase 1 geometry and rendering QA (2026-10-25)

## Scope and truth status

- Audited `112` mounted overhead lamps, `30` mounted main-panel lamps, and `94` unique catalogue designs.
- There are `142` mounted instances using `86` unique assets. The remaining `8` catalogue assets have **no approved placement** in the inspected overhead/main registries.
- Recorded **source-image ROI**, source centroid, source image dimensions, computed **native atlas/display ROI**, final board centroid, intrinsic SVG face dimensions, mismatch severity and predicted letterbox insets for every mounted instance.
- Source `sourceRect` coordinates and all OH-01..OH-25 frozen mosaic files are unchanged. This is a geometric software audit, **not** a pixel-verified photographic approval.
- Machine check found `0` overlaps between rectangular ROIs within the same source panel. This **does not imply** that ROI corners have been visually aligned to the original photographs.

## Diagnostic totals

| | Overhead | Main |
| --- | ---: | ---: |
| Mounted instances | 112 | 30 |
| >10% native-face-to-aperture shape mismatch | 93 | 22 |
| >25% mismatch | 45 | 3 |
| >50% mismatch | 9 | 0 |

The mismatch figure is an intrinsic **SVG face aspect ratio vs measured socket ratio** comparison. It is not a direct measurement of pixel-centre offset. Do not claim that 93 lamps are at the wrong position.

Notable geometry-risk cases: `probe-capt-ps`, `probe-l-elev`, `probe-l-alpha`, `probe-temp`, `probe-fo-ps`, `probe-r-elev`, `probe-r-alpha`, `yaw-damper`, `flight-recorder-off`, `ram-door-r`; and the main-panel square `STAB OUT OF TRIM` face inside an approximately 1.49:1 socket.

## Implemented

1. **Inventory and calibration evidence:** `panel-mosaic-lab/lights-test/phase1-geometry-audit.json` stores an individually addressable row for each of the 142 mounted units and records eight asset-only units separately.
2. **Lens preservation:** `.light-face` and `.cockpit-light img` use `object-fit:contain` + centred positioning. This prevents nonuniform letter stretching; the physical socket rectangle remains intact. Do **not** use `cover` or arbitrary `scale` to hide mismatches. The prior low-pressure/probe zoom exceptions were retired.
3. **Registration tools:** Open each page with `?debugLights=1`; overlay boundaries and centre dots become visible and the hover title contains the source rectangle. Geometry debug has no influence in the default view.
4. **Repeatable tests:** `node panel-mosaic-lab/lights-test/phase1-geometry-audit.test.cjs` asserts all 142 source/board coordinates, lens aspect insets, unique IDs, inventory sizes and absence of nonuniform image fitting. The test is now a mandatory GitHub Pages workflow check.
5. Existing asset hashes, original socket rectangles, layout versions and the immutable overhead guard have not been changed.

## Pending photographic acceptance

The source panel photos are binary reference images. Current programmatic checks cannot inspect their individual socket boundaries visually in the connected GitHub text API; **no new centre coordinates were invented**.

For each row with `visualReview:PENDING_OWNER_PHOTO_MATCH`, compare the displayed crosshairs to the true visible lens glass on the approved photograph at 100%-200%:
- outline must sit inside the aperture with no panel texture hidden;
- the centre dot must hit the aperture centre;
- red, green and white text must not be compressed or stretch;
- sides previously filled by stretching will now display as dark letterbox margins until the face is **reflowed for that socket** in a later artwork correction;
- switching 737-300/500 vs -400 and CPCS vs DCPCS requires independent screenshot QA before declaring registration accepted.

Do not automatically update `sourceRect` based on aspect ratio mismatch alone. Pixel-level centre correction is a separate photo-backed approval.

## URLs

- Overhead registration: https://mahmet737ng-gif.github.io/b737-classic-simulator/panel-mosaic-lab/interactive-overhead/?debugLights=1
- Unified cockpit registration: https://mahmet737ng-gif.github.io/b737-classic-simulator/panel-mosaic-lab/cockpit/?debugLights=1

## Release gate

- `node panel-mosaic-lab/interactive-overhead/lights.test.cjs`
- `node panel-mosaic-lab/cockpit/lights.test.cjs`
- `node panel-mosaic-lab/lights-test/phase1-geometry-audit.test.cjs`
- `python3 panel-mosaic-lab/verify-final-overhead.py`

The original immutable mosaic must remain byte-identical. Passes on static checks are **not** a substitute for on-screen photographic QA.
