# B737-CLASSIC-CDU — canonical project reference

Repository: `mahmet737ng-gif/b737-classic-simulator`  
Project: **B737 Classic Simulator**  
Component: **B737 Classic — CDU/FMC**  
Short reference for future chats/agents: **`B737-CLASSIC-CDU`**.

Before developing or changing the CDU, inspect the repository's current code and relevant Chapter 11 manuals/technical database. The current integrated CDU test is in `cdu-standalone-v6/`; the separately approved physical CDU and Chapter 11 engine are under `engine/ch11/`. Legacy versions `cdu-standalone/`, `cdu-standalone-v3/`, and `cdu-standalone-v5/` are retained, not to be silently replaced or redesigned.

### Approval invariants

1. Keep the approved physical CDU image and button/hitbox positions unchanged unless the user requests alterations.
2. **Typography is locked** per [CDU_FONT_LOCK.md](CDU_FONT_LOCK.md): `BoeingCDU-Large.ttf` and `BoeingCDU-Small.ttf` for all CDU screen text.
3. Preserve independent CDU behavior, the Chapter 11 page model, current navigation and performance engine integration, and the difference between simulated estimates and AFM-certified figures.
4. Coordinate simultaneous work from different chats using the current repository tree/commit as the source of truth; do not assume a past chat's claimed completion is already published.
5. Do not change unrelated cockpit, EFIS, Android, iPad, JeppIran, or web app components implicitly.

Direct test entry point: `cdu-standalone-v6/index.html`.  
Font acceptance test: `node tests/cdu-font-lock.test.cjs`.
