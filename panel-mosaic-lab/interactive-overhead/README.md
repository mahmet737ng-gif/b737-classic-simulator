# Overhead toggle overlay — TGL-0001

The owner-approved UPD-0012 mosaic remains frozen. This separate page mounts
the approved toggle frames over the unchanged original renderer and source
images. The existing `all-overhead/` URL and all 28 frozen files are unchanged.

- 58 plain toggles: 41 two-position vertical, 14 three-position vertical,
  and 3 three-position horizontal (VHF NAV, IRS, EFI).
- Six original frame files are reused from `b737-cockpit-toggle-v1` and
  `nav-transfer-v3`; their SHA-256 values are recorded in `registry.json`.
- Socket coordinates are measured in each original source image, then mapped
  through the frozen crop, plate rectangle, inset and row registration.
- Click/tap, drag, wheel and keyboard operate the same state controller.
- Momentary controls release on pointer cancellation, lost capture, key release,
  blur and page hiding; held commands are not restored from saved state.
- The guide covers the lower overhead. Guarded paddles, guards, knobs, push
  buttons and OH01-OH06 controls are outside this toggle stage.
- Registry detents/spring assumptions describe this interaction stage, not newly
  validated aircraft-system logic. Reference provenance and assumptions are
  retained in `registry.json`.

Checks:

```sh
node panel-mosaic-lab/interactive-overhead/test.cjs
python3 panel-mosaic-lab/verify-final-overhead.py
```

Never edit frozen mosaic files to add controls. Extend this independent layer.
