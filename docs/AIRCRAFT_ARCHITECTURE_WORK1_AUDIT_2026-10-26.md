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

## Adversarial execution evidence (GitHub Actions)
- CI `Aircraft State Architecture V1` first run **FAILED 3/20**: inherited V7 hot-start default in COLD_DARK, zero-step revision changed, and UNKNOWN standby test affected by hot start. Production logic was fixed, not weakened tests.
- After the fixes: **24/24 dedicated adversarial tests PASS**, Electrical V7 **47 PASS**, Electrical Loads V8 **47 PASS**, pre-existing integrated training/rule tests **40 PASS** (workflow run 40385710124).
- Second-pass vulnerabilities discovered and corrected: owner names overlapping by namespace prefix (`elec` vs `elec.bus`), unbounded O(n) duplicate-ID Map cloning on each command, no explicit indication when capped history could not replay a complete session. Added `exportReplay()` strict completeness guard and staged IDs.
- Read-only diagnostics for existing live Unified: `engine/runtime/unified-authority-diagnostics-v1.js`, exposed by `window.B737ISNCockpitV1.getArchitectureAudit()`; no parallel engine and no change to locked cockpit artwork.
- Strict audit remains BLOCKED when BUS TRANSFER physical wiring is absent, when ECU snapshot is missing, when any projected annunciator disagrees with Electrical V7, or when the legacy Bridge recorded rejected inputs.
- The legacy ISN warning session is still hardcoded to 737-400 and must not be called profile-accurate for 737-300 or 737-500.
- Because the architecture host is new and not yet the active Unified owner, the full Work 1 **is still in progress**. Passing CI is not a substitute for a real browser/Unity end-to-end test.

## Actual live Unified integration boundary
`panel-mosaic-lab/cockpit/isn-cockpit.js` already runs `ISN1318ECUTestbenchV1`, which embeds the existing ISN pack and Electrical V7 state. Swapping in an independent new Electrical Session beside it would **introduce the exact dual-owner defect this task is meant to solve**. For this reason the new Session remains a tested, opt-in architecture candidate while the actual live Unified receives a **read-only authority diagnostic** first. A migration adapter must delegate to the existing ISN ECU, not instantiate a competing engine.

## Remaining release blockers for this Work 1
1. Authoritative unified control-state registry and exhaustive physical switch/guard/rotary wiring; missing BUS TRANSFER real cockpit event.
2. Engine/APU ECU as upstream state owner wired into the Aircraft Session without duplicating Electrical.
3. Source-traced CB and actual pressurization profile ownership; maintain UNKNOWN where documentation is incomplete.
4. Variant-aware warning source; remove the hardcoded 737-400 warning configuration.
5. Live browser/Unity visual, operator-path and profile isolation evidence, plus independent expert source review.

## Quick diagnostic use in current live Unified
From the Unified browser JavaScript console:
```js
window.B737ISNCockpitV1.getArchitectureAudit()
```
The output is a read-only diagnostic with `findings`, `checks`, and `status`; it never modifies electrical state, changes indicators, or passes operational certification.

## Next milestone: live Unified single-authority control routing

Implemented on this PR branch (not yet merged to `main`):
- `engine/runtime/unified-live-gateway-v1.js` is installed into the real `panel-mosaic-lab/cockpit/isn-cockpit.js` event path (overhead iframe snapshot and physical control events).
- Existing ECU `ISN1318ECUTestbenchV1` and its *same* `ISNElectricalPackV1` remain the only active owners of the power model. The isolated `AircraftSessionV1` is **not** instantiated a second time.
- In live `ISN03_START_SESSION` ownership mode, `isn-cockpit-bridge-v1.js` no longer writes Battery a second time; the physical ECU/Chain writes it once. The LEGACY_SCENARIO bridge's original behavior is preserved.
- The gateway translates actual physically registered detents, rejects wrong event kinds or unknown states before dispatch, identifies the control owner, suppresses duplicate held-value events (including APU START snapshot recovery), and publishes a read-only live ECU/Pack snapshot.
- For generator, ground power, standby and pump detents handled by the Bridge, a successful control application now synchronizes the same ECU Chain's power feedback and fuel flow immediately; no second electrical model is constructed.
- Previously swallowed bridge failures are surfaced in gateway diagnostics; a monotonically increasing rejected-event counter ensures the legacy 30-event ring buffer cannot hide new errors.
- `window.B737ISNCockpitV1.getLiveGatewayState()` and `.getAircraftSnapshot()` now expose the current live routing/aircraft projection without mutating panel artwork.
- `tests/unified-live-gateway-v1.test.cjs` exercises actual ECU + Pack + physical registry controls and faults; it includes Battery single-write, standby selection, APU start, APU generator bus power, invalid detents, source rejection and counter overflow, and detached outputs.
- Browser smoke in `tools/unified-live-gateway-browser-smoke.cjs` runs the actual cockpit page in headless Chromium and injects a same-origin **child-frame physical event message** into the actual parent listener. It does **not** pretend that a guard was manually clicked; full pixel/guard-interaction acceptance remains separate.

### Hostile findings during this milestone
1. **P0 fixed:** physical Battery writes were duplicated by Bridge + ECU; eliminated for the real active shared-ECU mode.
2. **P0 fixed:** Bridge-only generator/source control updated V7 but could leave cached Chain feedback stale after routing simplification; explicit power/fuel feedback refresh restored.
3. **P1 fixed:** unsupported physical detent or event-kind could be mislabeled as accepted; source-registry-verified allowed detents enforced.
4. **P1 fixed:** Legacy Bridge source-selection error was swallowed; gateway now reports rejection. A real Ground Power toggle must include OFF→ON when the registry default is already ON, otherwise a fake duplicate test has no value.
5. **P1 fixed:** error ring length reaches 30, so checking its length cannot identify a new rejection; monotonic rejectedTotal used.
6. **P1 fixed:** missed first-frame APU START could replay on both synchronization and pending event loop; gateway deduplicates held START positions.
7. **Open:** battery gate currently follows actual ECU state, but physical guard mechanics/pixel-perfect geometry are separate and unverified.
8. **Open P0:** 17 guards and BUS TRANSFER physical surface mapping remain incomplete; only mapped subset of controls is handled by this gateway.
9. **Open P1:** selected aircraft profile remains incompletely threaded into legacy pack Warning Engine; potential 737-400 hardcode.
10. **Open P0:** no airframe-specific complete wiring certification or real aircraft acceptance; source-gated downstream LRU power stays UNKNOWN.

### Work 1 completion gate
**Partial implementation, not full completion**: until the real browser workflow and test-on-device run are green and all critical physical controls and system dependencies migrate without a parallel owner, do not claim Work 1 or its Unified interface is 100% finished.
