# Worldwide PMDG AIRAC 2610 private NAVDB import

A user-supplied 2026 Navigraph/Jeppesen **PMDG NAVDATA** archive has been decoded into an indexed, full worldwide **SQLite** navigation database. The normalized data and the reproducible Python importer are in the user's private ChatGPT Library:

- `/B737/NAVDB/B737_NAVDB_WORLD_AIRAC2610_PRIVATE.zip` (includes the SQLite file, importer, tests, and QA reports)
- `/B737/NAVDB/B737_NAVDB_WORLD_AIRAC2610_manifest.json`

The public repository stores only metadata in [source_registry.json](source_registry.json), and retains the **separate Iran-only** OurAirports importer `navigation/navdb.py`. The private PMDG data is the *preferred source* for future simulator navigation-data integration, but **has not been activated in the FMC/CDU**.

## Successful import

AIRAC **2610 R1**, 1–29 October 2026: Airports **17,214**; runway-end records **42,644**; Navaids **15,800**; Fixes **310,806**; airway point records **105,425**. **491,889** data records, zero rejected, SQLite integrity-check OK, 7 tests passed. Per-row source filename, line number and original record are retained with per-source SHA-256 hashes. Duplicate identifiers are retained separately for geographical resolution.

The source archive does **not** contain SID/STAR/APP procedure tables or ARINC-424 procedure legs. Those tables therefore remain empty, and no procedure is fabricated. The data is not for real-world navigation.

## Rights and safety

The uploader-supplied source identifies Navigraph/Jeppesen and contains redistribution and recompilation restrictions. No licensed source content or derived SQLite binary has been checked into this **public** repository. Only process metadata has been committed. Do not publish or resell the private archive without appropriate rights.

## Future agent workflow

1. Read `navigation/source_registry.json`.
2. Locate the private archive in the user's Library and materialize it into a local workspace when authorized.
3. Read the package README and use `navdata_importer.py` or its read-only SQLite tables.
4. Keep original source, AIRAC cycle, provenance and all duplicates; do not merge the community Iran database silently.
5. Add verified SID/STAR/APP sources and EP-FSI-specific adapter tests before activating data in the aircraft FMC.

See the [PMDG Navdata Glossary](https://support.pmdg.com/kb/a60/pmdg-navdata-glossary.aspx) for the original field-format conventions.
