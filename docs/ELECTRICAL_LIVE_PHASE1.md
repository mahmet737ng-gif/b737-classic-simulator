# Classic electrical live backend — phase 1

Implemented 2026-10-30 for the existing Unified procedure trainer (737-300/400/500).
Entry: `panel-mosaic-lab/cockpit/`, Controls → **برق زنده · فاز ۱**.

## Sources and network

| Element | Distribution |
| --- | --- |
| Engine GEN1 / GEN2 | Their respective generator bus; nominal three-phase 115 V AC, 400 Hz |
| APU generator | Either generator bus; both on ground, one selected side in flight |
| External AC / GPU | Both generator buses after the existing GRD PWR command; battery switch required |
| Main battery | Nominal 24 V DC; hot, switched-hot and battery/standby paths |
| Generator bus 1 / 2 | Own main bus and normal transfer bus |
| Transfer bus 1 / 2 | Opposite generator bus can feed an unpowered transfer bus with BUS TRANS AUTO |
| TR1 / TR2 | Transfer bus 1 / 2 → 28 V DC; DC1/DC2 share sources through the DC tie |
| TR3 | Main bus 2 → battery bus; precise backup routing to DC1/DC2 stays unresolved |
| DC tie | Open on BUS TRANS OFF or glideslope capture |
| Normal standby | AC standby from transfer 1, DC standby from DC1 |
| Alternate standby | Battery bus → static inverter → AC standby; battery bus → DC standby |
| Ground service | Independent external service feed or left AC system; charger can alternatively use main 2 |

Each AC generator bus has one supplying source; no AC source paralleling.
Transfer does not resurrect a dead generator bus or its main bus.

References are private Technical Database FCOM Classic chapter 6, principally
6.20.1–4, 6.20.9–12 and control folio 6.10.7. This repository contains original
implementation and source locators, not manual pages or reproduced manual text.
The manual also describes an auxiliary external DC receptacle (6.20.10); this
phase does not add that receptacle or assert an auxiliary/APU battery installation.

## One authority

`ECU.start.core.pack.electricalState` remains the only electrical state owner.
`electrical-network-v1.js` projects the matching Pack result into 24 nodes and
explicit directed feed/contact paths. It has no second electrical session.
Each node exposes power (`true/false/null`), feeds, volts, Hz, current and quality.
No battery capacity or load current is invented.

The approved Owner18 controls emit `b737:guard-changed`, whereas the old bridge
read the obsolete rotary/guard registry. An additive read-only input adapter
normalizes BATTERY, STANDBY, BUS TRANS and GEN DISC outputs for the existing
Gateway. It reads actual installed values on snapshots, events and asynchronous
mount. Approved source files, close behavior, geometry, photos and effects remain
unchanged. Latched drive-disconnect effects are consumed even if the cover has
returned the visible handle to NORMAL.

Standby BAT now correctly powers the intermediate battery bus from the hot
battery bus, including with BATTERY OFF. GRD POWER AVAILABLE and STANDBY PWR OFF
join the existing same-Pack lamp projection. Instructor electrical changes
refresh dependent ECU power and fuel delivery before rendering.

## Metering and consumers

The existing OH10 selectors receive source samples through
`b737:ac-dc-source-measurement`; original four needles and geometry are retained.
`NOMINAL_MODEL` shows labeled nominal voltage/frequency, never measured current.
`SENSOR_ONLY` leaves unsupplied numbers unknown. A spinning disconnected engine
generator has unknown field voltage. APU BAT and maintenance TEST remain unknown.
RESID keeps its momentary 0–30 V ownership; a V7 observation supplies only the
drive-running bit, not an inferred GCR position or residual-voltage measurement.

`B737UnifiedElectricalLive.snapshot()` returns a detached network result.
`subscribe(fn)` sends updates and returns an unsubscribe function.
`supply({bus, cbClosed, switchOn, healthy})` is the staged consumer port. A known
bus and confirmed closed CB are required to assert an operating consumer; an
unmapped feeder remains unknown. This does not automatically wire every device.

## Test sequence

1. Use the actual BATTERY guard/switch ON. Attach the GPU cable in Controls.
2. Use the actual GRD PWR switch OFF → ON. Generator buses should show EXT,
   transfer buses 115 V/400 Hz, TR/DC buses 28 V (nominal model).
3. Select GND PWR / TR1 / TR2 / TR3 with existing OH10 selector controls.
4. With BATTERY OFF and no external feed, select the actual STANDBY BAT detent:
   battery bus/DC standby 24 V; inverter/AC standby 115 V/400 Hz.
5. Inject STATIC_INVERTER_FAILED: AC standby off; DC standby remains powered.
6. Use real engine/APU start and GEN switches for generator tests. With one
   engine generator lost, its main bus stays dead while the transfer bus can
   trace to the opposite source. BUS TRANS OFF removes the alternate path.

## Deliberate limits / next phase

- FCOM 6.10.7 and 6.20.11 conflict about ground AUTO standby on total AC loss.
  The existing default preserves UNKNOWN; an aircraft-specific decision is needed.
- TR3-only backup to DC1/DC2 and exact installed consumer/CB feeders are unresolved.
- Voltage/frequency are nominal discrete training outputs. Battery SOC, charger
  current, discharge duration, load-flow, relay timing and protection-trip latching
  are not simulated by this phase.
- The legacy V7 model is availability-based. Fault removal can restore a selected
  source without a new contactor reset; this is not a completed protection model.
- Ground-to-flight transition while APU feeds both buses remains an existing
  invalid-state diagnostic until an effectivity-specific transfer policy is chosen.
- Other panels retain their existing source-gated/bench modes. This release does
  not imply whole-cockpit electrical certification or complete cold/dark gating.

Next: per-device documented feed + CB + control-power requirements, then measured
or explicitly parameterized load currents, battery/charger dynamics, and protection.

Validation: electrical-network and Owner18 input tests; existing V7/Loads/Pack,
Gateway, engine/APU, metering, RESID and protected-artifact checks. Browser QA
used the installed GPU switch, BATTERY and STANDBY hardware and inverter fault.

Local full npm test reaches the classroom network test, which is blocked in this
container by `uv_interface_addresses` from `os.networkInterfaces()`. The remaining
npm-test commands were run separately and passed; no network test was disabled
in the repository.
