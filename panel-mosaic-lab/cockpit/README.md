# Unified cockpit — CKP-0001

A single pan/zoom canvas contains the unchanged interactive overhead, five new
main-panel sources and the uploaded pedestal radio/avionics base. Region
buttons focus the same mounted scene; they never reload the overhead frame or
reset its switch/lamp state. Main and pedestal controls are base artwork only.

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
