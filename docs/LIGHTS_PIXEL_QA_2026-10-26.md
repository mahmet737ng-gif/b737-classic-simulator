# B737 Classic — Photo-pixel audit of annunciator locations

**Date:** 2026-10-26  
**Status:** Native-source contact sheet inspection done (142/142); strict numeric centre certification 110/142; 32 source sockets still need precise per-pixel sign-off.

## What was actually inspected

- 19 ORIGINAL locked/non-destructive photographic source images (15 overhead placement groups and 4 main-panel photo pieces).
- 112 overhead + 30 main instrument annunciator mounts.
- Original `sourceRect` red outlines and green pixel centre marks, generated directly from the photographed images, **not from predicted coordinates**.
- Two independent native-pixel measurements: bright/dark glass rim gradients and 4-neighbour dark-glass connected components.
- Current atlas-board coordinates use the existing verified source-image transforms. This audit does NOT imply browser screenshot or alternate DCPCS/CPCS and 737-400 mode approval.

The source crops show lamp rectangles generally centred inside the real visible dark apertures. In particular the earlier aspect-ratio distortion warning must **not** be misreported as a lamp POSITION offset.

## Numbers

| Evidence / acceptance gate | Quantity |
|---|---:|
| Native-photo contact sheets reviewed | 19 |
| Lamp instances visibly inspected on the native photo | 142 |
| Glass-edge method: centre within 3 source px and rim evidence | 60 |
| Dark-glass component method: centre within 3 px and valid component | 103 |
| Distinct lamps passing at least one strict method | **110** |
| Algorithmically unresolved after both independent methods | **32** |
| Original photo/locked layout file edits | **0** |
| Lamp `sourceRect` edits | **0** |

**Technical distinction:** An unresolved result is NOT proof of misplacement. Adjacent dark glass lamps, shared dark housings, screws and unusual/tilted bezel contours often defeat the automatic connected-component method.

## 32 still requiring precise edge sign-off

- UPPER (3): `irs-l-dc-fail`, `flight-recorder-off`, `gear-left-down`.
- OH07 (3): `stby-quantity`, `stby-pressure`, `stby-rudder`.
- OH09 (5): `fuel-center-l`, `fuel-center-r`, `fuel-1-aft`, `fuel-1-fwd`, `fuel-2-fwd`.
- OH11 (5): `drive-1-drive-pressure`, `drive-1-drive-temperature`, `drive-2-drive-pressure`, `drive-2-drive-temperature`, `standby-power-off`.
- OH14 (1): `emergency-not-armed` (portrait orientation, screw/face features).
- OH15 (2): `window-r-fwd-overheat`, `window-r-fwd-on`.
- OH16 (2): `cowl-anti-ice-1`, `cowl-valve-1`.
- OH19-VOICE (8): `door-fwd-entry`, `door-aft-entry`, `door-air-stair`, `door-equip`, `door-fwd-cargo`, `door-aft-cargo`, `door-fwd-service`, `door-aft-service`.
- OH20 (1): `duct-overheat-r`.
- OH18 (1): `ground-call`.
- Main captain (1): `main-pull-up-captain`.

## QA evidence and reproducibility

- Row-wise authoritative status: [photo-pixel-registration-2026-10-26.json](../panel-mosaic-lab/lights-test/photo-pixel-registration-2026-10-26.json)
- 19 contact-sheet generator: [lamp-photo-registration.py](../tools/lamp-photo-registration.py)
- Glass-rim pixel extraction: [lamp-photo-edge-qa.py](../tools/lamp-photo-edge-qa.py)
- Dark-component pixel extraction: [lamp-photo-component-qa.py](../tools/lamp-photo-component-qa.py)
- Pixel registry regression gate: [photo-pixel-registration.test.cjs](../panel-mosaic-lab/lights-test/photo-pixel-registration.test.cjs)
- GitHub Actions [source-photo evidence with JPG artifacts](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40235473646)

The CI workflow archives real annotated photo contact sheets. Run photo QA repeatedly without changing frozen mosaic pixel data.

## Corrective policy

No geometry moves were made from uncertain automatic boundaries. Any future correction must show:
1. original photo crop and exact current `sourceRect`;
2. measured true glass edges and their own pixel coordinates;
3. proposed displacement in **original source pixels**;
4. proof that the source-to-atlas mapping and all lamp states still render correctly;
5. a re-run of geometry tests, photo pixel tests and the frozen overhead verification.

The current positioning audit is **not fully final** until the 32 inconclusive rows are manually resolved at source-pixel precision and alternative 737-400/CPCS/DCPCS photo registrations are independently checked.
