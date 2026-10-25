# OH19 native-photo hub/aperture verification — 2026-10-26

## Verified execution
GitHub Actions [run 40238970100](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40238970100) completed successfully against the source-locked 1267×1241 OH19 PNG at SHA-256 `4c667d96ea7652e52784f5c06ee3cdde0879ca37631abf19969861afecc45fed`.

The original photograph was embedded in each 2× overlay, and **98 actual original-image RGB stroke samples** were collected. Source contrast against adjacent samples is positive for all listed positions, with mean +0.6550 (47 CAB ALT inner candidates) and +0.7871 (51 outer PRESS candidates). Contrast establishes likely printed strokes at candidate locations, but does not certify their numerical identity.

## New independent black-hole center measurement
The original image visibly contains a circular aperture inside the OH19 hub. To avoid inferring the spindle from an instrument bezel, `engine/instruments/oh19-native-hub-center-v1.py` isolates the dark central aperture using native grayscale, eight-connected segmentation and **five independent grayscale cutoff values** (4, 8, 12, 16, 20). This was re-executed in GitHub Actions, not reconstructed from the existing candidate bearings.

- **Visible aperture center** (median threshold centroids): **x=488.820, y=364.185 native source pixels**.
- Earlier optical pivot estimate: **x=489, y=365**.
- Difference: **0.835 source pixels**.
- This is a verified **visible hole-center estimate**; it does not prove the hidden physical shaft axis, actual mounting tolerances or needle sprite offset. Its current production status remains **UNAPPROVED**.

## Numeric tick interpretation
The inner CAB ALT ring contains **47** registered bright-radial-stroke candidates. **15** have existing provisional source-photo preview values, including the 0–3000-ft visually reviewed sequence; **32 do not have an independently verified numeric label**. Older interpolated numbers such as 4400, 5800 and 15833.33 ft **must not be promoted into exact minor tick values**. The outer PRESS ring's **51** stroke candidates also remain independent and non-operational.

## Operational and visual restrictions
- Do not automatically change locked panel image, approved needle shape, source image, power model, current render pivot or sprite transforms.
- `photoHoleCenterMeasured=true` does not imply `shaftPivotPhotoReviewed=true`.
- Actual needle-to-tick inner contact and full-scale sweep still require physical sprite overlay inspection.
- **0/54 full face geometry certifications** and **0 needle releases** remain unchanged.
- Ground Cabin Altitude logic (OIAW 66 ft, OIMM 3260 ft, OIII 3963 ft) is not affected.

## Reproducible evidence and links
- Successful CI: https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40238970100
- Uploaded original-photo overlays + 98 measurements + center segmentation JSON: https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40238970100/artifacts/12615629802
- Photo-centre script: `engine/instruments/oh19-native-hub-center-v1.py`
- Reference classifier: `engine/instruments/oh19-photo-evidence-v2.js`

## Next gate
Using the actual 2× original photo, complete a **line-by-line independent value review** for 32 currently unclassified CAB ALT white strokes; verify the needle tip and physical shaft using approved owner sprite mounted to the measured visible hub. Preserve UNKNOWN for any value not directly evidenced.
