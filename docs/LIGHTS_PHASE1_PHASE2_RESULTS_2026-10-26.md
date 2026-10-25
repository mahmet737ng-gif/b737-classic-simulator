# B737 Classic — Annunciator photo calibration and first vector face reflow

**Applied to `mahmet737ng-gif/b737-classic-simulator`, 2026-10-26**

## Outcome

- 142/142 mounted lamps (112 overhead + 30 main panel) evaluated from 19 original source photographs.
- **120/142** pass at least one strict original-photograph, **3-source-pixel** centre detector.
- 22 more have been inspected on nearest-neighbour enlarged **original-photo pixel crops** but their numerical centre certificate remains **OPEN**, not falsely marked green.
- **12 positions** were adjusted in source-pixel X, documented before/after; **8** via independent rim+component consensus, **4** following enlarged original-photo review.
- **9 annunciator designs** have new true-aperture shape-fitted vector faces (**18 OFF/ON SVG states**); preserve original character shapes, typography, OFF colours and ON glow. No aspect-ratio distortion.
- All original approved overhead mosaic pixels/placement and locked LIGHTS files unchanged.
- This is a **non-flight operational simulator UI** QA, not a certified Boeing/aircraft installation approval.

## Changed photo placements

Eight independently measured:
- OH19-VOICE: `door-fwd-entry` (+4 x), `door-aft-entry` (+4 x), `door-air-stair` (+5 x), `door-aft-cargo` (+5 x), `door-fwd-service` (+5 x), `door-aft-service` (+5 x).
- OH20: `duct-overheat-r` (+5 x).
- OH15: `window-r-fwd-on` (+3 x).

Four subsequently visually reviewed under nearest-neighbour pixel enlargement:
- OH19-VOICE: `door-equip` (+5 x), `door-fwd-cargo` (+5 x).
- OH16: `cowl-anti-ice-1` (+5 x), `cowl-valve-1` (+5 x).

Widths, heights, Y and source photographs remain intact. The two OH19-VOICE additions now show near-zero *horizontal* detected offsets, but their vertical segmented components remain ambiguous; do not claim a certified four-edge glass mask.

## Nine typography-preserving asset reflows

- Overhead: `yaw-damper`, `probe-capt-ps`, `probe-l-elev`, `probe-l-alpha`, `probe-temp`, `probe-fo-ps`, `probe-r-elev`, `probe-r-alpha`.
- Main panel: `main-stab-trim` / STAB OUT OF TRIM.

Reflow method: derive **unlocked** SVGs from the unchanged owner-provided artwork; increase the dark-background vector canvas width to match the native socket ratio; apply only centre *translation* to the original text/glow groups, without rescaling, clipping, substituting fonts or stretching individual letters. Every state is SHA-256 checked; existing gallery assets remain unchanged.

This is first-cohort visual remediation. Other lamps with aspect ratio mismatches remain to be reflowed, and manual screenshot acceptance remains open.

## Photo audit evidence

- Full current verdict: [photo-pixel-registration-v2.json](../panel-mosaic-lab/lights-test/photo-pixel-registration-v2.json)
- All old/new coordinates with photographic rationale: [photo-position-corrections-v1.json](../panel-mosaic-lab/lights-test/photo-position-corrections-v1.json)
- Fitted SVG inventory: [precision-faces-v1.json](../panel-mosaic-lab/lights-test/precision-faces-v1.json)
- [Native photo pixel QA run (all 142)](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40237596604)
- [Lossless nearest-neighbour source-photo crops for unresolved positions](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40237357643)

## Live verification

- [Interactive overhead (?debugLights=1)](https://mahmet737ng-gif.github.io/b737-classic-simulator/panel-mosaic-lab/interactive-overhead/?debugLights=1)
- [Unified cockpit (?debugLights=1)](https://mahmet737ng-gif.github.io/b737-classic-simulator/panel-mosaic-lab/cockpit/?debugLights=1)

## CI gates and open risks

GitHub Pages deployment now requires immutable-overhead QA, existing overhead/main lamp-model tests, the original phase-one 142-lamp audit check, historical pixel audit check, new current-v2 photo audit check and 9-design/18-state fitted-SVG integrity test.

Outstanding: 22 precise source-pixel centring verdicts, alternate 737-400 vs 737-300/500 photo registration, and independent CPCS/DCPCS visual-position checks. No unverified positions were moved solely based on a mismatched SVG asset ratio.
