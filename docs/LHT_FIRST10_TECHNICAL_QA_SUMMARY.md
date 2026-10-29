# Lufthansa LAN — first 10 source sections: technical QA status

**Source**: `LHT-LAN-B737CL-MULTI-ATA-2813-20261029` (private Technical Database).

**Scope**: source `section-01` through `section-10`: ATA 32, 34, 31, 38, 33, 35, 36, 30, 49, then DOC. Section 10 is **maintenance-documentation training, not an ATA chapter**. These ten sections contain 1,187 original PDF pages. All split-page native text was checked against the original; **zero mismatches**. Twenty blank pages and three title/cover or low-text pages were identified; blank pages are preserved.

**Rule audit**: 40 source-to-Unified technical QA observations: 4 matches (three discrete pneumatic functional statements plus one documentation methodology), 12 partial matches, 13 missing or unproven runtime links, 8 blocked by configuration/effectivity or explicit discrepancies, 2 cross-ATA content records, one documentation-only item. These are QA findings, not 40 approved aircraft rules. Neither the Airbus-like notion of certification nor pilot operational approval is claimed. Exact electrical/breaker diagrams, hardware effectivity, all figure semantics, pixel placement and system simulations remain **unsigned-off**.

## Priority restrictions

| Source section | Original PDF page(s) | Finding | QA gate |
|---|---:|---|---|
| ATA 30 Wing TAI | 1011, 1017, 1021 | CONFIG 1 vs CONFIG 2 uses different switch detents and on-ground/takeoff behavior | **BLOCK** until installation variant resolved |
| ATA 33 Lights | 918 | Source Position Lights switch is ON/OFF/ON BAT; current Unified toggle declares ON BAT/AUTO/ON | **BLOCK**; do not change locked visual/control state without owner approval |
| ATA 34 Navigation | 364, 370 | IRS vendor/temperature rules; owner 4 NM trainer policy differs from source computed-latitude sine/cosine checks | **BLOCK** universal-source claims, preserve owner policy |
| ATA 49 APS2000 APU | 1031, 1065, 1097 | APS2000-specific start, RPM and EGT conditions must not be applied to an unverified GTCP installation | **BLOCK** pending APU equipment identity |
| ATA 32 Landing Gear | 228 | Tail-skid details specifically for 737-400 | **BLOCK** universal application |
| ATA 38 Water/Waste | 841 | Compressor is explicitly optional; CB evidence not a universal aircraft wiring authority | **BLOCK** installation assumptions |
| ATA 34 Navigation | 644–647, 658–669 | Sixteen pages have ATA 22 BITE headers within source section 02 | **CROSS_REFERENCE**, no page removal |
| ATA 49 APU | 1113–1114 | Two pages have ATA 31-10 MCDU headers within section 09 | **CROSS_REFERENCE**, no page removal |

## Confirmed narrow software comparisons

- ATA 36 DUAL BLEED Boolean eligibility and Isolation AUTO selection follow the cited manual's principal switch conditions in the inspected Pneumatics V6 code. Its conditional BLEED TRIP reset likewise matches at the **discrete-input level**. No actual pressure/temperature plant or verified CB power distribution is implied.
- ATA 35 crew oxygen pointer uses the 0–2000 PSI scale specified in the source. Its initial 1,200 PSI remains an explicitly visual test default, not a measured oxygen source.
- ATA 30 existing blue indication frames OFF/DIM/BRIGHT exist, but control logic is not deemed source-validated.

**Safety and provenance**: No actual source PDF/text appears in GitHub, no simulator control law was activated by this audit, and no frozen/Red Zone assets were changed. Source-specific paragraphs, system truth tables and unpublished page-level QA remain in the private Library directory `/Technical Database/QA/LHT-LAN-B737CL-FIRST10-20261029/`.

Machine-readable public status: `engine/maps/lht-first10-source-qa-status-v1.json`. Tests: `tests/lht-first10-source-qa-gates-v1.test.cjs`. This QA status should be treated as a **release blocker** for unverified source-derived features, not as approval to auto-merge them.