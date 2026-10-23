# B737-CLASSIC-CDU — canonical project reference

Repository: `mahmet737ng-gif/b737-classic-simulator`  
Project: **B737 Classic Simulator**  
Component: **B737 Classic — CDU/FMC**  
Short reference for future chats/agents: **`B737-CLASSIC-CDU`**.

Before developing or changing the CDU, inspect the repository's current code and relevant Chapter 11 manuals/technical database. The current integrated CDU test is in `cdu-standalone-v6/`; the separately approved physical CDU and Chapter 11 engine are under `engine/ch11/`. Legacy versions `cdu-standalone/`, `cdu-standalone-v3/`, and `cdu-standalone-v5/` are retained, not to be silently replaced or redesigned.

### Approval invariants

1. Keep the approved physical CDU image and button/hitbox positions unchanged unless the user requests alterations.
2. **Typography is locked** per [CDU_FONT_LOCK.md](CDU_FONT_LOCK.md): `BoeingCDU-Large.ttf` and `BoeingCDU-Small.ttf` for all CDU screen text.
3. Preserve independent CDU behavior, the Chapter 11 page model, current navigation and performance engine integration, and the difference between simulated estimates and AFM-certified figures.
4. Coordinate simultaneous work from different chats using the current repository tree/commit as the source of truth; do not assume a past chat's claimed completion is already published.
5. Do not change unrelated cockpit, EFIS, Android, iPad, JeppIran, or web app components implicitly.

Direct test entry point: `cdu-standalone-v6/index.html`.  
Font acceptance test: `node tests/cdu-font-lock.test.cjs`.

## IDENT startup and preflight policy — FCOM 11.31.2 (23 October 2026)
On startup or reset, the CDU initially displays **IDENT**; the FMS flight phase is separately **PREFLIGHT**. The INIT/REF key opens the INDEX page, where IDENT is selectable; IDENT R6 offers POS INIT. Page navigation does not itself change the flight phase.

The existing IDENT fields are **provisional**. Their exact positions and values require page-by-page comparison against FCOM Chapter 11; they are not approved final text. The approved front-panel bitmap, 70 control hitboxes and locked BoeingCDU Large/Small fonts are unchanged.

## VNAV takeoff/climb behavior (FCOM 2022)

Source-indexed design: [CDU_VNAV_TAKEOFF_CLIMB_2022.md](CDU_VNAV_TAKEOFF_CLIMB_2022.md) and [source requirements](../engine/ch11/vnav-takeoff-climb-2022.rules.v1.json). Five vertical-profile milestones, constraints ABC/BCD/CDE, N1/automatic variant separation, VNAV SPD/PTH, ENG OUT restrictions, T/C display, and UNABLE NEXT ALTITUDE warning are recorded as **requirements only**. Do not claim completed flight guidance based on source ingestion.

## MCP interventions, cruise and VNAV descent (FCOM pp. 11.31.26–11.31.32)

2026-10-23 source ingestion: 76 source-backed *requirements only*, variants gated for EP-FSI. Scope: MCP ALT/Speed Intervention, CRZ/STEP/ECON, T/D/E/D, DES PTH/SPD, deceleration points, LNAV cross-track relationship, warnings. See [the Persian source review](CDU_FMC_MCP_CRUISE_DESCENT_VNAV_2022_FA.md) and [the structured interface contract](../engine/ch11/vnav-mcp-cruise-descent-2022.rules.v1.json). These records do not activate an unverified VNAV/AFDS implementation.

## VNAV geometric descent, approach and speed descent (FCOM 2020, 11.31.33–37)

Source-only extraction: **42 requirements**, 5 user-provided screenshots (PDF pages 1522–1526), figure with seven numbered stages, option-dependent TO/GA behavior, E/D gate, LNAV independence for speed descent, SPEED/PATH CDU prompt routing, geometric thrust variant and path reversion caveats. Refer to [Persian page-by-page report](CDU_VNAV_GEOMETRIC_SPEED_DESCENT_2020_FA.md) and [machine-readable requirements](../engine/ch11/geometric-vnav-speed-descent-2020.rules.v1.json). No runtime code or approved physical CDU/font asset was changed.

## VNAV Speed Descent, Early Descent, Vertical Angle, Approach and Go-Around (FCOM 2020/2022)

Source-only extraction from 8 screenshots of PDF viewer pages 1527–1529 and 1531–1535. **Viewer page 1530 not provided**. 69 conditions/effects with variant/effectivity gates, including DES NOW/CAPTURE, vertical angle legs, approach logic and missed-approach FMC state updates. [Persian source review](CDU_VNAV_SPEED_APPROACH_GOAROUND_2020_FA.md) · [machine-readable contracts](../engine/ch11/vnav-speed-approach-goaround-2020.rules.v1.json). **No runtime VNAV commands were implemented; physical CDU and approved font bytes remain locked.**

## FCOM 2020 Engine Out Cruise, RTA and shared CDU data-entry rules

Screenshots PDF viewer **1536–1540** / printed pages **11.31.47–11.31.51** reviewed: 56 source-only input/condition/output contracts. Covers CRZ→ENG OUT CRZ, advisory drift-down, alternate speed branches, crew MCP/A/T actions kept independent, RTA target/unachievable advisory, common ALT/IAS/MACH/slash/bearing/signed-entry grammars with example test vectors. Refer to [review](CDU_ENGINEOUT_RTA_DATAENTRY_2020_FA.md) and [machine-readable contract](../engine/ch11/engineout-rta-dataentry-2020.rules.v1.json). Performance equations and aircraft option effectivity remain unverified; no executable FMC or font/bezel changes performed.

## FCOM Chapter 11 Section 32 — FMC Databases, Thrust, Fuel and Failure Modes (2013–2023)

Eight uploaded screenshots (PDF viewer pages **1542–1549**, printed folios **11.32.1–11.32.8**) indexed with page-specific revision provenance and 112 **reference-only** source rules. Scope: two 28-day nav cycles, temporary/supplemental capacity and lifecycle, N1 thrust reference, derates/reduced climb, fuel reserve/discrepancy messages, 10-second power interruption, dual FMC source select, U10.8A degraded exception recovery. [Persian report](CDU_FMC_DATABASES_THRUST_FUEL_FAILURES_2013_2023_FA.md) and [rule/source registry](../engine/ch11/fmc-databases-thrust-fuel-failures-2013-2023.rules.v1.json). Source ingestion is not runtime implementation. CDU image, hitboxes and font files unchanged.

## FCOM Chapter 11 §40 — FMC Preflight, Prompt Chain and INIT/REF INDEX

Four uploaded screenshots PDF viewer **1553–1556**, printed **11.40.1–11.40.4**, page-specific 2011/2017/2020 revisions, document 41 source-only contracts. IDENT→POS INIT→RTE→ACTIVATE→EXEC→PERF INIT then **optional N1 LIMIT step depending on illustrated variant**, and TAKEOFF REF. DEP/ARR has no automatic prompt; all missing mandatory values must be locatable via TAKEOFF REF. ACARS/manual precedence, INIT/REF INDEX, cruise/route/descent forecast inputs are separately captured. [Persian page review](CDU_FMC_PREFLIGHT_SECTION40_2011_2020_FA.md) · [machine-readable contract](../engine/ch11/fmc-preflight-section40-2020.rules.v1.json). **No runtime page changes or font/CDU hitbox changes.**

## FCOM 2022 §11.40.6–11.40.9 — Exact INIT/REF INDEX & IDENT LSK Map

Four source screenshots PDF viewer **1558–1561**, FCOM printed folios **11.40.6–11.40.9** (15 Dec 2022), yield 43 page-anchored reference rules and explicit left/right LSK layout. `INIT/REF INDEX 1/1`: left 1–5 IDENT/POS/PERF/TAKEOFF/APPROACH, 6L OFFSET is mentioned in text but absent from figure; R1 NAV DATA, R6 MAINT on ground or NAV STATUS in flight. `IDENT`: MODEL, NAV DATA, OP PROGRAM, ENG RATING, ACTIVE/INACTIVE/SUPP DATE and POS INIT. Database swap **ground-only**, by selected date→scratchpad→ACTIVE, clearing previous route; cycle stays active after in-flight expiry. EP-FSI project's engine-rating default **20K** is separate from FCOM sample placeholders. [Persian review](CDU_FMC_PREFLIGHT_INDEX_IDENT_2022_FA.md) · [exact LSK and input/output registry](../engine/ch11/fmc-preflight-initref-ident-2022.rules.v1.json). **Source-only. Current runtime INDEX/IDENT text still requires alignment; frozen CDU artwork/hitboxes/font binaries not changed.**

## FCOM §11.40.11–11.40.17 — POS INIT / POS REF

Six screenshots PDF viewer pages **1563–1566 and 1568–1569** (printed folios **11.40.11–11.40.14 and 11.40.16–11.40.17**) reviewed and recorded as **53 source-only rules**. **PDF page 1567 / printed 11.40.15 is missing and was not reviewed.** The `POS INIT 1/3` LSK map is LAST POS 1R, REF AIRPORT 2L, GATE 3L, SET IRS POS 4R, GMT 5L, SET IRS HDG 5R, INDEX 6L and ROUTE 6R. IRS initialization, 4 NM **Origin Airport** VERIFY POSITION, ENTER IRS POS, ATT-mode heading, ground clock variants and gate clearing at lift-off are specified. The `POS REF 2/3` variants distinguish IRS R **3L vs 4L**, GPS-equipped source columns, radio validity and FMC/IRS ground speeds. [Persian page report](CDU_FMC_POS_INIT_POS_REF_2013_2020_FA.md) / [machine-readable source rules](../engine/ch11/fmc-preflight-posinit-posref-2013-2020.rules.v1.json). **Nothing in the live application, CDU geometry, hitboxes or immutable BoeingCDU font assets is modified by this source-ingestion update.**

## FCOM §11.40.21–11.40.33 — RTE / VIA-TO / DEP-ARR INDEX

Nine user-provided screenshots of PDF viewer pages **1573, 1576 (twice), 1579, 1581–1585**, covering visible parts of printed FCOM **11.40.21, 11.40.23–11.40.33**, were distilled into **96 source-only rules**. Page 11.40.22 and nonvisible surrounding paragraphs were not assumed reviewed. RTE first-page LSKs: origin L1, dest R1, CO ROUTE L2, FLT NO R2, runway L3, ACTIVATE R6, MOD ERASE L6. Route activation remains a two-step **ACTIVATE→EXEC** operation with ACT/MOD titles. Subsequent RTE VIA/TO pages validate airway continuity, DIRECT entries, and route discontinuity. DEP/ARR INDEX LSK mapping is DEP origin L1, DEP OTHER L6, ARR origin R1, ARR destination R2, ARR OTHER R6; OTHER airport procedure data is view-only when that airport is not on route. [Persian source analysis](CDU_FMC_RTE_DEPARR_2020_2022_FA.md) · [machine-readable contract](../engine/ch11/fmc-preflight-rte-deparr-2020-2022.rules.v1.json). **No live/runtime screen changes, font modifications or CDU button map changes in this source-ingestion stage.**

## FCOM §11.40.34–11.40.43 — DEPARTURES / PERF INIT / PERF LIMITS

Nine additional user-supplied FCOM screenshots (PDF viewer **1586, 1587, 1589–1595**) cover printed **11.40.34, 11.40.35, 11.40.37–11.40.43**; **11.40.36 was not supplied**. **33 DEPARTURES source rules** (SID/runway filtering, compatible transitions, route MOD/EXEC/ERASE and <SEL>/<ACT> state markers) plus **70 PERF INIT/PERF LIMITS source rules** were recorded. Three distinct **PERF INIT 1/2** variants are preserved (FUEL/N1 LIMIT, PLAN/FUEL/ACARS/N1 LIMIT, and FUEL/TAKEOFF); **PERF LIMITS 2/2** supplies CLB/CRZ/DES IAS-Mach bounds for ECON/RTA. Example values in the manual are not project performance defaults. [Persian source analysis](CDU_FMC_DEPARTURES_PERFINIT_LIMITS_2020_2023_FA.md) · [DEPARTURES rules](../engine/ch11/fmc-preflight-departures-2020-2022.rules.v1.json) · [PERF INIT/PERF LIMITS rules](../engine/ch11/fmc-preflight-perfinit-limits-2020-2023.rules.v1.json). **Source-only ingestion: no live UI changes and no edits to approved imagery, 70-button geometry, or BoeingCDU font binaries.**
