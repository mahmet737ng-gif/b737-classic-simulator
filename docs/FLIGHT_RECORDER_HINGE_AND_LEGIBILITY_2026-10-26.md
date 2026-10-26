# B737 Classic — FLIGHT RECORDER hinge-left guarded switch and compact annunciator readability

**Implemented and source-photo visually verified in Chromium 2026-10-26** in `mahmet737ng-gif/b737-classic-simulator`.

## FLIGHT RECORDER: first install the switch, then align the OFF lamp

The native UPPER/OH06 locked photograph (original 1731×909 pixels) is the installation reference. Its TEST/NORMAL lettering is above a clear empty horizontal lever pocket; external 737 Classic flight instruments references show a horizontally hinged/capped **FLIGHT RECORDER TEST/NORMAL** switch on the left, with the **OFF** indicator immediately to its right.

| Installation | Source-image rectangle | Source-image centre |
|---|---|---|
| New horizontal TEST/NORMAL **left-hinged guarded switch** | `[1365,438,113,34]` | `[1421.5,455]` |
| Retained OFF annunciator | `[1485,439,40,31]` | `[1505,454.5]` |

**Measured gap = 7 native image pixels**, vertical centre difference = **0.5 native pixels**. The guard is mounted first in the source-photo vacant pocket. Because the source-photo OFF aperture already lines up to the newly anchored guard without a collision, **the OFF lamp source rectangle has not been moved speculatively**. This avoids inventing an inaccurately certified new glass edge; FLIGHT RECORDER OFF remains one of the two previously flagged fine-pixel lamp-edge cases.

### Operation

- Default is NORMAL with the **left-hinged guard closed**; the lever cannot select TEST until opened.
- Opening the cover exposes a black horizontal lever. Selecting TEST sets the FDR test channel; closing the cover forces NORMAL.
- On the ground with both engines stopped, the simulated recorder OFF lamp illuminates if electric power is available. Selecting TEST permits a healthy recorder to operate and extinguishes OFF. A detected recorder fault remains annunciated even during TEST.
- Inflight or with one engine running, recorder normal operation can extinguish OFF. The simulator lamp-power gate remains unchanged; Lamp Test continues to use the existing bus logic.
- All state changes use the existing guarded-control engine, persistence and event bus; no independent fake control state is introduced.

Grounded operation reference: 737-300 FCOM Flight Recorder section 10.10.12, TEST bypass of engine/air-ground gating, NORMAL guarded and associated OFF indication. Simulator source wiring is still a model approximation until the precise manufacturer electrical wiring schedule is ingested.

## Small-display readability derivatives

Six mounted lamp positions / twelve OFF/ON SVG derivatives, **not changes to original locked source artwork**:

- `flight-recorder-off` — increase the three-letter OFF vector size *after fixing the switch anchoring*, keeping orange/amber light colors and the 40×31 physical aperture.
- `irs-l-align` and `irs-r-align` — enlarge ALIGN white lettering while keeping the two 64×32 photo placements.
- `main-stab-trim` — proportionally enlarge the STAB / OUT OF / TRIM lines, preserve the three original text lines.
- `main-antiskid` — enlarge ANTI SKID and INOP; no caption changes.
- `main-at-lim` — widen the dark root vector face to its actual 82×35 natural socket ratio, enlarge A/T LIM without skewing letters.

These six variants are **position-specific additional image overlays** stored in `readability-faces.json` for overhead and main. The old registry files, source metadata, photos and approved positions are preserved; only the live artwork selection prefers the generated vector derivatives.

Original legend text, line breaks, ON/OFF colors and original SVG fingerprints are checked by `readability-derivatives.test.cjs`. Full 307-state browser photometric QA and two 33%/50% optical contact sheets passed automated load, contrast and color-order gates. **A 16×10-pixel 33% OFF test image cannot be assumed fully legible at ordinary viewing distance**; normal Unified display-scale human acceptance remains a separate requirement.

## Evidence and quality gates

- [Visual annotated source-photo hinge inspection](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40251522134)
- [Flight recorder interaction and source-coordinate regression test](../panel-mosaic-lab/lights-test/flight-recorder-hinge.test.cjs)
- [Photo-locked guarded state/electrical warning checks](../panel-mosaic-lab/interactive-overhead/lights.test.cjs)
- [Independent live Chromium guarded-switch audit](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40253902882)
- [Twelve readability derivatives and source fingerprints](../panel-mosaic-lab/lights-test/readability-derivatives-v1.json)
- [33%/50% screenshots and full photometric measurements](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40253503931)

**Unchanged:** Original OH06 photograph, 142 photo source positions, existing OH20/OH21/OH22 imagery and CPCS/DCPCS profiles, Boeing source switch legends, circuit breaker definitions and the common bus model.

### Remaining approval conditions

1. **Completed in Chromium:** original UPPER panel source screenshot inspected with the mounted left hinge and bright amber OFF lamp visible together. The switch and lamp are adjacent without overlap. Measured live-panel gap **5.71 CSS pixels**, vertical-centre difference **0.36 CSS pixels**. Guard open / TEST / close-to-NORMAL interactions passed and zero lamp-related JavaScript errors occurred. Further human hardware-faithfulness review at each target device zoom remains worthwhile.
2. Certify the exact recorder OFF inner-glass edge only if a clearer source photo justifies a geometry adjustment.
3. Complete human recognizability and brightness acceptance for the five improved small legends at real screen pixel density, independently of the successful normalized pixel QA.

## Final browser release confirmation

- [Passed guarded-switch geometry and ON/OFF interaction with actual OH06 screenshots](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40253902882)
- [Passed Pages build and deployment of the same commit](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40253902783)
- [Passed 307-state OFF/ON/DIM/BRIGHT + 33%/50% readability optical QA after derived type enlargement](https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40253503931)

The source-photo-glass precision count remains **140/142**; installing the switch and proving its 7px separation does **not** falsely certify the ambiguous left border of the tiny recorder annunciator.
