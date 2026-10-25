# Gauge source-photo self-tests — 2026-10-25

Aircraft: B737-33V EP-FSI. Original image assets remain untouched.

## Work completed
- Inspected full-resolution sources for OH09, OH10, OH11, OH12, OH19-DIFF, OH20, OH21, captain, engine, first-officer inner/outer, throttle and radio panels.
- Classified the movement family for all 53 registered indicating faces. For 44, a plausible direction/model is identifiable from visible artwork; 9 require additional source evidence.
- Transcribed visible numerical scale labels or marked missing values in a separate 53-face register.
- Analyzed 21 radial dial regions: 355 automatic candidate line detections, not inherently numeric readings.
- Registered 28 photo-line/numeric candidate pairs for five example gauges. These are candidates, not completed calibration.
- Independently tested nonuniform CPS 0/400/420, DC AMPS unlabeled endpoints, differential pressure wrapping, dual pointers, signed indicators and incomplete calibration rejection.

## Main findings
CPS 400-to-420 spacing makes one global linear mapping wrong. DC AMPS has tick marks outside its -50/+50 printed labels. GEN DRIVE OIL TEMP uses RISE and IN scales separately. Differential pressure and CAB ALT use independent concentric maps. Cabin rate and VSI have positive/negative branches. RMI requires a rotating compass card and two independently shaped/controlled pointers. Flaps L/R may coincide visually. The original EGT/N2 artwork lacks required numeric marks, so temporary angle models must not be treated as source-calibrated.

## QA outcome
53/53 movement records created; 53/53 linked to source hashes; 24/53 have provisional min/max candidates; 5 have partial image-derived coordinate candidates; **0/53 are fully verified numerical calibrations** because all minor ticks, true pivots, source mechanics, and sensor mappings are not yet validated.

All new mathematical tests passed in GitHub Actions. Failed/incomplete scale data remain blocked from real-value publication. Frozen overhead and existing Unified appearance were not edited.

## Source files
- engine/instruments/gauge-motion-visual-audit-v1.json
- engine/instruments/printed-scale-labels-v1.json
- engine/instruments/photo-anchor-checkpoints-v1.json
- engine/instruments/gauge-visual-audit-v1.test.cjs
- tests/gauge-source-numeric-audit.test.cjs
