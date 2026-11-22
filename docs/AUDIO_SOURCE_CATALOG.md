# B737 Classic — authentic audio sourcing and QA (22 Oct 2026)

## Current implementation (reset 22 Nov 2026)
- Audio Lab retains discrete warning-test slots and the FCOM-based warning-condition logic.
- All generated Web Audio waveforms and browser text-to-speech playback have been removed. Unassigned slots remain silent.
- Sound files must be imported one at a time against an explicitly selected warning; filename-based auto-assignment is disabled.
- The lab now uses a new empty browser IndexedDB namespace. Legacy browser-stored recordings are not loaded or played and are left untouched in the old namespace.
- 0 third-party authentic recordings are committed to this public GitHub repository.
- Per-file decoding, duration checks, silence/clipping checks, stop/start, review notes and JSON export remain available.
- Production cockpit assets and controls remain unchanged; warning trigger logic is retained separately from sound assets.

## Audio source register and rights
| Collection | What it actually contains | Status |
| --- | --- | --- |
| https://sonniss.com/gameaudiogdc/ | 2020 sample recordings from Articulated Sounds Boeing 737 cockpit, incl. mechanical stall warning, landing gear mechanism, trim and ambience | App use allowed under license, raw sound redistribution restricted; not copied into open GitHub |
| https://www.101soundboards.com/boards/34296-737-sounds | 737NG warning samples | Re-distribution rights unverified; not copied |
| https://library.avsim.net/file/81893-feelthere-737-gpws-replacement-files | 737 GPWS replacement recordings | Freeware with limited distribution; not copied |
| https://forums.x-plane.org/files/file/41293-real-boeing-737-overhead-panel-sounds/ | Real overhead cockpit control recordings | Private use free; sharing/commercial permission requires contacting creator; not copied |
| https://www.asoundeffect.com/sound-library/boeing-737-airplane-cockpit/ | Larger professional 59-file cockpit recording library | Purchase/license condition needed; not copied |
| https://github.com/YV3399/737-300-CHT | GPL-3.0 open-source FlightGear 737-300 package | Source/sound provenance and app-license implications require review; not copied |
| https://freesound.org/people/Sadiquecat/sounds/873198/ | 737-800 real cabin ambience under CC0 | Not a warning, excluded to avoid incorrect assignment |

## Next stage
1. Obtain rights-cleared audio masters for all installed alert systems and specific Classic configurations.
2. Import recordings in Audio Lab and run its QC check; listen and approve each separately.
3. Decide whether released product is closed-source, and package licensed media under the applicable rights.
4. Finalize playback priority, continuous loop behavior, power-inhibit rules, GPWS/TCAS installed variants, and per-model instrumentation.
5. Complete end-to-end browser/audio-hardware playback QA.

Warning: licensed use inside a finished game/app does not necessarily authorize public reposting of individual WAV files through an open-source asset repository.
See https://sonniss.com/gdc-bundle-license/ and https://www.101soundboards.com/pages/terms_and_privacy.


## Radio Altimeter — live Unified integration (owner requirement 22 Nov 2026)
- Unified reads the Captain's selected Radio Altimeter signal from `B737UnifiedEfisSources.project('CAPT')` and Captain DH from `B737UnifiedEFISPedestalV1.getState('CAPT').dh`.
- The owner-recorded ten-callout MP3 timeline in `audio-lab/assets/owner-ra-callouts-v1.mp3` is reused; the unidentified ending beep is excluded.
- `APPROACHING MINIMUMS` triggers at exactly DH + 100 ft; `MINIMUMS` triggers at exactly DH. Negative DH (including −20 ft) inhibits both.
- Callouts run only during the active final-approach scenario and only on valid RA input. Missing/unmapped phrases remain silent; no generated audio or TTS fallback.
