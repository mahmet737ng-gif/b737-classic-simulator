# Electrical Integration Test 01 — Boeing 737 Classic

## Status and scope (2026-10-23)

**Implemented on development branch only.** This is a deterministic, stand-alone FCOM-anchored **electrical dependency pilot** and test suite. It is not connected to the cockpit UI, the full aircraft physics engine, the hydraulic pressure solver, or a certified aircraft wiring model. Production site and `main` are unchanged.

**Code:** `engine/network/electrical-power-pilot.cjs`  
**Test:** `tests/electrical-integration.test.cjs`  
**Branch CI:** `.github/workflows/electrical-integration.yml`

Source of truth: private Sepehran Boeing 737-300/400/500 FCOM, Vol. 2, Chapter 6, **physical PDF pp.1150–1168**, specifically:
- §6.20.1–4 (PDF 1150–1153): AC generator source switching, non-paralleling, generator/main/transfer buses, ground external power and automatic transfer, single-generator galley shedding.
- §6.20.8–9 (PDF 1157–1158): TR1 from transfer bus 1, TR2 from transfer bus 2, TR3 from main bus 2; DC bus tie opens on BUS TRANS OFF or ILS glide-slope capture.
- §6.20.11–12 (PDF 1160–1161): automatic standby battery/inverter fallback in flight and AUTO ground inhibit during complete loss of AC.
- §6.20.18–19 (PDF 1167–1168): specifically listed failed-generator loads when in flight with normal transfer buses.
- Fire §8.20.1 (PDF 1234): engine fire detector powered from battery bus; extinguisher fed from hot battery bus.

No original manual tables or Boeing page scans are copied into public GitHub. Source-to-rule references only.

## Executable behavior

The pure function accepts *explicit* flight phase, electrical-source assignments for generator buses 1/2, availability for GEN1/GEN2/APU/EXT, battery usability, BAT/ON/OFF control states, BUS TRANS AUTO/OFF, glideslope capture, TR availability and inverter availability. It returns bus states, transfer-bus source, TR energization, battery/standby states, single-generator galley shedding, applicability-guarded source-traced consumer effects and fire detection/extinguisher bus-power outputs.

**Source assignments are initial electrical contactor configurations for test fixtures**, not a simulation of momentary switch commands, breaker protection, starter transients, generator quality, GCU relays or electrical synchronization. Each generator bus has at most one source; no AC paralleling is modeled. Flight APU use is limited to one bus. Ground external power requires the battery switch, and isolated ground-service-only power does not energize main generator buses.

### Expected flight test: GEN1 lost / GEN2 operating / BUS TRANS AUTO

| Signal / component | Expected |
|---|---|
| Generator bus 1; main bus 1 | UNPOWERED |
| Generator bus 2; main bus 2 | POWERED |
| Transfer bus 1 | POWERED, alternate from generator bus 2 |
| Transfer bus 2 | POWERED, normal from generator bus 2 |
| TR1 / TR2 / TR3 inputs | POWERED / POWERED / POWERED |
| DC bus 1 / DC bus 2 | POWERED under normal tie |
| AC and DC standby buses | POWERED |
| Galley load | SHED by single-generator in-flight rule |
| No. 1 tank forward fuel pump / center tank right pump | FCOM case says INOPERATIVE |
| Hydraulic System B electric pump | FCOM case says INOPERATIVE |
| Master caution / LOW PRESSURE light | **NOT calculated**: pump state, delay and annunciator power not modeled |

### Expected flight test: GEN2 lost / GEN1 operating / BUS TRANS AUTO

| Signal / component | Expected |
|---|---|
| Generator bus 2; main bus 2 | UNPOWERED |
| Transfer bus 2 | POWERED, alternate from generator bus 1 |
| TR3 input | UNPOWERED because main bus 2 is unpowered |
| Galley | SHED |
| No. 2 tank forward fuel pump / center tank left pump | FCOM case says INOPERATIVE |
| Hydraulic System A electric pump | FCOM case says INOPERATIVE |
| Battery bus | POWERED in test if explicit usable battery is present; **no battery voltage model** |

### Expected blackout / standby differentiation

With both normal generator sources lost:
- **AIR, standby AUTO:** usable battery and inverter can energize AC standby; usable battery energizes DC standby; fire detector can remain powered through the battery bus; engine fire extinguisher feed remains on hot battery bus.
- **GROUND, standby AUTO:** both standby buses remain unpowered when *all* AC power is lost, to prevent automatic battery discharge.
- **GROUND, standby BAT:** manual selection bypasses air/ground inhibit where the input battery is usable.
- **AIR, inverter inoperative:** AC standby loses battery-inverter supply even if DC standby remains available.

## Automated assertions

The test covers: nominal two-engine AC; isolated GEN1 failure; isolated GEN2 failure; source nonparallel conditions; BUS TRANS OFF; ILS glideslope DC separation; in-flight dual AC blackout; total loss with depleted battery; single inverter failure; ground inhibit; forced standby BAT; forced standby OFF; ground external switching with battery on/off; external ground servicing without energizing generator buses; ground APU feeding two buses; attempted illegal in-flight APU dual feed; in-flight single-side APU backup; source/phase input validation; one TR failed with normal DC tie; uncertain TR3 backup behavior; and fire detector functional tests driven by computed battery bus status.

Local V8-equivalent evaluation of JavaScript source against a strict assertion shim completed **86 passing assertions** before commit; standalone Node/GitHub Actions result must be checked independently. Execute directly from repo root:

```sh
node tests/system-network.test.cjs
node tests/electrical-integration.test.cjs
```

## Unresolved or intentionally bounded behavior

1. Detailed TR3 backup path to DC buses in degraded relay cases is **UNRESOLVED**, never converted to a guessed voltage.
2. Ground partial failure standby AUTO is **UNRESOLVED**; only explicit all-AC-loss ground inhibit is modeled.
3. Battery capacity, charge, DC regulation, TR loads, transient timing and electrical protection are not modeled.
4. System B/A electric pumps and affected fuel pumps report *FCOM equipment inoperative* case evidence, not a computed hydraulic/fuel pressure or a lit lamp. The recorded light name is the source table's expected indicator when its prerequisites apply.
5. Galley load exceeding APU design capacity requires a load-demand threshold not represented; no load-based APU shedding simulated.
6. AC standby/fire indication lamp availability and source-specific buses for other consumers require further reference audits and effectivity checks.
7. The source FCOM contains configuration-specific panels/options; model selection must be gated when adding other aircraft tail numbers.
8. AFM numerical performance values are **not injected** into this initial power-distribution model.

## Acceptance gates for promotion to a full system model

- Accurate source-provenance for each externally visible rule and effectivity.
- True deterministic kernel that records changes of generator switch, GCU trip/reset and BUS TRANS settings as *events* instead of accepting only snapshots.
- Tests for failure followed by power restoration, fault cause vs indication, and source transfer without simultaneous nonparallel AC bus connections.
- Independently reviewed DC/TR3 tie/standby source behavior against FCOM schematic and applicable maintenance schematics.
- Connection of bus outputs to validated hydraulic pump and fuel pump *state*, then pressure sensor outputs and actual annunciation decisions.
- Separate test deployment, browser verification, owner approval; do not change live web cockpit or main site without approval.

**Important:** `GEN1 FAILED` does not mean `all left-side equipment failed`; under AUTO the essential transfer bus can continue from generator bus 2.
