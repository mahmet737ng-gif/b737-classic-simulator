# B737 Classic — Next priority executed: 19 pixel registrations + 12 native-ratio vector face designs

**Date:** 2026-10-26

## Machine-verified result

| Criterion | Previously | After this batch |
|---|---:|---:|
| Mounted original-photo images reviewed | 142 | 142 |
| Numeric source-photo centres meeting <=3px criterion | 120 | **140** |
| Source-photo centres needing a special/manual method | 22 | **2** |
| Annunciator instances with non-distorting, native-ratio fitted vector faces | 9 | **21** |
| Derived SVG light states, including OFF and illuminated states | 18 | **45** |
| Locked original overhead/photograph edits | 0 | **0** |

The 19 newly certified lamps passed independent signed left/right/top/bottom dark-glass scanline geometry checks on original image pixels, with sufficient contrast, a bounded physical extent and within 3 source pixels of existing registered centres. No geometry changed based only on this scanline result.

## Two still open — do not invent coordinates

1. `flight-recorder-off` — 40×31-pixel tiny aperture; the left photographic rim has insufficient gradient support.
2. `main-pull-up-captain` — tilted brown/tinted alarm lens, strong glare; the bottom edge confidence is slightly below threshold.

These **are not declared incorrectly located**. Their pixel-exact centre remains *uncertified*.

## Thirteenth source-pixel correction

After all four independent glass scanline sides were measured for `fuel-1-aft` in OH09, its photo-centre displacement measured **+3.5 source pixels horizontally**, just outside the 3-pixel threshold. Its sourceRect X was changed **94 → 98** (4 pixels). Re-running the independent photo test measured **+0.5 px horizontally and −1.5 px vertically**, inside tolerance; native width, height, y and all immutable source images were untouched. Evidence: [the correction record](../panel-mosaic-lab/lights-test/photo-position-corrections-v2.json) and [successful remeasurement](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40239912718).

## Second vector-fit cohort

Twelve **singleton** mounted annunciator designs, 27 unique state SVG derivatives:

- Overhead: `probe-fo-static`, `probe-capt-static`, `ground-power-available`, `wing-valve-l`, `wing-valve-r`, `apu-overspeed`, `feel-diff`, `speed-trim`, `mach-trim`, `auto-slat`, `crossfeed-valve`.
- Main panel: `main-antiskid`.

The root SVG has the original source-lens height and target native socket ratio; a centred translation transforms the original vector glyph/glow groups uniformly (without stretching characters or recolouring text). All 27 state digests match their mounted asset references. Original locked reference artwork is byte-for-byte unchanged.

The other nine (18 SVG states) from the preceding batch remain intact and hash-verified.

## Reproducible evidence

- [Current per-lamp photo and pixel-verdict database](../panel-mosaic-lab/lights-test/photo-pixel-registration-v4.json)
- [First nine fitted light designs](../panel-mosaic-lab/lights-test/precision-faces-v1.json)
- [Next twelve fitted light designs](../panel-mosaic-lab/lights-test/precision-faces-batch2.json)
- [Independent photo-scanline workflow](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40238859555)
- [Second vector batch build/QA/publish](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40239269083)
- [Unified Pages acceptance tests](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40239404603)

## Remaining release and visual work

- Explicit browser screenshot checks of the **21** new mounted vector shapes across OFF/ON and appropriate dim/bright states.
- Remaining 3 photographic pixel registrations, especially small or perspective/angled lenses.
- Shared asset families (RAM DOOR FULL OPEN, OVERHEAT, LOW PRESSURE, ON GREEN etc.) need **per-instance** geometry-aware derivatives. Do not modify shared locked SVG assets to fix one socket.
- Independently compare 737-400, CPCS and DCPCS alternate photographs and placements before calling those variants pixel calibrated.

All code and current geometry are published on `main`; no user-provided photographic source is replaced.
