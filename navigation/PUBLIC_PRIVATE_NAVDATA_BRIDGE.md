# Public Unified ↔ Private NAV DATA AIRAC 2610 (owner opt-in)

**Training reference only. Never for aircraft navigation.** This addition connects a PUBLIC GitHub Pages cockpit displayed on the owner's **Windows computer** to the owner's own private Stage1 SQLite through a localhost bridge. It does not upload, expose or redistribute the Navigraph/Jeppesen/PMDG private source archive or enable executable FMC legs.

## 1. Start the read-only local bridge

Install Python 3.10+ and keep the user-owned, licensed AIRAC 2610 Stage1 ZIP **outside** the GitHub repository and public web directory.

From the checked-out `b737-classic-simulator` repository folder:

```powershell
python navigation/navdata_public_bridge_v1.py --stage1-zip "C:\Private\B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1_PRIVATE.zip" --port 8767
```

Alternatively use `--stage1-db "C:\Private\B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite"` if already extracted.

The local terminal prints a fresh **ONE-TIME CONNECTION TOKEN**. Do not share the token, add it to a screenshot, put it in a URL, or commit it. Every server restart generates a different token.

## 2. Open the PUBLIC version on the same Windows computer

`https://mahmet737ng-gif.github.io/b737-classic-simulator/panel-mosaic-lab/cockpit/index.html`

Find the **Private NAV DATA · AIRAC 2610** section beneath the existing two-CDU controls. Paste the token into the password input and click **Connect Private NAV DATA**.

Expected: **متصل · PRIVATE AIRAC 2610 · فقط خواندنی**. The shared public host UI remains completely public; the source stays in local SQLite. The connector keeps the token only in the browser page's memory (not localStorage/cookies/URL). Press **Disconnect** or stop the local Python process to revoke access; refresh also requires reconnecting. A browser may ask for permission to access a device/service on the local network: allow only if you intentionally started this local bridge.

If the public page is opened on an **iPad, phone or second PC**, it cannot reach the first PC's loopback server. The bridge intentionally binds only to `127.0.0.1`. That would require a separately designed secure remote/private networking solution. GitHub Pages itself cannot directly query the private SQLite.

## 3. CDU reference checks

- RTE ORIGIN `OIII`, DEST `OIMM` and RUNWAY `29R` are looked up before staging.
- VIA checks the private AIRWAY index. TO checks waypoint/navaid indexes; ambiguous identical FIX identifiers are blocked.
- DEP/ARR: choose the indexed origin/destination and source procedure list using the existing physical LSK locations. SID/STAR/APP selection stays **SOURCE ONLY**, not operational LEGS.
- Public GitHub Pages defaults to the existing native CDU until the user connects and grants permission.
- Both embedded CDUs may use this same in-memory connection but retain their own page and scratchpad behavior.
- The approved CDU bitmaps, keys, panel geometry, and 24-column font have **not** been modified.

## Security / architecture

`navigation/navdata_public_bridge_v1.py` is an independent minimal local HTTP server, with:
- `127.0.0.1:8767` only; no external bind and no static file route;
- exact CORS Origin `https://mahmet737ng-gif.github.io`, strict loopback Host and PNA preflight;
- per-startup cryptographically random token in `X-B737-Nav-Token`, required on every GET;
- allowlisted **read-only** GET endpoints `/api/navdata/status`, `/api/stage6/navdata` and `/api/stage6/catalog`;
- no credential cookies, no redirection, no POST, no user-controlled SQL, bounded lookups and `Cache-Control: no-store`.

API responses are source reference only with `fmc_executable:false`. There is no private source download, database switching, autopilot/AFDS, LNAV or VNAV.

## Verification

- The source ZIP / Stage1 SQLite used earlier was verified in the project's private-data audit; the new standalone bridge source code and synthetic tests are version-controlled.
- New Python tests cover request authorization, CORS/PNA preflight, read-only scope, source lookup, missing/invalid tokens, mismatched Host/Origin and malicious query parameters.
- New Node tests cover initial public isolation, same-origin/consent attach, disconnect and in-memory secret handling.
- `.github/workflows/navdata-public-bridge-v1.yml` runs these tests without requiring or publishing any licensed DB.
- **Production Windows/browser acceptance must be performed on the owner's machine** after starting the private service. Browser local-network permission policies vary; a GitHub code merge alone does not prove that the browser has granted the required local access.
