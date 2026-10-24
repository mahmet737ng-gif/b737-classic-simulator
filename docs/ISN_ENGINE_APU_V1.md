# ISN-03 — Engine/APU functional-source bridge, Stage 1 (2026-10-24)

## Status

`LOCAL_IMPLEMENTED_AND_NODE_TESTED` — **not yet mounted into Unified, not published, and not installation-wiring-verified.** ISN-02 was published earlier; that does not itself publish ISN-03.

This initial stage works across the existing 737 Classic variant-selectable architecture. The EP-FSI reference airplane does **not** create a separate engine-physics model. This component does not compute aerodynamic forces, actual engine N1/N2 acceleration, EGT, ignition, fuel flow or APU spool-up.

## Deliverables

- `engine/integration/isn-engine-apu-v1.js`: pure, replayable command/session adapter.
- `engine/integration/isn-engine-apu-contracts-v1.json`: machine-readable typed functional edges, source references, UNKNOWN gates, and explicitly prohibited inferred edges.
- `tests/isn-engine-apu-v1.test.cjs`: source observation, APU generator selection, hydraulic/fuel UNKNOWN, pneumatic bleed, fire-warning independence, faults, replay and source gate QA.

## Commands and signal ownership

| Command | Meaning | Consequence |
| --- | --- | --- |
| `SOURCE_REQUEST {device,request}` | Cockpit/instructor START or SHUTDOWN intent | Records intent only. Running state unchanged. |
| `SOURCE_OBSERVATION {device,running,origin}` | Explicit engine/APU running true / false / null | The *only* owner of the three shared running inputs. Instructor inputs require `instructor:true`. |
| `ELECTRICAL {action}` | Existing Electrical V7 selection, generator faults, bus configuration | Reuses ISN-01; blocks direct modification of shared running state. |
| `PNEUMATIC {action}` | Existing bleed/pack switches, trips and source-independent sensors | Reuses Pneumatics V6; blocks direct modification of shared source and ground inputs. |
| `PACK {action}` | Existing ISN-01 fuel/hydraulic pump switches, observed power, warning sensors | Enforces SOURCE_GATED; explicitly blocks switching to TRAINING_SURROGATE. No guessed equipment power bus. |

An observation has a distinct provenance label (`INSTRUCTOR_OBSERVATION` or `EXTERNAL_SENSOR_OBSERVATION`). Such an input is **not** independently certified as an aircraft sensor. `SOURCE_OBSERVATION.running=null` withdraws prior truth; it does not turn the source OFF.

**Conservative read gate:** because Electrical V7 and Pneumatics V6 currently default to both engines running, ISN-03 does not expose *any* derived bus, pneumatic, pump or warning status until **all three** Engine 1 / Engine 2 / APU running statuses have been explicitly observed. Otherwise, outputs are `null` and the missing source IDs appear in `unresolved`. This avoids misrepresenting training defaults as real observations. Future revisions may replace the global gate with independently justified port-level three-state propagation.

## Source-located propagation

1. Engine 1/2 observed running → Electrical V7 GEN1/GEN2 source readiness (FCOM 6.20.1–4), subject to generator fault and source selection. An electrical generator fault does **not** imply that the engine stopped or its pneumatic bleed failed.
2. APU observed running → source eligible for an *explicit* APU GEN selection. It does **not** automatically connect to generator bus 1/2 (Electrical V7).
3. Engine 1/2 and APU observed running → Pneumatics V6 readiness (FCOM 2.20.1–2). Opening bleed valves still requires their normal switch/healthy/trip conditions. APU manifold side distribution and actual duct PSI remain UNKNOWN.
4. Electrical effects pass to the existing ISN-01 six fuel pumps / two hydraulic electric pumps and WarningEngine. Installation-specific pump feeder buses are UNKNOWN, and their operating states cannot be inferred from an energized generator bus (FCOM 12.10.2–3, 13.10.1; Electrical Loads V8).
5. Engine/APU fire warnings remain driven by **separate explicit fire sensor inputs** through the existing WarningEngine (FCOM 15.20), never automatically by a stopped engine, requested start, or generic generator fault. No new fuel/hyd aural warning is invented.

## Example integration

```js
const Session = require('../engine/integration/isn-engine-apu-v1').Session;
const session = new Session({ElectricalPack, Electrical, Loads, TrainerCore, WarningEngine, Pneumatics});
for (const device of ['engine1', 'engine2', 'apu']) {
  session.send({type:'SOURCE_OBSERVATION', device, running:false,
    origin:'INSTRUCTOR_OBSERVATION', instructor:true});
}
session.send({type:'SOURCE_REQUEST', device:'apu', request:'START'}); // only intent
session.send({type:'SOURCE_OBSERVATION', device:'apu', running:true,
  origin:'INSTRUCTOR_OBSERVATION', instructor:true});
session.send({type:'ELECTRICAL', action:{type:'SELECT_SOURCE', source:'APU', side:1}});
session.send({type:'PNEUMATIC', action:{type:'CONTROL', key:'apuBleed', value:'ON'}});
const snapshot = session.get();
```

## Next exit gates

1. Source extraction for real starter/ignition/N2/EGT/fuel start contracts and APU startup/shutdown, with source page, effectivity and review before introducing any automatic state transition.
2. Verify specific installation pump-bus feeders, pneumatic power and bleed/duct routing where published FCOM is insufficient. Preserve UNKNOWN until approved WDM/electrical load analysis is available.
3. Add typed UI commands and source annunciations using **existing** IDs/positions in Unified, outside the frozen OH01–OH25 atlas; retain existing CDU and profile selection.
4. Run browser/iPad manual checks, approval checkpoint, and separate explicit publication. Do not edit locked artwork or claim flight-ready behavior.

## Verification

`node tests/isn-engine-apu-v1.test.cjs`

All changes are new files outside `panel-mosaic-lab/all-overhead/`. Run the frozen visual guard before any eventual publication.
