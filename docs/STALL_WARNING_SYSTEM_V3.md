# STALL WARNING COMPUTER 1 & 2 — Trainer subsystem V3

**First system-by-system slice.** One independent read-only training model, one existing Warning Engine adapter, one isolated test lab. It does not modify the approved original cockpit.

## Grounded Technical Database references

| Source / printed folio | Source page | Behavior grounded |
|---|---:|---|
| FCOM 15.20.7 | 1911 | Two independent stall warning computers; inputs wing configuration, air/ground, thrust, AoA, ADC; shaker motors; EFIS and GPWS windshear output; coupled columns |
| FCOM 15.10.3 | 1880 | Ground test 1 and 2 individually test respective computer, requires 115V AC; blocked in air |
| FCOM 10.40.5 | 1404 | Pitch limit symbol enabled with flaps extended; numeric position law incomplete |
| FCOM 10.40.7–8 | 1406–1407 | FMC gross weight and stall-warning-computer-derived speed display dependencies; exact numeric speeds not provided |
| FCOM 2.40.4 | 1017 | Stall management functional diagram link to DCPCS carrying N1/N2; hardware/port mapping unknown |

All excerpts, source text, source identifiers and technical graph remain private in `/Technical Database/Technical-Network-V2/`. New private structured subsystem artifact `/Technical Database/Subsystems/STALL-WARNING-V3/STALL_WARNING_NETWORK_V3.sqlite` contains 27 relevant nodes, 68 ports, 33 graph relations, 8 source-located rules (including the **non-executable numerical stall threshold rule**), 8 source-page references, six synthetic training fault profiles, 12 software adapter mappings and eight explicitly open gaps.

## Implementation

- `engine/systems/stall-warning-v3.js` pure deterministic immutable state and 2-channel test/fault logic.
- `engine/systems/stall-warning-integration-v3.js` adapter into existing `engine/trainer/integration-v2.js`, including real `audio/warning-engine.js` shaker request.
- `stall-warning-lab/` standalone interactive desktop/mobile test interface. Test switches are momentary pointer/keyboard controls; two-channel fault injection and instructor envelope decision supported.
- `tests/stall-warning-v3.test.cjs` 28 standalone and integrated tests against the real repo modules, added to `npm test` CI gate.

**CRITICAL:** No computable source formula relates AOA, wing configuration, thrust and airspeed data to the actual stick-shaker boundary. Stall activation during 'flight' is therefore **only instructor-injected**, not automatically calculated. Null is retained for unknown high/low speed tape numeric values and windshear output. No assumed circuit wiring, physical feedback, actual MP3 playback or complete QRH flows. Failure of a computer suppresses its test/flight output as an **explicit educational policy**, not a claimed Boeing fail-safe design. DCPCS link is functional only and remains distinct from the two individual warning channels in the graph.

## Next subsystem

After independent tests, connect full actual cockpit switch IDs/photo hotspots and physical power feeds; then extend ATA 21 pressurization and DCPCS into its own source-linked module. No LAN work unless owner reactivates it.