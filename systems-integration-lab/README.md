# Systems Integration Lab V0.2

**Separate, single-browser preview**, no network sync or changes to the root aircraft cockpit image. GitHub Pages can serve this static lab.

- Physical trainer controls `OH.*` map to existing `engine/trainer/core.js` controls.
- Instructor fault injections produce actual derived bus/pump/annunciator changes.
- Cabin and fire indications and a separate simulated in-flight stall signal connect to the existing `audio/warning-engine.js`. Displays active audio **requests**, not MP3 playback.
- Original educational BUS OFF checklist is derived from current bus state and displays achieved checkpoints.
- Pressurization prepressurization uses source-identified 60% N1, 89% N2, 1.5s thresholds; exact DCPCS feed bus wiring is *training surrogate*.
- Ground stall test requires AC generator bus; numerical airborne AoA trigger remains unavailable and cannot be calculated by this lab.

Run `npm test` in the project for tests. Local HTTP server from repository root: `python -m http.server 8000`, then open `http://localhost:8000/systems-integration-lab/`.

The original complete QRH steps, source artwork, MP3 sound assets and multi-device network are not embedded or redistributed in this page. See `docs/TECHNICAL_NETWORK_V2.md`.