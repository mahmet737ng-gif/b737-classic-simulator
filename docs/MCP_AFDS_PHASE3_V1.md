# MCP / AFDS Phase 3 — Electrical and Mode-State Integration, Slice 1

**Date:** 2026-10-26  
**Status:** Source-gated software integration, *not* complete 737 Classic AFDS or verified aircraft wiring.  
**UI target:** Unified cockpit `panel-mosaic-lab/cockpit/` and standalone `panel-mosaic-lab/mcp-panel/`.

## Completed

- Connects the existing **Electrical V7 evaluated snapshot** through the existing `B737ISNCockpitV1.getState().state.electrical` provider to a new deterministic MCP/AFDS mode state core.
- Preserves TRUE/FALSE/UNKNOWN. Presence of 115VAC on any bus never automatically proves that the actual MCP is powered. A trainer/instructor must explicitly confirm **observed MCP power** to enable demo annunciations. Only complete proven loss of *all plausible AC and DC sources* forces MCP OFF. Partial/conflicting bus evidence stays UNKNOWN.
- Gates display segments and all 14 lamps through the same power status. Visual Lamp Test remains a separate expressly requested test override.
- A/T ARM and captain/first-officer F/D switch positions can change with power absent, but do not imply powered avionics.
- Operator commands for HEADING, LVL CHG, ALT HLD, V/S, autopilot CMD/CWS buttons and N1/SPEED become requests against a shared mode state, not independent graphic lamp toggles.
- Enforces one active lateral selection, one vertical selection and one auto-throttle thrust mode in this training slice; N1 and SPEED require A/T ARM, and FD-dependent mode requests require a selected F/D.
- LNAV/VNAV require independently supplied route-ready evidence. APP and VOR LOC do not claim a LOC/GS capture. Unsupported C/O, SPD INTV and ALT INTV switches do not remain falsely latched.
- Produces `b737:mcp-afds-state` snapshots and accepts training inputs through `B737McpAFDSBridgeV1`. Both pages expose a clearly labeled observed-power demonstration control; no wiring conclusions are implied.

## Files

- `engine/afds/mcp-mode-core-v1.js`: pure deterministic state transitions, guarded modes, explicit electrical provenance.
- `panel-mosaic-lab/cockpit/mcp-afds-bridge-v1.js`: live Electrical V7 source reader; projects output to hardware/visual controls.
- `panel-mosaic-lab/cockpit/mcp-afds-bridge-v1.css`: status and training-power evidence UI.
- `panel-mosaic-lab/cockpit/mcp-visual-v3.js`: true/false/unknown power projection and computed lamp set.
- `panel-mosaic-lab/cockpit/mcp-hardware-v1.js`: existing controls emit physical events; no photographs mutated.
- `panel-mosaic-lab/cockpit/mcp-afds-bridge-v1.test.cjs`: core state transitions, Electrical V7 integration and regression checks.
- `.github/workflows/mcp-visual-qa.yml`: runs tests and the frozen overhead lock check.

## Manual test protocol

1. Open Unified; verify MCP status reads **UNKNOWN** if the actual MCP feeder has no confirmed observation. Bright bus indications alone must not turn ON MCP readouts.
2. Confirm observed power explicitly in the training status panel. Displays illuminate. Turn on F/D captain or first officer.
3. Select HDG SEL, then try LNAV without FMC route evidence; HDG SEL must not be replaced. Supply route evidence through the bridge API to conduct the *training* LNAV mode exclusion check.
4. Select LVL CHG and then ALT HLD/V/S: exactly one training vertical mode lamp may remain active.
5. ARM A/T, select N1 and SPEED: SPEED replaces N1. Turn ARM OFF: the thrust-mode lamp goes dark.
6. Observe APP request without capture evidence: it must not indicate successful capture.
7. Confirm a simulated complete loss of global AC and DC sources from the Electrical V7 state: displays and annunciators go dark and selected modes are cleared. Recovering sources alone cannot prove an MCP feeder.

## Explicitly NOT complete

- MCP CB/relay-to-bus topology and voltage class for the specific airframe.
- AFDS servo/actuator dynamics, flight director command bars, yaw damper coupling, flight-mode annunciator (FMA), autoland and dual-channel engagement conditions.
- Source-specific VNAV/LNAV route/path and speed/altitude intervention laws.
- Actual APP/LOC/GS capture transitions, A/T N1 thrust control and IAS/MACH changeover rules.
- A full flight test or final pixel-level browser acceptance; automated tests verify software-level contracts, not measured on-screen accuracy.

These require detailed manual references, validated subsystem signal owners, and simulator flight-observation tests. **No photos, frozen overhead files, or their manifest were changed by this phase.**
