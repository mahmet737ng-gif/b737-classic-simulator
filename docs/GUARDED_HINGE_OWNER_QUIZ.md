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

## Chat quiz persistence protocol — single Finish button

The 17 questions are displayed together with four directions. Selecting an option changes **local quiz state only**, and does not call GitHub. **Finish is enabled only after all 17 questions have an answer.** One explicit Finish submits a single complete payload with every `controlId` and exact `Up|Down|Left|Right` to the conversation.

The assistant must then read the latest `engine/maps/guarded-switch-owner-hinge-quiz-v1.json`, merge and validate all 17 answers, and update that one file in **ONE GitHub commit**. Update each question's `selection`, `answerStatus=OWNER_QUIZ_CONFIRMED`, `answerSource=OWNER_CHAT_BULK_QUIZ`, `reviewedAt` and recompute `summary.ownerConfirmed`, `summary.unanswered`. Report success **only after a real commit exists** and CI is checked. Do not save per answer during quiz interaction. Edits in the same quiz are allowed before Finish.

Previously established owner answers may be preselected (e.g., FLIGHT RECORDER=Left, and the user recently chose FLT CONTROL A=Up). The latter selection was not yet committed; present it as an in-form draft until Finish. The user can override either selection.

## New asset design policy
- **Do NOT use** old red/black generic `Red_Guarded_*.png` / `Black_Guarded_*.png` as the source of the replacement. Keep old files untouched for audit/frozen preservation.
- One geometry per control, individual source pixel socket and independent guard cover / underlying toggle / fixed hinge and pivot.
- Guard closed and open share **identical physical shape/dimensions**; opening changes pose, orientation and perspective projection, **never bitmap stretch or rescaling**.
- Model true latch/stop, clickable/open hitbox, switch detent gating, and lever independently.
- Original locked overhead images and public frozen mosaic are immutable per root `AGENTS.md`.
- For the 5 currently absent guards (BUS TRANSFER, ANTISKID, GPWS FLAP, GEAR, TERRAIN), mounting location must be calibrated before adding overlays. Terrain equipment applicability must be verified for the selected Classic variant.
- Until all 17 answers and reference-socket dimensions are known, no hardware authenticity certification and no final bulk replacement of cockpit guards.
