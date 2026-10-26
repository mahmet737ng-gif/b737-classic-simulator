# Owner-driven hinge direction quiz — Boeing 737 Classic

The canonical, durable answer file is [`engine/maps/guarded-switch-owner-hinge-quiz-v1.json`](../engine/maps/guarded-switch-owner-hinge-quiz-v1.json).
Exactly 17 flight-deck guarded/protected controls are listed; the aft cabin attendant guard is excluded from the flight-deck quiz.

## Owner answer meanings (NOT text from FCOM)

| Answer | Hinge axis/side | Opening action |
|---|---|---|
| **Up** | Hinge on top edge | Take bottom/free edge and open it UP |
| **Down** | Hinge on bottom edge | Take top/free edge and open it DOWN |
| **Left** | Hinge on left edge | Take right/free edge and open it LEFT |
| **Right** | Hinge on right edge | Take left/free edge and open it RIGHT |

The answer defines where the *physical guard cover's hinge* sits, **not** the direction of the toggle/lever or its detent labels. Switch mechanical detents and FCOM protected positions remain separately sourced in [Phase 1/2 registry](../engine/maps/guarded-switches-fcom-visual-audit-v1.json).

## Chat quiz persistence protocol

An interactive choice sends a new user conversation turn, asking the assistant to persist the *single selected control* by its stable `controlId` and exact `Up|Down|Left|Right` direction. **The local UI itself cannot write the GitHub repository directly.** The assistant must make the GitHub `fetch_file` then `update_file` call and confirm actual commit SHA before saying the choice is saved.

Update only the matching question:
- `selection`: exact enum
- `answerStatus`: `OWNER_QUIZ_CONFIRMED`
- `answerSource`: `OWNER_CHAT_QUIZ`
- `reviewedAt`: ISO timestamp (when available, exact)
- recompute `summary.ownerConfirmed`, `summary.unanswered`

Respect previous explicit owner confirmation that **FLIGHT RECORDER** is `Left`; already seeded in the JSON file, but the owner can change it via quiz.

Every answer is **replaceable** by the owner by selecting a different option: never keep stale previous answer. Never guess an unanswered direction from historical assets, FCOM position names, adjacent guards or present UI.

Verify `node --test tests/guarded-hinge-owner-quiz.test.cjs` and `python3 panel-mosaic-lab/verify-final-overhead.py`; GitHub Action `Flight controls FCOM guard and selector checks` runs them on change.

## New asset design policy
- **Do NOT use** old red/black generic `Red_Guarded_*.png` / `Black_Guarded_*.png` as the source of the replacement. Keep old files untouched for audit/frozen preservation.
- One geometry per control, individual source pixel socket and independent guard cover / underlying toggle / fixed hinge and pivot.
- Guard closed and open share **identical physical shape/dimensions**; opening changes pose, orientation and perspective projection, **never bitmap stretch or rescaling**.
- Model true latch/stop, clickable/open hitbox, switch detent gating, and lever independently.
- Original locked overhead images and public frozen mosaic are immutable per root `AGENTS.md`.
- For the 5 currently absent guards (BUS TRANSFER, ANTISKID, GPWS FLAP, GEAR, TERRAIN), mounting location must be calibrated before adding overlays. Terrain equipment applicability must be verified for the selected Classic variant.
- Until all 17 answers and reference-socket dimensions are known, no hardware authenticity certification and no final bulk replacement of cockpit guards.
