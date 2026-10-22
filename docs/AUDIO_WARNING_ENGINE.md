# B737 Classic — Audio Warning Engine (prototype v0.1)

**Status:** separate review branch, not merged, not deployed to the main cockpit.
**Scope:** sound palette, rule evaluation, cutout behavior, and an isolated browser listening lab.

## Source of truth / known validated facts

Owner-provided *SEPEHRAN AIRLINES 737CL FCOM*, Chapter 15 (Warning Systems), especially:
- 15.20.1: categories of audible indications (clacker, warning tone, intermittent horn, steady horn, fire bell, voice).
- 15.10.1 and 15.20.2: Fire Warning and push-to-reset/bell cutout.
- 15.20.4–5: Cabin Altitude >10,000 feet; same intermittent horn as Takeoff Config; independent warning lights.
- 15.20.4: Takeoff Config on ground with takeoff thrust and unsafe LE, TE flap, speed brake, parking brake or stab trim.
- 15.20.5–6: Landing gear horn activation and restricted HORN CUTOUT cases.
- 15.20.6–7: Overspeed clacker; stall stick shaker only active in flight.
- 15.20.8: Altitude alert at 900/300 ft and G/S/Flap 25 inhibit.
- 15.20.11–15: EGPWS alert phrases (installed options vary).
- 15.20.26–28: Bank angle 35/40/45 with 30 reset; selected radio altitude callouts; minimums +80 ft.
- Autopilot/Autothrottle/TCAS alert logic requires detailed validation in respective sections.

This implementation **does not redistribute the proprietary manual or authentic sound samples**.

## Files

- audio/warning-engine.js: pure JavaScript event evaluator, no audio or DOM requirements.
- audio-lab/index.html: interactive manual sound audition and scenario inputs.
- audio-lab/lab.js: Web Audio approximate synthesized tones and browser TTS placeholders.
- tests/audio-warning-engine.test.cjs: deterministic Node assertions for core thresholds/cutouts.

## Message flow

Cockpit controls / independent systems -> aircraft-state bus -> Audio Warning Engine -> classified warning events -> Aural Mixer/Voice Queue -> output speakers.

- All alert calculations use physical units (feet, knots, lever degrees); no screen coordinates.
- Source systems (EGPWS, TCAS, autopilot, stall) must supply their independently evaluated discrete warnings. A cockpit button cannot trigger a safety-critical alert except in labelled maintenance / sound-test mode.
- An intermittent horn sound instance is shared between cabin and takeoff indications even when both active. Annunciator states remain distinct.
- Physical warning cutouts affect specific permissible audio, not unrelated annunciators.
- Momentary altitude, RA and minimums callouts are threshold transitions, not continuously looping clips.
- Voice priority is provisional: warning voice precedes informational callouts. Do not claim exact certified mixing/ducking from first test rig.
- Sample-accurate waveforms, amplitude, repetition spacing, speaker placement and crew audio balance remain unverified.

## Audio registry

| Key | Event | Candidate timbre | Actual sample status |
| --- | --- | --- | --- |
| altitude | MCP acquisition/deviation | short tone | placeholder |
| intermittentHorn | takeoff config/cabin >10,000 | shared intermittent horn | placeholder |
| gearHorn | unsafe landing configuration | steady horn | placeholder |
| fireBell | engine/APU/wheel/cargo fire | warning bell | placeholder |
| overspeed | Vmo/Mmo exceeded | mechanical clacker | placeholder |
| shaker | stall computer warning in flight | column vibration / rumble | placeholder |
| apDisconnect | A/P disconnected | warning tone | placeholder |
| atDisconnect | A/T disconnected | configuration dependent | placeholder |
| gpws | EGPWS/WS message | recorded warning phrase | browser TTS placeholder |
| tcas | TCAS advisory | spoken advisory | browser TTS placeholder |
| radioAltitude | RA callouts | voice | browser TTS placeholder |
| minimums | approach / minimums | voice | browser TTS placeholder |

For final assets, use permission-cleared recordings for supported aircraft/equipment combinations (speech must not depend on browser TTS in a final build). Keep WAV masters lossless, normalize consistently, avoid clipping, and load/cache assets locally before flight. Do not repurpose copyrighted third-party recordings without rights.

## Lab use

On this branch, open audio-lab/index.html in a modern browser. Click a labelled PLAY cell. Use numeric inputs and checkboxes to trigger conditions, then Evaluate + Play. Browser audio/TTS is user-gesture gated and isolated from main cockpit.

For repeatable tests run:

    node tests/audio-warning-engine.test.cjs

For the next phase, connect the engine to aircraft systems; implement priority/mixing per installed equipment; replace placeholders with authorized audio; test state changes, reset, source power and dual-channel sound.

## Known gaps / engineering cautions

- FCOM excerpt explicitly gives min takeoff flap for -300 (flap 1) and -500 (flap 5). For -400, prototype deliberately reports its T/O flap range as unevaluated instead of inventing a rule.
- Thrust takeoff trigger is provided as a discrete boolean; exact trigger angle logic needs source confirmation.
- A steady warning in browser lasts only a test burst; integrated runtime must loop while unsafe state persists.
- Simultaneous physical alarm mixing/voice ducking is provisional, and not Boeing's installed-system priority algorithm.
- RA samples, missed-approach re-arming and invalid sensor inputs require more testing.
- Current cockpit is educational only, not approved for aircraft operations or pilot qualification.
