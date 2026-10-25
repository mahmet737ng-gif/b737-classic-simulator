# CPCS and DCPCS closed-loop simulator status

Date: 2026-10-25

Both pressurization controllers remain isolated and switchable through the OH22 configuration. The source-linked controller rules are unchanged.

Implemented in this change:
- Optional cabin-air simulation with time integration, an outflow valve actuator and pressure feedback to cabin-altitude/rate/differential sensor inputs.
- Pressure plant labels its airflow, cabin volume and motor parameters as provisional simulation assumptions, not measured aircraft figures.
- Independent CPCS and DCPCS UI switching with preserved owner-approved backgrounds, corrected rotary proportions and individual annunciator geometry.
- Instructor diagnostics for aircraft pressure altitude, ground mode and pack-air availability.
- Optional source-gated Pneumatics V6 conditioned-air availability input, keeping missing readings unknown.
- Same-engine simulated N1/N2 inputs for DCPCS; no unverified hardware pin mapping claimed.
- Computed cabin altitude reaches the existing ISN warning engine.
- Unit and integration checks in Panel Mosaic QA.

Remaining verification:
- Exact photographed OH22 actuator coordinates on each distinct background require owner visual acceptance.
- Cabin volume, pack mass flow, servo speed and flow areas require calibration to source documents.
- OH19 mechanical needle numeric tick-to-angle mappings are not known yet. Existing manually calibrated sprites stay unchanged rather than using a guessed scale.
- Installation-specific electrical motor bus feeders and air/ground wiring remain unverified.

This is a simulation test model and not a validated aircraft operational model.
