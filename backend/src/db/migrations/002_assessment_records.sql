CREATE TABLE IF NOT EXISTS assessment_records (
  id CHAR(36) NOT NULL PRIMARY KEY,
  student_id CHAR(36) NOT NULL,
  iep_id CHAR(36) NOT NULL,
  source VARCHAR(16) NOT NULL,
  assessment_date DATE NOT NULL,
  assessment_type VARCHAR(80) NOT NULL,
  other_assessment_type VARCHAR(120) NOT NULL DEFAULT '',
  assessment_tool VARCHAR(255) NOT NULL,
  evaluator VARCHAR(120) NOT NULL,
  summary TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_assessment_records_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  CONSTRAINT fk_assessment_records_iep FOREIGN KEY (iep_id) REFERENCES ieps(id) ON DELETE RESTRICT,
  KEY idx_assessment_records_iep_created (iep_id, created_at),
  KEY idx_assessment_records_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
