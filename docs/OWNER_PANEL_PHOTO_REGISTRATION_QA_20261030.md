# Owner photo panel registration — gated QA (2026-10-30)

Status: **CANDIDATE / NOT ACTIVATED IN UNIFIED**. Do not mark approved without deployed Chromium evidence.

## Source panel mapping
- P2 conventional panorama, 1463×1075: only CONVENTIONAL engine-instrument mode; EIS unchanged.
- OH21 737-400, 1045×1505: two independent L/R RECIRC FAN selectors.
- OH21 737-300/500, 1045×1506: single RECIRC FAN selector.

The OH21 source image in the frozen overhead atlas is 1122×1402 and MAY NOT be overwritten. The owner-approved UPD-0012 frozen mosaic, 18 guarded-switch red zone, IRS and EIS layers remain immutable. Existing 737-400 variant overlay and pneumatic engine MUST be preserved until a photographically registered replacement proves equivalent or better.

## Safe integration
1. Add newly supplied images under NEW distinct asset names. Never overwrite historical approved photos.
2. Use a versioned asset registry containing SHA-256, pixel dimensions, source coordinates for every switch, recessed pushbutton, rotary, gauge shaft, and lamp aperture.
3. Install on a Unified-only, mode-specific overlay, without modifying the frozen source atlas. Existing hardware/signal nodes must be moved or remounted, not cloned into independent fake controls.
4. Replace active mapping ONLY after screenshot-based comparison at 50%, 100%, 200% for both aircraft families. Check pixel-center alignment, lamp aperture containment, no double toggles, no hard-edge seams, no invisible hit targets, switching and restoring variants.
5. Verify cold/dark, power transition, pack trip, wing-body overheat, dual bleed, duct pressure, independent recirc and reset behavior against the live pneumatic/electrical engines.
6. Conventional P2 must be calibrated separately: source photo is 1463×1075 whereas legacy Conventional image is 1182×1330. Do not reuse the old needle centers without a new geometric registration, nor overlay full panorama on other live gear/flap hardware.
7. Run all repository red-zone validators and regression suites, capture resulting deployment commit SHA and screenshots. Abort/rollback on any failure.

## Current QA conclusion
Offline source-photo coordinate audit is not a deployed-browser or certified aircraft-effectivity verification. No claim of 100% installation accuracy is supported at this stage. The companion offline candidate package is held outside this GitHub branch until its PNG assets and embedded-browser evidence can be reviewed.

## Existing CI inconsistency observed
The live engine-indication JS reports CONV-FIT-0004-PIXEL-CENTERS, while an existing test checks a historical CONV-0002 status and a historical JS version suffix. Reconcile test expectations against actual tested runtime behavior, not by weakening assertions. Include the current owner PNG, owner panel registry, and new registration adapter in the workflow path filters so image-only edits cannot bypass the QA gate.
