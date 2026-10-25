# B737 Classic ISN-09 through ISN-12 — integrated training backend V1

Status: **backend implemented + targeted unit/integration regression**. Not aircraft-certified, not a replacement for Boeing AFM. All unresolved feeder connections remain UNKNOWN unless training surrogate/observed power is selected. Does not alter locked cockpit artwork or wire the newer backend into the public CDU/autothrottle UI.

## ISN-09 — Single thrust computation and owned measurements

- Canonical educational thrust planner: `engine/integration/isn-thrust-performance-v1.js`, with nominal mode reference values TO 97, GA 96.5, CON/MCT 94, CLB 92 and CRZ 88 percent N1. These are **SIM EST** configuration points, adjusted for environment and selectable configurations. CLB-1/-2 reductions fade toward zero at 15,000 ft. These numbers are not actual CFM56-3 thrust rating tables.
- N1 LIMIT (planner), N1 REQUIRED (planner), N1 COMMAND (explicit optional training action), and N1 ACTUAL SIM (start-chain running-envelope) remain distinct. `Runtime.planThrust(device,input,{apply:false})` is read-only; only `{apply:true}` calls the existing `applyToTrainingChain` ownership checks, which reject stopped/external-source engines and mismatched ground state or active-engine count.
- Existing older `engine/fmc/performance/isn-thrust-schedule-v1.cjs` and CDU v19 estimated display values are **legacy model paths**. Do not feed both into the same running-engine command port. CDU unification remains a separate user-interface integration gate.

## ISN-10 — Source-aware abnormal-start and fuel-failure monitoring

- `diagnostics(snapshot,fuelSources)` projects start EGT 725 criterion, high-EGT start, no light-off, N2 stall, hung start, early starter cutout, flameout, fuel starvation and known fuel-path loss. Diagnoses are status reports, not simulated engine-fire evidence. No fabricated fire bell or oil warning.
- Instructor injected failures remain supported by the existing start-chain `setTrainingFault(...)` and original discrete ISN03 rules.
- This is the first **discrete fault monitor**, not a certified comprehensive fault-detection model or QRH selector.

## ISN-11 — Start valve, pneumatic air, ignition and fuel-start handoff

- Reuse existing `isn-apu-start-chain-v1.js` source-aware starter logic: selected APU/gen/bleed, packs, isolation, battery bus, ignition, independent OPEN valve status, N2 25% IDLE cue and approximate N2 46% starter cutout.
- The new `Runtime.fuelLever(device,'IDLE')` refuses light-off unless a selected tank has a resolved fuel route. Unknown pump power remains UNKNOWN and cannot be silently called operating.
- `setFireSwitch(device,true)` makes fuel unavailable and triggers a **training** loss of combustion for a running simulated engine; source-owned live engine telemetry cannot be overwritten.
- No installation-specific starter feeder wiring or real start-time simulation claim.

## ISN-12 — Fuel source/consumption network

- `FuelNetwork` tracks `main1`, `center`, `main2` in kg, six existing Pack-01 fuel pump operational states, center-tank preference, own-main routing and opposite-main routing only with explicit crossfeed valve OPEN.
- Optional low-altitude suction flow exists **only** when `allowSuctionTraining` is explicitly enabled; it does not claim certified high-altitude suction performance.
- Running engines consume their own modeled Fuel Flow (`kg/h × dt/3,600,000`) from the selected source tank; shortages trigger `FUEL_STARVATION`, not automatic movement of Start Lever. APU fuel draw is an explicitly estimated training assumption (110 kg/h from main tank 1); real installed APU DC pump and suction priority are not modeled.
- Pump POWER status comes from the existing ISN electrical pack. Training bus mapping may be deliberately enabled by instructor; SOURCE_GATED with UNKNOWN remains the default. A source-verified bus feed is NOT asserted.
- No exact real-airplane fuel pressure, quantity probe, center scavenge, priority manifold timing, fuel density variation, real fuel flow schedule, or engine coast-down dynamics yet.

## Source lineage / user-accepted approximate data

- Sepehran 737 Classic FCOM §7.20.5 (PDF page 1206) describes tank pumps, wing/MEC fuel shutoffs, fuel metering, and fuel flow indication.
- FCOM §7.20.7–9 and NP.21.33–35 underlie the discrete start/ignition gates and the approx 46% N2 starter cutout.
- FCOM §12.20.2 (PDF around 1835–1836) describes center/main pump manifolds, crossfeed, suction feed caveats, and wing shutoff control.
- All numeric tank defaults, normal engine and APU fuel consumption rates, aerodynamic N1 schedules, fault timestamps and non-source fuel-availability simplifications are **simulation estimates**, NOT extracted AFM or aircraft configuration limits.

## Public code and tests

- `engine/integration/isn-09-12-runtime-v1.js` — orchestrated backend (FuelNetwork, Runtime, diagnostics).
- `engine/integration/isn-apu-start-chain-v1.js` — new `fuelFlameout` source-guarded state transition; leaves fuel start lever where selected.
- `engine/integration/isn-thrust-performance-v1.js` — unified nominated N1 mode schedule.
- `tests/isn-09-12-unit.test.cjs` — tank/pump/crossfeed/UNKNOWN/fuel-burn and diagnostic tests.
- `tests/isn-09-12-integration.test.cjs` — power/APU/start → N1 command → quantity consumption → training starvation, source and lever isolation.
- `.github/workflows/isn-09-12.yml` — targeted CI including frozen-overhead asset checksum check and prior ISN start rules/regressions.

**Deployment boundary:** backend files on `main` are not evidence that public cockpit controls, CDU, gauge needles and autothrottle have been integrated. Those require explicit, separately tested renderer/UI wiring. This package does not touch `panel-mosaic-lab/all-overhead/`.