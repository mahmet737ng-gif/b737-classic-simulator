
## MET-0005 — Original OH10 gauges and original shared needle; scale-only update (2026-10-30)

Owner directive: **no new gauge / no new needle asset**. The 1095×1436 locked original OH10 photo, all four meter bezels and labels, all previously approved artwork and the existing `ac-dc-metering-needle.svg` blob (`3706dc3134d1c7bb989d3de519bf64aa854e705a`) are unchanged. Only the independent numerical scale-to-angle model and its existing needle mounts were updated. The CPS sprite's displayed reach uses `tipRadius: 141` for a longer existing pointer, not a new sprite. The CPS shaft location remains provisional.

- `dcAmps` interpolates native photographed −50…+50 A ticks (center zero).
- `dcVolts` interpolates photographed 0…40 V ticks.
- `cps` accepts 360…420 Hz using a **provisional**, manual-anchored angle map; 0 Hz / no AC parks at the existing `−54°` stop rather than displaying 360 Hz.
- `acVolts` accepts 100…130 V using the existing **photo-tick map pending shaft/stop signoff**; power loss (0 V) returns to the existing `−70°` rest instead of suggesting 100 V. `RESIDUAL` mode uses the separate 0…30 V interpretation (not yet photo-certified).
- Existing `B737UnifiedAcDcMetering.setReading(id,value,{mode})`, `setReadings({dcAmps,cps,dcVolts,acVolts},{acVoltsMode})`, `setAngle`, `getReadings` and `getAngles` enable direct test-lab input or qualified electrical/measurement backends. A `b737:ac-dc-metering-readings` event forwards explicit samples. Unsupported/unknown values are not invented.
- **Limits:** electrical V7 only models discrete source/bus power. It cannot derive physically calibrated amperage, frequency, and AC voltage from Boolean bus states. A real source/selector measurement adapter must send instrument measurements for genuine automatic tracking. CPS and AC VOLTS remain marked provisional, not certified.
- Shared original needle uses existing SVG 512×512, same pivots and upper-half gauge clip window, smooth 320 ms transitions. No static dial art or meter background is generated.
- QA: added scale mapping, mechanical parking, residual volts mode and original blob fingerprint tests to the existing Pages workflow; local code-level angle examples passed, but real browser and GitHub Actions results remain to be confirmed.

For comparison, the old cartoon-design lab now redirects to `acdc-metering-lab/photo-stage.html`, which uses the locked photo only.

# Unified cockpit — CKP-0012

## CDN-0001 — independent cabin PRESS and CAB ALT needles on OH19

The original OH19 pressure gauge image is unchanged. A long ivory `PRESS`
pointer reads the outer differential-pressure PSI scale, while a shorter,
thicker `CAB ALT` pointer reads the inner cabin-altitude x1000 FT scale.
Both are transparent SVG overlays on the same measured source-image pivot
at `(489,365)`. The shorter pointer is rendered beneath the long pointer.
The Unified inspector can rotate them independently or reset both to the
reference pose. The controls are visual tests only; no cabin-pressure-system
values are inferred from pointer angles.

## DAN-0002 / EGT-0002 — APU's right and left gauges

The right-hand APU A.C. AMPS gauge on OH12 reuses the already-approved white
`drive-amps-needle.svg` asset, clipped precisely to that gauge's own curved
grey cover. Its placement and test angle are independent from the two upper
A.C. AMPS gauges. The left-hand APU EGT gauge uses a distinct transparent
`apu-egt-needle.svg`, following the supplied photo's broad white body,
hollow loop and split fine tip. Both are visual overlays registered to OH12
source pixels; the locked panel artwork and final overhead mosaic are untouched.
The inspector angles are visual tests, not synthetic APU readings.
EGT-0002 broadens the EGT needle body to match the reference photograph,
without changing its pivot, loop, split tip or movement range.

## DAN-0001 — one shared needle for two drive-oil and two upper A.C. amps gauges

One transparent white pointer based on the owner-supplied reference is reused
on the two GEN DRIVE OIL TEMP dials in OH11 and the two upper A.C. AMPS dials
in OH12. Each visual instance has its own source-image placement and angle,
but all four load the same `drive-amps-needle.svg`. The original panel images
and frozen overhead mosaic remain unchanged. Each blade is clipped against
the traced upper edge of its gauge's central grey half-round cover, so the
white pointer ends at that curve instead of crossing into the grey face.
The four inspector sliders are
visual-only tests; verified aircraft values are not yet wired to these gauges.

## ISN-05 — Engine start interpolation and instrument overlays

The ISN-03 source-backed start gates remain unchanged. Between their compressed
training checkpoints, N2 and EGT now update continuously through
`engine/integration/isn-engine-start-dynamics-v1.js`. Four separate vector
gauges (N2 and EGT for each engine) are mounted over the untouched Engine /
Standby image using coordinates in that source image's 1235 × 1274 space.
The cockpit strip, gauges, and underlying start session share the same
observations; aborted starts clear stale training indications. These curves
and gauge-angle scales are **training visualization**, not calibrated engine
physics, aircraft sensor readings, or FCOM-provided acceleration schedules.

## ISN-06 — Visual registration and instructor abnormal-start tests

The gauge overlay was checked against a crop of the unmodified 1235 × 1274
Engine / Standby source: EGT pivots are (535,723) and (724,723); N2 pivots are
(535,900) and (724,900). Needle travel follows the long visible lower arc.
This is image-space alignment, **not** aircraft gauge-value calibration.

Before GRD, the instructor may inject an 18% N2 stall or a high-EGT training
curve (760°C target) per engine. The first blocks the fuel-lever cue and leaves
the engine unstarted; the second reaches the source-backed 725°C start advisory,
prevents a synthetic RUNNING transition, and requires a manual CUTOFF action in
the test. Neither injection is presented as a measured aircraft value, an
automatic fire warning, or a certified engine protection system. UI visual
inspection in a real browser remains necessary after deployment.

## ISN-03 — APU / engine start from Unified controls (training beta)

The latest Unified cockpit hosts a source-gated Engine/APU start training
sequence on the same shared electrical, pneumatic and annunciator state.
The real overhead BATTERY, APU START, APU GEN, APU BLEED, PACK L/R,
ISOLATION VALVE, IGNITION selector and both ENGINE START rotary knobs are its
inputs. The APU and starter timing checkpoints are explicitly synthetic
`TRAINING_SEQUENCE_SIMULATED` signals, not real aircraft acceleration models.

Two independently operable Engine Start Levers are physically overlaid on the
existing blank throttle-quadrant photograph. Their two measured slots are
registered in original image coordinates, then mapped into the display crop.
They toggle between CUTOFF and IDLE by clicking/tapping the corresponding
pedestal lever. The actual ISN-03 feedback confirms each position and rejects
premature IDLE before N2, so a rejected command does not move the overlay.
Only extra overlays and the state bridge are changed: approved photo pixels,
the throttle-quadrant crop and frozen overhead mosaic are unmodified.

Regression tests: `node tests/isn-apu-start-chain-v1.test.cjs` and
`node panel-mosaic-lab/cockpit/engine-start-levers.test.cjs`.
This is a cockpit-system training beta; flight dynamics, actual N2/EGT
physics and comprehensive FCOM validation are not claimed.

## MET-0001 — one AC/DC metering needle shared by four OH10 gauges

The owner-supplied photo of the AC/DC metering panel is the shape reference
for a single slender, ivory-white vector pointer with a tapered tip. The
one transparent `ac-dc-metering-needle.svg` asset is reused in four separate
SVG instances on the Unified cockpit's embedded OH10 panel: DC AMPS, CPS,
DC VOLTS and A.C. Each instance has its own measured source-image pivot and
reference-photo starting angle. Its root is hidden behind the original
lower grey gauge cover while the visible part remains over the black dial.

The Unified inspector offers four independent angle-only visual tests and a
reference-position reset. `B737UnifiedAcDcMetering.setAngle(id, degrees)` or
`setAngles({dcAmps,cps,dcVolts,acVolts})` can later receive verified system
outputs. The display does not invent DC/AC electrical values or warning
thresholds. The approved OH10 source image and frozen all-overhead mosaic
remain unchanged; this is an additive overlay only.

## FTN-0001 — approved white Fuel Temperature needle mounted on Unified

The isolated, sharp-tipped white vector needle approved by the owner is
included byte-for-byte as `fuel-temperature-needle.svg`. In the Unified
cockpit only, it is a separate overlay on the embedded OH09 fuel panel. Its
single pivot is registered to OH09 source pixel `(506, 235)` on the existing
1012 × 1555 image, with exact atlas placement and zoom inherited from the
approved mosaic. A small central mask allows the original blue pivot cap to
remain visible without changing the background image or adding a new cap.

Movement follows the already-defined Fuel Panel animation registry: -40 to
+40 °C maps to -70 to +70 degrees; default is +10 °C with 320 ms easing.
The inspector includes a temperature slider and reset. The external API is
`B737UnifiedFuelTemperature.setTemperature(celsius)` or a
`b737:fuel-temperature` event with `{detail: {celsius}}`. This is a UI input,
not a fabricated automatic fuel-heat or fault model. This patch leaves
`all-overhead/`, the source fuel panel image, and the standalone fuel panel
unchanged. `fuel-temperature-needle.test.cjs` validates the placement,
movement range and approved asset fingerprint.

## FLP-0001 — approved double flap needle in Unified

The Boeing 737 Classic F/O inner/gear panel's existing blank FLAPS gauge now
receives an independent SVG needle pair, mounted over the unchanged approved
panel source. Both needles pivot on the same precisely anchored location.
The **R needle is always underneath L** in SVG paint order; when both angles
are equal, R is fully hidden, including the R legend. When independent
positions differ, the underlying R needle becomes visible. The vector
calibration uses the gauge's UP/1/2/5/10/15/25/30/40 marks, and smoothly
interpolates between them without changing the panel background.

Normal operation mirrors the existing `trailingFlaps` common sensor input to
both needles. The Unified inspector exposes independent L/R visual tests,
plus a button to restore common-sensor following. External simulator systems
can deliver independently measured values via the `b737:flap-positions`
event or `B737FlapNeedles.setPositions({left,right})`. The overlay does not
invent or activate an operational FLAP SPLIT warning threshold; this remains
the responsibility of the documented flap-sensing system. `flap-needles.test.cjs`
verifies the renderer's ordering contract, position mapping and integration.

No frozen `all-overhead` image, source, lock or layout file was modified.

## CKP-0005 / LGT-0007 — STAB socket fit and SPEED BRAKE mounting

The owner's Unified route now mounts the two already-existing SVG speed-brake
legends on the **upper/lower stacked center-panel black sockets**, top amber
`SPEED_BRAKE_DO_NOT_ARMED_AMBER`, bottom green `SPEED_BRAKE_ARMED_GREEN`.
Both remain testable through the in-page light inspector and gallery, with
independent explicit annunciator signals. These are *visual-test inputs*, not
claims that the automatic speed-brake control-law implementation is complete.
The underlying panel images are not edited.

`STAB_OUT_OF_TRIM` retains its requested 300×300 SVG face and yellow wording.
The replacement `STAB_OUT_OF_TRIM_FIT_OFF/ON.svg` is an additive revision in
`LIGHTS` because the original `STAB_OUT_OF_TRIM_OFF/ON.svg` files are immutable.
The registered artwork is lens-only (no duplicate bezel), and its overlay rect is
remeasured to source coordinates `[255,740,88,59]` on the engine/standby image,
filling the original black socket. The former overlay covered only 51 pixels
of the available lens width. Both mounted and gallery SVG image URLs are
versioned so GitHub Pages/browser caches cannot keep showing the older face.

29 main-panel lights are now physically mounted, versus 27 previously. The
110 approved overhead lights and the frozen `UPD-0012` overhead montage remain
intact. Physical registration for this new fit awaits owner's visual check.
The shared asset-discovery merge honors pinned registry filenames so the
immutable older STAB images cannot silently replace the registered FIT faces
or create a duplicate STAB card when GitHub directory listing is available.

## Owner naming and upload destination — CKP-0004

**«یونیفاید» (Unified) means this route:**
`https://mahmet737ng-gif.github.io/b737-classic-simulator/panel-mosaic-lab/cockpit/`

An owner request to upload or make something testable **on Unified** targets this
cockpit page, not the separate `lights-test/` page. The Unified annunciator QA
dialog reads the shared SVG `LIGHTS` registry, including two-state green/amber/red
and two-/three-state blue assets. It allows searching, cycling or explicitly
selecting states, and whole-catalogue ON/OFF preview. Where a legend already
has measured Main Instrument Panel sockets, selection also updates those
mounted instances using a temporary visual override; Reset restores their
previous source-driven states. Unknown physical placements stay in the in-page
gallery until geometry is approved. Existing 110 overhead and 27 main-panel
mounted annunciators, their systems logic, and the frozen UPD-0012 mosaic
remain unchanged.

A single pan/zoom canvas contains the unchanged interactive overhead, five new
main-panel sources and the uploaded pedestal radio/avionics base. Region
buttons focus the same mounted scene; they never reload the overhead frame or
reset its switch/lamp state. Main and pedestal switches are base artwork only. LGT-0004 adds 27 independent main-panel annunciator sockets using 20 unchanged LIGHTS face pairs.

The new overhead-stage.html copies the existing interactive page structure and
reuses its renderer, exact UPD-0012 layout, original assets and LGT-0003 modules.
The optional embed presentation is local to this new route. No frozen source,
lock manifest, verifier or original all-overhead URL is edited.

All new main textures are existing repository blobs. Their full source area and
aspect ratios are preserved. The initial visual registration against the main
photograph is reviewable, not asserted as final owner-approved geometry. The
root file_000000006c00820ab145b3682f686256.png is the exact supplied outer F/O
panel (Git SHA verified), despite its opaque repository filename.

The pedestal radio base is the original Library item
libfile_5aeb51496eb88191be12ff3d6b903a27, materialized and copied byte-for-byte to
PD-RADIO-AVIONICS-7a41044771fa.png. Its 1122×1402 pixels and SHA256 are retained
in assembly.json. The upper throttle/fire image remains the explicitly labeled
existing reference, using a presentation-only window of assets/pedestal.webp;
no ambiguous rejected fire-panel variant is silently substituted.

The old interactive-overhead entry redirects to this unified page; add
standalone=1 to retain the original independent overhead test screen. The
frozen all-overhead URL retains its original behavior and pixels.

Same-origin frame commands provide momentary lamp test, lamp fault inputs and
reset without accessing another service. Messages verify both origin and frame
identity. No new full-aircraft wiring or main-panel system integration is
claimed. Existing overhead system assumptions and source-status labels remain.

Checks: node panel-mosaic-lab/cockpit/test.cjs and the existing overhead tests,
plus python3 panel-mosaic-lab/verify-final-overhead.py.


## LGT-0004 database update

27 main-panel instances are mounted in source-image pixel coordinates. All 110
overhead instances are preserved. Registry `lights.json` records the exact face
hashes, measured sockets and page-level FCOM provenance. Conditions for 26
instances were checked against the private Technical Network V2 database;
BRAKE_TEMP has only a direct visual test input and no fabricated temperature
threshold. WHEEL_WELL_RED remains in the 83-type gallery because the upper
pedestal reference socket is occluded; no new face covers the throttle handles.

Source references (FCOM-SEPEHRAN-1937, physical PDF page → printed folio):
1066 → 4.10.23; 1184 → 7.10.13; 1191 → 7.10.20; 1258/1259 →
9.10.13/9.10.14; 1856 → 14.10.1; 1860 → 14.10.5; 1885/1886 →
15.10.8/15.10.9; 1912 → 15.20.8. Source transcription is checked;
independent engineering signoff and owner visual acceptance remain pending.
Only paraphrased predicates and source identifiers are published, not the
private raw reference database.

The model consumes explicit simulated sensor outputs. It does not infer a
physical start valve position merely because ENGINE START is set to GRD.
Full GPWS hazard envelopes, autobrake disarm timing and engine physics remain
upstream. The requested BELOW_GS_P_INHIBIT face uses FSU variant conditions.
Gear lever OFF does not invent a new position command; actual in-transit/unsafe
sensors and idle-thrust warning are still honored. Altitude warning flash is a
one-second visual test cadence; exact Boeing flash timing is not asserted.

The inherited overhead-power signal gates both automatic conditions and manual
lamp tests. Same-origin/source checks protect the frame bridge; the bridge now
also reports settled light state changes after timed overhead valve transitions.

Run `node panel-mosaic-lab/cockpit/lights.test.cjs` for source-condition,
input-validation, power, gear, flap, engine, altitude and unchanged face checks.


## LGT-0005: visible touch-friendly visual diagnostics

The toolbar's visual-light-test button is a click/tap toggle: its ON state
persists after pointer release and through region changes. It explicitly tests
all 137 face images independently of simulated electrical power or an incomplete
overhead handshake. It does not alter switches, sensors, faults or simulated
power. The embedded overhead uses a route-local CSS presentation override;
the original standalone overhead and frozen UPD-0012 URL are unchanged.
The first click activates the test; the next returns to source-driven states.
Reload clears visual-test mode. Reference mode is disabled during this test.

Explicit individual ON/OFF visual overrides also work without simulated power;
AUTO continues to obey simulated power and sensor conditions. Main-panel reset
clears local and shared visual testing. The old momentary model lamp test still
obeys simulated power. Regression cases cover no handshake, power-off visual
test, restoring AUTO and preserving all input state.


## CDU-U1 / CKP-0008: captain and first officer CDU

Two independent iframe instances reuse the existing cdu-standalone-v6 entry
structure, exact approved 1199×1312 source artwork, original 70-key map,
five annunciator outputs and shared locked CDU fonts. Original files under
cdu-standalone-v6, engine/ch11 and assets/fonts are unchanged. The embed
stylesheet only removes the standalone page chrome/EHSI/sidebar and presents
the original CDU at its native pixel size. No display typography, key-box
coordinates or source image pixels are recalculated.

Both units sit in the existing main-panel region, below the center instruments,
with captain on the left and first officer on the right. Source aspect ratio
is preserved. The new placement is reviewable; it is not a new owner-approved
pixel-geometry lock. Existing panel placements, Fire Protection position and
139 mounted annunciator sockets are preserved.

The top CAPT/F/O buttons focus the same mounted instances; they never reload
them or discard scratchpad/page state. Each embedded window owns its v6 state,
keyboard focus, route modifications and reset. There is no new FMC cross-fill
or shared route engine. Existing CDU source/page validation limits remain.
Same-origin messages are checked against the precise seat frame before
reporting readiness or sending a seat-specific reset.

Use the stable /panel-mosaic-lab/cockpit/ URL and refresh for current updates.
Regression: node panel-mosaic-lab/cockpit/cdu.test.cjs plus existing CDU font,
asset, public-routing and frozen-overhead guards.


## CKP-0009: owner-reference CDU size correction

Supersedes CDU-U1's 180-pixel full-bitmap placement. The owner's screenshot
`image(20261024-180813).png` defines the visible captain and F/O bezel frames.
The original source PNG includes large black side margins; its actual visible
bezel is source rectangle x=111, y=21, width=866, height=1277. A parent frame
window excludes only this padding. Source image pixels, 1199×1312 internal
viewport, 70-key map, five outputs, v6 engine and locked font files are unchanged.

`cdu-size-reference.json` stores the screenshot fingerprint, measured frames,
unchanged engine-panel anchor and normalized-correlation registration. The
screenshot and its desktop UI are not published. Independent horizontal and
vertical presentation scales fit each photographed reference frame; the image,
display and all hitboxes are transformed together. Captain's visible bezel is
204.312255×318.968500 native main-panel units; F/O is
211.208871×321.554731. Both are positioned by the same engine-panel anchor.
This is a pixel-reference match, not an assertion of millimeter measurements.

The same fixed Unified URL, independent seat states, focus/reset commands and
existing panel/light geometry are retained. CDU tests project all four bezel
corners back into the owner screenshot and check that all original key hitboxes
remain inside the visible source window.


## CKP-0010 — shared FMC, separate CDU displays

Both original v6 CDU displays now use one in-memory FMC session in the Unified parent.
Active fields, pending modifications, staged route fields, and optional route-adapter
data propagate synchronously in either direction. Pages, scratchpads, messages,
brightness, and page-selection cursors stay local. ACTIVATE, EXEC and ERASE update
the same dataset; changing pages alone never copies the other CDU display.
The session is scoped to this Unified page; standalone v6 behavior is unchanged.
A late-loading/reloaded CDU receives the current shared data. CDU reset clears only
that display and input; the explicit shared FMC reset clears flight data in both.

Per owner correction, the F/O top edge extends upward by 18 main-panel native pixels
while its approved bottom, x and width stay fixed. Captain placement and all other
panel geometry, source artwork, font files and 140 key hitboxes are unchanged.

## CKP-0011 — standalone blank throttle quadrant installed

The owner's new 1145×1373 `Aircraft Throttle Quadrant Control Panel.png` is mounted
as the complete upper Pedestal panel at native width 1150, preserving its aspect
ratio and original pixel bytes. The historical full pedestal photograph remains
available only in Reference mode. The 685-pixel cropped Fire Protection plate
follows immediately under the complete throttle panel, and the approved
Radio/Nav/Audio plate follows under Fire, also at its original aspect ratio.
The Pedestal and overall canvas heights increase to accommodate this without
covering or deforming any neighboring panel. Lever mechanisms are not baked into
the blank source and will be installed independently in the interactive stage.
Frozen UPD-0012 overhead artwork and main-panel/CDU geometry are unaffected.

## CKP-0012 — owner-reference proportion and white-border correction

The throttle's original locked 1145×1373 RGB image is preserved byte-for-byte.
In the Unified presentation only, a 1055×1290 source-window crop trims the
blank outer margin and a measured silhouette polygon masks remaining white
corners around the metal body. The throttle core now occupies 606 native pedestal
units, centered in the original 1150-unit assembly, rather than stretching across
the full pedestal width. Fire follows at y=740.986 and radio at y=911.089,
restoring the original reference's proportions. Model validation and source
fingerprint checks prevent accidental image stretching or mutation.

## PERF-0001 — progressive textures and first-visit load reduction

Unified now requests 384/768/1536 source-hashed display previews according to the
visible viewport and DPR, upgrading to the original image at detailed zoom. Offscreen
textures, hidden references and galleries wait for visibility; control/FMC/ISN state
engines keep running. The frozen overhead route and original assets are unchanged.
Both embedded CDUs omit hidden EHSI/map work. An on-demand, versioned runtime cache
reuses immutable images/fonts while mutable configuration is fetched fresh.

Controlled cold-URL browser measurement: **77.85 MB -> 1.51 MB** initial transferred
resources (98.06% less); 367 -> 192 request entries. These are local preview results,
not a guaranteed Internet load time. See `docs/UNIFIED_PERFORMANCE_PERF0001.md` for
measurement conditions, delivery rules, rebuild instructions and validation.

## CRN-0001 — lower cabin climb-rate needle

The OH19-DIFF lower CABIN CLIMB gauge has an independent transparent SVG pointer
mounted over the immutable panel. Its source-image pivot is (520, 950); at
offset 0 the pointer points left to the printed zero tick. The visual-test
offset control and reset are independent of the upper PRESS/CAB ALT needles.
No cabin-rate system signal or value-to-angle calibration is claimed yet.
Regression: `node panel-mosaic-lab/cockpit/cabin-rate-needle.test.cjs`.

## CTN-0001 — cabin temperature needle

The OH20 temperature gauge reuses the exact `cabin-rate-needle.svg` asset,
without creating a second needle sprite. Its independent pivot is (618, 681)
in the locked source image. The overlay follows the atlas artInset rather than
the whole panel box. Default visual indication is 20°C. The six printed
temperature marks define a visual interpolation only; no aircraft temperature
signal is connected. Regression:
`node panel-mosaic-lab/cockpit/cabin-temperature-needle.test.cjs`.

## DPN-0001 — two duct-pressure pointers

The OH21 pressure indicator has independent R and L pointers sharing the
locked source-image pivot (544, 439). Both have a thick white forward blade
and a black labeled root near the pivot. R is drawn first, L above
it. Both initially indicate zero and fully overlap there; separate visual-test
sliders can reveal either pointer. The 0–100 PSI angular mapping follows the
printed dial and is not yet connected to the bleed-air system. The OH21 source
artwork remains unchanged. Regression:
`node panel-mosaic-lab/cockpit/duct-pressure-needles.test.cjs`.

## DPN-0002 — owner screenshot shape correction

The owner-supplied screenshot supersedes the earlier generic pointer drawing.
The proximal black section and its white L/R character are on the pointing
side of the original pivot; the broad white blade continues outward to the
tip. The unsupported rear counterweight, invented hub and gradient are gone.
Both assets have the same traced silhouette; only the character differs.
The locked OH21 background is still byte-for-byte unchanged.

## DPN-0003 — reuse the Cabin Rate needle

The earlier DUCT PRESSURE-specific L/R sprites are superseded. Both OH21
pointers now load the exact, unmodified `cabin-rate-needle.svg` used by the
Cabin Rate gauge. Only the installation scale changes: the tip radius is 148
OH21 source pixels, matching the printed dial. R remains below L at the same
pivot, and each moves independently. The shared asset has no L/R lettering;
none is drawn onto it. The locked background and the source SVG are unchanged.

## OXG-0001 — crew oxygen pressure indicator

The upper OH01–OH06 panel's empty CREW OXYGEN aperture receives a separate
vector dial and movable needle. The dial follows the owner reference: brown
face, 0/5/10/15/20 scale, intermediate white ticks, and OXY. PRESS. / PSI X
100 legend. The source-image center is (1078, 636), face radius 62 px. Its
white tapered needle and dark central cap are separate from the face. A value
in PSI maps linearly from 0 at −124° to 2000 at +124°. The 1200 PSI initial
reading follows the supplied screenshot for visual testing only; no live
oxygen-system contract is asserted. B737UnifiedOxygenPressureGauge exposes
setPressurePsi and receives b737:oxygen-pressure-value with a psi field. The
locked UPPER source and atlas renderer remain unchanged. Regression:
node panel-mosaic-lab/cockpit/oxygen-pressure-gauge.test.cjs.

## ASP-0001 — captain airspeed and VMO/MMO pointers

The captain IAS/Mach gauge in the frozen main-panel photograph receives two
separate vector overlays. The airspeed pointer has a dark shaft and white tip;
the VMO/MMO barber-pole pointer has diagonal red/white bands. Both share the
source-image pivot (1108, 973), but move independently. The initial visual
positions follow the owner screenshot: 60 KT airspeed and approximately 340 KT
VMO/MMO. Visible printed marks from 60 to 400 KT define a provisional visual
interpolation. This is not a verified airspeed-system calibration or an AFM
operating limit; it is not yet connected to an aircraft speed source. The
original captain-panel bitmap remains unchanged. Regression:
node panel-mosaic-lab/cockpit/airspeed-pointers.test.cjs.

## ASP-0002 — first-officer Airspeed / VMO/MMO duplicate

The same two approved needle sprites are mounted independently on the
first-officer IAS/Mach gauge in the frozen `fo-inner` image. The F/O pivot is
(741, 577) in its 918 × 1713 source image; pointer radii are scaled to that
dial. Captain and F/O visual values can be controlled separately with the
`station` argument, or updated together when the event omits `station`.
The F/O printed scale uses its own provisional visual interpolation, distinct
from the captain's. Neither gauge asserts a live air-data connection.

## FLN-0001 — photographed ALT, VSI, clock, and RMI needles

Five transparent SVG sprites reproduce only the photographed needle forms:
altimeter, vertical-speed indicator, clock, RMI 1 (thin dashed), and RMI 2
(broad hollow). Both RMI needles share the gauge pivot but rotate
independently. The same assets are mounted over captain and first-officer
panel pieces at separately measured pivots and radii, without modifying the
frozen source images. Inspector sliders and
`B737UnifiedFlightNeedles.setAngle(station, key, angle)` provide visual tests.
These are appearance and angle controls, not yet aircraft-system readings.
Regression: `node panel-mosaic-lab/cockpit/flight-needles.test.cjs`.

## FLN-0002 — exact owner-reference RMI geometry, both stations

Two pointers are isolated by their source colors in the 435×436 owner reference.
The yellow solid slim pointer (RMI 1) is an unchanged-resolution transparent
raster with only color replaced by white. The green hollow double-ended pointer
(RMI 2) is traced directly from its color mask into white SVG contours at the
same 435×436 original coordinate scale. Their source pivot is (216,240); both
are mounted at each dial's radius / 215 to captain and first-officer RMI gauges.
Each rotates independently, without adding a fake large cap. These renderers
are visual tests only and preserve all original locked gauge artwork.

## FLN-0003 — numerals-inner-edge RMI reach on both stations

After the owner reviewed the real Unified RMI screenshot, the source-photo
registration was corrected to pivot (216,218) rather than (216,240).
Both reference needle assets from FLN-0002 are kept **byte-for-byte unchanged**:
RMI 1 is the slim white arrow with the original fine trailing leg; RMI 2 is the
white hollow pointer whose two ends have distinct shapes. The only adjustment
is a common 0.57 placement scale relative to FLN-0002; station-specific dial
radii remain inherited from the locked atlas. The projected tips extend to
approximately 44% of the registered dial radius, reaching the inner numeral
boundary without obscuring digits or tick marks. Captain/F/O bearings still
rotate independently. This remains a visual test, not a live NAV connection.

## FLN-0004 — RMI needles reach the scale ticks, not the labels

The owner clarified that the needle tips must touch the **inner ends of the
white scale tick lines**, not stop inside the numeral ring. Measured from the
latest zoomed Unified screenshot, the old pointer tip was roughly 180 px from
the center; the scale-tick inner edge is approximately 260 px from the same
center (screen coordinates at 2x crop magnification). The only runtime change
is the RMI placement scale 0.57 → 0.835, producing a source-tip projection of
0.6486 of the registered dial radius. Both white source assets remain byte-for-
byte unchanged, retaining the *different* front/back profiles of the hollow
RMI 2 pointer, and keeping each station and needle independently controlled.
No frozen panel art, atlas coordinates, pivot, or non-RMI instrument changed.
