# B737CL Full 3-Panel Atlas Re-audit (Native Pixel) v0.4 — October 22, 2026

**Status: DRAFT. Full 3-panel inventory scanned, but every individual part still requires final visual approval. This is NOT a completed aircraft engine.**

## Primary photos unchanged

- Main Instrument Panel: `1000166281.png`, 6424×2212; SHA-256: `b6c206418feb44b43bd134cb57a51dddd8bbe928859382d3864f3fbcc5cbc1c8`.
- Overhead: `IMG_4525.PNG`, 2854×4661; SHA-256: `4433b15b604357d53c860b71405657df22400f1a8d5af0082f9175f5d7e323c0`.
- Pedestal: `IMG_4527.PNG`, 2176×4652; SHA-256: `d3ad7aa7e8a8992e2abc57514af4d76bd0f47548c5e92c0296f94a1013ca5f4d`.

## Checkable work product

- 463 candidate records: main 57, overhead 141, pedestal 265. 413 interactive *input* candidates and 50 output candidates.
- Every record has stable ID, classified control type, original-image absolute native pixel bbox + center, role, candidate state labels, lossless actual source-image crop, and machine QA notes.
- 90 manually inspected and repositioned control rectangles (mainly Overhead and Pedestal Audio/Radar), with 5 additional missed regions indexed. These are **not** 90 pixel-perfect verified sprite contours.
- 463/463 per-pixel source-crop comparison checks passed. Three SHA-256 source photo checks passed. 38 native-resolution regional review tiles and three full-resolution annotated maps generated.
- 53 initial bounding box overlaps flagged; some are valid because lever travel zones can overlap indications. Zero FCOM-linked entries in this atlas yet, zero alternate pose photos verified, zero final owner-accepted controls.
- Offline QA viewer `index.html` in local attached ZIP includes exact original photos, click/inspect/search, per-control state labels, numerical pixel-coordinate editor, JSON/CSV export. Original RGB pixels are not generatively altered.

## Local deliverable

The ZIP `B737_All_Three_Panels_Reaudit_v04.zip` (28MB) is attached to the conversation, not hosted on GitHub. Its contents: original 3 source images, JSON/CSV, 463 PNG crops, QA maps/tiles and offline editor.

## Limitations / next work

An individual switch's *true* second-state photographed form cannot be established from one still image. Coordinates remain machine-audited candidates pending 1× native-pixel manual audit; some labels/types/boxes may still be inaccurate and false positives/missing controls require inspection. The cropped regions are not guaranteed cleaned mechanical silhouettes. Each item must receive a traceable variant-appropriate FCOM page and system wiring/model validation. No live GitHub Pages site changes made. No image replacement or generated cockpit artwork introduced.

This document and `engine/atlas/control-geometries.v0.4.json` provide the resumable foundation; existing site stays unchanged until explicit owner sign-off.