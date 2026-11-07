# Unified — B737 Classic (Sepehran) Android test build

A lightweight Android WebView test client for the already deployed Unified cockpit.
This is a **network-dependent** test APK. It displays the current live Unified
website and uses the exact approved Sepehran branding assets already committed to
`panel-mosaic-lab/cockpit/brand/`. It does not modify cockpit controls, imagery,
or simulation systems.

- Android package: `com.unified.b737classic`
- Display name: `Unified`
- Minimum Android: API 26 (Android 8)
- Target Android: API 34
- Website: https://mahmet737ng-gif.github.io/b737-classic-simulator/panel-mosaic-lab/cockpit/
- Icon/splash inputs: existing `unified-icon-512.webp`, `unified-splash.webp`
- Build: `gradle -p android-app assembleDebug` after placing those images in
  `android-app/app/src/main/res/drawable-nodpi/`.
- GitHub Action: `.github/workflows/unified-android-apk.yml`
- CI release asset: `Unified-B737-Classic-Sepehran.apk`, beta tag `unified-android-beta`

Debug-signed APK for sideload testing only, not Play Store distribution.
The simulated aircraft system remains strictly educational, not for flight use.
