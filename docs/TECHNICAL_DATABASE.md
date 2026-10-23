# Technical Database — Boeing 737 sources

## Current product scope — Cockpit Systems & Procedures Trainer (2026-10-23)

The **active product goal** is interactive 737 Classic cockpit switching, system responses, injected faults/emergencies, indicators/audio, and state-aware Normal/Non-Normal checklist practice, **not** full-flight simulation. See [TRAINER_SCOPE.md](TRAINER_SCOPE.md).

The EP-FSI ASN 29340 scoped AFM dataset described below stays the **exact-tail performance reference**; its numerical-only lockouts are **not a project-wide implementation blocker**. Other 737 Classic serial/variant data may be used as **explicitly labeled simulator surrogates** for training logic. Unresolved numeric performance QA must not block unrelated switch/fault/checklist modules. Original source and QA records remain unchanged, and simulation tests never imply aircraft operational approval.

The shared technical research collection is named **Technical Database** (private user Library folder `/Technical Database`, formerly `/B737`). This is a source collection **separate from** the public simulator code repository. Source material must not be committed to this public repository without verified distribution permissions.

## Active AFM scope for simulator — EP-FSI / ASN 29340

**Only** Boeing 737-33V airframe serial **29340**, registration **EP-FSI** (registration supplied by project owner), is authorized for active AFM-derived performance extraction and future simulator consumption. Private active source: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v13/epfsi_afm_scoped_v13.sqlite`. Public non-proprietary pointer: `docs/AFM_EP_FSI_ACTIVE_SCOPE.json`.

Do **not** activate performance limits, CG curves, engine performance graphs or special appendices from other serial numbers. The original 978-page AFM and v1–v5 archives remain PRIVATE as immutable historical source records, not live aircraft data. The applicable CG chart is **Section 1 Page 3B (PDF p24)**. Installed engine **rating 20K (20,000 lbf) was confirmed by the owner** (not independently verified). The exact engine model **CFM56-3B-1** was subsequently confirmed by the owner (not independently corroborated by engine maintenance records). PMC installation/state and service-bulletin applicability remain **UNVERIFIED**. AFM PDF page 13 identifies Appendix 33 for CFM56-3 engines at 20K; model and rating are now owner-matched. Appendix 1UK is conditional on reduced-takeoff operation; Appendix 2UK is conditional on PMC OFF (CFM56-3-B1 spelling in the AFM). This is not independent proof of actual engine installation. **22K charts are not active; no N1 numerical performance function is engine-ready.** v8 reader refuses any ASN except 29340 and all unverified N1 calculations. No simulator runtime integration has been completed.

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

## EP-FSI v8 model specification (2026-10-23)

Owner explicitly reported installed engine **CFM56-3B-1** and previously confirmed **20,000 lbf / 20K** rating, for registration **EP-FSI**, ASN **29340**. The AFM names this variant **CFM56-3-B1** on Appendix Applicability (original PDF p13), and lists Appendix 33 for CFM56-3 series at 20K. Private active dataset is `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v8/epfsi_afm_scoped_v8.sqlite`. Historical v7 remains immutable. Appendix 1UK (reduced takeoff) and 2UK (PMC OFF) are conditional, not automatically applicable in all regimes. PMC hardware/state and service-bulletin effects remain unknown; N1 source curves are **not digitized/validated** and live CDU integration is still pending. Reader tests: **20 passed**. Public repo contains only status and identifiers, never Boeing proprietary manual content.

## Cross-variant surrogate data policy (owner approved, 2026-10-23)

For the **non-flight** 737 Classic simulator, the project owner explicitly authorizes using technical/performance data from a **different aircraft serial or 737 Classic variant** when an exact-tail value is absent. Do not block simulator prototyping merely because a source is not EP-FSI/ASN 29340. This is **not** an assertion that all variants have equivalent performance, and is **not** flight-approval or engineering validation.

Preferred source tiers: (0) EP-FSI / ASN 29340, CFM56-3B-1 20K exact source; (1) other 737-300 serial, matched rating and equipment; (2) other 737 Classic -400/-500 with the closest available engine/equipment; (3) Classic different rating/configuration, **SIM_APPROX_ONLY**. Preserve `source_id`, source model and serial, engine/rating, physical PDF page, assumptions, units, confidence, and `SIM_REFERENCE`/`SIM_SURROGATE`/`SIM_APPROX_ONLY` label in every borrowed record.

The 737-400/22K FPPM, including its listed **20K derate option**, can inform a simulator surrogate; do not infer numerical equivalence to the installed EP-FSI 20K engine, or rescale 22K data linearly without documented basis. GE Capital 737-300 WBM loading methods may inform prototype loading/CG logic, but its tail-specific empty weights and certified CG limits are **not** EP-FSI facts. Do not substitute 737NG numeric performance or control laws for Classic. Always prefer exact-tail AFM limits and preserve original source data unchanged.

**QA unchanged:** machine-extracted numbers, unlabeled source mismatches, table/plot digitization, and QRH control predicates still require source verification; engineering sign-off remains pending. The owner-provided flexibility changes **simulation surrogate selection**, not the outcome of Engineering QA V2 or flight-suitability status. Private canonical policy: `/Technical Database/SIMULATOR_VARIANT_FALLBACK_POLICY.json` with the policy echoed in `/Technical Database/SOURCE_REGISTRY.json`.

## EP-FSI N1 source selector v9

Original AFM R32 images were checked for takeoff N1 (PDF p128), go-around N1 (p129), maximum continuous N1 (p130) and alternate PMC OFF takeoff N1 (Appendix 2UK p756). Appendix 33 (p862–864) instructs use of the appropriate 20K N1 chart. Private v9 SQLite has 4 source records, 9 applicability guards, provisional axis-tick registrations and **zero approved N1 numeric curve points**. Public staged source-selection adapter: `engine/fmc/performance/afm-epfsi-n1-v9.cjs`, not connected to live CDU. Do not infer actual PMC state. Full curve digitization and independent review remain required. Preserve v8 as history.

## EP-FSI N1 v10 read-only CDU integration (2026-10-23)

Owner-provided airframe: EP-FSI ASN29340, CFM56-3B-1, 20K. The **private active** source is `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v10/epfsi_afm_scoped_v10.sqlite`. It preserves the original 978-page AFM and historical dataset versions. The v10 package has 6 phase/PMC chart routing entries, 11 source-indexed algorithm rules, 14 separate graph components, 15 **provisional** axis marks, and **zero** numerically approved N1 curve points. It corrects v9 PMC OFF Go-Around/Max Continuous: Appendix2UK only supersedes the Takeoff setting chart; other settings use baseline AFM.

Runtime: the N1 v10 source-routing module is bundled with `cdu-standalone/index.html`; pages **N1 LIMIT** and **TAKEOFF REF** show source status and no invented N1. Training-keypad manual N1 entries are labelled **MAN** and never treated as AFM calculations or autothrottle targets. The legacy CDU artwork remains unchanged. Numerical performance interpolation, BLEED/anti-ice tables and MCT nomogram remain **UNVERIFIED**; automatic calculated N1 is blocked. Unit tests 24 PASS and headless CDU state test PASS; full browser screenshot QA not verified. No Boeing charts or scanned proprietary data committed publicly.

## EP-FSI v11 provisional graph traces

Active private AFM index: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v11/epfsi_afm_scoped_v11.sqlite`. Only ASN 29340 and user-confirmed CFM56-3B-1 at 20K apply. AFM p128/p129 original scan yielded 26 labelled strokes and 104 provisional segment samples at -35, -30, -25, -20 °C. Two rasterizer passes of **the same** AFM source agreed; no independent human engineering signoff. Left-side trace segments do not form a complete operative N1 limit curve, and no bleed/PMC/anti-ice/multiaxis nomogram correction has been approved. All runtime numeric N1 must remain blocked; v10 CDU read-only source selection continues unchanged. Public interpolation code is trained/tested using synthetic test grids only. Evidence: `docs/AFM_EP_FSI_N1_V11.md`. Do not put private source images or sampled curves into the public repo.

## Private Technical I/O & Warning Logic Network V1 (2026-10-23)

The user requested a **machine-readable network of source-documented sensor/computer/control inputs, outputs and alarm activation rules**, persisted in the private Technical Database. The current non-destructive overlay is stored at:

- `/Technical Database/Technical-Network-V1/B737_TECHNICAL_NETWORK_V1.sqlite` — all **8 source manuals / 5,067 indexed pages** plus the original QA tables and curated graph metadata.
- `/Technical Database/Technical-Network-V1/B737_TECHNICAL_NETWORK_PRIVATE_BUNDLE.zip` — portable private bundle including the graph source records, offline visual explorer, GraphML and rule evaluator.
- `/Technical Database/Technical-Network-V1/NETWORK_EXPLORER_OFFLINE.html` — offline equipment I/O browser.
- `/Technical Database/Technical-Network-V1/README_FA.md` — Persian provenance and limitations.

**Verified database counts:** 91 graph nodes (including **26 lexical domain tags that are not physical equipment**), 104 typed ports, 56 documented functional signal edges, 43 source-located condition/effect rules (39 syntactically evaluable and 4 deliberately non-executable), 173 rule I/O symbols, 64 node-to-page reference links, 11 explicit source-gaps; **25 unit tests passed**. SQLite integrity, ZIP archive, and standalone network browser JavaScript syntax were checked. The general 16,817 ontology mentions stay **lexical search matches**, never treated as hardware wiring.

**Example:** Stall warning computer inputs documented in FCOM chapter 15 include AoA, air/ground, wing configuration, thrust and ADC output; signals connect to Stick Shaker, EFIS speed/pitch symbols, and GPWS windshear. The DCPCS functional drawing in FCOM chapter 2 shows N1/N2 through a stall management computer interface, but the specific source channel/pins/protocol are not identified. The **exact airborne stall AoA threshold/control law is not present in the indexed source and remains non-executable**. DCPCS ground N1/N2 prepressurization, taxi-in N1 opening and AUTO FAIL thresholds are recorded with source folios and qualifiers.

**Do not overclaim:** This is a **partial verified-provenance system network over complete source text**, not a completed wiring diagram, validated Boeing warning computer or exhaustive 737CL fault/checklist state machine. Original manuals remain private. `graph_consumer_bindings` are proposed destinations for existing cockpit/audio training engines, **not installed live integrations**. Full engineering review remains unresolved; use to continue source-grounded educational cockpit behavior development.

## EP-FSI v12 bleed correction source and MCT stages

Active private source: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v12/epfsi_afm_scoped_v12.sqlite`. The v12 image audit adds 10 bleed-correction curve IDs, **16 provisional numeric samples** from AFM R32 pp128–129, six source ordered Maximum Continuous procedure stages from PDF p130 and 12 graph-coverage slots including PMC OFF PDF p756. No N1 curves are certified for use: 0 new runtime-eligible values and 0 independent numeric signoffs. Use source-specific conditional selection from `engine/fmc/performance/afm-epfsi-n1-conditions-v12.cjs`, but keep actual engine/CDU/Autothrottle numeric output disabled. Previous v11's 104 preliminary main-chart points are retained. See `docs/AFM_EP_FSI_N1_V12.md`.

## Private Technical Network V2 — six-stage trainer slice (2026-10-23)

All eight proprietary source manuals stay in **private Library**. The V2 overlay is a non-destructive extension of the prior 5,067-page corpus at `/Technical Database/Technical-Network-V2/` (SQLite, portable ZIP, offline index explorer, QA logs). It adds 3,553 lexical equipment-name occurrences / 1,959 distinct candidate strings, 14 synthetic trainer fault records, 16 runtime mapping contracts, 10 educational scenarios and QA gates. **Candidate names do not mean validated unique hardware units.** Existing 91 V1 graph nodes (65 functional/equipment and 26 topic), 104 ports, 56 curated functional edges and 43 source-referenced warning conditions are preserved, not expanded to a complete wiring diagram.

Independent [systems integration lab](../systems-integration-lab/) connects real software switching to computed Electrical/Fuel/Hydraulic status, existing audio-warning event requests, DCPCS prepressurization and instructor-simulated Stall. The original picture-based cockpit and postponed network feature are unchanged. Missing physical bus routing, precise Stall AoA/control law, complete QRH, MP3 playback and image-hotspot mapping remain OPEN. See [TECHNICAL_NETWORK_V2.md](TECHNICAL_NETWORK_V2.md) for the stage breakdown and limits. Proprietary texts, source images and the semantic graph's source-bearing SQLite **are not uploaded to public GitHub**.

## EP-FSI v13 PMC OFF / Maximum Continuous

Private active database: `/Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v13/epfsi_afm_scoped_v13.sqlite` (SHA-256 `4ae7ccb80425ed337499a1b6303ec929f4ce86c171f1491bcaa81bc572d5d37c`). The private v13 source extraction includes first-pass 16 plot axis ticks, 46 UNASSIGNED source-image segments, 138 tentative x/y chart readouts (not associated with a verified altitude/curve), six typed MCT stages and nine locked release blockers. Source: EP-FSI AFM Appendix 2UK PDF p756 and Section 4.2/6 PDF p130. The source readouts are not independent engineering verification; do not promote them to a working N1 table. The 104 v11 takeoff/go-around samples and 16 v12 bleed samples remain historical PROVISIONAL. Public six-stage MCT arithmetic can be exercised with explicitly SYNTHETIC test fixtures only; normal request still returns BLOCKED. CDU v10 source status remains active and displays no automatic N1. See `docs/AFM_EP_FSI_N1_V13.md`.
