# Final overhead mosaic lock — owner instruction

The owner approved UPD-0012 on 2026-10-24 and explicitly ordered:
«همین رو فیکس و نهایی کن و تحت هیچ شرایطی نباید تغییر کنه»

- The overhead mosaic at `panel-mosaic-lab/all-overhead/` is FINAL and FROZEN.
- Preserve all OH-01 through OH-25 images, source pixels, dimensions, positions,
  order, crop rectangles, row registration, seams, renderer, styles and behavior.
- Do not redesign, improve, regenerate, replace, rename or move this mosaic or
  any locked image it references. Do not apply broad refactors to these files.
- The exact frozen file set and SHA-256 values are in
  `panel-mosaic-lab/all-overhead/final-lock.json`.
- Preserve that manifest, `panel-mosaic-lab/verify-final-overhead.py`, and the
  verification step in `.github/workflows/pages.yml`. Never update expected
  hashes or remove the guard to make a failing change pass.
- Future simulator work must live outside the frozen mosaic and must preserve
  the appearance and behavior of its existing public URL.
- Before publishing any repository change, run:
  `python3 panel-mosaic-lab/verify-final-overhead.py`.

Approved visual commit: `9cd1273f281f03785db4a47dfd0420f8132f677e`.


## FINAL B737 Classic Owner18 guarded-switch RED ZONE (2026-10-28)

**OWNER-ORDERED HARD FREEZE.** All 18 guarded switches are FINAL. No AI agent,
simulation engine refactor, database sync, UI restyle, layout adjustment, PNG
regeneration, guard rotation, color edit, sprite crop, source-photo mask edit,
position/scale correction, automatic code cleanup, or inferred 'fix' may change
any frozen attribute, ever, unless the owner first gives an **explicit direct
change request** and then a **separate, informed confirmation of the exact
proposed change**. An ordinary request affecting nearby systems is NOT approval.
Until both stages, stop that specific modification, keep the guards identical,
and work around their protected geometry. A failed integrity check is a BLOCK,
not permission to update the expected hash.

Frozen baseline: `730815ed6ece9beb30950b96ba536e1ce3f2c4ca`.
Canonical registry: `panel-mosaic-lab/cockpit/guard-redzone-lock.json`.
Technical engine database mirror: `engine/maps/guard-owner18-redzone-v1.json`.
Before any push, run:
`python3 panel-mosaic-lab/cockpit/verify-guard-redzone.py --negative-self-test`.
Required GitHub Action: **Owner18 RED ZONE — Immutable Guarded Switches**.
Treat changes in **all 18** switch appearance, physical dimensions, placement,
guard sprite, color, hinge, animation, interaction, default detent and behavior
as denied. Routine pilot actuation of existing switches is not an asset change.
Do not disable/bypass integrity scripts, update baselines, or erase this warning.
Repository admin must additionally protect the main branch and require the
RED ZONE status check plus CODEOWNERS review; CI alone cannot prevent pushes.

## IRS SYS DSPL LOWER SELECTOR OWNER LOCK — APPROVED AND FROZEN (2026-10-28)

The user explicitly approved and LOCKED the LOWER IRS SYS DSPL L/R selector, the
exact ivory narrow-grip selector image, detent positions, behavior, size,
placement, white L/R stencils and tick marks, original title and L-patch.
**Do not touch or re-generate this component** for any reason during upper
rotary / brightness work, frontend refactoring, simulator wiring or UI cleanup.
Do NOT edit any of the six paths frozen in
`panel-mosaic-lab/cockpit/irs-sys-dspl-owner-lock-v1.json`, or its four
approved CSS/JS mount tags in Unified index.html. New upper DSPL SEL and BRT
switch code MUST be independently additive. Not even a small pixel change is
permitted without the user's specific direct request and an independent
informed confirmation of precisely what would change.

CI fail-closed check (required before deployment):
`python3 panel-mosaic-lab/cockpit/verify-irs-sys-dspl-owner-lock-v1.py`
The manifest and verifier Git blob IDs are pinned in BOTH
`.github/workflows/pages.yml` and
`.github/workflows/irs-isdu-frontend-v1.yml`.
Do not bypass this check or rewrite owner-approved hashes.

## IRS ISDU 13-SEG DISPLAY OWNER FINAL LOCK (2026-10-28)

The owner APPROVED the current single-line 13-position illuminated IRS display
and explicitly requested it to be FINALIZED and LOCKED. This covers its 6+7
cell allocation, 4 upper point lamps and 2 lower decimal point lamps, the
filament/segment glyphs, every pixel/color/glow/brightness/font/scale/detail,
absolute position, TEST sequence, keypad display behavior and two HTML
mount tags. The COMPLETE frozen inventory and hashes are recorded in:
`panel-mosaic-lab/cockpit/irs-13seg-owner-lock-v1.json`.

**ABSOLUTELY DO NOT modify, regenerate, rename, move, resize, reskin or
reinterpret this approved visual component** through automatic code cleanup,
layout refactor, IRS backend wiring, data cycle changes, FCOM-effectivity
reconciliation, UI testing or any other inferred improvement. Any proposed
change requires a **specific direct request** from the owner and a **separate
informed approval of the exact proposed alteration**, prior to modifying
any protected file or render behavior.

Required immutable-asset gate:
`python3 panel-mosaic-lab/cockpit/verify-irs-13seg-owner-lock-v1.py --negative-self-test`.
Manifest and verifier blob hashes are PINNED separately in BOTH
`.github/workflows/pages.yml` and
`.github/workflows/irs-isdu-frontend-v1.yml`.
Do not weaken, bypass or rewrite the approved hashes to force a passing build.

**FCOM five-mode reference content** belongs in NEW, additive logic only:
`engine/contracts/irs-isdu-fcom-modes-v1.json` and
`docs/IRS_ISDU_FCOM_MODES_AND_DISPLAY_LOCK.md`.
The currently locked display is frontend-only: no real navigation outputs
are authorized or implied. Future powered/navigation-data bindings must
expose reliable validity and must not alter the exact locked front-end.
The separately locked LOWER IRS SYS DSPL L/R switch stays independently
frozen at all times.
