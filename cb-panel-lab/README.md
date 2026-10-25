# B737 Classic — Photo-derived Circuit Breaker Panel Lab (V1)

Purpose: standalone visual trainer that recreates photographed P6 and P18-1 breaker grid geometry and allows pull/push interaction, WITHOUT altering electrical-V7, Unified Cockpit, source-protected imagery or airframe wiring.

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

Other P18 panels visible only in overview are intentionally marked pending; do not invent their detail. P18-4 appearance in an overview is not enough to decide whether it is installed on a particular variant.

## Hard separation of evidence
- Slot row/column, plate label and amperage come from photos, and are visual candidates only.
- CB states exist in the independent UI lab; the simulator's electrical engine is NOT updated on pull/push.
- Feeding bus, provider, protective behavior, CB trip curve, CB condition state, and affected consumers are **UNKNOWN** until document-, configuration- and revision-verified.
- MRG p134–136 Classic index is relevant; explicitly NG-only right page 137 is excluded. Even if photo has retrofits, do not infer EP-FSI installed options without effectivity documents.
- P6-4 CPCS original control CBs and digital pressurization retrofit CBs are mutually exclusive UI variants. They do not imply validated CB wiring for both airframes.
- Preserve user-approved cockpit graphics; this page is deliberately standalone.

## Interface
- Panel chooser or clickable aft-cockpit silhouette for 9 available subpanels.
- Row and column numbers, white circuit names, dark CBs with photographed current rating, dimmed blank slots.
- Click CB for visual PULL/PUSH (no bus logic); highlighted search; reset lab pull state.
- CPCS / DCPCS selector only modifies the P6-4 pressurization CB row; other panel states persist.

## QA
An initial connector-side static pass checked JS syntax, unique CB position keys, valid row/column bounds and positive breaker current in all supplied grids. No browser rendering, photo pixel registration, or aircraft-specific electrical load test has been signed off.

## Remaining
1. Source-pixel registration and label correction for every slot; photograph lettering may differ from MRG index.
2. Real installed CB panels for FO P18 group, including all applicable configurations.
3. Verify rows/holes/screws and precise shape by owner image acceptance.
4. MRG p172, FCOM electrical distribution, WDM and effectivity crosswalk for actual provider → bus → CB → consumer edges.
5. CB mechanical state behavior and trip rules only when supported by source; do not turn visible CB rating into a trip simulation assumption.
