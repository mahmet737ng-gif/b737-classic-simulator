# FCOM Chapter 11 — VNAV Speed Descent, Early Descent, Approach & Go-Around

**Project:** `B737-CLASSIC-CDU`. Source: Boeing 737 Classic Flight Crew Operations Manual `D6-27370-300/400/500-SHI`. User screenshots from PDF viewer pages **1527, 1528, 1529, 1531–1535**, corresponding to printed folios **11.31.38–40, 11.31.42–46**. *Page 1530 (likely printed folio 11.31.41) was not supplied and is NOT marked reviewed.* Printed folio 11.31.42 inferred from its neighbors. The 2020 and 2022 printed revision dates are retained individually.

## Screenshot-by-screenshot
| Viewer | Printed FCOM | Content | Rules |
|---|---|---|---:|
| 1527 | 11.31.38 | VNAV speed descent non-precision profile diagram | 6 |
| 1528 | 11.31.39 | Second VNAV speed descent profile, intermediate T/D | 5 |
| 1529 | 11.31.40 | Speed descent deceleration points figure | 4 |
| 1531 | 11.31.42 | Vertical Angle and Early Descent; printed folio inferred | 11 |
| 1532 | 11.31.43 | DES NOW or CAPTURE, path versus speed options | 7 |
| 1533 | 11.31.44 | CAPTURE detail and on approach phase conditions | 11 |
| 1534 | 11.31.45 | Approach vertical leg, G/S, RNP, missed approach and go-around | 14 |
| 1535 | 11.31.46 | Go-around transition, limits, origin, CRZ ALT | 11 |

## Speed Descent profile — viewer 1527–1529

The three figures illustrate **speed-reference control rather than guaranteed crossing-altitude guidance**. They contain T/D, nominal airfield speed restrictions, MNO, EPG, FAF, E/D, and the transition to a non-precision final and missed approach. A sample intermediate `T/D-7000` point and deceleration before waypoint restrictions are visible. These are figure annotations, not actual EP-FSI route coordinates or a certified executable vertical trajectory.

## Vertical Angle — viewer 1531

- A database vertical angle may be assigned to a waypoint, defining a VNAV path from the preceding waypoint. It can occur on selected STAR, approach transition and approach legs.
- The angle appears on `ACT RTE LEGS` near the affected waypoint speed/altitude.
- An ILS reference path of around **3°** is an example, not an imposed angle for every approach.
- The example's E/D point may be `RWXXX` or `MAXXX`, with threshold crossing height (typically around 50 ft relative to touchdown zone elevation) or a named fix altitude. These are path reference parameters; they do not authorize unrestricted descent.
- If an angle leg becomes active during VNAV PTH, the source describes following the angle rather than the idle path; in a documented option, an active angle leg during VNAV SPD causes automatic transition to VNAV PTH and removes the SPEED prompt.

## Early Descent / DES NOW / CAPTURE — viewer 1531–1533

- Early descent means VNAV descent before T/D.
- The manual presents `DES NOW` versus `CAPTURE` as alternative CDU prompts, plus MCP ALT INTV capability; **do not merge the prompts into one approved EP-FSI layout**.
- With a path planned, initial early descent is shown as approximately **1000 ft/min** toward capture of the idle descent path. Example modes: `FMC SPD` as A/T reference and `VNAV PTH` as pitch mode.
- With speed descent planned, early descent instead follows idle thrust without capturing the VNAV descent path. Example: `VNAV SPD` pitch and `IDLE` then `ARM` autothrottle reference.
- No real descent pitch/vertical-speed command is enabled by these drawings alone.

## Approach status and vertical path — viewer 1533–1534

- Documented entry criteria are **within 2 NM of the first selected approach waypoint** (including turns/arcs) **or within 2000 ft of airport field elevation**, whichever occurs first, in the covered software option.
- On approach, RNP alert limits are described as higher. This screenshot **does not include numerical limits**: do not invent them.
- If >200 ft below the commanded vertical path, zero vertical speed until path interception is described for the option.
- `TO/GA`, landing, route sequencing into missed approach or appropriate missed-approach DIRECT TO are described as leaving the approach logic.
- During speed intervention, flap setting and type of active leg may determine VNAV PTH vs SPD; an active geometric or vertical-angle leg may retain or activate PTH.
- A significant **cross-track > 2 × RNP** with a **vertical-angle leg active and LNAV not engaged** can cause VNAV disengagement. This is not a universal cross-track disengage rule.
- For ILS-based VNAV vertical-angle guidance the `GS-XXX` waypoint and armed glideslope affect VNAV engagement; deleting this fix changes the behavior as explicitly described.
- Non-runway waypoints may produce an MDA/calc missed-approach altitude path, sometimes geometrically below MDA; user-facing sim training must not imply permission to descend below published minima.

## Go-Around — viewer 1534–1535

The source describes transition to FMC go-around logic under a radio-altitude envelope below **2000 ft RA**. Triggers include TO/GA in descent, certain DIRECT TO changes into the missed approach, natural sequencing into the missed-approach first waypoint, and a climbing aircraft (>600 fpm) with relevant flap retraction.

Upon entering go-around logic: active descent becomes active climb, thrust reference switches to go-around thrust, altitude constraints below current altitude are replaced by predicted values, and the former destination becomes the new origin (so a later departure procedure can be selected).

Further conditions:
- LNAV may be eligible above **400 ft radio altitude**; VNAV should not be engaged until flaps have been retracted.
- When initiated by TO/GA or go-around thrust selection, new `CRZ ALT` is the maximum of highest missed-approach constraint, **airport elevation +1500 ft**, and MCP altitude.
- When initiated by DIRECT TO or natural waypoint sequencing, the relevant source formula omits MCP altitude from that maximum.
- The autopilot may level off at MCP altitude if it is the lowest relevant target; retain this as a mode/constraint check, not a universal command.

## Rules database and integration contract

69 independent source rules are cataloged with page provenance, triggering condition, effect, and option/effectivity tag. Key consumers are the FMS phase machine, CDU RTE LEGS and DES pages, route data, vertical path planner, MCP, A/T references and EHSI. The original Boeing screenshots/PDF and their protected contents are not replicated in the public repository.

**Status: SOURCE EXTRACTED / RUNTIME NOT IMPLEMENTED**. These rules are not a claim of a completed vertical guidance model; the EP-FSI variant and missing PDF page still require review. Approved CDU background, all control hitboxes, and BoeingCDU-Large/Small TTF font binaries are unchanged.

Machine-readable: [`vnav-speed-approach-goaround-2020.rules.v1.json`](../engine/ch11/vnav-speed-approach-goaround-2020.rules.v1.json).
