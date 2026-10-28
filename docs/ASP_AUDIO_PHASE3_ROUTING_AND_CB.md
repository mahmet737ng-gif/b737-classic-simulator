# ASP Phase 3 — Audio routing and electrical evidence (B737 Classic)
Date 2026-10-28
Source: FCOM Vol2 Communications 5.10.5–6, 5.20.1–3; MRG IV.5 printed p123 (PDF 132); MRG IV.6 CB index printed p139 (PDF 148).
Scope: procedure/QRH trainer; not certified flight model, not actual transmission, not verified EP-FSI effectivity.

## Backend
- V1 local state: Captain, First Officer, Observer, independent NORM/ALT.
- Routing V2 resolves transmitter channel and selected microphone for pressed PTT; ALT hard-routes VHF1 / VHF2 / VHF1. Only ALT R/T or WHEEL_MIC permitted. HAND and I/C disabled.
- NORM receiver can monitor multiple sources; selected transmitter receiver forced. Crew headset and separate overhead speaker routing. Observer has no dedicated speaker. Speaker inhibit during another station's transmission is **as-installed** and OFF unless test config enables it.
- Warnings via station audio lost on ALT; GPWS/Altitude alert/Windshear generators themselves are NOT turned off.
- Radio source failures injected into a shared RF availability map are seen by every station tuning the same radio. BENCH has explicitly simulated power. AIRCRAFT has UNKNOWN downstream until valid wiring.
- Live read-only V7 power feed; CB evidence adapter, no physical CB side effects.

## IMPORTANT: MRG versus installed CB catalog
MRG candidate P6-2 D23 / D22 / D24 = Audio CPT/FO/OBS, but the project's photo CB catalog names those positions EXT BOTTLES RIGHT / AURAL WARN / EXT BOTTLES LEFT. Every candidate is **QUARANTINED**, with 0 live CB connections. Do not auto-relabel or crosswire. Need actual airplane WDM/CB photo/effectivity review before claiming functional ASP power cut. Existing CB controls and owner-lock hashes untouched.

## Live test
Open Unified inspector; ASP Audio Routing V2 panel includes three-seat PTT R/T, I/C, release and instructor RF status. `window.B737ASPAudioRoutingLiveV2.getRouting()` reports all route details. `.getCBSourceAudit()` shows open-circuit candidate evidence; neither is proof of operating RF transmission.

## Outstanding
- Verify power feed and CB panel through aircraft-specific WDM; connect only confirmed terminals.
- Complete MASK/BOOM and physical PTT hardware sprites / routing, audio stream/real sound production (not in this phase).
- Live visual/pixel acceptance in browser still pending owner screenshot.
