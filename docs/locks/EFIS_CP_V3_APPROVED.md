# EFIS CP v3 — OWNER ACCEPTED · DO NOT CHANGE

**Status:** `OWNER_APPROVED / FROZEN / REUSE_REFERENCE`  
**Approval date:** 2026-10-23  
**Reference branch:** `locked/efis-cp-v3-owner-approved`  
**Exact reference commit:** `4b55a92843ca69345f6621fbf304794a34b8c94d`  
**Reference test:** `cdu-standalone-v6/efis-test/index.html`  
**Canonical artwork coordinates:** `1448 × 1086 px`  

## Owner acceptance
The owner explicitly accepted the v3 EFIS CP image, knob/button pixel alignment, segmented rotary animation and current interactions as final and requested that they remain unchanged. Do **not** modify, refactor, recalibrate, replace, restyle, optimize, or migrate the **existing v3** asset, controls, coordinates, interactions, visual layering, animation, test page, and image package without explicit approval.

This is a **product/asset lock and workflow policy**, not a claim of certified real-aircraft avionics. GitHub repository branch protection is not asserted; the exact commit SHA is the unchanging reference.

## Freeze scope
The following are the exact files accepted by the owner. Their verified Git blob SHA-1 values match both the approved commit and `main` at lock time:

| File, under `cdu-standalone-v6/efis-test/` | Approved Git blob SHA |
| --- | --- |
| `index.html` | `5b7b241fafd6fa84197622f5700abd6b437b7901` |
| `app.js` | `a0fea4f3ade411bfc88e1707e798119386b35526` |
| `style.css` | `b1268d0a20980b15fa54bca51443498e4adb4310` |
| `images.js` | `0bac0b5c3a2f3a7b25a154b2fbfc1ea9da937944` |
| `geometry-v3.json` | `e5c5861cde257707989fd1f9d5729098bb079d4c` |

### Immutable behavior contract
1. **The approved orthographic photo remains the base.** Only an independently alpha-masked sprite of the actual knob turns. Never rotate the panel, legend, bezel, surrounding pixels or hotspot wrapper with the sprite.
2. **Pixel-center calibration and pushbutton rectangles remain unchanged**, with values recorded in `geometry-v3.json`. All controls scale proportionally from native `1448×1086`.
3. **HSI MODE** is seven discrete physical selections, first `FULL_NAV`, final `PLAN`, in exact sequence:
   `FULL_NAV → FULL_VOR_ILS → EXP_NAV → EXP_VOR_ILS → MAP → CTR_MAP → PLAN`.
4. **RANGE** selectable steps: `10 / 20 / 40 / 80 / 160 / 320 NM`.
5. **DH REF** defaults `200`, minimum `-20`, maximum `999`, increment `1` per input step.
6. **ADI BRT**, **HSI BRT outer** and **WXR BRT inner** remain independently operable. The coaxial WXR inner control cannot drag or turn the outer HSI ring.
7. Physical rotary interaction: click / Shift+click reverse / wheel / pointer drag or touch swipe / keyboard arrow keys, with one detent at a time for discrete selectors, soft short rotation and no unnecessary background movement.
8. RST remains momentary; WXR, VOR/ADF, NAV AID, ARPT, RTE DATA and WPT retain their existing clickable, visibly latched behavior.
9. The 7 dark pushbutton clickable regions match their physical dark faces; labels and neighboring surfaces are excluded from clicks.
10. The v3 layout, its training diagnostics, and the approved asset source remain available for later comparison.

## Rules for downstream developers, other chats, and AI agents
- **Read this lock first.** Treat the approved v3 as the canonical reference whenever building future B737 Classic EFIS CP features or reusable switch/knob animation infrastructure.
- Reuse the **interaction pattern and state-machine logic**, not this exact panel graphic or geometry, on other Boeing cockpit switches unless their source photo has been separately calibrated.
- For any improvements or variant experiments, **create new versioned paths or branches**, preserving v3 byte-for-byte. Never silently change v3.
- Before any feature release affecting EFIS CP, compare the five Git blob SHAs to the approved values above and stop/revert if any differ without owner permission.
- Do not change the root cockpit, CDU trainer, or the approved EFIS reference merely because a new version exists.
- **Unlock** only on explicit owner approval after visual and input QA.

## Recovery
The approved reference is pinned at:
`https://github.com/mahmet737ng-gif/b737-classic-simulator/tree/4b55a92843ca69345f6621fbf304794a34b8c94d/cdu-standalone-v6/efis-test`

The snapshot branch is:
`https://github.com/mahmet737ng-gif/b737-classic-simulator/tree/locked/efis-cp-v3-owner-approved`

Do not confuse owner acceptance of interaction/visual alignment with FCOM validation of navigation outputs; simulator training use only.
