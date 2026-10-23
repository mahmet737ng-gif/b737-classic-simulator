# B737 Classic · Locked Panel Asset Vault

The six assets and their true status are in [catalog.json](catalog.json).

- **The exact OH-01…OH-06 original is already in GitHub** at [the locked user source](../assets/locked/2026-10-23/OH01-06-source-9d8ac0ac86bd.png). Its Git blob SHA-1 `426479e2f6868b15023d24818eb9388e52ea9457` matches the original local bytes; SHA-256 is checked by CI.
- Three atlas images, one mosaicked crop and one assembled preview are **archived in Technical Database** but remain **awaiting binary upload to GitHub**. An archive in Library is not the same thing as a GitHub upload.
- Each asset uses a unique ID, byte count and exact SHA-256. Replacements get a new ID and filename. Prior bytes and catalog entries must not be changed.
- The CI verifies existing GitHub files and compares with prior commits to reject deletions, edits and modifications to registered identities and historic events.
- A failing CI check does not by itself make GitHub storage unchangeable. True enforced blocking requires a repository ruleset or branch protection with mandatory checks and write permissions that cannot bypass the rules. It has **not** been configured here.

Current preserved image IDs: **REF-0001** (OH/MP/PD) and **UPD-0002** (OH-01 to OH-06). The other aircraft panels stay untouched. Never mark `github_status` verified without checking actual repository bytes.

Use [History](history.json) for append-only version chronology. The production viewer must read **only** assets in GitHub with `github_status: uploaded_verified`, and must not silently substitute pending images.
