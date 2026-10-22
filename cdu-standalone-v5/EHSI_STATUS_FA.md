# وضعیت EHSI نسخه v5 — 737 Classic

## مستندات استخراج‌شده از FCOM سپهران Vol 2
- 10.30.2–10.30.5: EFIS control panel, brightness (outer EHSI; inner WXR), range selector, WXR, VOR/ADF, NAV AID, ARPT, RTE DATA, WPT, TFC, TERR. 
- 10.40.9: EHSI display source/orientation, heading from IRS, track from FMC with IRS fallback.
- 10.40.10: Seven EHSI modes; MAP features.
- 10.40.11: CTR MAP, NAV TRACK-UP, VOR/ILS HEADING-UP.
- 10.40.12: PLAN TRUE NORTH and weather display conditions.
- 10.40.13: IRS/SG transfer and automatic/manual brightness influences.

## اجرا شده (شبیه‌سازی آموزشی)
- Mode-specific rose/arc, orientation, heading/track bug, course pointer, a **synthetic** CDI if valid input is manually supplied.
- Seven distinct selectable modes, six map ranges 10–320 NM, selectable EFIS map switches.
- NO NAV POSITION DATA when real route coordinates are unavailable.
- Opt-in SIM ROUTE demo, with clearly labeled fictional relative waypoint positions, appears after route EXEC; synthetic data do not represent geography or a real flight plan.
- VOR/ILS data-validity/invalid indications; non-connected WXR/TERR show explanatory messages rather than fake returns.
- Preserves approved CDU photo and keeps CDU in standalone mode.
- Tests: engine mode/orientation/route activation and existing 36 FMC template tests pass.

## پیاده‌سازی نشده/تأیید نشده
- No actual navdb, FMC 6DoF position, IRS sensor feed, symbol generator bus, real ILS/VOR deviation, DME receiver, wind, bearing pointers, radar echoes, terrain / TCAS returns, EFIS option-dependent autopilot transfer integration.
- Display layout is engineering-derived approximation; *not* screenshot/pixel-exact reproduction of a certificated unit.
- No Chromium end-to-end screenshot verification available in this runtime (blocked local/localhost network).
- Note: actual EHSI source chapter is **FCOM Chapter 10**, not Chapter 4. Chapter 4 is Automatic Flight and is an input/coupling reference.
- **Not for real flight or navigation.**