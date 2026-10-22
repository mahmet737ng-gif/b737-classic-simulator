# B737 Classic Navigation Database (NAVDB v0.1)

**Simulator training only — NOT for operational flight navigation.**

Independent module; does not modify the existing cockpit UI. It will not feed FMC until ARINC decoding and the aircraft-specific adapter are verified.

## Sources and provenance
- [OurAirports](https://ourairports.com/data/): public-domain, worldwide community-maintained, **non-AIRAC** airport, runway, navaid and frequency records. The SHA-256 and retrieval timestamp of each input file are retained.
- [FAA CIFP](https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/cifp/download/): official 28-day, primarily U.S. ARINC 424 v18 records. Fixed-width records can be staged and audited, but are **NOT** yet translated into live fixes, airways, SID, STAR or approaches.
- Regional AIP/ARINC data for Iranian, Turkish and other procedures require verification and rights checks. No fabricated navigation legs or constraints.

## Build and query

Requires Python 3.10+ standard library only.

~~~bash
# Online first build
python navigation/navdb.py build --download --data-dir navigation/data --db navigation/navdb.sqlite

# Offline rebuild from saved source CSVs
python navigation/navdb.py build --data-dir navigation/data --db navigation/navdb.sqlite

# Optional FAA raw staging (not FMC active)
python navigation/navdb.py build --data-dir navigation/data --db navigation/navdb.sqlite --faa-file navigation/data/CIFP_261001.zip --faa-cycle 261001

# Query and JSON export
python navigation/navdb.py summary --db navigation/navdb.sqlite
python navigation/navdb.py airport OIII --db navigation/navdb.sqlite
python navigation/navdb.py export OIII OIIE OIMM --db navigation/navdb.sqlite --output navigation/output/iran-airports.json

# Unit tests
python -m unittest discover -s navigation/tests -v
~~~

## Data model and FMC gates

Imported: sources, airports, runways, navaids, frequencies, rejected, airac_cycles; optional raw FAA records in faa_raw. Deliberately **empty** pending validated ARINC field mapping: waypoints, airways, procedures, procedure_legs.

Output carries data_status=COMMUNITY_UNVERIFIED_NOT_FMC_READY. Absence of a procedure does NOT imply an actual airport has no procedures.

The import is atomic. On corruption or reference failure, the previously built SQLite output remains intact. Unresolvable references or invalid coordinates are reported under rejected. An FMC adapter must also disambiguate duplicate navaid/fix identifiers by geography, validate transitions and constraints, and conform to the documented EP-FSI FMC equipment.

## GitHub Actions

The separate workflow under .github/workflows/navdb.yml tests the module, downloads global OurAirports CSVs, builds a worldwide SQLite file, exports OIII/OIIE/OIMM sample JSON, and uploads these as an artifact with 30-day retention. It does NOT change the existing cockpit or activate unverified navdata in CDU.

Future gates: ARINC 424-18 record decoding, continuation handling, transitions, flight legs, cycle expiry, regional coverage and aircraft-specific integration tests.
