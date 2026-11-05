# B737 Classic ATA36 — Isolation valve and engine-start air routing (Unified V1)

Date: 2026-11-05. Ground training only. Aircraft S/N 29340 wiring and starter performance remain non-certified/unverified.

## Primary technical references

- Sepehran 737CL FCOM, Air Systems **2.20.2**, PDF p.1001: the isolation valve isolates two duct halves; it is AC powered. AUTO closes with BOTH engine BLEED ON and BOTH PACK AUTO/HIGH; AUTO opens when **any** of those four switches is OFF. APU BLEED does **not** affect the AUTO valve command.
- Lufthansa LAN 737-300/400/500 ATA36-10 **pp.24,26,28,29**: the pneumatic ground service connector is in the **right pack bay**. The isolation valve lies **to the right of the APU duct junction** (therefore APU feeds the left duct). The motor circuit is **115V AC Transfer Bus 1**. OPEN/CLOSE override AUTO selection logic, if motor power and valve mechanism are functional.
- B737 MRG IV.7 **Engines/APU p.229**: when engine No. 2 does not start, suspect a closed isolation valve; with Classic bus 1 unavailable, starting No. 1 to power Transfer Bus 1 can permit valve operation. This does not establish an unconditional isolation OPEN cockpit requirement.
- FCOM non-AFM limitations (PDF p. 3508 in extracted text): pneumatic pressure before starter engagement minimum 30 psig at sea level, minus 0.5 psig per 1000 ft. This is a reference requirement, not a fabricated instrument sensor.

## Operationalized functional model

| Source, valve and power | Left duct / ENG1 starter | Right duct / ENG2 starter |
| --- | --- | --- |
| APU BLEED available; isolation CLOSED, no other source | Supplied | Not supplied |
| APU BLEED available; AUTO physically OPEN (PACK OFF + AC TFR1) | Supplied | Supplied |
| APU BLEED available; switch OPEN, actuator powered/unfailed | Supplied | Supplied |
| APU BLEED available; AUTO demanded OPEN but actuator AC unavailable | Supplied | **Unknown** crossover position (fail-closed for starting) |
| Right-side ground cart source; isolation CLOSED | Not supplied | Supplied |
| Right-side ground cart source; isolation OPEN | Supplied | Supplied |
| Left engine bleed available; isolation OPEN | Supplied | Supplied to the right |
| Right engine bleed available; isolation OPEN | Supplied to the left | Supplied |

These functional results are a **supply-route predicate**, not measured PSI. Bleed-trip, isolation jams, local bleed availability and POWER UNKNOWN are kept in Pneumatics V6. Do not assert adequate compressor-start pressure based only on presence of a source.

## Code ownership and display

1. `engine/systems/pneumatics-v6.js` continues to own the existing FCOM/LAN 3-position valve logic **unchanged**, but resolves APU-left and ground-right topology in `duct.L/R.anySupply`.
2. `engine/integration/isn-apu-start-chain-v1.js` injects actual Electrical V7 Transfer Bus 1 supply into the existing `isolationAcPower` sensor and consumes the existing V6 duct topology. It **does not** require switch OPEN to issue GRD.
3. `engine/systems/duct-pressure-live-v1.js` already uses APU local to L, ground cart local to R and actual isolation valve feedback; its TRAINING_ESTIMATE pressure remains separate from an observed pressure gauge.
4. The physical OH switch, protected hardware assets, PACK/DUAL BLEED annunciations, EIS/Conventional graphics and the single existing ECU are **not replaced**.

## Expected training tests

- Two PACKs OFF + isolation AUTO + APU BLEED + AC Transfer 1 available: automatic OPEN and both engine start-air paths available.
- Isolation CLOSE, APU only: ENG1 can motor; ENG2 blocked specifically for no right starter duct air.
- Restore AUTO with adequate actuator power: ENG2 can motor from the SAME APU source.
- Lose AC Transfer 1: selected AUTO does not prove a moved valve; local left APU feed remains valid, right crossover is UNKNOWN until valve position is established.
- APU BLEED ON alone with both engine BLEED switches ON and both packs AUTO never triggers AUTO opening.
- Right-side external cart supply with isolation CLOSE serves right, not left.

Regression: `node tests/pneumatics-v6.test.cjs`; `node tests/isn-isolation-start-routing-v1.test.cjs`; plus Unified ECU test cohort. These are educational regression tests and do not establish serial-specific WDM compliance.
