# ISN-08 — Engine/APU Fault Scenarios & QRH Checklist Integration

Date: 2026-10-23  
Aircraft target: B737-300 EP-FSI MSN 29340; engine CFM56-3B-1 20K  
Scope: deterministic simulator training pilot in `design/integrated-systems-network-v01`. **NOT a flight-use checklist**, not a claim of QRH current operational approval, not deployed on the live cockpit.

## User-driven change to ISN-07
The user explicitly did **not** want an alert or required crew action for exceeding the 2-minute starter use limit. `tickProtection` was modified to keep `starterElapsedSeconds` for optional instructor telemetry but **not** to create `STARTER_DUTY_LIMIT`, recommend `CREW_ABORT_START`, change the start switch, or create any checklist case on time alone. Other preexisting start retry logic (documented 20-second / 3-minute rests and premature re-engagement condition) is preserved; these remain separately source-derived procedural constraints.

## Real engine-to-checklist graph

```
Aircraft state: generators / APU / pump fuel / bleed / engine N2 / EGT / fire sensors
    -> existing ISN-01..07 system derivation & pressure sensors
    -> ISN-08 source-indexed QRH checklist predicate registry
    -> active case IDs and reference QRH page/section
    -> selected checklist reference and brief training steps
    -> observations validated against real current switch state
         OR explicitly marked CREW_ATTESTED for controls without sensors
    -> immutable state replay/audit trail
```

The model NEVER performs real checklist switch actions on behalf of a checkbox, and it NEVER infers a physical APU FIRE detector, Engine 2 fire circuit, or an engine tailpipe/fire suppression signal that was not provided. QRH pages and brief step captions are reference *pointers*, not embedded copyrighted complete checklists.

## Reference QRH source and source-to-trigger crosswalk

Private user-uploaded QRH source identifier: `QRH-SEPEHRAN-D6-27370-3-500-SEP-20161216`, 584 physical PDF pages, explicitly labeled “DO NOT USE FOR FLIGHT” in the source.

| Test input / confirmed condition | Case ID | QRH printed section | Physical QRH PDF page | Trigger confidence |
| --- | --- | --- | --- | --- |
| EGT at/above 725°C during ground start, no EGT rise after specified time, N2 acceleration slow after EGT rise, or no oil at stable idle | `ABORTED_ENGINE_START:1/2` | 7.1 | 149 | FCOM/QRH-informed detected conditions; no synthetic EGT |
| Engine bleed high temperature/pressure fault *latched* | `BLEED_TRIP_OFF:1/2` | 2.8 | 82 | Existing BLEED TRIP latch, not an invented PSI threshold |
| Injected APU FIRE protection input | `APU_FIRE:APU` | 8.1 | 189 | INJECTED, not a new installed APU fire sensor |
| Injected APU low oil pressure shutdown input | `APU_LOW_OIL_PRESSURE:APU` | 7.12 | 160 | INJECTED physical-input conclusion |
| Injected APU overspeed shutdown input | `APU_OVERSPEED:APU` | 7.13 | 161 | INJECTED physical-input conclusion |
| FCU failure or high oil temperature shutdown input | `APU_FAULT:APU` | 7.12 | 160 | General APU fault training approximation |
| **Engine 1** fire detector confirmed by existing A/B detector pilot | `ENGINE_FIRE:1` | 8.2 | 190 | Detector pilot, not Engine 2 or actual suppression system |

The source QRH also has Engine Failure or Shutdown at §7.14 PDF p162. That checklist is indexed but **not automatically offered on mere crew switch-off**, because a commanded normal shutdown is not proof of a spontaneous engine failure. Exact installed flight conditions and engine failure evidence remain unresolved.

## Modules and interfaces

- `engine/network/qrh-checklist-router.cjs`: reference registry, typed `TYPE:UNIT` case IDs, precedence-independent active predicates, `deriveChecklists`, step evidence guard, active/resolved retention, audit record.
- `engine/network/qrh-training-scenarios.cjs`: replayable named scenarios for seven engine/APU/bleed/fire test conditions; script starts cold/dark and uses existing ISN-06/07 actions, not any fake “force checklist” shortcut.
- `engine/network/integrated-aircraft-kernel.cjs`: derives case IDs in same snapshot. Actions: `OPEN_CHECKLIST`, `CONFIRM_CHECKLIST_STEP`, `RESET_CHECKLIST` and event `checklistChanges`. `ENTER_COLD_DARK` resets training progress.
- `power-consumers-lab/index.html`: fault selector, active case/status/provenance, per-step buttons, evidence states and an explicit crew attestation flow.
- `tests/qrh-checklist-routing.test.cjs`: deterministic scenario replay, routing and QRH page references, observational blocking, crew attestation, resolution, latch reset, no unrequested starter duty alarm.
- `tests/power-consumers-browser.test.cjs`: identical Node/browser outputs for each scenario and checklist actions; script validation and panel controls.
- `tools/build-power-consumers-lab.cjs`: rebuilds browser runtime from CommonJS module sources; CI checks exact equality.

## Checklist evidence and non-instrumented actions

A selected case is not considered completed merely because a fault clears. Confirmation is independent of condition resolution. Physical signals such as engine start lever at CUTOFF, engine start switch OFF, APU switch OFF and BLEED TRIP latch cleared are examined from state. If that signal contradicts confirmation, the command is rejected. If a checklist action requires controls not yet modeled (e.g. thrust lever, fire switch discharge timing, anti-ice, certain branching), `crewConfirmed: true` is required and audit marks `CREW_ATTESTED`, never sensor-verified.

**Not a full QRH implementation:** The brief reference step captions do not represent the complete QRH, branch detail, checklist priority or flight-critical conditions. In particular an instructor-injected APU FIRE flag does not automatically model firing extinguishing bottles; Engine FIRE case is only for the currently implemented Engine 1 detection pilot.

## Outstanding gates for real cockpit incorporation

1. Source effectivity check and reconciliation with current approved EP-FSI operator QRH; 2016 QRH is training-reference material.
2. Complete APU and Engine 2 fire detection/overheat/actuator inputs, thrust lever, bottle discharge controls and actual monitored sensors.
3. Full QRH branch tree and condition-specific timing; safely maintain references without committing proprietary page reproductions.
4. EGT/oil/fuel flow turbine dynamics where sourced, vs current externally observed sensor flags.
5. Real-browser E2E visual/manual verification; this CI tests source parity, deterministic commands and JavaScript syntax but not pixel-perfect cockpit artwork.
6. Production cockpit coordinates, release approval; all changes remain confined to development branch.

## Reproduction

```sh
node tests/pneumatic-start-protection.test.cjs
node tests/qrh-checklist-routing.test.cjs
node tests/engine-apu-integration.test.cjs
node tools/build-power-consumers-lab.cjs --check
node tests/power-consumers-browser.test.cjs
```

All older ISN-01..07 regressions continue in the branch workflow. **No private FCOM/QRH scans or proprietary pages were committed.**
