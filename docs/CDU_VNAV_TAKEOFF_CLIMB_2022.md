# B737 Classic CDU — Takeoff and Climb, VNAV SPD/PTH (Chapter 11)

**Source:** user-shared FCOM illustration in PDF viewer page **1513/1937** and transcribed 737 Flight Crew Operations Manual explanatory text, printed folio **11.31.25**, dated **15 December 2022**. The screenshot's precise printed folio is not visible. Its SHA-256 is in the machine-readable contract. This document paraphrases the supplied source; no copyrighted page or screenshot is copied to the public repository.

**Scope:** `B737-CLASSIC-CDU` standalone simulator, EP-FSI; effectivity gates remain unverified.

## Five documented profile events

| Event | Consequence in design | Evidence |
| --- | --- | --- |
| 1. Thrust Reduction | Select climb thrust via N1 switch; an alternative equipment configuration can change thrust at configured thrust-reduction altitude | Number 1 and accompanying text |
| 2. VNAV Engagement | Advance toward the planned climb-speed schedule, subject to aircraft configuration | Number 2 |
| 3. VNAV Climb | Normal climb can run **VNAV SPD** at default or crew-entered climb speed, respecting SID altitude/airspeed restrictions; autothrottle references climb thrust limit | Number 3 |
| 4. Climb Restrictions | **VNAV PTH** may be used to meet departure/waypoint constraints; speed may come from procedure, waypoint, default or crew selection | Number 4 |
| 5. Top of Climb | The vertical path reaches programmed cruise altitude and the FMS transitions toward cruise; recompute a T/C for step climbs as necessary | Number 5 |

The last source paragraph describes a **green open-circle map marker** labeled `T/C`; do not change the locked EHSI rendering unless the installed display variant is verified.

## Illustration data (example only)

- Departure speed annotation: `V2+15`; later `250 KTS`; the diagram also marks `10,000 ft`, `ECON CLB SPD` and `ECON CRZ SPD`.
- `ABC` crossing altitude: **at or above 4,000 ft**.
- `BCD` crossing altitude: **at 6,000 ft**.
- `CDE` crossing altitude: **at or above 18,000 ft**.

**Do not** infer actual aircraft coordinates, a real SID or universal 250-knot speed rules from this conceptual profile.

## Exceptions and FMC/CDU interactions

- If the computed climb speed/path cannot meet the next altitude restriction, the described scratchpad advisory is `UNABLE NEXT ALTITUDE`.
- The `CLB → ENG OUT` page displays advisory engine-out performance in one text variation.
- Another variation states that selecting ENG OUT blanks later performance predictions and makes VNAV unavailable until a different climb page is selected.
- The duplicate thrust-reduction and ENG OUT paragraphs are **equipment/software options**, not simultaneously universal functions. The pasted source omits the variant markers required to select the installed EP-FSI behavior.

## Model integration (requirements, not runtime implementation)

Inputs: flight phase, selected N1/climb thrust, altitude and thrust-reduction altitude, optional automatic-mode configuration, VNAV selection, route SID/waypoint constraints, climb-speed target, prediction at crossing, cruise altitude, and ENG OUT CLB page mode.

Outputs to implement and validate later: VNAV SPD/PTH and speed target, climb thrust selection, constraint feasibility result and CDU message, optional ENG OUT prediction blanking, new T/C calculation and EHSI symbol.

The five blue callouts are **vertical-profile event markers**; they are *not* five CDU pages.

**Current implementation status:** source requirements recorded, source image reviewed and QA metadata guarded. No CDU font, physical image, button box, aircraft system control, VNAV flight-control command, or live EHSI code is changed in this source-import commit.

Data contract: [`vnav-takeoff-climb-2022.rules.v1.json`](../engine/ch11/vnav-takeoff-climb-2022.rules.v1.json).
