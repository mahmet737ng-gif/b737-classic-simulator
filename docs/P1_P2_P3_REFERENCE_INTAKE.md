# P1 / P2 / P3 — photographed instrument rebuild intake

**Date:** 2026-10-22  
**Status:** REFERENCE INVENTORY IN PROGRESS — NOT IMPLEMENTED / NOT DEPLOYED  
**Published version:** unchanged. This work branch is separate from `main`.  
**Visual source policy:** only the physical aircraft panel portions of the user-provided screenshots are relevant. Ignore all application chrome and source-identifying UI; do not distribute screenshot binaries without permission.

## Three global geometry references
| Section | Role | screenshot on conversation attachment | Status |
|---|---|---|---|
| P1 | Captain main instrument panel | `IMG_0430.jpeg` | Received / initial geometry review |
| P2 | Center engine instrument panel | `IMG_0447.jpeg` | Received / initial geometry review |
| P3 | First-officer main instrument panel | `IMG_0461(1).jpeg` | Received / initial geometry review |

The pilot-side sections connect physically to the center engine panel. The overview images are geometry references; physical scale must be cross-checked before any final compositing.

## Detailed instrument references received
- **Flight and navigation:** EADI, EHSI, Mach/Airspeed Indicator, RMI/DME, altimeter, standby altimeter/airspeed, standby ADI, IVSI, clock.
- **Warnings / avionics:** PULL UP, BELOW G/S, WINDSHEAR, ALTITUDE ALERT, autopilot/autothrottle annunciators, GPWS.
- **Center / engine:** EIS primary and secondary, fuel quantity (analog and alternate digital variant), landing gear lever and annunciators, flap position, anti-skid/autobrake, yaw damper, hydraulic brake pressure.
- **Other controls:** nose-wheel steering, marker beacon lamps, panel/background brightness, AFDS flood, lamp test, flight-deck vents, speedbrake, STAB OUT OF TRIM, cabin altitude / takeoff configuration, maintenance annunciator.

**Important:** User indicated four upcoming additional glare shield / MCP views. They have **not yet been received** at this checkpoint. Do not invent their geometry.

## FCOM cross-reference plan
FCOM: Sepehran 737-300/400/500 combined volume, chapters:
- **1** Airplane General, Emergency Equipment, Doors, Windows — panel layout and flight deck lighting.
- **4** Automatic Flight — MCP, autopilot, autothrottle, flight director.
- **7** Engines, APU — EIS engine indications and logic.
- **8** Fire Protection — fire warning controls and warnings.
- **9** Flight Controls — yaw damper, flaps, speed brake.
- **10** Flight Instruments, Displays — airspeed, altimeter, IVSI, standby ADI, EADI.
- **11** Flight Management, Navigation — RMI/DME, EHSI navigation symbology.
- **12** Fuel — fuel quantity and pump indications.
- **13** Hydraulics — hydraulic pressure and quantity indications.
- **14** Landing Gear — landing gear handle, anti-skid, autobrake.
- **15** Warning Systems — Master Caution, GPWS and warning annunciators.

Each component must separately track: (a) screenshot geometry and exact visual style, (b) interactive motion/limits, (c) power & data dependencies, (d) FCOM chapter, section and page evidence, (e) tests, and (f) owner approval.

## Requested glare shield warning cluster
- Master Caution
- Fire Warning
- 6-section annunciator on each pilot side, including FLT CONT, IRS, FUEL, ELEC, APU, and OVERHEAT/DET as user specified; validate the *exact* installed configuration and exact legends before implementation.
- MCP / glare shield additional high-resolution references pending.

## Acceptance criteria (not yet satisfied)
- [x] Identify the three global panel overviews.
- [x] Establish initial component/reference list.
- [x] Identify related FCOM chapters (section/page-level audit remains).
- [ ] Crop each physical instrument reference without UI margins (preserve original full resolution).
- [ ] Identify exact physical locations and relative sizes on P1/P2/P3.
- [ ] Receive extra glare-shield and MCP reference images.
- [ ] Create independent high-detail textures/geometry for each instrument without scaling raster artwork beyond its meaningful resolution.
- [ ] Render animated needles, drums, screens, lights and physically moving control parts, with touch drag and detents.
- [ ] Connect independent components to shared, FCOM-traceable aircraft states and caution logic.
- [ ] Automate screenshot comparison, state-transition and mobile gesture tests.
- [ ] Owner review.
- [ ] Publish an **isolated test path**; do not overwrite approved live version before review.

**Safety:** simulator/training software only, not suitable for actual flight operations.
