# B737 Classic ISN — durable acceptance and next-step register

This register is for future chats and developers. Distinguish user approval of a working **training preview** from source/wiring validation, integration into the approved cockpit, and publication. Never silently promote one status to another.

## 2026-10-24 checkpoint

| ID | Scope | Status | Evidence / outstanding gate |
| --- | --- | --- | --- |
| ISN-00 | Variant-selectable aircraft profile (737-300/500 or 737-400; CPCS/DCPCS; EIS/Conventional) | `LOCAL_TESTED_UNPUBLISHED` | Local commit `8b2d2fa`; 8 profile combinations and existing CPCS/DCPCS model session tests; visual variant skins not yet available |
| ISN-01A | Electrical V7 → Loads V8 → 6 fuel + 2 hydraulic electric pumps + WarningEngine | `TRAINING_ENGINE_TESTED` | Local commit `1274759`; test `tests/isn-electrical-pack-v1.test.cjs`; source-gated UNKNOWN and explicitly labeled educational surrogate modes |
| ISN-01B | Portable single-file preview of ISN-01A | **`USER_ACCEPTED_TRAINING_PREVIEW`** | Local commit `fb550b4`; `isn-electrical-pack-lab/standalone.html`; user response on 2026-10-24: «اوکیه اینو ثبتش کن» |
| ISN-01C | Final aircraft LRU-to-electrical-bus proof (8 pumps) | `BLOCKED_SOURCE_EVIDENCE` | Specific electrical load analysis/WDM and effectivity/review needed; no verified feeder claimed |
| ISN-01D | Published online Unified with this lab and variant selector | `NOT_PUBLISHED` | Separate explicit authorization for push to public default `main` and automatic GitHub Pages update is required |
| ISN-02A | Live eight-pump controls, electrical selectors and lamp projection in Unified test layer | `LOCAL_TESTED_UNPUBLISHED` | Registry-based adapter `engine/integration/isn-cockpit-bridge-v1.js`; iframe bridge + inspector outside frozen mosaic; `tests/isn-cockpit-bridge-v1.test.cjs` passes |
| ISN-02B | Installation-specific eight-pump feed proof, native BUS TRANSFER hardware, complete visual acceptance | `BLOCKED_SOURCE_AND_OWNER_QA` | BUS TRANSFER physical control absent; pump feeders unverified; local automated checks pass but manual browser/iPad validation and owner acceptance are pending |

## Next planned work — ISN-02: live cockpit input/output bridge

**Status: `LOCAL_TESTED_UNPUBLISHED` (initial live bridge).** Scope is the **existing 737 Classic cockpit**, not flight dynamics and not an EP-FSI-only model.

1. Inventory stable control IDs for fuel pump switches, hydraulic electric pump switches, generator disconnect/source selections and BUS TRANSFER on the existing interactive overhead. Resolve position/detent ↔ typed command mappings from the actual registries.
2. Build a reversible parent/child command adapter outside the frozen `panel-mosaic-lab/all-overhead/` files. The locked OH01–OH25 pixels, geometry, renderer and guard must not change.
3. Connect the eight pump output states and Electrical V7 source states to the corresponding tested lamp IDs/annunciator instances, not to approximate coordinates. Preserve all existing lamp-test and visual-test behaviors.
4. Use `SOURCE_GATED` by default; independently label instructor/surrogate inputs. Avoid implicit OFF for UNKNOWN or creating aural alerts without documented conditions.
5. Add a single trace from cockpit action → electrical source → pump state → light/warning, with read-only event inspection and deterministic replay.
6. Automated acceptance: click/pump toggles, loss of GEN1 and crossfeed, BUS TRANSFER isolation, restore, pump failure, light-test isolation, variant profile changes, mobile pointer interaction; no locked-asset diffs.

### 2026-10-24 ISN-02 implementation notes

- Identified **eight real existing pump switch IDs** and eight corresponding mounted LOW PRESSURE light IDs without new coordinates. TrainerCore supplies the *naming* `ELEC 2 / SYS A` ↔ `hyd.electricPumpA` and `ELEC 1 / SYS B` ↔ `hyd.electricPumpB`; neither assigns an aircraft power bus.
- Mapped battery-master, standby-power, generator disconnect guards, GEN1/GEN2, APU GEN L/R and ground-power selector detents to typed Electrical V7 commands. The momentary NEUTRAL detent does not erase a previous bus-source selection.
- The existing **BUS TRANSFER switch has no stable registered mounted control**. Expose `busTransferAuto` only as a conspicuously labeled instructor/training checkbox; do not pretend to have found or mounted a switch. The fuel crossfeed knob is unrelated to the electrical bus transfer.
- A dedicated `isn-cockpit.js` Unified inspector displays eight pump states, individual feeder-evidence labels, source buses, actual mounted lamp projections, warnings, instructor fault/power tests and deterministic event replay. All bridge components remain outside the frozen atlas.
- Known tri-state projections are applied to mounted lamps after the legacy renderer, with genuine lamp/visual tests taking precedence; panel power still gates the visual face. A `null` pump output remains explicitly UNKNOWN; for these unresolved values the old trainer's lamp face is retained but is **not claimed** as ISN-verified output.
- Only source-described electrical lamps and supported discrete pump LOW PRESSURE / hydraulic overheat are projected. FUEL Master Caution remains a **candidate** in the inspector, HYD Master Caution remains UNKNOWN and no fuel/hyd aural alert is fabricated.
- Node regression covers exact registry IDs, direction of hydraulic labels, null preservation, GEN1 failure, automatic crossfeed, instructor BUS TRANSFER isolation, source restoration, physical GEN selector spring return, observed power, faults, warnings and deterministic replay. A sandboxed iframe-transport test verifies actual existing light faces, panel-power gating, UNKNOWN restoration and Lamp Test precedence; the frozen artwork guard also passes. **No end-to-end browser/iPad visual test yet; publication and owner approval remain pending.**

**Exit criterion:** all identified Pack 01 switches and lamps exchange typed signals correctly in the Unified test layer without modifying approved artwork; missing IDs or source rules remain explicit QA gaps. The initial code/Node validation meets this only for the tested layer; owner browser acceptance and source-specific wiring verification remain distinct gates.

## Later work

- **ISN-03:** Engine/APU start and generation source contracts → Electrical/Pneumatics/Fuel/Warnings (only source-backed, no flight-dynamics expansion).
- **ISN-04:** Extend the same ports/rules/trace acceptance pattern through the remaining B737 Classic systems.
- **Wiring promotion gate:** the eight pump feed mappings remain UNKNOWN until independently reviewed installation-specific evidence exists. Educational acceptance does not unblock this gate.
