# Unified secure content and subscription architecture — v1

**Status (10 November 2026): A tested integration foundation, NOT a finished paid app.** Nothing here changes the approved cockpit, public Pages site, existing Windows installer or Android test APK. These modules must not be silently enabled in production before acceptance gates pass.

## Implemented in this branch

- **Shared content protocol:** signed Ed25519 release manifest with monotonically increasing sequence, content SHA-256, encrypted-object SHA-256, precise file paths and version.
- **Encryption:** assets are encrypted with AES-256-GCM using a 32-byte secret supplied to the controlled build environment. No secret key is committed.
- **Delta content updates:** an unchanged asset reuses its previous ciphertext object. File-based updates download only absent object hashes. Files removed by an update leave the active content namespace, rather than erasing unrelated local user settings.
- **Offline encrypted Node vault:** keeps ciphertext in private app data, authenticates it before use, decrypts the requested object in memory and atomically changes the active signed manifest after all downloads succeed.
- **Security/behavior tests:** wrong key, modified download, signature tampering, rollback, path traversal, case collisions, selective download, stale-file removal and failed-update recovery.

Sources: content-core.cjs, build-content.cjs, encrypted-vault.cjs and their Node tests under distribution/.

## Controlled package generation

Use an Ed25519 private PEM signing key outside this public repository, and a random 32-byte encryption key from a secret manager. Do not embed credentials in the application, commit them, or deliver content decryption keys with public assets.

Environment variables:
- UNIFIED_SIGNING_KEY_FILE: private PEM key location outside source control.
- UNIFIED_CONTENT_KEY_HEX: 64-character hexadecimal AES key from the protected build environment.

Example commands (illustrative paths, not credentials):

    node distribution/build-content.cjs /staging/unified /releases/1.0.0 1.0.0 1 signer-q4 tenant-key-v1
    node distribution/build-content.cjs /staging/unified /releases/1.0.1 1.0.1 2 signer-q4 tenant-key-v1 /releases/1.0.0

The first output contains a release.json signature envelope and encrypted objects in content-addressed objects/xx/<sha256>.bin paths. The second copies verified unchanged encrypted objects and creates new ciphertext for changed files. Release output paths are immutable and must not exist in advance.

Run tests:

    node --test distribution/*.test.cjs

In a future Windows native adapter, syncEncryptedVault receives the signed envelope, trusted pinned public keys, a runtime entitlement key, a private vault directory and an authenticated object-downloader callback returning Buffers. The loader returns plaintext only in memory. Never send decryption keys into an Electron renderer, arbitrary IPC call or open localhost endpoint.

## Platform reality (as inspected on 10 Nov 2026)

| Platform | Current state | Required integration |
| --- | --- | --- |
| Windows | Electron offline installer with existing electron-updater; full executable updates and blockmaps | Connect content vault to the allowlisted loopback resource server, subscription validation, OS-protected keys, separately signed installer |
| Android | Network-dependent debug WebView pointed to public GitHub Pages | Native private encrypted asset storage, Android Keystore, controlled offline content serving, production signing and installation updates |
| Web/PWA | Public cockpit page and shared JS engine | Entitlement-protected content gateway, HTTPS, signed manifest checking, browser encrypted cache, service worker lifecycle |
| Shared core | Existing cockpit and simulation modules | Preserve module behavior and all approved panel artwork while adding platform-specific delivery adapters |

The current client is **not yet gated by a subscription**, and the vault is **not wired into the user-facing program**. This is not a claim that a working Windows/Android/Web paid release has been completed.

## Architecture before commercial publication

1. **Identity:** airline tenant accounts, SSO/OIDC, MFA, admin roles and seat assignment.
2. **License server:** verify active subscription, organization and device on every protected content/key grant; short-lived, scoped download credentials; revocation and audit log.
3. **Secrets:** signing key private in an HSM or secret manager; content key never hardcoded. Native OS key protection (Windows DPAPI, Android Keystore), wrapped keys, rotation and documented offline license leases.
4. **Delivery:** private encrypted release objects on Iran-accessible object storage or VPS behind an authenticated gateway and suitable domestic CDN; no license bypass through publicly exposed objects or license keys. Every release has an Ed25519 signed manifest and hashes.
5. **Atomic app update:** verify and download in the background; activate between training sessions, preserve saved user configurations; never download unchanged content. Installer and native runtime upgrades are a separate, signed channel.
6. **Airline deployment:** central hosted offering or on-prem mirrored content and licensing service. Independent security reviews, backup/restore tests, content distribution rights, support SLA and acceptance reports.

## Threat-model limits

No DRM, encryption, obfuscation, ASAR or device lock can make copying or reverse engineering **impossible** when a user controls their PC/phone and must display and execute software. Web JavaScript and assets can be inspected after decryption. OS-protected storage and licensing reduce casual unauthorized access, but cannot guarantee absolute secrecy on compromised or rooted devices. Keep truly confidential algorithms server-side where possible, and use contractual IP protections.

Server access decisions are mandatory: checking a boolean subscription flag only in JavaScript is insecure. An offline mode requires a deliberately time-limited and revocable license policy, accepting a finite delay until revocation can take effect. Digital signatures on content do not replace Windows Authenticode signatures, Android release signing or independently assessed aviation correctness.

## Release gates still outstanding

- Authenticated subscription and device entitlement APIs with independent security review.
- Windows Electron encrypted-resource adapter and login/update UI.
- Android native encrypted vault, Android Keystore, release signing and instrumentation tests.
- Web authenticated loading, cache/CSP and browser tests.
- Verified no-re-download, disconnected download, valid rollback handling, expired subscriptions, tampering and key rotation.
- Owner-frozen overhead mosaic, Owner18 switches and IRS asset integrity gates must continue passing; none are modified here.
- Independent aviation-system validation, operational role restrictions and software licensing must be completed before airline sales.

This work establishes the content transport and cryptographic foundations; it does not assert that airline production deployment is ready.
