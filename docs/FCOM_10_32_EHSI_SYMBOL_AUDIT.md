# B737 Classic EHSI — FCOM Chapter 10.32 Symbol Audit

**Source:** Owner-supplied `SEPEHRAN AIRLINES 737CL FCOM_241021_135227.pdf`, FCOM 10.32.1–10.32.39 (pages 1358–1396, appendix beyond). Revision dates vary from 2021 through 2022.

**Scope:** This is an item-by-item symbol inventory, not a claim that 92 aircraft systems currently produce verified live data. The simulator remains training-only.

**Palette:** white = present/scale; green = active/dynamic; magenta = command/fly-to; cyan = nonactive/background; amber = caution/flag; red = warning; black = off/blank.

**Simulator-specific exception:** Per owner instruction, both MCP CRS1/NAV1 and CRS2/NAV2 radio course lines are separately displayed in green dashed form on each EHSI when the related signal is valid. This is a user-specific overlay, not the FCOM selected-heading bug (magenta) or FCOM 10.32.10 course deviation glyph.

**Differences from earlier owner MOD request:** FCOM 10.32.17 prints modified route in white short dashes, whereas a prior training request used blue. The current FCOM-based renderer uses white.

**Status meanings:** `RULE/PAINT ADDED`: new source-gated logic or visual correction in this change; may need a linked producer. `EXISTING RENDERER`: relevant code exists, not necessarily full pixel/FCOM parity. `SOURCE / VISUAL QA PENDING`: reference recorded; need reliable data and/or glyph geometry before a production assertion.

**Audit count:** 92 symbols; 23 new/adjusted rules, 56 existing renderer hooks, 13 pending further wiring/visual QA.

| FCOM | Symbol | Color(s) | Applicable EHSI mode(s) | Location | Required condition | Current audit status |
|---|---|---|---|---|---|---|
| 10.32.2 | `trackOrientation` | green, white, green | MAP, CTR_MAP, FULL_NAV, EXP_NAV, PLAN | top-heading | valid-track | EXISTING RENDERER |
| 10.32.2 | `headingOrientation` | green, white, green | FULL_VOR_ILS, EXP_VOR_ILS | top-heading | valid-heading | EXISTING RENDERER |
| 10.32.2 | `selectedHeading` | magenta | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | compass-rose | mcp-heading-valid | EXISTING RENDERER |
| 10.32.3 | `trackLineScale` | white | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS | compass-axis | valid-ground-track | EXISTING RENDERER |
| 10.32.4 | `driftAnglePointer` | white | FULL_VOR_ILS | full-rose | valid-ground-track | EXISTING RENDERER |
| 10.32.4 | `magneticTrueReference` | green, white, amber | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | top-heading | valid-reference | EXISTING RENDERER |
| 10.32.4 | `expandedCompass` | white | MAP, EXP_NAV, EXP_VOR_ILS, PLAN | compass-rose | display-valid | EXISTING RENDERER |
| 10.32.5 | `ctrMapCompass` | white | CTR_MAP | compass-rose | display-valid | EXISTING RENDERER |
| 10.32.5 | `fullRose` | white | FULL_NAV, FULL_VOR_ILS | compass-rose | display-valid | EXISTING RENDERER |
| 10.32.6 | `currentHeadingPointer` | white | MAP, CTR_MAP, EXP_NAV, FULL_NAV, PLAN | compass-rose | heading-valid | EXISTING RENDERER |
| 10.32.6 | `activeWaypointBearingPointer` | magenta | EXP_NAV, FULL_NAV | compass-rose | fmc-active-fix-valid | SOURCE / VISUAL QA PENDING |
| 10.32.6 | `windDirectionSpeed` | white | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS | wind-block | wind-valid | RULE/PAINT ADDED |
| 10.32.7 | `navDataSource` | green | EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS | lower-nav-data | nav-source-valid | EXISTING RENDERER |
| 10.32.7 | `radioFrequency` | green | EXP_VOR_ILS, FULL_VOR_ILS | lower-nav-data | manual-frequency-valid | EXISTING RENDERER |
| 10.32.8 | `dmeDistance` | white | EXP_VOR_ILS, FULL_VOR_ILS | top-left | dme-valid | EXISTING RENDERER |
| 10.32.8 | `adfPointerHeadTail` | green | EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | compass-rose | adf-valid | RULE/PAINT ADDED |
| 10.32.9 | `lateralDeviation` | magenta, white | EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS | course-needle | cdi-valid | EXISTING RENDERER |
| 10.32.10 | `selectedCourseExpanded` | white, magenta | EXP_NAV, EXP_VOR_ILS | course-needle | selected-course-valid | EXISTING RENDERER |
| 10.32.10 | `selectedCourseFull` | white | FULL_NAV, FULL_VOR_ILS | full-rose | selected-course-valid | EXISTING RENDERER |
| 10.32.11 | `glideslopePointer` | magenta, white | EXP_VOR_ILS, FULL_VOR_ILS | right-glideslope | glideslope-valid | EXISTING RENDERER |
| 10.32.11 | `toFrom` | white | EXP_VOR_ILS, FULL_VOR_ILS | course-needle | vor-tofrom-valid | EXISTING RENDERER |
| 10.32.12 | `navaidDatabase` | cyan, green | MAP, CTR_MAP, PLAN | map-position | navaid-catalog-valid | RULE/PAINT ADDED |
| 10.32.12 | `manualVorCourseReciprocal` | green | MAP, CTR_MAP, PLAN | map-position | manually-tuned-vor-valid | SOURCE / VISUAL QA PENDING |
| 10.32.12 | `vorStationRadial` | green | MAP, CTR_MAP | map-bearing | vor-adf-on-and-vor-valid | EXISTING RENDERER |
| 10.32.13 | `adfStationBearing` | green | MAP, CTR_MAP | map-bearing | vor-adf-on-and-adf-valid | EXISTING RENDERER |
| 10.32.14 | `aircraftExpanded` | white | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS, PLAN | aircraft-anchor | display-valid | EXISTING RENDERER |
| 10.32.14 | `aircraftFull` | white | FULL_NAV, FULL_VOR_ILS | aircraft-center | display-valid | EXISTING RENDERER |
| 10.32.15 | `positionTrend` | white | MAP, CTR_MAP | flight-path | groundspeed-bank-valid | EXISTING RENDERER |
| 10.32.15 | `activeWaypointIdent` | magenta | FULL_NAV, EXP_NAV | lower-nav-data | fmc-active-fix-valid | EXISTING RENDERER |
| 10.32.15 | `activeWaypointDistance` | white | MAP, CTR_MAP, FULL_NAV, EXP_NAV, PLAN | top-left | fmc-active-fix-valid | EXISTING RENDERER |
| 10.32.15 | `activeWaypointEta` | white | MAP, CTR_MAP, FULL_NAV, EXP_NAV, PLAN | top-right | fmc-eta-valid | EXISTING RENDERER |
| 10.32.16 | `courseChangeAlert` | amber | FULL_NAV, EXP_NAV | message | fmc-course-change-within-10s | RULE/PAINT ADDED |
| 10.32.16 | `standardWaypoint` | magenta, white | MAP, CTR_MAP, PLAN | map-position | route-waypoint-valid | EXISTING RENDERER |
| 10.32.16 | `conditionalWaypoint` | magenta, white | MAP, CTR_MAP, PLAN | map-position | conditional-waypoint-valid | SOURCE / VISUAL QA PENDING |
| 10.32.16 | `offRouteWaypoint` | cyan | MAP, CTR_MAP, PLAN | map-position | wpt-on-and-range-le-40 | EXISTING RENDERER |
| 10.32.17 | `activeRoute` | magenta | MAP, CTR_MAP, PLAN | map-route | active-route-valid | EXISTING RENDERER |
| 10.32.17 | `modifiedRoute` | white | MAP, CTR_MAP, PLAN | map-route | modified-route-valid | EXISTING RENDERER |
| 10.32.17 | `inactiveRoute` | cyan | MAP, CTR_MAP, PLAN | map-route | inactive-route-valid | EXISTING RENDERER |
| 10.32.17 | `offsetRoute` | magenta | MAP, CTR_MAP, PLAN | map-route | fmc-offset-route-valid | EXISTING RENDERER |
| 10.32.17 | `routeData` | magenta, white | MAP, CTR_MAP, PLAN | near-waypoint | rte-data-on-and-route-valid | RULE/PAINT ADDED |
| 10.32.18 | `holdingPattern` | magenta, white, cyan | MAP, CTR_MAP, PLAN | map-route | fmc-hold-valid | SOURCE / VISUAL QA PENDING |
| 10.32.18 | `procedureTurn` | magenta, white, cyan | MAP, CTR_MAP, PLAN | map-route | fmc-procedure-turn-valid | SOURCE / VISUAL QA PENDING |
| 10.32.19 | `altitudeRangeArc` | green | MAP, CTR_MAP | map-distance | altitude-target-and-vs-valid | EXISTING RENDERER |
| 10.32.19 | `altitudeProfilePoint` | green | MAP, CTR_MAP, PLAN | map-distance | fmc-profile-valid | SOURCE / VISUAL QA PENDING |
| 10.32.20 | `vnavDeviation` | magenta, white | MAP, CTR_MAP, FULL_NAV, EXP_NAV | right-vertical-track | vnav-descent-valid | RULE/PAINT ADDED |
| 10.32.20 | `originDestinationAirport` | white | MAP, CTR_MAP, PLAN | map-position | fmc-origin-destination-valid | SOURCE / VISUAL QA PENDING |
| 10.32.20 | `airportDatabase` | cyan | MAP, CTR_MAP, PLAN | map-position | arpt-on-and-airport-valid | EXISTING RENDERER |
| 10.32.20 | `runwayCenterlines` | white | MAP, CTR_MAP, PLAN | map-position | fmc-runway-valid | SOURCE / VISUAL QA PENDING |
| 10.32.20 | `fixReference` | green | MAP, CTR_MAP, PLAN | map-position | cdu-fix-valid | SOURCE / VISUAL QA PENDING |
| 10.32.21 | `wxRadarReturns` | green, amber, red, magenta | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS | map-overlay | wxr-valid-and-on | EXISTING RENDERER |
| 10.32.22 | `irsPositionDifference` | white | MAP, CTR_MAP, FULL_NAV, EXP_NAV | lower-left | irs-difference-exceeds-limits | SOURCE / VISUAL QA PENDING |
| 10.32.22 | `northUpArrow` | green | PLAN | true-north | plan-valid | EXISTING RENDERER |
| 10.32.23 | `rangeArcs` | white | MAP, EXP_NAV, EXP_VOR_ILS | compass-range | map-always-or-wxr-tfc-on | RULE/PAINT ADDED |
| 10.32.24 | `terrainDisplay` | green, amber, red, magenta | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS | map-overlay | terrain-data-valid-and-enabled | SOURCE / VISUAL QA PENDING |
| 10.32.25 | `terrainMode` | cyan | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS | terrain-status | terrain-enabled | SOURCE / VISUAL QA PENDING |
| 10.32.25 | `terrainTest` | cyan | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | terrain-status | terrain-test | RULE/PAINT ADDED |
| 10.32.25 | `terrainAlert` | amber, red | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | terrain-warning | terrain-alert | RULE/PAINT ADDED |
| 10.32.26 | `terrainFailure` | amber | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | left-status | terrain-failed | RULE/PAINT ADDED |
| 10.32.26 | `terrainPosition` | amber | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | left-status | terrain-position-uncertain | RULE/PAINT ADDED |
| 10.32.26 | `terrainInhibit` | amber | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | left-status | terrain-inhibited | RULE/PAINT ADDED |
| 10.32.26 | `terrainRangeDisagree` | amber | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS | range-message | terrain-range-mismatch | RULE/PAINT ADDED |
| 10.32.26 | `mapTerrainRangeDisagree` | amber | MAP, CTR_MAP | range-message | map-terrain-range-mismatch | RULE/PAINT ADDED |
| 10.32.27 | `wxrModeAndTilt` | green | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS | wxr-status | wxr-on-and-valid | RULE/PAINT ADDED |
| 10.32.28 | `wxrRangeDisagree` | amber | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS | range-message | wxr-range-mismatch | RULE/PAINT ADDED |
| 10.32.28 | `wxrMapRangeDisagree` | amber | MAP, CTR_MAP | range-message | wxr-map-range-mismatch | RULE/PAINT ADDED |
| 10.32.29 | `tcasRA` | red | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS | traffic-symbol | tfc-on-and-ra-valid | EXISTING RENDERER |
| 10.32.29 | `tcasTA` | amber | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS | traffic-symbol | tfc-on-and-ta-valid | EXISTING RENDERER |
| 10.32.29 | `tcasProx` | white | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS | traffic-symbol | tfc-on-and-prox-valid | EXISTING RENDERER |
| 10.32.29 | `tcasOther` | white | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS | traffic-symbol | tfc-on-and-other-valid | EXISTING RENDERER |
| 10.32.29 | `tcasClimbDescendArrow` | red, amber, white | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS | near-traffic | traffic-rate-ge-500fpm | EXISTING RENDERER |
| 10.32.30 | `tcasNoBearing` | red, amber | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS | right-traffic-data | tfc-on-no-bearing-ra-ta | EXISTING RENDERER |
| 10.32.30 | `tcasTrafficMessage` | red, amber | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | right-alert | ra-or-ta-valid | EXISTING RENDERER |
| 10.32.30 | `tcasOffscale` | red, amber | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS | right-alert | tfc-on-and-ta-ra-offscale | EXISTING RENDERER |
| 10.32.31 | `tcasTfc` | green | MAP, CTR_MAP, EXP_NAV, EXP_VOR_ILS | left-tcas | tfc-on | EXISTING RENDERER |
| 10.32.31 | `tcasTaOnly` | green | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | left-tcas | tcas-ta-only | EXISTING RENDERER |
| 10.32.31 | `tcasTest` | white | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | left-tcas | tcas-test | EXISTING RENDERER |
| 10.32.31 | `tcasOff` | amber, white | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | left-tcas | tcas-off-and-not-failed | EXISTING RENDERER |
| 10.32.32 | `tcasFail` | amber | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | left-tcas | tcas-failed-not-suppressed | EXISTING RENDERER |
| 10.32.35 | `headingTrackFlag` | amber | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | top-heading | heading-or-track-failed | EXISTING RENDERER |
| 10.32.35 | `vorPointerFlag` | amber | MAP, CTR_MAP | map-warning | vor-signal-failed-and-vor-adf-on | SOURCE / VISUAL QA PENDING |
| 10.32.35 | `excessData` | amber | MAP, CTR_MAP, EXP_NAV, PLAN | left-warning | map-refresh-slow | RULE/PAINT ADDED |
| 10.32.36 | `wxrFailStatus` | amber | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | left-wxr | wxr-failed | EXISTING RENDERER |
| 10.32.36 | `wxrWeakStatus` | amber | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | left-wxr | wxr-calibration-fault | RULE/PAINT ADDED |
| 10.32.36 | `wxrAttStatus` | amber | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | left-wxr | wxr-attitude-fault | RULE/PAINT ADDED |
| 10.32.36 | `wxrStabStatus` | amber | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | left-wxr | wxr-stabilization-off | RULE/PAINT ADDED |
| 10.32.36 | `wxrDspyStatus` | amber | MAP, CTR_MAP, EXP_NAV, FULL_NAV, EXP_VOR_ILS, FULL_VOR_ILS, PLAN | left-wxr | wxr-display-overheat | EXISTING RENDERER |
| 10.32.36 | `xtkFlag` | amber | FULL_NAV, EXP_NAV | course-deviation | fmc-xtk-invalid | EXISTING RENDERER |
| 10.32.36 | `vorLocFlag` | amber | FULL_VOR_ILS, EXP_VOR_ILS | course-deviation | nav-vor-loc-invalid | EXISTING RENDERER |
| 10.32.36 | `mapFlag` | amber | MAP, CTR_MAP | map-center | fmc-map-invalid | EXISTING RENDERER |
| 10.32.36 | `vtkFlag` | amber | MAP, CTR_MAP, EXP_NAV, FULL_NAV | right-vnav | fmc-vertical-track-invalid | EXISTING RENDERER |
| 10.32.36 | `rnpAdvisory` | amber | MAP, CTR_MAP | center-warning | fmc-anp-greater-than-rnp | RULE/PAINT ADDED |
| 10.32.39 | `mapRangeDisagree` | amber | MAP, CTR_MAP | range-message | fmc-range-mismatch | RULE/PAINT ADDED |

## Explicit no-signal policy

Neither normal EHSI glass nor the CDU shall fabricate WXR returns, terrain elevation, IRS divergence, TCAS contacts, ADF reception, holding-pattern geometry, RNP alerts, or reference nav-aid coordinates. A valid source or explicitly labeled instructor fixture is required.

## Required release checks

1. `node --test tests/fcom-10-32-symbology-v1.test.cjs`
2. `node --test panel-mosaic-lab/cockpit/mcp-efis-link-v1.test.cjs`
3. Owner asset and guarded switch frozen hash checks from AGENTS.md.
4. Manual comparison on both glass positions for MAP, CTR MAP, FULL/EXP NAV, FULL/EXP VOR/ILS, PLAN.
5. For each item marked source/visual pending: verify source validity, geometry, color, mode, warning priority and absence with unavailable data before marking complete.
