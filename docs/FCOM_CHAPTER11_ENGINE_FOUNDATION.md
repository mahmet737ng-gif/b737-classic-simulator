# 737CL Chapter 11 — engine groundwork (v0.1)

**محدودهٔ واقعی:** این بسته نقشهٔ صفحه‌به‌صفحهٔ ۴۰۹ صفحهٔ فصل ۱۱ FCOM سپهران و هستهٔ اولیهٔ event-driven و ۲۲ قاعدهٔ دارای ارجاع مستقیم به FCOM را دارد. **تمام ۴۰۹ صفحه هنوز خط‌به‌خط به رفتار اجرایی تبدیل نشده‌اند؛ انجین کامل FMC نیست.**

## فایل‌ها

- `reference/page-index.json`: 409 PDF pages 1414–1822 with printed folio, chapter section, text SHA-256, and private archive paths for text/PNG/SVG. Indexed from the complete 1937-page source archive in Technical Database. First 8 entries are Chapter 11 TOC.
- `reference/page-index.csv`: same page index as CSV.
- `reference/sections.json`: first page of each documented chapter section.
- `engine/rule-catalog.json`: 22 manually source-verified behavior descriptors (from pages 1424–1430). Source references *not* full page-by-page semantic conversion.
- `engine/fmc-core.cjs`: deterministic standalone FMC event reducer and partial scratchpad/EXEC/annunciator logic; no aircraft bus or actual navigation calculations.
- `tests/engine.test.cjs`: tests 409 page mapping, 22 evidence references, CDU event state transitions.

## FCOM scope

11.10 Controls and Indicators; 11.20 Navigation Systems Description; 11.30 Flight Management System Description; 11.31 FMS Operation; 11.32 FMC; 11.33 ACARS; 11.40 Preflight; 11.41 Takeoff/Climb; 11.42 Cruise; 11.43 Descent/Approach; 11.60 Messages.

## Acceptance criteria for real complete engine

Each page must be classified by table, schematic, paragraph, option/effectivity and concrete rules. Each rule must record inputs, guard conditions, state changes, annunciations, outputs, exceptions, FCOM folio, PDF page, and variants. Add tests exercising all positive and negative conditions, a per-page review signoff, and integrate in `cdu-standalone` only after tests. Page indexing alone ≠ full study; full flight/performance/navigation logic is not implemented.

Full Boeing proprietary page contents, raster/scans and figures are **not** copied to the public GitHub repo; they stay in private Technical Database. 

Run `node tests/engine.test.cjs`.