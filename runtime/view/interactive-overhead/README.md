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
- RM-0003 direct legend selection: native-pixel polygon hitboxes are registered
  for every detent of both AC/DC meter selectors, the four WIPER detents, and
  both ENGINE START switches. Tapping the printed legend selects that exact
  target with a smooth 110 ms stop; rotary dragging still steps one detent at
  a time. Geometry is mapped through the frozen atlas transforms, validated
  for collisions, and invisible until hovered or keyboard-focused. Use
  `?debugDetents=1` on the embedded overhead page to audit the polygons.
  GALLEY and RESID VOLTS are *not* AC selector detents and were removed from
  that rotary state list. Other rotary legends require their own measured
  source-pixel outlines before enabling direct label taps.
- RM-0004 touch tuning: mounted detent knobs now need 9 px of pointer travel
  **and** 12° of accumulated rotation before the first swipe step; subsequent
  steps need another 28°. Tiny releases beyond 2.5 px are not treated as knob
  taps. Clicking a calibrated legend or deliberately clicking the knob remains
  immediately responsive. Original detent angles and 110 ms animation are
  unchanged.

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

## LGT-0002 additions

26 additional mounted lamps use the 21 newly uploaded, unmodified PNG face
pairs (600x300); all 58 LGT-0001 records, geometry, assets and behavior stay
unchanged. Total: 84 lamps / 49 legend types. The separate visual LIGHTS
registry also lists all 49 types. No locked image or mosaic file is changed.

New lamps cover right-hand probes + TEMP PROBE, eight door/service sensors,
two COWL ANTI ICE, two DUCT OVERHEAT, DUAL BLEED, two each PACK TRIP OFF /
WING-BODY OVERHEAT / BLEED TRIP OFF, AUTO FAIL and OFF SCHED DESCENT.

Nine pneumatic lamps reuse engine/systems/pneumatics-v6.js, preserving its
existing source pointers, isolation logic, trip latches and reset predicates.
TRIP RESET is available under scenario inputs: clear the initiating sensor
first, then reset. Clearing a fault or changing a pack switch alone does not
unlatch a trip. New door inputs represent open/unsecured sensors, not switches
on the overhead. Other new conditions remain explicit SIM_APPROX_ONLY inputs;
no new source-page reading or precise thermal/pressure model is claimed.

## LGT-0003 information lights

110 mounted lamps / 67 overhead legend types; all 84 LGT-0002 lamp records
remain unchanged. 26 new placements reuse original supplied SVG files, including
green window ON, blue valves, generator/ground-power status, APU oil quantity,
RAM DOOR, pressurization mode, CALL, PMC INOP and upper green gear repeaters.
The independent visual catalogue includes all 83 available types, including
main-panel-only warnings whose geometry is not assigned on the overhead.

Blue information lights retain OFF / DIM_BLUE / BRIGHT_BLUE frame identity;
the boolean lights API is preserved and an additional frames snapshot reports
the rendered state. Valve changes show BRIGHT for 820ms, then DIM when open or
OFF when closed; a simulated disagreement remains BRIGHT. Transit timing and
new non-electrical sensor predicates are trainer approximations. Fuel valve
sensors are explicit scenario inputs, not inferred from ENGINE START controls.
V7 outputs drive GEN OFF BUS / GRD POWER AVAILABLE, while APU source status
uses the same selected source snapshots. No new aircraft source-page approval
or exact blue-palette lock is claimed.

The standalone lights-test page supports OFF / ON / DIM_BLUE / BRIGHT_BLUE,
uses original filenames and works from a complete local catalogue if the
GitHub listing is unavailable. Existing boolean calls remain supported;
getFrame/snapshotFrames expose full state names. Assets tagged ASSET_TEST_ONLY
are clearly distinguished from mounted overhead faces.
