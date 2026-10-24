# Chart Reader Workbench V2

Users can open their own PDF or raster chart, inspect the original at216dpi,
calibrate axes by clicking three affine or four projective anchors, mark curve
knots and gaps, assign family parameters, paste table cells, and save an
immutable computational model with source/page/units/conditions. A page queue
tracks visual reading separately from machine indexing and numerical coverage.

Run from the repository root:

```bash
python3 -m pip install -r engine/technical_reader_v1/requirements.txt
python3 -m engine.technical_reader_v2 --db /path/to/private/reader.sqlite --open-browser
```

On Windows, double-click `tools/chart-reader/start-windows.cmd` after installing
Python3.11+. It creates an isolated environment on first run and opens a local
browser. The first dependency installation requires network access. Source
uploads and the database are stored locally, outside public GitHub.

For an existing manual and a previously created technical index:

```bash
python3 -m engine.technical_reader_v2 --db /path/to/private/reader.sqlite \
  --pdf /path/to/manual.pdf --index /path/to/technical_index.sqlite \
  --document-id manual-revision-id --open-browser
```

## Supported reading constructions

- Cartesian charts: linear/log axes, rotated affine axes and perspective photos.
- Curve families: explicit labels/parameters, disconnected segments, piecewise
  interpolation with no extrapolation. The normal editor requires one y per x.
- General polylines: split loops at turns and select a named branch; ambiguous
  crossings never silently choose an answer.
- Polar calibration: explicit center, angular zero/direction and radial ticks.
- Tables: rectangular numerical grids, missing cells, categorical exact lookup,
  and textual outputs. Pasted cells retain blanks; interpolation through a blank
  fails. Excel/CSV/PDF extraction from V1 remains available programmatically.
- Alignment nomograms: two input scales, one output scale, nonuniform or log
  ticks, straightedge intersections. Other constructions need an explicit plan.
- Closed envelopes: point-in-polygon with holes and boundary handling.
- Explicit formulas and ordered correction plans reuse V1's audited evaluator.

The basic graphical editor covers Cartesian curves/families, tables and
formulas. Polar, envelope, multiple-valued branch and nomogram definitions use
its advanced JSON editor. Their Python interfaces are in `geometry.py` and
`geometric_models.py`. They are executable geometry, not automatic interpretation
of any previously unseen diagram. Browser image upload is wrapped in a PDF for
viewing; the original image hash and filename remain in document metadata.

## Review and quality

`cr2_*` tables add a resumable workspace beside V1 `ctr_*` model tables. Existing
manual data are never replaced simply because a new engine version exists.
A source revision is identified by SHA256. Page reviews retain the rendered
image hash, source hash, physical page, dimensions, DPI, reviewer and notes.
Rendering or OCR alone never creates a visual-review record. A review record is
an explicit reviewer attestation; software does not prove a human or agent saw
or correctly understood every pixel. Closing numerical coverage requires all
inventoried regions to be converted or documented. It does not certify that the
inventory is exhaustive or that the source numbers are independently approved.

Saved guided models are `simulation_approx`. Imported source models retain their
own quality, including `candidate`; those cannot execute in simulator mode.
Unresolved unit conflicts, printed typos, aliases and configuration conditions
must remain visible. Raw numeric tokens in the inventory are not executable
models and are not counted as digitized charts.

The repository contains reusable code and synthetic tests only. Actual AFM
images, extracted tables, curve points, page reviews and per-page progress are
private Technical Database artifacts. The AFM corpus is **not** fully visually
reviewed or numerically converted by creating this tool. No production cockpit
or existing N1 runtime is rewired by this module.

Validation covers analytical transforms, degenerate calibration, ambiguous
curves, gaps, nomogram/log scales, envelopes, immutable geometry revisions,
source changes, review-state guards, blank table cells, scoped exports and an
actual local HTTP request. Full interactive browser QA has not been performed.
