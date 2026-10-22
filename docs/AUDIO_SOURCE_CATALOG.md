# B737 Classic — authentic audio sourcing and QA (22 Oct 2026)

## Current implementation
- Audio Lab: 38 sequential test slots, **not** 38 licensed source recordings.
- Imported personal WAV/MP3/OGG/M4A samples stay in browser-local IndexedDB and override synthesized examples only for the matching warning/callout.
- 0 third-party authentic recordings added to this publicly accessible GitHub repository so far.
- 20 warning-engine tests and 13 importer/mapping tests pass; browser real-sample listening is unverified.
- Added per-file audio decoding, duration verification, silence/clipping quality check, stop/start, approve/reject, notes and export.
- Production cockpit assets and controls remain unchanged.

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
