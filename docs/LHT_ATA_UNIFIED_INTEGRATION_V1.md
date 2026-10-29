# Lufthansa ATA -> Unified — additive, read-only phase

Source PDF: `LHT-LAN-B737CL-MULTI-ATA-2813-20261029`, 2,813 physical pages, 23 separate PDF sections. Original technical training manuals, PDF reproductions and extracted full text remain private in ChatGPT Library `/Technical Database/Sources/` and are NOT stored in the public simulator code repository.

## Integration

- `engine/maps/lht-ata-unified-bindings-v1.json`: all 23 source sections, source original physical page boundaries, 93 links to previously defined functional subsystem IDs, 112 read-only control-port occurrences (the same port may legitimately appear under multiple chapters), expected model specificity and provenance status.
- `panel-mosaic-lab/cockpit/lht-ata-unified-browser-v1.js`: separate **ATA · LHT** toolbar button, browse/search by ATA and subsystem, existing region navigation and read-only live observation of pre-existing overhead toggle/rotary/lamp registries through the same-origin `overheadFrame`. No writes to mechanical controls, no simulator output overrides.
- `tests/lht-ata-unified-bindings-v1.test.cjs`: integrity checks against live repository registries and adjacent source-page boundaries.

**Important:** existing functional `OVERHEAD-*`, `MAIN-*`, and `PEDESTAL-*` region codes in `technical-database-systems-panels.v1.json` designate broad functional boxes, **not** literal OH atlas tile numbers or pixel-perfect switch centers. Clicking an area navigates to the parent cockpit panel only; it never moves the original controls.

**Source verification status:** physical section boundaries verified, section-specific engineering rules and variant/equipment effectivity NOT verified, all references limited to section page ranges (not a substantiated component-specific source folio). ATA 30 attachment covers Wing Thermal Anti-Ice, not by itself the other window/probe heater systems. ATA 26 second insert is specifically 737-300/500 lower cargo fire/smoke. ATA 49 appears in two different course sections; APU installation/effectivity must be checked.

**Release and safety:** this change is purely additive and is prepared on a separate review branch. Must run all frozen-mosaic, guarded-switch, and IRS integrity verifiers and the new test in CI before merging/publishing. The adapter must not modify any frozen asset, protected index mounts, or any existing simulator control law. No engine/CB dynamics are changed by these links.

Next technical phase, separate from this source metadata work: validate original printed figures and equipment applicability and bind individual approved ATA-derived rules to the named simulation system + circuit breakers, one ATA chapter at a time. Never assume an ATA chapter alone proves a control's electrical behavior.