CREATE TABLE IF NOT EXISTS assessment_document_analyses (
  assessment_record_id CHAR(36) NOT NULL PRIMARY KEY,
  analysis_id CHAR(36) NOT NULL,
  document_info JSON NOT NULL,
  overall_summary TEXT NOT NULL,
  domains JSON NOT NULL,
  warnings JSON NOT NULL,
  analyzed_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_document_analyses_record FOREIGN KEY (assessment_record_id) REFERENCES assessment_records(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_document_analyses_analysis_id (analysis_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
