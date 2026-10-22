# All-three-panels full inventory re-audit v0.3 — 2026-10-22

Scope: **native source photos unchanged**, 463 entries in a machine-readable candidate inventory. This is **NOT a completed pixel-accurate hardware atlas**; 0 geometry records are owner-accepted, 0 alternate poses photo-verified, and 0 entries in this audit FCOM validated.

## Source images and identity

* MAIN: `1000166281.png`, 6424×2212 pixels, SHA-256 `b6c206418feb44b43bd134cb57a51dddd8bbe928859382d3864f3fbcc5cbc1c8`.
* OVERHEAD: `IMG_4525.PNG`, 2854×4661 pixels, SHA-256 `4433b15b604357d53c860b71405657df22400f1a8d5af0082f9175f5d7e323c0`.
* PEDESTAL: `IMG_4527.PNG`, 2176×4652 pixels, SHA-256 `d3ad7aa7e8a8992e2abc57514af4d76bd0f47548c5e92c0296f94a1013ca5f4d`.

## Inventory by panel

* Main: 57 entries
* Overhead: 141 entries
* Pedestal: 265 entries
* Input roles: 413; output roles (lamps / gauges / displays): 50

## Work completed in the full re-audit pass

* Every original inventory entry was processed again against its native-size source photo: bounding-box validity, actual source crop, grayscale variance, edge content, and candidate type/role/geometry written per ID.
* Source pixel crops for **all 463** entries were verified pixel-identical to the original photos with an automated per-pixel comparison (463/463 passing). This test checks lossless source cropping, **not correct placement**.
* 14 coordinate corrections in the user-reported overhead pressurization, bleed-air, and bottom exterior-light areas, plus 5 separately listed missing region entries. Geometry is still preliminary.
* Circular-feature hints for rotary selectors; flags for suspicious low-contrast regions and **101 geometric overlaps** requiring human review. Not every overlap is a mistake (lever travel may overlap other panel elements).
* Full-resolution audit maps and 38 regional source-image review tiles generated locally.
* Local interactive review tool with per-control inspect, crop view, role/type, machine-readable states, exact pixel coordinate correction, export JSON/CSV, and original unchanged background images. The local tool is a QA viewer, **not a true aircraft state engine**.

## Deployment and limitations

The 28 MB original-photo atlas package was delivered as a conversation attachment `B737_All_Three_Panels_Full_Reaudit_v03.zip` with `index.html`, untouched originals, 463 cropped PNG images, all JSON, CSV, and audit tiles. **The ZIP is not hosted on GitHub**. The repository gets only the lightweight coordinates and this report. Current GitHub Pages cockpit is unchanged. The three source images have not been imported to GitHub, due to large binary-transfer limits in the available connector.

The user's requirement is **full independent per-item visual audit**. That remains **OPEN**, including incomplete/noisy original labels, wrong control categories, cutout boundaries, hidden alternate ON/OFF imagery, FCOM page links, and comparison tests. A single photograph cannot establish a second mechanical pose exactly. Do not claim 463 true completed or fully working switches.

## Next gated work

1. Visually sign off every control's physical body: inspect the `review/tiles/` images at original size and resolve all low-contrast, missing, out-of-place boxes; stable IDs only after this step.
2. Trace each actual movable silhouette and background restoration, not just bounding rectangles; map pivot/travel and real ON/OFF/UP/DOWN states with reference photos / 737CL documents.
3. Build a shared state kernel and connect each interactive ID to a source-cited FCOM mechanical + system rule, test every edge case.
4. Integrate to isolated test deployment, then visual approval before promoting to the root site.