# EP-FSI N1 simulated display v19 — approximate values authorized by user

The project owner explicitly chose **reasonable-looking estimate values rather than delaying CDU display until AFM tables are numerically complete**. This is an **educational cockpit simulator**. It must never be construed as a valid performance calculation or for actual flight.

Active airplane: Boeing 737-33V EP-FSI, MSN 29340, CFM56-3B-1 (20K). The private AFM dataset remains version **16**, with **zero** independently approved numerical N1 vectors. That unchanged AFM status does **not** preclude visual values labeled `EST`.

## v19 display policy

- **Estimated MAX / N1 LIMIT:** TAKEOFF rough reference 92.0% and GO-AROUND 94.0%, modified gently with ISA ambient altitude/OAT and user-selected Bleed/Packs/Anti-Ice. The displayed Takeoff or Go-Around estimate is bounded to **88–95%**, as provided by the project owner. Actual launch defaults (bleed ON, anti-ice OFF, packs AUTO, source altitude not specified) yield approximately **91.7% TAKEOFF** and **93.7% GO-AROUND**; these are **illustrative mathematical surrogate outputs, not digitized AFM readings**.
- **Estimated PRESENT N1 1/2:** When no real engine measurement is available, calculate a visual-only percentage from a scenario thrust-lever parameter and the estimated limit, with a small fixed difference between engines for illustration. It is not the actual observed fan speed or realistic engine-spool physics. The user can change the lever estimate in the test sidebar. No fake fixed 87.3% cruise measurement remains.
- **Telemetry priority:** incoming fresh `ENGINE_CORE` or `EXTERNAL_SIM` values override the displayed estimates for the corresponding engine. Instructor-injected readings use `TEST`. A stale or unavailable measurement reverts to a conspicuously labeled `EST` fallback, not an alleged live measurement.
- **Manual N1:** still explicitly `MAN` and separate from `EST`.
- **No airframe data:** invalid airplane identity blocks the estimate. **Missing altitude** uses 0 ft and **missing OAT** uses 15°C only as openly declared display assumptions, never as sensed weather/pressure altitude. ISA profile remains a separate documented default.
- **PMC unknown:** does not prevent visual estimate, but still blocks the original AFM source selector. The estimate does NOT claim to solve different PMC N1 charts.
- **No Autothrottle command**, no real engine physics, no certified performance. AFM source QA remains pending.

## Software and QA

- `engine/fmc/performance/epfsi-simulated-n1-v19.cjs`: deterministic pure surrogate; no Boeing proprietary curve contents.
- `cdu-standalone/data/epfsi-simulated-n1-v19.js`: offline browser bundle.
- `cdu-standalone/index.html` and `app.js`: show `EST` under normal conditions, labels `LIVE` or `TEST` when those measured/injected packets arrive, and estimated N1 LIMIT and TAKEOFF REF values.
- Canonical config in `docs/EP_FSI_N1_ESTIMATION_POLICY_V19.json`.
- Tests: `node tests/epfsi-simulated-n1-v19.test.cjs` and `node cdu-standalone/tests/estimated-n1-v19-integration.test.cjs`.

The original approved physical CDU background image and controls are unchanged. This software may not be used for actual aircraft operations.

## CDU v6 compatibility

The newer `cdu-standalone-v6` also has a byte-for-byte copy of the v19 N1 estimate module and v17 ISA defaults. Its existing FCOM page layout is preserved: `N1 LIMIT` shows the approximate 20K N1 value and `TAKEOFF REF` shows `TO N1 EST`; a dedicated training side panel shows surrogate `PRESENT N1` for engines 1 and 2. Scenario phase, optional pressure altitude and throttle approximation are adjustable. EHSI artwork and physical CDU controls are not changed. The separate v6 regression `node cdu-standalone-v6/tests/est-n1-v19.test.cjs` passed in [GitHub CI](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/39889087284). V6's engine telemetry is not connected; those values remain EST until a real publisher is integrated.
