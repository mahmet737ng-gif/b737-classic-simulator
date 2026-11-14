# LGT-GLOBAL-002 — Unified installed, BRIGHT default
Installed via shared runtime loader in `cockpit/index.html` and `interactive-overhead/index.html`.
- 87 reference-style masters are reused across 142 original source sockets (112 Overhead, 30 Main Instrument).
- The source photos, socket coordinates, legends, switch model and logic are unchanged.
- `OFF` -> OFF; `ON` / FLASH -> BRIGHT; default `getMode()` returns BRIGHT.
- `setMode('DIM')` selects the prior night-dim appearance globally without changing ON/OFF states.
- Blue DIM_BLUE / BRIGHT_BLUE remain distinct in both global brightness modes.
- This is an optical install only; all eleven Fire-panel photo-specific lamps retain the previous owner-approved assets.
- Overhead and cockpit attach distinct instances to the same master paths; main-panel lens geometry remains from original sourceRect.
- Fallback to original approved assets is intentional only for a failed/missing V2 manifest.
- Separate published v2 library itself remains immutable. Current fitted state is tested via the runtime manifest.
