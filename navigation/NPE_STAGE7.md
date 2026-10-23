# B737 Classic NPE Stage 7 — audited procedure reference geometry

AIRAC **2610 Rev.1**. Simulation/development only, **not for operational navigation**. This Stage adds a source-faithful procedure reference-leg compiler and a stand-alone local visual QA page. It does **not** claim that the uploaded PMDG SID/STAR/Approach *narratives* contain verified ARINC 424 path terminators.

## Provenance and strict boundary

- Source is private user-supplied Navigraph/Jeppesen PMDG NAVDATA, and SIDSTAR files parsed **only from** the exact header `//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1`. Anything before the per-file marker is excluded.
- Stage1's existing `npe_decoder_runs.source_marker` and `navdata_import_batches.marker` are checked against the exact boundary, and the source segment must have `COMPLETE_TOKEN_DECODE`, valid post-marker line, exact token offsets, and the source file/SHA identity.
- Airport-scope `navdata_local_fixes` is used for coordinates. Reused ident with conflicting coordinates is marked unresolved. No global arbitrary-first-hit fix lookup.
- Adjacent *explicit* `FIX_PASSAGE` tokens in one source statement can yield **one reference chord**; any track, heading, runway reference, turn, hold, radial/intercept, speed token, transition, or separate statement **breaks** continuity.
- No route connection across discontinuities. Chords greater than 200 NM are blocked for manual review. Exact source constraints are displayed but **never interpreted as validated VNAV**.
- **ARINC 424 legs generated: 0**; FMC/LNAV/VNAV/AFDS activated: **0**. Full source semantics, approved EP-FSI FMC hardware behavior, PBN turn/hold/intercept and magnetic variations still require verified authoritative inputs.

## Local use

Keep the private Stage3 and Stage4 ZIPs **outside the GitHub webroot**. From repository root:

```powershell
python navigation/npe_stage7_server.py --stage3-zip "C:\Private\B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE3_PRIVATE.zip" --stage4-zip "C:\Private\B737_NAVDB_AIRAC2610_NPE_STAGE4_PRIVATE.zip" --root . --port 8767
```

Then visit: `http://127.0.0.1:8767/navigation/npe-stage7/index.html`.

The preview page is a **QA map, not the locked EHSI display**. This is deliberate: it never modifies EFIS knob geometry, approved CDU images or active autopilot state. The previous Stage 6 CDU/DEP-ARR/RTE/LEGS reference integration remains available and unchanged.

For CLI after extracting private Stage1 SQLite locally:

```powershell
python navigation/procedure_reference_leg_engine.py --stage1 "C:\Private\stage1.sqlite" OIII SID DAXI1A --runway 29R
```

## QA performed October 23, 2026

- **13 local Python tests passed**, covering real OIII SID DAXI1A and DHN2C, missing/wrong runway, overlapping tokens, ambiguous duplicate positions, and incomplete ZYYJ.
- **250 deterministic worldwide source procedures** sampled: 250 compiled, 1,771 AST nodes, 1,120 local FIX references located, 692 *non-flyable reference* chords. No inferred FMC guidance output.
- **7 HTTP checks passed**, including legitimate source query and rejection of invalid runway, nonexistent procedure, unknown query, untrusted Host and foreign Origin.
- Chromium rendered the **stand-alone Stage7 source geometry page** correctly and rejected a manually injected wrong runway. This visual browser QA used *the real local-source JSON as mocked browser responses*, because direct Chromium loopback networking was blocked in the execution environment. This is **not** a successful full CDU or actual device acceptance test.
- Private QA screenshot and aggregate results remain in user's private artifact/Library; no licensed navigation binary or derived rows committed to public repository.

## References (terminator meanings)

FAA AIM section 1-2 (PBN / RNAV) distinguishes TF, DF, CF, RF and heading leg behavior:
https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap1_section_2.html

FAA AC 90-105A discusses the ARINC 424 path terminator capabilities, validation and differences:
https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_90-105A.pdf

`TRK 285 UNTIL 4360` cannot be asserted to be a TF leg because the altitude terminator and frame/operating semantics have not been fully established. A source narrative `FIX RUS` does not by itself certify TF/DF/CF path behavior.