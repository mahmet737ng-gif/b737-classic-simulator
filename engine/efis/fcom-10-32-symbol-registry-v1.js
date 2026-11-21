/* FlySepehran 737-300/400/500 FCOM Vol 2, 10.32.1–10.32.39.
 * Extracted from the owner-provided Sep 2021 / May 2022 / Dec 2022 edition.
 * This is a declarative rule inventory, not fabricated aircraft-state data.
 * Test/simulator sources must supply real or explicitly injected evidence.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737FCOM1032SymbolRegistryV1=api;
})(globalThis,function(){
 'use strict';
 const specs=Object.freeze([
 {
  "id": "trackOrientation",
  "page": "10.32.2",
  "modes": [
   "MAP",
   "CTR_MAP",
   "FULL_NAV",
   "EXP_NAV",
   "PLAN"
  ],
  "colors": [
   "green",
   "white",
   "green"
  ],
  "placement": "top-heading",
  "condition": "valid-track",
  "remarks": "TRK, current track and magnetic/true reference"
 },
 {
  "id": "headingOrientation",
  "page": "10.32.2",
  "modes": [
   "FULL_VOR_ILS",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "green",
   "white",
   "green"
  ],
  "placement": "top-heading",
  "condition": "valid-heading",
  "remarks": "HDG, current heading and reference"
 },
 {
  "id": "selectedHeading",
  "page": "10.32.2",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "magenta"
  ],
  "placement": "compass-rose",
  "condition": "mcp-heading-valid",
  "remarks": "Selected HDG bug and dashed line; no dashed reference line in PLAN"
 },
 {
  "id": "trackLineScale",
  "page": "10.32.3",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "compass-axis",
  "condition": "valid-ground-track",
  "remarks": "Track line and selected-range fractions"
 },
 {
  "id": "driftAnglePointer",
  "page": "10.32.4",
  "modes": [
   "FULL_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "full-rose",
  "condition": "valid-ground-track",
  "remarks": "Ground-track indicator replaces track line"
 },
 {
  "id": "magneticTrueReference",
  "page": "10.32.4",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "green",
   "white",
   "amber"
  ],
  "placement": "top-heading",
  "condition": "valid-reference",
  "remarks": "True north boxed white, M transition highlighted ten seconds"
 },
 {
  "id": "expandedCompass",
  "page": "10.32.4",
  "modes": [
   "MAP",
   "EXP_NAV",
   "EXP_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "compass-rose",
  "condition": "display-valid",
  "remarks": "Expanded 70-degree compass"
 },
 {
  "id": "ctrMapCompass",
  "page": "10.32.5",
  "modes": [
   "CTR_MAP"
  ],
  "colors": [
   "white"
  ],
  "placement": "compass-rose",
  "condition": "display-valid",
  "remarks": "Centered 360-degree compass"
 },
 {
  "id": "fullRose",
  "page": "10.32.5",
  "modes": [
   "FULL_NAV",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "compass-rose",
  "condition": "display-valid",
  "remarks": "Full compass rose and 45-degree fixed reference ticks"
 },
 {
  "id": "currentHeadingPointer",
  "page": "10.32.6",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "compass-rose",
  "condition": "heading-valid",
  "remarks": "White actual heading pointer"
 },
 {
  "id": "activeWaypointBearingPointer",
  "page": "10.32.6",
  "modes": [
   "EXP_NAV",
   "FULL_NAV"
  ],
  "colors": [
   "magenta"
  ],
  "placement": "compass-rose",
  "condition": "fmc-active-fix-valid",
  "remarks": "Bearing toward active FMC waypoint"
 },
 {
  "id": "windDirectionSpeed",
  "page": "10.32.6",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "wind-block",
  "condition": "wind-valid",
  "remarks": "Display after >6kt; blank under 4kt hysteresis"
 },
 {
  "id": "navDataSource",
  "page": "10.32.7",
  "modes": [
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "green"
  ],
  "placement": "lower-nav-data",
  "condition": "nav-source-valid",
  "remarks": "VOR1/2, ILS1/2 or FMC NAV"
 },
 {
  "id": "radioFrequency",
  "page": "10.32.7",
  "modes": [
   "EXP_VOR_ILS",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "green"
  ],
  "placement": "lower-nav-data",
  "condition": "manual-frequency-valid",
  "remarks": "AUTO text when the receiver is in autotune"
 },
 {
  "id": "dmeDistance",
  "page": "10.32.8",
  "modes": [
   "EXP_VOR_ILS",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "top-left",
  "condition": "dme-valid",
  "remarks": "Slant DME to reference station"
 },
 {
  "id": "adfPointerHeadTail",
  "page": "10.32.8",
  "modes": [
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "green"
  ],
  "placement": "compass-rose",
  "condition": "adf-valid",
  "remarks": "ADF 1 and 2 head and tail symbol"
 },
 {
  "id": "lateralDeviation",
  "page": "10.32.9",
  "modes": [
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "magenta",
   "white"
  ],
  "placement": "course-needle",
  "condition": "cdi-valid",
  "remarks": "ILS normal 1°/dot, expanded 0.5°/dot, VOR 5°/dot, FMC NAV 2NM/dot"
 },
 {
  "id": "selectedCourseExpanded",
  "page": "10.32.10",
  "modes": [
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "white",
   "magenta"
  ],
  "placement": "course-needle",
  "condition": "selected-course-valid",
  "remarks": "Course pointer white and course line magenta"
 },
 {
  "id": "selectedCourseFull",
  "page": "10.32.10",
  "modes": [
   "FULL_NAV",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "full-rose",
  "condition": "selected-course-valid",
  "remarks": "White course pointer; TO/FROM for VOR"
 },
 {
  "id": "glideslopePointer",
  "page": "10.32.11",
  "modes": [
   "EXP_VOR_ILS",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "magenta",
   "white"
  ],
  "placement": "right-glideslope",
  "condition": "glideslope-valid",
  "remarks": "Pointer and deviation scale"
 },
 {
  "id": "toFrom",
  "page": "10.32.11",
  "modes": [
   "EXP_VOR_ILS",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "course-needle",
  "condition": "vor-tofrom-valid",
  "remarks": "VOR TO/FROM indicator"
 },
 {
  "id": "navaidDatabase",
  "page": "10.32.12",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "cyan",
   "green"
  ],
  "placement": "map-position",
  "condition": "navaid-catalog-valid",
  "remarks": "All within 10/20/40; high-altitude only at 80/160/320, tuned VHF green"
 },
 {
  "id": "manualVorCourseReciprocal",
  "page": "10.32.12",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "green"
  ],
  "placement": "map-position",
  "condition": "manually-tuned-vor-valid",
  "remarks": "Selected course and reciprocal printed by tuned VOR"
 },
 {
  "id": "vorStationRadial",
  "page": "10.32.12",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "green"
  ],
  "placement": "map-bearing",
  "condition": "vor-adf-on-and-vor-valid",
  "remarks": "V1 or V2 radial"
 },
 {
  "id": "adfStationBearing",
  "page": "10.32.13",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "green"
  ],
  "placement": "map-bearing",
  "condition": "vor-adf-on-and-adf-valid",
  "remarks": "A1/A2 bearing direction"
 },
 {
  "id": "aircraftExpanded",
  "page": "10.32.14",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "aircraft-anchor",
  "condition": "display-valid",
  "remarks": "Apex of white triangle marks present position"
 },
 {
  "id": "aircraftFull",
  "page": "10.32.14",
  "modes": [
   "FULL_NAV",
   "FULL_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "aircraft-center",
  "condition": "display-valid",
  "remarks": "Centered airplane symbol"
 },
 {
  "id": "positionTrend",
  "page": "10.32.15",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "white"
  ],
  "placement": "flight-path",
  "condition": "groundspeed-bank-valid",
  "remarks": "Dashes predict 30/60/90 seconds; 10/20/>20NM limits 1/2/3"
 },
 {
  "id": "activeWaypointIdent",
  "page": "10.32.15",
  "modes": [
   "FULL_NAV",
   "EXP_NAV"
  ],
  "colors": [
   "magenta"
  ],
  "placement": "lower-nav-data",
  "condition": "fmc-active-fix-valid",
  "remarks": "Name of next active FMC fix"
 },
 {
  "id": "activeWaypointDistance",
  "page": "10.32.15",
  "modes": [
   "MAP",
   "CTR_MAP",
   "FULL_NAV",
   "EXP_NAV",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "top-left",
  "condition": "fmc-active-fix-valid",
  "remarks": "NM to active waypoint"
 },
 {
  "id": "activeWaypointEta",
  "page": "10.32.15",
  "modes": [
   "MAP",
   "CTR_MAP",
   "FULL_NAV",
   "EXP_NAV",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "top-right",
  "condition": "fmc-eta-valid",
  "remarks": "FMC arrival UTC time"
 },
 {
  "id": "courseChangeAlert",
  "page": "10.32.16",
  "modes": [
   "FULL_NAV",
   "EXP_NAV"
  ],
  "colors": [
   "amber"
  ],
  "placement": "message",
  "condition": "fmc-course-change-within-10s",
  "remarks": "ALERT during ten seconds before waypoint change, clear at turn/sequence"
 },
 {
  "id": "standardWaypoint",
  "page": "10.32.16",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "magenta",
   "white"
  ],
  "placement": "map-position",
  "condition": "route-waypoint-valid",
  "remarks": "Active magenta, other active-route white"
 },
 {
  "id": "conditionalWaypoint",
  "page": "10.32.16",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "magenta",
   "white"
  ],
  "placement": "map-position",
  "condition": "conditional-waypoint-valid",
  "remarks": "Parenthesized conditional leg description"
 },
 {
  "id": "offRouteWaypoint",
  "page": "10.32.16",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "cyan"
  ],
  "placement": "map-position",
  "condition": "wpt-on-and-range-le-40",
  "remarks": "Unselected waypoint"
 },
 {
  "id": "activeRoute",
  "page": "10.32.17",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "magenta"
  ],
  "placement": "map-route",
  "condition": "active-route-valid",
  "remarks": "Solid active leg"
 },
 {
  "id": "modifiedRoute",
  "page": "10.32.17",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "map-route",
  "condition": "modified-route-valid",
  "remarks": "Short white dashes"
 },
 {
  "id": "inactiveRoute",
  "page": "10.32.17",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "cyan"
  ],
  "placement": "map-route",
  "condition": "inactive-route-valid",
  "remarks": "Long cyan dashes"
 },
 {
  "id": "offsetRoute",
  "page": "10.32.17",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "magenta"
  ],
  "placement": "map-route",
  "condition": "fmc-offset-route-valid",
  "remarks": "Magenta dot-dash parallel to active route"
 },
 {
  "id": "routeData",
  "page": "10.32.17",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "magenta",
   "white"
  ],
  "placement": "near-waypoint",
  "condition": "rte-data-on-and-route-valid",
  "remarks": "Altitude constraint and waypoint ETA"
 },
 {
  "id": "holdingPattern",
  "page": "10.32.18",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "magenta",
   "white",
   "cyan"
  ],
  "placement": "map-route",
  "condition": "fmc-hold-valid",
  "remarks": "Fixed icon above 80NM, scaled when <=80NM and within 3min of fix"
 },
 {
  "id": "procedureTurn",
  "page": "10.32.18",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "magenta",
   "white",
   "cyan"
  ],
  "placement": "map-route",
  "condition": "fmc-procedure-turn-valid",
  "remarks": "Supported only with procedure-turn data and compatible FMC"
 },
 {
  "id": "altitudeRangeArc",
  "page": "10.32.19",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "green"
  ],
  "placement": "map-distance",
  "condition": "altitude-target-and-vs-valid",
  "remarks": "Prediction of MCP altitude interception"
 },
 {
  "id": "altitudeProfilePoint",
  "page": "10.32.19",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "green"
  ],
  "placement": "map-distance",
  "condition": "fmc-profile-valid",
  "remarks": "T/C T/D S/C E/D, intermediate T/D and DECEL"
 },
 {
  "id": "vnavDeviation",
  "page": "10.32.20",
  "modes": [
   "MAP",
   "CTR_MAP",
   "FULL_NAV",
   "EXP_NAV"
  ],
  "colors": [
   "magenta",
   "white"
  ],
  "placement": "right-vertical-track",
  "condition": "vnav-descent-valid",
  "remarks": "±400ft scale; extra numeric outside limits"
 },
 {
  "id": "originDestinationAirport",
  "page": "10.32.20",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "map-position",
  "condition": "fmc-origin-destination-valid",
  "remarks": "Airport/runway at ranges 80/160/320"
 },
 {
  "id": "airportDatabase",
  "page": "10.32.20",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "cyan"
  ],
  "placement": "map-position",
  "condition": "arpt-on-and-airport-valid",
  "remarks": "Other airports; FMC origin/destination always visible"
 },
 {
  "id": "runwayCenterlines",
  "page": "10.32.20",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "map-position",
  "condition": "fmc-runway-valid",
  "remarks": "At 10/20/40 NM; dashed runway centerlines 14.2NM"
 },
 {
  "id": "fixReference",
  "page": "10.32.20",
  "modes": [
   "MAP",
   "CTR_MAP",
   "PLAN"
  ],
  "colors": [
   "green"
  ],
  "placement": "map-position",
  "condition": "cdu-fix-valid",
  "remarks": "Reference fix and optional dashed bearings/distance rings"
 },
 {
  "id": "wxRadarReturns",
  "page": "10.32.21",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "green",
   "amber",
   "red",
   "magenta"
  ],
  "placement": "map-overlay",
  "condition": "wxr-valid-and-on",
  "remarks": "Returns green low, amber medium, red intense, turbulence magenta"
 },
 {
  "id": "irsPositionDifference",
  "page": "10.32.22",
  "modes": [
   "MAP",
   "CTR_MAP",
   "FULL_NAV",
   "EXP_NAV"
  ],
  "colors": [
   "white"
  ],
  "placement": "lower-left",
  "condition": "irs-difference-exceeds-limits",
  "remarks": "L/R NM and arrow to displaced IRS positions"
 },
 {
  "id": "northUpArrow",
  "page": "10.32.22",
  "modes": [
   "PLAN"
  ],
  "colors": [
   "green"
  ],
  "placement": "true-north",
  "condition": "plan-valid",
  "remarks": "True north pointer"
 },
 {
  "id": "rangeArcs",
  "page": "10.32.23",
  "modes": [
   "MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "compass-range",
  "condition": "map-always-or-wxr-tfc-on",
  "remarks": "Always in MAP; EXP if WXR/TFC selected"
 },
 {
  "id": "terrainDisplay",
  "page": "10.32.24",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "green",
   "amber",
   "red",
   "magenta"
  ],
  "placement": "map-overlay",
  "condition": "terrain-data-valid-and-enabled",
  "remarks": "Elevation vs aircraft 2000 / 500ft or 250ft gear-down threshold"
 },
 {
  "id": "terrainMode",
  "page": "10.32.25",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "cyan"
  ],
  "placement": "terrain-status",
  "condition": "terrain-enabled",
  "remarks": "TERR and highest/lowest displayed terrain"
 },
 {
  "id": "terrainTest",
  "page": "10.32.25",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "cyan"
  ],
  "placement": "terrain-status",
  "condition": "terrain-test",
  "remarks": "TERR TEST"
 },
 {
  "id": "terrainAlert",
  "page": "10.32.25",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber",
   "red"
  ],
  "placement": "terrain-warning",
  "condition": "terrain-alert",
  "remarks": "TERRAIN caution amber / warning red"
 },
 {
  "id": "terrainFailure",
  "page": "10.32.26",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-status",
  "condition": "terrain-failed",
  "remarks": "TERR FAIL"
 },
 {
  "id": "terrainPosition",
  "page": "10.32.26",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-status",
  "condition": "terrain-position-uncertain",
  "remarks": "TERR POS"
 },
 {
  "id": "terrainInhibit",
  "page": "10.32.26",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-status",
  "condition": "terrain-inhibited",
  "remarks": "TERR INHIBIT"
 },
 {
  "id": "terrainRangeDisagree",
  "page": "10.32.26",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "amber"
  ],
  "placement": "range-message",
  "condition": "terrain-range-mismatch",
  "remarks": "TERR RANGE DISAGREE"
 },
 {
  "id": "mapTerrainRangeDisagree",
  "page": "10.32.26",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "amber"
  ],
  "placement": "range-message",
  "condition": "map-terrain-range-mismatch",
  "remarks": "MAP/TERR RANGE DISAGREE"
 },
 {
  "id": "wxrModeAndTilt",
  "page": "10.32.27",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "green"
  ],
  "placement": "wxr-status",
  "condition": "wxr-on-and-valid",
  "remarks": "VAR gain, MAP/WX/WX+T/TEST mode, antenna tilt"
 },
 {
  "id": "wxrRangeDisagree",
  "page": "10.32.28",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "amber"
  ],
  "placement": "range-message",
  "condition": "wxr-range-mismatch",
  "remarks": "WXR RANGE DISAGREE; suppress on transceiver failure"
 },
 {
  "id": "wxrMapRangeDisagree",
  "page": "10.32.28",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "amber"
  ],
  "placement": "range-message",
  "condition": "wxr-map-range-mismatch",
  "remarks": "WXR/MAP RANGE DISAGREE; suppress on either failure"
 },
 {
  "id": "tcasRA",
  "page": "10.32.29",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "red"
  ],
  "placement": "traffic-symbol",
  "condition": "tfc-on-and-ra-valid",
  "remarks": "Filled square, relative altitude"
 },
 {
  "id": "tcasTA",
  "page": "10.32.29",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "amber"
  ],
  "placement": "traffic-symbol",
  "condition": "tfc-on-and-ta-valid",
  "remarks": "Filled circle, relative altitude"
 },
 {
  "id": "tcasProx",
  "page": "10.32.29",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "traffic-symbol",
  "condition": "tfc-on-and-prox-valid",
  "remarks": "White filled diamond"
 },
 {
  "id": "tcasOther",
  "page": "10.32.29",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "white"
  ],
  "placement": "traffic-symbol",
  "condition": "tfc-on-and-other-valid",
  "remarks": "White hollow diamond"
 },
 {
  "id": "tcasClimbDescendArrow",
  "page": "10.32.29",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "red",
   "amber",
   "white"
  ],
  "placement": "near-traffic",
  "condition": "traffic-rate-ge-500fpm",
  "remarks": "Arrow only >=500 fpm, upper/lower altitude text relative to target"
 },
 {
  "id": "tcasNoBearing",
  "page": "10.32.30",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "red",
   "amber"
  ],
  "placement": "right-traffic-data",
  "condition": "tfc-on-no-bearing-ra-ta",
  "remarks": "RA/TA, range, relative altitude and arrow"
 },
 {
  "id": "tcasTrafficMessage",
  "page": "10.32.30",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "red",
   "amber"
  ],
  "placement": "right-alert",
  "condition": "ra-or-ta-valid",
  "remarks": "TRAFFIC even if TFC not selected"
 },
 {
  "id": "tcasOffscale",
  "page": "10.32.30",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "red",
   "amber"
  ],
  "placement": "right-alert",
  "condition": "tfc-on-and-ta-ra-offscale",
  "remarks": "OFFSCALE"
 },
 {
  "id": "tcasTfc",
  "page": "10.32.31",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "green"
  ],
  "placement": "left-tcas",
  "condition": "tfc-on",
  "remarks": "TFC selected"
 },
 {
  "id": "tcasTaOnly",
  "page": "10.32.31",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "green"
  ],
  "placement": "left-tcas",
  "condition": "tcas-ta-only",
  "remarks": "RA not computed"
 },
 {
  "id": "tcasTest",
  "page": "10.32.31",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "white"
  ],
  "placement": "left-tcas",
  "condition": "tcas-test",
  "remarks": "TCAS TEST"
 },
 {
  "id": "tcasOff",
  "page": "10.32.31",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber",
   "white"
  ],
  "placement": "left-tcas",
  "condition": "tcas-off-and-not-failed",
  "remarks": "TCAS OFF; text chart and 10.32.33 vary by presentation"
 },
 {
  "id": "tcasFail",
  "page": "10.32.32",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-tcas",
  "condition": "tcas-failed-not-suppressed",
  "remarks": "TCAS FAIL; TFC may cycle annunciation"
 },
 {
  "id": "headingTrackFlag",
  "page": "10.32.35",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "top-heading",
  "condition": "heading-or-track-failed",
  "remarks": "TRK / HDG flag"
 },
 {
  "id": "vorPointerFlag",
  "page": "10.32.35",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "amber"
  ],
  "placement": "map-warning",
  "condition": "vor-signal-failed-and-vor-adf-on",
  "remarks": "VOR pointer failure flag"
 },
 {
  "id": "excessData",
  "page": "10.32.35",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-warning",
  "condition": "map-refresh-slow",
  "remarks": "EXCESS DATA map performance alert"
 },
 {
  "id": "wxrFailStatus",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-wxr",
  "condition": "wxr-failed",
  "remarks": "WXR FAIL"
 },
 {
  "id": "wxrWeakStatus",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-wxr",
  "condition": "wxr-calibration-fault",
  "remarks": "WXR WEAK"
 },
 {
  "id": "wxrAttStatus",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-wxr",
  "condition": "wxr-attitude-fault",
  "remarks": "WXR ATT"
 },
 {
  "id": "wxrStabStatus",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-wxr",
  "condition": "wxr-stabilization-off",
  "remarks": "WXR STAB"
 },
 {
  "id": "wxrDspyStatus",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV",
   "EXP_VOR_ILS",
   "FULL_VOR_ILS",
   "PLAN"
  ],
  "colors": [
   "amber"
  ],
  "placement": "left-wxr",
  "condition": "wxr-display-overheat",
  "remarks": "WXR DSPY"
 },
 {
  "id": "xtkFlag",
  "page": "10.32.36",
  "modes": [
   "FULL_NAV",
   "EXP_NAV"
  ],
  "colors": [
   "amber"
  ],
  "placement": "course-deviation",
  "condition": "fmc-xtk-invalid",
  "remarks": "XTK flag"
 },
 {
  "id": "vorLocFlag",
  "page": "10.32.36",
  "modes": [
   "FULL_VOR_ILS",
   "EXP_VOR_ILS"
  ],
  "colors": [
   "amber"
  ],
  "placement": "course-deviation",
  "condition": "nav-vor-loc-invalid",
  "remarks": "VOR / LOC flag"
 },
 {
  "id": "mapFlag",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "amber"
  ],
  "placement": "map-center",
  "condition": "fmc-map-invalid",
  "remarks": "MAP flag"
 },
 {
  "id": "vtkFlag",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP",
   "EXP_NAV",
   "FULL_NAV"
  ],
  "colors": [
   "amber"
  ],
  "placement": "right-vnav",
  "condition": "fmc-vertical-track-invalid",
  "remarks": "VTK flag"
 },
 {
  "id": "rnpAdvisory",
  "page": "10.32.36",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "amber"
  ],
  "placement": "center-warning",
  "condition": "fmc-anp-greater-than-rnp",
  "remarks": "UNABLE REQD NAV PERF-RNP"
 },
 {
  "id": "mapRangeDisagree",
  "page": "10.32.39",
  "modes": [
   "MAP",
   "CTR_MAP"
  ],
  "colors": [
   "amber"
  ],
  "placement": "range-message",
  "condition": "fmc-range-mismatch",
  "remarks": "MAP RANGE DISAGREE; hide FMC data, suppress on MAP failure"
 }
].map(item=>Object.freeze({...item,
  modes:Object.freeze(item.modes),colors:Object.freeze(item.colors)})));
 const byId=Object.freeze(Object.fromEntries(specs.map(item=>[item.id,item])));
 const modes=Object.freeze(['MAP','CTR_MAP','EXP_NAV','FULL_NAV','EXP_VOR_ILS','FULL_VOR_ILS','PLAN']);
 function eligible(id,mode,evidence={}){
  const s=byId[id];
  if(!s)return {eligible:false,reason:'UNKNOWN_SYMBOL'};
  if(!s.modes.includes(mode))return {eligible:false,reason:'INAPPLICABLE_MODE'};
  // Strict default OFF: no RNP alert, radar, terrain, TCAS or signal
  // is asserted just because a mode is selected.
  const sample=evidence[id];
  if(sample?.valid!==true)return {eligible:false,reason:'NO_VALID_EVIDENCE'};
  return {eligible:true,reason:'EVIDENCE_VALID',colors:s.colors,
   placement:s.placement,page:s.page};
 }
 function audit(evidence={},mode='MAP'){
  if(!modes.includes(mode))throw Error('INVALID_EHSI_MODE');
  return specs.map(s=>({...s,...eligible(s.id,mode,evidence)}));
 }
 return Object.freeze({version:'FCOM-10.32-SYMBOL-REGISTRY-0001',
  specs,byId,modes,eligible,audit});
});
