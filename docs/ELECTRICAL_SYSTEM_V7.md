# B737 Classic Electrical — Independent system network V7

**Status: working educational discrete engine; airframe-specific distribution/wiring QA pending.** No part of this feature modifies the main photographed cockpit UI, existing system labs, or postponed LAN classroom. Use for non-operational trainer activities only.

## Files

- `engine/systems/electrical-v7.js` — deterministic AC source selector, generator/transfer/main buses, TR1/2/3, DC, battery and standby conditions.
- `engine/systems/electrical-consumers-v7.js` — refuses to connect downstream loads to buses without reviewed EP-FSI-specific source metadata. Default status `UNKNOWN`.
- `electrical-lab/` — browser training rig for source selections, BUS TRANS/standby selector, faults and bus annunciators.
- `tests/electrical-v7.test.cjs` — 47 Node tests covering 1/2-source selection, no AC paralleling, transfer, battery/standby, faults, unknowns, source conflict and consumer binding.
- **Private:** `/Technical Database/Subsystems/ELECTRICAL-V7/ELECTRICAL_NETWORK_V7.sqlite` — component/source graph, source folios, 14 open gap records and validation; the master 8-source/5,067-page Technical Database stays private and unchanged.

## Source provenance (existing Technical Database; no PDFs re-read)

| FCOM printed folio | Indexed page | Coverage |
|---|---:|---|
| 6.10.7 | 1146 | STANDBY POWER control and lamp; conflicting ground AUTO interpretation |
| 6.10.9 | 1148 | BUS OFF, TRANSFER BUS OFF and GEN OFF BUS source-linked indicators |
| 6.20.1 | 1150 | AC source architecture, generator and APU output, no paralleling |
| 6.20.2 | 1151 | External AC, battery switch prerequisite, ground service switch |
| 6.20.4 | 1153 | Generator bus selection, alternate transfer feed, galley load shedding |
| 6.20.9 | 1158 | TR1/2/3 distribution, TR3 disconnect relay, battery DC buses |
| 6.20.11 | 1160 | Inflight AUTO standby battery transfer, **ground AUTO inhibit** |
| 6.20.12 | 1161 | Static inverter and standby source configurations |

The two indexed sections 6.10.7 and 6.20.11 **disagree** on ground AUTO operation after loss of all AC power. This V7 implementation defaults to `UNKNOWN`, not one arbitrary rule. The separate lab can select either document interpretation for comparison, with a labeled source-conflict warning. It does **not** silently claim which applies to EP-FSI.

## Verified functional flows (not physical wire routing)

`GEN1/GEN2/APU/EXT -> generator bus 1/2 -> main and transfer -> TR1/TR2/TR3 -> DC1/DC2, battery bus`; `transfer1/DC1 -> standby AUTO`; `battery -> static inverter -> AC standby` for appropriate selector/flight modes. Source selection is exclusive per generator bus; static inverter is not a primary AC generator.

**Source-confirmed**: automatic opposite generator bus feed to an inactive transfer bus with BUS TRANS AUTO; generator bus itself remains inactive; TR1/2 from transfer 1/2; TR3 from main 2; DC cross-tie relay opens at glide slope capture or with BUS TRANS OFF; normal AC/DC standby sources; BAT standby selector bypasses normal battery switch position; source selection and generator bus OFF indications. **Educational modeling policies**: APU single-side selection priority in flight, failure injection effects, simplified source quality, no contactor/relay physical timing. Unknown when only TR3 remains and direct DC1/DC2 backup path needs wiring proof.

## Downstream systems — important safety and correctness boundary

No bus feed is asserted for: Stall Warning test/individual computers, DCPCS controllers, CPCS modes, fuel pumps, hydraulic electric pumps and pneumatics pack electronics. Consumer adapter blocks assumed routing: user/reference data must establish a component, its actual EP-FSI bus, document page and review before activation. This allows `powerLost -> consumer disabled` to be reliably wired later, **without** propagating false bus outages now.

## Incomplete

- Complete generator contactor/BPCU and relay sequencing, exact protection and latching
- Battery voltage/current/timed endurance and real electrical load flow
- Full TR3 backfeed switching and component-to-bus load schedule
- EP-FSI effectivity inspection for system configuration and ground standby discrepancy
- Installed cockpit hotspots and live shared input dispatch
- Complete master caution / QRH branch modeling, independent iPad visual QA

The `AUTO` ground conflict and other uncertain edges are recorded as distinct unresolved QA gates. **Do not use for flight.**