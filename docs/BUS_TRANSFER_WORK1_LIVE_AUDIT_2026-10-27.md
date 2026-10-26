# BUS TRANSFER — Work 1 guarded preview to live Electrical V7

**Scope:** A runnable, source-gated preview control in the original BUS TRANSFER guard review dialog. **Not** an approved physical installation on the OH12 source photograph.

## Source constraints
- Owner-approved physical family: black passenger-oxygen-style cover rotated 90 degrees, wider than tall, left hinge. Original reference artwork, textures, switch sockets and geometry unchanged.
- `GuardedSwitchBlueprints.json`: `controlId=bus-transfer`, `sourceCenterNativePx=null`, `sourceRectNativePx=null`, `requiresCalibratedSocket=true`.
- `engine/maps/guarded-switch-owner-hinge-quiz-v1.json`: confirmed LEFT hinge but mounting rectangles still unknown.
- No new fake pixel coordinates, guessed supply bus or phantom separate Electrical runtime.

## Implemented
1. `engine/integration/isn-cockpit-bridge-v1.js`: `bus-transfer` guarded `auto`/`off` map to the existing Pack's Electrical V7 `busTransferAuto` control.
2. `engine/runtime/unified-live-gateway-v1.js`: guarded preview mapping, rejects closed guard, wrong kinds, invalid detents; idempotent repeated positions; rehydrate preview state from authoritative Electrical Pack.
3. `panel-mosaic-lab/cockpit/bus-transfer-guard-review.html` + `bus-transfer-live-preview-v1.js`: separate accessible guard open/close and AUTO/OFF controls, without replacing original approved rendered guard. Always report actual acknowledged state.
4. `panel-mosaic-lab/cockpit/isn-cockpit.js`: verifies exact known same-origin preview iframe, checks real opened guard DOM before dispatch, sends acknowledged result with system current state.
5. Tests: `tests/unified-live-gateway-v1.test.cjs`, original bus-transfer geometry approval tests, Electrical V7/ISN regressions, `tools/bus-transfer-live-browser-smoke.cjs` in real Chromium.

## Deliberately hostile QA
- **Detected and fixed**: 3D opened-cover hitbox overlapped its adjacent comparison panel. Pointer click could fail even when the visual cover appeared open; added accessible buttons that activate the very same existing visual cover with no image redesign.
- **Detected and prevented**: a message claiming `guard:'open'` is insufficient; the parent independently inspects the preview document's `.station.opened` guard.
- **Prevented**: physical event repeats must not increment Electrical V7 revision.
- **Prevented**: a closed guard cannot change switch mode.
- **Prevented**: static preview must not be scored as a mounted physical switch; `busTransferPhysicalControl:false` remains intentionally TRUE as an outstanding audit issue.
- **Prevented**: physical source unknown must not magically power equipment; Loads V8 still has `loadsKnownBus:0` when individual feeds are undocumented.

## Test evidence
- GitHub Actions `B737 BUS TRANSFER Live Electrical Gate` passed on commit `e027c03a797a1d722f42bd5a1d283b77cc071a28`, runs 40401729091 and 40401735219.
- Dedicated live gateway Node tests **17/17** passed, and existing Electrical V7 checks **47/47** passed.
- Real Chromium opens the actual Unified, the same-origin review iframe, operates guard controls, sets OFF then AUTO, checks Electrical revision increments exactly once, and confirms guard-close lockout.
- Existing geometry source approvals remain protected by immutable-asset check and reference geometry tests.

## Remaining blockers
- **P0 physical mounting:** no validated OH12 socket coordinates; do not mount over locked photographic art until calibrated source pixel positions and QA overlay match.
- **P1 variant-aware warnings:** existing ISN Warning Engine profile propagation remains incomplete.
- **P1 general control coverage:** additional 737 Classic guarded controls and CB/CPCS ownership remain to be connected and accepted.
- Trainer training-only; none of this is a certification-grade electrical or airworthiness verification.
