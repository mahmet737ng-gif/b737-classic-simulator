# B737 Classic Engine-Driven Fuel Suction Feed — ISN-12 V1

**Date:** 2026-10-25. **Repository state:** implemented in the ISN-09–12 fuel engine and integrated into the standalone ISN-13–18 ECU startup bench.

## Verified topology

- B737 Classic 737-300/400/500 **FCOM 12.20 fuel system**: With main boost pump pressure lost/off, each engine can draw fuel from its **own main tank** through a **bypass line/valve around the electric boost pumps** by engine-driven pump suction. Center tank has **no comparable suction bypass**. Suction may deteriorate at high altitude due to dissolved-air release; it should not be represented as universally guaranteed pressurized delivery.
- This topology also appears in Lufthansa Technical Training B737-300/400/500 ATA 28, `28-40` distribution description and crossfeed explanation. Sources are cited by document/section in the Technical Database; copyrighted manuals are not copied into this public repository.
- Boost pumps, when powered, retain priority: center tank pumps → engine main pumps → open crossfeed with powered opposite pump → own-main suction fallback. A center-tank-only quantity cannot sustain unpumped engine suction.
- Fuel lever `CUTOFF` and pulled engine FIRE SWITCH still close the respective commanded supply, regardless of suction and tank content. This does not bypass valve protections.
- For the common ground/low-altitude training case, suction does **not** require any electrical fuel pump or a generator online. A battery/static-inverter-powered **right igniter** and APU pneumatic starter can support a simulated lightoff on own-main suction.

## Numerical training assumptions — NOT source-certified limits

- The modeled engine-driven pump becomes available once N2 reaches **5%** during motoring or running. This numerical trigger is a simulator expedient, not a B737 Classic minimum pump pressure, safe N2 lightoff speed, or a pilot procedure.
- Below 5%, moving the fuel lever to IDLE changes its position and valve commands, but creates no synthetic fuel flow with all boost pumps OFF.
- For `pressureAltitudeFt <= 10000`, the simulation treats main-tank suction as available. The 10,000 ft *risk-model boundary* is a conservative uncalibrated training convention, not an actual aircraft cutoff or a demonstrated altitude limitation. Above it, when suction alone is the only path, report `SUCTION_FEED_HIGH_ALTITUDE_RISK_UNRESOLVED` with `available:null` rather than invent guaranteed pressure, or claim suction is physically absent.
- A per-engine `setSuctionFeedFault(engine, boolean)` models loss of the independent bypass route. With boost pumps OFF, this makes fuel supply unavailable/unknown; with a powered boost-pump route, the fuel remains available. Running-engine fuel loss triggers the established ISN-12 simulated fuel-starvation behavior. Both sides are independent.
- Suction applies ONLY to the engine's own main tank, no fabricated center-tank suction or pressure-sensing values.

## Code and acceptance coverage

- `engine/integration/isn-09-12-runtime-v1.js`: enabled real topology by default in `Runtime` and `FuelNetwork`, mechanical N2-gating of simulated engine-driven pump rotation, fuel source reason `OWN_MAIN_ENGINE_DRIVEN_SUCTION`, failures and UNKNOWN risk.
- `engine/integration/isn-13-18-ecu-testbench-v1.js`: previews source availability through the ISN-12 network, rather than separately assuming only electric pumps can feed the engine.
- `isn-ecu-start-lab/app.js`: explicitly labels selected source `SUCTION FEED — OWN MAIN TANK` to distinguish engine suction from boosted pump feed.
- `tests/isn-engine-suction-feed-v1.test.cjs`: two main tanks, both engines, all four electric main boost pumps OFF, no APU AC generator connected, right ignition BAT/inverter, source independence, fuel burn, suction bypass failure, no center-tank-only suction, high-altitude UNKNOWN.
- `tests/isn-ecu-realtime-start-v1.test.cjs`, `tests/isn-ecu-fuel-lever-ui.test.cjs`, `tests/isn-early-fuel-battery-ignition-v1.test.cjs` updated to check suction instead of requiring engine boost-pump switches.

**Scope:** Source-supported system path with simulated pump engagement and performance. **Not** actual engine fuel-pressure transients, aircraft effectivity-specific check-valve condition, AFM takeoff/flight operations without pumps, or engine fuel-feed certification. The original cockpit background assets remain untouched.
