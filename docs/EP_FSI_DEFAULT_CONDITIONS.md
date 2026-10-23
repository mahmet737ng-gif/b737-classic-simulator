# EP-FSI universal simulation defaults — v17

**Applied to every scenario when a parameter is not explicitly set:** weather **ISA**, engine bleed **ON**, anti-ice **OFF**. The normal simulator **A/C PACKS** default is **AUTO** so engine bleed ON is not confused with pack-position. PACKS AUTO is the simulator's normal-case modeling choice, not a verified EP-FSI hardware fact.

Aircraft: Boeing 737-33V EP-FSI, MSN 29340, engine CFM56-3B-1 / 20K.

- ISA does **not** mean +15°C at every airport or altitude. The model computes ambient air temperature **15 - 6.5 × altitude(km)** up to 11 km, then -56.5°C to 20 km. Pressure altitude must be known; a missing altitude must not silently become 0 ft.
- **ISA ambient OAT/SAT is not TAT**. TAT for Go-Around or Maximum Continuous performance must be obtained from correctly modeled Mach/temperature or the aircraft data source; no TAT is invented.
- Weather is ISA until deliberately overridden by a scenario-specific custom OAT. Similarly, explicit Anti-Ice or Bleed switch states override defaults.
- **PMC remains UNKNOWN** by default, independently of the ISA/Bleed/Anti-Ice defaults, because aircraft installed PMC condition has not been documented.
- These are **user-configured simulator assumptions**, not source-verified Boeing AFM performance facts or assertions of physical equipment.
- N1 source charts still require full numerical digitization/independent review. Do not enable automatic N1 or Autothrottle just because default weather/bleed/anti-ice are known.

Authoritative machine-readable profile: `docs/EP_FSI_DEFAULT_CONDITIONS.json`.

Execution: `engine/fmc/performance/epfsi-scenario-defaults-v17.cjs`, offline bundle `cdu-standalone/data/epfsi-scenario-defaults-v17.js`, CDU UI `cdu-standalone/index.html`, `cdu-standalone/app.js`.

Acceptance: root unit tests and standalone CDU state simulation, wired to GitHub Actions; no browser screenshot/physical flight testing is implied.
