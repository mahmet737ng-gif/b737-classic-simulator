# B737 Classic — 18 Guard Location Audit (2026-10-27)

This file is a **measurement/review report**, not a final certified mounting or a live switch installation.

## Latest owner totals
17 primary guards: **11 TOP, 3 LEFT, 3 RIGHT**; **3 RED, 14 BLACK**.
Additional #18: **STAB TRIM** on lower-right pedestal.
No physical dimensions in millimeters have been verified.

## Native source-image socket bounding boxes
All coordinates are **[left, top, width, height] pixels** in each original panel image, not the browser viewport. The standalone JSON next to this report contains projected cockpit canvas coordinates and provenance.

| # | Guard | Panel | Native photo box [x,y,w,h] | Hinge | Color | Confidence |
|--:|---|---|---|---|---|---|
|1|FLT CONTROL A|OH07|135,100,165,265|TOP|black|preview estimate|
|2|FLT CONTROL B|OH07|305,100,165,265|TOP|black|preview estimate|
|3|SPOILER A|OH07|135,655,165,275|TOP|black|preview estimate|
|4|SPOILER B|OH07|304,655,165,275|TOP|black|preview estimate|
|5|ALT FLAPS MASTER|OH07|517,408,135,277|RIGHT (provisional)|red|preview estimate|
|6|BATTERY MASTER|OH10|186,1141,156,201|TOP|black|preview estimate|
|7|GEN DRIVE DISCONNECT 1|OH11|154,334,200,418|TOP|red|prior calibrated aperture|
|8|GEN DRIVE DISCONNECT 2|OH11|847,334,200,418|TOP|red|prior calibrated aperture|
|9|STANDBY POWER|OH11|391,232,421,184|LEFT|black|prior calibrated aperture|
|10|EMER EXIT LIGHTS|OH14|450,174,300,710|TOP|black|preview estimate; outer mounting frame|
|11|BUS TRANSFER|OH12|325,460,368,148|LEFT|black|prior aperture estimate|
|12|PASS OXYGEN|UPPER|1240,535,100,180|RIGHT (provisional)|black (provisional)|preview estimate|
|13|FLIGHT RECORDER TEST|UPPER|1365,438,113,34|LEFT|black|prior source location|
|14|ANTI-SKID|MAIN reference|1243,345,55,93|RIGHT (provisional)|black|main reference only|
|15|GPWS FLAP INHIBIT|MAIN reference|1455,699,58,82|TOP|black|main reference only|
|16|GPWS GEAR INHIBIT|MAIN reference|1515,699,58,82|TOP|black|main reference only|
|17|GPWS TERRAIN INHIBIT|MAIN reference|**not present**|TOP|black|unlocated, no invented coordinates|
|18|STAB TRIM|PEDESTAL_RADIO|798,1153,89,155|unconfirmed|black (reference)|pedestal source estimate|

## Critical constraints and remaining gates
- Prior recorded owner quiz: 11 TOP, **3 BOTTOM**, 3 LEFT; latest request: 11 TOP, 3 LEFT, **3 RIGHT**. RIGHT assignment currently copies the three former BOTTOM entries for **provisional reconciliation only**, not re-confirmed individually.
- Previous colors included **four red** (ALT FLAPS, 2 x GENERATOR DISCONNECT, PASS OXYGEN). Latest is **three red**; PASS OXYGEN is provisionally changed to black pending a direct confirmation.
- GPWS TERRAIN INHIBIT has **no identifiable socket** on the existing main-panel reference. No fake fourth main socket is to be drawn.
- The photographed ANTISKID and GPWS FLAP/GEAR rectangles are on `assets/main-panel.webp`, **not verified to register one-to-one on the 5 independently composed main instrument panel layers**.
- STAB TRIM is photographed on the bottom-right pedestal. Cover hinge orientation has not been supplied. The estimate is for the aperture; it is not a 100%-pixel-certified sprite size.
- All 18 locations are **audit only**. Do not remove/change locked panel source images; do not install unconfirmed target sprites.
