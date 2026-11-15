# B737 Classic — EADI + EHSI source-audit lab (v0001)

**Scope:** 737-300/-400/-500 classic EFIS with EP-FSI as the first configuration to reconcile. **Training software only; not for flight.**

## Open

- GitHub Pages: `/efis-display-lab/` relative to the cockpit project's published root.
- Local: use a local HTTP server from the repository root, e.g. `python3 -m http.server 8000`, then open `http://localhost:8000/efis-display-lab/`.
- `node efis-display-lab/core.test.cjs` checks documented display logic, source gating, modes and source registry.

## Implementation

- `core.js`: pure event-driven state machine; FCOM folio registry; failure gates, mode/orientation decisions, Mach hysteresis, DH/RA alert and reset, independent EADI/EHSI power, two symbol generators, source transfer.
- `eadi.js`: composited EADI vector canvas layers. Keeps separate drawable altitude-related, speed tape, attitude, FMA, ILS, FD and alert regions. The design mirrors the approved stage-one black L aircraft datum and 10-degree-only pitch labels but **does not reuse or alter** locked Unified EADI geometry.
- `../cdu-standalone-v6/ehsi/ehsi-engine.js`: existing EHSI renderer for seven source-described modes and MAP/PLAN/orientation display; training synthetic nav geometry only.
- `lab.js`: interactive controls, deterministic tests, error injection, read-only JSON inspector, segment review register, local photo overlay and selected-region boxes.
- `index.html`: responsive independent test rig for both screens, never mounted over the approved Unified panels.

No animation loop, no background polling, and no periodic interrogation of buses. Display repaints on state changes. Existing protected overhead, guarded switches, IRS, FO panel positioning and Unified main panel files remain untouched.

## Source hierarchy and exact folios

1. B737CL 300/400/500 FCOM Vol.2 Ch.10: **10.30.6–8** EADI basic symbols, pitch scale, FD, GS/LOC, radio altitude, DH, rising runway; **10.30.9** TCAS RA; **10.30.10–12** EADI speed tape; **10.30.13–14** EADI failure flags; **10.31.2–6** EHSI MAP/CTR NAV examples; **10.40.9–11** EHSI seven-mode effectivity, orientation and map mode description.
   External lookup: https://boredaviator.com/wp-content/uploads/2025/03/B737-300-FCOM-.pdf — marked DO NOT USE FOR FLIGHT.
2. Existing owner EFIS control panel source and engine: `engine/efis-fcom-v2/`, `docs/EFIS_PHOTO_LOCK.md`, and `cdu-standalone-v6/ehsi/`.
3. Cockpit Companion **Classic 3-4-5** (Leading Edge Publishing, not NG/737MAX; copyrighted): https://www.cockpitcompanion.com/pd-737.cfm . This external product's private images are **not** in this repository. Only compare user-authorized copies via the lab local file picker. No screenshot or protected illustration is committed.
4. Cockpit photos and Classic-only external geometry examples can serve as secondary visual reference after model/operator/effectivity validation.

## Current acceptance level and limitations

The **25-component audit registry is initialized PENDING**, even when a rule was located in the FCOM. A manual 'ACCEPTED' selection means only the user's browser-session review, not a declaration of verified Boeing pixel geometry. Local reference image overlays use user-selected browser files and do not upload them.

Functional shell supports explicit input of: aircraft pitch/bank, airspeed, Mach, simulated groundspeed, RA, DH, FD, ILS deviation, TCAS RA up/down, windshear, GPWS PULL UP, EHSI mode/heading/track/course/range/options, dual SG power and EFI transfer, selected source invalidation. They are manually injected **test vectors**.

*Not yet implemented or source-audited*: photometric and font pixel match against the owner's Cockpit Companion photos; full EADI speed tape Vmo/Vs/flaps/bug geometry; actual AFDS MCP capture source; comparator dual-seat tolerance and failure annunciations; full TCAS/EGPWS symbol geometry; real FMC nav database, terrain and radar rendering; wiring to live IRU/ADC/CB power and aircraft source-specific circuit protection; actual EP-FSI hardware effectivity reconciliation. Therefore **do not claim 100% accuracy or complete certification**.

For visual review, select the EADI or EHSI image, change overlay opacity 0–100%, click a component in the audit register, and select PENDING/REVIEWED/ACCEPTED only after pixel and logic comparison. Further revisions should use approved per-segment bounding boxes before mounting to Unified. Protected source photo assets must never be modified as part of the audit.

## Test vectors

`core.selfTest()` checks Mach thresholds (.40 on / .38 off), DH alert and RST, FD power gating, backcourse glideslope suppression, SG transfer, EADI blackout, EHSI orientation, WPT <=40 NM, and WXR/TERR exclusion. These are deterministic unit-style checks, **not browser screenshot tests**.

Browser API: `B737EFISDisplayLab.getState()`, `B737EFISDisplayLab.dispatch({type:'set',path:'eadi.pitch',value:5})`, `B737EFISDisplayLab.runTests()`.
