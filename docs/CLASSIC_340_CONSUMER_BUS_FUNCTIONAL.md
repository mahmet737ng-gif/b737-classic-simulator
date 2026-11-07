# Unified B737 Classic — functional electrical bus/consumer model

**Revision:** ATA24-CONSUMER-0003 · 7 November 2026  
**Aircraft:** 737-300/400/500 training model (not flight use or EP-FSI-specific certification)  
**Sources:** MRG IV.6 printed pp. 182–188 (340 rows); FCOM chapter 6.20; Lufthansa technical training ATA24. Engine indication exceptions also follow FCOM chapter 7 and LAN ATA31/77.

## Single source of electrical truth

Electrical V7 owns engine/APU/EXT AC source selection, generators, bus transfer, TR1/2/3, battery, inverter and standby logic. The **consumer engine never changes those states**. It takes one evaluated V7 snapshot and maps the MRG consumer reference to an electrical-capability state.

The functional model distinguishes **source output from generator-bus contactor**, **115VAC from 28VAC from 28VDC**, and **normal vs backed-up vs absent buses**. Thus, a generator may produce 115 V / 400 Hz at operating engine speed without being ON BUS, and another generator may feed Transfer Bus 1 even when the normal Generator Bus 1 is dead.

## 24 logical bus × voltage-class nodes

- Main AC: Generator Bus 1/2, Main 1/2, Transfer 1/2, Ground Service, External 115 VAC (8).
- DC: DC1/2, Battery, Hot Battery, Switched Hot Battery (5).
- Standby: exactly **AC STBY BUS** (115 VAC) and **DC STBY BUS** (28 VDC), both connected to the MRG standby consumers (2).
- Electronics Bus 1/2 115VAC and 28VDC (4).
- 28VAC functional conversion proxies from Transfer 1/2, Main 1/2 and Ground Service (5).
- The two formerly duplicated internal V7 acStandby/dcStandby keys are no longer exposed as redundant physical nodes: **24 distinct bus-class nodes total**. Derived electronic bus and 28VAC converter outputs remain training functional estimates; no individual transformer failure has been added.

Every one of the 340 MRG source rows has a specific ATA/system family, with no OTHER catch-all. OFF rows remain red but are not struck through for legibility. The 340 source entries are individually indexed by their MRG row ID, with printed page, source bus and voltage, applicability, electrical status, CB status (when mapped), power-loss effect and system family. They additionally combine into 322 named logical devices. For a two-voltage controller (e.g. Autothrottle, DME2, Window Heat Controller), BOTH required AC and DC feeds must be energized; an alternate feed or surviving independent channel may instead lead to DEGRADED. The selected 737-300 / -400 / -500 profile filters variant-specific rows. Optional equipment marked "As installed" remains UNKNOWN until confirmed. A consumer can be `NORMAL`, `OFF`, `DEGRADED`, `UNKNOWN` or `NOT_INSTALLED`. Those states describe **electric availability**, not observed equipment running. Physical switch commands, temperatures, hydraulic pressure, fuel flow, sensed faults and actuator motion remain independently owned.

### Real source-to-system integrations active

- **8 boost/electric pumps** now read MRG functional feeder availability through the same ISN Pack, with CB/failure/overheat/command gating: fuel left forward = Main 1; left aft = Transfer 1; right forward = Main 2; right aft = Transfer 2; center left = Main 2; center right = Main 1; electric hydraulic A = Generator Bus 2; electric hydraulic B = Generator Bus 1.
- **16 engine indication channels** continue using their source-indexed technical backend and direct Electrical V7 and CB gate, independently of the 340-row audit. Both EIS and Conventional have different N2 and FF supplies. Do not short-circuit the instrument backend with raw ECU updates.
- **Autobrake control** now uses the actual DC Bus 2 power availability plus the already-installed antiskid/CB/sensor conditions; an open DC Bus 2 disables electrical autobrake operation without turning off unrelated brakes.
- **Window heat, IRS, other existing systems** retain their established V7/CB power models; the new audit projects their reference rows and broadcasts system-level states without replacing their working physical logic.

### Failure and operating semantics

| Scenario | Demonstrated effect |
|---|---|
| Both AC sources absent, BAT ON | Battery consumers available; Main, Transfer and Generator AC consumers off; cold/ground AUTO standby off |
| GEN1 disconnected, GEN2 on and BUS TRANSFER AUTO | Generator Bus 1 + Main 1 dead; Transfer 1 backed up; left forward pump off but left aft pump still electrically available |
| Above with BUS TRANSFER OFF | Transfer 1 also dead; left aft pump loses electric supply |
| Engine-driven electrical hydraulic pump source gone | Electric pump stops; independent mechanically driven hydraulic pump state is **not** automatically zeroed |
| One of two channels fails | System/group marked DEGRADED while another independent channel remains functional |
| CB open for an instrument or pump | Protected consumer loses that input. CB action does not turn off the supplying main bus |
| Indication bus dead but engine remains running | Instrument loses valid supply; engine physics and fuel-source logic remain separate |
| Unverified MRG OCR/photo mapping or unmapped CB | UNKNOWN evidence where necessary; never fabricated values |

### Still not claimed

The 340-row table **is not equivalent to 340 live actuator backends**. Each row's electric-capability state is active and searchable in Unified under **ATA24 BUS → CONSUMERS**, but many subsystems have not yet registered their physical command/status handoff. This is intentional: automatically blanking or disabling hundreds of unrelated switches merely because their electrical *reference* row changed would introduce incorrect behavior. Expansion should register validated commands, alternate power, channel redundancy and failure transition semantics subsystem by subsystem.

The EP-FSI-specific WDM, physical conversion transformers, current draw, automatic load shedding and some dual/alternate feeds remain unverified. For EIS, the primary/secondary LRU 28VDC feed from P6-2 is distinct from each sensor's power functional mapping. Generic reference entries do not prove installed LRU connector pins.

## Automated QA

```bash
node tests/classic-bus-consumer-functional-v1.test.cjs
node tests/engine-indication-tech-db-v1.test.cjs
node tests/engine-indication-source-power-ata77-v2.test.cjs
node tests/isn-electrical-pack-v1.test.cjs
```

Includes 340-row source integrity, 322 logical devices, 737-300/400 equipment applicability, 24 bus-class nodes, cold/dark and battery-only conditions, ground/air standby selector, one-generator alternate transfer, BUS TRANSFER OFF, EIS versus Conventional effectivity, partial circuit-breaker isolation, autobrake DC2 control, actual ISN Pack operating states and unaffected independent source ownership.
