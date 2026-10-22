# CDU Standalone Trainer v1 — Engineering acceptance status

## DONE and tested
1. Source photo preserved unchanged, SHA256 `2c60c534e6e9cd80afa721f2d82801d7bdbc54dce4bbd39b8adb3470f2df0237` at 1199x1312 native pixels.
2. 70 individually identified inputs, 5 separate backlit-only text output indicators; **zero pairwise rectangular overlaps** in `data/cdu-map.json`.
3. BBOXes manually re-centered after comparing numbered QA image with the approved source. BBOX shape is a rounded rectangle or circle entirely inside visible key face, with the same scale regardless of viewport.
4. Local offline loader avoids file-fetch restrictions: `data/cdu-map.js` exposes map as data on `window`.
5. Node.js syntax and state-machine smoke tests PASS: page button routing, scratchpad entry, LSK write, pending modification/EXEC light, EXEC commit, MSG display and CLR, test CALL/FAIL/OFST, display brightness.
6. FCOM chapter 11 **409 physical pages** from PDF 1414 through 1822 extracted as individual UTF-8 text files, folio-to-PDF reference JSON/CSV. This is a machine-indexed reference, NOT a manual audit of every page's navigation rule.

## NOT DONE / limitations
- Chromium browser runner in this environment blocks both local URLs and localhost with `ERR_BLOCKED_BY_ADMINISTRATOR`, so interactive end-to-end browser screenshot testing remains BLOCKED, not PASSED. Local unit tests only.
- FCOM-derived page-specific FMC logic is **NOT COMPLETE**. Some pages are navigable training shells; navigation performance, thrust performance, LNAV/VNAV, ACARS, full CDU messages, IRS source coupling, nav database and dual FMC management not implemented.
- The user-approved photo depicts DIM BRT as a button, whereas the FCOM `BRT` brightness control is ROTARY. Trainer implements click-cycle, pending physical realism QA.
- An annunciator test toggle is not proof of actual aircraft failure/route offset logic.
- `b737.org.uk/fmc.htm` did not load successfully through public browsing (502 gateway), so **not fully studied**. Do not claim images on that site have been ingested.
- Final independent pixel-by-pixel visual sign-off of all 70 key borders has not been obtained from the user.
- Don't use this trainer for real flight.

## FCOM direct grounding
- CDU controls and LSKs 11.10.3
- FAIL, CALL, MSG, OFST + rotary brightness 11.10.4
- Key/EXEC and white EXEC annunciator 11.10.5–11.10.6
- Numeric/alpha/CLR/DEL/SP 11.10.7
- FMC preflight page list 11.40
- Takeoff/climb/cruise/descent 11.41–11.43
- FMC/CDU messages 11.60