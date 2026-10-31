# B737 Classic CDU text hierarchy — photo cross-check v1

This calibration is for the **active FO CDU in Unified**. The Captain CDU remains disabled by the prior owner instruction. The change affects **screen text only**; do not touch locked BoeingCDU font files, the photographed bezel, 70-key map, IRS front end or the approved 24-character scratchpad width.

## Visual references

- IXEG 737-300 IDENT page (green CRT, Classic): https://forums.x-plane.org/files/file/50162-window-cdu-for-ixeg-737-300/
- IXEG 737-300 SELECT DESIRED WAYPOINT screen (green CRT): https://forums.x-plane.org/forums/topic/102837-fmc-ixeg-737/
- 737-300 green CRT PERF INIT, IXEG cockpit: https://forums.x-pilot.com/forums/topic/11464-no-exec-light-on-fms/
- Boeing CDU PERF INIT close-up (modern colour CDU; **supplemental** layout ratio only): https://www.flaps2approach.com/journal/2014/12/1/cost-index-ci-explained.html
- Boeing CDU TAKEOFF REF close-up (modern colour CDU; **supplemental** layout ratio only): https://ameblo.jp/technobird/entry-12677624626.html
- Boeing 737 FCOM CDU title / line-title / data-line / scratchpad distinction: original text contract already registered at FCOM 11.10.9 and 11.40; no new document copy included in this repository.

The above images are **visual reference, not exact EP-FSI OEM unit calibration**; source brightness, perspective, camera angle, manufacturer and software version can change appearance. No downloaded third-party reference image is stored in git.

## Class / nominal text-height ratios, relative to full-height large data line

| Role | Relative size | Location |
| --- | ---: | --- |
| DATA value, e.g. OIII, 737-300, speed | 1.00 | six LSK data rows |
| LSK command, e.g. <INDEX, POS INIT>, <ACTIVATE | 0.95 | lower data row beside associated LSK |
| Top page title, e.g. IDENT, RTE | 0.88 | top row, no relocation |
| Field title, e.g. MODEL, ORIGIN, RESERVES | <=0.73 | small font in upper title row |
| Scratchpad (24 A exactly) | 1.00 | bottom row, **not** derived from input text length |

**IMPORTANT:** These are relative CSS/em sizing targets, not literal font pixels. The absolute large-font pixel size is calculated by the existing approved `Metrics.calibrate(ctx,available,family)` so that 24 capital A glyphs fit, but 25 do not. For small labels, the calibrated BoeingCDUSmall size is constrained by the 0.73 cap. Therefore the small-font visual glyph height may vary slightly by glyph.

## Correct visual line role

In the original parsed FCOM page-definitions, action prompts such as `<INDEX` and `ROUTE>` were frequently stored in `cell.label`. On screen, the photo-reference convention places these standalone selectable commands on the lower **LSK data line**, not in the upper **small title line**. The active Unified screen compositor now promotes such action prompts on the **detached rendered DOM** only. It does not rewrite `data/page-definitions.json`, dispatch a CDU key, swap a page, change pending/active route, or change a physical LSK region.

The FCOM-locked DEP/ARR INDEX is nonstandard and remains a 3-column layout; its centre/left/right placements and LSK coordinates are not rewritten. Nonstandard source-only Stage5/6 overlay pages retain their previous vertical placement and receive the same content-based prompt size where applicable.

## Tests

```bash
node panel-mosaic-lab/cockpit/cdu-photo-type-hierarchy.test.cjs
node panel-mosaic-lab/cockpit/cdu.test.cjs
node panel-mosaic-lab/cockpit/cdu-fo-only-performance.test.cjs
```

Deployment blocks on these tests. The first test exercises seven exact existing page definitions (`INDEX`, `IDENT`, `POS_INIT`, `RTE`, `PERF_INIT`, `TAKEOFF`, `LEGS`) against the real text layout module using synthetic deterministic font advances. It checks prompt movement, ratios, unmodified source definitions and exact 24A scratch width. Photorealistic screen comparisons on the owner's display remain a separate browser-acceptance check; this test alone does not prove pixel-perfect matching.
