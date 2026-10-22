# B737 Classic — Interactive Cockpit Explorer

**Working prototype v0.2** — a photo-based Boeing 737-300/400/500 training interface built around the three sections of the owner-provided cockpit reference: Overhead, Main Instrument Panel and Center Pedestal.

## Launch

Open `index.html` in any modern browser. No build, external CDNs, paid services, login, package installation or backend is required.

A public deployment is prepared with `.github/workflows/pages.yml`. Once GitHub Pages is enabled for this repository with **Source: GitHub Actions**, every push to `main` automatically deploys the site.

## What works now

- Original reference images are extracted with **handwritten annotations excluded**.
- Complete cockpit page plus separately enlarged Overhead / Main Instrument Panel / Pedestal.
- Data-defined clickable image hotspots, including 100+ mapped demonstrator controls.
- A sidebar inspector with multi-position/toggle switch settings.
- Search by control or system; scenario presets (Cold & Dark, Ground Power, In Flight); summary indicators; action log; zoom; fullscreen; keyboard shortcuts; browser-local state persistence; state export.
- Layout adapts to desktop, tablet and phones.

## Important limits

- **Educational visual prototype only; not for aviation operations.** Switching demonstrates UI state changes, not aircraft-accurate hydraulics, electrics, bleed-air, FMC, autopilot, engine logic, annunciations or interlocks.
- Panel artwork from a reference provided by the project owner is for prototype use. Before public redistribution, confirm rights to publish it.
- Do not treat any values here as FCOM/FCTM/QRH-validated or airline-approved.
- Hotspot coordinates should be individually checked against the reference at full size; additional switches may be mapped later without redesigning the UI.

## File structure

- `index.html`: cockpit workspace
- `styles.css`: desktop/tablet/mobile layout
- `cockpit-data.js`: panel geometry and mapped control registry; **source of truth** for UI targets
- `app.js`: state machine for demonstration-only switching
- `assets/*.webp`: original photographic panel assets with transparent backgrounds (offline-capable)
- `docs/ROADMAP.md`: tasks and acceptance criteria
- `.github/workflows/pages.yml`: deployment

## Next milestones

1. Audit control mapping on each panel against high-resolution reference.
2. Import, index and page-link owner-provided FCOM, FCTM, QRH.
3. Implement validated switch states and system interlocks in testable, independent modules.
4. Couple annunciators, aircraft instruments and realistic startup/shutdown scenarios to the validated system model.
5. Make safe switch guards/rotary behavior and touch/zoom interactions faithful to real hardware.

Separate repository from JeppIran; no dependencies or files shared.


## Beta 0.3: Source-grounded electrical orientation

Includes a six-item, explicitly **partial** ground electrical demonstration, with photo-based shortcuts to each mapped selector. Derived by paraphrase from the user-provided Sepehran Airlines 737CL FCOM, Supplementary Procedures, Electrical Power Up, SP.6.1–SP.6.3 (source PDF pages 196–198). No FCOM text or pages are redistributed, and this demo is **not a complete procedure or a validation of aircraft system logic**. Actual availability, load transfer, generator readiness, indication lights, APU parameters and engine condition are not modeled.
## Engine-first design v1.0 (2026-10-22)

The full 737CL simulation kernel is now **architected but not implemented**. The design and machine-readable contracts live at [docs/ENGINE_BLUEPRINT.md](docs/ENGINE_BLUEPRINT.md) and [engine/spec/](engine/spec/). Track actual implementation in [docs/ENGINE_TASKS.md](docs/ENGINE_TASKS.md). The owner's locked original PNG ('1000166281.png', 6424×2212) is identified by SHA-256 there but **is not yet imported into this repository**; the live UI still uses the earlier WebP. The design commit intentionally leaves the current UI intact.

Run 'npm test' for baseline demo tests and structural validation of architecture specs. This is NOT a claim of system accuracy.
