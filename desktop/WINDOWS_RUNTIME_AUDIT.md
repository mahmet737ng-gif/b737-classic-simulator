# Windows runtime performance audit (opt-in)

This diagnostic is for a **locally built version containing this change**. An already installed 0.2.0 build does not acquire the new flag without an update. The command-line flag is `--performance-audit`.

Run the installed `CockpitPro.exe` with `--performance-audit`. Once the cockpit becomes usable, open the Overhead before the sampling window. The diagnostic begins 30 seconds after the initial usable report and records 8 seconds of steady-state execution. It does **not** manipulate aircraft switches or change stored state. It suppresses the normal update check in this diagnostic session so network checks cannot contaminate the sample.

Output is written locally to Electron's `app.getPath('userData')` directory:
- `runtime-performance-audit.json` when completed;
- `runtime-performance-audit-error.txt` on errors.

The JSON includes parent renderer CPU hotspots (file and source line), Chromium tracing event totals (Layout/Paint/Scripting-related) and per-frame FPS/longtask sampling for the cockpit and the mounted Overhead iframe. Totals may overlap. With Chromium site isolation, profiling a parent webContents is not guaranteed to capture every child target. Results are evidence for targeted follow-up profiling, not proof that one subsystem is responsible.

**Protection:** No edits to the frozen Overhead mosaic, guards, IRS visuals, or panel art. The flag is opt-in and changes no behavior in normal startup mode.

**Validation:** `node --test desktop/runtime-performance-audit.test.cjs` and `node --check desktop/main.cjs`. Packaging and the Windows native smoke/performance run still need execution in CI before release.
