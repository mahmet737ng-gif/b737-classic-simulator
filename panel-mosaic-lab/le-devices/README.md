# LE DEVICES independent panel · LEDEV-0003

- **Reference:** owner-provided 432 × 195 pixel close-up.
- **Windows:** 12 device columns × 3 individually addressable lamp apertures = 32.
- **Artwork files:** 96 independent, individually reusable SVGs under `segments/`: OFF, BRIGHT and DIM for every aperture. Each cropped SVG has its own viewBox.
- **Background:** `panel-background.svg` (does not bake in live green/amber illumination).
- **Switch:** `recessed-test-button.svg` (independent momentary recessed pushbutton).
- **Component:** `panel.js` / `panel.css`; each mounted light is its own SVG DOM node, with stable id and data-device/data-level.
- **Test:** `index.html` gives a close-up with interactive state and brightness controls, plus the spring-return recessed TEST button.
- **Unified mount:** `../cockpit/overhead-stage.html` loads the component in the overhead iframe embedded by `../cockpit/`.
- **State methods:** `window.B737LeadingEdgeDevices.setDevice(device,state)`; `setWindow(device,level,lit)`; `setBrightness('BRIGHT'|'DIM')`; `setLampTest(bool)`.
- **Test principle:** press/hold TEST turns all 32 lamps on; release restores previous per-device/per-window states.
- **Source protection:** original locked OH01–OH06 asset, overhead index, all 18 guarded switches and other locked assets are unchanged.
- **Atlas placement status:** approximate OH01 reference-based alignment only, **not pixel-certified against the frozen full upper-overhead image**. Pixel-level QA on the live Unified is still needed.
- **Back end:** intentionally not wired yet; frontend only.

## Visual revision LEDEV-0003

Rebuilt blue-grey face and four screw locations from the Unified screenshot. 12 amber TRANSIT windows remain at their previous indices and coordinates. Green: FLAP 1–4 have one standard-height FULL_EXT lamp each; SLAT 1–8 have separate EXT and FULL_EXT lamps. Retracted = no green lamp. In total 32 independent windows. No locked red-zone file was modified.

## LEDEV-0003 location and dimensions
- Four FLAP single-green cells now occupy row 1 (same height as SLAT green cells, no row-span).
- Unified atlas OH-01 top-left footprint registered from owner's overhead screenshot: fractions x=.001, y=.622, w=.220, h=.207 of UPPER. Previously y=.063 positioned artwork over the wrong part of the atlas.
- Versioned panel image and JS/CSS URLs prevent browser caching of earlier grey artwork.
