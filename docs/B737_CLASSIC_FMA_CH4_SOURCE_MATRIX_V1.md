# B737 Classic 300/400/500 — FMA source matrix (training simulator)

**Implementation:** `engine/afds/fma-mode-engine-v1.js`, rendered by
`panel-mosaic-lab/cockpit/eadi-fma-fcom-v2.js`.

**Sources consulted:**
- **Sepehran 737CL FCOM** D6-27370-300/400/500-SHI, Chapter 4: 4.10.27 (annunciation positions, colors, 10-second highlight), 4.20.4–4.20.11 (FCC master/independent F/D, active and armed modes, capture conditions, A/T transitions).
- **Lufthansa LAN 737-300/400/500** technical training, ATA 22-10 and 22-12: EADI FMA is generated from the FCC/DFCS, contains A/P and F/D mode indication, and receives warning/engagement data.
- **B737 MRG Classic**: additional operations/training reference. No MRG page is presently adopted as an authoritative replacement for an FCOM engagement/capture condition; no certification-level three-way page audit is claimed.

## Visual geometry (FCOM 4.10.27; owner's FSX reference)

Four columns, **three white vertical separators only**; no permanent grid
boxes, labels, top frame or bottom frame. Left to right: **A/T mode**, **PITCH
mode**, **ROLL mode**, **AFDS mode**. Large green engaged indication at top;
small white armed indication beneath. `ARM` is white. `CWS P`, `CWS R`,
`1 CH` are yellow. The FCOM 10-second changed-mode highlight rectangle is
*temporary and inside a field*, not a permanent box around each column.

The owner's 1920x1080 FSX screenshot gave a predominant green sample of
RGB **(33, 198, 99)**, `#21C663`; the font is a condensed bold sans-serif
approximation until a verified authorized font file is available.

## Mode vocabulary and evidence

| Column | Engaged / indicated | Armed (white) | Capture/engagement evidence |
|---|---|---|---|
| A/T | N1, GA, RETARD, FMC SPD, MCP SPD, THR HLD; ARM (white) | — | A/T armed, thrust servo status, selected N1/speed, flight phase, FMC profile |
| PITCH | TO/GA, V/S, ALT ACQ, ALT HOLD, VNAV SPD, VNAV PTH, MCP SPD, G/S, FLARE | G/S, V/S, G/S V/S, FLARE | FCC vertical state, FMC profile, altitude acquisition, glideslope capture, dual A/P, RA |
| ROLL | TO/GA, HDG SEL, VOR/LOC, LNAV | VOR/LOC | FCC roll state, NAV receiver/capture or FMC route |
| AFDS | FD, CMD, CWS P, CWS R, 1 CH | — | Left/right FD master and actual A/P servo engagement, CWS or dual-channel status |

**Specific FCOM constraints encoded:**
- MCP `HDG_SEL` maps to `HDG SEL`; `ALT_HLD` maps to `ALT HOLD`; `VS` to `V/S`; `LVL_CHG` to pitch `MCP SPD`.
- When A/T is armed, V/S or ALT HOLD selection leads to A/T `MCP SPD` (FCOM 4.10.5/4.20.11). A generic `VNAV` button must **not** be painted as an active `VNAV` FMA annunciation; the actual `VNAV SPD` versus `VNAV PTH` requires FMC vertical-path evidence.
- A/T `ARM` is white and is **not** an engaged thrust-servo mode.
- `G/S` engaged requires a positive glideslope-capture observation; `VOR/LOC` engaged requires a positive course-capture observation; `ALT ACQ` requires FCC altitude acquisition evidence.
- **FLARE armed** requires dual A/P, LOC and G/S captured and RA below 1,500 ft. **FLARE engaged** requires an FCC flare-engaged event and RA 50 ft or less (FCOM 4.20.8).
- The existing MCP state machine can provide training-mode selections, but not physical capture proof. FCC-only events follow schema `B737_FMA_FCC_OBSERVATION_V1`, `confirmed:true`, seat-specific `fields` and `evidence` values.

## CWS while autopilot is CMD (FCOM 4.10.18, 4.20.9–10)

**CWS is NOT annunciated as an engaged Pitch or Roll mode.** With the autopilot
engaged in CMD, if no pitch command mode exists (or that mode is deselected),
the pitch servo axis falls back to **CWS P**. The Pitch FMA command field is
**BLANK**; the fourth **AFDS STATUS** field shows yellow `CWS P`. The
other (Roll) command may remain engaged in CMD.

Independently, when no roll command exists (or it is deselected), the roll
servo axis falls back to **CWS R**. The Roll command field is **BLANK** and
the fourth column shows yellow `CWS R`; Pitch CMD is unaffected.

If both command modes are absent, both axes are CWS. Their status displays
`CWS P` and `CWS R` on two lines in the fourth AFDS column. Neither
command field displays CWS. **CMD remains displayed GREEN** in the fourth AFDS column, and CWS P/R
annunciates YELLOW beneath it. With both axes in CWS under CMD the three
visible lines are CMD, CWS P and CWS R.
If neither autopilot is engaged, a blank command column does **not** imply
CWS (the F/D-only status is FD).

Explicit MCP CWS engage selects both CWS axes, even if pitch/roll CMD commands
had previously been selected. This behavior is implemented as per-axis
`axisControl: {pitch:'CMD'|'CWS'|'OFF', roll:'CMD'|'CWS'|'OFF'}` in MCP AFDS
output, projected by the independent FMA engine, and drawn by the EADI FMA
layer (both EIS and Conventional).

**Qualified CWS force and altitude/capture logic is now modeled by events:** FCOM says
column force can override an engaged pitch command into CWS P, and wheel
force can similarly override roll. In a dual-autopilot APP after LOC/GS
capture, manual override disengages A/P rather than engaging CWS. Qualified
FCC observation can declare a CWS force override only with evidence, not
from a blank display alone. In CWS P, ALT ACQ can capture near the MCP
altitude, followed by ALT HOLD; in CWS R, arming VOR/LOC or APP can permit
VOR/LOC capture. Transitions require `B737_AFDS_FLIGHT_OBSERVATION_V1` with `confirmed:true`
and `source:'SIMULATED_FCC'`, dispatched as `b737:afds-flight-observation`
or delivered via `B737McpAFDSBridgeV1.observeFlight(sample)`. CWS roll release
holds bank for angles above 6 degrees and levels wings/holds heading at <=6
degrees except the three FCOM conditions. CMD pitch manual ALT HOLD override
recaptures through ALT ACQ if released within 250 ft; otherwise CWS P remains
until a confirmed capture or newly selected pitch mode. APP/VOR_LOC arming
requires validated NAV evidence; LOC must capture before G/S, with confirmed
glideslope intercept at <=0.4 dot below the glidepath. FMA active, armed, and
CWS status derive from the same AFDS core; `axisDemand` publishes guidance
for a downstream flight-dynamics implementation. There is no undocumented
synthetic physical yoke-force threshold or automatic aircraft servo.

## Limitations still open before claiming full FCOM fidelity

The present Unified MCP model is a *training selection state machine*, not
an actual simulated flight-control computer or complete A/T and VNAV plant.
This implementation **does not claim to implement** the actual TO/GA
engagement envelope (including IAS/RA/time), independent FCC master transfers,
the LNAV 3-NM/intercept geometry, localizer/GS receiver dynamics, all
vertical-capture/altitude constraints, physical force-to-yoke calibration, full dual-channel
autoland transition, A/T thrust lever servo feedback, electrical loss of
individual FCCs, FMC glide/descent commands, or aircraft-specific option
effectivity.

Until those inputs and matching FCOM/LAN/MRG page evidence are integrated,
**unobserved modes/captures stay blank** rather than being inferred from a
button selection. This program is a procedure/QRH trainer, not approved flight
instrumentation.
