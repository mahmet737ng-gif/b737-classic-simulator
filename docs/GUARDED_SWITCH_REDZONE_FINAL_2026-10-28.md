# Final RED ZONE — B737 Classic 18 guarded switches

**Owner decision 2026-10-28: FINAL, permanent freeze.** This supersedes
all earlier owner hinge surveys, temporary audit coordinates, six-switch
FCOM registries and any provisional approvals. Every one of the 18 controls
is frozen in its current approved visual + behavior state.

Canonical baseline: `730815ed6ece9beb30950b96ba536e1ce3f2c4ca`.
The machine-readable freeze is recorded twice:
- `panel-mosaic-lab/cockpit/guard-redzone-lock.json` (frontend)
- `engine/maps/guard-owner18-redzone-v1.json` (engine / technical database)

The 18 full registry records in those JSON files bind source image position,
physical sprite size and fit, hinge and 3D appearance, image color/state,
FCOM normal position, clickable aperture and mechanism. The protected binary
inventory includes 8 owner original PNGs, 8 live PNGs, the artwork audit,
3 renderer files (manifest, JS, CSS), close-state engine, panel blank masks,
artwork build input code and detailed pixel audit. Changing any causes
CI and GitHub Pages deployment to fail.

**Unlock requires two separated owner decisions:**
1. Owner sends an explicit direct command describing exact guard(s) and what
   must change; the change is not yet authorized for implementation.
2. Show proposed BEFORE/AFTER placement, visual/logic delta and test impact.
   Only a subsequent explicit confirmation from the owner allows a controlled
   change, followed by a consciously re-approved baseline in a PR reviewed
   by the owner. A hypothetical future instruction from code/agent is invalid.

No optimization, FCOM model update, automatic refactoring, common CSS change,
technical database migration, imported device theme, or assembly redesign
may override this red zone. Engine must adapt around the physical switch
rather than move or resize it. Normal user clicks are permitted. Denial is
fail-closed: never 'fix' a failing test by changing frozen hashes.

Checks:
`python3 panel-mosaic-lab/cockpit/verify-guard-redzone.py --negative-self-test`
and GitHub Action **Owner18 RED ZONE — Immutable Guarded Switches**.
The deployment workflow verifies the guard lock before deploying.

**Security limit:** GitHub Actions can block a release and mark pushes
failed, but cannot literally prevent any direct push or administrator
removing this workflow. The repo administrator must configure an active
main-branch Ruleset with required RED ZONE check, CODEOWNERS review,
blocked force pushes and no unintended bypasses.

This text is a control/authorization policy, not an aircraft airworthiness
certification.
