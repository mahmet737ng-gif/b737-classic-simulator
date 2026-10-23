# B737-CLASSIC-CDU — Engine Out Cruise, Drift Down, RTA & Data Entry Rules

**FCOM reference:** Boeing 737 Classic, Chapter 11 / Flight Management System Operation, `D6-27370-300/400/500-SHI`, printed pages **11.31.47–11.31.51**, dated **15 October 2020** (five user screenshots, PDF viewer pages 1536–1540). The original Boeing images and text have not been published in this repository; original screenshot SHA-256 values reside in the source contract.

## 1. Engine Out Cruise — 11.31.47–11.31.48

The figures depict an engine failure while FMC is in VNAV cruise above the computed maximum single-engine sustainable altitude.

- The crew selects `ENG OUT` from `CRZ` and views `ENG OUT CRZ` with advisory drift-down and maximum-altitude data.
- One illustration describes proceeding to engine-out cruise after evaluating the drift-down; another explicitly says select **LRC** speed to begin engine-out cruise. These branches are preserved independently until installed software/effectivity is known.
- Sample `FL187`, `234 KT`, or `97.9%` figures are illustrative, **not aircraft-specific fixed constants** for the EP-FSI or its CFM56-3B-1 20K configuration.
- Calculated `MAX ALT` can change with gross weight. No authoritative table on these screenshots establishes a particular value or performance equation.

## 2. Engine Out Modification / Drift Down — 11.31.49

Selection of an engine-out option leads to single-engine advisory data. The procedure text then describes **crew actions**: disconnect A/T, use maximum continuous thrust (CON) on the operating engine, select the engine-out speed, set MCP altitude at the maximum engine-out altitude or a lower cleared altitude, and select LVL CHG.

The screenshot contains two alternative prompts for the selected speed: `ENG OUT SPD` and `TGT SPD`. Do not combine them, or treat a CDU page selection as if it automatically moved MCP knobs or disconnected A/T.

The drift-down description includes weight-dependent `MAX ALT` changes as fuel is burned. Following the drift-down, engine-out cruise retains a CON thrust reference, using an appropriate engine-out cruise speed. When range matters, the source refers to **engine-inoperative LRC** from the QRH; the QRH speed table itself is **not provided here**.

## 3. RTA — 11.31.49

An `RTA` consists of a designated waypoint and crew-selected required arrival time. The FMC seeks a cruise-speed plan meeting that requirement and updates the associated route/progress predictions. If the required time cannot be achieved, the displayed scratchpad message is `RTA UNACHIEVABLE`.

The screenshot does not supply the numerical optimization model, aircraft limitations, speed envelopes, or comprehensive RTA data-entry page layout.

## 4. Altitude Entry — 11.31.50

Inputs may be **three-digit hundred-feet entries**, explicit `FLxxx`, **four-digit feet**, or **five-digit feet**. Three-digit entries require leading zeros; four/five-digit feet values are rounded to **10 ft** as documented; display formatting as `FLxxx` or feet depends on the specified **transition altitude**. Some CDU fields have additional validation restrictions and are not globally interchangeable.

Example vectors from this source (for unit tests, not aircraft limits):

| Transition altitude | CDU typed | Display |
| --- | --- | --- |
| 10000 ft | `008` | `800` |
| 10000 ft | `015` | `1500` |
| 10000 ft | `115` | `FL115` |
| 10000 ft | `250` | `FL250` |
| 18000 ft | `0835` | `840` |
| 18000 ft | `9994` | `9990` |
| 4000 ft | `08500` | `FL085` |
| 4000 ft | `09995` | `FL100` |

Five-digit values above the four-digit range and explicit leading-zero forms are shown. The source indicates acceptance of negative altitude values as low as **−1000 ft**, subject to individual field restrictions.

### Airspeed entry

At the end of 11.31.50, CAS is described with **three digits** in knots; Mach uses **one to three digits after a decimal point**. This is the provided scope; do not invent missing detailed examples from the next page.

## 5. Data Pairs, Bearing, Signs — 11.31.51

- A paired item may represent wind direction/speed or waypoint airspeed/altitude separated by **`/`**.
- When both values are typed, the separator is required. For certain single-value entries it may be omitted. The source distinguishes an outboard value (optional leading/trailing slash) from an inboard value (slash required); when required syntax is omitted, CDU produces **`INVALID ENTRY`**.
- A bearing entry requires **three digits**. Type `090`, not `90`; an entered bearing `360` displays as `000`.
- For **temperatures** and **along-track displacement**, a missing sign means positive; negative input requires an explicit minus.

**Parser policy:** Reuse one common syntax engine for every CDU page, then apply page/field-specific exceptions from Chapter 11. No change to the physical CDU artwork, frozen 70 hitboxes or the locked `BoeingCDU-Large.ttf` and `BoeingCDU-Small.ttf` files.

## Implementation boundary

These five screenshots establish source rules and examples but not an operational drift-down solver. **This change does not wire flight guidance or execute flight-control/MCP instructions.** It only registers 56 source-anchored contracts and QA checks. The installed EP-FSI software variant remains unresolved.

[Source and data vectors JSON](../engine/ch11/engineout-rta-dataentry-2020.rules.v1.json).
