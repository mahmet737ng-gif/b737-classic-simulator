# Flight Controls — guarded switches and horizontal navigation selectors
Source: user-provided Sepehran B737 Classic FCOM. No source manual text is reproduced.

| Control | Detents | Covered state | Reference |
|---|---|---|---|
| Flight Control A | STBY RUD / OFF / ON | ON | FCOM 9.10.1 |
| Flight Control B | STBY RUD / OFF / ON | ON | FCOM 9.10.1 |
| Spoiler A | OFF / ON | ON | FCOM 9.10.2 |
| Spoiler B | OFF / ON | ON | FCOM 9.10.2 |
| Alternate Flaps Master | OFF / ARM | OFF | FCOM 9.10.2–3 |

FCOM establishes the protected switch detent. Guard-driven physical repositioning is a simulator inference, not independently verified hardware action.

| Control | Left | Center | Right | FCOM |
|---|---|---|---|---|
| VHF NAV | BOTH ON 1 | NORMAL | BOTH ON 2 | 11.10.25–26 |
| IRS | BOTH ON L | NORMAL | BOTH ON R | 10.40.13 |
| EFI | BOTH ON 1 | NORMAL | BOTH ON 2 | 10.40.13 |

Alternate Flaps Position: UP/OFF/DOWN; DOWN alone is explicitly spring-loaded to OFF (9.10.3).
Only these five guarded controls have close policies. No force-ARM rule is assigned without a matching FCOM entry.

Implementation: flight-controls-panel/fcom-controls-registry.json, fcom-control-mechanics.js, flight-controls.js, flight-controls.css, index.html.
QA: tests/fcom-guard-control.test.cjs. Top-hinge mechanism needs native-image alignment and aircraft-variant photo confirmation.
Approved shared toggle assets remain unchanged. Horizontal controls use new independent geometry, not rotated vertical image sprites.
