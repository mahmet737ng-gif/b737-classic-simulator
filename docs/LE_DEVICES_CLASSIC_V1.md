# LE DEVICES — 737 Classic simplified trainer V1

**Scope:** normal / non-normal / emergency logic for **10 mechanical devices** (four inboard LE flaps; six slats) and the **26 approved individual lamp windows** in LEDEV-0006. This is a trainer, not a wiring schematic, no real-aircraft use.

## Sources (brief original-language attribution only; original texts remain private)
- FCOM Sepehran 737-300/400/500, 9.10.13-14: TRANSIT, EXT, FULL EXT, TEST and center LE FLAPS lights.
- FCOM 9.20.15–19: six slats, four flaps, configuration sequence, autoslat and alternate hydraulic extension, improper-position warning.
- FCOM 6.20.9: AC/DC distribution architecture.
- MRG Classic IV.6 printed pages 163, 166, 184: forward indicators vs overhead powered separately; overhead can go out under loss of TFR BUS 1, LE indicators listed on DC BUS 1. **Surrogate only** — actual branch and CB for every overhead lamp not modeled.
- MRG IV.9 printed pp.248–255: alternate flaps and transition fault examples.
- Do not substitute 737NG FSEU/Sensor/CB wiring for Classic. WDM mapping deliberately out-of-scope per owner decision.

## Simplified signals
- `FLAP_LEVER` detents: 0,1,2,5,10,15,25,30,40.
- `TICK(seconds)` moves the actual physical model (one level per five seconds is a **training convenience, not a real-aircraft figure**).
- `HYDRAULIC(B)`, `HYDRAULIC(standby)`; `ALTERNATE_EXTEND` (full-only standby LE extension).
- `GROUND`, `AUTOSLAT`, `PTU` allow in-flight full slat deployment; center amber is inhibited in the autoslat operation.
- `POWER(transfer1)` controls the overhead **as a whole**, `POWER(dc1)` controls center indicator **as a whole**. Boolean or null (unknown). No per-lamp wiring.
- `JAM`, `SENSOR`, `LAMP_FAILURE` for instructor non-normal cases.
- `TEST` momentary lights, without clearing hydraulic or mechanical faults.
- `RESET(mode)` selects normal, non-normal, or emergency presets. Presets are training setup only, not claims about actual failures.
- Non-normal: System B off, standby off; emergency: System B off, standby available. Engine never spontaneously powers a failed bus.
- Evaluation provides independent 26-window overhead lamp map, two forward lamps, observed positions, mismatches and faults.

## Wiring / integration boundary
Pure engine: `engine/systems/le-devices-classic-v1.js` exports `initialState, apply, evaluate, execute`.
UI bridge: `panel-mosaic-lab/le-devices/trainer-bridge-v1.js` reuses the existing B737LeadingEdgeDevices panel API and never modifies its image, regions, dimensions or guards.
Electrical input must come from the **existing authoritative** electrical runtime's bus output, or be instructor explicitly provided; the bridge **does not instantiate another Electrical V7**. It preserves unknown if not supplied.
No checklists, dispatch authority, mechanical timing or CB wiring assertions are implied.

## Manual smoke tests
Normal: UP -> FLAPS 1 -> 5 -> 10 -> 40, watching 4 green FLAP windows and 6 slat EXT/FULL_EXT lamps.
Non-normal: jam one slat, observe its own amber and center transit mismatch.
Emergency: lose B, select standby and alternate full extend, then attempt standby retract (should remain extended).
Electrical: remove transfer1 (overhead dark; forward lamps conditional on dc1), remove dc1 (forward lamps dark; overhead independent).
Momentary TEST, BRIGHT/DIM leave original physical state intact.

## Mismatch annunciation rule — LEDEV-LOGIC-V2

**Required simulator behavior:** an individual LE device displays green only if its sensed/observed position **agrees** with the position commanded for the current Trailing Edge Flap lever. A device stopped at a formerly valid detent, but not yet at the new commanded detent, displays amber TRANSIT with both green windows off, even if a mechanical JAM has stopped motion entirely. The independent forward LE FLAPS TRANSIT remains active as appropriate. The modeled physical position is retained separately in `indication` and `position`; `overhead.indication` is the *commanded-versus-observed annunciator* state for the front end. No artwork changes.

**Acceptance case:** FLAPS 5, slats at EXT; jam SLAT 2; command FLAPS 15; all other slats reach FULL EXT. SLAT 2 stays physically EXT, its green EXT goes out and its amber TRANSIT stays on. Physical TEST temporarily illuminates lamps and releasing returns to this condition.
