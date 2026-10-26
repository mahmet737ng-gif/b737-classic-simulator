# B737 Classic Fire Protection Panel · Stage 1 (2026-10-26)

## Scope and provenance
- Source: owner's private Sepehran B737 Classic FCOM, Chapter 8, **printed pages 8.10.1–8.10.4**; source must stay private.
- This new isolated lab does not edit \`panel-mosaic-lab/all-overhead/\`, approved art, locks, manifests or unified runtime.
- Front panel background (read-only): \`panel-mosaic-lab/assets/locked/2026-10-23/Fire_Protection_Panel_Blank_With_Buttons.png\`.
- Fire handles (read-only): six approved \`FIRE_HANDEL_{ENG1,ENG2,APU}_{ON,OFF}.webp\`, rendered as UI layers; see \`fire-handle-lab/rotation-manifest.json\` for original hashes.
- Lamp assets (read-only): \`LIGHTS/black-amber-v1/mounted/\` for ENG 1/2 OVERHEAT, FAULT, APU DET INOP, L/R BOTTLE DISCHARGED; \`LIGHTS/WHEEL_WELL_RED_{OFF,ON}.svg\` for WHEEL WELL.
- NO image asset for dedicated APU BOTTLE DISCHARGED or green EXT test groups was confirmed in this collection. These remain clearly labeled textual/indicator previews; do not call them approved imagery.

## Interactive behavior in Stage 1
- Per-engine A/B loop detector health with NORMAL/A/B selection. In NORMAL, one good loop remains a valid path; both bad loops yield FAULT. With A or B manually selected, a failed selected loop yields FAULT without false MASTER CAUTION assertion from that selected-loop condition.
- OVHT/FIRE and FAULT/INOP self-test preview; EXT 1 and EXT 2 switch previews. EXT circuit continuity is separate from bottle pressure.
- Engine overheat / engine fire / APU fire / wheel-well fire injection. FIRE WARN and bell cutout; new warning can retrigger. Amber overheat is distinct from red fire.
- Fire handles: locked in normal conditions; illuminated fire condition or explicit lock override enables PULL; rotating only a PULLED handle requests bottle discharge; ENG LEFT/RIGHT and APU extinguishers track separately. Returning to IN requires CENTER.
- Separate simulated outputs for engine fuel, hydraulic and bleed shutoff, generator relay trip, thrust reverser inhibit; APU fuel, bleed, inlet door, generator trip. **These outputs are not wired into the aircraft engine yet.**
- \`b737:fire-protection-state\` browser event provides read-only \`model\`, \`indications\`, \`outputs\` and \`visual_test_only:true\`.
- Pixel placements are **provisional**. The board offers a draggable calibration overlay, persisted locally; no image or global atlas changes.

## Test
The isolated test is \`node fire-protection-lab/tests/engine.test.cjs\`.
Initial 21 assertions cover independent fault loops, cautions, fire warnings, interlocks, discharge, reset, extinguishing circuit test and bell cutout. Syntax checks for engine and inline UI passed separately.

## Release gates still open
1. Pixel-exact coordinate calibration against full-size panel original, including native lamp aspect ratios and handle pivot alignment.
2. Dedicated APU bottle discharge / 3 green EXT test artwork acquisition and approval.
3. FCOM variant-specific, source-page-backed semantic audit for 737-300/400/500; electrical/CB power and live detector timing integration.
4. Complete end-to-end smoke tests and unified output contract before wiring any aircraft systems.

**Not for real-world aircraft operation.**
