# EFIS CP — Owner-photo locked implementation (2026-10-23)

## Fixed reference, no redraw
- Source image: user-provided `1000166399.jpg`, 1536 × 977.
- Source SHA-256: `925b9f6ee6906c2765f23492a31b5524106bf088074cac12b78bb58dd3001867`.
- Optimized WebP source SHA-256: `dce3bf74d6d1001b67fb427e515b6a8caf8ff9fbf2b6970fc876529f2a5c619e`.
- Target asset: `cdu-standalone-v6/assets/efis-cp-reference.webp`.
- The *new* EFIS overlay references the photo, positions controls by normalized coordinates, and extracts knob appearance from the exact same photo through CSS background cropping; no generic HTML/CSS panel replaces it.
- Physical photo keeps the labels, shape, switch placements, screws, borders and button row unchanged.

## Versioned implementation
- `cdu-standalone-v6/ehsi/photo-panel.js` registers 12 photo-relative input zones: DH, RST, ADI BRT, MODE, EHSI outer BRT, inner WXR BRT, RANGE, WXR, VOR/ADF, NAV AID, ARPT, RTE DATA and WPT (the two concentric brightness controls occupy one image zone).
- `photo-panel.css` clips photo-derived knob visuals and animates rotor changes, button depressions, illuminated alternate-action button labels, and red DH display.
- Script mounted in existing CDU Trainer `index.html`; approved CDU picture and its map are not touched.
- MODE physical order clockwise: EXP NAV → EXP VOR/ILS → MAP → CTR MAP → PLAN → FULL NAV → FULL VOR/ILS. Seven detents; no free spin/wrap at ends.
- RANGE: 10 / 20 / 40 / 80 / 160 / 320 NM. Six detents, clamped end stops.
- DH reference: 200 initial, minimum -20, maximum 999, increment ±1 per event. Hardware increment/effectivity is per user correction; independent Boeing QA pending.
- Click, Shift+click, wheel, drag/swipe, and keyboard arrows are accepted on rotary controls. RST springs out visually; pushbuttons latch visually. Double-shaft HSI/WXR brightness targeted separately.
- WPT labels are gated by WPT selected + range ≤40 NM in synthetic test-route rendering. NAV AID, ARPT, VOR/ADF, radar/TCAS symbols are deliberately not fabricated without navigation/sensor data.
- Miscellaneous simulated inputs stay in a collapsed section *outside* the source photo, not added onto the physical hardware.

## Asset-transfer limitation
The connected GitHub actions support writing UTF-8 text and blobs from supplied base64 content; they do not automatically ingest the user-uploaded binary photo from the conversation's container. **The WebP asset has not been uploaded to the public repository.** Thus the new photo overlay needs the original image loaded from the photo picker until that one asset is uploaded to the path above.

The picker accepts the original JPEG/PNG/WebP, displays it as the immutable base in the existing CDU Trainer, and caches a data URI in browser local storage. This means the user can test the actual uploaded photo and controls immediately, without image redraw or a new app. A companion high-resolution asset ZIP is available in this conversation.

## Test state
- `tests/efis-photo.test.cjs` covers registry, MODE/RANGE selection and DH limits.
- Root `npm test` now syntax-checks the new JavaScript and runs those tests.
- Browser screenshot/pixel calibration and published GitHub Pages live check: **NOT VERIFIED**.
- The EHSI remains a classroom trainer and must not be presented as real FMC/IRS or approved aircraft avionics.

## Required follow-on QA
1. Upload photo binary to the source asset path. Do not replace with an approximate image.
2. Visually compare each knob center, clip, detent pointer position and button LED to the 1536×977 master image in actual desktop/mobile browser.
3. Verify the visual keypad labels at intended normal dimensions, keyboard control accessibility and the independent concentric brightness click regions.
4. Test CDU RTE → ACTIVATE → EXEC and SIM ROUTE coupling, source-invalid blank rules and EHSI WPT range gate.
5. Mark accepted only after user's photo-level visual review and all tests run.
