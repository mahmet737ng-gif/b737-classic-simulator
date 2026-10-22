# B737 Classic Integrated Systems Network (ISN) - design v0.1

**Status:** a machine-readable *draft* systems dependency graph, NOT an airworthy aircraft simulation, not a validated wiring diagram, and not yet connected to the cockpit UI.

**Scope:** Sepehran Airlines Boeing 737-300/-400/-500 FCOM (primary authority). Respect installed aircraft options and FS effectivity blocks. Secondary MRG can support interpretation but cannot override Classic FCOM. The technical source PDFs/archives remain in the user's private `Technical Database`; this public repo stores paraphrased engineering relations and page references, not copyrighted full-page images or extracted manual text.

## Existing map and new graph

- The existing `engine/maps/technical-database-systems-panels.v1.json` inventories **15 FCOM-aligned systems / 200 proposed leaf categories** and maps many categories to **111 coarse panel regions**.
- The new `engine/network/b737cl-system-graph.v0.1.json` contains **78 explicit pilot nodes, 81 directed, typed functional edges, 15 system groups, and 7 documented fault/behavior cases**.
- The 78 nodes are a deliberately limited *subgraph*, not complete coverage of the 200 existing categories and **not 78 finished flight-accurate components**.
- Group names and source chapters are reused from the existing taxonomy. Signals are explicitly labelled **electric-power, mechanical-power, fluid-flow, hydraulic-pressure, pneumatic-pressure, sensor-signal, command, interlock, annunciation, aural-warning** etc.
- A connection supported at FCOM system-function level is *not* proof of the exact physical wiring, connector pin, circuit breaker or avionics databuss address.
- Each graph edge has an FCOM source ID, printed section and physical PDF page. `verification: functional-path-only` explicitly identifies provisional AC-power relationships where the precise feeder bus is unknown.

## State ownership and execution contract

A single deterministic kernel owns authoritative state. Control movement does not directly turn annunciators on/off. Commands enter a validated command bus. Models produce derived physical conditions, then monitoring logic computes fault state, then visual/aural systems project alert outputs.

For every component register:

1. Unique stable ID / variant applicability / aircraft option.
2. Physical inputs (energy/fluid), measured inputs (sensor), digital/discrete commands, and output ports with units and quality.
3. Normal conditions, prerequisites, inhibit conditions, fault modes, and recoveries.
4. Sensor quality (VALID, INVALID, UNPOWERED, SUSPECT), time of last good measurement, and redundancy voting as established by source.
5. Detection mechanism, annunciation state, acknowledgement/recall and alert priority.
6. Exact FCOM section / physical PDF page / reviewed source date, plus `VERIFIED`, `DRAFT`, or `UNVERIFIED`.
7. Replayable test cases for nominal, failure, degraded and restored conditions.

Do not infer exact failure detection delays, numerical thresholds, internal wires, hardware sensor technology, or equipment protections from general knowledge. FCOM often documents cockpit behavior, not AMM/WDM implementation-level details.

## Network propagation - representative examples

### Electrical - section 6.20.1-4; PDF pages 1150-1153
Engine generators, APU generator and external AC are independent selectable sources. AC sources do **not parallel**. A connected new source displaces the previous source for that generator bus. Normally generator 1/2 feeds its respective side; a failed generator bus can result in its corresponding transfer bus selecting the opposite generator bus if the BUS TRANS switch is AUTO. The related generator *and main* bus can be lost while essential transfer bus power remains available. Therefore **BUS OFF does not automatically mean every consumer on that side goes dark**.

### Hydraulics - section 13.20.1-3; PDF pages 1846-1848
System A and B each have an engine-driven pump and an AC-driven pump. Engine 1 drives hydraulic A engine pump; engine 2 drives B. Separate pump output pressure switches drive low-pressure indications. A hydraulic system pressure transmitter reads combined system pressure and drives the pressure indication. Flow/actuation can fail even when a selector is ON. Bleed-air pressurizes A/B reservoirs. Each engine fire switch can isolate the corresponding engine-driven pump's fluid supply.

### Gear and braking - section 14.20.1-5; PDF pages 1866-1870
Hydraulic A normally supports gear operation and nose steering; B supports normal brakes; A automatically supplies alternate brake pressure when B is low/failed. A/B feed different autopilot and brake capabilities. Gear handle UP/OFF/DN is separate from actual gear position and safe-lock indications. Antiskid responds to actual skidding. RTO requires distinct arm/activate/disarm guards. Do not blindly write one global `hydraulicOk` Boolean.

### Fire - section 8.20.1-2; PDF pages 1234-1235
Engine 1 loops A/B detect overheat/fire. In NORMAL, if both healthy, detection requires both. If one loop fails, remaining healthy loop is auto-selected **without flight deck indication of the single failure**. If both fail, FAULT illuminates and detection is INOP. Selecting A or B makes only the selected loop operative; if it fails, FAULT/INOP. Engine fire and overheat give **different** downstream caution/fire outputs. Pulling engine fire switch closes fuel/bleed/hydraulic supply valves, trips the generator control circuitry, disables thrust reverser, and arms extinguishing squibs; **rotating** it commands discharge. See the experimental pure function at `engine/network/fire-detection-pilot.cjs`: its input loops report abstract overheat/fire detection results, NOT real thermal thresholds.

### Autoflight / sensors - section 4.20.3-4; PDF pages 1074-1075
Two independent radio altimeters supply related FCC inputs; captain RA also feeds autothrottle. Loss of respective hydraulic power or a necessary sensor/electrical input can disconnect an engaged autopilot; no arbitrary rule that a power switch instantly moves a servo. Documented RA-specific autoflight behavior must be modeled with validity, mode and time constraints.

### Warnings - section 15.20.1-2; PDF pages 1905-1906
Keep fault/event/active cause/visible caution/audio acknowledgement **separate**. Some simple faults in redundant systems only appear via master-caution recall and do not generate an immediate MASTER CAUTION. FIRE WARN acknowledgement resets the fire warning latch for future warnings while underlying hazard remains independently observable. Do not map every single sensor failure to an immediate MASTER CAUTION.

## Fault engine intended schema

```text
Environmental truth / power availability
    -> sensor physics & signal validity
    -> signal conditioning, redundancy voting, monitor
    -> fault classification (observed failure or unknown)
    -> control-law availability / interlock / actuator state
    -> cockpit indications and warning priorities
    -> event log / audio / scenarios / UI projections
```

For each fault, retain distinct values:
- `physicalFault`: e.g. actual low pressure or broken detection loop
- `detectedFault`: what the installed controller actually knows
- `displayedWarning`: cockpit annunciator output after inhibits/latches/acknowledgement
- `crewAction`: test, reset, selection or isolation command
- `resultingSystemState`: what pressure, flow, heat or power actually does

This distinction prevents the common bug where clicking a lamp changes hydraulic pressure, or failed loop A improperly triggers a dual-loop fire warning.

## Sensor families and evidence targets

| Sensor class | Output types to represent | Example | Primary documentation |
|---|---|---|---|
| Pressure switch | LOW/NORMAL/UNKNOWN discrete | Hydraulic pump low-pressure light | FCOM 13.20.3, PDF 1848 |
| Pressure transmitter | continuous quantity + validity | System A hydraulic pressure gauge | FCOM 13.20.3, PDF 1848 |
| Fuel pump pressure sensor | quantity/status + auto-shutoff event | Center tank pump protection | FCOM 12.20.1, PDF 1834 |
| Fire/overheat loops | loop health, OVERHEAT/FIRE detected | A/B dual-loop vote; selected-loop failure | FCOM 8.20.1-2, PDF 1234-1235 |
| Radio altimeter | RA feet + validity + side | FCC A/B; captain RA to autothrottle | FCOM 4.20.4, PDF 1075 |
| Wheel/air-ground | wheel speed, weight-on-wheels status | Antiskid, gear ground-lock and autobrake | FCOM 14.20.1, 14.20.4-5, PDF 1866/1869-1870 |

Sensor electrical technology and detailed analog transfer functions are **not verified** by these cockpit sections. For those, cross-check the correct aircraft AMM, WDM, SSM, and CMM before marking physical wiring or analog failure signatures verified.

## Work gates

- **V0.1 (this branch):** graph metadata, FCOM page mapping and isolated pilot dual-loop fault evaluation. Do not mark system operation as integrated.
- **V0.2:** verify every graph link against private source schematic, resolve required variant/option differences and electrical bus feeders; record reviewed evidence.
- **V0.3:** add deterministic kernel + power, fuel and hydraulic models and signal validity; scenario tests with loss and restoration.
- **V0.4:** gear, brakes, AFDS, audio, caution latches and complete sensor/fault propagation; regression/replay tests.
- **V1.0:** connect cockpit artwork and CDU instruments on a separately reviewable preview, then promote only after explicit owner approval.

**Live root Pages, mobile layouts and existing cockpit art must remain untouched by this branch.**
