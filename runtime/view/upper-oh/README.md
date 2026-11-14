# Overhead OH-01…OH-06 immutable source asset

- Latest update: **2026-10-23.4**.
- Source file: `panel-mosaic-lab/assets/locked/2026-10-23/OH01-06-source-9d8ac0ac86bd.png`.
- **EXACT USER-DELIVERED PIXELS**, original 1731×909 RGBA PNG, 2,995,593 bytes.
- SHA256: `9d8ac0ac86bdb92c040e9bdd97811ca381535d949bff94aa5b1a01e5de8e23df`.
- One immutable composite backing asset is shared by six selectable **parts** OH-01…OH-06; this is not six independently cropped copies, to avoid introducing duplicate scaling/cropping.
- Geometry uses draft hand-positioned polygons derived from the input image itself; boundaries **require user approval**. OH-03 uses two disjoint outline groups for Service Interphone and Dome Light. On replacing a single panel later, create a NEW append-only image and change only that part's `asset` field in `upper-oh/geometry.json`.
- Source artwork may include static annunciator text and empty control faces; interactivity remains a separate project.
- All other 53 old tiles are still `rejected`: do not use the obsolete boxes.
- The `assembled` view reuses the previous lower overhead asset as a **layout preview only**, not a verified final seam alignment.

## Append-only integrity rules

1. New asset ID and path for EVERY new submitted image; never overwrite a locked file.
2. Record SHA256 and original dimensions in the registry and add a history entry.
3. CI recalculates SHA256 of this exact source file and compares with this fixed hash. Git commit history retains earlier versions. Admins of the repo could still bypass checks or rewrite history unless repository rules/permissions prohibit this. Thus it is an application-enforced lock, not an immutable object-store guarantee.
4. The historical image file remains in Git even after its active part mapping switches to another path.