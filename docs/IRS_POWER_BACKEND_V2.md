# IRS electrical and annunciator backend V2 — 2026-10-28

## Scope and owner lock
The owner RED ZONE protects **only the physical front-end artwork, geometry and pixel alignment**, not IRS functionality. The existing 93 pinned presentation/mounting sources remain byte-preserved. Backend switch/keypad behavior, mode logic, power, CB, alignment, annunciator ON/OFF rules and display content may be revised freely with functional QA. See [IRS FRONT-END-ONLY RED ZONE / BACKEND POLICY](IRS_FRONTEND_REDZONE_BACKEND_POLICY_V1.md). This V2 module is currently an independent electrical projector and has not yet replaced the legacy physical-lamp runtime driver.

Source-of-truth: `engine/systems/irs-electrical-evidence-v2.js`.
Tests: `tests/irs-electrical-evidence-v2.test.cjs`.
Live UI bridge remains `panel-mosaic-lab/cockpit/irs-trainer-unified-v1.js` (OWNER RED ZONE; do not edit).
Electrical upstream state: `engine/systems/electrical-v7.js`.

## Source and bus policy
- L normal AC: **AC STANDBY**; R normal AC: **AC TRANSFER 2**.
- Backup DC: **SWITCHED HOT BATTERY BUS**, independently for L and R.
- When R has lost AC and operates continuously on DC, it is limited to **300 seconds**. L is not subject to the R five-minute cutoff.
- The real core's normal OFF→NAV/ALIGN power-on self-test includes **3.5 seconds ON DC**, then nominal **600-second** stationary alignment, **1020 seconds** at the documented high latitude range, and a display countdown capped at **7 minutes by owner-approved training policy**.
- Initial energization requires a confirmed live **BATTERY BUS** even if AC exists. An IRS that is already powered and operating normally on AC is not invalidated solely because its backup DC subsequently fails.
- Selecting **OFF** starts a **30-second powered shutdown** while the source remains available; ALIGN remains on during that cycle, and the core removes power only after it reaches OFF. An actual source loss may terminate this earlier.
- ON DC annunciation = operating on backup DC (or brief startup test). DC FAIL = backup DC for the corresponding unit not normal, while its AC remains valid. DC FAIL is projected as a training annunciation; final aircraft-specific wiring/effectivity evidence still required.
- A failed backup DC supply with good AC must NOT automatically invalidate a properly operating NAV IRS. Once all *proven* equipment power is lost, no navigation output remains valid. Power restoration with selector NAV/ALIGN requires full alignment and fresh FMC/ISDU position.
- V7 input is tri-state TRUE/FALSE/UNKNOWN. Do not infer power when AC is UNKNOWN, even if backup DC is true. Only evaluated V7 schema accepted. Unknown evidence is fail-closed when optionally reconciling with the independent IRS core.
- Bus power != equipment CB path: do not infer equipment supply from unrelated CB labels, even if their text resembles the consumer. The exact EP-FSI wiring/effectivity map is not established.

## CB audit: photographed candidates, never auto-connected
The repository's `engine/cb/all-circuits-audit.v2.json` contains the following candidate labels. All are `NOT_YET_SOURCE_INDEXED`, with `airframeConsumerFeedVerified=false`, so NONE is permitted to trip the IRS model automatically.

| IRS | CB ID | Photo label | Candidate rating |
| --- | --- | --- | --- |
| 2 | P6-1\u007cALL\u007cD9 | DAA NO.2 IRS AC | 3 A |
| 2 | P6-1\u007cALL\u007cD11 | IRS NO.2 AC | 3 A |
| 2 | P6-1\u007cALL\u007cD12 | IRS NO.2 DC | 10 A |
| 1 | P18-2\u007cALL\u007cD2 | DAA NO.1 IRS AC | 3 A |
| 1 | P18-2\u007cALL\u007cD3 | DAA NO.1 IRS DC | 10 A |
| 1 | P18-2\u007cALL\u007cD4 | IRS NO.1 AC | 3 A |
| 1 | P18-2\u007cALL\u007cD5 | IRS NO.1 DC | 10 A |

*DAA* and *IRS* labels must not be merged: exact protected circuits and effectivities remain unverified. Their ratings are photo candidates, not approved electrical load values.

## Backend integration contract
Call `B737IRSElectricalEvidenceV2.evaluate(snapshot,{electrical,modes,unitStates,dtSec,cbEvidence})` with **evaluated** `B737_ELECTRICAL_V7_RESULT` and a 0–5 second elapsed step. Read `units.L/R` for confirmed source, backup duration, ON DC / DC FAIL cue projections, and evidence status. Advance with returned `state`.

For backend-only integration, `reconcileCore(B737IRSTrainerCoreV1,irsCoreState,evaluation)` forwards only proven power booleans to the existing independent IRS state machine, causing stateful NAV invalidation and full re-alignment after real power loss. It does NOT mutate switches or panel DOM, nor modify the frozen live wrapper.

**No special approval is required to change the backend rules for what a switch, button or lamp does.** To show the updated backend results on the physical Unified panel, add a behavior adapter/event contract that drives its existing artwork without touching the pinned front-end geometry. Since the legacy Unified mount JS mixes rendering and events and is presently pinned as one blob, an appropriate unprotected integration hook must first be used or created; never claim physical wiring is complete until a live integration test proves it. Changing the protected visual source bytes or geometry is a different request and still requires separate owner approval.

## Reference and verification boundary
Internal project: `docs/IRS_TRAINER_ARCHITECTURE_V1.md`, §Electrical architecture and FCOM 11.20.7–10. Cross-check of classic-era cue behavior: [B737 Operations Manual DC FAIL](https://www.easymanua.ls/boeing/737/manual?p=373) and [ON DC](https://www.easymanua.ls/boeing/737/manual?p=375). Airframe-specific FCOM/WDM effectivity and CB-to-IRU wiring remain unresolved.

This is a procedure/QRH trainer, **not for flight use**.
