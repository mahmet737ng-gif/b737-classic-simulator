# B737 Classic — FCOM Chapter 11 §32: FMC Databases, Thrust, Fuel, Power and Failure

**Project:** `B737-CLASSIC-CDU` in `mahmet737ng-gif/b737-classic-simulator`.

**Source:** User-supplied screenshots from Boeing FCOM `D6-27370-300/400/500-SHI`, PDF viewer pages **1542–1549**, printed folios **11.32.1–11.32.8**. Date provenance *differs by page*: **11.32.1: 6 Dec 2013**, **11.32.2–11.32.5: 15 Jun 2023**, **11.32.6: revision not visible**, **11.32.7: 15 Oct 2020**, **11.32.8: 15 Jun 2023**. The page 1547 folio is inferred by sequence, not visually confirmed in the screenshot. User image SHA-256 values and source folios are in the accompanying JSON.

**Status:** 112 separately anchored source-derived condition/effect rules. These are **not** evidence that the runtime FMC, fuel buses, or A/T are already wired to these rules. Variant/equipment selection for EP-FSI remains pending.

## 11.32.1–11.32.2 — FMC Databases

Two primary stores are required: **Performance** (airplane drag, engine model, speeds, optimal/max altitudes, maintenance adjustment for drag or flow) and **Navigation** (VHF navaids, waypoints, airports/runways, procedures including SID/STAR/approach, company routes).

The permanent nav database has **two 28-day datasets**; navigation calculations use the selected active dataset. This is an FMC navigation dataset model, not evidence about the chart library cadence.

There are distinct **Temporary** and **Supplemental** flight-plan expansion stores:
- Temporary records are cleared at flight completion; Supplemental records remain until a crew delete.
- Temporary/Supplemental together: shared slots for **40 navaids** and **6 airports** on a first-come basis.
- Waypoints: **20 temporary-reserved** slots (including manually created RTE/RTE LEGS) plus **20 shared** slots available to either temporary or supplemental; total capacity **40**.
- A created waypoint is *not* placed into the database runway category. Full storage requires deleting old entries, not silently dropping locked/canonical navigation data.

These are the source's described capacity limits, not automatic permission to change an existing commercial nav database.

## 11.32.2–11.32.4 — Thrust Reference and Derates

FMC reference thrust expressed as **N1 limits** includes takeoff, derated takeoff, assumed-temperature takeoff, climb, reduced climb, cruise, continuous and go-around. Under the appropriate auto flight control configuration the A/T uses references for mode-dependent lever commands and power-management equalization. Source describes transitions by flight phase and crew selection via `N1 LIMIT`.

- A crew-entered **thrust reduction height** on `TAKEOFF REF` page 2 ranges from **800 to 9999 ft** in the given configuration; airline/model-engine default applies otherwise.
- Fixed takeoff derate selection is described on `N1 LIMIT` or `TAKEOFF REF 2/2` depending on software variant. The selected derate is a takeoff thrust limitation; increasing thrust after derated takeoff has specific procedural cautions.
- Assumed-temperature takeoff may reduce thrust by as much as the described **25% below the certified rating**, subject to approved performance data, field conditions and the no-slush/snow/ice/potential-windshear caveat in the source. Do not interpret that as a global always-safe calculator allowance.
- If available, `CLB 1` reduces **N1 limit ~3%** (roughly 10% thrust), while `CLB 2` reduces **N1 limit ~6%** (roughly 20% thrust). A different equipment option offers only `CLB 1`. The reduced climb reference returns to full climb by approximately **15000 ft**; cruise automatically references `CRZ` for the documented variant.
- Reduced climb can reduce engine maintenance cost while increasing trip fuel consumption. The user project's chosen **CFM56-3B-1 20K** rating does *not* supply all needed performance tables in these screenshots; never hardcode accurate N1 from approximate general descriptions.

## 11.32.4–11.32.5 — Fuel Monitoring and Warnings

Fuel Quantity comes from the fuel-summation system and is shown in `PERF INIT` and `PROGRESS 1`. A documented invalid fuel-flow branch issues `VERIFY GW AND FUEL` and can use last-valid fuel quantity with crew-managed estimates. An alternative invalid-fuel-quantity branch blanks fuel data and disables VNAV. Preserve both failure and option gates instead of merging them.

Warning logic documented in separate text variants:

| Trigger | Output | Source |
|---|---|---|
| Predicted fuel at destination below **900 kg** *or*, in another unit variant, **2000 lb** | `INSUFFICIENT FUEL` | 11.32.5 |
| Predicted arrival fuel lower than `RESERVES` on PERF INIT | `USING RSV FUEL` | 11.32.5 |
| Detected fuel decrease greater than **675 kg** *or* **1500 lb**, persisting after **120 s** | `CHECK FMC FUEL QUANTITY` | 11.32.5 |

Fuel predictions assume the gear and flaps stay up through climb/cruise/descent; prolonged extension requires separate fuel use treatment.

## 11.32.5–11.32.7 — FMC Electrical Loss and Hardware Failure

- Interruption shorter than **10 s**: LNAV and VNAV disengage, entered data remain and the FMC resumes with restored power.
- Ground power loss **10 s or more**: preflight entries and procedures must be repeated.
- In-flight power loss **over 10 s**: on restoration the `MOD RTE LEGS` page and `SELECT ACTIVE WPT/LEG` appear. The crew must select an active route leg or waypoint / Direct-To or intercept *before LNAV is re-engaged*.
- General failure: FMC alert and CDU fail indications, `VTK` on EHSI, loss of LNAV/VNAV as appropriate; map failure detail appears approximately **25–30 s** later.
- With **dual FMC**, left- and right-FMC failures require *different* source-select and autopilot-side logic: **BOTH ON L** can recover a right-failed FMC's right EHSI; **BOTH ON R** can recover from a left-side failure. A false/mismatched dual FMC configuration can generate re-synchronization guidance and eventual `DUAL FMC OP RESTORED`.
- Double FMC failure is separate from a temporary source mismatch; alternative hardware/software variations may display MENU/MCDU fallback pages.

This is a source-driven *failure/systems interface contract*, not approval to physically toggle MCP source-select switches when the user selects a CDU page.

## 11.32.8 — Software Exception Recovery

The documented **pre-U10.8A** logic can shut down after **3 software resets within 60 seconds**. For **U10.8A**, exception handling tries to degrade instead of full reset:
- In degraded FMC mode **LNAV and MAP are retained**, **FMC predictions halt**, and **VNAV disconnects**.
- Exception during **active flight plan** processing: alert `VNAV INVALID - PERF`; crew re-enters Cost Index; upon EXEC, predictions can resume and VNAV becomes eligible for re-engagement.
- Exception during **MOD plan** processing: delete the MOD plan; alert `INVALID MOD PLAN`; LNAV and VNAV remain active in this specific case.
- Exception during **inactive plan** processing: delete the inactive plan; alert `INVALID INACTIVE PLAN`; current operation remains unchanged.
- Severe/inconsistent software state can still require a real restart. Do **not** substitute one universal FMC-error reset for these branches.

## Consumer matrix and protection

Affected: `FMC_NAV/PERFORMANCE_DATABASE`, `FMC_DATA_CYCLE`, `N1 LIMIT`, `TAKEOFF REF`, `PERF INIT`, `PROGRESS`, `RTE LEGS`, MCP/A/T interface, EHSI, Warning Engine, Fuel Quantity/Flow buses and FMC power/source select.

This commit is **source-only**. Locked CDU background, 70 button regions and both `BoeingCDU-Large.ttf` / `BoeingCDU-Small.ttf` assets remain untouched. Original Boeing FCOM screenshot files are not included in the repository.

[Machine-readable source ledger and input-output contracts](../engine/ch11/fmc-databases-thrust-fuel-failures-2013-2023.rules.v1.json)
