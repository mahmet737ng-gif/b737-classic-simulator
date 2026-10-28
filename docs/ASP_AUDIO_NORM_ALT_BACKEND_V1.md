# ASP Audio NORM / ALT — phase 2 runtime (2026-10-28)
Scope: Boeing 737 Classic 300/400/500 procedure and QRH trainer ONLY.

## Sources
- Sepehran FCOM Volume 2 Chapter 5, printed 5.10.5-6 / 5.20.1-3 (PDF 1114-15, 1130-32).
- B737 MRG IV.5 Communications printed 123 (PDF 132); IV.6 electrical CB index printed 139 (PDF 148).

## Delivered
- Three separate logical ASP stations CAPT, FO, OBS with shared FCOM behavior.
- NORM: MIC chooses a single transmit radio; several receiver channels can be listened to; selected transmitter forces associated receiver, headset, PA/interphone, speaker (no OBS overhead speaker); controls remain station-local.
- ALT: fixed bidirectional VHF-1 / VHF-2 / VHF-1 for CAPT/FO/OBS; presets receiver volume; receiver switches, speaker, hand mic, I/C, normal PA, aural warnings on affected audio station inactive; boom/mask and MIC/R/T PTT remain usable.
- Existing approved photo/control elements retained; a transparent ALT/NORM hit target added at the blank aperture x980,y747 of each ASP. An inspector panel controls and reports the same backend.
- The live electrical state is READ from the existing B737ISNCockpitV1 single V7 session, never duplicated. AIRCRAFT equipment power stays UNKNOWN until actual wiring is confirmed. An explicit BENCH power test is provided, separate from the aircraft.
- PTT/MASK and faults available to trainer through B737ASPAudioRuntimeV1 APIs; no literal sound playback claimed.

## Safety / unresolved mapping
MRG printed 139 names AUDIO CAPTAIN P6-2 D23, AUDIO FO P6-2 D22, AUDIO OBS P6-2 D24. The Unified CB catalog labels those same D22/D23/D24 slots differently. **QUARANTINED**. No CB-to-ASP power cut is applied without photo/airframe effectivity reconciliation. MRG general electrical summary Electronic Bus 2 / Battery Bus is not exact wire-level proof. No guessed aircraft circuit power.

## API
B737ASPAudioRuntimeV1.getProjection(), .setMode('CAPT'|'FO'|'OBS','ALT'|'NORM'), .press(seat,'ASP_RT'|'ASP_IC'|'WHEEL_MIC'|'WHEEL_INT'|'HAND'|null), .setMicSource(seat,'MASK'|'BOOM'), .setPowerMode('BENCH'|'AIRCRAFT'), .instructorFault(seat,'normalControlFault'|'alternateFault',boolean).

This is not verified actual radio transmission, physical audio output or validated EP-FSI wiring.
