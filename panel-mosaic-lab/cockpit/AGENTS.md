# OWNER18 — STRICT RED ZONE (2026-10-28)

ALL eighteen guarded switch positions, images, colors, sizes, hinges, crop/fit,
hover/background appearance, geometry, inputs, outputs, close detents, masks,
and switch runtime are permanently frozen to Git commit `730815ed6ece9beb30950b96ba536e1ce3f2c4ca`.
See `guard-redzone-lock.json` and
`../../engine/maps/guard-owner18-redzone-v1.json`.
No modification without 1) direct, explicit owner instruction naming the
guard/attribute; then 2) separate explicit confirmation after the exact diff
and consequences are presented. Both are required. If other code changes
would alter these assets indirectly, halt that edit and find a nonintrusive
solution. Never alter baseline hashes or skip checks to make CI pass.
Use `python3 verify-guard-redzone.py --negative-self-test` from repo root
with the full path. Normal pilot switch state transitions remain allowed.
