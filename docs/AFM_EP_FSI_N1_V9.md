# AFM EP-FSI N1 stage v9

Status: SOURCE SELECTION IMPLEMENTED, NUMERIC N1 BLOCKED.

Aircraft: EP-FSI / ASN 29340 / CFM56-3B-1 / rating 20000 lbf (owner-provided).

Verified reference chart selection from original AFM Rev32 images:
- PDF p128 Section 4.2 Page 4: Takeoff N1 PMC NORMAL.
- PDF p129 Section 4.2 Page 5: Go-Around N1 PMC NORMAL.
- PDF p130 Section 4.2 Page 6: Maximum Continuous in-flight N1.
- PDF p755–756 Appendix 2UK: PMC OFF Takeoff N1, with separate MAXIMUM N1 limit.
- PDF p862–864 Appendix 33: 20K applicability and use of appropriate base or appendix chart.

New module: engine/fmc/performance/afm-epfsi-n1-v9.cjs.
Test command: node tests/afm-epfsi-n1-v9.test.cjs (14 PASS).

Private Library v9 also contains a source chart registry, 9 selection/condition rules, 12 provisional grid-tick anchors, a numeric digitization QA worksheet, and prior aircraft-specific v8 data. None of these tick anchors is approved for numerical thrust interpolation. VERIFIED N1 curve points: 0.

The module blocks any other serial number, engine, or rating, and does not invent a value when PMC is unknown or curve data unverified. Current CDU and Autothrottle behavior have NOT been changed. Future CDU numeric link remains conditional on full trace, effectivity, bleed/anti-ice/PMC QA.

Private Boeing source material and scanned page images must stay in the private Technical Database at /Technical Database/Sources/AFM-737-33V-D6-8730-R32/EP-FSI-ASN29340/v9/ . Only source IDs, selection engine and nonproprietary metadata are committed publicly. Not for real aircraft operations.

## Private digitization helper

The offline file `chart_digitizer.html`, accompanying AFM source-page images, and manual two-pass A/B coordinate capture/export are in the **private** v9 archive. It has passed JavaScript syntax checking only; GUI/browser end-to-end verification was blocked by the runtime environment. Coordinates have **PROVISIONAL** source-image status and may not drive numerical N1 until separate engineering QA. The private N1_DIGITIZATION_WORKSHEET.csv has 145 pending trace work items.
