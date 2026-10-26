# B737 Classic — Visual inspection of real annunciator raster output

**Review date:** 2026-10-26  
**Scope:** 12 representative installed annunciator designs, OFF/ON and blue DIM/BRIGHT states.  
**Ground truth:** **real Chromium PNG screenshots**, not icon mockups or metadata alone, recorded at **50% and 33% of the original photograph source-rectangle width and height** with `deviceScaleFactor=1`. These scales are optical stress tests, **not proof of a specific user's default Unified on-screen zoom**.

## Visual decision

**Visual acceptance is PARTIAL / FAIL for complete small-size rollout.** The Chromium image decoder passes 307/307 source lighting states and the blue DIM/BRIGHT contrast order passes 7/7; those numerical checks do not establish readable legends at reduced viewport sizes.

Decision criteria: recognizable **full legend** at 33% without zooming; unmistakable ON/OFF difference; intended warning/hue identifiable; no gross visual stretching or clipping. Scores 1 (unusable) through 10 (clean), based on direct visual inspection of the source-output raster, **not certification against Boeing photometric references**.

| Mounted lamp | 50% | 33% | Score / 10 | Visual assessment |
|---|---|---|---:|---|
| `flight-recorder-off` | Conditional | **FAIL** | **3** | Tiny 20×16 / 16×10 px; `OFF` illuminated legend only identifiable with concentration at 50%; too few pixels at 33% |
| `irs-l-align` | Conditional | **FAIL** | **4** | White ALIGN recognizable at 32×16 px but not reliably readable at 21×11 px |
| `wing-valve-l` | PASS | PASS | **9** | L VALVE OPEN recognizable in both blue states; OFF materially darker; clear proportions, no clipping |
| `cowl-valve-1` | PASS | PASS | **8** | COWL VALVE OPEN legible at 85×35 px stress size; three modes distinguishable; no obvious text warping |
| `fuel-valve-closed-1` | PASS | Conditional | **6** | FUEL VALVE CLOSED becomes tightly packed at 57×24; still identifiable when viewed closely, not reliably at a glance |
| `ground-power-available` | PASS | Conditional | **6** | Two-line GRD POWER AVAILABLE compressed at 60×22 px; blue face distinction good but fine strokes weaken |
| `ram-door-r` | PASS | Conditional | **6** | Two-line RAM DOOR FULL OPEN adequate at 110×34 but very small at 73×22 |
| `window-l-fwd-on` | PASS | PASS | **9** | ON large and sharp, unmistakable green ON versus dark OFF even at 69×25 px |
| `main-pull-up-captain` | PASS | PASS | **8** | PULL UP clear red warning at both 82×34 and 54×22 px; **photographic slot-centre certification is a separate unresolved issue** |
| `main-at-lim` | Conditional | **FAIL** | **3** | Very fine 41×18 / 27×12 letters; source white label too few high-contrast pixels at 33% |
| `main-stab-trim` | Conditional | **FAIL** | **2** | Three lines STAB OUT OF TRIM collapse together at 29×19; optical font crowding despite correct natural SVG ratio |
| `main-antiskid` | Conditional | **FAIL** | **3** | ANTI SKID INOP amber glyph too small at 27×11; not reliably distinguishable without zoom |

**Overall: 4 pass at both scales; 3 pass conditionally at 33%; 5 fail the 33% readability test.**

## Required corrective actions before small-display approval

1. **Do not move any approved source photographic lamp rectangle to artificially improve text**. The unresolved two source-photo pixel centres are not inferred from these contact sheets.
2. For the five FAIL cases, review **native source glyph layout and available face size** at the actual Unified display scale. Redesign approved *derived* vector text per socket where evidence supports it, preserving the locked original SVG, shape/pivot and lamp electronics. Focus on `main-stab-trim`, `main-antiskid`, `main-at-lim`, `flight-recorder-off`, `irs-l-align`.
3. For the conditional three (FUEL VALVE CLOSED, GRD POWER AVAILABLE, RAM DOOR FULL OPEN), measure recognition at normal viewing distance on intended screen sizes; adjust original image-free **derived** vector glyphs only after owner-reference comparison.
4. Keep the four PASS cases as regression exemplars for blue, green and red lenses. **Do not add global CSS brightness or font scaling** to all lights.
5. Complete visual audit of remaining 130 mounted instances before claiming all 142 lamps are fully approved. ON/OFF digital contrast alone is insufficient.

## Verifiable imagery and measurements

- [GitHub Action with original 50% and 33% PNG screenshots](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40249801537)
- [Archive containing both screenshot PNGs and detailed brightness metrics](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40249801537/artifacts/12619679382)
- [Source renderer for the exact small-size visual test](../tools/test-lamp-readability-qa.cjs)
- [Source luminance and seven DIM/BRIGHT color measurements](../tools/test-lamp-photometric-qa.cjs)

**This is a visual inspection report; it does not silently change approved lamp artwork or assert aircraft-grade photometric certification.**
