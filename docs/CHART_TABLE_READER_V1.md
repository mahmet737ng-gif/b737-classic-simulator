# Technical Database chart, table and text reader — v1.0.0

The reusable engine reads local technical sources, preserves extraction evidence,
converts explicitly identified chart branches and tables into numerical models,
evaluates them and exports numerical rows, structured records and source-linked
text. It is general infrastructure, not a hard-coded N1 page reader.

Code: `engine/technical_reader_v1/`. Run from repository root with Python 3.11+.
Private data live under `/Technical Database/Engines/Chart-Table-Reader-V1/`.
Parent: `/Technical Database/Technical-Network-V2/B737_TECHNICAL_NETWORK_V2.sqlite`.
All new tables use `ctr_`. The existing eight-source corpus is retained; this
module neither replaces it nor claims to have processed every manual.

## Reading and calculation pipeline

1. Hash and register each source revision; retain source model/engine/rating,
   effectivity, printed folio, physical page and units in source/model metadata.
2. PDF: extract native words, bounding boxes, table candidates and vector line/
   Bezier paths. Scanned pages can use local Tesseract rendering. Force OCR is
   explicit: a PDF with only a native header otherwise stays in native mode.
3. Images: OCR words with confidence and source-pixel bounds; optional crop is
   restored to original coordinates. CSV/TSV: preserve original row lengths and
   blank/absent cells. XLSX: preserve formula text, cached result and merged ranges;
   formulas are not executed during extraction. UTF-8 text retains line positions.
4. Table boundaries, headers, units and axis assignments are explicit inputs.
   `guided_table()` maps OCR spans to declared cells and flags border crossings.
   `table_to_grid()` makes a 2D numeric candidate; headers and all raw cells remain.
   Bounds such as `<10`, ambiguous separators and missing values never become zero.
5. Chart ticks calibrate linear/logarithmic/reversed/piecewise axes. Source tracing
   supplies separately named pixel branches; `digitize_trace()` converts them to
   numerical points. Raster scanline assistance and native paths supply candidates,
   not inferred altitude/temperature labels. Split curves at gaps, discontinuities
   or multiple-valued sections. Unwrap angular axes before import if needed.
6. Validate against separately read checkpoints with tolerances. A passing structural
   check does not change source validation. Store a new immutable model revision
   with the validation evidence. The simulator may explicitly use `traced` or
   `simulation_approx` records without implying that their source values were verified.
7. Evaluate: piecewise linear or log interpolation, family-parameter interpolation,
   arbitrary-dimensional rectangular grid interpolation, exact categorical lookup,
   or an explicitly declared arithmetic formula. Preserve all knot points.
8. Ordered plans combine main charts, correction charts and formulas. Each step
   pins its model revision, inputs, unit contract and applicable conditions.
9. Export SQLite, JSON, CSV numerical samples and provenance-bearing text.
   Every calculation returns a numerical/text result, explanation, contributing
   points/weights, quality, assumptions, limitations and declared error bounds.

## Contracts and scope

Each model has `id`, integer `revision`, `kind`, `title`, `quality`, `provenance`,
`inputs` with names/units, `output` with name/unit and optional exact `conditions`.
Each provenance reference has `source_id`, `source_revision`, 1-based `pdf_page`,
and optionally `printed_folio`, `bbox` and `coordinate_space` (`pixel` or `pdf_point`).
For an image source, page 1 means the image; upstream physical PDF page is a
separate field, never an assertion that the PDF itself was read.

`curve`: `segments: [{points: [[x,y],...]}]`.
`family`: `curves: [{id,parameter,segments}]`; inputs ordered `[x,parameter]`.
`grid`: axes in input order; flat values with the last axis varying fastest.
`lookup`: rows of exact `keys` and numeric/string `value`.
`formula`: arithmetic expression over declared input names; only `+ - * / **`,
`min`, `max`, `abs`, `sqrt`, `log10`. No `eval`, imports, attributes or arbitrary code.
Formulas require explicit output units; full symbolic dimensional analysis is not
implemented. Native input numbers must already use declared units; use the explicit
unit converter or a documented conversion stage when necessary.

Optional `conditions` are exact selectors such as engine variant, PMC, bleed or
equipment configuration. Missing/mismatched conditions fail. There is no implicit
cross-variant substitution. An owner-accepted simulator surrogate is a separate
model with its original source identity, assumptions and `simulation_approx` quality.

Default `validated` mode accepts only models with `quality=validated` and evidence.
`--mode simulator` additionally permits `traced` and `simulation_approx`. Candidate
and rejected records are stored/searchable but do not execute in either mode.
This is a data-quality distinction, not a new project-wide approval requirement.

Out-of-domain requests, blank grid corners, ambiguous overlapping branches,
unknown revisions and unresolved conditions produce explicit errors. Unknown
uncertainty stays null; a declared model-wide absolute bound is reported as such.
No error bound is inferred from OCR confidence. Plan-level error propagation is
not implemented, and the final plan result says so.

This version does **not** autonomously resolve every monochrome chart intersection,
warped/photo perspective, nomogram reading order, scanned multi-level header or
handwritten note. Those layouts require an explicit calibration/mapping/trace.
Vector paths can include grid lines/text; they are candidates, not numerical laws.
Rotated/skewed/perspective raster images need rectification before axis calibration.
This release does not replace N1 v19 estimates or alter existing CDU/gauge wiring.

## Usage

```bash
python3 -m pip install -r engine/technical_reader_v1/requirements.txt
python3 -m engine.technical_reader_v1 --db reader.sqlite init
python3 -m engine.technical_reader_v1 --db reader.sqlite ingest manual.pdf \
  --source-id MY-SOURCE --revision r1 --options '{"pages":[128],"force_ocr":true}'
python3 -m engine.technical_reader_v1 --db reader.sqlite ingest table.csv \
  --source-id MY-TABLE --revision r1
python3 -m engine.technical_reader_v1 --db reader.sqlite import-model model.json
python3 -m engine.technical_reader_v1 --db reader.sqlite calculate MODEL-ID \
  --revision 1 --inputs '{"x":2}' --mode simulator
python3 -m engine.technical_reader_v1 --db reader.sqlite linearize MODEL-ID \
  --revision 1 --step 0.5 --out rows.csv
python3 -m engine.technical_reader_v1 --db reader.sqlite export --out export.json
python3 -m engine.technical_reader_v1 --db reader.sqlite export --format text --out source.txt
```

`digitize trace.json --out model.json` accepts `model` (the model template),
`x_axis`, `y_axis` (anchors as `[pixel,value]` pairs plus scale/unit), and
`pixel_segments` (each disconnected branch segment as an array of `[x,y]`).
The command imports the calibrated model, including raw pixel points and anchors.

```python
from engine.technical_reader_v1 import TechnicalStore
from engine.technical_reader_v1.tables import table_to_grid
from engine.technical_reader_v1.plans import calculate_plan
store = TechnicalStore("reader.sqlite")
# Models are imported against registered source pages; pin every revision.
# calculate_plan(store, steps, inputs, context=conditions, mode="simulator")
store.close()
```

## Private storage and integration

`ctr_sources`, `ctr_pages`, `ctr_spans`, `ctr_table_candidates`, `ctr_cells` and
`ctr_regions` retain raw reading evidence. `ctr_models`, `ctr_model_sources` and
`ctr_curve_points` retain immutable normalized numerical models and branch points.
`ctr_calculations` and `ctr_audit` retain execution and import history.
`ctr_numeric_cells` exposes cell kinds and numeric values. `ctr_text_fts` provides
an FTS5 index when available; literal page search is always available.

To query with the existing corpus, open that corpus read-only and attach this
additive reader database separately, then join on source_id and physical page.
Do not assume every historical archive has the same physical/local page mapping.
The private SOURCE_REGISTRY entry points to this engine; source texts, OCR outputs,
digitized proprietary data and database stay private. Public GitHub contains the
reusable engine, schema, documentation, synthetic tests and non-source manifest.

Tests: `python3 -m unittest discover -s tests/technical-reader-v1 -v`.
Before repository publication also run `python3 panel-mosaic-lab/verify-final-overhead.py`.
