# CDU standalone beta release

Standalone trainer committed as `cdu-standalone/` with a byte-identical approved background image and 70 independently mapped physical controls.

Local Node.js unit tests pass; native Chromium E2E browser automation is blocked by sandbox policy. FCOM Chapter 11 indexed, full page texts retained in the private Technical Database archive and not publicly committed.

Deployment via repository GitHub Pages workflow, if it runs successfully, is at `/b737-classic-simulator/cdu-standalone/`.

## v2 Fix Pass (2026-10-22)
- Approved CDU photo SHA-256 unchanged; source-backed CALL/FAIL/MSG/OFST illumination masks and corrected EXEC bar.
- 70 independently mapped controls with calibrated R-LSK, LSK L4-L6, right alphabet column, and SP/DEL/SLASH/CLR.
- Opaque FMC framebuffer prevents old photographic text bleed-through even when dimmed. 24-column typography uses Lucida Console first, with fit-safe spacing and separate page header.
- Test: `node cdu-standalone/tests/smoke.test.cjs` and `node cdu-standalone/tests/v2-layout.test.cjs` PASS locally. Browser E2E unverified because sandbox blocks file and localhost URLs.
- Standalone CDU update only; main cockpit interface has not been altered.
