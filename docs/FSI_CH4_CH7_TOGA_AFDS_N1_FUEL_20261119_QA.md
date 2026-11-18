# B737 Classic FSI — Chapter 4 / 7.10 integration audit (2026-11-19)

**Scope:** Classroom simulator ONLY. Aircraft reference EP-FSI, S/N 29340,
CFM56-3-series training 20K. No claim of AFM-approved thrust or operational
FMC/AFDS compliance. All test-lab labels in English.

## Source mapping

Authoritative procedural source: Sepehran B737-300/400/500 FCOM
D6-27370-300/400/500-SHI. The original library PDF has 1,937 pages.
Physical PDF pages and printed FCOM folios are intentionally both listed.

| Reference | Source-derived rule | Implementation |
|---|---|---|
| PDF p1085–87 / §4.20.14–16 | FD-only takeoff; FSI/FST takeoff roll HDG SEL option; A/T N1 then THR HLD at 84 KIAS; FD −10° prior 60 KIAS then +15°; after takeoff THR HLD→ARM ≥400ft RA and ~18 s; CMD converts FD takeoff to LVL CHG / MCP SPD | `engine/afds/classic-toga-ch4-v1.js`, `toga-unified-ch4-v1.js`, `fcc-flight-runtime-v1.js`, `mcp-afds-bridge-v1.js` |
| PDF p1095–98 / §4.20.24–27 | First GA press reduced N1; second after reduced thrust attained full GA N1; pitch FMA TO/GA, A/T FMA GA; initial FD +15° or one-engine +13°; F/D only GA disengages single CMD A/P; dual A/P GA needs FLARE armed; post-failure single-engine speed references (10s/5kt/V2) | `classic-toga-ch4-v1.js`, `toga-unified-ch4-v1.js` |
| PDF p1051–52 / §4.10.8–9 | LVL CHG pitch MCP SPD; climb A/T N1, descent RETARD then ARM; selected MCP IAS/MACH retained; GS capture inhibits level change | `mcp-mode-core-v1.js`, `fma-mode-engine-v1.js`, `lvlchg-thrust-servo-ch4-v1.js` |
| PDF p1174–75 / §7.10.3–4; p1185–86 / §7.10.14–15 | Yellow N1 reference bug; manual N1 pulled disables FMC bug signal, not the active A/T mode; pushed-in FMC bug uses N1 LIMIT/TAKEOFF REF | `manual-n1-live-v1.js`, generated raster `assets/manual-n1-raster-20261119.png` |
| PDF p1177–78 / §7.10.6–7 | EIS FUEL USED readout displays for 10s; EIS RESET shows accumulated USED 1s, resets to zero and returns to rate; pointer always remains current FF | `engine-indication-live-v2.js`, `fuel-used-physical-ch7-v1.js`, existing backend |
| PDF p1187–88 / §7.10.16–17 | Conventional Fuel Flow switch spring-loaded to RATE; USED held displays total burn; RESET held resets both fuel-used counters; pointer shows current FF | `fuel-used-physical-ch7-v1.js`, existing backend |

## Live wiring / source of authority

- Two photographed TO/GA touch targets and FLT PHASE `PRESS TOGA` dispatch
  the same `b737:toga-request`. Only the shared, installed ISN18 ECU moves
  physical throttles and only the existing FMA layer paints captions.
- A/T servo commands require real powered MCP, A/T ARM, a loaded flight
  scenario, and at least one running engine. FD-only TO/GA does not produce
  an imaginary engine-powered ground roll.
- Above 400ft RA, successful CMD selection exits FD-only TO/GA, transitions
  to LVL CHG / MCP SPD with HDG SEL roll, and clears the prior FCC FMA
  observation. Below 400ft RA, pitch-mode and new single-A/P requests are
  inhibited during TO/GA.
- LVL CHG descent can retard to ECU idle. LVL CHG climb N1 servo output is
  disabled until a qualified FMC limit exists; *visual EST N1 is never A/T
  authority*. MAN N1 pulled affects only reference bug, never actual A/T.
- The user-accepted EP-FSI v19 estimates show **EST** and vary with pressure
  altitude/OAT/bleed/anti-ice in the separately existing UI estimator.
  No proprietary, unverified AFM N1 curve is claimed.
- Smiths fuel quantity display reports in 20-KG increments without
  rounding prematurely; this does not change real ECU mass, ledger or leak.
- EIS fuel-used buttons and Conventional spring selector operate the existing
  independent cumulative fuel-use counters for both engines.

## Automated acceptance tests

- `engine/afds/classic-toga-ch4-v1.test.cjs` — N1/THR HLD, 60/84 kt,
  two-engine GA, reduced/full second press, one-engine 13°, failure timing,
  takeoff V2/V2+20.
- `engine/afds/mcp-level-change-ch4-v1.test.cjs` — source-gated climb N1,
  descent RETARD→ARM, FMC/MCP selection and first 150s inhibition.
- `panel-mosaic-lab/cockpit/eadi-speed-tape-direction-ch10-v1.test.cjs` —
  higher speeds are ABOVE the index; true IAS acceleration scrolls markings
  DOWN; prevents accidental reverse-scale edits.
- `engine/instruments/mechanical-number-wheels-twenty-v1.test.cjs` —
  altitude drum carry restricted to final 20ft.
- `tests/unified-ch4-physical-controls-v1.test.cjs` — raster PNG,
  physical TOGA inputs, manual N1 vs A/T, 20kg fuel quantity,
  EIS/Conventional fuel buttons and source-verified LVL CHG thrust.
- `tests/engine-indication-unified-live-v2.test.cjs` — EIS 10s display,
  1s reset hold, zero/return; Conventional held USED and RESET both ledgers.
- `tests/flight-phase-shell-v1.test.cjs` — actual FLT PHASE HTML uses
  `PRESS TOGA`, not only the JS fallback.

CI workflow: `.github/workflows/unified-ch4-toga-afds-qa.yml`.

## Incomplete/limited — do not claim aircraft fidelity

1. **Numeric MAX/target N1:** The private EP-FSI AFM chart audit has NOT
   validated any operational numeric curve. V19 remains a dynamic
   *display-only visual estimate* with explicit EST marking; the ECU servo
   cannot consume it as real FMC authority.
2. **Physical N1 bug/knob placement:** raster PNG and interactive controls
   are committed; exact pixel registration, detent optics and variant
   source photo comparison still require authenticated browser visual QA.
3. **Full AFDS/FCC:** takeoff and GA have source-grounded initial mode
   transitions, but full post-rate FD pitch trajectory, dual-channel APP
   flare servo, all FMC capture conditions, aircraft-specific physical FCC
   sensor failures and certified thrust schedules are NOT implemented.
4. **GA reduced thrust:** first GA is a marked training throttle proxy (0.86
   fraction), with an observed-N1 + throttle gate before second press.
   This is NOT an AFM-calculated reduced go-around N1.
5. **EIS 1s reset visual:** instant ledger reset at 1s and a short zero
   indication are simulated; no pixel-verified photographed digit
   countdown profile has been validated.
6. **Photo owners:** original protected cockpit photos, electrical buses,
   CB topology and aircraft engine ECU files remain the source owners.
   No duplicate engine plant has been introduced.

Railway deployment note: the live `ata24-review-gateway` service is an
authenticated reverse proxy fetching cockpit sources directly from GitHub
`main` (raw first, Pages fallback); no Railway rebuild is required for a
main-branch JS/photo change. HTTP responses for source assets are cached
for no more than 30s; cockpit HTML is no-store. Browser login and pixel
rendering still require a signed-in session.
