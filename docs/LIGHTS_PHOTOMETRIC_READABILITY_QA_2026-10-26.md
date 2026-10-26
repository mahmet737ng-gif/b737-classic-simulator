# B737 Classic — Optical contrast, source hue, DIM/BRIGHT and display-size baseline

**Date:** 2026-10-26. **Scope:** `Unified`, standalone overhead, main panel, OH22 CPCS/DCPCS, OH21 737-400.

## Test results, with honest acceptance levels

| Browser-computed test | Measured result | Status |
|---|---:|---|
| Installed overhead and main lamp positions in previous live-browser mounting QA | 112 + 30 = 142 | PASS |
| Source/SVG lighting states decoded and analysed in Chromium | **307 / 307** | PASS |
| SVG decoding failures | **0** | PASS |
| OFF-to-ON highlight order violations | **0** | PASS |
| Relative highlight contrast warnings below the automated threshold | **0** | PASS |
| Blue three-state lamps with BRIGHT_BLUE brighter than DIM_BLUE | **7 / 7** | PASS |
| Reference-asset photo positions with independently certified pixel centers | **140 / 142** | Two separate source-photo exceptions still OPEN |
| Representative small-screen contact sheet | **12 lamps × 33% and 50% sizes** | 27 states per size render/decoding PASS, **human glyph QA pending** |
| Boeing-certified colorimetry, nit/lux brightness or simulator-wide visual acceptance | **Not yet measured** | OPEN |

The instrument computes linear-light sRGB highlight energy after browser vector rendering to a normalized **128×64-pixel sample canvas**. These figures are **comparative digital-pixel metrics**, not photometer measurements or Boeing technical specifications. The OFF/ON contrast ratio divides by a very small OFF signal and therefore is **not a claim about physical candela** or human contrast sensitivity.

### Seven DIM/BRIGHT BLUE pairs

| Light | Bright-to-Dim highlight energy |
|---|---:|
| WING VALVE OPEN L | 1.327 |
| WING VALVE OPEN R | 1.325 |
| COWL VALVE OPEN 1 | 1.330 |
| COWL VALVE OPEN 2 | 1.330 |
| CROSSFEED VALVE OPEN | 1.321 |
| FUEL VALVE CLOSED 1 | 1.323 |
| FUEL VALVE CLOSED 2 | 1.323 |

The emitted blue channel also grows relative to the surrounding dark face. **No arbitrary opacity/color/brightness filters were added**, since that would change user-approved graphics without a trusted aircraft lamp photometric target.

### Candidates for visual review

The smallest measured ON-to-OFF digital highlight ratios among the 142 normal mounted instances were `main-at-lim` (**36.75**) and two white `irs-[l/r]-align` states (**36.89**). They still pass the directional test; review their source glyphs at small scale before any lamp-specific tuning. `main-pull-up-captain` source-photo centering, and `flight-recorder-off` remain separately unresolved photographic precision tests and must not be moved based on optical-luminance data.

## Code and reproducible artifacts

- [Per-state optical luminance, blue chroma and emissive RGB test](../tools/test-lamp-photometric-qa.cjs)
- [Screenshot contact sheets at 50% and 33% physical source size](../tools/test-lamp-readability-qa.cjs)
- [GitHub Actions run — all 307 states, two image contact sheets](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40249801537)
- [Associated downloadable measurement JSON and screenshots](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40249801537#artifacts)
- [Re-run-on-asset-change workflow](../.github/workflows/lamp-photometric-qa.yml)

## Next steps for *actual* optical calibration

1. Open the two 50% and 33% image contact sheets and assess legibility of the original legends independently; expand to the remaining lamp families and mounted socket sizes.
2. Compare the source-family colors and lamp intensity with high-quality aviation reference photography taken under a known cockpit lighting mode; grade red, amber, white, green and blue separately.
3. Preserve **seven three-state blue lamp transitions**; do not introduce global CSS `filter: brightness()` that would distort OFF states, dim states, white warnings or locked artwork.
4. Record reference lighting environment, source geometry, and approved brightness per lamp family before any tuning. Keep all owner-locked photographs, source SVGs, original 142 placement coordinates, and control rules unchanged until visually justified.

**Outcome of this batch:** reproducible optical QA gates and readable source-size contact sheets are installed and running; **no ungrounded color or brightness retuning was shipped**.
