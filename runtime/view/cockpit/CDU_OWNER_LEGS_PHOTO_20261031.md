# Owner CDU photograph: 31 October 2026

Reference: user-supplied 865×1536 physical B737 Classic CDU LEGS photograph. The visible glass roughly occupies image x=110–629, y=324–733. Lit glyphs mostly occupy x=171–568 (~77% of the glass width). Letter height and phosphor brightness vary from camera perspective and exposure; therefore exact device pixels must still be compared in-browser before calling the result pixel-perfect.

## All-page screen profile

- Text grid: 77% of glass width, centered horizontally; Boeing's 24-column A-character scratchpad fit remains the decisive metric (24 A fits, 25 does not).
- Font faces: preserve existing locked BoeingCDULarge and BoeingCDUSmall TTF bytes. No substitution or synthetic bold.
- Large data, LSK action prompts, editable dashes/boxes, scratchpad: exactly 1.00× the measured large font; no page-specific inflation.
- Small field labels: existing measured BoeingCDUSmall cap height at 0.70× the large cap height.
- Header: 0.94× large-font size.
- Green phosphor: #29e637 with subtle subpixel-size halo; avoid fluorescent double-glow. Photo sampling of lit glyphs: average RGB about 40,179,37, with wide camera-dependent variation; do not misrepresent this as a hardware-calibrated absolute color.
- Keep prior six LSK-row anchors, 14-line sequencing, DEP/ARR special source layout, and IDENT 12-column dates. All pages share the same font role sizes. Remove horizontal and vertical text distortion.

## Scope and checks

Only the active FO CDU and the v6 standalone screen presentation were modified. CAPT remains disabled in Unified. No FMC database, navigation logic, IRS locked frontend, physical LSK hitboxes, panel artwork, or font file was edited.

Test coverage: `cdu-classic-typography.test.cjs`, `cdu-photo-type-hierarchy.test.cjs`, existing `cdu.test.cjs`. Exact physical-camera equivalence is not verified by synthetic unit tests.
