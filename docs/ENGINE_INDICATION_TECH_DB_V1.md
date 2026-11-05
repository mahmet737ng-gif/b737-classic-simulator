# B737 Classic — Engine-indication technical backend v1

**Date:** 2026-11-05. **Scope:** 737-300/400/500, CFM56-3; EIS and Conventional.
Educational training simulation only. No verified EP-FSI S/N 29340 WDM or airworthiness assertion.

## Added files and contracts

- engine/instruments/engine-indication-technical-db-v1.json — version-controlled facts, sources, functional bus feeds, warning rules, conflict statuses.
- engine/instruments/engine-indication-backend-v1.js — pure, read-only engine indications state; no modifications to engine physics, graphics, or electrical model.
- engine/integration/engine-indication-live-adapter-v1.js — adapter reads existing B737ElectricalV7.evaluate(existing pack state) and existing ISN13-18 ECU get(), never creates duplicate electrical ownership.
- engine/technical_reader_v1/engine_indication_store.py — optional, immutable SQLite import into Technical Reader database.
- tests/engine-indication-tech-db-v1.test.cjs — engine and electrical regression checks.
- tests/test_engine_indication_store.py — SQLite immutability and idempotency.

## Runtime

Use the existing ECU engine instance, never create a separate Electrical V7 session.

    const db = require('./engine/instruments/engine-indication-technical-db-v1.json');
    const core = require('./engine/instruments/engine-indication-backend-v1.js');
    const adapter = require('./engine/integration/engine-indication-live-adapter-v1.js');
    const electrical = require('./engine/systems/electrical-v7.js');
    const live = adapter.create({database:db, indications:core, electrical, ecu:existingEcu});
    live.setMode('EIS');
    const readOnly = live.calculate({dtMs:1000});

Expected output includes power bus, power status, physical input, pointer/digital status, failure state, source, qualification and Fuel Used per engine. This phase prepares a **future-facing backend API**; it does not yet mount or redraw panel needles.

## Explicit uncertainties

- Conventional N2 and FF: respective DC1/DC2. EIS functional N2/EGT DC Standby, FF/N1 Battery Bus.
- Generator switch off does NOT imply transfer bus dead. Electrical V7 bus status must be evaluated after transfers.
- EIS Secondary physical LRU/pin feeds are not proved by the MRG functional feed mapping; loss returns POWER_EFFECT_UNVERIFIED rather than pretending the pointer is definitely blank.
- LAN AVM supply says 115VAC Transfer 1, while MRG includes conflicting AVM indication voltage references. The installed unit wiring is unresolved.
- Conventional Oil Pressure on supply loss can HOLD_LAST; invalid sensor and unpowered indicator are separate cases.
- No source signal means UNKNOWN, not artificial zero; no over-limit annunciation without explicit limit provenance.
- Low Oil Pressure 12/15 PSI hysteresis is modeled independently of the currently installed ECU trainer threshold; existing engine model was not silently changed.
- Oil Filter Bypass 24/26 PSID sources conflict; the value must be configured from installed-component evidence before normal operation is asserted.
- BITE constraints are derived from N1 under 10% Primary and oil pressure under 13 PSI Secondary; existing visual buttons are not modified.
- Fuel USED accumulation is integrated from real-valued ECU data; the 10-second EIS visual selector timer is not yet wired to the frontend.

## Private Technical Reader SQLite import

The private SQLite file is not stored on GitHub and has not been mutated by this commit.

    python3 -m engine.technical_reader_v1.engine_indication_store import --db /path/to/technical.sqlite
    python3 -m engine.technical_reader_v1.engine_indication_store show --db /path/to/technical.sqlite

Import inserts 36 source-indexed immutable records (32 instrument records and 4 lamp records) into ctr_engine_indication_rules plus version metadata. Existing ctr_models and source PDF records remain untouched. To update facts, increment the database revision.

## QA

    node tests/engine-indication-tech-db-v1.test.cjs
    python3 -m unittest tests.test_engine_indication_store
    python3 panel-mosaic-lab/verify-final-overhead.py
    python3 panel-mosaic-lab/cockpit/verify-guard-redzone.py --negative-self-test
    python3 panel-mosaic-lab/cockpit/verify-irs-sys-dspl-owner-lock-v1.py
    python3 panel-mosaic-lab/cockpit/verify-irs-13seg-owner-lock-v1.py --negative-self-test

Locked overhead, guarded switches, IRS display and Unified visuals were not changed.

## References

- Sepehran 737CL FCOM 6.20.8-12, 7.10.1-22, 7.20.1-2.
- B737 MRG IV.6 printed pp.172-184, IV.7 printed pp.219-225.
- Lufthansa Technical Training ATA 31-42, ATA 77-10/20/30, ATA 79-00.
