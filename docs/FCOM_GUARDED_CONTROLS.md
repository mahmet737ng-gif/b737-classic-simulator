> **FINAL RED ZONE 2026-10-28:** All 18 physical guarded controls are owner locked to `730815ed6ece9beb30950b96ba536e1ce3f2c4ca`. The authoritative runtime/technical database snapshot is [guard-owner18-redzone-v1.json](../engine/maps/guard-owner18-redzone-v1.json). The historical six-control draft below is not an authorization to revise owner-approved visuals, geometry, images or close behavior.

> **2026-10-26 coverage note:** This file is a focused six-control flight-controls registry, **not a complete 737 Classic guarded-switch inventory**. The full 17-control cockpit audit (12 currently mounted / 5 missing) is in [Phases 1–2 audit](GUARDED_SWITCH_PHASE1_PHASE2_AUDIT_2026-10-26.md) and [structured JSON](../engine/maps/guarded-switches-fcom-visual-audit-v1.json). Top hinges here are **unverified mechanical assertions** and conflict with currently installed bottom-hinge assets; do not label them photographically certified.

# Flight Controls — guarded switches and horizontal navigation selectors
Source: user-provided Sepehran B737 Classic FCOM. No source manual text is reproduced.

| Control | Detents | Covered state | Reference |
|---|---|---|---|
| Flight Control A | STBY RUD / OFF / ON | ON | FCOM 9.10.1 |
| Flight Control B | STBY RUD / OFF / ON | ON | FCOM 9.10.1 |
| Spoiler A | OFF / ON | ON | FCOM 9.10.2 |
| Spoiler B | OFF / ON | ON | FCOM 9.10.2 |
| Alternate Flaps Master | OFF / ARM | OFF | FCOM 9.10.2–3 |
| Emergency Exit Lights | OFF / ARMED / ON | ARMED | FCOM 1.30.9 and 1.40.5 |

FCOM establishes the protected switch detent. Guard-driven physical repositioning is a simulator inference, not independently verified hardware action.

| Control | Left | Center | Right | FCOM |
|---|---|---|---|---|
| VHF NAV | BOTH ON 1 | NORMAL | BOTH ON 2 | 11.10.25–26 |
| IRS | BOTH ON L | NORMAL | BOTH ON R | 10.40.13 |
| EFI | BOTH ON 1 | NORMAL | BOTH ON 2 | 10.40.13 |

Alternate Flaps Position: UP/OFF/DOWN; DOWN alone is explicitly spring-loaded to OFF (9.10.3).
These six controls have source-linked close policies: ON (four), OFF (one), ARMED (one). Emergency Exit Lights has data and logic only; its overhead-panel graphics have not yet been placed.

Implementation: flight-controls-panel/fcom-controls-registry.json, fcom-control-mechanics.js, flight-controls.js, flight-controls.css, index.html.
QA: tests/fcom-guard-control.test.cjs. Top-hinge mechanism needs native-image alignment and aircraft-variant photo confirmation.
Approved shared toggle assets remain unchanged. Horizontal controls use new independent geometry, not rotated vertical image sprites.
