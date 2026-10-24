# Unified cockpit — CKP-0002

## CKP-0005 / LGT-0007 — STAB socket fit and SPEED BRAKE mounting

The owner's Unified route now mounts the two already-existing SVG speed-brake
legends on the **upper/lower stacked center-panel black sockets**, top amber
`SPEED_BRAKE_DO_NOT_ARMED_AMBER`, bottom green `SPEED_BRAKE_ARMED_GREEN`.
Both remain testable through the in-page light inspector and gallery, with
independent explicit annunciator signals. These are *visual-test inputs*, not
claims that the automatic speed-brake control-law implementation is complete.
The underlying panel images are not edited.

`STAB_OUT_OF_TRIM` retains its requested 300×300 SVG face and yellow wording,
but the artwork is now lens-only (no duplicate bezel), and its overlay rect is
remeasured to source coordinates `[255,740,88,59]` on the engine/standby image,
filling the original black socket. The former overlay covered only 51 pixels
of the available lens width. Both mounted and gallery SVG image URLs are
versioned so GitHub Pages/browser caches cannot keep the replaced old face.

29 main-panel lights are now physically mounted, versus 27 previously. The
110 approved overhead lights and the frozen `UPD-0012` overhead montage remain
intact. Physical registration for this new fit awaits owner's visual check.

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
