# B737 Classic Circuit Breakers — integration checkpoint (2026-10-26)

## Scope and evidence status

This is an isolated CB state-and-test extension, **not a completed airplane electrical system**. The root cockpit's locked images are unchanged. The Unified top toolbar now links to the separately testable 11-panel `cb-panel-lab/`; that web lab uses a synthetic CB grid, **not the 11 original photo assets**. The original photo-based interaction remains in the user's locally generated offline HTML/ZIP until authorized image assets and final geometry are integrated.

- CB source labels: `cb-panel-lab/catalog.js` — preliminary, **not an aircraft-certified wiring chart**.
- Candidate catalogue (active): **472 CPCS** or **471 DCPCS**, 11 panels; 544 candidate keys including mutually exclusive configurations.
- Separate local photo coordinate QA: approximately **475 candidate faces**; not slot-by-slot reconciled with the catalogue. Differences at P6-2/P6-3/P18-3 and the optional P6-4 retrofit must be reconciled rather than silently accepted.
- Original grey CB hex housings remain mechanically fixed; pulled inner discs have red tint/rim.
- Electrical wiring routes verified with source manual, exact page and effectivity: **0**.
- The demo path `P6-5|ALL|A1 → SANDBOX_28V → SANDBOX_INDICATOR_NOT_AIRCRAFT` is intentionally **fictional** and demonstrative. It is NOT an inverter schematic, a real bus connection, or a flight system output.

## Phase ledger

| Stage | Deliverable committed | Verified / remaining |
| --- | --- | --- |
| 1. Visual QA | Previous red pulled-button styling in `cb-panel-lab/` and local photograph QA | Inner disk/outer hex mechanics defined. Final pixel-perfect verification for all photo images remains open; do not mark flight accurate |
| 2. Unified access | Main `index.html` toolbar link to `cb-panel-lab/index.html` | Navigation linked; complete in-place photographic Unified embedding remains **OPEN** |
| 3. Technical Database mapping | `engine/cb/wiring-manifest.v1.json` and candidate labels from catalogue | No actual bus/consumer links without individual FCOM/diagram traces; **BLOCKED** |
| 4. Electrical effect | `engine/cb/cb-kernel.js`: input-driven supply/consumer evaluation and guarded routes | Only fictional test load works. Real aircraft consumers **BLOCKED** |
| 5. Fault/CB protection | `INJECT_TRIP`, `CLEAR_FAULT`, guard preventing Push while fault active | Manual synthetic injection only; actual breaker ratings/trip curves, thermal reset and upstream protection **UNVERIFIED** |
| 6. Tests and promotion | `tests/cb-kernel.test.cjs`, `npm run test:cb`; 29 ad-hoc inline connector assertions passed | New Node test suite committed, but no successful full CI/browser evidence reported in this turn; flight model and live promotion not accepted |

## Mechanical-state contract

1. `PULL` marks breaker electrically open; the inner photographic disk extends and tints crimson.
2. `PUSH` returns to normal when no fault is active. With a synthetic fault active the command is rejected, so the UI remains visibly pulled.
3. `INJECT_TRIP` is instructor-controlled, not an autonomous amperage model.
4. `CLEAR_FAULT` clears the fault but **does not automatically push the CB**.
5. CPCS and DCPCS states are configuration-scoped and cannot affect one another's active CBs.
6. Browser restore is schema-checked. Unknown IDs and invalid snapshots are rejected.
7. Any CB with no verified aircraft bus-to-consumer route has output **UNKNOWN**, not assumed power loss.
8. No power calculation is fed into existing `sim-engine.js`, `engine/trainer/core.js`, the real annunciators, or the actual aircraft loads until validated cross-system data exists.

## Evidence required before each real electrical route is enabled

For every `P6/P18:position` entry: exact aircraft effectivity; photograph slot/label/amp; FCOM/maintenance electrical diagram revision and **page**; source/transformer/transfer bus; wire protection/backup feeds; consumer; failure annunciations; and acceptance vectors for source OFF, breaker PULL, Push, backfeed, trip and restore. A label alone is **not** wiring evidence.

## Tests

```sh
npm run test:cb
# Or include it within npm test
```

The published source is training software only, not suitable for actual navigation or operation.

## Additional offline photographic browser QA (2026-10-26)

A standalone, self-contained HTML/ZIP was built from the **eleven original user-supplied panel images** and their separate local geometry. It preserves red inner-face Pull/Push and adds a clearly labeled synthetic fault/28V indicator. Chromium Playwright `page.set_content` smoke tests on the offline HTML **passed for 11/11 panel samples** (one independently chosen CB per panel, Pull then Push; no JavaScript page errors). Synthetic fault blocks Push until cleared, and P6-4 CPCS/DCPCS alternate photo geometry isolation passed. ZIP archive integrity passed. This QA does **not** establish that every individual CB has been manually pixel-approved, nor that its electrical routing is aircraft-accurate, nor that the same photo HTML/assets were published to GitHub. The offline image package is conversation-local and intentionally not copied into the public repository.


## 2026-10-26 — Source-located CB → Electrical V7 / subsystems vertical slice

**Files committed**
- \`engine/cb/electrical-v7-integration.js\` — read-only projection against the actual \`engine/systems/electrical-v7.js\` generator/transfer/DC/standby source model.
- \`cb-panel-lab/v7-effects.js\` — interactive live CB lab with FCOM Electrical V7 bus visual feedback, circuit protection/open status and educational pump/pressure outputs.
- \`engine/cb/all-circuits-audit.v1.json\` — all **544 alternate-variant CB entries**, with individual evidence status and explicit null for missing buses.
- \`tests/cb-electrical-v7-integration.test.cjs\` — 23 integration tests; \`npm run test:cb-v7\` and \`npm test\`.
- \`.github/workflows/cb-electrical-v7.yml\` — source tests in Actions on relevant pushes.

**What the actual references support**

| CB / source | Document location | Software response | Evidence gap |
|---|---|---|---|
| P6-3 B3/B7 (fuel main forward, 2/1) | B737 Classic MRG printed p.136, Fuel Boost Pumps; original P6-3 close-up | Breaker-open forces corresponding *training pump* OFF; simplified fuel LOW PRESS logic refreshed | Exact EP-FSI electrical source bus and alternate power routing unknown |
| P6-3 C3/C7 (fuel main aft, 2/1) | MRG p.136, Fuel Boost Pumps Aft | Same as forward | Same |
| P6-3 D5/E5 (fuel center right/left) | MRG p.136, Fuel Boost Pumps Center | Breaker-open forces corresponding *training pump* OFF; center low-pressure applies only with selected switch ON | Same |
| P18-2 D12, P6-1 C2 | MRG p.135, VHF 1/2 | Reports OPEN protected circuit; equipment overall power remains UNKNOWN if alternate feed exists | Per-unit feed / redundancy / actual radio behavior |
| P18-1 A1 | MRG p.135, VOR/LOC 1 | Reports OPEN protected circuit; overall receiver state UNKNOWN | NAV receiver redundancy/feed |
| P6-12 C2, P6-11 C2 | MRG p.136 Electric Hydraulic Pumps A/B and MRG printed p.330 troubleshooting (Classic GEN BUS) | Stops corresponding electric hydraulic motor in training projection; V7 Generator Bus 2/1 loss also stops motors. Running engine-driven pump can maintain its hydraulic system; no blanket system failure | Generic Classic source association, **not reviewed EP-FSI-specific wiring/installed option** |

**V7 inputs preserved**: FCOM Electrical 6.20.1–12 (PDF pp.1150–1161) provides upstream GEN/TRANSFER/MAIN/TR/DC/battery/standby dynamics. The CB layer NEVER rewrites those FCOM-backed bus laws from CB panel labels alone. Fuel motor source assignment to V7 Transfer 1/2 remains explicitly **TRAINING SURROGATE**. Hydraulic motor source assignment to generator 2/1 is **MRG-supported generic Classic**, not owner-aircraft certification.

**Regression evidence**: 31 CB and CB↔V7 tests plus 47 existing Electrical V7 tests were executed in a JavaScript compatibility harness in this conversation and passed, covering independent Pump A/B/engine-driven supply, generator loss, crossfeed/auto-transfer, CB trip/reset, fuel warning, no inferred feeds, and CPCS/DCPCS variant isolation. That harness is not a replacement for a completed Node/GitHub Actions run nor screenshot acceptance. **No CI pass has been asserted.**

**Important outstanding work**: Owner-specific EP-FSI physical wiring manual and effectivity, 533 remaining variant-candidate equipment mappings without verified index linkage, the source-vs-photo CB occupancy mismatch, downstream real FMC/AFDS/COM/pressurization outputs, complete overcurrent trip curves, and in-place photo CB sprites in Unified. There are **zero airframe-verified CB upstream-feed paths**. Do not mark all CBs complete.


## 2026-10-26 — Next phase: Classic MRG index and photo QA gate

**Committed implementation**
- \`engine/cb/classic-mrg-index.v2.js\`: independently records 43 physical panel CB function candidates from the **Classic** MRG index pp.134–136 and catalogue-photo label, mirrored across CPCS/DCPCS for shared P6-4 CB keys (52 variant candidates). EXACT photo-label equality is checked; 48 variant candidates pass, 4 ambiguous MRG OCR positions for TR2/TR3 are quarantined.
- \`engine/cb/electrical-v7-integration.js\`: 58 variant-key functional associations including original 10 non-disputed prior mappings; **51 active source-indexed functions per CPCS/DCPCS configuration**. The one previous VHF2 claim \`P6-1 C2\` was quarantined because the same MRG page also associates HF2 with that slot.
- **Four additional source disagreements** are quarantined: \`P6-1 C2\` (HF2 vs VHF2), \`P18-1 B2\` (MRG transponder vs photo TCAS), \`P18-3 A12\` (MRG landing light positions mismatch photograph), and \`P6-3 D18\` (MRG aural warning vs photo pitot indication). Together with two TR positions in both variants: 8 quarantined variant keys. Exclusion is deterministic and covered by tests.
- \`engine/cb/all-circuits-audit.v2.json\`: full 544-key alternative-variant audit: 58 indexed, 8 quarantined, **478 still without sufficient source index match**. These are candidate counts, not numbers of physically installed CBs simultaneously.
- \`cb-panel-lab/v7-effects.js\` now displays only 51 active non-duplicated links, source QA, original Electrical V7 bus state and a separation between master caution **condition** and FUEL **lamp**.
- \`tests/cb-source-audit-v2.test.cjs\`: 9 new source QA, CPCS/DCPCS isolation, source label drift, no collateral electrical bus loss, lamp warning separation, and 102 CB Pull/Push cycles in two configurations; CI via \`npm run test:cb-audit\`.

**Meaning of effect labels**
- \`protectedCircuitPower=false\` means the specific protective circuit is open.
- \`devicePower=null\` always remains **UNKNOWN** without device-feed topology, including an opened indicator or control CB. Do not propagate it as a whole-device failure.
- Fuel pump operational feedback is a **TRAINING-SURROGATE** projection; Hydraulic A/B uses generic Classic generator bus evidence from MRG p.330 but is not EP-FSI aircraft wiring validation.
- FUEL warning condition remains TRUE after the P6-3/D10 lamp CB is opened; only \`fuelLampTraining\` is suppressed. No certified annunciator logic is claimed.
- Generator, transfer, DC, battery and standby bus calculations in Electrical V7 are not altered by an indexed CB association alone.

**Verification run in conversation**
- 40 CB/source-audit/CB-V7 test cases executed in a JavaScript-compatible Node test harness: **40 pass / 0 fail**.
- The 47 pre-existing Electrical V7 tests executed in the same compatibility harness: **47 pass / 0 fail**.
- GitHub Actions configuration now runs these tests in Node 20 on relevant changes; a verified CI completion status was **not available** at the time of this report. Screenshot-based browser QA for the expanded online lab is also pending.
- The locked cockpit artwork and original 11-panel photos were not edited or replaced by this phase.

**Critical remaining gates**
1. Airframe-specific EP-FSI WDM/ATA 24 feeder and protection tables: upstream bus, wire/pin/connector, backfeed, alternate feeds, optional equipment and effectivity review.
2. Resolve eight quarantined variant keys by inspecting the MRG image and original panel photograph. Do not make irreversible assumptions from OCR.
3. Reconcile 544 catalogue candidate keys with individual photographic face coordinates (previous approx. 475 across the two options).
4. Route individually validated equipment loads to real downstream system engines (CPCS, DCPCS, FMC, AFDS, anti-ice, fuel, hydraulics, radios) with failures, regressions and owner acceptance. Until then, indexed associations are read-only effects / training overlays, not a certified shared electrical graph.
