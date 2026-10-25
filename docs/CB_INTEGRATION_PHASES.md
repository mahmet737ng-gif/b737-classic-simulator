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
