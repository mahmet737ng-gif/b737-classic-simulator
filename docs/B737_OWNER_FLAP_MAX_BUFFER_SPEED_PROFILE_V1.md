# User-provided Flap Speed Maximum + Buffer · 737 Classic EFIS training overlay

These numbers were supplied by the simulator owner on 2026-11-09. They are not represented as verified Boeing AFM speed placards or aircraft-specific FCC calculations. This profile is used for training and lab visualizations; the real AFDS limits continue to require qualified inputs.

| Flaps | Maximum IAS (kt) | Yellow buffer (kt) | Yellow zone (kt) |
| --- | ---: | ---: | --- |
| 1 | 230 | unspecified | not drawn |
| 2 | 230 | 5 | 225–230 |
| 5 | 225 | 15 | 210–225 |
| 10 | 210 | 15 | 195–210 |
| 15 | 195 | 5 | 190–195 |
| 25 | 190 | 5 | 185–190 |
| 30 | **180 default (screenshot)**; **185 selectable (written list)** | 25 | 155–180 (default) or 160–185 (alternate) |
| 40 | 158 | 0 | no yellow band |

Distinguish the owner-requested yellow **pre-maximum buffer** from the Boeing Chapter 10 High Speed Buffet yellow band and the Next Flap Placard yellow band. The red/black barber pole is above the applicable verified maximum or the labelled visual-training maximum. Buffer does not, by itself, trigger real FCC/AFDS reversion; the FCOM Chapter 4 reversion rules and qualified FCC evidence remain separate.

## Code / sources
- Pure table: `engine/efis/classic-flap-speed-profile-v1.js`, `get(detent, {flap30MaximumKt:180|185})`.
- Independently modelled training visual detent: `TRAINING_FLAP_PROFILE` with source `INSTRUCTOR_VISUAL_DETENT`; does **not** set `CONFIG.flapsPosition` or `LIMITS.valid`.
- Rendering: `panel-mosaic-lab/cockpit/eadi-speed-tape-v1.js`. On EADI a training-only maximum shows `TRN FL<n>`; the actual AFS command envelope stays unchanged.
- UI: pedal/quadrant visual events `b737:flap-detent-visual-test`, `b737:flap-ready` are projected to both CAPT/FO EADI by `speed-tape-unified-training-v1.js`. The trained limit is not transmitted to AFDS or the avionics ADC network.
- Test labs: `speed-limit-ch4-lab.html` and `speed-tape-lab.html` use the table and support 180/185 for Flaps 30.
