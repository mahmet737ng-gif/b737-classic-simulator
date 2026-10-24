# Unified cockpit — CKP-0012

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
