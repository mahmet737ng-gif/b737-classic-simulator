# Phases 1 and 2 — Classic 737 Guarded-Switch FCOM and Hardware Audit
**Date:** 2026-10-26  
**Scope:** Boeing 737-300/400/500 Classic, simulated cockpit, not authorized for real flight.  
**Phase 1:** Completed FCOM textual extraction for all identified cockpit guarded controls in the available Sepehran FCOM.  
**Phase 2:** Completed current-asset visual triage and discrepancy inventory. **Photographic aircraft-variant verification remains open.**  
**Machine register:** `engine/maps/guarded-switches-fcom-visual-audit-v1.json`

## Unambiguous counts
- **17 cockpit control identities** documented by FCOM as guarded/protected, of which **12** currently exist in interactive guarded-switch registries and **5** are not installed there.
- **1 additional red guarded cabin crew switch** for aft flight attendant EMER EXIT LIGHTS is **outside cockpit scope**, so not included in the 17.
- **6 internal top-versus-bottom hinge mismatches** exist between `flight-controls-panel/fcom-controls-registry.json` and the installed original-approved bottom-hinge artwork: FLT CONTROL A/B, SPOILER A/B, ALT FLAPS MASTER, EMER EXIT LIGHTS. This establishes conflicting code metadata, **not the real aircraft hinge orientation**.
- **0 of 17** currently satisfy hardware visual certification, because authenticated same-variant open/closed photos, exact hinge sweep and millimetre dimensions have not been established.

## Phase 1 — FCOM controls and indicators inventory
| # | Control | Location | FCOM positions (or action) | Protected position | FCOM folio | Current photo/hardware disposition |
|---|---|---|---|---|---|---|
| 01 | FLT CONTROL A | OH07 | STBY RUD / OFF / ON | ON | 9.10.1 | CONFLICT — internal hinge records |
| 02 | FLT CONTROL B | OH07 | STBY RUD / OFF / ON | ON | 9.10.1 | CONFLICT — internal hinge records |
| 03 | FLIGHT SPOILER A | OH07 | OFF / ON | ON | 9.10.2 | CONFLICT — internal hinge records |
| 04 | FLIGHT SPOILER B | OH07 | OFF / ON | ON | 9.10.2 | CONFLICT — internal hinge records |
| 05 | ALTERNATE FLAPS MASTER | OH07 | OFF / ARM | OFF | 9.10.2–9.10.3 | CONFLICT — internal hinge records |
| 06 | BATTERY MASTER | OH10 | OFF / ON | ON | 6.10.5 | HARDWARE NOT VERIFIED |
| 07 | GEN DRIVE DISCONNECT 1 | OH11 | DISCONNECT action; physical detents unknown | not specified | 6.10.6 | OH11 aperture mapped only |
| 08 | GEN DRIVE DISCONNECT 2 | OH11 | DISCONNECT action; physical detents unknown | not specified | 6.10.6 | OH11 aperture mapped only |
| 09 | STANDBY POWER | OH11 | BAT / OFF / AUTO | AUTO | 6.10.7 | dedicated horizontal housing, unapproved |
| 10 | EMER EXIT LIGHTS | OH14 | OFF / ARMED / ON | ARMED | 1.30.9; 1.40.5 | CONFLICT — internal hinge records |
| 11 | PASSENGER OXYGEN | UPPER | NORMAL / ON | NORMAL | 1.30.20–1.30.21; NP.21.3 | HARDWARE NOT VERIFIED |
| 12 | FLIGHT RECORDER TEST | UPPER | TEST / NORMAL | NORMAL | 10.10.20 | LEFT hinge per owner; browser unverified |
| 13 | BUS TRANSFER | OH12 | OFF / AUTO | AUTO | 6.10.9 | MISSING live guard |
| 14 | ANTISKID | CENTER_INSTRUMENT | OFF / ON | ON | 14.10.5 | MISSING live guard |
| 15 | GPWS FLAP INHIBIT | GROUND_PROXIMITY_PANEL | FLAP INHIBIT / NORMAL | NORMAL | 15.10.10 | MISSING live guard |
| 16 | GPWS GEAR INHIBIT | GROUND_PROXIMITY_PANEL | GEAR INHIBIT / NORMAL | NORMAL | 15.10.10 | MISSING live guard |
| 17 | GPWS TERRAIN INHIBIT | GROUND_PROXIMITY_PANEL | TERR INHIBIT / NORMAL | NORMAL | 15.10.10 | MISSING live guard |

### Source-linked functional restrictions
1. **GEN DRIVE DISCONNECT 1/2**: FCOM 6.10.6 describes guarded and safetied **disconnect actuation**, not two physically stable `NORMAL/DISCONNECT` detents. The current runtime's two labels are logical states only. Disconnect must never be reversed just because the guard closes. Cannot re-engage in flight.
2. **STANDBY POWER**: FCOM 6.10.7 explicitly identifies `AUTO` protected, `OFF` center and `BAT` unguarded. Its custom horizontal housing is a provisional simulator drawing, not accepted Boeing hardware.
3. **BATTERY**: FCOM 6.10.5 specifies guarded `ON`; `OFF` removes switched hot battery bus power.
4. **FLIGHT CONTROLS**: FCOM 9.10.1 specifies `STBY RUD / OFF / ON`; `ON` normal guarded state. **SPOILER** A/B FCOM 9.10.2 `OFF/ON`; `ON` guarded. **ALT FLAPS MASTER** OFF/ARM with OFF guarded (9.10.2–3).
5. **EMERGENCY EXIT LIGHTS (flight deck)**: OFF / ARMED / ON, ARMED protected (1.30.9, 1.40.5). Separate flight-attendant emergency exit light guarded-red switch (1.30.10) is intentionally not a flight-deck control.
6. **PASS OXYGEN**: NORMAL / ON (1.30.20–1.30.21); normal procedure requires guard closed (NP.21.3). ON deploys oxygen masks; never clear real scenario deployment simply by toggling/closing cap.
7. **FLIGHT RECORDER**: TEST / NORMAL (10.10.20), NORMAL protected. Owner's separate photo explicitly specifies a **left vertical hinge** with right/free edge opening toward the left. The current custom CSS follows that direction in principle; final photo matching and animation screenshots are still needed.
8. **BUS TRANSFER**: OFF / AUTO, AUTO guarded (6.10.9) — **absent from active guard registry**.
9. **ANTISKID**: OFF / ON, ON guarded (14.10.5), center instrument panel — **absent from active guard registry**.
10. **GROUND PROXIMITY**: flap, gear, and optional terrain inhibit controls protect NORMAL (15.10.10). Terrain's install/option effectivity is aircraft-dependent and must not be blindly mounted on all 737 Classics.

### Audit of physical states versus software semantics
`guardedDetent` in FCOM means a protected **lever position**, but it does not show that simply shutting the lid mechanically pushes the lever to that detent. The existing simulator `closePolicy.force` is an explicit **inference**, not a proven Boeing hardware action. Physical-guard hinge, lid sweep, locking/tab clearance and exact size may not be inferred from detent wording.

## Phase 2 — Visual inspection of supplied source and active assets
### Evidence grades
| Evidence | Can establish | Cannot establish |
|---|---|---|
| Owner annotated Unified OH11 screenshot at 161% | Three aperture outlines and apparent position/cover mismatch; approximate source-coordinate bounding boxes | Real-world millimetres, real Boeing hinge, all-open states |
| Frozen owner-approved overhead bitmap OH01–OH25 | Slot labels, graphical areas, relative positions and approximate drawn color | Actual physical hinge axis/swing or airframe applicability |
| Locked `Red_Guarded_*.png` and `Black_Guarded_*.png` | Image appearance/alpha frames and **bottom** hinge in asset manifest | Correct real-aircraft assignment to each individual control |
| `flight-controls-panel/fcom-controls-registry.json` | Six configured **top** hinges in auxiliary registry | Actual hinge in a real aircraft without photographic verification |
| Owner FLIGHT RECORDER reference | Explicit left-side hinge/swing direction and TEST/NORMAL mechanical orientation | Pixel-perfect fit of deployed CSS in all viewports |
| Public 737NG hardware replicas and NG simulator screenshots | Only generic design analogies | 737-300/-400/-500 physical authentication; these must not be marked Classic-approved |

### Critical visual findings and repairs ordered for Phases 3–5
- **OH11 GEN DRIVE 1/2:** current red sprite is scaled by a generic 261px baseline; owner marks each **tall, narrow** recess. The guard lid must not be stretched to fill the whole black backplate. Provisional source rectangles: `[154,334,200,418]` / `[847,334,200,418]`.
- **OH11 STANDBY POWER:** **wide, shallow, horizontal** recess source `[391,232,421,184]`, three detents. Never reuse a 90°-rotated portrait PNG. Existing provisional replacement is not the final 3D hardware model.
- **OH07 Flight Controls A/B, Spoilers A/B, Alt Flaps Master:** black/black/red in current images, but six-conflict list must be resolved using genuine Classic open/closed photo before selecting corrected hinge assets.
- **OH10 BATTERY and OH14 EMER EXIT:** current black sprites and hinge orientation are provisional; verify hardware and label clearance.
- **UPPER PASS OXYGEN:** high-impact red guard; color and hinge still require Classic-specific evidence. Protect against accidental activation.
- **UPPER FLIGHT RECORDER:** short horizontal black guard, physically hinged at **LEFT**, free/right edge swings sideways LEFT, not skyward. Dedicated implementation exists, visually not signed off.
- **BUS TRANS, ANTISKID, GPWS FLAP/GEAR/TERRAIN:** must be located and represented individually at their correct panel positions; cannot be treated as 'done' simply because 12 live guards exist.

### Source authenticity: external visuals
A few online photos of 737NG hardware and hardware replicas were consulted for **qualitative comparison only**; none is accepted as Classic variant/type proof. Example OEM/simulator comparison: https://www.flaps2approach.com/overhead-panels-oem . No external photo has been copied into public GitHub assets.

## Three independent audits (same authoritative source / independent focus)
- **Pass 1 — documentation:** 17 cockpit guarded/protected control identities, detents or action, protected state and precise FCOM folio, plus 1 cabin switch excluded. Generator disconnect lever *physical detent count not verified*.
- **Pass 2 — registry versus source:** 12 installed, 5 missing, 6 documented top-vs-artwork-bottom conflicts, 3 preliminary OH11 housing fits, 1 owner-specified left recorder hinge.
- **Pass 3 — risk and reproducibility:** every control has provenance, panel scope, hardware-confidence status, release blocker, and next evidence. No unknown photos or dimensions are silently promoted to PASS.

## Release gate and status
- [x] FCOM content mapped to **all currently identified** guarded flight-deck controls.
- [x] Missing guarded cockpit controls flagged, including exact FCOM pages.
- [x] All current installed guard shape/color/hinge claims graded with evidence limits.
- [x] Existing locked FCOM/asset images preserved; source documents NOT reproduced in public repo.
- [ ] Obtain and match authenticated 737-300/-400/-500 part/variant photographs open and closed, and hinge geometry for 16 not owner-confirmed.
- [ ] Resolve six internal hinge mismatches without changing approved locked source imagery.
- [ ] Position five missing guards in the relevant flight-deck panels; consider optional terrain effectivity.
- [ ] Complete native pixel fit/photo QA and subsequent animation/logic system tests (Phases 3–11).

**Overall:** Phase 1 factual source extraction complete for current FCOM scope; Phase 2 comparative/triage audit complete with unresolved photographic acceptance, **not final hardware approval**. Never claim 0% error or all 17 photo-correct at this stage.
