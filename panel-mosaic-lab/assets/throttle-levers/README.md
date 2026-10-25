# THR-0001 · B737 Classic throttle sprite pack

The Unified page includes a guarded five-position throttle controller for engines 1 and 2. It only activates when **all ten** PNG images have been uploaded to this directory. Missing images leave the locked original cockpit plate intact.

Expected original filenames (both engine sets):
- engine-1-idle.png · engine-2-idle.png
- engine-1-quarter.png · engine-2-quarter.png
- engine-1-mid.png · engine-2-mid.png
- engine-1-three-quarter.png · engine-2-three-quarter.png
- engine-1-full.png · engine-2-full.png

Source package: `b737-throttle-unified-bundle.zip` delivered in the ChatGPT conversation. Each PNG preserves original source bytes.
The mounting code is at `../../cockpit/throttle-levers.js`, styling at `../../cockpit/throttle-levers.css`, and is linked from the Unified `index.html`.

This sprite controller uses 0%, 25%, 50%, 75%, 100% and emits `b737:throttle-position` events. It does not alter the original locked photo, overhead, simulator engine thrust, or reverse lever state. The image registration still requires visual calibration on the actual owner cockpit plate.
