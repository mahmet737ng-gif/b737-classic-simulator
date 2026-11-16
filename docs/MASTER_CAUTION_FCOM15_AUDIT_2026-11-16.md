# B737 Classic — MASTER CAUTION / Twelve-System Annunciator Audit
**Revision:** MASTER-CAUTION-FCOM15-0001 · 2026-11-16  
**Aircraft:** B737-300 / -400 / -500, Sepehran Classic references.  
**Primary source:** `SEPEHRAN AIRLINES 737CL FCOM_241021_135227.pdf` (2022/2023 print), Chapter **15 Warning Systems**, sections **15.10.1–2** and **15.20.1–4**, plus Chapter **2 Air Systems**, section **2.20.2**. `FlySepehran B737 FCOM300-400-500Print.pdf` independently corroborates these indications. Use the exact operating manual for the aircraft configuration in real flight; this is a simulator implementation report.

## Caution activation, acknowledgment and recall

- Both MASTER CAUTION lamps illuminate for a new unacknowledged amber system caution, not merely for a raw electrical failure or any energized lamp.
- Pushing either MASTER CAUTION acknowledges the condition and extinguishes both master lamps and the system locator. The underlying source/physical caution stays active; another new cause retriggers both.
- Holding a system annunciator panel tests its twelve lamps. Releasing it recalls current annunciations. Certain **simple/redundant single-channel faults are recall-only**, and must not raise initial MASTER CAUTION.
- FIRE WARN is separate and may not be synthesized from an amber OVERHEAT indication; it requires the actual fire-warning output. Power and circuit breakers remain owned by the real Electrical V7/CB model.

## Source-verified annunciator matrix

| Panel | Category | FCOM 15.20 related amber indications | Current simulated source |
|---|---|---|---|
| Captain | FLT CONT | LOW QUANTITY/PRESSURE, STBY RUD ON, FEEL DIFF PRESS, SPEED TRIM FAIL, MACH TRIM FAIL, AUTO SLAT FAIL, YAW DAMPER | Existing overhead amber-lamp state |
| Captain | ELEC | LOW OIL PRESSURE, HIGH OIL TEMP, STANDBY PWR OFF, TRANSFER BUS OFF, BUS OFF | Drive/IDG oil lamps and verified electrical overhead lamps only |
| Captain | IRS | FAULT, ON DC, DC FAIL, GPS | IRS FAULT from live source, qualified sustained ON DC / DC FAIL (only when actual indications exist), GPS-specific failure logic **not yet simulated** |
| Captain | APU | LOW OIL PRESSURE, HIGH OIL TEMP, FAULT, OVERSPEED | Existing ECU/overhead lamp evidence. APU FAULT specific source **not established** |
| Captain | FUEL | LOW PRESSURE, FILTER BYPASS | Physical pump lamps and qualified recall logic |
| Captain | OVHT/DET | ENG 1 / ENG 2 OVERHEAT, APU DET INOP | Fire-protection indications, independent of red FIRE WARN |
| FO | ANTI-ICE | WINDOW OVERHEAT, PITOT HEAT, COWL ANTI-ICE | Existing separate overheats, probe/anti-ice outputs |
| FO | ENG | REVERSER, PMC INOP, LOW IDLE | Amber reverser, PMC-INOP and low-idle lamps; **not** electrical oil lights |
| FO | HYD | OVERHEAT, LOW PRESSURE | Hydraulic indications |
| FO | OVERHEAD | PASS OXY ON, FLIGHT RECORDER OFF, LAVATORY SMOKE, EQUIP COOLING OFF, EMER EXIT LIGHTS NOT ARMED | Existing pass oxygen, flight recorder, equipment cooling and emergency-exit lenses. LAVATORY SMOKE source **not present** |
| FO | DOORS | ENTRY, EQUIP, FWD/AFT CARGO, FWD/AFT SERVICE | Existing verified door amber lamps |
| FO | AIR COND | DUCT OVERHEAT, **DUAL BLEED**, PACK TRIP OFF, WING-BODY OVERHEAT, BLEED TRIP OFF, AUTO FAIL, OFF SCHED DESCENT | Overhead pneumatic and pressurization outputs |

These source chapter references identify **category memberships**, not exact wiring, event inhibition, source CB assignment or differences in every fleet modification. Unsupported source signals must remain absent rather than invented.

## Critical rectifications

### 1. GEN OFF BUS must not illuminate ELEC

FCOM 15.20.1 defines blue lights as status/information. The 737 Classic GEN OFF BUS and APU GEN OFF BUS are blue status lenses; an illuminated blue lens by itself is not evidence of an amber system caution. The old SixPack bridge incorrectly mapped `gen-off-bus-1`, `gen-off-bus-2` and `apu-gen-off-bus` into ELEC. It also mapped generic electrical ECU faults directly to MASTER CAUTION without corresponding amber lamp confirmation. Both paths are removed. Real amber STANDBY POWER OFF / TRANSFER BUS OFF / BUS OFF and IDG/drive oil indications retain ELEC activation.

### 2. DUAL BLEED must illuminate AIR COND

FCOM 15.20.4 lists DUAL BLEED under AIR COND. FCOM 2.20.2 explains that the DUAL BLEED lens illuminates with possible APU bleed back-pressure in specified bleed/isolation configurations. Its **existing amber illuminated physical output** now produces `OH:dual-bleed` in FO.AIR COND. This causes both master caution lamps to illuminate until acknowledged. It is a caution based on a real lamp condition; no synthetic failure is injected, and the pneumatic ECU remains the authoritative owner of that lamp.

### 3. Additional classification corrections

The FCOM locates electric-drive LOW OIL PRESSURE / HIGH OIL TEMP under ELEC, while ENG contains REVERSER / PMC INOP / LOW IDLE. Existing `drive-*-drive-pressure` and `drive-*-drive-temperature` were moved ENG → ELEC. Existing PMC INOP left and right lamps were added to ENG. PASS OXY ON was added to OVERHEAD. Do not apply unverified inhibit rules for takeoff/landing without variant-specific source evidence.

## Verified implementation contracts

The main annunciator already has per-cause acknowledgment, recall-only reasons, dual master lamps, pressed-to-test, and CB/power gating. No change to the underlying annunciator artwork or protected panels is needed. The source adapter now feeds actual validated overhead lamp states via `sixpack-live-integration-v1.js`; reasons are deduplicated across Electrical V7 and Overhead. Structural and end-to-end automated regression exercises blue advisory exclusion, DUAL BLEED→AIR COND→both MASTER CAUTION, acknowledge/new event/recall, and inventory of all 12 categories.

### 4. IRS false-caution correction — FCOM 11.10.18–20

The IRS `ALIGN` lamp is **white**; its flashing alignment/position error is not itself listed under the amber IRS annunciator triggers in FCOM 15.20.3. A short `ON DC` illumination is expressly normal during IRS alignment self-test (FCOM 11.10.19). The live adapter now suppresses these two normal/white cases. It accepts actual powered `FAULT`, sustained non-SELFTEST `ON DC`, and `DC FAIL` signals when present. The current IRS trainer produces ON DC only in SELFTEST, and does not yet supply a separately verified sustained backup-DC caution telemetry channel; these caution modes are therefore contingent on future authoritative inputs.

**Remaining source-backed work:** Full per-modification caution inhibit schedules, GPS-only recall specifics, missing APU FAULT and LAV SMOKE physical indicators, direct IDG lamp differentiation for each aircraft, and complete CB wiring require additional confirmed FCOM/WDM/fleet data. Do not treat the present matrix as fully certified wiring.
