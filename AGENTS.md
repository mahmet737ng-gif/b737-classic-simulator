# Unified production deployment rules

## Mandatory Railway release policy

- The `ata24-review-gateway` production service must continuously track the HEAD (latest commit) of its designated Unified release branch. Current release branch: `unified-engine-out-final10-20261125` in `mahmet737ng-gif/b737-classic-simulator`.
- Connect Railway to the branch by repository and branch name, without a `commitSha` pin. Never pin a fixed commit as a normal release procedure. Do not change the designated release branch without an explicit owner decision. If the release branch is changed, carry this policy forward.
- Validate changes before pushing them to the release branch. A successful GitHub push is not proof of production deployment.
- After each release push, verify the GitHub branch HEAD, Railway source configuration (branch tracking, no pin), and latest production deployment commit hash and status. A release is complete only when the deployment for the current HEAD reports SUCCESS; perform the relevant live smoke test where access permits and report any unverified tests explicitly.
- If the deployment is missing, stale, failed, or pinned, investigate and correct the release connection and verify again. Do not silently claim completion or leave a permanent pin behind. An explicitly authorized emergency rollback is temporary; restore branch tracking once the incident is resolved.
- Do not redeploy an old build as a substitute for deploying the latest release commit. Preserve unrelated service configuration and data.
