# B737 Classic MRG Electrical — Phase II source-bus / consumer audit (26 Oct 2026)

**Input:** nine user screenshots of MRG IV.6 Electrical and the indexed MRG source text. Only the **Classic** tables on printed pp.162–167, 172–175 and 182–188 are used. Adjacent or subsequent **NG** wiring diagrams and cases are excluded. PDF index = printed page + 9. The snapshots were supplied from a local PDF; the PDF file itself was not claimed uploaded in this message.

## Source staging now completed

| Source | Output | Coverage | Level |
| --- | --- | --- | --- |
| MRG Classic alphabetical ELECTRICAL POWER SOURCE / ITEM, printed pp.182–188 | \`engine/systems/mrg-classic-340-consumer-bus-index-v1.json\` | **340 rows** across pp.182=48, 183=52, 184=55, 185=45, 186=49, 187=48, 188=43 | General CL bus-to-consumer *reference*, not installed EP-FSI wiring |
| MRG Classic failed DC BUS 1/2, TRANSFER BUS 1/2, printed pp.162–167 | \`engine/systems/mrg-classic-bus-failure-effects-v1.json\` | **35 instrument/system INOP effects**, with variant restrictions | Candidate failure effects; not arbitrary gauge zero |
| Read-only source-path projector | \`engine/systems/mrg-classic-consumer-bus-qa-v1.js\` | **17 affected gauge face IDs**, CPCS/DCPCS variant filtration, separate 115 VAC/28 VAC/28 VDC | Source candidates only, gaugePower always UNKNOWN |
| Unified cockpit optional QA Inspector | \`panel-mosaic-lab/cockpit/mrg-electrical-needle-qa-unified.js\` | On-page 340-row source evidence fetch, 17 gauge routes, CPCS/DCPCS selector, TR1 failure trainer | No automatic edits to original images or value-to-angle maps |

The cross-index is generated from original MRG text and checked against the supplied page screenshots. It preserves raw name, raw bus label, standardized bus identifier, voltage class, printed folio, PDF page, CPCS/DCPCS / optional applicability and source-review status. A six-row review queue remains after **two repeated OCR labels** and other reading ambiguities. Do not merge repeated labels into one electrical load or assume two separately powered devices until photographed source text is reconciled.

### Source-keyed feeds specifically relevant to needles

| Analog/indication | MRG printed source | Reference supply | Important behavior |
| --- | --- | --- | --- |
| CSD/Generator DRIVE Oil Temperature 1 | 183 | DC BUS 1 / 28 V DC | DC1 failure can make indication INOP; it does **not** mean oil physically cools or needle moves to zero |
| CSD/Generator DRIVE Oil Temperature 2 | 183–184 | DC BUS 2 / 28 V DC | Independent of DRIVE 1 |
| Engine 1 Oil Pressure and Engine Oil Temperature indications | 183 | TRANSFER BUS 1 / 28 V AC | Different supply class than CSD oil temperature DC |
| Engine 2 Oil Pressure and Engine Oil Temperature indications | 184 | TRANSFER BUS 2 / 28 V AC | Independent of engine 1 |
| Engine N1 indications | 184 | BATTERY BUS / 28 V DC | N1 physical RPM signal and display-power logic **separate** |
| Engine N2 and EGT indications | 184 | STANDBY BUS / 28 V DC | EIS and non-EIS require independent conditioning; non-EIS N2 1/2 also referenced DC BUS 1/2 |
| Fuel Temperature indication | 184 | MAIN BUS 2 / 28 V AC | Never substitute DC2 or 115 VAC |
| Hydraulic A/B pressure indicators | 185 | TRANSFER BUS 2 / TRANSFER BUS 1, both 28 V AC | A/B are cross-sided |
| Brake Pressure indicator | 182 | TRANSFER BUS 2 / 28 V AC | Distinguish from brake actuator electrical buses |
| Pneumatic Duct Pressure indication | 186 | TRANSFER BUS 1 / 28 V AC | Indication INOP does not mean pneumatic pressure is zero |
| OH10 DC Volts/Amps | 148, 161–162 | DC bus selector/TR current independent | Keep MRG numeric normal references; actual meter sensor and geometry still require native-source checks |

**AC class safeguards:** 28 V AC transformers are *not* modelled by V7. An energized 115 VAC TRANSFER/MAIN bus alone cannot prove an individual 28VAC indicator powered. Similarly the 115/28V **ELECTRONIC BUS** subdivisions are not explicit independently evaluated V7 bus objects. These paths remain \`UNKNOWN_NOT_MODELLED\` rather than a falsely verified powered state.

### Fuel and hydraulic: motor supply != control supply

- Electric hydraulic pump serving System B: GENERATOR BUS 1, 115 VAC; hydraulic pump serving System A: GENERATOR BUS 2, 115 VAC. Their control circuits are separately documented on DC BUS 1/2 by engine/system and must not be conflated or cross-linked based on the panel name alone.
- Main Tank 1 Aft fuel boost pump: TRANSFER 1 / 115 VAC; Main Tank 2 Aft: TRANSFER 2 / 115 VAC.
- Main Tank 1 Forward: MAIN 1 / 115 VAC; Main Tank 2 Forward: MAIN 2 / 115 VAC.
- Center Tank LEFT pump: MAIN 2 / 115 VAC; Center Tank RIGHT: MAIN 1 / 115 VAC.
- The six corresponding \`Fuel Pump Control\` circuits are separate DC1/DC2 branches. Source index includes a duplicated Main Tank 1 Fwd control label (p.184); both occurrences flagged for source-photo QA, not installed power claims.

### Pressure-controller exclusivity

- **DCPCS:** Auto 1 (DC BUS 1 / 28 V DC), Auto 2 (DC BUS 2 / 28 V DC), manual control (BATTERY BUS / 28 V DC).
- **CPCS:** AUTO AC (TRANSFER BUS 1 / 115 VAC), STANDBY & MANUAL AC (TRANSFER BUS 2 / 115 VAC), AUTO DC (DC BUS 1 / 28 V DC), STANDBY DC (DC BUS 2 / 28 V DC), MANUAL DC (STANDBY BUS / 28 V DC).
- The projector filters mutually exclusive CPCS/DCPCS rows and does not assert that this aircraft physically carries both controllers simultaneously.

### Read-only QA and technical database state

All 340 rows are **source-indexed** evidence, not installed WDM-validated \`sourceBus\` bindings. Even with a powered V7 source, the \`devicePowered\` field remains \`null\`. \`SOURCE BUS OFF\` is a useful **generic training observation**, not authority to trip cockpit hardware or force an instrument zero.

The original 54-face instrument geometry registry, photographic artworks and CPCS/DCPCS flight-model ownership are unchanged. The new source record can inform a future proven device→source→sensor→needle chain. This release is a repo-versioned Technical Database staging artifact only; no claim is made that a private SQLite database or any particular EP-FSI WDM has been updated or signed off.

## Reproducible checks

\`npm run test:mrg-bus\` for source index/failure regressions; \`npm run test:mrg-needle\` for live numeric inspection contract; \`node tests/electrical-v7.test.cjs\` for the original source distribution baseline.

The execution harness validated 23 new MRG bus/failure tests, 20 MRG needle tests and 47 Electrical V7 tests (**90/90 logical cases passed**). Automated Actions have been configured separately; successful CI execution and browser visual acceptance were not independently verified here.

**Unresolved engineering gates:** actual EP-FSI ATA24 Electrical Load Analysis/WDM, installation/option effectivity, 28 VAC/electronic bus converters, explicit multi-source fallback, fault flags vs needle park/hold modes, and full major/minor-tick/pivot QA for all 54 faces.
