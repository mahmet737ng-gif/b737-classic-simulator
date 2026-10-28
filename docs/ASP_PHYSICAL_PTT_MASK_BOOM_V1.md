# ASP Physical Stage — PTT and MASK/BOOM
Source: Boeing 737 Classic Sepehran FCOM Volume 2, 5.10.3, 5.10.6, 5.20.1-3; MRG Communications IV.5 printed 123.

Physical geometry is the existing approved ASP face plate SVG with holes x=145/410/980 y=747, native source viewBox 1122×888. The white lettering and photo panels are **unchanged**.

- CPT/FO controls mount in their pedestal faces, OBS mounts natively inside the AFT Overhead OH-04 iframe.
- PTT upper position = R/T; lower = I/C, middle = neutral. It is spring loaded; pointerup, pointercancel, lostpointercapture, keyboard keyup, blur and page hidden reset to neutral. Keyboard Up/Down support.
- MASK (upper)/BOOM (lower) holds its selected position until changed. Hand Mic is independent as per FCOM.
- ALT (upper)/NORM (lower) uses the same single shared audio backend, no observer duplicate backend. Child frame sends validated physical events to parent; the authoritative parent sends projections back.
- A thin metallic switch overlay is additive, at the existing blank holes; photo artwork and approved 20 MIC/receiver sprites not re-rendered.
- Shared photo control illumination for OBS follows authoritative parent even when ALT fixes the MIC to VHF-1.
- No real radio TX/audio playback, no resolution of quarantined P6-2 CB mappings; power remains source-gated UNKNOWN unless BENCH simulation selected.
- No red-zone Guard / IRS / frozen Overhead file modified.
