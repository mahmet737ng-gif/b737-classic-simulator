# B737 Classic — selectable aircraft profile V1 (2026-10-24)

**Implemented in Unified:** `panel-mosaic-lab/cockpit/` → **Settings**.

## Intent

EP-FSI / ASN 29340 was the initial technical source baseline, not a permanent restriction on this *educational cockpit switching and procedures trainer*. Aircraft family, pressurization controller and engine instrument presentation are three **independent** simulator selections:

| Field | Option 1 | Option 2 |
|---|---|---|
| `aircraftFamily` | `B737-300-500` | `B737-400` |
| `pressurization` | `CPCS` | `DCPCS` |
| `engineInstruments` | `EIS` | `CONVENTIONAL` |

All 8 combinations are permitted in the simulator, without asserting a specific real-world installation. No flight dynamics or type-dependent aerodynamic modeling is introduced. Future 300/500 distinction can extend family metadata without changing the consumer interface.

## Implemented wiring

- `engine/config/aircraft-profile-v1.js` is the versioned, browser/Node-compatible source of truth for options, validation, system resolver and active CPCS/DCPCS engine session factory.
- Unified loads the existing `engine/systems/cpcs-v5.js` and `dcpcs-v4.js`. Exactly one is selected as the **active training pressure-controller session** (`window.B737ActivePressurization`); unselected system is not issued commands. A change of pressure-controller model starts a fresh state for the selected engine. Other profile changes do not reset an unchanged controller session.
- Settings values persist in localStorage under `b737classic.aircraft-profile.v1`, reload on startup and synchronize across tabs. Changes emit `b737:aircraft-profile-change` for later panel and ISN consumers. `window.B737AircraftProfileStore` exposes `get`, `set`, `resolve` and subscriptions.
- An actual CPCS or DCPCS standalone test panel can be opened **inside Unified**. It is an independent training lab; its controls are not yet connected to the mosaic's overhead hotspots.
- `EIS` / `CONVENTIONAL` selection is stored and advertised to future rendering consumers. The two visual instrument skins are **not swapped yet** because a second approved set of assets is not available; the locked main/overhead imagery remains unchanged.
- Frozen `panel-mosaic-lab/all-overhead/` assets, arrangement, styles, behavior and protection guard are untouched.

## Validation

Run `node tests/aircraft-profile-v1.test.cjs` and the existing Unified/locked-asset tests. This validates schema, all 8 combinations, storage, and selection of actual V4/V5 engines. It is **not** validation of cockpit type/serial effectivity, intersystem aircraft wiring, or full physical cockpit appearance.

Windows `.exe` packaging is intentionally deferred until requested; this browser-neutral configuration can be reused by the future Windows wrapper.
