# B737 Classic — Native needle scale review, batch 1
Date: 2026-10-25
Aircraft: 737-33V EP-FSI; source photographs immutable.

## Audited workflow results

- Native pixel scan with initial 20 center candidates and 29 additional coarse circular centers: [successful run 40218785090](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40218785090)
- Nine high-resolution photographic overlays examined: [successful run 40219038727](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40219038727)
- Original images and accepted artwork not overwritten. Geometry remains `BLOCKED_REQUIRES_ORIGINAL_PIXEL_VISUAL_CHECK`.

Registered 54 showing faces: **49 rotary candidates (20 legacy center + 29 new coarse center) and 5 non-rotating position strips**. 940 Hough-line fragments across rotary faces; **52** independent source-angle references cross-checked: 16 had one angular neighbor, 22 had multiple, 14 had none. Previous source-photo radial studies provide 123 additional coincident angular comparisons, not independent proof of tick values.

## Nine native-image photo-overlay observations

| Gauge | Visual review of the original cropped image | Decision |
| --- | --- | --- |
| OH09 Fuel Temperature | Actual white tick ring clearly visible; several amber detections overlap major strokes but other red references are missed; side screws and numbered labels may generate spurious segments | Keep all nine major photo-angle references provisional, require source-pixel endpoint segmentation |
| OH10 DC AMPS | Printed zero and -50/+50 ticks clearly visible, yet Hough returned no line within 2.5° of any existing reference | Reject false 'scale missing' inference; must rescan with annulus restriction and review pivot discrepancy |
| OH10 CPS | 400 degree line is visibly tracked; near 420 the candidate region overlaps the printed numeral; 0 anchor does not match | Do not approve any angle on proximity alone; resolve conflicting provisional center x715 versus x780 |
| OH11 GEN DRIVE OIL TEMP 1 | Clearly distinct RISE and IN interpretations on a shared physical set of ticks; current detection recovers only a small fraction | Register modes independently before assigning values to short strokes |
| OH12 A.C. AMPS 1 | Many visible minor ticks; 8 Hough fragments are a severe undercount | No minor tick is accepted from the short Hough list |
| OH19 Differential Pressure / Cabin Altitude | Inner and outer concentric scales are visibly different and need distinct radial bands; text glyphs can overlap candidate marks | Never merge the two numeric maps; retain per-scale source anchors as provisional |
| OH20 Cabin Temperature | 0,20,40,60,80,100 graduations visibly present; previous 5-point Hough matches omit the 60 reference | Explicitly queue the missing 60-degree numerical anchor and full minor ring for native measurement |
| OH21 Duct Pressure L/R | Both needles share one scale, while original numeric labels 20–100 are visible; unlabeled zero requires proof | Preserve one scale geometry with two independently driven pointers |
| OH19 Cabin Rate | Left-side 0 tick is directly visible, not at 12 o'clock; positive/negative halves not uniform | Do not force vertical zero; separately measure signed up/down sectors |

## Evidence and required acceptance

- Data: `engine/instruments/native-photo-geometric-evidence-v1.json`
- Cross-correlation: `tools/gauge-native-triage-v1.py`
- Read-only diagnostic images: `tools/gauge-photo-overlay-review-v1.py`
- Earlier approximate pivots: `engine/instruments/native-pivot-track-batch1-v1.json`
- Previous tick scans: `engine/instruments/native-radial-ticks-batch1-v1.json`, `engine/instruments/oh19-native-ticks-batch1.json`

An acceptable tick requires correct dial/scale identity, the exact inner white-stroke endpoint in native pixels, scale number provenance (printed or defensibly inferred), correct center of needle rotation, and a human-reviewed graphical overlay. An automated line near the right bearing is only a candidate; it does not certify a needle.

No `realReadingsEnabled` change or Unified movement parameter was made.
