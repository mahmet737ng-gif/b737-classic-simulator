# CDU Hotfix v5.2 — 2026-10-23

- The right-hand CDU screen text is aligned to its own LSK column, right-justified at the inner right edge of the screen (from R1 through R6). The left-hand text uses its own independent left-justified column.
- The 12 LSK click boxes were traced against the native 1199×1312 approved photograph; all six left/right rows have matching physical centers.
- The 12 numeric keypad click boxes were realigned to the dark button faces.
- Preserved the approved image without alteration and preserved the v5.1 EXEC lamp correction and the v5 EHSI prototype.
- Tests: `node tests/ehsi-modes.test.cjs`; `node tests/page-fields.test.cjs`; `node tests/v3-browser-dom.test.cjs`; `node tests/v5-1-fixes.test.cjs`; `node tests/v5-2-layout.test.cjs`.
- Chromium interactive screenshot validation in this sandbox is not claimed: it must be checked in Edge by the user.
- Training-only; field locations and FMC logic not yet fully FCOM validated.