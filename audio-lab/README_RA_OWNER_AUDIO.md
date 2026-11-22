# B737 Classic — Owner RA Callout Test Asset (22 Nov 2026)

The user provided **a.mp3** (11.52 seconds, 44.1 kHz mono MP3). Ten voiced callouts were identified in that file. The ending unidentified sound at approximately 10.85–11.52 seconds is deliberately excluded from the preview and all triggers.

The current web test asset at `audio-lab/assets/owner-ra-callouts-v1.mp3` is the exact uploaded original MP3 (188,694 bytes, SHA-256 a81fde2be7bbb10c2857af5e5c8721670f88c56fafdeb60f7cb15b560144b5a8), without any transcoding. The trailing unidentified beep remains in this source file but is excluded from playback. This is a training simulation, **not** certified avionics audio.

| Alert | Time range (s) | Live trigger |
| --- | --- | --- |
| ONE THOUSAND | 0.000–0.960 | RA crosses 1000 ft downward |
| FIVE HUNDRED | 1.440–2.250 | RA crosses 500 ft downward |
| APPROACHING MINIMUMS | 2.620–4.090 | RA crosses DH + 100 ft downward, DH >= 0 |
| MINIMUMS | 4.380–5.110 | RA crosses DH downward, DH >= 0 |
| ONE HUNDRED | 5.540–6.400 | RA crosses 100 ft downward |
| FIFTY | 6.900–7.360 | RA crosses 50 ft downward |
| FORTY | 7.680–8.040 | RA crosses 40 ft downward |
| THIRTY | 8.530–8.950 | RA crosses 30 ft downward |
| TWENTY | 9.140–9.610 | RA crosses 20 ft downward |
| TEN | 10.040–10.470 | RA crosses 10 ft downward |

- No 2500 ft callout is contained in this recording.
- No synthetic tone or TTS fallback is used.
- Other Audio Lab warnings remain unassigned and silent.
- `audio/warning-engine.js` evaluates thresholds; `audio-lab/owner-ra-callouts-v1.js` handles voice sample selection and playback.
- `audio-lab/ra-test.html` simulates RA and DH changes to audition source-to-event mappings.
- The source file contained third-party soundboard metadata. Publishing the preview does not establish a redistribution license; production use requires rights verification.
