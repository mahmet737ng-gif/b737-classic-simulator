# B737 Classic — Photo-derived Circuit Breaker Panel Lab (V1)

Purpose: standalone visual trainer that recreates photographed P6 and P18-1/P18-2/P18-3 breaker grid geometry and allows pull/push interaction, WITHOUT altering electrical-V7, Unified Cockpit, source-protected imagery or airframe wiring.

Open `cb-panel-lab/index.html` from a local static web server, or from an enabled GitHub Pages deployment. It loads `catalog.js` and has no third-party libraries. Browser URL serving is deployment-dependent.

## User-photo reference mapping (2026-10-25)
| Screenshot | Subject | Raster grid in photo | Source state |
|---|---|---|---|
| IMG_0493.jpeg | Rear cockpit arrangement overview | Overall layout | Schematic orientation, not dimensional survey |
| IMG_0482.jpeg | P6-1 | A–E, 1–17 | Photo transcription candidate |
| IMG_0483.jpeg | P6-2 | A–D, 1–24 | Photo transcription candidate |
| IMG_0484.jpeg | P6-3 | A–F, 1–18 | Photo transcription candidate |
| IMG_0485.jpeg | P6-4 | A–F, 1–18 + retrofit | Original vs digital variant exclusive |
| IMG_0486.jpeg | P6-12 | A–D, 1–9 | Photo transcription candidate |
| IMG_0487.jpeg | P6-11 | A–D, 1–9 | Photo transcription candidate |
| IMG_0488.jpeg | P6-5 | A–D, 1–9 | Photo transcription candidate |
| IMG_0489.png | P6-6 | 2 service sockets, 2 CBs | Non-grid narrow vertical module |
| IMG_0490.jpeg | P18-1 | A–E, 1–7 | Some HGS/TCAS are option-dependent |
| IMG_0491.jpeg | P18-2 | A–E, 1–15 | Photo transcription candidate; upper-right cutaway and lower-right extension |
| IMG_0492.jpeg | P18-3 | A–F, 1–19 | Photo transcription candidate; tapered upper-right edge |

Remaining P18-0/P18-4/P18-5 panels visible only in overview are intentionally marked pending; do not invent their detail. P18-4 appearance in an overview is not enough to decide whether it is installed on a particular variant.

## Hard separation of evidence
- Slot row/column, plate label and amperage come from photos, and are visual candidates only.
- CB states exist in the independent UI lab; the simulator's electrical engine is NOT updated on pull/push.
- Feeding bus, provider, protective behavior, CB trip curve, CB condition state, and affected consumers are **UNKNOWN** until document-, configuration- and revision-verified.
- MRG p134–136 Classic index is relevant; explicitly NG-only right page 137 is excluded. Even if photo has retrofits, do not infer EP-FSI installed options without effectivity documents.
- P6-4 CPCS original control CBs and digital pressurization retrofit CBs are mutually exclusive UI variants. They do not imply validated CB wiring for both airframes.
- Preserve user-approved cockpit graphics; this page is deliberately standalone.

## Interface
- Panel chooser or clickable aft-cockpit silhouette for 11 available subpanels.
- Row and column numbers, white circuit names, dark CBs with photographed current rating, dimmed blank slots.
- Click CB for visual PULL/PUSH (no bus logic); highlighted search; reset lab pull state.
- CPCS / DCPCS selector only modifies the P6-4 pressurization CB row; other panel states persist.

## QA
An initial connector-side static pass checked JS syntax, unique CB position keys, valid row/column bounds and positive breaker current in all supplied grids. No browser rendering, photo pixel registration, or aircraft-specific electrical load test has been signed off.

## Remaining
1. Source-pixel registration and label correction for every slot; photograph lettering may differ from MRG index.
2. Obtain frontal source photos for remaining FO panels P18-0, P18-4, P18-5 and distinguish installed options.
3. Verify rows/holes/screws and precise shape by owner image acceptance.
4. MRG p172, FCOM electrical distribution, WDM and effectivity crosswalk for actual provider → bus → CB → consumer edges.
5. CB mechanical state behavior and trip rules only when supported by source; do not turn visible CB rating into a trip simulation assumption.

## MRG index versus photographed faceplate: hard conflicts (2026-10-25)

Different Boeing Classic revisions or avionics modifications cannot be assumed equivalent based on panel numbering alone. Clear conflicts requiring an explicit airframe/effectivity decision:

- **P18-2 E4** — MRG p136 Classic index calls this *EADI 1*; user photo IMG_0491 visibly labels **CARGO FIRE CCU CHA**.
- **P18-2 A5** — MRG p136 calls this *RDMI Captain*; user photo IMG_0491 shows the slot **unpopulated**.
- **P18-2 D7–D9** — MRG p136 says *Stall Warning 1* as a group; photo labels distinct **SMC Stall Warning Asym Mode**, **SMC-1 Sensor Exc AC**, and **SMC-1 Computer DC**.

For the present UI use **the photograph for physical label and grid position**, but record any mismatch as unresolved. Do not make either set of claims into verified electrical bus→CB→consumer mappings. The airframe-specific database may later select a different faceplate variant; NEVER overwrite or silently reinterpret the original Classic MRG references.
