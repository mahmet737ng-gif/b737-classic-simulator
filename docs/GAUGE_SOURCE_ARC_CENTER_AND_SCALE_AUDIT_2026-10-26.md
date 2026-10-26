# Boeing 737 Classic · native-photo gauge arc and scale forensic audit
**2026-10-26** · Evidence-based correction prompted by four owner screenshots from Unified

## User-observed defects

The visual needles often rotate around the wrong position, their tips do not read the printed ticks, and inspector bars in OH10/11/12 show **raw needle angle** rather than real DC AMPS, CPS, VOLTS, GEN DRIVE OIL TEMP or A.C. AMPS. A displayed `22°` is not evidence of a measured 22°C. The older Stage 7–10 technical calibration still has no accepted mechanical source-pivot or full tick map.

## Source evidence collection

All photo geometry was evaluated on original frozen native resolution, not on cropped browser screenshots. The source photos include:
- OH10 ELEC (1095×1436) SHA `9a1ca4d6cfb277ec1404f3a464e957d81be9d9689a0810883364342d57b0f1ea`;
- OH11 STANDBY (1203×1308) SHA `86cf2f1de81146756adf694b1fe01067a271c32990c1fda7752eb913442a6708`;
- OH12 BUS TRANS (1024×1536) SHA `709cb15a86f9038ca082136c4db59af83c7800107dfe320182bf7f4c56837e9f`;
- OH20 legacy and OH20 **B737-400 alternate source**, each 1254×1254 and 1122×1402 respectively;
- OH21 BLEED (1122×1402).

We checked the position of the original circular bezel with Hough circle fitting at **four sensitivity thresholds**, then independently sampled radial ring edge contrast at 2° intervals from the actual PNGs. A rim center is a **candidate hub**, not physically certified shaft hardware; where a visible black spindle/boss exists, it takes priority over the geometric bezel alone.

## Before / after original source pixel registration

| Face | Old native XY | Rim-fitted XY | Old rim contrast → candidate contrast | Preview action |
|---|---|---|---|---|
| OH10 DC AMPS | 310,168 | 300.8,203.4 | 27.10 → **89.22** | corrected |
| OH10 CPS | 715,190 | 774.2,191.4 | 28.76 → **65.66** | corrected |
| OH10 DC VOLTS | 332,600 | 303.6,625.6 | 24.12 → **76.18** | corrected |
| OH10 A.C. VOLTS | 715,620 | 775.4,626.4 | 20.33 → **66.06** | corrected |
| OH11 GEN DRIVE 1 | 266,1021 | 326.4,1016.6 | 22.85 → **85.30** | corrected |
| OH11 GEN DRIVE 2 | 781,1021 | 861.8,1023.8 | 33.22 → **83.72** | corrected |
| OH12 AC AMPS 1 | 210,265 | 261,252.2 | 37.69 → **89.12** | corrected |
| OH12 AC AMPS 2 | 705,265 | 753.4,252.2 | 59.80 → **80.51** | corrected |
| OH12 APU AC AMPS | 724,1334 | 720.8,1322.4 | **74.37** → 64.70 | **REJECTED: old pivot retained** |

OH20 legacy and OH21 show a visible spindle cap. The rim center differs slightly but the shaft lies near the previous original coordinate; neither model's existing pivot was changed. B737-400 OH20 uses its separate photographed face and proposed source pivot `284,268` pending full numeric tick measurements.

**8 of 9 originally proposed OH10/11/12 visual recenterings retained.** The APU change was rolled back after source pixels showed it made the fit worse. The original photos and owner-approved pointer sprite files remain byte-identical.

## Scale identification and numerical step audit

Inventory of printed labels (not comprehensive per-line numeric calibration):
- **OH10:** DC AMPS (-50,0,+50), frequency CPS (0,400,420), DC VOLTS (0,20,40), AC VOLTS (100,110,120,130). **CPS is not uniform across 0→400 and 400→420**.
- **OH11:** separate GEN DRIVE TEMP RISE markings (0,10,20,30) and adjacent oil-temperature markings (80,120,160). From an enlarged original, **10 to 20 contains exactly one intermediary tick**, so the two equal divisions represent **5 RISE units** each. This statement alone does not approve its XY/angle.
- **OH12:** A.C. AMPS 0,50,100,150,200. Between photographed **50 and 100** there are exactly **four unnumbered intermediate strokes**, i.e. five divisions × **10 A**. Other intervals require independent source count and angle survey.
- **OH20 classic / 400:** both photographed variants bear TEMP labels 0,20,40,60,80,100; they have **separate art and registration** and are not interchangeable.
- **OH21:** visually printed PSI labels 20,40,60,80,100. No unobserved zero label is promoted as a photo-certified numerical anchor.

The engine `engine/instruments/native-arc-scale-v1.js` can fit a center from **five or more photographed radial stroke endpoints** and construct an exact tick count between two independently photo-verified number labels. Inferred internal numbers are recorded separately and remain `value:null` until actually verified. Nonuniform angular gaps do not silently become a linear calibration.

## Actual code and QA

- Runtime OH10 pointers moved in `panel-mosaic-lab/cockpit/ac-dc-metering-model.js`; OH11+OH12 pointers moved in `panel-mosaic-lab/cockpit/drive-amps-needle-model.js`. Unified cache versions bumped to `MET-0003-ARC-QA` and `DAN-0005-ARC-QA`.
- Inspector labeling explicitly clarifies raw `QA ANGLE (°)` ≠ actual gauge quantity.
- Owner artwork, existing indicator SVG paths and aircraft system physics **not modified**.
- `native-bezel-centre-evidence-v1.json`, `native-photo-scale-label-inventory-v1.json`, `native-verified-division-intervals-v1.json` record provenance and verification limits.
- Native image tests check original SHA and dimensions, before/after ring contrast, eight moved centers, rejected APU center, and all proposed/unknown tick state.
- Automated tests assert representative 10..20 and 50..100 intervals but block promoting their unconfirmed angle geometry.

## Strict pending acceptance gates

1. Identify every **physical shaft centre**, independently of ring/bezel in all 12 in-aircraft needle instances. The photo-only model registration is a **provisional visual improvement**.
2. Extract **every inner/outer pixel endpoint** for each printed tick with a per-gauge radius tolerance. The photo contrast alone cannot distinguish every minor tick from text.
3. Assign exact values only to each individually checked tick; a single linear 0→maximum mapping cannot cover irregular/nested scales. The user-requested remaining work is substantial and **not claimed completed**.
4. Measure painted end-point of each *actual approved pointer sprite* after panel aspect transforms; fix per-gauge tip reach and test clockwise/counterclockwise direction, stops and 0/full-scale.
5. Replace the raw-angle inspector sliders with **physical unit setpoints** only after all corresponding scale spans are verified, then execute automated source-state→needle-angle→DOM-render tests and full browser pixel screenshots under 737-300/500 and 737-400 profiles.

**Release state:** The eight visual pivot improvements are testable in Unified. Complete numeric graduation calibration and flight-representative mechanical acceptance **remain blocked**. Do not present an angle slider reading as actual pressure, volts, temperature or current.
