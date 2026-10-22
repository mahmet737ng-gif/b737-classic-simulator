# B737CL ISN-03 — Electrical Feeders & Pressure Distribution | Stages 1–2
**2026-10-23 · branch-only pilot · Node CI passed · not a certified aircraft simulation**

## Implemented scope

**Stage 1 — Electrical feeder topology audit (functional):**
- Existing FCOM-based power source arbitration, generator bus/main bus/transfer bus, BUS TRANS AUTO/OFF, standby AC/DC and TR behavior remains in `engine/network/electrical-power-pilot.cjs`.
- New `engine/network/electrical-feeder-audit.v0.2.cjs`: typed feeder objects for 6 fuel pumps + 2 hydraulic electric pumps; source/effectivity metadata; 3-valued `POWERED/UNPOWERED/UNKNOWN` states; source switch / transfer bus / feeder change event diffing; explicit no-paralleling qualification.
- Every pump in `pump-sensor-warning-engine.cjs` now requests its power from this centralized feeder audit before its motor/sensor output is computed. Not an isolated second calculation.
- Case evidence: FCOM §6.20.18 (PDF physical 1167) shows MAIN1 FWD, CENTER RIGHT and HYD SYSTEM B electric pump inoperative after GEN1 failure *in flight with normal transfer buses*. FCOM §6.20.19 (PDF 1168) shows MAIN2 FWD, CENTER LEFT, HYD SYSTEM A electric pump for GEN2. Alternative source transfer and main/transfer difference grounded in §6.20.1–4 (PDF 1150–1153).
- Remaining consumer feeders for non-qualifying states stay `UNKNOWN` unless the normal two-generator fixture or source case permits a bounded inference. **A generator-failure equipment list is not a physical feeder wiring diagram.** Exact feeder bus, CB, contactor, relay numbers and switching times need appropriate aircraft WDM/SSM/AMM.
- A second experimental diagnostic feeder module, `electrical-consumer-feeders.cjs`, remains in the development branch to preserve concurrent source work. It is **not** the authoritative pump supply path; `electrical-feeder-audit.v0.2.cjs` is used by the kernel.

**Stage 2 — Hydraulic / Fuel pressure distribution (qualitative):**
- New `engine/network/pressure-distribution.v0.2.cjs`: derives 6 individual fuel-pump outlet pressure states; per-engine normal center/main pressure-source priority and cautious suction-feed possibility; 2 hydraulic electric pump + 2 independent engine-driven pump outlet conditions; combined hydraulic A/B availability and independent pressure-switch representation.
- Pump outputs are source-derived from actual `electrical → motor command/health/fluid availability → pressure distribution → sensor → warning` state flow. The previous hard-coded/fixture pressure outputs are overridden in `bindPressureSensors`, and the Warning Engine consumes these rebound sensor outputs.
- Fuel source priority FCOM §12.20.1–2 (PDF 1834–1835): center pump low-opening-pressure check valves normally give center tank priority; if center pump output is low, main pumps can supply fuel. The model's closed-crossfeed scenario computes left/right engine feeds separately. With no AC pump feed, suction feed is marked **POSSIBLE_NOT_GUARANTEED**, not a proven engine run state. No synthetic pump PSI, actual fuel flow or suction endurance.
- Hydraulics FCOM §13.10.1–2 (PDF 1842–1843), §13.20.2–3 (PDF 1847–1848): engine hydraulic pump flow is approximately 4x the related electric pump; this is recorded as a ratio only (not derived flow rate). Normal system gauge reference **3000 psi**, maximum red **3500 psi**; both are references, not computed actual readings. If *both pump switches OFF* FCOM indicates gauge zero; this is the only numeric indication directly inferred. All other real-time simulated PSI remain `null` until validated pump displacement, load/flow, reservoir dynamics and sensor transfer characteristics are available.
- Source pump-output sensors are tracked separately from combined hydraulic system pressure (one motor-driven pump failure must not automatically collapse the system when its corresponding engine pump operates).
- New event `electricalChanges` gives documented power source/bus/feeder changes; `pressureChanges` records pressure build-up/decay **direction only**, with `durationSeconds:null` and `TIMING_UNVERIFIED`. This is an equilibrium/discrete-event model, not a timed fluid-dynamics solver.
- Another experimental `fluid-pressure-engine.cjs` diagnostic source adapter is retained as a separate module, but **does not drive Warning Engine**. Its optional external gauge observations are not self-generated pressure readings.

## Executable tests and acceptance

Execute:
```sh
node tests/system-network.test.cjs
node tests/electrical-integration.test.cjs
node tests/pump-warning-network.test.cjs
node tests/electrical-pressure-stage12.test.cjs
node tools/build-power-consumers-lab.cjs --check
node tests/power-consumers-browser.test.cjs
```

Added `tests/electrical-pressure-stage12.test.cjs` to `.github/workflows/electrical-integration.yml`. CI verified on GitHub:
https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/39864242355

Scenarios exercised:
1. Normal two-generator feed → all 8 audited AC pump loads available; physical feeder IDs still unknown.
2. GEN1 failure → alternate transfer bus 1 works; center RIGHT/main1 FWD/HYD B electric low; hydraulic B engine-driven pump keeps system available, independent of its electric motor.
3. GEN2 failure → center LEFT/main2 FWD/HYD A electric low.
4. Power restoration → documented pressure-sensor and warning recovery, build-up direction event with no fabricated milliseconds.
5. BUS TRANS OFF + GEN1 failure → unknown individual feeder paths reported UNKNOWN, not false hard failures.
6. Total AC loss → all 8 modeled AC pumps without AC, both engine-driven hydraulic pumps remain independently evaluable; possible fuel suction feed is not guaranteed.
7. Center inlet dry, center switches OFF, source selection priority and main-pump fallback.
8. Both hydraulic A pump switches OFF → FCOM gauge zero; engine/hydraulic motor low pressure warning logic follows independently.
9. One electric pump failed with engine-driven hydraulic still providing combined pressure.
10. Provenance, invalid feeder ids and deterministic replay.

## Engineering gates that remain open — do not mark full aircraft physics verified

- Exact EP-FSI / MSN 29340 component effectivity, CFM56-3B-1 20K installed configuration, option variations in hydraulic/fuel/electrical equipment.
- WDM/SSM/AMM feeder buses, contactor sequence, GCU and circuit breaker topology. These references are not fully audited for this aircraft; **no invented physical connections**.
- Hydraulic pump curves (flow/pressure vs RPM), accumulator, actuator demand, reservoir air pressure, detailed PTU/leaks, thermal response and dynamic fluid pressure integration; no numerical transients yet.
- Fuel pump pressure curves, fuel temperature/density/vapor, net engine feed pressure/flow, suction-feed envelope, flicker/signal delays.
- Actual pressure-switch thresholds/indication wiring and time constants; physical light-presentation power, caution sound/interlocks require dedicated validation.
- Browser visual regression, any actual hardware/FSX/X-Plane or live cockpit coupling and main deployment. All main web UI files, Android and iPad untouched.

**QA state:** SOURCE-REFERENCED, ENGINE-TESTED (bounded qualitative pilot), NOT ENGINEERING VALIDATED / NOT OWNER ACCEPTED. No full production accuracy claim.
