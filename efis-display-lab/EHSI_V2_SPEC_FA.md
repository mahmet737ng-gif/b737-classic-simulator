# EHSI CLASSIC REBUILD 0002 — final implementation specification for the test lab

> این یادداشت مشخصات نسخهٔ 0002 را ثبت می‌کند. برای وضعیت آزمایشگاه 0003، فرمت‌های اضافه‌شده و مراجع سپهران، [README_FA.md](README_FA.md) را ببینید.

**Status:** Architecture and three display grammars are fixed. Visual *acceptance* remains open until an authorized Classic photo / FCOM overlay is manually compared. This is NOT airworthy avionics software.

## Decision

The generic EHSI v1 visual output is **REJECTED** for lab evaluation. It remains untouched for legacy CDU Trainer compatibility but is no longer loaded by `efis-display-lab/index.html`. The new renderer is the entirely isolated `efis-display-lab/ehsi-v2.js`, selected by `EFISClassicEHSIV2`. No owner-approved EADI, main panel, overhead, guarded switches or IRS files are edited.

There are exactly **3 reconstructed geometries in phase 1**:

| Display | FCOM illustration | Geometry of our teaching canvas (512 × 512) | Aircraft / heading | Route |
|---|---|---|---|---|
| MAP | Vol.2 10.31.2–3 | 70-degree expanded arc, circle center (256,438), radius 364, ±35° | Small **outline** triangle near (256,433); track-up; magenta selected heading bug | Synthetic active-leg magenta, off-route/background cyan |
| FULL NAV | Vol.2 10.31.8–9 | Complete 360° rose, circle center (256,270), radius 183; 45° fixed indexes | Small **outline** triangle centered; track annunciated in header, moving rose uses heading reference per 10.32.3 | NAV course/CDI presentation, not MAP-style waypoints |
| PLAN | Vol.2 10.31.18–19 | Independent true-north chart with a SEPARATE 70° expanded compass scale; no 360° full MAP rose | True-north pointer at right; 70° top scale; does not inherit the MAP aircraft symbol or dashed bug-to-airplane line | Test route in north-up east/north geometry, unaffected by heading or track inputs |

**Crucial:** these are precisely defined internal renderer coordinates, **not aircraft OEM pixel calibration measurements**. They are candidates for pixel audit, not approved Boeing placements.

## Visual source and typography rules

1. Primary: **737-300/-400/-500 Classic FCOM Vol.2**, not NG/MAX. Source folios 10.31.2, 10.31.8, 10.31.18; 10.32.1–4 and 10.40.9–11 (see source below).
2. Secondary: verified photo of a physical **737-400 Classic EADI/EHSI**, for proportions and display texture only: https://www.ne.jp/asahi/to/yagiya/B737-400story.html
3. User-provided Cockpit Companion **Classic 3-4-5** can be overlaid by its owner in the local reference picker; its image bytes are NOT reproduced in this public repository.
4. Primary colors from FCOM 10.32.1: **white** present/range, **green** dynamic/selected/active, **magenta** commands and fly-to, **cyan** background/nonactive, **amber** failure flags, **red** warnings, black off. Hex palette is presently a **visual hypothesis** needing sample-based acceptance.
5. All displayed metrics must be model-derived or clearly placeholder. No fictitious WXR echoes, TCAS targets, terrain image or live FMC route. TEST0 / TEST1 / TEST2 / TEST3 are synthetic source fixtures only. Mode title should not be gratuitously printed as a large label above the compass.

## Technical interfaces

- `render(svg, state): status`, `computeDisplay(state)`, `model(state)`, `LAYOUT`, `REFERENCE`, `MODES`.
- Input contract extends current lab model with `selectedHeading`; flight heading, track, course remain independent.
- Render is event-driven, no frame polling. Each logical component has `data-segment` tags to support DOM audit.
- Invalid SG: early amber SG fail indication; no compass. Display power OFF: black field. Invalid track/heading in track-up: suppress derived nav geometry and show invalid reference; invalid NAV: withhold synthetic route. No stale data to be painted.
- PLAN route geometry cannot rotate with heading/track changes; the separate top 70° compass ticks respond to track. The north-up route-line coordinates are tested in Playwright.
- Map database WPT option (not route fixes) only when selected range ≤ 40 NM. Actual active route FIX labels not subject to WPT toggle.
- Four modes (`EXP_NAV`, `CTR_MAP`, `FULL_VOR_ILS`, `EXP_VOR_ILS`) are visible as **PENDING MODE REBUILD** instead of falling back to the rejected generic renderer. This is intentional and honest.

## Visual QA and acceptance gates

All 3 mode-specific displays must be tested at identical EHSI dimensions; criteria:

- [ ] Compare full-screen raster with **correct Classic** reference using transparency overlay, zoom and individually marked regions; no NG image or arbitrary SVG is sufficient.
- [ ] Verify top data fields, character widths, baselines, box outline, stroke thickness, caption spacing.
- [ ] MAP: arc top and endpoints; 70° ticks, 30°/10° labels, aircraft triangle, track line and half/quarter range positions.
- [ ] FULL NAV: rose radius, cardinal tick positions, fixed indexes, selected course pointer, CDI dots and the aircraft outline.
- [ ] PLAN: independent 70° expanded compass (FCOM 10.32.3), right-side N indication, true-north route and labels, heading bug with NO dashed line to an airplane.
- [ ] Verify magenta bug + reference line when selectable; suppress when outside MAP arc.
- [ ] Failure injection for SG1, SG2, transfer, NAV, track, heading and EHSI POWER.
- [ ] Run automated mobile/desktop browser screenshots and 3-mode visual hashes; inspect saved workflow artifacts.
- [ ] Obtain visual approval for each segment and preserve accepted bounding box + source/folio + actual reference sample. **Nothing is marked APPROVED automatically.**

After these gates, EADI and remaining EHSI presentations are separate milestones, not silent regressions.

### Source

- Boeing 737 Classic training-copy FCOM (explicitly marked DO NOT USE FOR FLIGHT): https://boredaviator.com/wp-content/uploads/2025/03/B737-300-FCOM-.pdf
- In-repository Classic EP-FSI EFIS control panel source map: `engine/efis-fcom-v2/`
- Existing owner-locked photo and legacy EHSI: `docs/EFIS_PHOTO_LOCK.md`, `cdu-standalone-v6/ehsi/`
