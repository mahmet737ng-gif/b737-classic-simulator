# Technical Network V2 — execution slice, 2026-10-23

The owner requested a six-stage source-linked Cockpit / Fault / Checklist network across the full private Technical Database. V2 is a **partial working implementation**, not an assertion that 5,067 pages are converted to validated aircraft circuits.

Private canonical data: `/Technical Database/Technical-Network-V2/B737_TECHNICAL_NETWORK_V2.sqlite` (proprietary sources and source-indexed candidates are not public).

- Stage 1: retained 8 source corpora, 5,067 pages and 33,767 passage segments; newly indexed 3,553 equipment-name occurrences, 1,959 distinct strings. These are **lexical candidates, not independent hardware components**. 65 prior non-topic graph nodes retained.
- Stage 2: retained 104 previously source-linked ports and 56 curated functional edges. Added 16 adapter mapping contracts, with explicit live/surrogate/blocked labels. No claim of complete electrical wiring, pinout or model-specific hardware effectivity.
- Stage 3: generic [three-valued rule interpreter](../engine/trainer/source-rule-evaluator.js) supports boolean predicates, qualified holds and threshold crossings; unavailable data remains unknown and non-executable rules remain blocked. 43 original rules retained privately (39 condition expressions, 4 disabled).
- Stage 4: standalone [systems-integration-lab](../systems-integration-lab/) wires 21 training cockpit control IDs to the existing deterministic system core. **Locked root cockpit imagery, panels and original app are unchanged; mapping to image hotspots is not done.**
- Stage 5: Instructor fault dispatch for 14 fault IDs, derived electrical/fuel/hydraulic signals, current [audio warning engine](../audio/warning-engine.js) events for fire/cabin/stall-simulation, educational QRH BUS OFF branch/recovery and simulated pressurization/Stall test. The precise Stall AoA law and original audio playback remain absent; classroom networking is deferred.
- Stage 6: 26 private SQLite integrity/traceability tests, 40 JavaScript integration/rule tests; browser visual QA remains open. Deployment uses normal GitHub Pages CI gate.

FCOM source locations: Electrical 6.10.8–9 and 6.20.1–4; Fuel 12.10.2–3; Hydraulic 13.10.1; DCPCS 2.40.4/7/9; Stall 15.10.3/15.20.7; warning FCOM 15.20; QRH BUS OFF 6.1–6.4 (steps are an original **educational abstraction**, not a replacement QRH).

No actual avionics hardware wiring, serial specific part number inventory, or certified QRH logic is claimed. Priority for next implementation: verify equipment-to-bus mappings, source all remaining alarm conditions, connect source-linked states to original photo hotspots without changing art, load original phrase audio segments, and add state-aware QRH branches.