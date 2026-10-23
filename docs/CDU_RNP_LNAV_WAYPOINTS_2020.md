# B737 Classic CDU — RNP, LNAV, Waypoint Identifiers and RTE LEGS (FCOM 2020)

**Source:** user-supplied excerpt of B737 Classic FCOM, revision 15 October 2020, printed folios 11.31.16–11.31.23 plus an unnumbered continuation; screenshot of PDF viewer page 1510. Provenance by SHA-256 is stored in the accompanying rule registry. Only original short identifiers and independent summaries are published here.

## Key rules extracted

### RNP / ANP monitoring
Default RNP in NM: oceanic **12.0**, en route **2.0**, terminal **1.0**, approach **0.5**. A route database value or crew-entered value may supersede the environment default. **ANP exceeding the displayed RNP** produces a timed warning, not an immediate unconditional message. The two timer matrices must stay separate until applicability is confirmed:

| Environment | Option A (sec) | Option B (sec) |
| --- | ---: | ---: |
| Oceanic | 60 | 80 |
| En route | 30 | 80 |
| Terminal | 10 | 60 |
| Approach | 10 | 10 |

Both may produce the CDU warning `UNABLE REQD NAV PERF–RNP` and forward-panel amber FMC lights. Amber MAP warning coverage differs: **all phases** versus **approach only**. Do not choose one for EP-FSI without equipment evidence.

### LNAV conditional engagement
If selected, LNAV engages at most **3 NM** laterally from the active route leg. Farther away it requires an intercept angle of at most **90°** that reaches the leg **before the active waypoint**. Standard flight plan legs are great-circle paths, while published procedures may demand constant heading/track or arcs. These are entry conditions, not permission to enable real autopilot guidance from incomplete data.

### Five-character waypoint identifiers
Names are normalized using distinct rules for navaids, NDBs, named fixes, long/multiword fixes, unnamed navaid-distance points, oceanic reporting positions, DME arcs, procedure runway fixes, lat/lon points, place/bearing/distance and along-track points. Important source examples: `KIMMEL→KIMEL`, `CSN 106→06CSN`, `EPH252/24→D252X`, `N75 W170→75N70`, `VAMPS/25→VAM01`. Duplicate identifiers must open the appropriate select-desired-waypoint logic, except the documented in-route first-occurrence behavior for certain edits. These name transformations cannot be assumed safe without the referenced source context.

### RTE LEGS illustrative figure (PDF viewer page 1510)

| CDU entry | Nature | Meaning |
| --- | --- | --- |
| `(1000)` | Conditional | Heading until 1000 ft |
| `(ABC180)` | Conditional | Heading to ABC radial 180 |
| `(ABC-20)` | Conditional | Heading to ABC 20 DME |
| `(INTC)` | Conditional | Heading to course intercept |
| `BCD` | Fixed | Named waypoint |
| `(VECTOR)` | Conditional | Vector heading toward next segment |
| `CDE` | Fixed | Named waypoint |

These illustrative entries are **not** a deployable navigational route. The five conditional entries are event-driven and lack fixed latitude/longitude. With an active VECTOR and **LNAV not engaged**, auto-sequencing may occur within 3 NM of the next leg. If LNAV **is engaged**, VECTOR does not auto-sequence: an authorized direct-to/intercept-leg operation and EXEC are required. Conditional waypoints normally come from procedures rather than being typed into RTE LEGS.

### EHSI, VNAV and typography
- Active route: solid magenta. Inactive or ACTIVATE-not-EXEC: cyan dashed. MOD path and fixes: white dashed / white. Inactive missed approach: cyan dashed. Executed route offsets may be magenta dot-dash depending on option.
- VNAV waypoint restrictions: crew-entered and selected published constraints are in **BoeingCDULarge**; FMC predictions are in **BoeingCDUSmall** and do not count as restrictions. Altitude suffix **A** = at/above, **B** = at/below, missing suffix = mandatory. Example window `220A240B`.
- Airspeed restriction semantics vary by software/equipment version (AT versus AT-OR-BELOW), so preserve both branches until installed effectivity is known.

**Recorded implementation status:** requirements extracted and figure checked against screenshot. No FMC navigation, route execution, performance, EHSI or CDU layout code modified. Source-driven design awaits installed-option verification, relevant Chapter 11 controls-and-indicators pages and real route-data tests.

**Machine-readable:** [rnp-lnav-waypoints-2020.rules.v1.json](../engine/ch11/rnp-lnav-waypoints-2020.rules.v1.json).
