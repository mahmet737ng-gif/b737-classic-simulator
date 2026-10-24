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

## 2026-10-24 — later ISN-03 Stage 1 checkpoint

- ISN-02 was published to public `main` at `ded38dffd81a89b43f35786b10785c64fead1690`; GitHub Pages deployment run `40121059889` succeeded. Owner browser/iPad manual QA and pump feeder documentation are still separate gates; this supersedes the earlier ISN-02 `LOCAL_TESTED_UNPUBLISHED` status **for publication only**.
- **ISN-03 Stage 1:** `LOCAL_IMPLEMENTED_AND_NODE_TESTED` in `engine/integration/isn-engine-apu-v1.js`, with typed manifest `engine/integration/isn-engine-apu-contracts-v1.json` and new replay/fault/source-gate regression. It links *observed* Engine 1/2/APU running states to existing Electrical V7 / ISN-01 / Pneumatics V6 and exposes traceable source-derived effects. It deliberately refuses to synthesize a running source from START intent, to infer engine fuel supply, to invent physical electrical pump feeders, or to enable ISN-01 training-surrogate mode. See `docs/ISN_ENGINE_APU_V1.md`.
- ISN-03 Stage 1 is **not published or installed in Unified**. Remaining ISN-03 stages: source-ledger review of starter/ignition/N2/EGT/real shutdown inputs; cockpit control binding outside the frozen atlas; independent browser/iPad acceptance and explicitly authorized publication.

## ISN-03 Stage 2 — observed startup feedback checkpoint

- `LOCAL_IMPLEMENTED_AND_TESTED_SOURCE_LIMITS_BLOCKED`: `engine/integration/isn-start-sequence-v1.js` and `engine/integration/isn-start-sequence-contracts-v1.json` introduce independently observed Engine 1/2 Starter, Ignition, Fuel Start Lever, N2, EGT; APU Starter, RPM and EGT; request/confirmed-running separation; deterministic replay and source/phase trace. `isn-start-sequence-lab/` is a standalone browser lab, **not a live Unified installation**.
- FCOM Engine/APU start/shutdown source pages were **not available locally**. Therefore actual automatic start/ignition/starter cutout/N2/EGT/hot-or-hung-start logic is source-blocked; measured values are stored but cannot autonomously promote `running=true`. Existing source-located Electrical/Pneumatics interfaces and the no-guessed-links policy remain intact. See `docs/ISN_START_SEQUENCE_V1.md`.

### ISN-03 Stage 2 follow-on — owner-supplied FCOM source recovered

- **Supersedes the missing-FCOM claim above (historical checkpoint retained).** The owner supplied `SEPEHRAN AIRLINES 737CL FCOM` (1937-page PDF). Source audit completed for Engine start controls 7.10.22/25, engine start and ignition 7.20.7–9, APU 7.30.2–3, and Normal Procedures NP.21.33–35. See source ledger in `engine/integration/isn-start-sequence-contracts-v1.json`.
- Source-backed *discrete training projections* are now executable in `engine/integration/isn-start-sequence-v1.js`: GRD/battery bus and observed start-air contracts; igniter left/right eligibility; lever IDLE recommendation at N2 25% or max motoring >=20% with N1 rotation; approximate 46% N2 switch cutout; independent latched EGT 725°C advisory; APU start handle/battery/door gating; OFF removes selected APU GEN and closes APU BLEED. None of these computes engine or APU running, dynamic EGT, physical valve movement or undocumented pump feeders.
- Local checks `tests/isn-start-sequence-v1.test.cjs` and `tests/isn-start-fcom-rules-v1.test.cjs` pass; standalone lab exposes the new controls and projections. **Not yet committed to remote, published, or integrated into the locked Unified.** APU-ready RPM, start acceleration/timer law, N2/OAT EGT limit formula and installation-specific LRU wiring remain unresolved. Updated engineering note: `docs/ISN_START_SEQUENCE_V1.md`.

### ISN-03 Unified training integration — APU → Engine start

- Subsequent local integration links the exact existing `apu-start`, `apu-gen-1/2`, `bleed-apu`, `pack-l/r`, `isolation-valve`, `ignition-source`, `engine-start-1/2` controls into one **shared** Stage 1/Stage 2 Pack model with existing ISN-02 bus/pump/annunciator bridge. When APU becomes training-ready, GEN selection and BLEED remain separate operator switch actions.
- A dedicated `TRAINING_SEQUENCE_SIMULATED` provenance was added for the *explicitly synthetic* short instructional timing checkpoints: APU inlet door and ready, engine N2 25% lever cue and approximate 46% cutout. These are **not external sensors or aircraft performance predictions**. `SOURCE_OBSERVATION` still records true running with that distinguishable origin; FCOM sourced discrete prerequisites are tested before accepting engine GRD.
- The dynamic projector updates existing overhead APU GEN OFF BUS / APU LOW OIL PRESSURE and mounted center-panel START VALVE OPEN indication slots without moving or editing any locked image or `all-overhead/` file. The engine start rotary automatically returns OFF through the existing interactive controller at trainer cutout.
- Main inspector gains an independent engine 1 / engine 2 fuel start-lever IDLE/CUTOFF test interface because the referenced white pedestal levers are not yet registered as movable UI controls. This is a temporary control **not** a phantom physical lever overlay.
- Tests: `tests/isn-apu-start-chain-v1.test.cjs`, both prior Stage 2 tests, existing ISN-02 bridge/lamp transport and final-overhead hash guard. Browser/iPad manual acceptance and external publication are separate gates.
