# OH10 RESID VOLTS — ATA 24 trainer integration (RESID-0001)

Scope: Boeing 737 Classic 300/400/500 procedure/QRH trainer, **not certified maintenance wiring or live aircraft test procedure**. This implementation reuses the owner-approved recessed pushbutton at native OH10 `(917,1273), d=112`, existing AC selector, existing AC VOLTS face and white needle, and the original locked OH10 bitmap. No guard, scale, rotary, font, texture, or gauge artwork changed.

## Runtime path

1. The existing OH10 `recessed-overhead-v2.js` sends a **momentary** `b737:cockpit-overhead` postMessage with `kind:'recessed-button'`, `id:'residual-volts'`, `pressed:true/false` to its parent.
2. `residual-volts-unified-v1.js` accepts this message **only** from the correct same-origin `overheadFrame.contentWindow`. It also accepts an explicitly dispatched local `b737:recessed-button` event for integrated test harnesses. `pointerup`, `pointercancel`, `lostpointercapture`, `blur`, `keyup`, and iframe reload cause release as applicable.
3. AC selector state comes from `B737UnifiedAcDcSelectors`, preserving the **owner's AC order** STBY PWR → GND PWR → GEN1 → APU GEN → GEN2 → INV → TEST. Only GEN1, GEN2 and APU GEN support generator-residual evaluation. No automatic source selection.
4. The independent `B737ResidualVoltsModelV1` resolves measured source, independent GCR/field excitation and drive, technology (CSD/VSCF/APU), source and meter failures, availability of an actual measurement and instructor-scoped test fixtures. It preserves **UNKNOWN** rather than fabricating an electrical measurement from a powered bus.
5. The **existing** `B737UnifiedAcDcMetering.setReading('acVolts',value,{mode:'RESIDUAL'})` maps a valid 0–30 V sample into the original photo-based pointer arc (provisional calibrated transform). On RELEASE, it immediately switches back to `mode:'NORMAL'`. DC AMPS, DC VOLTS, CPS and all protected graphics are not changed by this subsystem.

## Operational safety model (educational)

- GCR closed or field explicitly excited: `UNSAFE_OVER_RANGE`, no supplied residual-voltage sample. **Do not** drive a 115 V measurement through the 0–30 V range. An instructor can separately enable the *simulated* meter-damage scenario and repair via **replace damaged voltmeter**. No automatic physical damage claims.
- GCR/drive unknown: `UNVERIFIED`. No fake sample.
- Generator failed, stopped (unless genuine zero sensor sample), uninstrumented source, or voltmeter fault: no fabricated output and explicit status reason.
- Measured sensor >30 V: `UNSAFE_OVER_RANGE`; reject rather than clamp as a fake 30 V.
- `TRAINER_FIXTURE` is an explicit, visually labelled **educational demonstration**, not a real sensor/AFM tolerance. Demo CSD RUNNING/GCR OPEN = 18 V, CSD DISCONNECTED/GCR OPEN = 4 V, VSCF RUNNING/GCR OPEN = 17 V; APU generator retains UNKNOWN without a measurement. In MEASURED mode no demo number is generated.
- Normal AC 115 V is a *source input*, not a default; remembered 115 V is invalidated when GCR opens, drive disconnects/stops or generator fails.

## External integration contract

```js
// The existing physical OH10 button emits this automatically from its iframe.
window.postMessage({type:'b737:cockpit-overhead',kind:'recessed-button',
  id:'residual-volts',pressed:true,action:'PRESS'},location.origin);

// The external generator/measurement owner can publish authoritative state:
window.dispatchEvent(new CustomEvent('b737:residual-generator-state',{detail:{
  source:'GEN1',patch:{
    gcr:'OPEN',              // OPEN | CLOSED | UNKNOWN
    drive:'RUNNING',         // RUNNING | STOPPED | DISCONNECTED | UNKNOWN
    technology:'CSD',       // CSD | VSCF | APU
    fieldExcited:false,     // false | true | null (unknown)
    measuredResidual:18.1,  // 0..30 measured V | null
    normalVolts:null,
    normalFrequency:null,
    failed:false,
    instrumentFault:false
  }
}}));

// The selected source AC/DC meter measurements are a separate existing event:
// b737:ac-dc-source-measurement detail {side:'AC',position:'GEN1',
//   measurement:{volts:115,cps:400}}

// Runtime/test APIs
window.B737UnifiedResidualVolts.snapshot();
window.B737UnifiedResidualVolts.getAudit();
window.B737UnifiedResidualVolts.press(true);
window.B737UnifiedResidualVolts.press(false);
window.B737UnifiedResidualVolts.configure('GEN2',{gcr:'OPEN',drive:'RUNNING',
  measuredResidual:12});
```

## Existing integrated systems

- `B737ISNCockpitV1.getStartState().sources` supplies **live observed engine1/engine2/APU running state** through `b737:unified-ecu-observation`. The engine running state is only the drive-status input; it is not a GCR measurement.
- `b737:electrical-v7-state` can supply boolean running context. Electrical V7 does **not** currently report field excitation, calibrated residual voltage or a direct GCR contact sensor. Therefore those inputs must come from the generator instrumentation adapter or explicitly controlled Test Lab scenarios.
- Recessed button and four gauge/needle asset geometry are owner-locked. All changes remain in new standalone backend and non-invasive integration scripts; the small Test Lab is in the inspector, not over the real panel.

## QA acceptance / outstanding

The automated `residual-volts.test.cjs` checks GCR gating, independent drive states, overrange rejection, spring-return, source isolation, iframe origin/source authentication, original 115 V restoration, normal/RESID scale handling, and instructor fixtures. GitHub Pages CI includes this file.

**Pending real-browser evidence:** successful deployed workflow and screenshot verification of the actual OH10 button press, existing AC pointer position and native photo mask with 100–200% zoom. The residual 0–30 V photo-angle map remains provisional; an exact AFM/maintenance source-specific limit and APU generator residual behavior cannot be inferred from this discrete simulation.
