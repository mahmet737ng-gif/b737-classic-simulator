# B737 Classic Electrical-to-Consumer Bridge V8 — System #05 continuation

**Status:** source-gated integration slice / 47 local tests, detailed validation below. Does NOT assert complete EP-FSI wiring or physical subsystem power coupling. Root cockpit and networking modules unchanged.

## Primary source: previously extracted private Technical Database, NOT live PDFs

| Private indexed FCOM source | DB page | Verified / extracted connection |
|---|---:|---|
| 6.20.9 | 1158 | TR1 AC input: Transfer Bus 1; TR2 AC input: Transfer Bus 2; TR3 AC input: Main Bus 2 |
| 15.10.3 | 1880 | Stall Warning self-test requires ground and 115V AC supply; not the exact feed bus |
| 15.20.7 | 1911 | Two independent Stall Warning computers; no specific electrical supply bus |
| 2.40.1–2 | 1014–1015 | Separate CPCS AC/DC motor versus DCPCS brushless DC motor; **do not interchange aircraft configurations** |
| 12.10.2 | 1826 | Fuel switch activates electric pump; exact feeder/breaker unknown |
| 13.10.1 | 1842 | Hydraulic electric pump switch controls electrical supply; feeder/breaker unknown |
| 6.10.7 / 6.20.11 | 1146 / 1160 | Conflicting ground standby-AUTO loss-of-AC interpretations remain unresolved in V7 |

## Code and behavior

- `engine/systems/electrical-loads-v8.js`: 3 documented TR upstream links, 16 equipment power contracts, tri-state **TRUE/FALSE/UNKNOWN** class-specific evidence; no airframe-specific bus assignment, no guessed feeder.
- `engine/systems/electrical-integration-v8.js`: coordinates real Electrical V7 and Stall Warning V3 state machines in an isolated training session. A known loss of all possible 115VAC sources blocks ground shaker test; when a powered bus exists but the actual Stall feed is unknown, the adapter **does not send true** automatically. Explicit instructor test-power evidence can be used for educational demonstration, and cannot overcome documented global source absence.
- `electrical-load-lab/`: responsive self-contained browser test panel showing TR feed states, confidence/QA tags, downstream source gaps and one safe guarded Stall-test demonstration.
- `tests/electrical-loads-v8.test.cjs`: 47 Node assertions for TR source routing, fault behavior, no guessed consumer mapping, global power-loss guard, role-limited instructor override, reset, replay and no mutation of other subsystem states.
- Private child overlay `/Technical Database/Subsystems/ELECTRICAL-V8/` stores 8-source-corpus references, equipment-port contracts, evidence records, blocked connections and detailed gaps. No Boeing manual content in public GitHub.

## Crucial correctness boundaries

1. **Powered feeder bus ≠ powered equipment:** without a documented circuit mapping, all equipment power remains UNKNOWN (unless its voltage class is certainly absent system-wide, in which case the device cannot have power from that class).
2. When an equipment voltage class is not reliably identified, even an AC and DC blackout cannot automatically classify that device.
3. The legacy `engine/trainer/core.js` has explicitly synthetic fuel/hydraulic `loadBus` mappings. V8 deliberately does **not** promote those assumptions into the validated network or modify its code.
4. The actual stall AoA trigger law, exact DCPCS controller power buses, per-motor protections, power breaker trip and aircraft-specific EP-FSI effectivity remain unvalidated.
5. No live integration with the approved cockpit image or physical audio hardware is claimed. This is **not for flight use**.

## Next acceptance gates

- Obtain EP-FSI-specific actual Electrical Load Analysis/Wiring diagram circuit references; independently verify each equipment↔bus/circuit breaker assignment.
- Extend `VERIFIED` mapping only after page-specific, effectivity-specific independent engineering review; add regression tests for each accepted load.
- Wire authenticated, documented load events into Stall/DCPCS/Fuel/Hyd power inputs and their applicable failure indications while preserving state-machine ownership.