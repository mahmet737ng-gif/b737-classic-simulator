# Engine oil training dynamics V2

The previous preview produced about 73.5 PSI at N2 60% and capped at 95 PSI.
Its per-step rounding could suppress small temperature increments, and the
all-sources-off host path cooled only the APU. These simulator defects are fixed.

Source evidence:

- EASA TCDS E.066, issue 02, section 3.2: pressure varies with HP-rotor speed;
  see https://www.easa.europa.eu/sites/default/files/dfu/EASA_TCDS_E.066_issue_02.pdf
- CFM TP.OI.9, section 5, operating instructions: broad pressure envelopes at
  N2 85/90/95%, with transient high pressure possible when cold. Copy:
  https://www.scribd.com/document/580565841/CFM-56-3-Specific-Operating-Instructions

The nominal warm curve (N2%, PSI) is a **training approximation**, not a
manufacturer-specified nominal curve or an EP-FSI WDM/AFM limit:
18/0, 22/15, 60/32, 85/45, 90/48, 95/51, 105/55.
Viscosity follows actual modeled oil temperature; pump, leak and quantity
effects are retained. Warning thresholds and installed-limit data are unchanged.

Existing educational equilibria of 82 C idle / 103 C high power remain, now
with N2, throttle and ambient coupling. Full precision is retained internally;
only exported observations are rounded. Heating/cooling retains thermal inertia.
Stopped engines continue to cool in the lightweight all-sources-off path.

Acceptance: `node tests/engine-oil-dynamics-v2.test.cjs` checks small-tick
invariance, load response, viscosity, pump failure and passive cooling.
