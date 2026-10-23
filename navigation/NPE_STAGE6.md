# B737 Classic NAVDB / NPE Stage 6 — Native CDU Procedure Selector

**AIRAC 2610 Rev.1 · training prototype only · NO operational flight navigation.**

## Implemented

- Native physical CDU `DEP/ARR` selector integrated additively with locked CDU v6, EFIS panel photographs, control coordinates and EHSI PLAN; no artwork or hitbox changes.
- LSK `L1` = SID from ORIGIN, `R1` = STAR from DEST, `R2` = APP from DEST. Catalogue scroll with NEXT/PREV PAGE, select via L1–L5, then select explicit runway and transition. L6 returns to DEP/ARR.
- Read-only private AIRAC 2610 source catalogue and post-header structural semantic report. Every source expression before the exact marker `//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1` is ignored by upstream Stage1 (schema/provenance checked when Stage3 opens). Missing/contradictory runway and transition fail closed. Incomplete ZYYJ procedures excluded.
- Stage4 Flight Plan recomposition uses precisely identified source procedures with existing ordered AIRWAY data from a **saved** private Stage4 plan. The selected route is a MOD reference preview until RTE LSK L5 ACTIVATE and CDU EXEC. ERASE in ACTIVATE cancels without changing the committed plan.
- EHSI PLAN reference stays on the previous ACT route during MOD, then updates only on EXEC. Never connects a line across published/unresolved ROUTE DISCONTINUITY. No active FMC legs, no aircraft-centered map, LNAV, VNAV, AFDS or steering output.
- The new Stage6 endpoint `semantics` reports explicit blockers for RUNWAY_REFERENCE, FIX_PASSAGE, TRACK, HEADING, TURN_DIRECT, RADIAL_INTERCEPT, HOLD, ATC_VECTORS and SPEED_TOKEN. **It does not assign verified ARINC 424 path terminators to ambiguous source syntax**. No source expression is secretly reinterpreted as TF/CF/DF.

## Private local startup (Windows)

From repository root with Python 3.10+, pass both user-provided original private archives:

```powershell
python navigation/npe_stage6_server.py --stage3-zip "C:\Private\B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE3_PRIVATE.zip" --stage4-zip "C:\Private\B737_NAVDB_AIRAC2610_NPE_STAGE4_PRIVATE.zip" --root . --port 8766
```

The server extracts exact allowlisted SQLite members only to an OS temporary directory, binds to `127.0.0.1`, and deletes its temporary files on exit. It does **not** expose private SQLite in the public repo, webroot, or GitHub Pages.

Open `http://127.0.0.1:8766/navigation/npe-stage5/index.html` on the same Windows machine. In the existing Stage5 lab choose a **saved** private flight plan and Stage/ACTIVATE/EXEC it. Then on the CDU press DEP/ARR and use the physical LSK keys as above. Once the new plan is created, return to RTE, press L5 ACTIVATE then EXEC to commit as **reference only**. Existing standalone NAV Route lab remains available. Live composed (non-saved) routes require a separate Stage6 seed and are deliberately not silently inferred from the Stage4 saved plan.

## QA

- 5 JavaScript selector lifecycle scenarios: local source list, explicit runway, MOD/ACTIVATE/EXEC, stale source preventing editing, ERASE, invalid input and dotted-ident support.
- 10 Python tests: private Stage1/2/3/4 integration, semantic blockers, published runway/transition validation, changed real SID, same source reconstruction and rejection of conflicting STAR/APP.
- Saved source OIII → OIMM: 20 plan items including 4 preserved ROUTE DISCONTINUITIES; 0 executable FMC legs. Private tests validate real OIII SID and OIMM STAR/Approach source catalogues.
- Client visual acceptance on user hardware **not yet verified**. These results are code/HTTP and source-data tests, not a flight test.

## Next gated tasks

1. Source-specific, FCOM-verified path-terminator interpretation of all PMDG SID/STAR/APP expressions, including conditional altitude terminators, magnetic bearing reference, hold entries, missed approaches, overfly, fly-by and non-continuous ATC vectors.
2. Committed active leg sequence with verified geometry, speed/altitude application and AFDS state matching EP-FSI equipment, only after tests and explicit aircraft-specific approval.
3. UI visual acceptance on iPad and Windows and flight simulator integration. The original approved EFIS photo, CDU image and physical controls must remain unchanged.