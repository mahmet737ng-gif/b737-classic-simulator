# P1 / P2 / P3 main instrument panel — reconstruction register

Status: **Reference intake / integration pending**. Working branch only; **not deployed**.

## User-approved scope
Rebuild three adjacent Boeing 737 Classic main panel sections:
- P1: Captain instruments
- P2: center / engine instruments
- P3: First Officer instruments
- Glare shield, MCP and annunciator assemblies above; four additional owner screenshots still pending.

Visual authority: **owner-supplied instrument screenshots**, not their surrounding UI or content provenance. Crop borders and irrelevant UI. Position individual instrument crops by the larger P1/P2/P3 reference views. Do not assume a representative FCOM drawing is an exact paint/texture specification.

Fidelity requirements:
1. Geometry and proportional spacing; instrument faces, bezels, fasteners and panel join lines.
2. Exact type styling, scales, labels, colors, lighting, reflections, visible wear, depth and perspective.
3. Separate active elements: needles, flags, tapes, digital readouts, switches, rotary knobs, guards, pushbuttons and lamps.
4. Touch interaction (click, rotate, drag, hold, release, protective guard interaction), with suitable mouse support.
5. Very high zoom; dynamic and vector-rendered graphics retain sharpness. Photographic/textured regions still require appropriate source resolution and possibly detail assets—do not promise mathematically infinite resolution from finite raster screenshots.
6. Cross-check all states/interlocks with the owner's Sepehran Airlines Boeing 737 Classic FCOM, and use FCTM as operational training context. Do not invent FCOM-validated behavior.

Special group:
- Master Warning / FIRE WARN and Master Caution / RESET control hardware, per owner reference.
- The six-light system annunciator cluster: FLT CONT, IRS, FUEL, ELEC, APU, OVERHEAT/DET, on the appropriate side(s), matching screenshots and FCOM.
- MCP/glare shield integration after additional screenshots are received.
- Engine instruments in P2 must feature smoothly updating circular needles/dials and indications driven by simulation state (only when logic is source-validated).

## Intake inventory
**48** locally available instrument screenshots from the current conversation; numbered:
IMG_0428, IMG_0430–0438, IMG_0440–0477 (gaps and duplicate suffixes as supplied).
These files have **not yet been committed into the GitHub asset tree**. Maintain owner-supplied source asset references as a separate manifest when ingested.

Known reference categories (from owner exchanges; individual filename-to-part matching still requires QA):
- P1, P2 EIS, P3 EFIS/EIS overview reference layouts
- EADI, EHSI, airspeed/Mach indicator, altimeter, IVSI, standby ADI, standby airspeed/altimeter, RMI, DME, clock
- Engine primary/secondary indicators, fuel quantity analog/digital
- Lighting, warning annunciators, GPWS, anti-skid/autobrake, landing gear, flap/trim/speedbrake, vents and control hardware

## Phase gates and honest status
- [x] 48 screenshots received and count verified
- [x] GitHub repository and write access verified
- [x] Isolated work branch created; no changes to live main
- [ ] Four additional glare-shield/MCP reference screenshots received
- [ ] Detailed per-screenshot crop and filename → instrument map
- [ ] Pixel-level part placement and overlay registration for P1, P2, P3
- [ ] High-resolution image/material pipeline + vector moving elements
- [ ] Per-control interactive mechanics and accessibility
- [ ] FCOM chapter/section mapping for each device and functional logic
- [ ] End-to-end annunciator, caution, fuel and engine-instrument logic tests
- [ ] Visual acceptance against owner screenshots
- [ ] Mobile/tablet pan/zoom performance and hit area QA
- [ ] Owner test/approval and merge to main + live publication

Existing v0.3 repository content is a separate demonstrator and does **not** satisfy the new photographic fidelity specification. Preserve production until replacement has been tested.
