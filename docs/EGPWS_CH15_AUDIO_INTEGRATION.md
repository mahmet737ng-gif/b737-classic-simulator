# B737 Classic EGPWS Chapter 15 — trainer logic and owner audio v1

**Primary source inspected:** Sepehran B737-300/400/500 FCOM D6-27370-300/400/500-SHI, Warning Systems Chapter 15, printed folios **15.10.8–10, 15.20.10–15 and 15.20.18–26**. The FCOM describes annunciations, qualitative conditions and inhibits. It does **not** supply exact manufacturer Mode 1/2/3/4 warning envelope curves, so numeric levels below are explicitly tagged **TRAINING_APPROXIMATION** and must never be represented as certified thresholds. Source is FCOM text *FCOM_Sepehran_All_Text_1937_Pages.txt*, PDF pages 1885–1887 and 1914–1930.

## 11 owner-supplied recordings (c.mp3)

| Clip | Audio sample | Chapter 15 source | When the simulator selects it |
|---|---|---|---|
| 01 | `GLIDESLOPE` | 15.10.8, 15.20.14 | Mode 5, valid ILS below beam by **more than 1.3 dots**, RA 30–1000 ft, G/S inhibit not selected |
| 02 | `PULL_UP` | 15.20.13 | Continued Mode 1 or Mode 2 severe warning after the first combined phrase; isolated word is intentionally not used for non-severe cautions |
| 03 | `WINDSHEAR` | 15.20.23 | Validated **reactive** windshear in takeoff/approach below 1500 ft RA; original leading electronic siren and three consecutive WINDSHEAR calls kept intact as a single recording. Suppresses GPWS and look-ahead terrain warnings |
| 04 | `TERRAIN_TERRAIN_PULL_UP` | 15.20.12, 15.20.19 | Look-ahead **terrain** (not obstacle) projected impact within approximately 20–30s; requires independently validated time-to-impact; TERRAIN INHIBIT cancels |
| 05 | `SINK_RATE_PULL_UP` | 15.20.13–14 | Mode 1 excessive descent-rate **warning**, distinct from initial SINK RATE caution (the latter has no approved standalone sound) |
| 06 | `TERRAIN_PULL_UP` | 15.20.13 | Mode 2 excessive terrain closure **warning**, requires independently validated closure signal; no inference from runway-elevation surrogate |
| 07 | `DONT_SINK_1` | 15.20.14 | First Mode 3 altitude loss since takeoff/go-around peak (only during INITIAL_CLIMB / GO_AROUND) |
| 08 | `DONT_SINK_2` | 15.20.14 | Follow-up Mode 3 persistent warning, after repeat interval; recorded second occurrence of DON'T SINK |
| 09 | `TOO_LOW_TERRAIN` | 15.20.12, 15.20.15 | Mode 4 high-airspeed approach with landing gear or flaps not in landing configuration, terrain not inhibited |
| 10 | `TOO_LOW_GEAR` | 15.20.14 | Mode 4 low-airspeed, low RA, landing gear not down and not inhibited |
| 11 | `TOO_LOW_FLAPS` | 15.20.14 | Mode 4 low-airspeed, low RA, gear down but flaps not in landing position and not inhibited |

**No spurious sounds:** `SINK RATE` caution, `TERRAIN` caution, `CAUTION TERRAIN`, `OBSTACLE`/`OBSTACLE AHEAD`, TCF and predictive `WINDSHEAR AHEAD` do not have approved independent phrases in `c.mp3`. They are not represented by inappropriate substitutes. They may still produce modeled visual status. `BANK ANGLE` alert under 15.20.26 also lacks an approved recording. The GPWS system-test procedure 15.10.9 includes an OBSTACLE alert not in this file; do not silently fake it.

## Validated vs simulated evidence

- **From FCOM:** GS deviation >1.3 dots, reset/inhibit below 1000/30 ft RA, actual windshear 1500 ft RA, look-ahead approximate 40–60s caution and 20–30s warning, gear/flap/terrain inhibit behavior, priority of reactive windshear over other GPWS alerts, RA callouts and BANK ANGLE thresholds.
- **Training approximation (NOT FCOM threshold):** Mode 1 sink rate envelopes, Mode 2 closure-rate severity, Mode 3 altitude loss percentage, Mode 4 speed split at 180 kt and 500-ft radio height window, 4.2s audio repetition cadence. These approximate numbers are isolated in `APPROX` for later verification against the manufacturer GPWS computer documentation.
- **Unavailable unless supplied:** Actual terrain/obstacle database, validated position-linked look-ahead impact-time prediction, weather radar predictive windshear, reactive windshear inertial detector, manufacturer-specific TCF envelope, validated terrain closure-rate input. The API permits explicitly validated training scenario injections; the physical logic does not synthesize these from airport elevation.
- **Selected radio altitude:** Captain RA when signal quality VALID; trainer runway-height surrogate is identified separately when used.
- **Cockpit audio:** 11 original phrase segments derived from owner `c.mp3` are bundled locally into one lazy-decode JS module; no remote audio download, TTS or generated tones. Audio obeys priority and repeat logic. Higher priority preempts lower priority. Critical GPWS alert pauses Radio Altimeter callouts.

## IMPORTANT: existing RA rule must be retained

FCOM 15.20.28 states **APPROACHING MINIMUMS = DH/MDA + 80 ft**; the cockpit owner previously specified **DH + 100 ft**. This EGPWS patch deliberately leaves the existing RA bridge/logic at owner-configured +100 ft, documents the deviation and does not silently overwrite it. With DH < 0, both owner minimums callouts remain inhibited.

## Tests

`node tests/egpws-ch15-v1.test.cjs` validates Mode 1–5, windshear inhibit, valid terrain/closure guard, missing audio mute behavior, test switches, all 11 sample mappings, repeat/priority. `B737_EGPWS_FCOM_Chapter15_Live_Audio_Test_Lab.html` runs 11 separate real-audio simulations (offline).

## Cockpit limits / training warning

The trainee's Flight Scenario engine does not have a worldwide terrain grid or independent weather radar windshear detector. Thus look-ahead warnings and reactive windshear require explicitly supplied instructor scenarios/validated sources; do not infer them from height alone. Mode 4 warning envelopes remain indicative only, and the entire module is **not suitable for real aircraft operations**.