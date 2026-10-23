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
