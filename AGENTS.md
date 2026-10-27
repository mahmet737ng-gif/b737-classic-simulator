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
