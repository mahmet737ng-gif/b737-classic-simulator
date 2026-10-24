PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS ctr_meta(key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ctr_sources(
 source_id TEXT NOT NULL, revision TEXT NOT NULL, sha256 TEXT NOT NULL,
 metadata_json TEXT NOT NULL, PRIMARY KEY(source_id,revision));
CREATE TABLE IF NOT EXISTS ctr_pages(
 source_id TEXT NOT NULL, source_revision TEXT NOT NULL, pdf_page INTEGER NOT NULL CHECK(pdf_page>0),
 width REAL NOT NULL, height REAL NOT NULL, coordinate_space TEXT NOT NULL,
 extraction_method TEXT NOT NULL, payload_json TEXT NOT NULL,
 PRIMARY KEY(source_id,source_revision,pdf_page),
 FOREIGN KEY(source_id,source_revision) REFERENCES ctr_sources(source_id,revision));
CREATE TABLE IF NOT EXISTS ctr_spans(
 span_id INTEGER PRIMARY KEY, source_id TEXT NOT NULL, source_revision TEXT NOT NULL,
 pdf_page INTEGER NOT NULL, text TEXT NOT NULL, bbox_json TEXT NOT NULL, confidence REAL,
 FOREIGN KEY(source_id,source_revision,pdf_page) REFERENCES ctr_pages(source_id,source_revision,pdf_page));
CREATE TABLE IF NOT EXISTS ctr_table_candidates(
 table_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, source_revision TEXT NOT NULL,
 pdf_page INTEGER NOT NULL, metadata_json TEXT NOT NULL,
 FOREIGN KEY(source_id,source_revision,pdf_page) REFERENCES ctr_pages(source_id,source_revision,pdf_page));
CREATE TABLE IF NOT EXISTS ctr_cells(
 table_id TEXT NOT NULL, row_index INTEGER NOT NULL, col_index INTEGER NOT NULL,
 raw_text TEXT, parsed_json TEXT NOT NULL, metadata_json TEXT NOT NULL,
 PRIMARY KEY(table_id,row_index,col_index),
 FOREIGN KEY(table_id) REFERENCES ctr_table_candidates(table_id));
CREATE TABLE IF NOT EXISTS ctr_regions(
 region_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, source_revision TEXT NOT NULL,
 pdf_page INTEGER NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, metadata_json TEXT NOT NULL,
 FOREIGN KEY(source_id,source_revision,pdf_page) REFERENCES ctr_pages(source_id,source_revision,pdf_page));
CREATE TABLE IF NOT EXISTS ctr_models(
 model_id TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL, quality TEXT NOT NULL,
 payload_json TEXT NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(model_id,revision));
CREATE TABLE IF NOT EXISTS ctr_model_sources(
 model_id TEXT NOT NULL, model_revision INTEGER NOT NULL, source_id TEXT NOT NULL,
 source_revision TEXT NOT NULL, pdf_page INTEGER NOT NULL, reference_json TEXT NOT NULL,
 FOREIGN KEY(model_id,model_revision) REFERENCES ctr_models(model_id,revision),
 FOREIGN KEY(source_id,source_revision,pdf_page) REFERENCES ctr_pages(source_id,source_revision,pdf_page));
CREATE TABLE IF NOT EXISTS ctr_curve_points(
 model_id TEXT NOT NULL, model_revision INTEGER NOT NULL, curve_id TEXT NOT NULL,
 parameter REAL, segment_index INTEGER NOT NULL, point_index INTEGER NOT NULL,
 x REAL NOT NULL,y REAL NOT NULL,
 PRIMARY KEY(model_id,model_revision,curve_id,segment_index,point_index),
 FOREIGN KEY(model_id,model_revision) REFERENCES ctr_models(model_id,revision));
CREATE TABLE IF NOT EXISTS ctr_calculations(
 calculation_id INTEGER PRIMARY KEY, model_id TEXT NOT NULL, model_revision INTEGER NOT NULL,
 inputs_json TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(model_id,model_revision) REFERENCES ctr_models(model_id,revision));
CREATE TABLE IF NOT EXISTS ctr_audit(
 event_id INTEGER PRIMARY KEY, action TEXT NOT NULL, entity_id TEXT NOT NULL,
 details_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS ctr_source_span_index ON ctr_spans(source_id,source_revision,pdf_page);
CREATE INDEX IF NOT EXISTS ctr_model_source_index ON ctr_model_sources(source_id,pdf_page);
CREATE VIEW IF NOT EXISTS ctr_numeric_cells AS
 SELECT table_id,row_index,col_index,raw_text,
 json_extract(parsed_json,'$.value') AS numeric_value,
 json_extract(parsed_json,'$.kind') AS value_kind FROM ctr_cells;
