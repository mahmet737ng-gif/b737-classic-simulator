# Classic TCAS / transponder / moving encounters

The active Unified receiver and independent TCAS lab now use `classic-tcas-v2.js`. V1 remains a compatibility module for callout text/pitch conversion and old regression fixtures; its timer scripts and external sensitivity table do not drive V2. The V2 source register uses only the owner's FCOM and MRG. Source figures were inspected, including FCOM 10.30.12–13 and 10.32.33.

## Corrected behavior

The preceding screenshot has a TRAFFIC alert but no green TFC indication. TFC was initially false, so the renderer correctly suppressed targets but the encounter-start workflow left the pilot with no traffic overlay. Starting an encounter now prepares both pilot EFIS panels through their existing public control API: TFC ON, supported format (MAP if needed), 10 NM. This preparation is an explicit optional instructor checkbox. Afterward the physical TFC switch retains authority; switching it off removes targets and leaves TRAFFIC annunciation.

A target has its own position, heading, speed, altitude, altitude-reporting status and vertical rate. Ownship's current position, heading, altitude and vertical speed drive range, clock position, CPA, predicted vertical separation and relative altitude. SAME LEVEL has +00 with no trend arrow when intruder vertical rate is zero. CONVERGING and DIVERGING use changing altitude, rather than a fixed label. The arrow is the intruder's vertical rate, not its vertical closure relative to ownship. ABOVE/NORM/BELOW filter non-threat traffic, preserving active threats.

The active warning model uses the FCOM's nominal approximately 40 s TA / 25 s RA values. Range/miss-distance and vertical tolerances are explicitly approximate training parameters. This is not a complete TCAS MOPS implementation. The rate-to-pitch conversion is an approximate flight-path calculation with observed pitch/AoA. Red EADI fences are three connected lines, open on the far side: fly above the horizontal limit for climb, below for descent; the red area is the forbidden side. No green fly-to director or automatic AP/FD response is added. TRAFFIC, OFFSCALE and no-bearing messages sit in the middle-right of EHSI, following the FCOM figure; the previous top/header placement is removed. Classic FCOM does not establish an EADI TRAFFIC word in that illustration, so the owner-image-derived EADI word was removed.

RA changes depend on encounter geometry. A reversal scenario changes intruder vertical motion so the earlier sense becomes ineffective. Stronger RAs can follow an initial RA when predicted separation remains insufficient. CLEAR OF CONFLICT requires the threat condition to be absent for a short confirmation period; it is not a fixed end-of-script countdown. In the lab, RESPOND TO RA changes own pitch through a rate-limited training response. Unified's TCAS does not command the aircraft; existing flight targets remain available for a manual instructor response.

## Transponder and dependencies

| Source / control | Functional behavior | Reference |
|---|---|---|
| STBY | No transponder / TCAS replies or interrogation | FCOM 11.10.33, 15.10.21 |
| ALT OFF | Selected transponder, no altitude reporting; TCAS off | Same |
| ALT ON / XPNDR | Selected transponder with valid selected ADC altitude; TCAS off | Same |
| TA | Traffic advisories, no RA | Same |
| TA/RA | TA and RA subject to valid sources/inhibits | Same |
| ATC 1/2 | Select powered transponder; unaffected unit restores reception | FCOM 11.10.27–33 / MRG p373 |
| ALT SOURCE 1/2 | Select ADC altitude reporting source | FCOM 11.10.30/33 |
| Code / IDENT | Four octal digits; identification event and trainer visual pulse | FCOM 11.10.27–33 |
| TEST | Aligned IRS/NAV required; ATC test/fail and system test OK/FAIL | SP.11.1 |
| Radio height | FCOM nominal RA/descent/voice inhibits | FCOM 15.20.30–31 |
| Suppression fault | RA on own symbol, zero relative altitude, no preceding TA/TA aural; select remaining ATC | MRG Classic p373 |

Mode S may remain active on ground outside STBY; airborne mode A/C and altitude-reporting status are modeled separately. The simulator does not transmit RF signals. Self test and display-type demo intentionally present test target categories. The lab provides explicit computer, antenna, transponder, ADC, radio-altitude, IRS and suppression failures.

## Electrical / CB source conflicts

| Equipment | Source-backed entry | Implementation |
|---|---|---|
| ATC1 | Electronic Bus 1, 115 VAC, MRG CL pp173/188 | Reads actual Unified bus / existing FULL ALIGN supply |
| ATC2 | Electronic Bus 2, 115 VAC, same pages | Same; also gates on existing CB P6-1 D16 |
| ATC2 CB | P6-1 D16, MRG CL p136 and catalogue agree | Pull/trip immediately disables selected ATC2; ATC1 remains independently selectable |
| ATC1 CB | MRG B2 vs catalogue ATC1 B3, TCAS B2 | Unbound; explicit instructor ATC1 failure provided |
| TCAS CB | Catalogue TCAS B2/B6 vs MRG ATC1/DME1 at those positions | Unbound; quarantine is preserved |
| TCAS computer supply | Classic branch not established; NG transfer-bus entry excluded | Explicit instructor computer availability; no invented WDM feed |
| MRG p373 vs p173/188 | DC label on fault sheet conflicts with AC entry in Classic electrical index | Recorded rather than silently adding an alternate DC feed |

No lock baseline was changed. Protected overhead, guarded switches and IRS visuals remain locked. The separate TCAS lab is under `panel-mosaic-lab/cockpit/tcas-lab/` and is served by the same Railway gateway as other cockpit paths.

## Verification

134 deterministic flight/EFIS/TCAS acceptance tests passed, including standalone lab boot with its actual HTML script order, actual SVG/canvas renderers, live pilot response through clear of conflict, both-seat TFC preparation, manual TFC authority, actual ATC2 CB events, unknown/missing supply, independent bus/ADC selection and self-test code segments. Seven installation/profile checks and the English-only scan passed. All four immutable overhead/Owner18/IRS checks passed; negative self-tests rejected unauthorized mutations. Native canvas/SVG rendering was visually inspected. The current signed-in user browser session was not available for an end-to-end UI check.

Clearing an encounter removes traffic without switching a healthy selected transponder off. TEST also works without an active encounter when an aligned flight context exists; it displays code segment test 8888 without overwriting the stored squawk.

## Optional TCAS VSI and ATC panel

Settings → Vertical speed indicator selects Analog IVSI or IVSI + TCAS on both seats. The photo hardware uses separate raster controls and Canvas displays. TA SEL switches each instrument independently between full-time and advisory popup. The range selector acts on both traffic VSIs. FL displays absolute target altitudes for 15 seconds. A lit 8888 is the segment test. Operational codes use four octal digits.

Sepehran FCOM D6-27370-300/400/500-SHI, 10.10.9–10, 10.10.23–24, 10.20.8, 11.10.26–29, 15.10.23–24 and 15.20.30–32. FSB/FSF have the electric TCAS VSI driven by the respective ADC. FSI has the inertial indicator. The optional display uses the documented blue standby legend. TA/RA is a selector position, while the RA cue appears during an actual advisory.

Red avoidance arcs follow the shared encounter engine. Corrective and maintain fly-to widths (500 fpm) and the level-off corridor (±250 fpm) are trainer parameters. The R indication models a test or IDENT response. Radio interrogations are not synthesized.

Both ATC channels use the existing 115 VAC electronic bus model. The simulated CB board names ATC-1 at P18-1 B3 and ATC-2 at P6-1 D16. Pulling either labelled TCAS breaker (P18-1 B2/B6) makes the shared simulated computer unavailable. This is a cockpit training convention. The MRG and catalogue disagree on P18 assignments and neither establishes the TCAS computer or individual electric VSI supply for this installation. Precise line-replaceable-unit wiring and independent display power loss require the applicable WDM.
