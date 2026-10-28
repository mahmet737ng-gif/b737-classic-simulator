# 737 Classic annunciator bezel coverage — production default

**Release:** LGT-SOCKET-FIT-004 · 2026-10-28  
**Owner instruction:** Apply +2.5 source-image pixels beyond the original four registered `sourceRect` edges of every current annunciator mounting, and publish that setting permanently on Unified.

## Scope and invariants

- 142 source-photo mounting sockets: **112 overhead + 30 main instrument panel**.
- All four sides of each of the 142 socket rectangles use **exactly 2.5 original-photo pixels**, a total of 568 sides.
- **No movement of original socket centers:** `x'=x-2.5`, `y'=y-2.5`, `width'=width+5`, `height'=height+5`.
- All OFF / DIM / BRIGHT, including separate blue DIM/BRIGHT and global cabin DIM/BRIGHT appearance, use the same physical socket rectangle.
- Font, font size, lettering, color, source photographs, guarded switches, panel layout, flight-system logic and original locked lens assets are preserved.
- The live renderer extends the panel lens **around** the registered source rectangle and adapts the SVG casing ratio without distorting characters. Exact coordinates for all 142 are recorded in `geometry-142.json`.
- Original 11 independently extracted photographic Fire Protection indicator overlays are not within this 142-socket optical atlas and have not been modified.

## Activation

**Production default is ON**, without any query parameter:

- Unified: `/panel-mosaic-lab/cockpit/`
- Standalone overhead: `/panel-mosaic-lab/interactive-overhead/`
- Visual geometry QA: `/panel-mosaic-lab/lamp-socket-fit-lab/` — initial coverage slider reads 2.5.

The former opt-in `?socketFit=1` is no longer required. `?socketFit=0` is an emergency diagnostics rollback for the current page only; embedded overhead inherits its parent's rollback setting. `fitPad` cannot change production geometry.

## Verification

The `fit.test.cjs` QA and `.github/workflows/lamp-socket-fit-v3.yml` CI assert per-socket coverage, no source-photo rectangle overlap, complete source-to-master mapping, and intact font-bearing SVG assets. **This is a digital geometry QA, not a claim that all 568 photographed silver rim edges have been independently optically certified.**

Do not modify the locked guard red-zone, switch geometry, or original source photos to achieve a lamp fit.
