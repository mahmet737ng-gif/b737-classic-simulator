# Technical Database — Boeing 737 sources

The shared technical research collection is named **Technical Database** (private user Library folder `/Technical Database`, formerly `/B737`). This is a source collection **separate from** the public simulator code repository. Source material must not be committed to this public repository without verified distribution permissions.

## Available reference corpora

| Source ID | Document | Coverage | Authority | Archive state |
|---|---|---|---|---|
| `FCOM-SEPEHRAN-1937` | Sepehran Airlines Boeing 737 Classic FCOM | 1,937 pages | Primary configuration-tailored systems reference | Private Library full-text, images, vector pages and SQLite archival extraction; semantics QA remains |
| `TD-MRG-CL-NG-2007-PP009-398` | Pat Boone *737 Management Reference Guide* CL + NG | Source PDF pages 9–398, 390 pages | **Secondary, non-approved** guide | Private Library: 390 original full-page JPEGs, 390 OCR text files, 390 word-position JSONs, SQLite FTS5, 29 heuristic table CSV candidates, topic index and standalone offline viewer |

Technical Database Library path: `/Technical Database/Sources/TD-MRG-CL-NG-2007-PP009-398/`.

The MRG original full-page scanned JPEG preserves every table, schematic and illustration **visually**. Only 29 candidate tables were automatically segmented into CSV; the remainder of the tabular content is preserved in text/OCR and original page images, NOT asserted to have cell-accurate structured extraction. OCR and diagram semantics are not manually validated.

**Rules for future chat sessions:**
1. Search the private Library folder by the explicit name **Technical Database**, then query the indexed full text / archive.
2. Always cite `source_id`, physical PDF page, and variant CL or NG where explicitly applicable.
3. FCOM takes precedence over any potentially out-of-date practical advice in MRG; never silently merge 737NG equipment logic into the Classic simulator.
4. Add new manuals as separate versioned source folders, each with a `manifest.json` and indexed corpus. Keep copyrighted complete source scans private.
5. The public simulator GitHub repo remains `b737-classic-simulator`. The current GitHub connector cannot create a new private repository; the **Technical Database** name applies to the persistent private Library collection at present.
