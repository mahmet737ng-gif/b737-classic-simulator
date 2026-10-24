# Interactive overhead — RG-0001

The approved UPD-0012 mosaic, its 28 frozen files, and the original public
all-overhead URL remain unchanged. This independent page reuses the frozen
renderer and mounts controls over the measured sockets.

- 58 original TGL-0001 toggles remain installed.
- 18 rotary controls reuse B737-ROTARY-STANDARD-V1, with its fixed 50%/44%
  pivot, original transparent pixels and smooth whole-knob rotation.
- 10 guarded controls reuse the eight approved black/red PNGs. The inner
  switch cannot change while the guard is closed. Open/close and lever
  selection are separate inputs, with click/touch/drag/wheel/keyboard support.
- Flight Control A/B and Spoiler A/B close to ON, Alternate Flaps Master
  closes to OFF, Emergency Exit Lights closes to ARMED. Those six policies
  reuse the existing FCOM mechanics helper. Other policies are explicitly
  recorded in rotary-guards.json; disconnect covers preserve the lever state.
- Alternate Flaps Position is interlocked to Master ARM; disarming always
  permits spring return to OFF, including during pointer/key cancellation.
- Numeric altitude knobs provide continuous rotary interaction only; digits,
  gauges, annunciators and aircraft-system effects are separate stages.
- All frame fingerprints, source-image socket points, rotations, detents,
  continuous ranges and provenance are recorded in the two registries.
- States persist separately; saved closed guards normalize to their protected
  detents. Reset and visibility controls act on all installed controls.

Checks:

```sh
node panel-mosaic-lab/interactive-overhead/test.cjs
node panel-mosaic-lab/interactive-overhead/rotary-guards.test.cjs
python3 panel-mosaic-lab/verify-final-overhead.py
```

Never edit frozen mosaic files to add controls. Extend this independent layer.
