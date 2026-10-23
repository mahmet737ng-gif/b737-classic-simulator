# NPE Stage 10 — Aircraft State Bus, Live Reference Navigation, EHSI, AFDS Boundary

**B737 Classic EP-FSI simulator-development lab; AIRAC 2610 Rev.1, training only. Not for actual navigation.**

## What works

1. `npe_stage10_bus.py` is an explicit, in-process Aircraft State Bus with a stable telemetry contract. Every sample supplies source, integrity, selected IRS/GPS position source and health, latitude/longitude, true and magnetic headings, magnetic variation, true track, groundspeed, pressure altitude, vertical speed, pitch/bank, and monotonically increasing simulator time. It validates numeric ranges and heading-frame agreement, rejects missing/invalid data, uses a host monotonic freshness clock (2 seconds default), and invalidates previous data after a corrupt sample.
2. `npe_stage10_live.py` consumes new samples only, reuses the Stage 9 lateral reference guidance core, and returns an explicit **reference-only** leg index, source group, true desired track, cross-track, distance-to-fix, and simulated FD bank preview. Never sequences past a Stage 4 route discontinuity. A stale/duplicate/invalid sample disengages the session. It requires explicit simulator-only consent and a healthy frame before ARM.
3. `npe_stage10_server.py` exposes the private Stage 4 reference plan + telemetry interface on **127.0.0.1**. Static and API requests require a literal localhost Host header; cross-origin browser requests are rejected. Valid local session tokens are required for modifications. No private AIRAC SQLite is put in the public website.
4. `npe-stage10/` adds a simulator telemetry bench and displays read-only `SIM REF` data in the approved standalone CDU/EHSI v6 through an origin-checked iframe message. All original cockpit images, rotary controls, switches, hitboxes and animation specifications remain unchanged.
5. `AFDSReferencePort` supports only an **FD preview** envelope. Any attempt to request AFDS engagement returns a structured **DENIED** response. There are no servo, autopilot, VNAV, LNAV, FD-drive or throttle outputs. This module is an interface *boundary*, not an approved AFDS control interface.

## Explicit limitations / unavailable inputs

- No actual FSX, MSFS, X-Plane, P3D or other simulator telemetry bridge has been installed or verified here. The bus accepts an **explicit** simulator telemetry JSON contract; a real simulator-specific adapter must translate its own interface into this schema and be end-to-end tested.
- No verified ARINC 424 path-terminator-coded SID/STAR/APP source is present in the existing supplied narrative dataset (Stage 8 audit). Thus the reference guidance engine supports only contiguous, validated source enroute geometry. The initial Stage 4 plan contains four mandatory discontinuities; none is automatically bridged.
- True/magnetic headings and variation are supplied by the telemetry producer; **no** geophysical or FCOM magnetic variation is invented.
- FD bank preview is computed from the Stage 9 synthetic controller; it is not the fitted EP-FSI flight director or a validated Boeing turn model.
- AFDS/LNAV/VNAV aircraft-accurate coupling, sensor hardware behavior, aircraft-specific control laws and device acceptance remain blocked pending verified aircraft documentation and a simulator bridge.

## Run on Windows using the private package

From the repository root, with Python 3.10+:

```powershell
python navigation/npe_stage10_server.py --stage4-zip "C:\Private\B737_NAVDB_AIRAC2610_NPE_STAGE10_PRIVATE.zip" --root . --port 8770
```

Open `http://127.0.0.1:8770/navigation/npe-stage10/index.html`. Select a private plan, check **Simulator training only**, click **Create session**, then **Arm reference guidance**. The page can publish a manual frame or start the clearly labeled **synthetic telemetry demo**. The approved CDU/EHSI will show `SIM REF` in PLAN mode (display-only). The AFDS engagement button must return a blocked response.

### External telemetry adapter contract

A user-built simulator bridge on the **same local computer** may send POST JSON to `/api/stage10/telemetry` using the session token returned by `/api/stage10/new`. Example schema (numeric values shown are *synthetic examples*, not real aircraft data):

```json
{
  "session": "<opaque local session token>",
  "aircraft": {
    "adapter_id": "EXPLICIT_SIMULATOR_TELEMETRY_V1", "source": "SIMULATOR_INTERNAL",
    "integrity": "VALID", "position_source": "IRS",
    "sensors": {"irs_aligned": true, "gps_valid": true, "position_integrity": "VALID"},
    "lat": 35.0, "lon": 51.0, "gs_kt": 210,
    "track_true_deg": 90, "heading_true_deg": 90,
    "heading_magnetic_deg": 87, "magnetic_variation_deg": 3,
    "pressure_alt_ft": 12000, "vertical_speed_fpm": 0,
    "pitch_deg": 2, "bank_deg": 0, "sim_time_s": 1
  }
}
```

The producer must use strictly increasing simulation timestamps; the consumer must request `/api/stage10/frame` for each new sample. No AFDS transport endpoint is provided.

## Test coverage & source control

- **23 local Python tests passed with private fixture**: 18 State Bus/Live Navigation, 4 localhost API end-to-end and 1 optional private-worldwide-source test (skips in public CI), including host rejection, source validation, duplicate/stale frame, discontinuity, and denied AFDS.
- **7 Node checks passed**: same-origin-only, actuator-free EHSI read-only message validator and safer scalar presentation.
- Chromium DOM integration passed with **mocked browser network**. The test can use the private Stage 4 reference fixture (when `NPE_STAGE10_PRIVATE_STAGE4_ZIP` is configured) or a clearly synthetic public fixture. Direct localhost browser navigation was blocked in the execution environment (`ERR_BLOCKED_BY_ADMINISTRATOR`). Full CDU/EHSI device acceptance **not performed**.
- Prior Stage 9 local tests also passed in this environment (29 tests, six skipping unavailable optional private source paths).
- The entire private Stage 4 SQLite remains excluded from public GitHub. The release ZIP contains it **only for local testing**, derived from the user-supplied private licensed source.

**Important: `Stage10` finishes the bench-level 1–4 interface work, NOT aircraft-certified/accurate LNAV-VNAV-AFDS implementation.**