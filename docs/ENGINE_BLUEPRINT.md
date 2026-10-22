# B737 Classic — Complete Simulator Engine Blueprint (design v1.0)

> 2026-10-22 | Status: **ARCHITECTURE DESIGNED / NOT SYSTEMS IMPLEMENTED**.
> This document is the single design contract for future AI agents and developers. The live cockpit website is currently a visual demonstrator and is **not** evidence that any aircraft system has been implemented or validated.
> Scope: Boeing 737 Classic 737-300 / 737-400 / 737-500, subject to aircraft and operator option differences.
> Primary authority: owner-supplied Sepehran Airlines 737 Classic FCOM, with chapter/page/cycle captured for every rule. FCTM and QRH support procedures, not replacement system laws. IXEG, PMDG and CSS are *visual and user-interaction references* only.

## 0. Non-negotiable product decisions

1. **Immutable master artwork.** The user-supplied PNG '1000166281.png', native 6424×2212 RGBA, SHA-256 'b6c206418feb44b43bd134cb57a51dddd8bbe928859382d3864f3fbcc5cbc1c8', is the authorized visual base. Do not substitute the existing WebP, re-render it with AI, stretch its proportions, or cover it with generic cockpit graphics. File must be copied byte-for-byte into the repo before switching the live site. Binary import is still pending; the file hash is a *local verification*, not a claim of deployment.
2. Existing root site and photo-based labs stay unchanged until an independently testable new version passes screenshot comparisons and the owner explicitly approves switching.
3. **One source of truth:** a single state kernel owns system state. Images, indicators, audio and instruments are projections; they must not directly mutate system state.
4. Simulation behavior follows identified manual rules. Missing/ambiguous details are flagged 'UNVERIFIED', not filled with arbitrary durations, detents, forces, faults or operating limitations.
5. Distinguish **a switch command**, **mechanical switch position**, **a system request**, **actual system state**, **annunciation** and **display readout**. They may differ.
6. The engine must be deterministic, modular, replayable and independent of web rendering. No React/DOM/Canvas/SVG dependency inside the systems core.
7. Do not claim certification or real-aircraft operating accuracy. The simulator is an educational software project.
8. All development work must be traceable in 'docs/ENGINE_TASKS.md', including pending tests, explicit approval and version provenance.

## 1. Engine diagram

~~~text
FINGER / MOUSE / KEYBOARD / EXTERNAL FLIGHT DATA
         |
   Input adapters → normalized aircraft commands
         |
Command validation (permissions, guards, mechanical interlocks)
         |
Physical control machine (pull/push, detent, spring return, lever travel)
         |
Deterministic state kernel [fixed timestep; event log; snapshots]
         |
System dependency graph
  ├─ ELEC + APU + ENGINE + FUEL
  ├─ HYD + PNEUMATIC + PRESSURIZATION
  ├─ ICE / HEAT + FIRE / PROTECTION
  ├─ FLT CTRL + GEAR + BRAKES + AUTOBRAKE
  ├─ AIR DATA / NAV / IRS / FMC / COM
  ├─ MCP / FD / AFDS / AUTOTHROTTLE
  └─ LIGHTS + WARNING / CAUTION
         |
Derived outputs (power / pressure / motion / modes / failures)
         |
Annunciators + instrument needles + digits + audio + event feeds
         |
Renderer adapters (user PNG, transparent control sprites, SVG, WebGL)
~~~

System models may feed one another, but must do so via typed state and declared dependencies—not by calling UI functions.

## 2. Versioned source layout (planned)

~~~text
engine/
  core/
    clock.js             fixed simulation time + selectable sim rate
    state-store.js       typed, immutable authoritative state
    command-bus.js       input → validation → approved commands
    event-log.js         timestamped, deterministic action log / replay
    dependency-graph.js  controlled systems update ordering
    snapshot.js          serialize + migrate + restore
  mechanics/
    registry.js          physical control definitions
    motion.js            position, travel, easing, detents
    interlocks.js        guards, pull-to-turn, lever gate, lockout
  systems/
    electrical.js        buses, DC/AC, sources, power distribution
    fuel.js              tanks, pumps, feed, valves
    apu.js               APU startup/availability/status
    engines.js           N1/N2/EGT/oil/starter/ignition
    hydraulics.js        A/B/standby hydraulic availability
    pneumatics.js        bleed, packs, pressure, anti-ice feed
    pressurization.js    cabin altitude/differential pressure
    flight-controls.js   surfaces, trim, spoilers, flaps
    landing-gear.js      handle, locks, extension/retraction
    brakes.js            normal/alternate/antiskid/autobrake
    avionics.js          air data, IRS, NAV/COM
    autoflight.js        MCP, AFDS, flight director, autothrottle
    fire-warning.js      detection, suppression, warnings
    ice-heat.js          thermal and ice protection
    lights.js            cockpit, exterior, annunciators
    indications.js       display transforms and cautions
  configuration/
    737-300.json
    737-400.json
    737-500.json
    operator-options.json
  adapters/
    training-scenario.js
    external-sim.js      normalized simulator bridge (future)
    ui-events.js
  validation/
    fcom-rules.json      trace from every implemented rule to page
    control-audit.json   geometry/hardware sign-off
  spec/
    control.schema.json
    event.schema.json
    state.schema.json
    control-catalog.example.json

ui/
  artwork/
    source/              locked user PNG, unchanged
    masks/               reconstruction of *background only*
    controls/            individual transparent sprites with alpha
  coordinate-calibration/
  renderers/             SVG / CSS / WebGL backends, independent of engine
  interaction/           hit areas, zoom/pan, pointer capture
  cockpit-panels/
tests/
  engine/
  mechanical/
  systems/
  scenarios/
  replay/
  visual/
~~~

The paths are the planned target architecture. **Only the spec files shipped with this design commit currently exist.** Never mark a planned JS module as implemented without code and tests.

## 3. Contracts / data ownership

**AircraftState** (versioned) separates:
- config: aircraftVariant, aircraftOptions, FCOMEdition, sessionMode
- environment: onGround/airborne, air/ground switches, altitude, airspeed, temperature, externalPowerAvailable and weather (only from scenario or connected simulator)
- controls: physical detent/continuous value, guard position, pulled status, active travel, lock state
- electrical: generation, distribution, AC/DC/standby bus voltage/availability, failures
- engines: state, RPM/temperatures/pressure, failures
- hydraulics/fuel/bleed/pressurization: state variables and availability
- autoflight/navigation/flightControls/gear/brakes: internal state with required previous-state history
- warnings: **derived signals**, never pilot-controlled UI flags
- instruments: **derived measurements**, not hardcoded number strings
- failures: injected fault inputs with source/time
- metadata: simulation time, event index, engine schema version

**ControlDefinition**: globally stable ID; panel ID; type; detents + end-stop/continuous ranges; accepted gestures; mechanical guard, spring return, pull-to-rotate gate; conditional lockouts; visual geometry (reference image checksum, 6424×2212 basis, hit polygon, pivot, travel path, sprite IDs); source citation; validation state.

**Command**: 'id', 'atSimMs', 'source', 'controlId', 'action', 'value', 'preconditions' optional. Example actions: 'SET_DETENT', 'ROTATE_STEP', 'BEGIN_PULL', 'END_PULL', 'RAISE_GUARD', 'PRESS', 'RELEASE', 'MOVE_LEVER', 'INJECT_FAILURE'. The core returns 'accepted/rejected' with a machine-readable reason; the renderer animates only the approved mechanical transition.

**Event**: id, monotonic simulation timestamp, entity, old/new value, event type, origin, reason, manualRuleId. Event log permits replay and bug reproduction.

**Output**: read-only published deltas to rendering and instruments. It must never include model-generated arbitrary aircraft state values.

Schemas in 'engine/spec/' define minimum mechanical and message validation, not FCOM-complete logic.

## 4. Mechanical engine — exact hardware first

Required device families:
- Rotary finite-detent (e.g. AUTO BRAKE), including end stops and *pull-to-turn* where required.
- Rotary continuous (e.g. dimmer; measured range and velocity).
- Rotary encoder with infinite turns (MCP COURSE / HDG / ALT, with wrap or clamp rules specific to each numeric setting).
- Two-/three-position toggle, with correct hinge and perspective.
- Momentary push, maintained push, guarded push, push-pull selector.
- Lift-and-flip guarded switches, spring-loaded START/TEST.
- Gated levers with UP/OFF/DOWN detents and state-dependent lockouts.
- Circuit breakers where present (future physical / electrical model).
- Annunciators are **outputs**, not buttons unless the hardware is an actual illuminated test/reset pushbutton.

Motion parameters: axes, 3D pivot, optical projection onto original PNG, travel vector or rotation, stop angle, acceleration/deceleration, spring-return phase and optional sound. Values remain 'unmeasured' until pixel + reference verification. Controls must support finger dragging, stepping, wheel/keyboard, mobile accessibility and pointer cancel; no unintended wrap on physical end stops.

### First controlled examples sourced to FCOM

**AUTO BRAKE** — FCOM Ch 14, §14.10.5:
- Select positions RTO / OFF / 1 / 2 / 3 / MAX in the physically correct order, not generic equal angles.
- MAX is gated by pulling the knob out before rotation into MAX.
- OFF disables autobrake; landing deceleration settings and RTO require actual context and system availability for effects.
- AUTOBRAKE DISARM is a *system-derived light*; manual states in the old prototype must be removed as authoritative behavior.
- Geometric locations, specific angles and travel times must be calibrated from the user's PNG and supplementary real reference—not invented.

**LANDING GEAR** — FCOM Ch 14, §14.20.1–14.20.2:
- Handle detents UP / OFF / DN; OFF removes hydraulic pressure from gear system; does **not** mean gear retracts to OFF.
- On ground, lever UP is physically blocked unless override is deliberately actuated; in flight air/ground release permits it.
- Handle position is NOT landing gear actual position; nose and two main gear positions, mechanical locks and lamps have distinct state.
- Gear movement depends on hydraulic pressure, air/ground and actual state; no fixed timer claims based on CSS animation duration.
- Three green lights are allowed only when corresponding gear is down and locked. Transit/unsafe indication logic requires the exact manual rule before acceptance.

**ANTISKID** — FCOM Ch 14, §14.10.5:
- Guarded ON / OFF behavior and distinct 'ANTISKID INOP' condition.
- Antiskid OFF can illuminate AUTO BRAKE DISARM when autobrake is armed; other disarm causes require separate rules.
- Fault conditions are modeled through fault state, not clicking a lamp.

## 5. System computation and update order

Use fixed step 'dt = 20ms' by design as an initial *software scheduling policy*, NOT a Boeing timing claim; rendering runs separately at display refresh. Sub-stepping for electrical/protection transitions is permitted when justified; validate numerical stability before setting acceptance thresholds.

Per tick:
1. Normalize time, flight inputs, instructor fault injections and inbound bridge data.
2. Sort and validate pending commands in deterministic sequence, including aircraft options and guard/interlock state.
3. Advance mechanical motions and time-dependent control events.
4. Calculate source availability: environment + electrical/engine/APU/fuel feedback with bounded update methods.
5. Advance dependency-ordered physical models (including hydraulics, pneumatic, controls, gears, brakes, AFDS).
6. Evaluate derived annunciations and instruments from system outputs, including caution priorities and time delays when documented.
7. Commit one authoritative state version; append events; publish a read-only diff for clients.
8. Renderer interpolates visual poses from physical state; audio adapter consumes events.
9. Snapshot/replay controls, runtime settings and training scenario states as separately versioned artifacts.

Cyclic physical dependencies must be resolved with documented lag / substepping, never arbitrary recursive loops. Warn on non-convergence.

## 6. Major system modules and dependencies

| System | Models to implement | Inputs / dependencies |
| --- | --- | --- |
| Electrical | AC/DC power sources, battery/standby, bus transfer, voltage, load availability | Ground power, APU/engine generators, switches, failures |
| Fuel | Tanks, valves, pumps, transfer/feed, fuel quantities | Fuel state, electrical power, engine fuel demands |
| APU | Start, running conditions, available electrical/pneumatic output | Fuel, battery/electrical, start switches, failure |
| Engines | Start logic, spooling, ignition, fuel flow, oil, indications | Fuel, bleed/starter power, electrical, throttle |
| Hydraulics | A/B/standby pressure, pump availability, accumulators | Engine/electric pumps, power, fluid/loads |
| Pneumatics | Bleed source, isolation, packs, duct pressure | APU/engines, valves, demand, anti-ice |
| Pressurization | Cabin pressure target and safety limits | Airflow, flight altitude, outflow control |
| Flight controls | Yaw damper, trim, spoilers, flaps, actuators | Hydraulics/electrical, speed, pilot input |
| Gear | Lever gate, gear up/down locks, actual positions | Hydraulics, air/ground, manual extension |
| Brake | Normal/alternate, antiskid, autobrake/RTO, accumulator | Hydraulics, speed, wheel logic, spoilers, thrust |
| Ice/heat | Anti-ice demand, window/probe heat | Electrical, bleed, temperature |
| Air data / NAV | Airspeed/altitude/headings, radio sources, alignment | Environment, equipment power, nav data |
| Autoflight | MCP, FD, AFDS modes, A/T logic and disengagement | Sensors, radio/nav/FMC, electrical, air/ground |
| Lighting | Dimmers, exterior lighting, test conditions | Electrical source, selectors |
| Warnings | Master caution/fire warning, discrete alerts, sounds | All relevant systems + suppression/reset rules |
| Instruments | EICAS-style engine indications where fitted, gauges, MCP windows, EFIS and FMC | Valid aircraft variant + computed outputs |

Each module must declare a public 'step(state, dt, inputs) -> patch/events' interface, schema validation and a conformance-test suite. Model order must derive from a dependency registry, not UI events.

## 7. Graphic / image engine (strict user requirement)

- The original PNG is a **fixed, immutable bitmap reference**, not an instruction to generate a different cockpit.
- Maintain a geometry manifest in native coordinates 6424×2212; hitboxes and movements always transform through the **same** image-to-screen matrix to prevent zoom drift.
- Create transparency-isolated sprites or accurate textured geometry for each original part; reconstruct hidden paint under moved parts without replacing neighboring text, screws or panel hardware.
- Require four views before accepting a physical control: source crop, background repair, isolated movable layer, motion preview.
- Handle interpolation can be smooth while true system state progresses separately. Zoom affects rendered art scale and hit testing, not detent count or lever actual position.
- Keep web, mobile and high-DPI pixel positions equivalent. Independent screenshot QA at base, 2× and 3× zoom.
- Whenever sprites are completed, hide obsolete generic SVG stand-ins **only for verified replacements**, not wholesale.
- Stop any automatic publishing of AI-generated images, fake switch meshes or alternative base imagery.

## 8. Aircraft configuration, scenarios and external simulation

- All differences among 737-300/400/500, operator modifications and avionics packages are explicit flags and reference editions, not guessed.
- Start with one signed-off Sepehran 737CL reference configuration; then add verified option packs.
- Training scenario is a separate input adapter: cold/dark, GPU, APU, engines started, climb, approach, landing, rejected takeoff, system fault. Presets establish initial conditions, NOT fake direct annunciator output changes.
- External flight simulator bridge (X-Plane, FSX, MSFS, P3D) must implement a normalized typed adapter. Never trust external data to bypass aircraft limits; distinguish remote aircraft ownership vs local engine ownership.
- Serialize engine state with schema migrations; keep event-replay logs for test reproduction. Secrets and user identity are not part of aircraft state.

## 9. Validation, traceability, completion criteria

Every physical device and system rule has status: DRAFT → IMPLEMENTED → TESTED → FCOM_VERIFIED → USER_ACCEPTED. A status cannot jump to VERIFIED just because a website animates.

Automated checks (planned):
1. Unit: detent mechanics, end stops, guard gating, spring return, rejected commands.
2. Systems: source dependency behavior, alarms, each known transition and exceptional case.
3. Integration: cold/dark → power-up → APU → start → flight → descent → landing → shutdown with required preconditions.
4. Determinism: identical initial state + command log → identical result; save and restore produce equal outputs.
5. Variants: features absent/present by actual aircraft configuration.
6. Visual: pixel alignment and lever/mask layering vs original 6424×2212 PNG across zoom, devices and aspect ratios.
7. Regression: external simulator input latency, UI gestures, state sync, fail/recover and scenario recovery.
8. Performance: fixed-tick operation without dropped render frames (quantitative thresholds will be measured on target phones and PCs).
9. Safety of claims: warnings against real-world navigation and no false aircraft system labels.

Rule metadata example:
- ruleId: 'GEAR-14.20-LOCK-GROUND'
- source: 'Sepehran B737CL FCOM'
- section: '14.20.1'
- edition/revision: tied to verified uploaded manual
- paraphrase: on-ground gear lever UP lock unless override
- scope: supported variants and installed option
- test IDs: scenario ground/override/airborne
- signoff: absent until owner accepts

This architecture document is a design, not a claim that the simulation is complete. The engine's first implementation milestone must be a tested **mechanics core + state bus** with two FCOM-traceable exemplar subsystems: gear and autobrake/antiskid.
