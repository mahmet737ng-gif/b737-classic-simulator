# Cockpit Pro · Windows offline installer

Windows x64 NSIS Setup is built by [Cockpit Pro - Windows Offline Setup](../.github/workflows/cockpit-pro-windows.yml) on GitHub Actions.

## Bundling

- Source checkout: the entire **public** `b737-classic-simulator` repository snapshot, including every available approved panel artwork, avionics/system engine JS, CB lab, CDU, IRS, ISA, electrical lab, pressurization lab, and available audio framework.
- Runtime: Electron with an internal static HTTP server bound to `127.0.0.1` on a random port. Web frontend can use same-origin URLs without fetching the online GitHub Pages project.
- Launch: the existing `panel-mosaic-lab/desktop-shell/index.html` profile picker (B737-300/500 or 400, CPCS/DCPCS and EIS/Conventional), followed by the current Unified cockpit.
- Build: `cd desktop && npm install && npm run build:win` on Windows with Node.js 22. No separate Node.js installation needed on the user's Windows PC.
- Verification: `node --test desktop/offline-smoke.test.cjs` and desktop-shell invariants, then Windows native NSIS compilation.
- Updates: **not implemented as delta patches** in this beta. Installing a new version is required for changed system JavaScript or binary files. Frontend UPDATE currently checks GitHub SHA; it does not replace installed files.
- EXE is **unsigned**, so Windows SmartScreen may display an Unknown Publisher warning. Do not bypass antivirus prompts when the source is unexpected.

## Not included / currently not verified

- The ten private user-supplied MP3 audio recordings identified in `audio/user-recordings/manifest.json` are **not** in the public source repository. Only public audio framework and any public synthetic samples ship.
- The approved `CockpitPro_Official_Logo.png` and `.ico` are stored in ChatGPT Library and **not yet inside the public GitHub repo**. This beta uses the generic Windows app icon until their **exact approved bytes** can be added under a protected asset hash.
- Several simulator integrations (e.g. full Cold & Dark / Ready Start / Ready Takeoff scenario application, live gear/spoiler backend) remain incomplete. This installer is a snapshot of the current trainer functionality, not a completed flight simulator.
- Multiplayer `sync-server` source is bundled but not automatically launched as a separate server.
- Desktop shell readiness is visual/partial-component based; it cannot certify every subsystem's physical simulation validity.

## Safety

Never overwrite or modify the owner-approved IRS / OWNER18 guarded switch / locked cockpit artwork / LE device RED ZONE sources. Desktop packaging only copies existing bytes.

Release tag: `cockpit-pro-desktop-v0.1.0-beta.1`.

