# B737 Classic — Permanent Panel Mosaic Lab

**Test page:** https://mahmet737ng-gif.github.io/b737-classic-simulator/panel-mosaic-lab/

## Scope

The owner-provided one-page cockpit PDF visually contains three assemblies: complete Overhead, Main Instrument Panel, and Throttle / Center Pedestal. Initial coordinates are mapped to the repository's existing photographic panel sources and are **provisional**, not Boeing-verified dimensional definitions.

| Assembly | ID range | Regions |
| --- | --- | ---: |
| Overhead | OH-01 through OH-25 | 25 |
| Main Instrument Panel | MP-01 through MP-13 | 13 |
| Throttle & Center Pedestal | PD-01 through PD-21 | 21 |
| **Total** | | **59** |

Regions include FUEL, HYDRAULICS, ANTI-ICE, WINDOW HEAT, ELECTRICAL, BLEED AIR, AIR CONDITIONING/PACKS, CABIN PRESSURIZATION, FLT CONTROLS, IRS, MCP, EADI/EHSI, CDU, throttle and radio units.

## Update each piece without changing the test URL

1. In `registry.json`, find the stable part ID (for example `OH-09` = FUEL).
2. Reconstruct and check the corresponding background **without switch levers, moving needles or active annunciation baked in**. Static lettering and borders must be readable at high zoom. Do not create imaginary controls.
3. Save that independent artwork under `panel-mosaic-lab/tiles/<ID>.webp` or a suitable lossless/vector equivalent; reference its **relative path** under the `artwork` key for that piece.
4. Set `status` to `artwork` when art exists, `review` when awaiting owner QA, `approved` after explicit approval, and `locked` only after the owner locks it.
5. Increment the `version` in `registry.json`. The existing GitHub Pages pipeline deploys changes on every successful push to `main`; the test viewer also checks for registry changes every 90 seconds and offers a manual sync button.

The current `mapped` status is **not** a claim that a clean image has been finished. It only means that a location and number exist in the draft atlas.

## Viewer

- Three tabs: Overhead, Main, Pedestal.
- «نقشه»: SVG-numbered boxes over an existing photo.
- «موزاییک»: each numbered box clips a separate portion of the same reference photo, with a gap between pieces; it can be independently overridden with high-quality artwork.
- Selectable parts, source crop preview, search, status filter, zoom and direct links to the existing approved Fuel / Flight Controls visual labs.
- Clean revision separation: no change to existing labs, cockpit base pages, audio, simulation logic, or JeppIran.

## QA constraints

The original PDF is a layout reference; zoom-accurate labels and moving controls must be reconstructed from their authoritative high-quality masters and approved separately. The first iteration of tile boundaries is a **draft**, and physical ROI and procedure accuracy are not certified. The pre-existing root page remains untouched.

**Educational development only; not for flight operations.**

## Update 2026-10-23.4 — OH-01..06 immutable source

The full original uploaded PNG is preserved byte-for-byte in `assets/locked/2026-10-23/OH01-06-source-9d8ac0ac86bd.png` (SHA256 `9d8ac0ac86bdb92c040e9bdd97811ca381535d949bff94aa5b1a01e5de8e23df`). Preview: [upper-oh/](upper-oh/). Six tile IDs are mapped via polygons in `upper-oh/geometry.json`; per-tile replacements later append a new asset path and a history event, without modifying the locked original. The previous 53 unaccepted regions remain disabled. Composite lower-overhead alignment is preview-only; never imply signed-off geometry.
