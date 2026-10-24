# ISN-03 Stage 2 — FCOM-grounded Engine/APU start logic

**2026-10-24:** `LOCAL_FCOM_DISCRETE_START_RULES_IMPLEMENTED_UNPUBLISHED`. The owner's Sepehran Airlines B737CL FCOM was made available as a local reference. The previously source-blocked **discrete** engine/APU start and shutdown rules have been audited and integrated into the separate ISN-03 test session. This is not a dynamics model, approved actual-aircraft training guide, installation wiring map or published Unified update.

## Provenance / effectivity

Source: owner-uploaded `SEPEHRAN AIRLINES 737CL FCOM_241021_135227.pdf`, document **D6-27370-300/400/500-SHI** (1937 PDF pages). Do not place proprietary PDF pages or reproduced Boeing text into the public repository. The references below describe implemented behavior in original wording, not verbatim source reproduction.

| FCOM folio | Uploaded PDF page | Source-backed function |
| --- | ---: | --- |
| 7.10.22 | 1193 | Start switch detents, ignition selector and lever-dependent ignition |
| 7.10.25 | 1196 | Start lever IDLE/CUTOFF action on ignition, wing and MEC fuel shutoffs |
| 7.20.7 | 1208 | Pneumatic starter, battery bus start valve command, approximate 46% N2 cutout, 725°C abnormal-start criterion |
| 7.20.8 | 1209 | Left/right igniters and their AC bus sources, FLT selector bypass |
| 7.20.9 | 1210 | Start/ignition electrical/pneumatic functional schematic (not a variant WDM) |
| 7.10.29 | 1200 | APU OFF/ON/START switch and automatic APU start request |
| 7.30.2 | 1217 | APU electrical prerequisites, start inlet door and 135-second maximum cycle, nonbinding 60-second bleed-service recommendations |
| 7.30.3 | 1218 | APU OFF trips GEN/closes bleed, protection categories and overtemperature bleed response |
| NP.21.33–35 | 133–135 | Engine start procedure: N1 rotation, N2 25% (or max motoring >=20%), nominal 46% cutout, other operating checks |

**Effectivity caution:** The header covers 737-300/400/500, but the exact fitted igniter/bus feeder wiring, individual EP-FSI modifications, alternate power paths and specific engine/APU options have not been separately established. The implementation models common source-backed functional behavior only.

## Executable, evidence-safe outputs

| Rule | Inputs | Output / limit |
| --- | --- | --- |
| Engine GRD start | `ENGINE_START_SWITCH: GRD` + observed `batteryBusPowered` | `starter.startValveOpenCommand` and forced-close engine bleed command (true/false/null); actual valves and amber START VALVE OPEN lamp use independent valve feedback |
| Starter drive *possible* | Start valve command + observed valve OPEN + observed start air | `starter.motorDrivePossible` tri-state; does not calculate air pressure or spool-up |
| Ignition | GRD/CONT/FLT, global IGN L/BOTH/IGN R, observed fuel lever, independently observed transfer/standby AC availability | `ignition.demand` and `ignition.supplyEligible` per igniter; FLT selects both regardless ignition selector |
| Fuel lever | Observed CUTOFF/IDLE | Wing and MEC shutoff **commands**, not actual valve or combustion status |
| Start lever IDLE cue | N1 rotation and N2 >=25%, or N1 rotation and max motoring with N2 >=20% | `fuel.recommendMovingLeverToIdle`; informational criterion, never automatic lever movement |
| Starter cutout | Engine detent GRD, observed N2 reaches **approximately** 46% | Simulated switch holding-solenoid release to `OFF`; `cutoutIsApproximate` label; does not overwrite physical valve sensor |
| Starter duty / required air pressure | NP.21.33–34 | Exposes 120-second maximum starter attempt, retry gaps 20/180 seconds and sea-level recommended 30 psi minus 0.5 psi per 1000 ft; no physical pressure or timer is fabricated |
| Abnormal EGT start | Ground start window + EGT >=725°C | Source-backed discrete EGT criterion and latch; separate from fire bell and unmodeled dynamic limit/acceleration checks |
| EGT advisory reset | Observed zero fuel flow, or explicit instructor-confirmed normal start and fuel-used reset | Clears only ISN-03 EGT advisory latch |
| APU START | Momentary START, observed battery switch ON and battery-bus power, cockpit and ground APU fire handles IN | `inletDoorOpenCommand` tri-state; after observed door OPEN, `sequenceAfterDoorOpenEligible`. Actual ignition/fuel start speed is unspecified |
| APU OFF | Switch moved OFF | Disconnect **selected** APU electrical generator buses, close APU bleed switch, and request shutdown; `apu.running` remains observed separately |
| APU safety shutdown | Observed ground and battery switch OFF, or observed cockpit APU fire switch pulled | Requests APU shutdown and drops selected APU GEN/bleed; cannot fake observed APU stopped |

The derived bus/igniter/valve *eligibility* is not a fabricated physical state. Feedback always identifies `INSTRUCTOR_OBSERVATION` (`instructor:true`) or `EXTERNAL_SENSOR_OBSERVATION`; missing inputs remain `null`. All three observed Engine 1 / Engine 2 / APU running statuses are required before Electrical/Pneumatic/Fuel/Hydraulic/Warning downstream outputs are published by the older Stage 1 integration. The EGT alert is **not** an engine fire or aural warning.

## Deliberately unresolved

- Actual N2 acceleration, N1/EGT/shaft dynamics, fuel metering, combustion, thrust and stable-idle determination — out of scope.
- N2+OAT calculated EGT upper limit and the acceleration-rate test after N2 32%; neither formula is in the cited prose.
- APU ignition/fuel onset RPM, actual APU-ready RPM, starter duty/acceleration algorithm, EGT protection thresholds and elapsed-time physics. The FCOM's **maximum** 135-second start cycle is exposed as metadata only, not a fabricated timer.
- Exact left igniter **transfer bus side**, real wiring/equipment feeder loads, exact start valve actuator bus and APU DC fuel-pump feeders; explicit independent observations are required for unknowns.
- Underlying `SOURCE_OBSERVATION.running` is never set by N2 or APU RPM, start lever, EGT, start-switch command or APU GEN OFF BUS light. APU overtemperature may affect bleed without shutting down the APU, as specifically recorded.

## Source contract, UI and regression

- `engine/integration/isn-start-sequence-v1.js`: the source-located discrete rules, observed feedback, commands, trace and existing Stage 1 bridge.
- `engine/integration/isn-start-sequence-contracts-v1.json`: detailed reference ledger; approved functional edges vs blocked physical inferences.
- `isn-start-sequence-lab/`: independent browser test UI for Engine 1/2 start switch, ignition selector, APU switch, electrical feedback, per-source observed feedback, engine/APU phases, resolved rule states, generator/bleed outputs and event trace. Not mounted on frozen Unified artwork.
- `tests/isn-start-sequence-v1.test.cjs`: regression of original sensor and source-gate contracts.
- `tests/isn-start-fcom-rules-v1.test.cjs`: ignition, fuel-lever cue, N2 boundary/cutout, EGT latch, APU prerequisite/door/OFF, source preservation, negative-input and replay tests. Both run in Pages CI alongside the immutable-overhead guard.

Run the lab with a local static web server from repository root; first select the independent battery/igniter power observations, then manipulate GRD/FLT/CONT and measured N2/EGT, and inspect `rules` on each source card. Click **Observe RUN** only on real external/instructor evidence of a running engine or APU. APU START is momentary and settles at ON. `SOURCE_REQUEST` remains available independently for high-level test intent.

## ISN-03 Unified connection / educational run

`engine/integration/isn-apu-start-chain-v1.js` is a **distinct training-sequence adapter** linked into the existing Unified ISN-02 Pack instance. Its deliberately compressed timing checkpoints are not FCOM RPM curves, start-time expectations or actual sensor feedback: every generated source/measurement is explicitly `TRAINING_SEQUENCE_SIMULATED` and carries `training:true`. Unlike unproven real-aircraft inference, this user-requested classroom playback is always identifiable in the event source trace.

1. On the real overhead, battery master ON. Press APU START; the simulator issues a discrete inlet-door stage and later reports APU source READY. APU GEN OFF BUS indicator changes; the real APU running source is an educational simulation, not an observed aircraft sensor.
2. Select an APU GEN switch ON to feed the electrical bus. Set APU BLEED ON and PACK L/R OFF, with isolation valve not CLOSE. Power, pneumatic selection and ignition bus are checked independently before engine motoring is allowed.
3. Move ENGINE START 1 or 2 to GRD on the actual overhead. Only when those prerequisites hold, the training stage signals Start Valve OPEN, displays the mounted center-panel light and later the 25% N2 fuel introduction cue.
4. Use the ISN-03 inspector's ENGINE 1 / 2 **START LEVER IDLE** test button; the physical lever image itself is not yet animated. The trainer then steps to nominal N2 46%, releases the existing rotary control to OFF and marks the running engine as **synthetic training status**, propagating to existing Electrical/Pneumatic/Pump models.
5. APU OFF disconnects selected APU generators and closes its bleed valve without automatically stopping engines already running. CUTOFF is an explicit shutdown of the selected training engine.

**Publication gate:** Node/contract regressions and immutable image guard pass; browser/iPad visual/manual test and explicitly authorized public deployment still remain. Never alter `panel-mosaic-lab/all-overhead/` or its frozen hashes. The source PDF is excluded from the repository.
