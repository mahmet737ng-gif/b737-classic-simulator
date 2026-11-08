# EADI Stage 1 — Attitude-only (2026-11-08)

Two independent, non-destructive CRT glass overlays are installed in the Unified main panel.
No pre-existing photograph, control, guarded switch, rendering layer, or approved geometry was changed.

- Module: \`panel-mosaic-lab/cockpit/eadi-stage1-unified-v1.js\`
- Mount: \`panel-mosaic-lab/cockpit/index.html\`
- Geometry: native 2100 x 920 main-panel coordinates. Captain photo source aperture measured; First Officer owner-photo aperture currently PROVISIONAL and requires visual pixel registration against the FO image.
- Stage-1 only: bank scale, moving upward filled triangle attached to attitude card, fixed upper triangle, sky/earth, pitch ladder (only ten-degree labels), two black L-shaped reference wings with center datum.
- NO aircraft sensor data, electrical feeds, failure logic, FMA, tape, TCAS, RA, G/S, or FMC is connected in this stage. Attitude initializes level for geometry only, not aircraft state.
- No timers or polling. Paint is event driven.

Extension contract (console/next modules):

\`\`\`js
B737UnifiedEADIStage1.setAttitude('CAPT', pitchDegrees, bankDegrees);
B737UnifiedEADIStage1.setAttitude('FO', pitchDegrees, bankDegrees);
B737UnifiedEADIStage1.setPower('CAPT', true);
B737UnifiedEADIStage1.registerLayer('CAPT','fma', (ctx, state) => {});
B737UnifiedEADIStage1.snapshot();
\`\`\`

Reserved future layer keys: fma, speedTape, mach, localizer, glideslope,
radioAltitude, decisionHeight, flightDirector, tcasRA, windshear, comparators.

Next milestones: validate FO aperture pixels, bind per-seat IRS and electrical data,
then implement independent layers with system-level validity and failure gates.
This is training software, not a certified aircraft system.
