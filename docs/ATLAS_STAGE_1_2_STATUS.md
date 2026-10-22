# Stage 1–2: Original-image controls atlas — provisional extraction

Recorded 2026-10-22. Status: **LOCAL ARTIFACT BUILT; PIXEL-PERFECT VERIFICATION PENDING**.

## Source images (all kept byte-for-byte unchanged)

| Panel | User-provided file | Native pixels | SHA-256 |
| --- | --- | --- | --- |
| Main Instrument Panel | `1000166281.png` | 6424 × 2212 | `b6c206418feb44b43bd134cb57a51dddd8bbe928859382d3864f3fbcc5cbc1c8` |
| Overhead | `IMG_4525.PNG` | 2854 × 4661 | `4433b15b604357d53c860b71405657df22400f1a8d5af0082f9175f5d7e323c0` |
| Center Pedestal | `IMG_4527.PNG` | 2176 × 4652 | `d3ad7aa7e8a8992e2abc57514af4d76bd0f47548c5e92c0296f94a1013ca5f4d` |

## Locally generated deliverable

A 18 MB ZIP is attached to the October 22 ChatGPT conversation as `B737_Stage_1_2_Original_Panel_Atlas.zip`. It is **not yet hosted on GitHub Pages and is not part of this commit**.

It contains:
- The same three original images under `source/`.
- 458 source-image pixel crops (PNG alpha masks), 57 main-panel, 136 overhead, and 265 pedestal.
- `data/controls.json`, `data/controls.csv`: unique ID, panel, approximate source-image native-pixel center and box, type, source-sprite reference, candidate ON/OFF/up/down detents, proposed motion class.
- `annotated/`: each panel with numbered bounding boxes for visual QA.
- `index.html`: offline click-to-inspect original photos with search, transparent sprite preview, native pixel readout and coordinate-correction export.
- `data/qa_summary.json` and `geometry_warnings.csv`; 13 provisional low-contrast/alpha warnings.
- `repaired-backgrounds/`: *provisional nonproduction* inpaint test assets. These are not replacements for the approved sources.

A random 60/60-sprite RGB audit verified that colored pixels inside each generated alpha region match the source image exactly. Node.js syntax check and JSON inventory check passed. **Browser execution of the viewer, perfect segmentation of part boundaries and visual validation for every item have not been confirmed.**

## Critical limitations and unverified work

1. The 458 entries are **atlas candidates, not 458 airplane-accurate control models**. Includes CDU keys, indicators, screens and dial regions. Bounding boxes are hand-indexed, some overlap, and all require native-pixel alignment QA.
2. A single static photo only contains one physical pose. The true alternate ON/OFF or UP/DOWN view, hidden geometry, pivot axis, detent travel, locking forces and conditional interlocks cannot be recovered exactly from the one photo. In the JSON every candidate carries `alternate_state_imagery: NOT_IN_SOURCE_IMAGE`, `states_verified_from_source_photo: false`, and `pose_confidence: ILLUSTRATIVE_ONLY_NEEDS_ADDITIONAL_PHOTOS_AND_FCOM`. Proposed transforms are not claimed to represent real hardware.
3. The cutouts are original pixels inside alpha shapes, **not automatically a clean hand-traced foreground**. They may include panel labels/backing or incomplete edges. Hand tracing and repair is required before using as live moving cockpit sprites.
4. The local artifact has **not** been uploaded to the GitHub repository or deployed to the simulator site. The current live website remains unchanged.
5. FCOM page-by-page control validation, system logic, browser end-to-end QA, no-missed-control audit and double/triple check remain pending.

## Next acceptance criteria

- Upload the three source images and full atlas artifacts into an isolated repo branch.
- Verify each entry's actual native image bounding box and extract clean mask layers; remove false positives and index omissions.
- Collect multiple real control poses or measured reference footage for accurate second-state silhouettes; avoid AI inventing unknown physical features.
- Connect IDs and detents to variant-specific Sepehran FCOM citations and runtime command mechanics, unit test every interaction.
- Compare actual rendered original image at 1×/2×/3× and require explicit visual acceptance before any live site replacement.

See [ENGINE_TASKS.md](ENGINE_TASKS.md) for ongoing stage status.