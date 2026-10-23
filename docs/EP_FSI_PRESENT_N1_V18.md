# EP-FSI N1 phase v18 — PRESENT N1 telemetry bridge and guarded MAX N1

Aircraft: **Boeing 737-33V / EP-FSI / MSN 29340 / CFM56-3B-1 / 20K**.

## Data ownership (important)

- **PRESENT N1** is an observed percentage of each engine fan's current rotational speed. It must come from the **Engine Core measured/derived actual N1 state** or an identified external simulator telemetry bridge. It is **not computed from the AFM tables**, N2, the thrust lever position, a hardcoded N1 or the 'engine running' Boolean.
- **MAX N1 / N1 LIMIT** needs complete airframe-correct AFM curves and corrections. The v16 PMC OFF arithmetic exists, but Boeing charts have not completed independent QA. The real MAX N1 remains `---.-`; a manually keyed N1 remains **MAN / TRAINING ONLY**.
- **Engine Core** in this repository has state of 'engine running' in training systems, but **does not provide authoritative N1(t) measurements or dynamics**. Therefore the normal 'ENGINE_CORE' state is **NO_DATA** until an engine module deliberately publishes samples. No claim of live simulator coupling.

## Implementation

- `engine/fmc/indications/present-n1-bridge-v18.cjs`: independently tracks ENG1 and ENG2 snapshots.
- `cdu-standalone/data/present-n1-bridge-v18.js`: byte-for-byte identical offline-browser UMD bundle.
- `cdu-standalone/app.js` and `index.html`: on CDU N1 LIMIT, display present ENG1/ENG2, separate MAX N1 unavailable status; replaces old 87.3/87.3 fake value in demo CRZ; optional **explicitly marked TEST** injection in sidebar. Test data never masquerade as real aircraft telemetry or numerical MAX N1.
- Source selection: ENGINE_CORE / EXTERNAL_SIM / INSTRUCTOR_TEST, clearing both engines on change.
- Old or repeated engine sequence numbers are rejected. The two engine values are isolated and validated to 0–106%; invalid, missing, stale (older than 2500 ms) or clock-regressed input displays `---.-` rather than holding the previous reading. The screen periodically repaints to expire readings.
- No autopilot/autothrottle, FADEC, engine-start, real physical engine model or network sync is added or claimed. A caller of the browser bridge `window.EPFSI_PRESENT_N1_INPUT` can select an explicit source and publish a packet, but it is only a typed adapter, not a simulator network connection.

Example packet (input reading supplied by a REAL publisher or explicitly TEST):
```json
{"source":"ENGINE_CORE","registration":"EP-FSI","serial":29340,"engineId":1,"n1Pct":85.4,"seq":1}
```
`receivedAtMs` is the local receive time in milliseconds (default `Date.now()` in the browser adapter).

## Weather/bleed/anti-ice defaults preserved

All **new simulator scenarios** inherit ISA ambient, engine bleed ON, anti-ice OFF and normal-case A/C PACKS AUTO when no explicit scenario override is given. OAT under ISA varies with pressure altitude. TAT, PMC state, measured N1 and engine running are never inferred from these defaults. Config: `docs/EP_FSI_DEFAULT_CONDITIONS.json`.

## Acceptance evidence and outstanding dependencies

Tests:
- `node tests/epfsi-present-n1-v18.test.cjs`: 14 source, engine, sequence, freshness and test-isolation checks.
- `node cdu-standalone/tests/present-n1-v18-integration.test.cjs`: 70-button standalone CDT display/mock source updates and reset; preserves MAX N1 blocked.
- Existing N1 v10–v17 checks + standalone smoke via GitHub Actions.

**Done:** telemetry contract + read-only two-engine CDU indication with honest data status.

**Not done:** a faithful N1-vs-time engine core, N1 core publisher bridge, independently verified numerical AFM MAX N1, MAX N1 feed to autothrottle. The approved final AFM N1 reference points remain zero. Previous AFM v16 private archive is unchanged. All implementation is educational simulator software and not for flight.
