# ISN-05 — Integrated Warning, Annunciation & Audio Intent (B737 Classic)

**Date:** 2026-10-23  
**Result:** implemented and independently checked in the isolated development branch. NOT installed into the production cockpit/Pages or `main`.  
**Effectivity focus:** EP-FSI / Boeing 737-300, MSN 29340; source pages refer to Sepehran 737CL FCOM. This is a *training-system pilot*, not a certified aircraft warning-electronics replica.

## Runtime graph

```
Electrical buses / source selection
  -> AC-powered fuel pumps and hydraulic electric pumps
    -> source-constrained physical pressure model
      -> independent sensor faults and signal quality
        -> existing FCOM warning policy + caution acknowledgement/recall
          -> ISN-05 annunciation adapter
            -> named physical-panel lamp output requests
            -> fire-bell audio intent -> mapped phrase asset, only when present
```

The additional **ENGINE 1 fire detector pilot** is driven by the existing electrical model's `fireDetectionPower` (Battery Bus) and independent A/B detector loops. Unlike the amber master caution, **MASTER FIRE WARN and FIRE BELL have their own cutout**. Fire-detection inputs are *instructor-provided discrete loop states*, not guessed fire temperature.

### Code

- `engine/network/annunciation-output-engine.cjs`: pure logical-panel output projection, 23 named lamp outputs, logical demand ON/OFF/UNKNOWN distinct from physically projected visibility, panel group/severity/reference, audio-active-key request and deterministic START/STOP/HOLD differences.
- `engine/network/integrated-aircraft-kernel.cjs`: runs `evaluateEngineFireDetection()` from verified Battery Bus state; projects ENG1 overheat into the amber `OVHT/DET` caution system, but keeps FIRE WARN/BELL independent. Adds `SET_FIRE_LOOP`, `SET_FIRE_SELECTOR`, and `ACK_FIRE_WARN`, including re-arm after fire clears and recurs.
- `power-consumers-lab/index.html`: standalone branch-only panel with lamp demand/projection views, selectable fire sensor loops, cutout, MASTER CAUTION ACK, FUEL/FLT CONT/HYD displays, and an **opt-in** sound output player. All receive the source runtime, not animation fixtures.
- `audio/policy/phrase-selector-v4.js`: existing owner-approved source mapping/selector; `fireBell` resolves to `audio/original/fire-alarm.mp3` **when that individual asset exists**. This branch has not established the media file in that target location. The UI therefore reports missing/unavailable audio rather than synthesizing a fake authentic recording.
- `tests/annunciation-integration.test.cjs`: rigorous deterministic fire/caution/sensor/audio/ACK/recall/regression suite. `tests/power-consumers-browser.test.cjs` covers source-to-browser replay parity and visual-script syntax.

## Primary source index (private Technical Database)

| Observable | Sepehran FCOM printed section | Physical PDF page(s) |
| --- | --- | --- |
| Fuel pump LOW PRESSURE, center vs main switch / recall | 12.10.2–3 | 1826–1827 |
| Hydraulic pump output pressure lights | 13.10.1 | 1842 |
| FLT CONT hydraulic pressure low | 13.10.4 | 1845 |
| Engine fire detector on Battery Bus, A/B loops and warnings | 8.20.1–2 | 1234–1235 |
| Amber MASTER CAUTION reset, system annunciator recall, independent red FIRE WARN cutout | 15.20.2 | 1906 |
| FUEL, ELEC, FLT CONT and OVHT/DET systems placement | 15.20.3 | 1907 |
| HYD system annunciator placement | 15.20.4 | 1908 |

For all physical-lamp coordinates and exact wires, actual WDM/SSM/AMM and cockpit-image calibration are still needed. The independent lab groups outputs by **functional panel**; it does NOT falsely claim to be a pixel-perfect instrument panel.

## Output contracts

Each projected lamp supplies:
- `id`, `group`, `severity`, `source`
- `logicalDemand: ON | OFF | UNKNOWN` — source-consistent simulator command
- `projectedVisibility: ON | OFF | UNKNOWN` — **only provisional** when both DC buses known powered; otherwise UNKNOWN
- `actualLampCircuit: NOT_VERIFIED_WDM` — permanently labeled until corresponding wiring reviewed

A warning from a sensor with invalid/unknown pressure does **not** become a confident ON indication. No generic aural signal is synthesized for FUEL/HYD/MASTER CAUTION. The Electrical system annunciator's circuit-specific logic is NOT treated as equivalent to generator bus loss and remains UNKNOWN. An engine fire detected with missing detection power similarly gives UNKNOWN FIRE WARN rather than guessed red visual or bell.

### Caution reset and recall

- ENGINE GEN1 failure case sets FUEL pump lamp(s), appropriate HYD electric pump LOW PRESSURE, and an active center tank FUEL caution cause.
- MASTER CAUTION ACK extinguishes its logical master demand and its system annunciator demand, **not the source pump LOW PRESSURE light** or the underlying fault.
- System recall can display a single-fuel-pump low-pressure *simple fault* without inventing a new pump failure.
- Fault clearing and recurring re-arms MASTER CAUTION. Confirmed fire uses a **different** acknowledgement: `ACK_FIRE_WARN` stops fireBell demand/red master FIRE WARN but leaves the still-existing engine fire-switch light/detection condition and amber caution independent.
- Explicit sound transitions are `START`, `STOP`, `HOLD`. Audio intent `fireBell` uses existing `AUDIO.fireBell.priority=95` and `PhraseSelector.asset('fireBell')`. The selector forbids full multi-phrase `a.mp3` or `c.mp3` playback without per-phrase mapping.

## Reproduction

From a checkout of `design/integrated-systems-network-v01`, execute:

```sh
node tests/system-network.test.cjs
node tests/electrical-integration.test.cjs
node tests/pump-warning-network.test.cjs
node tests/electrical-pressure-stage12.test.cjs
node tests/feeder-pressure-stages.test.cjs
node tests/sensor-failure-network.test.cjs
node tests/annunciation-integration.test.cjs
node tools/build-power-consumers-lab.cjs --check
node tests/power-consumers-browser.test.cjs
```

Open `power-consumers-lab/index.html` from a local HTTP server at the repo root; import or install the permitted audio sample separately at the mapped path if playback is desired. Enable audio in the lab by explicit user action (browser autoplay is NOT assumed). In the absence of the asset, only the logical audio cue is testable.

## Remaining engineering work / promotion gates

1. Actual panel artwork geometry / lamp bounding boxes for each effectivity-specific cockpit overlay and browser visual/manual QA; the current isolated lab is a functional panel, not the deployed cockpit UI.
2. Physical lamp, master-caution, aural module power and circuit breaker feeds from applicable WDM/SSM; currently unknown/provisional.
3. Verified input airframe fire annunciator option effectivity and Engine 2/APU/Wheel Well details; **only Engine 1 fire detector** is wired into this pilot.
4. Existing separated owner-supplied sound assets under permitted repository/hosting/storage path and audio playback QA. Current branch does NOT assert that `audio/original/fire-alarm.mp3` is present.
5. Complete FCOM warning timing and residual fault treatment (including blackout, intermittent center tank low-pressure flicker, power restoration), without inferred numerical delays.
6. Explicit acceptance of cockpit/frontend deployment; no `main` or live user app changes until approval.

**No Boeing manual pages or owner-supplied audio binaries were copied into the source repository as part of this phase.**
