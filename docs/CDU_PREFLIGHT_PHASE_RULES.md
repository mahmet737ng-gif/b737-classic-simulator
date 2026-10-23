# B737-CLASSIC-CDU — FCOM preflight and phase contract

Source: user-provided 737 Classic FCOM Chapter 11, Operation pp. 11.31.2–11.31.3 (20 December 2018).

### Startup
- The FMS starts in **PREFLIGHT**.
- The CDU starts with **IDENT** displayed, not INDEX/RTE/CRZ.
- IDENT remains available from the INIT/REF INDEX page.
- Preflight pages can be visited in any order. The lower-right LSK normally prompts the next page.
- Display navigation must not itself cause a flight-phase transition.

### Preflight entries
Required: initial position, route, performance data, takeoff data.
Optional: navigation database, SID, STAR, RTA, cruise wind, reduced takeoff and climb thrust limits.
TAKEOFF REF status prompts disappear after all required items have been entered.

### Modification and execution
ACTIVATE on RTE followed by EXEC makes a route active. A change to active route/performance data displays MOD, offers ERASE next to L6, and illuminates EXEC. EXEC commits the change; ERASE removes the pending change. SID changes must be linked to the current route and executed. Scratchpad accepts entries and copied fields and presents messages; box/dash/caret prompts indicate entries to make or validate.

### Flight phases (not CDU pages)
1. PREFLIGHT — initialization and data entry
2. TAKEOFF — TO/GA to thrust reduction altitude
3. CLIMB — thrust reduction altitude to top of climb
4. CRUISE — T/C to T/D (including step climbs/en-route descents)
5. DESCENT — T/D or initiated LVL CHG/vertical-speed descent to approach
6. APPROACH — 2 NM from first waypoint of selected published approach/transition
7. FLIGHT COMPLETE — after landing; clear active flight plan/load data; reset some defaults

This is a behavior specification, **not** a claim that the existing simulator already implements every phase trigger or validated flight guidance. IDENT screen field contents/locations remain draft pending the upcoming line-by-line FCOM visual review. Keep the CDU photo, interaction geometry and font binary assets unchanged.
