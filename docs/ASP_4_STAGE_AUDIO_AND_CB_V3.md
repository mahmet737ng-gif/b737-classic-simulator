# ASP 4-stage integration — implementation / remaining acceptance

Commit scoped: Boeing 737 Classic FCOM Vol 2, Chapter 5 Communications; MRG IV.5 (communications), IV.6 (CB index). Owner photographic hardware and frozen OH/IRS/Owner18 protected.

## Stage 1: 72-center review
Three stations, each with 7 MIC illuminated buttons, 13 receiver/volume knobs, 3 physical switches and 1 V/B/R selector. All use SVG viewBox xMidYMid meet + original aperture centers. Live "RUN ASP 72-CENTER PIXEL AUDIT" checks bounding centers against source geometry, including OBS inside OH-04 frame. Pass criterion 0.5 CSS px (layout). This **does not constitute visible owner-pixel acceptance**: optical alpha, visual overlap and original panel photo still need a screenshot review. **No auto final lock.**

## Stage 2: audible training mode
Owner-activated Web Audio Context generates synthetic radio static / navigation id test tones. Source injection toggles explicit RF channel; headphone or overhead speaker monitor selectable; intensity from each station's selected receivers and independent volume settings. Sound can be stopped. Not live ATC/voice/audio reception, microphone processing or actual aircraft radio transmission. Default OFF.

## Stage 3: TX/RX
Reuses the single Backend V1 and Routing V2, including MASK/BOOM and momentary R/T/I/C, ALT fixed VHF1/2/1, distinct FO/CPT/OBS state, source failure and sharing. Trainer can detect simultaneous PTT requests to the same VHF: reports simulated collision, not actual TX arbitration. No broadcast.

## Stage 4: CB/electrical audit, read-only
"CB TRACE V3" discovers VHF 1/2/3 and Interphone CB photo labels in existing CB_CATALOG. V7 bus evidence is READ ONLY; it is *not* equipment-terminal verification. MRG claims ASP CB P6-2 D22/D23/D24 but photo catalogue labels these as AURAL WARN / EXT BOTTLES RIGHT / EXT BOTTLES LEFT. **No connection, relabel, circuit switching or automatic cut is safe.** The user must supply EP-FSI-specific wiring manual and CB panel evidence before the 3 ASP power route can be finalized.
Engine and lights Red Zones remain untouched.
