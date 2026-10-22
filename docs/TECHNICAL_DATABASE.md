# Technical Database — Boeing 737 sources

The shared technical research collection is named **Technical Database** (private user Library folder `/Technical Database`, formerly `/B737`). This is a source collection **separate from** the public simulator code repository. Source material must not be committed to this public repository without verified distribution permissions.

## Active AFM scope for simulator — EP-FSI / ASN 29340

**Only** Boeing 737-33V airframe serial **29340**, registration **EP-FSI** (registration supplied by project owner), is authorized for active AFM-derived performance extraction and future simulator consumption. Private active source: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v7/epfsi_afm_scoped_v7.sqlite`. Public non-proprietary pointer: `docs/AFM_EP_FSI_ACTIVE_SCOPE.json`.

Do **not** activate performance limits, CG curves, engine performance graphs or special appendices from other serial numbers. The original 978-page AFM and v1–v5 archives remain PRIVATE as immutable historical source records, not live aircraft data. The applicable CG chart is **Section 1 Page 3B (PDF p24)**. Installed engine **rating 20K (20,000 lbf) was confirmed by the owner** (not independently verified). The exact engine model, PMC installation and service-bulletin applicability remain **UNVERIFIED**. AFM PDF page 13 identifies Appendix 33 for CFM56-3 engines operated at 20K; this is only a rating match, not an independent engine-model identification. **22K charts are not active; no N1 numerical performance function is engine-ready.** v7 reader refuses any ASN except 29340 and all unverified N1 calculations. No simulator runtime integration has been completed.

## Available reference corpora

| Source ID | Document | Coverage | Authority | Archive state |
|---|---|---|---|---|
| `AFM-73733V-D6-8730.33V-R32-20180214` | Sepehran 737-33V FAA-approved AFM R32 | 978 pages, 1,148 PDF bookmarks; 159 native-text pages and 819 scanned pages | Aircraft-specific performance / limitations / effectivity; **not** a generic Classic model | Private Library original + versioned SQLite/page archive; scanned OCR marked unverified |\n| `FCOM-SEPEHRAN-1937` | Sepehran Airlines Boeing 737 Classic FCOM | 1,937 pages | Primary configuration-tailored systems reference | Private Library full-text, images, vector pages and SQLite archival extraction; semantics QA remains |
| `TD-MRG-CL-NG-2007-PP009-398` | Pat Boone *737 Management Reference Guide* CL + NG | Source PDF pages 9–398, 390 pages | **Secondary, non-approved** guide | Private Library: 390 original full-page JPEGs, 390 OCR text files, 390 word-position JSONs, SQLite FTS5, 29 heuristic table CSV candidates, topic index and standalone offline viewer |

Technical Database Library path: `/Technical Database/Sources/TD-MRG-CL-NG-2007-PP009-398/`.

The MRG original full-page scanned JPEG preserves every table, schematic and illustration **visually**. Only 29 candidate tables were automatically segmented into CSV; the remainder of the tabular content is preserved in text/OCR and original page images, NOT asserted to have cell-accurate structured extraction. OCR and diagram semantics are not manually validated.

**Rules for future chat sessions:**
1. Search the private Library folder by the explicit name **Technical Database**, then query the indexed full text / archive.
2. Always cite `source_id`, physical PDF page, and variant CL or NG where explicitly applicable.
3. FCOM takes precedence over any potentially out-of-date practical advice in MRG; never silently merge 737NG equipment logic into the Classic simulator.
4. Add new manuals as separate versioned source folders, each with a `manifest.json` and indexed corpus. Keep copyrighted complete source scans private.
5. The public simulator GitHub repo remains `b737-classic-simulator`. The current GitHub connector cannot create a new private repository; the **Technical Database** name applies to the persistent private Library collection at present.

## AFM / cross-system provenance

Private source: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/`. Original PDF and complete native extraction MUST remain private. Each consumer (FMC performance, engines, fuel, AFDS, avionics, braking, warning, CDL) should use `AFM-73733V-D6-8730.33V-R32-20180214` plus physical PDF page, original printed folio, airplane serial/effectivity, engine rating, appendix, units and validation status. The original PDF remains the authority for all scanned performance graphs. Do not blindly convert OCR chart numbers into FMC tables or overwrite aircraft configuration defaults without explicit QA. Appendix 43 affects ASN 29339 subject to SB 737-71-1884. Public repository has only registry/status, no Boeing source PDF or full-page reproductions.

## Additional operational and performance manuals (2026-10-23)

The **private** Technical Database in user Library now includes the following three separately indexed sources. **Original manuals, their complete texts, figure layouts, and SQLite databases must not be published in this public repo**.

| Source ID | Type | PDF pages | Applicability | Ingestion QA |
|---|---|---:|---|---|
| `QRH-SEPEHRAN-D6-27370-3-500-SEP-20161216` | QRH | 584 | Airline-specific 737 Classic; confirm effectivity for each procedure | All pages text/layout indexed; checklist state machines pending verification |
| `WBM-GECAP-D043A530-GEF1-R21-20151218` | Weight & Balance | 282 | GE Capital 737-300; specific serial/configuration, not generic | All pages indexed; 93 table **candidates**; limits, cells, and charts not yet validated |
| `FPPM-737400-CFM56-3-22K-D632A004-KG404-R8-20120727` | Flight Planning/Performance | 174 | 737-400 CFM56-3 22K, CAT A/B brakes, FAA, 20K derate option | All pages indexed; 84 table **candidates**; chart data not validated |

Private base location: `/Technical Database/Sources/<source_id>/`. Each folder contains `ORIGINAL_SOURCE.pdf`, `PRIVATE_FULL_ARCHIVE.zip`, `SEARCHABLE_FULL_TEXT.txt`, `TECHNICAL_INDEX.sqlite`, `TOPIC_MAP.jsonl`, `STRUCTURED_CANDIDATES.jsonl`, `QA_BACKLOG.json` and `manifest.json`. Unified private search: `/Technical Database/B737_QRH_WBM_FPPM_SEARCH_DATABASE_PRIVATE.sqlite`. Registry: `/Technical Database/SOURCE_REGISTRY.json`, which also includes the existing AFM, FCOM, MRG and two FCTM sources.

All **1,040 new PDF pages** are machine-archived with provenance and full-text search; **zero** pages have human semantic sign-off. Candidate table parsing and keyword topic tags are **not approved simulator rules**. Do not apply WBM 737-300 load limits or FPPM 22K engine performance to a different aircraft/serial/rating. Flight safety, applicability, primary approved AFM and configured FCOM/QRH precedence must be maintained.

## Semantic Index V1 (2026-10-23)

**Private Library database is now present and verified at** `/Technical Database/Semantic-Index-V1/`.

- Bundle: `B737_SEMANTIC_PRIVATE_BUNDLE.zip` (private, includes the source-text-bearing SQLite index).
- Query DB: `B737_TECHNICAL_SEMANTIC_INDEX.sqlite` (SQLite + FTS5).
- Accompanying files: `query_technical_db.py`, `README_FA.md`, `SEMANTIC_AUDIT.json`, `ONTOLOGY_AUDIT.json`, `manifest.json`.
- Global private source registry: `/Technical Database/SOURCE_REGISTRY.json`.

| Machine ingestion criterion | Verified count |
|---|---:|
| Source manuals | 8 |
| Distinct source pages indexed | 5,067 |
| Section keys / inferred groups | 1,274 |
| Paragraph/segment records | 33,767 |
| Structured semantic candidates | 7,503 |
| Domain ontology concepts | 26 |
| Lexical system-concept mentions | 16,817 |
| Candidate tables (NOT independently cell-verified) | 206 |
| QRH branch expression candidates | 371 |
| Additional in-text condition candidates | 1,339 |
| Open prioritized QA issues | 1,019 |
| Engineer-approved rules / source-page signoffs | **0** |

**Crucial qualification:** All-source **page coverage** and machine **semantic categorization** are complete, but the interpretation is **not validated**. The database is not a finished control-law, sensor graph, FMC performance table, or executable QRH fault/warning engine. Source-passage tags and detected conditions must be checked against the correct printed folio, model, serial/configuration, original page, notes, and figures. The AFM's explicit user-confirmed conversion erratum (page 18, 105000 lb / 47627 kg versus raw 7627 kg) is a separate non-approved overlay; it must not overwrite the original AFM. The FCOM source also contains an invalid calendar date on its first-page extraction, flagged for verification.

**Agent retrieval policy:** Search the user's **private Library** by the exact path `/Technical Database/Semantic-Index-V1` or materialize its SQLite/bundle for machine queries. The GitHub repository does **not** contain or expose the Boeing-proprietary source text. Distinguish `pdf_page` (local indexed position) from `original_pdf_page` (physical page; MRG maps 1..390 to 9..398). Never claim that every future chat has direct access unless the private Library is accessible in that session.

## Engineering QA V2 (2026-10-23)

The private Technical Database now has a **machine engineering-preflight/QA overlay** in `/Technical Database/Engineering-QA-V2/` (bundle `B737_ENGINEERING_QA_V2_PRIVATE.zip`, report `ENGINEERING_QA_REPORT_FA.md`). Source text and proprietary tables are **not committed** to this public repository.

- Audited: **8 references / 5,067 indexed pages**; **87,693** deterministic structural, provenance and document-alignment assertions.
- All 5,067 page positions present; 33,767 segment references, 7,503 extracted item links, 16,817 ontology mentions, and 172 relationship references structurally consistent.
- Local native-PDF cross-check (1,762 pages) after order-tolerant comparison: **1,488 pass, 244 warning, 30 fail/needs investigation**. Ten MRG OCR-image pages have insufficient text and also remain open.
- **6** QRH table-of-contents excerpts rejected as false positive branches. **2** FPPM tables (PDF pages 18 and 21) identified as missing from the earlier automated table inventory.
- **9,419** candidate item/table/flow entities protected by release gates; 11 pages visually spot-checked, 10 small rows/values visually transcribed but still **not approved for simulation laws**.
- Existing **1,019** open QA issues remain; **14** added high-priority blocker categories are tracked. **Engineer-signed operational rules: zero.**

**Release policy:** `operational_use=BLOCKED` is mandatory until model/engine/aircraft serial effectivity, full graph and numeric table readings, QRH path predicates and applicable primary AFM/FCOM hierarchy are independently verified. Automated cross-reference validation is **not** an engineering certificate; flight use is prohibited. This overlay is non-destructive and does not overwrite either original source pages or Semantic Index V1.

## EP-FSI v7 (20K) update

User explicitly confirmed EP-FSI ASN 29340 installed engine thrust rating is 20K. The private versioned SQLite file and read-only adapter store the owner assertion separately from aircraft documentation. Exact engine variant remains unverified; 20K is not evidence of -3B-1 or -3C-1. Appendix 33 is rating-matched but engine-specific N1/PMC data remain conditional and numeric performance calculations remain blocked. Superseded private v6 and original AFM are preserved.
