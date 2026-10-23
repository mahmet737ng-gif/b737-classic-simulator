# Approved Boeing 737 Classic CDU typography — LOCKED

**Project identifier:** `B737-CLASSIC-CDU`  
**Repository:** `mahmet737ng-gif/b737-classic-simulator`  
**Effective baseline:** 2026-10-23  
**Status:** Approved; do not replace or modify without explicit user instruction.

The CDU screen uses two original binary fonts committed to this repository:

| Role | Asset | CSS family | SHA-256 |
| --- | --- | --- | --- |
| Main values, title, scratchpad | `assets/fonts/boeing-cdu/BoeingCDU-Large.ttf` | `BoeingCDULarge` | `6df71c5dc38105240f80c94f39a3daa075d4fdc6f33ccda7ce1bb48470ed0626` |
| Smaller CDU row labels | `assets/fonts/boeing-cdu/BoeingCDU-Small.ttf` | `BoeingCDUSmall` | `f6576ace4558b0a611920d28664fed3462b66a246dc393f7fcbd8e04a8563db1` |

Authoritative font mapping: `assets/fonts/boeing-cdu/cdu-screen.css`.

## Coverage

This single stylesheet is linked **after the original version stylesheet** in:
- `cdu-standalone/`
- `cdu-standalone-v3/`
- `cdu-standalone-v5/`
- `cdu-standalone-v6/`
- `engine/ch11/physical-cdu/`

This policy only changes **screen text face** and does **not** modify approved source panel images, key hitboxes, geometry, CDU logic, navigation data, or EFIS typography.

## Binding rule for future CDU work

Any new CDU display must reuse the two existing binary font files and the shared stylesheet. Do not upload a different font, alter the TTF bytes, rename the families, inline substitute fonts, or introduce fallback fonts as the primary display fonts. Do not modify the font lock unless the user explicitly approves a change.

`node tests/cdu-font-lock.test.cjs` verifies TTF SHA-256 hashes, shared CSS mapping, and integration points. The GitHub Actions workflow `cdu-font-lock.yml` runs it on push and pull requests. As with any repository test, an administrator could bypass protections; policy is therefore both documented and automatically checked, rather than claimed to be physically impossible to override.

## Licensing

The assets are FlightGear-derived Boeing-style recreation fonts, not official Boeing-supplied font software. Preserve `assets/fonts/boeing-cdu/LICENSE.md` and the original `README.md` and review licensing obligations before distribution.
