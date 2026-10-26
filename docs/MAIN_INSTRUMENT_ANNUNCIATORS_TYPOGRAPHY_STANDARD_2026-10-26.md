# Boeing 737 Classic — Main Instrument Panel annunciator typography standard

**Technical implementation:** `MIP-TYPE-0003` (2026-10-26)  
**Scope:** all 30 mounted MIP annunciators, 23 distinct source legend designs, 60 OFF/ON image states, separate from all overhead annunciators.  
**Primary sources:** `panel-mosaic-lab/cockpit/lights.json` and approved locked 737 Classic source photographs and lens SVGs. This is a **simulator-family optical consistency baseline**, not a claim that Boeing used one exact millimetric letter size for every lamp.

## Critical audit correction

The source assets inspected in this project already use **Arial / Liberation Sans / Helvetica fallback, bold weight 700** consistently. The former assertion that their font *families* were different was too broad. The demonstrable discrepancies are **unequal per-line font-size values**, **uneven multi-line baselines**, varied face-to-socket aspect ratios, and unreadability at 33% of photo source dimensions. For example:

- `REVERSER / UNLOCKED`: original lines 85 / 83 units.
- `START / VALVE OPEN`: 110 / 74 units.
- `LOW OIL / PRESSURE`: 110 / 85 units.
- `AUTO BRAKE / DISARM`: 70 / 110 units.
- `STAB / OUT OF / TRIM`: readable-stage 103 / 74 / 103 units.
- `ANTI SKID / INOP`: readable-stage 128 / 158 units.
- `A/T LIM`: readable-stage 162 units, distinct from most other single-line faces.

These units are in the source SVG's 300-unit nominal height coordinate system, *not actual display pixels*. **A physically longer line cannot safely be forced to the same point size as a short one inside a fixed cockpit aperture.**

## Required shared typography rules

All text remains its exact source spelling and capitalization. Base font = **Arial, Liberation Sans, Helvetica, sans-serif**, weight **700**; source colors, source glow styles, original warning words, lamp wiring and source photo positions remain unchanged.

| Family | Nominal font size (300-unit coordinate) | Text baseline(s) | Vertical pattern | Rule |
|---|---:|---|---|---|
| Single-line white/amber | 145 | 206 | centered | Cap height constant unless constrained by source glass width |
| Two-line amber/red/green/white | 111 per line | 135 / 253 | 118 units apart | Both lines use the same baseline and font intent; long labels are width-fitted without stretching individual glyphs |
| Three-line amber | 105 per line | 99 / 190 / 281 | 91 units apart | Preserve all three lines; no collision |
| Critical red PULL UP | preserve existing approved source | unchanged | single | Preserve accepted face and optical proportions; never worsen a good warning just to impose a nominal point size |
| All families | fixed target native ratio = mounted sourceRect width / sourceRect height | original label group optically centered | no nonuniform scaling | Dark face enlarged to exact photo socket aspect, with approved text group uniformly **translated**, not horizontally stretched |

Target text width is limited to approximately **84–85%** of the original physical source width (critical red allowed 88% if already approved). The width heuristic provides a starting point, but Chromium checks the *actual* text bounds, which are authoritative for digital cropping. Each line's font adjustment is indexed by the **text element ordinal**, not its character offset within the SVG string (a bug detected and corrected in MIP-TYPE-0003).

### Real browser pixel exceptions fixed

The first pass caught 3 bounds violations in two lamp designs, rather than treating compilation as a visual approval:

1. `AUTO BRAKE / DISARM`: painted AUTO BRAKE was wider than its **80×40** photo aperture. The actual first-line size was reduced based on measured Chromium margins; the second line stays sized independently.
2. `SPEED BRAKE / ARMED`: painted SPEED BRAKE exceeded its **94×39** photo aperture in OFF and ON. The first line received an optical width correction, preserving its original wording and second line.
3. The generation code had mistakenly used the regex match's **character index** as if it were the next text element index. This sometimes switched which line received the fitted size or baseline. The actual text ordinal is now used; a regression assertion verifies line-by-line correspondence.

## Model coverage and immutable sources

- 30 mounted positions and original photo source rectangles are retained **exactly**.
- 60 new source-paint-preserving, native-proportion OFF/ON SVG derivatives reside in `panel-mosaic-lab/assets/lights/main-type-v1/`.
- `panel-mosaic-lab/cockpit/typography-faces.json` maps every mounted MIP ID to its own shape-correct file, overriding only the visual face. Electrical behavior remains delegated to `lights-model.js`.
- Original 23 shared source assets, pilot and F/O photo surfaces, existing CPCS/DCPCS/737-400 overlays, and established overhead lamp panels are not edited.
- Changes to the type generator are version-controlled and only modify unlocked generated derivative assets.
- Future source-photo variants must be audited separately; do not simply share one image between physically different socket shapes.

## Five-phase acceptance

1. **Inventory:** 30 / 30 mounted positions found and classified by displayed legend, face ratio, warning hue, line count and asset provenance — completed.
2. **Family baseline:** seven functional typography categories with named visual exceptions, 700 bold source font, canonical baselines and width-limiting policy — completed.
3. **Rebuild:** 60 derivative state images and live Unified renderer mapping, without original image, switch, or lamp-rule edits — generated and source-locked.
4. **Optical QA:** real Chromium `getBoundingClientRect()` for all 60 states plus full 30-lamp ON/OFF photographic contact sheets at **100%, 75%, 50%**. Any cropping is a CI failure. Independently inspect screenshots for actual reading quality — **browser checks automated, expert reference-photo visual sign-off remains explicitly separate**.
5. **Lock:** `main-typography.test.cjs` prevents spelling changes, font assignment swaps, original image edits, inconsistent socket ratios or missing state hashes. Pages deployment requires the test. The *generator contract* is locked, not presumed aviation-certified for unreadable physically tiny source lamps.

## Live evidence

- [Source-to-derived line-by-line face audit](../panel-mosaic-lab/lights-test/main-type-audit-v1.json)
- [Complete mounted visual mapping](../panel-mosaic-lab/cockpit/typography-faces.json)
- [Generation code](../tools/build-main-lamp-typography-v1.cjs)
- [Immutable source and alphabetic text assertions](../panel-mosaic-lab/lights-test/main-typography.test.cjs)
- [Photographic contact sheet browser test](../tools/test-main-lamp-typography-visual.cjs)
- [Build workflow](../.github/workflows/main-lamp-typography.yml)
- [Visual test workflow](../.github/workflows/main-lamp-typography-visual.yml)

**Unresolved limits:** Final colorimetry, luminance in real nit/lux, and full reference-photo font-shape match at the simulator's actual tablet or monitor size cannot be certified just by these digitally generated screenshots. These require aircraft reference photographic comparison and user screen-size review. No ungrounded lamp recoloring is applied.
