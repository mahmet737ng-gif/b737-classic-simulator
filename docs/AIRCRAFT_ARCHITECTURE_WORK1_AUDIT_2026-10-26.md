# Work 1 / Aircraft State Authority — implementation and adversarial review

**Scope**: 737 Classic cockpit systems trainer, not an aircraft-certified flight model. Branch:
`architecture/state-owner-runtime-v1-20261026`, baseline `88bed66e9a46773da28b1349cbd5fb94fc7b007a`.
No images, approved cockpit asset positions, mechanical shapes, or historical engines have been modified.

## Implemented checkpoint
- `engine/runtime/aircraft-session-v1.js`: independent adapter host, duplicate domain-owner guard, dependency ordering, fail-closed commands, staging/transactional batch, immutable public snapshots, monotonic clock, deterministic replay, explicit reinitialization.
- `engine/runtime/electrical-adapter-v1.js`: authoritative Electrical V7 + source-conservative Loads V8 projection, with strict actor-based action permissions. Scenario flags are **not** silently treated as verified engine plant states.
- `engine/runtime/state-owners-v1.json`: inventory and staged ownership of other engines; unwired modules are flagged, not falsely marked complete.
- `tests/aircraft-session-v1.test.cjs`: actual upstream engine dependency, adversarial mutation, rollback, duplicate commands, unknown values, illegal source selection, fake faults, cyclic dependencies, and replay.

## Design rules
1. Existing subsystem modules stay separate. Aircraft Session is an orchestration boundary, not a new competing Electrical model.
2. Every active output domain belongs to exactly one adapter. Dependency projection is ordered and side-effect-free.
3. Snapshot copies are safe for the frontend to read, but external writers can modify state only by validated commands.
4. Cockpit actions cannot directly mutate an engine running sensor or inject Instructor failures.
5. `null` indicates unavailable source evidence: never coerce it to FALSE or TRUE.
6. Session commands and clock steps are deterministic and rollback upon validation/projection failures.
7. Reconciliation of existing actual Unified registry events still requires real integration tests. The new Session **does not claim** to be the already-active deployed Unified runtime.

## Hostile audit: defects identified before implementation
- [HIGH] Legacy Trainer Core and Electrical V7 have independent AC bus models and different initial conditions. **Mitigation:** only Electrical V7 is mounted in the new runtime.
- [HIGH] `isn-electrical-pack-v1.js` contains a fixed WarningEngine variant 737-400. **Status: open**, do not mount it as an authority for other aircraft profiles.
- [HIGH] `isn-cockpit-bridge-v1.js` suppresses rejected commands into diagnostics rather than throwing; it also reports missing BUS TRANSFER physical control. **Status: open** pending a strict physical adapter.
- [HIGH] Starting Engine/APU state can be set from scenario booleans in Electrical. **Status: explicitly limited** to SCENARIO actor; upstream ECU wiring remains open.
- [HIGH] No verified complete EP-FSI aircraft-specific CB/wiring to equipment map. **Status: open**.
- [MEDIUM] Ground STANDBY AUTO FCOM policy contradiction and TR3 fallback. **Mitigation:** upstream V7 UNKNOWN preserved.
- [MEDIUM] The User Interface is not yet subscribed to the new Aircraft Session: **not a complete Unified End-to-End pass**.

## Exit criteria / honest status
This is **phase-one architecture infrastructure**; it is **not** the full work-1 acceptance because live Unified switching, Engine/APU/CPCS/CB authoritative bridges, test-on-device and full source verification remain pending. Do not merge or deploy as a production replacement until integration/CI and variant-specific testing are verified. A green isolated Node test alone cannot prove cockpit operation.

## Planned next changes
A. Audit approved physical control registry IDs and write strict Cockpit Adapter without altering art.
B. Remove hardcoded variant from the warning session through per-profile injection.
C. Connect owner-run Engine/APU session to Electrical as read-only derived inputs.
D. Connect CB-kernel and pressurization with supported fault semantics, without guessing wires.
E. Run real browser/Unity unified tests and source-provenance acceptance.
