# B737 Classic CDU: reference-derived text scale and LSK layout

Scope: **Unified First Officer CDU** (the sole active CDU). The original approved 1199×1312 image, BoeingCDULarge/BoeingCDUSmall font binaries, six left/six right hardware LSK rectangles, 24-column scratchpad policy, IRS red zone and FMC backend are untouched.

## Visual references (external, used only for visual comparison)

1. [IXEG 737-300 CDU IDENT, green CRT](https://forums.x-plane.org/files/file/50162-window-cdu-for-ixeg-737-300/) — page heading, small field names above large model/cycle fields, bottom LSK prompts.
2. [OEM-derived Classic CDU PERF INIT, physical cockpit photo](https://www.flaps2approach.com/journal/2017/3/8/conversion-of-oem-cdu-part-one.html) — six stacked two-line cells, data/prompts legible with smaller green labels.
3. [IXEG 737 Classic LEGS page closeup](https://forums.x-pilot.com/forums/topic/17524/intercept-course-function/) — data and LSK prompts full size; course/distance annotations and line titles smaller.
4. [IXEG 737 Classic SEL DESIRED page](https://forums.x-plane.org/forums/topic/102837-fmc-ixeg-737/) — top header and source choices.
5. [14-row/24-column CDU display model](https://wiki.flightgear.org/Howto:Coding_a_Boeing_CDU) and [737 FMC font hierarchy](https://static1.1.sqspcdn.com/static/f/1003521/16096487/1326860200583/PMDG%20B737%20FMC%20Guide.pdf) — general formatting guidance. NG images are **not** treated as authoritative for Classic equipment or data values.

These images establish **proportions and hierarchy**, not a scientifically calibrated pixel-size certificate: screens are photographed at varying angles/resolutions and the Classic may use different software/effectivity. No third-party image is copied into the repository.

## Applied UI rules

| Element | Unified calibration | Rationale |
|---|---|---|
| Data values, LSK action prompts (such as `<INDEX`/`ROUTE>`) | Approved BoeingCDULarge at native **24-A scratchpad calibration** | Retain 24 full characters across entire CDU grid; prompt/data same visual tier |
| Field titles / smaller descriptions (e.g. ORIGIN, DEST, GW/CRZ CG, CRZ ALT) | Approved BoeingCDUSmall, measured glyph-cap height **68% of data glyph-cap height** | Restore real-world small-vs-large visual hierarchy |
| Top page title and page count | Approved BoeingCDULarge, 87% of main font pixel size | Clear heading separate from LSK data, without overfilling first row |
| Six label/data pairs | Registered to **immutable actual LSK centres** from `cdu-map.json`; last row clipped to pre-scratch zone | Avoid arbitrary type baselines / overlap |
| Long per-field text | Limit auto shrink to **84%** of its base text tier; overflow clips | Prevent cartoonishly tiny prompts and accidental font distortion |
| Scratchpad | Original 24-character 24-A/25-A guard unchanged | Avoid reflow, line shifts or pixel corruption |
| Line weight, font files, colors, key locations | Unchanged | Preserve owner-approved artwork and lock policy |

The one-file runtime change is `panel-mosaic-lab/cockpit/cdu-screen-fit-v6.js`, which operates on the existing **visible text DOM** after the original core/compositor renders each page. No hidden alternate text page is added and no new fonts/assets are loaded. `cdu-stage.html` bumps only its existing typography-script cache key to R3; original scripts remain in their previous order.

The 14-row geometry includes title line, 6 label/data pairs and bottom scratchpad. The label/data rows derive their Y-centers from the hardware LSK source map (L1..L6); row 6 caps at 82.5% label / 86% value, scratchpad starts at 93.2%.

## Verification

`node panel-mosaic-lab/cockpit/cdu.test.cjs`

Includes `cdu-classic-typography.test.cjs`, which:
- asserts hardware key geometry unchanged and all six rows registered to actual LSK coordinates;
- tests calibrated 68% small-label cap ratio against the original large data text;
- confirms main value and scratchpad do not shrink;
- confirms lower prompts finish before the bottom scratchpad;
- preserves the authoritative 24-column metric mode.

A synthetic rendering check against the original keymap passed (header, pairs, 24-column scratchpad). **Pixel-by-pixel comparisons on the user's device and original-aircraft effectivity validation remain outside automated synthetic scope.**
