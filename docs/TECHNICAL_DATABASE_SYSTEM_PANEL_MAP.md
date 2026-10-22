# B737 Classic — Technical Database System/Panel Map v1

**Private persistent source collection**: ChatGPT Library > `Technical Database` > `Maps` > `737CL-Systems-Panels-v1`.

Full offline ZIP: `B737_Technical_Database_Systems_3Panels_v1.zip` (original user images, rendered annotated box maps, click-to-inspect index.html, JSON/CSV).

## Engineering system inventory

- 15 FCOM-aligned main systems; 200 simulator **proposed leaf subsystem categories**.
- 111 draft functional panel regions: 38 Main Instrument Panel, 45 Overhead, 28 Center Pedestal.
- 156 leaf subsystems have a region in one of these three images; 44 have no distinct visible region.
- Machine-verified: 111 unique IDs, all references resolve bidirectionally, all rectangles within native image bounds, exact byte-for-byte original image SHA256 matches.
- Public metadata: `engine/maps/technical-database-systems-panels.v1.json`.

## Quality disclaimer

These boxes demarcate **functional areas**, NOT pixel-perfect switch silhouettes, not verified detents/poses, not system logic. No claims of comprehensive physical-part detection. Boxes and taxonomy are an engineering first pass requiring control-by-control manual acceptance. Detailed FCOM references are currently at **chapter level**, not signed-off leaf-specific pages. The 200-item categorization is engineering-designed based on FCOM chapter topics, NOT an official number of Boeing subsystems.

No copyrighted original source images are present in this public GitHub repository. No live simulator changes were applied.

## Source

Boeing 737-300/400/500 Sepehran FCOM, Volume 2 chapters 1–15, in the private Library Technical Database. Supplemental MRG CL+NG is secondary and must not override Classic FCOM or add NG systems by inference.
