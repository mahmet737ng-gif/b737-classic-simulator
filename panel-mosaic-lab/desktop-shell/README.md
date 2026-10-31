# Cockpit Pro · Desktop Shell 002

## Entry point

- `panel-mosaic-lab/desktop-shell/index.html`
- Public GitHub Pages path (once Pages deployment catches up): `/b737-classic-simulator/panel-mosaic-lab/desktop-shell/`
- The browser route remains a preview. The Windows installer in `desktop/` uses the same shell with a sandboxed native update bridge and local assets.
- No cockpit/airplane photos are used on the initial selection screen; it is CSS typography and abstract chrome-like shapes only. Existing approved cockpit photos remain the live scene after START.
- The **final approved Cockpit Pro logo is separately locked** under `branding/cockpit-pro/official-logo-lock.json`; a CSS `CP` placeholder marks this shell to avoid adding large artwork to first paint.

## Live wiring and verified source APIs

| Feature | Current implementation | Source contract |
|---|---|---|
| 737-300/500 vs 737-400 | Selects/persists existing aircraft profile, then starts same-origin Unified | `engine/config/aircraft-profile-v1.js` `STORAGE_KEY`, `SCHEMA`, and `CATALOG.aircraftFamily` |
| CPCS vs DCPCS | Selects/persists same profile | Same `CATALOG.pressurization` |
| Conventional vs EIS | Selects/persists same profile | Same `CATALOG.engineInstruments`; **EIS photos are still awaiting approval** |
| Main/Overhead/Pedestal/All | Clicks existing `data-focus` controls, no duplicate scene | `panel-mosaic-lab/cockpit/app.js` |
| Loading cover | Requires selected profile, visible main textures, live ECU owner and mounted main controls. Secondary CDU/overhead status does not block entry; no forced ALL view | `startup-gate.js`, `app.js`, `performance-loader.js` |
| Flaps F5-F8 | Calls existing `B737FlapVisualTest.request()` / mechanical gates | Existing nine-detent visual trainer. Position changes are flagged as visual-only events. |
| Thrust F1-F4 | Drives two existing throttle select controls and their change events | Existing `throttle-levers.js` five-position trainer. **Not continuous FSX thrust or reverse-thrust simulation** |
| CB | Opens real `cb-panel-lab/`, selects the requested panel by its live `panelSelect`, and propagates selected CPCS/DCPCS variant | **Electrical CB bus effects are not yet comprehensively certified** |
| Audio | Opens existing test labs; identifies missing user-recorded assets | Public `audio/user-recordings/manifest.json` explicitly excludes raw user MP3 bytes |
| Update | Windows: check, download with progress, checksum-validate, install and restart. Web: GitHub SHA check only | `desktop-integration.js`, `desktop/update-controller.cjs`; publisher certificate remains pending |

## Strictly pending integrations; do NOT mark as functioning

1. **Scenario presets:** Cold & Dark, Ready for Start, and Ready for Takeoff are visible but deliberately require a future `window.B737ScenarioPresetV1.apply(mode)` that operates through the ONE shared electrical/engine/fuel/hydraulic/CB/warning subsystem. The buttons do not fabricate states.
2. **Spoiler / and Shift+/:** default FSX bindings have been researched; no single certified spoiler command-owner was found, so the shell explicitly refuses fake state changes.
3. **Landing gear G:** requires a validated central gear command and indication mapping.
4. **Audio completeness:** package licensed/owner-owned source audio with immutable hashes and verify playback, warning priorities, cockpit buses, mute and gain. Avoid claiming the private user MP3s are shipped.
5. **CB effects:** the existing direct panel dropdown is wired to the shell; next add verified CB/electrical bus coupling, authoritative panel effectivity, and cross-frame state snapshots. Do not infer bus wiring from photographs alone.
6. **Publisher signing:** native NSIS updater, differential blockmaps and SHA-512 checks are implemented. A Windows publisher certificate and a signed feed remain pending; do not label this an authenticated publisher-signed update system. Runtime JS changes require restart.
7. **Windows packaging:** implemented in `desktop/`; inspect its README for the CI release and startup measurement contracts.
8. **Full readiness contract:** expose one authoritative dependency health barrier from electrical, engine, CDU, IRS, overhead, CB and audio owners; the shell currently gates **only observable components**, and its UI does not claim that all aircraft-system state machines are validated.

## FSX keyboard source mapping

Default FSX keys (reference, not proof of all bindings in this shell): `F1` idle, `F2` decrease/reverse with hold, `F3` increase, `F4` full; `F5` flaps up, `F6` retract one detent, `F7` extend one detent, `F8` extend fully; `/` toggle spoilers, `Shift+/` arm spoilers, `G` gear, `.` brakes and `Ctrl+.` parking brake. See Microsoft FSX key reference and FSX keyboard PDF.

The shell currently implements F1-F8 using the trainer's existing available discrete controls; `/` and `G` are visible with an explicit 'not connected' warning. Shortcuts bypass typing inside INPUT/TEXTAREA/SELECT and do not run before startup readiness.

## Safety and owner locks

- **Absolutely no edits** to approved IRS frontend, OWNER18 guards, locked switch assets, cockpit geometry, atlas order, existing control hashes or owners.
- This release adds a new isolated path only. No rebuild of the existing Unified entry point.
- No release should call a UI-state-only toggle a real aircraft/system state change.
- Profile choices are educational configuration selectors; not serial-specific installation claims.
- New artwork must not overwrite the approved logo PNG or alter its SHA.

## QA checklist for live Windows/browser execution

- [ ] Open desktop shell: no airplane/cockpit photos in pre-flight selection
- [ ] Confirm each of eight permutations persists exactly to the existing profile store
- [ ] START triggers one Unified iframe, and no rendered broken/partial scene appears before the boot gate
- [ ] Main textures and live controls ready; secondary components can finish without blocking entry
- [ ] F1/F2/F3/F4 move both throttle controls within existing five accepted detents
- [ ] F5/F6/F7/F8 follow existing nine flap positions and gated detents
- [ ] Keypress in FMC/CDU and text inputs is not stolen by FSX shortcuts
- [ ] CB opens the real lab, requested P6/P18 panel is selected, and CPCS/DCPCS variant matches startup; disconnected electrical traces remain unresolved
- [ ] Audio labs are openable; actual included audio bytes audited
- [ ] Mode clicks refuse state mutations until backends are hooked
- [ ] Windows native fresh/retained-cache startup and real control response tests pass before publication; publisher signing and full scenario validation remain pending
