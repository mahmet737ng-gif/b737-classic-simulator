# Unified PERF-0001

The Unified first visit previously requested all full-size main/pedestal and overhead
textures simultaneously, including hidden reference/gallery content and EFIS work in
each CDU. This change separates texture delivery from continuously running systems.

## Delivered behavior

- 31 original textures retain their exact bytes, hashes, dimensions and locations.
  The frozen `panel-mosaic-lab/all-overhead/` route and its renderer are unchanged.
- A source-hashed manifest supplies 384/768/1536 WebP display previews (quality 96).
  Detailed zoom selects the original source image, preserving its original quality.
  Preview images have the same complete extent/aspect and use the existing source
  crop/window/registration; no panel or actuator geometry is recalculated.
- The viewport loader accounts for iframe transforms, scroll clipping and device
  pixel ratio. It defers offscreen/hidden textures, requests visible ones first,
  and decodes an upgrade before replacing the current texture. Failed derivatives
  fall back to the source. Highest fetched quality stays in place when zooming out.
- The embedded overhead renderer is mechanically derived from the frozen renderer;
  only texture assignment, clone registration and metadata request caching differ.
  The standalone overhead still loads its unchanged frozen renderer.
- Existing overlay controls opt into deferred textures only when the Unified loader
  is present. Control/state engines, ISN, startup sequencing and all switch hitboxes
  initialize immediately, including when the overhead is outside the viewport.
- Tiny lossless source patches reproduce the existing FLAP tick correction and FLT
  lettering correction without downloading whole background PNGs just for a patch.
- Both CDU windows retain the original v6 display/input engine, source art, fonts,
  70 key hitboxes and shared FMC session. Hidden EHSI/photo/map scripts no longer run.
- A Service Worker scoped to `cockpit/` caches immutable textures/fonts on demand.
  Installation does not prefetch the entire cockpit. Mutable HTML/JS/CSS/JSON use
  network-first with an offline fallback; APIs and third-party URLs are excluded.
  New manifests retire only this application's old performance cache namespace.
- Collapsed load diagnostics in the inspector show readiness, request counts and
  measured transfer bytes; data stays in the browser and is never uploaded.

## Controlled browser result

Same browser, same 1363x936 viewport, DPR 1, same default main-panel view. Separate
URL namespaces gave before/after resources independent browser cache keys. Resource
Timing buffers were expanded in all three iframe documents. Measurements cover the
initial settled scene before interaction; image upgrades from later zoom are extra.

| Measurement | Before | PERF-0001 |
| --- | ---: | ---: |
| Transferred resource bytes incl. iframe documents | 77,847,695 | 1,508,566 |
| Resource/navigation entries | 367 | 192 |
| Main-panel images + both CDU input engines ready | 1,117.9 ms | 491.1 ms |

Initial measured transfer dropped **98.06%**. The timing figures are from the local
preview server, without mobile-network throttling, and are not promises for the
user's Internet connection. Production HTTPS cache behavior is verified separately.

The complete collection of smallest derivatives is 1,035,998 bytes versus
73,177,859 source bytes. This is an asset inventory comparison, not total download;
the loader selects actual quality from visible size and DPR.

## Validation

- `node panel-mosaic-lab/cockpit/performance.test.cjs`: original and derivative
  hashes, resolution selection, byte budget, exact reversible renderer derivation,
  no install prefetch, immutable reuse, fresh mutable configuration and API isolation.
- Existing cockpit, CDU/session, font lock, rotary/guard, light, FLAP and ISN tests.
- `python3 panel-mosaic-lab/verify-final-overhead.py` remains required for publication.
- Browser: OIII input propagates CAPT -> F/O; 70 keys per device; original 1199x1312
  CDU source selected at detailed zoom; 110 light test faces and 58 toggle controls.

Rebuild derivatives and the embedded renderer using
`python3 tools/build-unified-performance.py` (Pillow). This never writes original
assets or frozen files. Future images need explicit source registration in that
builder; unregistered small overlays still receive viewport-based deferred loading.
