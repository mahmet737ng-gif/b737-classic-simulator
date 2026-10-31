# Cockpit Pro · Windows offline desktop 0.2

The NSIS x64 installer contains the current public Unified cockpit and system engines. Start and training run from local files without an Internet connection. Existing private-audio and incomplete-system limitations remain; this is a procedures trainer.

## In-app updates

Install 0.2.0 manually once; 0.1.0 has no native updater. In the new version open **UPDATE**, check for a newer release, download with progress, and choose **Install and restart**. The updater checks in the background 15 seconds after the cockpit is usable; it never downloads or restarts automatically. Offline checks fail recoverably. NSIS SHA-512 validation prevents corrupt downloads from entering the install state. Differential blockmaps are published; the full installer is the fallback. Running JS engines are replaced only through a controlled application restart.

The GitHub public release feed uses standard `v<desktop-version>` tags and `latest.yml`, installer and `.blockmap` assets. No GitHub credential is embedded. This build is unsigned: package integrity is checked, but no Windows publisher certificate is currently supplied. Installation retains app data and the same app ID. Aircraft and engine configuration are mirrored atomically into userData and restored on launch; this does not promise restoration of an active aircraft scenario.

For a future release, increment `desktop/package.json` and its lockfile, commit to main and let **Cockpit Pro - Windows Offline Setup** build/test/publish. Existing release versions are never overwritten. A draft is published only after all assets and feed metadata are uploaded. A failed Windows startup budget blocks publication.

## Startup and responsiveness

- Existing profile resumes directly into the main panel. First use retains the aircraft selection screen.
- A retained loopback port and Chromium partition reuse the local origin and browser cache. Port conflicts fall back safely; the native configuration mirror preserves the profile.
- Local files use ETag revalidation tied to the application version. No whole-repository scan or update networking happens on startup.
- Initial readiness requires the selected profile, loaded visible main textures, mounted MCP controls and the live ECU owner. The removed throttle toolbar, whole-cockpit image loading and both CDU ready messages cannot block entry. Other systems initialize normally in the background; artwork and control behavior are unchanged.
- No timeout reports false success. The measured target is **5 seconds from process spawn to the painted main cockpit with responding controls**, on the Windows CI test machine. This is not a universal promise for all PCs.

`npm ci` then `npm run build:win` in `desktop/` builds the offline installer. Node.js is included through Electron; the user's PC needs no separate Node installation.

`node --test desktop/*.test.cjs` covers local serving/cache/ranges, startup gates, update races, recovery from offline failure, and a real electron-updater download with correct/corrupt SHA-512 bytes. It stages a fixture package but does not run an installer. `npm run smoke:win` after packaging launches the real Windows EXE three times with all external requests blocked, fresh and retained Chromium cache plus a saved Conventional configuration, and tests a live MCP control plus the 5-second startup budget. The benchmark and screenshots are attached to the CI artifact; timing JSON is also a release asset.

Mandatory owner-lock verifiers remain unchanged. The installer copies approved artwork, IRS and all 18 guards without modifying their bytes. The ten private user recordings and approved branding bytes absent from the public repository are not invented or silently substituted.
