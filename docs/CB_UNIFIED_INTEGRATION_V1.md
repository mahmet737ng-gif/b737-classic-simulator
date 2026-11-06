# Unified circuit-breaker integration

The photographic CB panel now shares its existing persisted BreakerNetwork snapshot
with the Unified parent and embedded overhead. A pull gates the protected consumer
in its existing plant; pushing the breaker restores only the circuit. Pilot switches,
instructor faults, trips and mechanical running states remain independently owned.

This is a functional procedure-training contract based on catalogue circuit names
and existing system models. It does not validate EP-FSI WDM wiring, trip amperages,
thermal time constants or every downstream load.

| Model | Connected behavior |
| --- | --- |
| Fuel and hydraulics | Six individual boost pumps, electric pumps A/B and control feeds; crossfeed actuator holds position when its control circuit is open |
| Pneumatics | Separate bleed valves, packs, isolation control, recirc fan, duct indication and wing/body detector test continuity |
| Electrical | Generator/APU generator controls, external-power control, TR1, separate charger paths, DC distribution, inverter circuits and transfer control |
| Engine/APU | Starter interruption, independent L/R ignition, APU ECU power loss; a running engine remains self-sustaining after ignition loss |
| Engine instruments | Separate N1, N2, EGT, fuel-flow, oil, quantity and vibration channels; sensor/mechanical values are retained |
| IRS | Independent AC and DC paths per unit, real loss of alignment when both paths are interrupted; approved physical frontend unchanged |
| FMC/CDU/MCP | Unit-specific power inhibition and propagation through the existing avionics evidence bridge |
| Pressurization | CPCS AUTO/STBY/MAN AC/MAN DC and DCPCS controller 1/2/manual paths remain independent |
| Brakes | AUTOBRAKE power/control and inboard/outboard antiskid availability; circuit restoration does not move selectors or clear failures |
| Fire | Engine/APU detector isolation and detector-inoperative outputs, wheel-well detector and extinguisher circuit inhibition |
| Other indications | Specific caution lamps, master warnings, oxygen gauge, individual probe warnings, existing window-heat channels and selected exterior-light effective outputs |

`CB_UNIFIED_COVERAGE_V1.json` enumerates all current catalogue entries, exact
consumer bindings, unresolved entries and quarantined source conflicts separately
for CPCS and DCPCS. The `mappedBreakers` count is functional simulation coverage,
not a claim that every catalogue breaker has an implemented system.

Remaining entries require source/effectivity reconciliation or a corresponding
consumer model. They retain their physical pull state but do not silently disable
an unrelated system. Known MRG/catalogue TR and landing-light position conflicts
are deliberately excluded from automatic routing.

Synchronization uses same-origin storage events plus a post-save notification.
Invalid snapshots retain the last valid state. Cached electrical and start snapshots
invalidate on the circuit revision; no independent shadow aircraft plant is created.

Validation: `node --test tests/cb-unified-live-v1.test.cjs`, existing CB source-audit,
electrical-pack/start, instrument and pressure-controller regressions, and the
immutable overhead/Owner18/complete IRS integrity checks. One older aircon wiring
test has a pre-existing stale `overhead-bridge.js?v=AIRCON-NATIVE-P5-0002` assertion;
the base branch already uses `PRESS-OH22-DCPCS-WHITE-WHEEL-0001` at that mount.
