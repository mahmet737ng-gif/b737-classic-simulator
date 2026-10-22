# B737 Control Atlas — stages 1–2: first-pass extraction

> ORIGINAL IMAGES UNMODIFIED — geometry/state verification remains OPEN.

## Images & cryptographic checksums

- **MAIN**: `1000166281.png`, 6424×2212, SHA-256 `b6c206418feb44b43bd134cb57a51dddd8bbe928859382d3864f3fbcc5cbc1c8`; 90 mapped candidate items
- **OVERHEAD**: `IMG_4525.PNG`, 2854×4661, SHA-256 `4433b15b604357d53c860b71405657df22400f1a8d5af0082f9175f5d7e323c0`; 196 mapped candidate items
- **PEDESTAL**: `IMG_4527.PNG`, 2176×4652, SHA-256 `d3ad7aa7e8a8992e2abc57514af4d76bd0f47548c5e92c0296f94a1013ca5f4d`; 230 mapped candidate items

## Precisely what is complete

- Original pixel bytes preserved in `/assets/` and checksums recorded.
- A separate unmodified source ROI PNG saved per control candidate in `/tiles/`.
- Centers, bounding boxes and nominal hit radii projected into FULL source pixel coordinate systems and exported in JSON+CSV.
- Screenshot-derived annotation overlays in `/atlas/*_hotspots.jpg`, plus interactive review HTML.
- Candidate types and state names provided with mandatory UNVERIFIED flags.

## NOT complete (cannot be honestly claimed)

- True transparent foreground sprite segmentation and reconstruction of background behind each switch.
- Mechanical ON/OFF pose digitization in pixels for both poses (only ONE pose visible in originals).
- Model-specific FCOM references for every control and sub-pixel/hardware QA.
- Full operational simulator systems. This is an auditing and atlas dataset, not aircraft engine behavior.

## Recommended sequential QA

1. Verify names and bounding-box center against original at 200–400% zoom.
2. Define alpha masks/sprite pivots, paint out original part without damaging labels/background.
3. Capture extra physical pose references for every detent/guard/handle or validate FCOM diagrams.
4. Record rest position, angle/travel by pose, source citation, tested indicator logic.
5. Only then promote `manualValidationRequired=false` and connect visual transforms to real engine events.

## Provisional pixel transparency

- `/layers/draft-alpha/` contains per-control **alpha-masked candidate** artwork traced by generic geometric shapes from the original pixels. These alpha masks are NOT final or pixel-verified contours. They may include background or clip protruding levers.
- It is not scientifically possible to infer the exact pixels of every second switch pose from a single photograph. Future manual reference poses or calibrated mechanical geometry are mandatory.