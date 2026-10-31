Cockpit Pro 0.2.0 runs the current public Unified cockpit and system engines from local Windows files.

- UPDATE inside the app checks, downloads with progress, validates the package and installs on the user's Restart action. Downloads can use differential NSIS blockmaps; a complete download is the fallback.
- No update download or installation interrupts startup or an active training session. Internet is needed for updates only.
- Stable local origin, HTTP revalidation, retained browser cache and saved aircraft/engine configuration across launches and upgrades.
- Initial main-panel readiness no longer waits for the removed throttle toolbar, both CDU displays or a forced whole-cockpit view. The visible main textures and live engine/control owner must actually be ready.
- Fresh-cache and retained-cache EXE startup measurements, with external requests blocked, are attached as startup-benchmark.json. CI blocks publication above 5 seconds on its Windows test machine. Other PCs, especially HDDs or busy antivirus scans, can take longer.

First installation of 0.2.0 is manual. The old 0.1.0 beta cannot install updates from inside the app. Subsequent versioned releases use the new updater.

This build remains unsigned. Existing source limitations, including private MP3 recordings absent from the public repository and incomplete simulator integrations, remain. Owner-approved cockpit, IRS and guarded-switch assets are preserved byte-for-byte.
