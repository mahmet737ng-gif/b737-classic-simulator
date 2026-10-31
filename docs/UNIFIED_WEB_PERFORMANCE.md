# Unified web performance

GitHub Pages publishes `web-dist`, produced by `node tools/build-unified-web.cjs`.
The build uses the same ordered-response compiler as the Windows application.
It reduces 161 initial script imports to 62, preserves source code and microtask
checkpoints, and retains every protected owner import exactly. Self-locating
modules keep their own script URL. Original source HTML and hardware assets are
never overwritten by the build.

Unprotected scripts and styles receive a URL revision calculated from the
actual file bytes. The Unified service worker can reuse those bytes without a
network round trip. A changed revision always gets a different cache key.
HTML, unversioned scripts, configuration and database JSON still revalidate
through the network, with cached fallback when offline. API requests remain
outside this cache. Installation does not download the whole aircraft.

Web and desktop readiness share the same predicate: correct selected profile,
decoded visible main-panel textures, mounted MCP controls and the live ECU.
The measured timestamp follows two animation frames. Both CDU handshakes and
offscreen textures do not block the main view, but CI independently waits for
the overhead and both CDUs before proceeding. A missing live engine or visible
texture cannot report success. Controls > load status displays the measured
startup time without continuously traversing resources while hidden.

The Pages workflow tests fresh cache, retained HTTP/service-worker cache and a
saved Conventional profile against the exact build under a repository URL
subpath. Each must be usable within five seconds on the local CI server, and
an actual MCP click/restore must complete within 200 ms. Settings and secondary
systems are also checked. Screenshots and JSON measurements are retained in the
`unified-web-startup` Actions artifact. Internet latency, bandwidth and device
speed still affect the public website; local CI timings are not a universal
five-second guarantee.
