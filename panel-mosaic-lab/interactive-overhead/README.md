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

## LGT-0001 annunciator overlay

58 independently addressed lamps reuse all 28 existing, unchanged LIGHTS SVG
ON/OFF face pairs. The new layer uses source-pixel rectangles mapped through
the frozen renderer, without modifying the UPD-0012 mosaic or any source image.
Two IRS mode rotaries and the passenger oxygen guard use the original approved
control artwork on the upper sockets. Original registries remain unchanged;
these three additions are isolated in lights-controls.json.

Electrical BUS OFF / TRANSFER BUS OFF / STANDBY POWER OFF use the existing
Electrical V7 evaluator and its source references (FCOM 6.10.7/6.10.9, indexed
pages 1146/1148). Its ground-AUTO ambiguity stays UNKNOWN. Existing fuel and
flight-controls labs inform prototype predicates, including pressure, redundancy,
failures and protected detents. Private Technical Database search returned no
results in this session: new predicates have chapter-level provenance only,
physical_pdf_page=null and SIM_APPROX_ONLY. No new page-level verification is
claimed and no private source material is published. The 720ms fuel-pressure
response is an interaction approximation. Component-specific bus wiring, IRS
alignment timing, APU startup sequencing, and full thermal dynamics are not
modeled. Engine/APU running state is supplied through scenario controls.

Use a switch to observe its linked lamp; select a lamp to inject a supported
sensor fault. Equipment cooling ALTERNATE selects a healthy alternate fan
when the NORMAL fan is failed. Hold the lamp-test button; pointer/key release,
cancel, focus loss and backgrounding restore actual system indications. Test
illumination respects scenario power. Passenger oxygen deployment latches
until explicit scenario reset. Switch states persist through the existing
controllers; scenario faults and lamp test intentionally do not persist.

The unavailable-legends list is visible in the inspector: missing green, blue,
right-probe, APU oil-quantity and other faces are not invented or mislabeled.

Browser integrations may use B737OverheadLights.getState()/setScenario(patch),
setFault(id, boolean), reset(), or b737:overhead-scenario. Each lamp has its own
stable data-light ID, even where legends repeat.

Additional check: node panel-mosaic-lab/interactive-overhead/lights.test.cjs
