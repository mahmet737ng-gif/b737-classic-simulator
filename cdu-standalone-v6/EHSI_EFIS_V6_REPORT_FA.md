# Boeing 737 Classic — EHSI / EFIS Control Panel v6

**Reference:** Sepehran B737-300/400/500 FCOM, Volume 2, Chapter 10, pages 10.30.2–10.30.5 and 10.40.9–10.40.13 (source PDF pp. 1322–1325 and 1408–1412). Applicable EFIS variant must match actual installed aircraft configuration (FCOM 10.30.1).

## Delivered
- Rectangular EHSI display (SVG 440×440 within an oblong rectangular instrument bezel), replacing the former circular standalone visualization.
- EFIS control panel with interactive DH REF, reset, EADI brightness, two concentric controls for EHSI outer/WXR inner brightness, seven mode detents, six range detents, TFC/WXR, VOR/ADF/NAV AID/ARPT/RTE DATA/WPT and TERR.
- Real modes’ orientation rules: MAP, CTR MAP and NAV use track-up, VOR/ILS uses heading-up, PLAN uses true north. All modes show correctly differentiated arc/rose geometry.
- Route overlay remains dependent on CDU staged→ACTIVATE→EXEC, and only if SIM ROUTE is deliberately enabled; synthetic geometry is labeled non-navigational.
- EHSI supports explicit invalid-data, no-nav-data and SG-failure states and no fake live radar returns.
- Independent radar brightness values and weather switch gates; EADI brightness held in state only (no EADI yet).
- Unchanged approved CDU image and v5.2 clickable key mapping.

## Tests
- Node-based EHSI mode and state logic tests passed.
- Actual Chromium DOM loaded without JavaScript errors, physical panel responded to mode/range selections.
- Other chapters of FCOM, full navigation database, sensor inputs, TCAS and WXR weather radar returns are **not implemented**.
- Original FCOM diagrams and scans are intentionally not uploaded into this public repo.

## Engineering limitations
**Training-only.** This is a visual/input simulation, not a complete approved EHSI. Final pass requires literal page- and indicator-by-indicator FCOM acceptance and physical EFIS panel mechanical geometry calibration; source chapter contains variant-dependent options. All test sensor controls explicitly labeled SIM.