# Chapter 11 engine v3 — Verified scope

- Source: Sepehran 737-300/400/500 FCOM Vol 2 Ch11; 409 pages indexed PDF 1414..1822. 16 selected-page visual/text audits; remaining 393 are page-indexed only.
- B737 technical secondary: b737.org.uk/fmc.htm (direct URL 502); mirrored 16-page text review, not a source of exact Classic-specific authority.
- Trainer page definitions: 36, input fields: 88, navigation actions: 101, LSK registry slots: 432.
- Snapshot source art SHA-256: 2c60c534e6e9cd80afa721f2d82801d7bdbc54dce4bbd39b8adb3470f2df0237; 70 keys and 5 backlit outputs.
- Verified behavior by automated Node tests: valid/invalid icao, CI limit <=200, Scratchpad, field editing by LSK, short CLR, sign cycle, pending EXEC, Next/Prev RTE, 24-char rows, ghost annunciators and DOM hotspots.
- FCOM field locations explicitly cross-reviewed on illustrations: 11.40.11, 11.40.21, 11.40.37, 11.40.46, 11.40.52, 11.42.77, 11.43.27 (some slots still incomplete).
- Unverified/not implemented: full page-by-page/FMC system semantics, all PROG and VNAV fields, nav database and route engine, N1/VREF computations, HOLD geometry, ACARS, systems coupling.
- Browser E2E unsupported in this sandbox (chromium headless timeout); mock DOM test passed and manual Edge testing pending.
- This is an independent prototype path. Live main simulator and previously published v2 remain untouched.