# IRS Procedure Trainer V1 — Unified live connections

**Status:** integration installed in the Unified cockpit, with live engine outputs but **training-only** synthetic drift and optional manually controlled motion. Not aircraft-certified navigation.

## Use on Unified

1. Open **Overhead** and zoom to the IRS display panel. The two independently interactive MSU switches are located directly below the four annunciators in each group. They are newly mounted parent-layer controls; the approved frozen photographic background and lower SYS DSPL are unchanged.
2. Select OFF → NAV for L/R in normal latitudes including Iran. Alternatively OFF → ALIGN is supported. The corresponding **ON DC** is lit for **3.5 seconds** as an initial power test. ON DC goes out, **ALIGN** lights, and the full **~600 second** alignment clock starts. Selecting high latitude above 70°12' requires ALIGN then (after 17 minutes) NAV; an incorrect OFF→NAV selection is inhibited.
3. Set initial coordinates using either method:
   - **FMC / CDU**: select POS INIT, type a valid position with the CDU keyboard (example *N35395 E051254*), and press **LSK 4R / SET IRS POS**. The same reference is offered to both eligible L/R IRSs; each aligns independently.
   - **IRS keypad**: set the approved lower **SYS DSPL** to L or R, upper DSPL SEL to **PPOS**. Use **N/2** or **S/8** as the first latitude key, followed by five digits and ENT. Then **E/6** or **W/4** as the first longitude key, followed by six digits and ENT. The entry is committed to **only** the SYS-DSPL-selected unit.
4. While alignment runs, HDG/STS uses the explicit project owner's 7-minute-capped status (7 until exactly six minutes, then 6,5,4,3,2,1). Entered PPOS may be previewed without falsely indicating a valid NAV solution.
5. When valid time and position entry requirements are complete, a normally selected NAV unit becomes NAV_READY. In the CDU **POS REF**, read the independently validated L/R lat, lon and GS. A failed/offline unit is blank rather than invented.
6. To test movement without a connected simulator, open the cockpit **inspector**, scroll to **IRS L/R PROCEDURE TRAINER**, and use **START TRAINING MOTION** with real numeric GS/TRK/heading/altitude settings. These are **BENCH_SIM values**, not live aircraft telemetry. **STOP MOTION** freezes horizontal updates. Avoid selecting motion while the IRS is aligning; it produces the motion fault as expected.
7. If using the aircraft electrical bus, change power source to **AIRCRAFT ELECTRICAL BUSES**. If no genuine known bus state is published, power is invalid; **TRAINING POWER (manual demo)** is an intentionally explicit alternative. L normal power is AC STANDBY; R normal power is AC TRANSFER 2; the switched-hot-battery backup is gated, and R backup DC cuts off after 300 seconds without normal AC.
8. Press **IRS KEYPAD** in the top toolbar to focus the actual approved keypad and display.

## Simulator telemetry

Publish monotonically timestamped, explicitly valid data into the browser:
```js
window.B737IRSTrainerUnified.publishMotion({
 valid: true,
 sourceTimestampMs: Date.now(),
 gsKt: 184.0,
 trueTrackDeg: 92.3,
 trueHeadingDeg: 90.5,
 altitudeFt: 8300,
 windFromDeg: 290,
 windKt: 20
});
```
Or dispatch `window.dispatchEvent(new CustomEvent('b737:simulator-telemetry',{detail:frame}))`. Stale or future-dated frames are rejected. Ground speed and TRUE TRACK define horizontal displacement. Without a valid external frame, the real-time navigation engine does **not** fabricate motion, even if the IRS is otherwise aligned.

**Important remaining boundary:** A real FSX/P3D/X-Plane/MSFS connector publishing those valid data packets is NOT installed in this change. It requires actual simulator source integration and device verification. The public browser interface above is ready to receive such frames.

## Source of truth and approved artwork

- **Engine/browser:** `engine/systems/irs-trainer-web-v1.js` (Node CJS companion delegates to it).
- **Unlocked parent integration:** `panel-mosaic-lab/cockpit/irs-trainer-unified-v1.js`, `.css`.
- **Embedded CDU integration:** `panel-mosaic-lab/cockpit/cdu-irs-adapter-v1.js` loaded after the already connected shared-FMC CDU session bridge in `cdu-stage.html`.
- **Calculation and 7-minute tests:** `tests/irs-trainer-core-v1.test.cjs`, `tests/irs-unified-integration-v1.test.cjs`, `panel-mosaic-lab/cockpit/irs-hdg-sts-seven-minute-v1.test.cjs`.
- Approved 13-cell/6-dot filament display, L/R SYS DSPL photo, original ISDU button photos, 18 guards, and entire overhead mosaic **remain hard locked.** New integration only reads their public state and paints input-driven data onto the exact existing SVG geometry.

FCOM: D6-27370-300/400/500-SHI, chapters 11.10.15–11.10.17, 11.20.7–11.20.10, 11.40 POS INIT/POS REF. The project-owner **seven-minute** display ceiling deliberately differs from the published 2020 FCOM ten-minute rule.
