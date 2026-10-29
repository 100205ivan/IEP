CREATE TABLE IF NOT EXISTS game_assessment_results (
  assessment_record_id CHAR(36) NOT NULL PRIMARY KEY,
  result_id CHAR(36) NOT NULL,
  game_type VARCHAR(16) NOT NULL,
  assessment_date DATE NOT NULL,
  completed_at DATETIME(3) NOT NULL,
  result_summary TEXT NOT NULL,
  result_data JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_game_assessment_results_record FOREIGN KEY (assessment_record_id) REFERENCES assessment_records(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_game_assessment_results_result_id (result_id),
  KEY idx_game_assessment_results_type_date (game_type, assessment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
