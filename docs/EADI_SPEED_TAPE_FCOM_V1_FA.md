# B737 Classic EADI Speed Tape V1 — FCOM-source implementation

**Status:** committed to Unified main panel, Captain and First Officer EADI reserved \`speedTape\` layers.
**Use:** classroom training ONLY. Not flight-certified, not a substitute for aircraft documents.
**Release:** \`SPEED-TAPE-FCOM-0001\` / \`EADI-SPEED-TAPE-0001\`.

## Primary sources (Sepehran B737 300/400/500 FCOM)

- 10.30.13–15: 17 labelled EADI speed tape symbologies and colours.
- 10.30.16: SEL SPD INOP, V1 INOP, SPD and SPD LIM flag meaning.
- 10.40.6: moving scale, 45 kt low-speed default, approximately 84 kt visible, 20-kt labels, rotating units digit, 10-second trend arrow with >4 kt show and <3 kt hide, dual-line magenta bug.
- 10.40.7: VMO/MMO/gear/flap placard precedence, high-speed buffet >25,000 ft gross-weight dependency, next-flap marker visibility, flaps-up green dot, V1/VR.
- 10.40.8: selected VREF remains frozen until explicitly reselected; flap retraction marker 5/1/UP; low-speed .3 g margin; spoiler influence; stick shaker source.
- 4.10.3–6: MCP speed selector, A/T SPEED, VNAV/FMC command handoff.
- 4.20.32–35: independent commanded speed limit and AFDS speed reversion. Rendering an advisory is not applying airplane commands.
- MRG CL/NG 2007 p.33/276/294: speed estimates are *not* certification tables; Classic ADC failure yields SPD; Classic FMC failure takeoff speed-tape usability limitation.

## Architecture

1. \`engine/efis/classic-speed-tape-engine-v1.js\`: deterministic side-isolated reducer, no DOM, no timers, no flight model or dynamic network.
2. \`panel-mosaic-lab/cockpit/eadi-speed-tape-v1.js\`: canvas painter and event adapter. Uses existing \`B737UnifiedEADIStage1.registerLayer('CAPT'|'FO','speedTape',fn)\`; no changes to EADI face, attitude scale, FMA, switches, bezel or parent photo.
3. \`panel-mosaic-lab/cockpit/index.html\`: loads the two scripts after FMA and EADI stage 1; EIS/Conventional use the same reserved glass layer.
4. \`engine/efis/classic-speed-tape-engine-v1.test.cjs\`: 40+ focused regression assertions.

### Data owners

- CAPT uses \`airdata.adc1\`; FO uses \`airdata.adc2\` from \`B737UnifiedAvionicsNetworkV1.getSignal()\`.
- Only valid CAS simulator telemetry feeds the moving tape. Other \`flightcontext.iasKt\` training values are **not** implicitly treated as validated ADC inputs.
- \`B737McpAFDSBridgeV1.getOutput()\` supplies selected IAS if powered, nonblank and in IAS mode. VNAV/FMC SPD requires an explicit FMC commanded CAS input.
- MACH-to-CAS conversion is **not** guessed; MACH selections await a verified converted CAS.
- FMC, stall warning, placards and weight are explicitly supplied as separately validated observations. No hard-coded VMO/MMO, shaker, VREF, flap, weight or FSEU formulas.
- Tape is read-only relative to AFDS and MCP. \`effectiveTargetKt\` is an advisory, not a servo command and does not force a flight-mode capture.
- Every seat has its own state, trend history, timeout, and failure flags. Lost samples expire after 2 s with one-shot scheduling; there is no polling loop in the tape engine.

### Explicit training observation API

These calls are simulator *training observations*, **not** real aircraft sensor claims. They may be dispatched from verified backend adapters once implemented.

\`\`\`js
// ADC sampled simulator telemetry is preferred via B737UnifiedAvionicsNetworkV1:
// .configureSensorIngress({sourceId:'SIM_737_CLASSIC',equipment:{adc:[1,2],gps:[],vor:[],dme:[]}})
// .ingestSensorFrame({schema:'B737_SENSOR_FRAME_V2',sourceId:'SIM_737_CLASSIC',
//   sequence:1,sourceTimestampMs:Date.now(),
//   sensors:{adc1:{valid:true,casKt:227,pressureAltitudeFt:3000},
//            adc2:{valid:true,casKt:225,pressureAltitudeFt:3000}}})

B737UnifiedSpeedTapeV1.observe('CAPT',{
  type:'CONFIG',flapsPosition:0,gearExtended:false,inFlight:true,
  phase:'CRUISE',flapsRetracting:false
});
B737UnifiedSpeedTapeV1.observe('CAPT',{
  type:'LIMITS',valid:true,vmoMmoCasKt:340,minimumManeuverKt:198,
  stickShakerKt:180,flapsUpManeuverKt:210
});
B737UnifiedSpeedTapeV1.observe('CAPT',{
  type:'FMC',valid:true,commandCasKt:235,grossWeightAvailable:true,
  v1Kt:null,vrKt:null,selectedVrefKt:null,landingFlaps:null
});
B737UnifiedSpeedTapeV1.getView('CAPT');
\`\`\`

Alternatively, send \`b737:speed-tape-fmc\`, \`b737:speed-tape-limits\`,
\`b737:speed-tape-configuration\` or \`b737:speed-tape-failures\` with:
\`{seat:'CAPT'|'FO'|'BOTH',payload:{...}}\`.
The renderer validates ranges and never treats a training event as an ADC sensor packet.

### Limit calculations and unavailable inputs

- A displayed maximum operating barber pole requires **complete** confirmed applicable placard coverage: baseline VMO/MMO, gear state and, when flaps extended, the selected flap placard. Unknown states remove the pole rather than misleadingly showing an unrestricted VMO.
- Speed band endpoints must be supplied by Stall Warning / validated performance data. FCOM 0.3G margin is not an invented speed formula.
- \`minimumAfdsKt\` is a separate input from \`minimumManeuverKt\` and \`stickShakerKt\`.
- Flaps-up green circle only after flap position zero; retraction F marker only for takeoff or go-around in flight.
- Next flap placard suppresses while retracting or after arriving at configured landing flap setting.
- High-speed buffet bar requires measured pressure altitude >25,000 ft, available FMC gross weight and a valid supplied limit.
- Non-normal flags are independent: \`SPD\` disables speed indication, \`SPD_LIM\` removes dependent limits but preserves airspeed.

### Pending aircraft-specific source work

- Per-airframe CFM56-3/29340 AFM certified VMO/MMO/gear/flap placard tables and stall warning performance data.
- Validated FMC selection handoff for actual VR/V1/VREF/Flaps UP and command IAS for all MCP Mach regimes.
- Exact FCOM selection/blanking logic where 10.30 only describes displayed symbols (e.g. flight-phase persistence). No unverified auto-blanking was added.
- Complete electrical/circuit breaker provenance for each EADI symbol generator and ADC. The speed tape does not claim the current stage-1 EADI power assumption is an aircraft electrical model.

## QA

\`\`\`sh
node engine/efis/classic-speed-tape-engine-v1.test.cjs
\`\`\`
Coverage: first sample, ADC validity/expiry, independent channels, rolling digits painting,
10-second trend with hysteresis, MCP/FMC selection, partial placard safety,
low/high speed bands, flap transition, independent failure flags, and canvas layer binding.
