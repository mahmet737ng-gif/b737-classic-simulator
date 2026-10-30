# FCOM Vol.2 Chapter 11 — Implementation state, 2026-10-22

- Original confidential source: Sepehran Airlines 737 Classic (300/400/500), D6-27370-300/400/500-SHI.
- 409 original PDF physical pages **1414–1822** are source-indexed with 29,546 geometrically positioned lines, 29,643 text spans, 142 unverified machine-detected table candidates. Source PNG/SVG pairs verified present for all 409 pages, PRIVATE Technical Database.
- 46 SELECTED FCOM-folio-linked design requirements across 28 individual PDF pages. 36 rules have initial scaffolding/logic, 10 remain not fully implemented. No claim of chapter-wide semantic signoff.
- 17 page identifiers with training shells and selected interactive fields. These are NOT actual completed FMC 409-page navigation logic.
- `engine/ch11/engine.js`: deterministic standalone reducer. `engine/ch11/tests/ch11-engine.test.cjs`: tested transaction semantics, keys/LSK, 24-char x 14-row text, source-anchored validators, message priorities, five annunciators.
- `cdu-standalone/ch11-lab/`: static test UI using same locked CDU artwork and v2 70-control bitmap coordinate map. Existing simulator and v2 standalone not changed.
- All Boeing original verbatim page text, paragraph geometry, table rows and images kept PRIVATE in `Technical Database / Sources / FCOM / Chapter 11` (or existing FCOM source library); public repo has original engineering code and source IDs only.
- Unimplemented: validated row/column screen layouts for every aircraft/software option; FMC nav database; IRS/GPS/radio-navaid solvers; LNAV/VNAV; thrust/performance calculations; cross-FMC sync; ACARS; weather radar; aircraft failure coupling; manually verified message tables.
- Browser E2E in current sandbox blocked (`ERR_BLOCKED_BY_ADMINISTRATOR`); Node.js engine and Python index integrity checks PASSED. Never claim E2E pass.

See `engine/ch11/docs/ENGINE_BLUEPRINT_FA.md` for implementation architecture and remaining per-page acceptance criteria.
## Update — 2026-10-30 (Unified v6 CDU and systems bridge)

The historical 17-page Chapter-11-v2 training shell noted above remains distinct from the active **CDU standalone v6 / Unified** screen renderer.

- FCOM source index remains **409 physical Chapter 11 pages**; no automatic sign-off of all graphical tables or software variants.
- Source TOC screen candidates: **45**; currently wired v6 screen definitions: **37** (including newly introduced POS SHIFT), each with up to 12 LSK slots. Full provenance and navigation graph: `engine/ch11/cdu-page-audit.v1.json`.
- Review pass for IDENT/POS INIT/POS REF/POS SHIFT and preflight page labels; FCOM line-by-line verification for every screen is **NOT DONE**.
- Source-gated electrical/CB integration and read-only IRS↔FMC↔MCP/AFDS/A/T: `engine/ch11/fmc-systems-network-v1.js`, `panel-mosaic-lab/cockpit/fmc-systems-bridge-v1.js`; no verified EP-FSI bus-to-breaker feed topology.
- Green monochrome screen text confined to Unified CDU; approved artwork, font binaries, key mapping unchanged.
- Detailed acceptance constraints and evidence: `docs/CH11_CDU_FMC_SYSTEMS_AUDIT_2026-10-30_FA.md`.
