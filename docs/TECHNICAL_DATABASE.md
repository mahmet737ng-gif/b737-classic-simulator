# Technical Database — Boeing 737 sources

The shared technical research collection is named **Technical Database** (private user Library folder `/Technical Database`, formerly `/B737`). This is a source collection **separate from** the public simulator code repository. Source material must not be committed to this public repository without verified distribution permissions.

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
