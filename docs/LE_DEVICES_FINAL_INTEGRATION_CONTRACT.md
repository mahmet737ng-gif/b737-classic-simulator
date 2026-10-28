# LE DEVICES Classic — Owner Final Lock / Integration Contract

**Status:** OWNER APPROVED FINAL · 2026-10-28 · `LEDEV-FINAL-2026-10-28`.

The visual panel, its 96 separate SVG lamp faces, the LE staging engine, the flap timing engine, and the existing core UI bridges are frozen by exact Git blob hashes in `engine/locks/le-devices-final-lock-v1.json`. The CI verifier checks deletion, modification, and segment inventory; GitHub Pages also has a pinned fail-closed lock step. Future modifications require an explicit new owner command and deliberate re-approval/rebaseline of the protected code/assets. Repository administrators can still change enforcement; this is a release invariant, not a promise of cryptographic immutability.

**Retained behavior:** 4 LE FLAPS and 6 SLATS; green EXT/FULL EXT and amber TRANSIT match actual/command agreement; physical lever controls the staged LE devices and the center-panel LE FLAPS TRANSIT/EXT lamps. Actual TE flap position animates L/R gauge needles, with provisional hydraulic-pressure-sensitive travel. Extension UP→40: first EXT stage (~10 s) then FULL when actual TE >5°. Retraction 40→UP: FULL until actual TE <10°, EXT until actual TE <1°, then RETRACTED and all lamps dark. Jam/failure, power gating and momentary TEST remain functional.

## Only four deliberate future connection ports
New file: `engine/integrations/le-devices-external-ports-v1.js`. This module is **not automatically mounted** and cannot change anything unless a future system explicitly provides snapshots to its `create(existingTrainer)` instance. No new electrical or hydraulic plant is created.

1. **Hydraulics:** `setHydraulics({A, B, standby, ptuAvailable, pressurePsi})`. Routes to existing Hydraulic B/A/standby commands, PTU, and pressure-sensitive motion.
2. **Electrical:** `setElectrical({transfer1,dc1})`. Coarse, existing Classic bus approximation only; no per-bulb wiring.
3. **Circuit breakers:** `setCircuitBreakers({overheadAnnunciator,centerAnnunciators})`. Two functional gates, not individual CB numbers. Requires an electrical snapshot first. Effective state uses three-valued logic (true/false/null).
4. **Aircraft dynamics:** `setAircraftDynamics({onGround,autoslatRequested})`. Provides flight condition and autoslat trigger. Future external aerodynamic/TE physics require an explicitly approved new contract; do not silently replace the frozen actuator.

Call `B737LEIntegrationPortsV1.create(window.B737LEDevicesTrainer)` only from an authorized future integration layer in the correct overhead iframe context. For the present release the original training behavior remains active and disconnected from future authoritative buses.

## QA and guard
Run `node engine/locks/verify-le-devices-final-v1.cjs --negative-self-test` and `node --test tests/le-devices-external-ports-v1.test.cjs`. Other scenario tests must remain green. Neither changes graphics or frozen core. Exclude broad shared cockpit pages and lamps files from full-file hashing because other systems also need to evolve; their LE integration markers are checked instead.

Provisional timing remains calibration data. Later changes to its frozen defaults require a fresh explicit owner approval, not incidental integration work.
