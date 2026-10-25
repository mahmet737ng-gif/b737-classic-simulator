# Boeing 737 Classic — per-socket annunciator fit and special-photo acceptance

**Date:** 2026-10-26. **Repository:** `mahmet737ng-gif/b737-classic-simulator`.

## Executed changes

- 37 instances using eight **shared overhead** asset families and one **main-panel PULL UP** family now use individual natural-aspect-ratio SVG faces, addressed by `lamp.id` rather than changing their shared `asset`.
- 74 separate ON/OFF/DIM/BRIGHT face files were produced. Each file is derived from the original byte-verified locked SVG; the text, dimensions of vector letters, colour and glows are preserved. Only the face canvas and centring *translation* vary by socket.
- The overhead and cockpit controllers still reference **68 overhead + 23 cockpit** original asset types; original sensors, scenarios, lamps, placement `sourceRect`, underlying photos and power buses were **not** changed.
- Together with the prior 21 one-to-one fitted annunciators in 45 states, there are **58 calibrated instance faces**, covering **119 derived light state files**.
- Added safe-by-default runtime `instance-faces.json` loaders for `interactive-overhead/lights.js` and `cockpit/lights.js`, with strict matching against source IDs, asset names, sourceRect coordinates and all required light states. A missing or malformed mapping fails visibly rather than silently substituting mismatched art.
- GitHub Action regenerates the 74 states and runs SHA-256 integrity, original-text comparisons, source geometry invariants and frozen overhead checks.

## Two previously unresolved photo sockets

After earlier 140/142 pixel-verified placements, an independent signed red/green/blue pixel-rim audit on the original immutable photographs found:

| Light | Native source photo ROI | Four independent rim edges | Centre deviation | Verdict |
| --- | --- | --- | --- | --- |
| Main captain `PULL UP` | `[1284,389,164,68]` | Yes | `[+0.5,-2.5]` native px | **Verified**, also consistent with previous grayscale scanline |
| UPPER `FLIGHT RECORDER OFF` | `[1485,439,40,31]` | No — left edge cannot be isolated | Not reliable | **Open**, don't claim pixel confirmation |

**Current status: 141/142** photographed sockets have supported numerical centre registration at or within 3 native pixels. The remaining recorder annunciator has its own width/height-fitted vector source for visual mounting but that does **not** certify the left photographic glass edge.

### Evidence and test releases

- [Current detailed 141/142 photo ledger](../panel-mosaic-lab/lights-test/photo-pixel-registration-v5.json)
- [Native RGB photo evidence for final two](../panel-mosaic-lab/lights-test/photo-special-colour-v1.json)
- [Shared annunciator output manifest](../panel-mosaic-lab/lights-test/instance-faces-rollout.json)
- [Original-photo special audit Action](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40241103485)
- [Shared SVG build/test/publish Action](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40240943132)

## Unclosed verification

Browser screenshot comparison of ON, OFF and DIM/BRIGHT states on actual 737 variants, plus separate alternate 737-400 and CPCS/DCPCS photo layouts, is not yet final. For FLIGHT RECORDER OFF, try a photographed physical contour mask or a higher-resolution source of that tiny corner; do not move its lamp on incomplete left-rim evidence.
