# Boeing 737 Classic - FCOM Chapter 4 Speed Limiting v1

Primary technical source: Sepehran B737-300/400/500 SHI FCOM D6-27370-300/400/500-SHI. Chapter 4.10.3-5 (IAS/MACH selector and MCP speed conditions), Chapter 4.20.31-35 (command limit, reversions). Chapter 10.40.6-8 supplies separate Speed Tape limits.

## Boundaries and observed data

- Maximum: lowest applicable VMO/MMO, extended gear placard, current flap placard. A valid upper limit requires VMO/MMO plus gear/flap configuration and the placard applicable to those states; otherwise UNKNOWN.
- Minimum: approximately 1.3 Vs for current flap, derived from qualified AOA/Stall Warning data. Not the minimum maneuver/yellow band or stick shaker limit.
- FCOM does not give a numeric speed offset for "slightly before" or "slightly below". The FCC must expressly report reaching that boundary; never manufacture a 2/3/5-kt trigger.
- MCP IAS above VMO or Mach above MMO is not selectable, unlike beyond gear/flap placards or below minimum; electronic selector rules already enforce 110..VMO and .60..MMO in the current approved trainer envelope.
- Normal selected speed may be limited; AFS controls the limit with engaged pitch or A/T speed mode, independently of the aircraft's stall warning and overspeed warning systems.

## Mandatory FCOM rules

- 4.20.33: Gear/flap/VMO placard limiting -> flashing overspeed MCP condition. If AT armed/available and AFDS engaged outside speed/CWS, AT changes to SPEED. If already speed-controlled, limit is maintained.
- 4.20.33: Only VMO/MMO with A/T speed and thrust levers at idle allows AFDS V/S -> LVL CHG. When A/T is unavailable there is no gear/flap reversion; for VMO/MMO the AFDS requests speed control, but Chapter 4 does not identify a specific MCP button for this fallback.
- 4.20.34: At/below minimum, V/S -> LVL CHG or VNAV PTH -> LVL CHG outside level segment/capture. Target minimum+5 kt. Selected >=minimum+15 kt re-enables normal selection; actual >=minimum+15 kt clears underspeed condition.
- 4.20.34: Not available in ALT HOLD, after glideslope capture, or VNAV PTH level segment. In LVL CHG climb, if minimum climb rate cannot be maintained without deceleration, autopilot disconnects and FD bars retract (FD switch not toggled).
- 4.20.35: Only V/S performance insufficiency, IAS MORE THAN 5 kt below selected and not increasing -> LVL CHG and flashing underspeed; symbol persists until different speed or pitch mode.
- 4.10.3: MCP speed-condition warning characters flash in the IAS/MACH window. Rendering layer does not change the exact photo/knob/inner window geometry.

## Integration architecture

- Pure decision engine: engine/afds/classic-speed-limit-ch4-v1.js. Input type FCC_SPEED_LIMIT; confirmed=true; source SIMULATED_FCC or INSTRUCTOR_SCENARIO. INSTRUCTOR_SCENARIO cannot actuate AFDS.
- Qualified unified event: b737:speed-limit-fcc, detail schema B737_CH4_FCC_SPEED_LIMIT_SAMPLE_V1, source SIMULATED_FCC, confirmed true, actualCasKt, minimumSpeedKt, vmoMmoCasKt, gearExtended, gearPlacardKt if extended, flapsPosition, flapPlacardKt if extended, and positive FCC evidence for nearHighLimit or nearMinimum when applicable.
- AFDS core is the mode authority. It only executes named FCOM changes from fully qualified FCC evidence; no automatic feature guesses real sensors/actuator performance. Result published by MCP AFDS bridge and displayed as flashing MCP speed condition.
- EADI Speed Tape gets applicable Chap 4 maximum and minimumAfdsKt while preserving independent Ch10 stall, maneuver, high-speed buffet and V-speed data.
- Real flight-model engine/FCC, aircraft-specific AFM placards, stall warning AoA, FMC speed source, Mach-to-CAS, thrust idle/climb capability are not supplied automatically by the basic cockpit training IAS slider. Those must be connected by validated source ports.
- No constant VMO/MMO, flap limit, gear limit, minimum speed, G margin, "slightly before" offset, or simulator acceleration is silently invented for normal Unified.
