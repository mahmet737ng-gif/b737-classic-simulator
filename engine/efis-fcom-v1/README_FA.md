# B737 Classic FSI EFIS Control Panel — Stages 1 and 2

## اجرا
فایل `index.html` را پس از استخراج ZIP با Edge باز کنید. اتصال اینترنت لازم نیست.

## منبع
Sepehran Airlines Boeing 737CL FCOM, Volume 2, Chapter 10.
- PDF page 1322 / FCOM folio 10.30.2: *EFIS Control Panel* (FSI primary configuration).
- PDF page 1323 / FCOM folio 10.30.3: DH reference, DH selector, DH reset, EADI brightness, outer EHSI brightness; alternate FSA figure excluded.
- PDF page 1324 / FCOM folio 10.30.4: inner weather-radar brightness, mode/range selector, weather radar, five map switches.
- PDF page 1325 / FCOM folio 10.30.5: WPT limit <=40 NM, TCAS traffic (TFC) control.
- PDF pages 1339, 1341, 1343, 1345, 1347, 1349 and 1355: EHSI example illustrations.

## Stage 1 — control identification
14 control objects plus DH indicator output; 14 unique stable IDs, type/mechanics, and source locator. Each BBOX maps to original PDF drawing pixel coordinates. See `data/efis-map.json`, `data/control-register.csv`, `assets/EFIS_QA_NUMBERED.png`.

## Stage 2 — independent interactive behavior
- MODE has seven source-labeled choices. RANGE has six 10–320 NM labels; tester may click, reverse-click, scroll, or keyboard arrows.
- SOURCE CROPS ONLY: The panel drawing and mode illustrations are rendered and cropped directly from the user's FCOM PDF.
- EHSI outer brightness and radar inner brightness have independent hit zones/turn events.
- Five MAP buttons are independent and can be simultaneously selected; selected state rendered with white illuminated lettering.
- WXR and TFC select requests are modeled; no fabricated echoes/traffic/weather are drawn.
- DH RST requests a reset (EADI hardware not modeled). DH increment not specified in cited pages, so wheel motion does not fabricate a feet/step conversion. Manual test-console entry updates DH readout, explicitly separate from aircraft controls.
- Published FCOM examples are static examples, not new computed avionics presentations.

## Acceptance/QA
- `node tests/efis.test.cjs`
- `node tests/dom.test.cjs`
- Browser screenshot automation is blocked by sandbox policy; visual QA awaits testing in user's Edge.
- No FSA TERR selector is added to the selected EP-FSI figure.
- No numeric dimmer ranges or rotary detent angles are asserted as documented FCOM hardware specifications. Original knob pixels remain unrotated until exact source-backed mechanical angles can be validated.

## Provenance
The FCOM figure is Boeing proprietary. Source illustrations remain inside the private user ZIP/Technical Database only, not in the public GitHub repo.

**Training only — not for actual navigation.**