# Boeing 737 Classic — CDU Standalone Trainer v1

## What works
- Uses byte-for-byte unchanged user-approved `unlit_boeing_737_cdu_panel.png` (1199×1312).
- 70 individual visible physical control hotspots, inset into the actual key contours. LSK both sides are included.
- 5 independent text-backlit annunciators: CALL/FAIL/MSG/OFST/EXEC. Off state uses the artwork's dim printed ghost.
- Active `RTE`, `LEGS`, `MENU`, `INIT REF`, `IDENT`, `POS INIT`, `CLB`, `CRZ`, `DES`, `FIX`, `DEP/ARR`, `HOLD`, `PROG`, `N1 LIMIT`, `PERF INIT`, `TAKEOFF` training shells.
- Scratchpad typing, numeric & alphabetic keys, slash, space, decimal, plus/minus, delete, CLR, LSK data assignment, simulated MOD / EXEC commit.
- `MSG` on scratchpad message, `EXEC` on pending edits. `CALL`, `FAIL`, `OFST` each have independent test scenario switches.
- Brightness click cycle for approved photo's DIM/BRT key; **FCOM actual knob is rotary (11.10.4)**. This is a graphical trainer adaptation.
- Works offline without aircraft electric, IRS, engines or network once files are extracted.

## Running
Extract the entire ZIP, double-click `index.html` using Edge/Chrome. All control data is loaded from the local `data/cdu-map.js` script, so it works from a `file://` URL without an HTTP server and without internet. If your browser has unusually restrictive local-file settings, in this directory run `python -m http.server 8765` and open `http://localhost:8765/`.

## Engineering files
- `data/cdu-map.json`: 70 controls + 5 output lamps with pixel BBOXes
- `data/buttons.csv`: tabular map
- `data/cdu-hotspot-audit.png`: on-image review overlay (not used as background)
- `reference/chapter11-pages.json`: all 409 physical PDF pages indexed to printed folios and section headings
- `reference/chapter11-????.txt`: text of each of 409 Chapter 11 pages extracted from private FCOM; NOT for public GitHub distribution

## Boundaries
This is a demonstrable **input/training UI**, not a completed Boeing FMC. It does NOT compute real navigation, aircraft performance, lat/long, LNAV, VNAV, ACARS, IRS, or aerodynamic responses. No proof yet of accurate software-specific FMS page behavior beyond basic input/EXEC/scratchpad. See README QA. Border boxes are first-pass calibrated, visually checked at source resolution, but not independently flight-tested or approved.

Source: Sepehran Boeing 737CL FCOM chapter 11; control behavior pp. 11.10.3–11.10.7; page inventory PDF pages 1414–1822.

## اصلاحات v2
فایل `V2_FIX_REPORT_FA.md` را بخوانید. تمام اصلاحات به‌طور مستقل روی پوشهٔ `cdu-standalone/` انجام شده‌اند و تصویر اصلی تأییدشده دست نخورده است. پیش از تست در مرورگر، فایل ZIP را کامل Extract کنید.