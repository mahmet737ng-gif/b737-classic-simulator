# B737 Classic — Shared Three-Seat Cockpit Trainer (LAN) V0.2

## What exists

Three classroom seats — **Captain**, **First Officer** and **Instructor** — open the **same aircraft session** on three devices on a trusted Wi-Fi/LAN. The server is the only owner of the aircraft state; no per-device simulation diverges. The Captain and First Officer may operate switches. Only the Instructor may inject/remove failures, load scenarios or reset the entire aircraft. All three see the same electrical distribution, fuel/hydraulic load states, annunciations, checklist progress and event history.

This first implementation connects the **standalone training lab**, not yet the photorealistic cockpit UI. Original cockpit photos and the root site remain unchanged.

## Start on the host computer

Requirements: **Node.js 18+** (tested with Node 22), all repository files available. No npm dependencies or internet connection required while running.

1. Clone/download `b737-classic-simulator` on one host PC connected to the same Wi-Fi/Ethernet as the iPad/phones.
2. On Windows, double-click `start-classroom.cmd`. Otherwise run `npm run classroom` (or `node sync-server/server.js`) in the project directory.
3. The terminal prints **ROOM PIN**, **INSTRUCTOR PIN**, and a Wi-Fi URL such as `http://192.168.1.20:8787/trainer-lab/network.html`.
4. Open that **exact URL** on all three devices (not the public GitHub Pages URL). Use the room PIN on all seats and the separate instructor PIN on the Instructor seat.
5. Instructor: choose `GEN 1 BUS OFF`; Captain and First Officer can operate the electrical switches. The effects and checklist state update on all devices immediately. Close the shared host server when finished.

Optional host configuration (Windows PowerShell):

```powershell
$env:PORT = '8787'
$env:ROOM_PIN = '837251'
$env:INSTRUCTOR_PIN = '492163'
npm run classroom
```

Allow inbound TCP port `8787` on the **Private** Windows network profile if Windows Firewall asks. All devices must be able to reach the host IP; guest Wi-Fi/client isolation may prevent this. One LAN host is required and must remain running. There is **no browser-to-browser direct peer connection** and **GitHub Pages cannot provide the central session server by itself**.

## Implementation

- Node built-in `http` server under `sync-server/server.js` — **no third-party dependencies**.
- `POST /api/join` creates one exclusive role session per seat; PIN-authenticated instructor seat.
- Authenticated `POST /api/command` validates role and expected prior control/fault value, then atomically applies `engine/trainer/core.js` state transition.
- `GET /api/events` streams every authoritative snapshot via **Server-Sent Events** (SSE), with reconnect support and heartbeats; `GET /api/snapshot` provides on-demand catch-up.
- `POST /api/leave` releases seat; inactive leases expire; `GET /api/session` restores browser role on reload via SameSite, HttpOnly cookie.
- `PRESET` is atomic and room-wide; resetting the training scenario is limited to Instructor. All events maintain an independent server-wide revision number even when simulator scenario resets the embedded event sequence.
- Clients do **not** author derived annunciations or equipment states, only controls / faults. All projections are computed from the authoritative state.

## Security and practical constraints

**Use only on a trusted local Wi-Fi/Ethernet network.** LAN transport is **HTTP (unencrypted)**; classroom PINs are not suitable protection for Internet-facing deployment. Do not port-forward the server to the public Internet or deploy it to a general web host in this form. For cross-network/remote training, a TLS-terminated server, durable session store, stronger identity/authentication and access controls will be necessary.

Instructor PIN and room PIN are generated on server startup (or provided via environment variables); no secrets committed in the repo. Cookie-based sessions are bound to host, and the POST APIs refuse cross-origin browser requests. The server serves only the 5 allowlisted files required by this lab, not the repository or proprietary source manuals. There is one active room per process, three exclusive seats, and state is **in memory**: **a server restart resets the aircraft state**. A disconnected seat may remain reserved for up to two minutes unless it uses `LEAVE SEAT`.

SSE + POST is deliberately chosen over WebSocket because it is reliable for modest classroom state and requires zero runtime dependencies. It is still true live bidirectional collaboration: client commands travel to server via POST and state changes stream back instantly to every connected device. Instructor access is checked on the server, not only by hidden buttons in the UI.

## QA / source fidelity

- `node tests/trainer-core.test.cjs`: 28 standalone system model tests (unchanged).
- `node tests/network-sync.test.cjs`: **25 network integration assertions** involving three independent authenticated client sessions; permissions, faults, electrical buses/pumps/checklist propagation, concurrent-intent conflict, leave/rejoin, late snapshot and restricted endpoints.
- Source attribution and training assumptions follow `engine/trainer/README.md` and [TECHNICAL_DATABASE.md](TECHNICAL_DATABASE.md). Circuit assignments are still explicitly marked as approximate training mappings, not verified aircraft wiring. No flight simulation or actual QRH procedural approval is claimed.
- Audio sounds and detailed photo-based cockpit switch identifiers are not connected in V0.2. Cross-Wi-Fi WAN support, persistent multiplayer session snapshots, multiple simultaneous instructor rooms and TLS are follow-on work.

## Next work

1. Connect the **existing cockpit hotspot identifiers** to `/api/command` and route instructor fault control to the instructor overlay, retaining the immutable original cockpit art.
2. Connect the existing warning audio engine to derived state changes at each seat (including edge-triggering, acknowledge and priority policy).
3. Extend the checklist engine to full conditional Normal/Non-Normal flows without copying protected manual text to the public repo.