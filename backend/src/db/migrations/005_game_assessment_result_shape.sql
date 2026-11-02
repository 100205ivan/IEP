-- Normalize the original game result table to the public persistence shape.
-- This migration is intentionally separate because 004 may already be applied
-- in an existing installation.
ALTER TABLE game_assessment_results
  ADD COLUMN id CHAR(36) NULL AFTER assessment_record_id,
  ADD COLUMN result_payload JSON NULL AFTER result_summary,
  ADD COLUMN played_at DATETIME(3) NULL AFTER result_payload,
  ADD COLUMN updated_at DATETIME(3) NULL AFTER created_at;

UPDATE game_assessment_results
SET id = UUID(),
    result_payload = result_data,
    played_at = completed_at,
    updated_at = created_at
WHERE id IS NULL;

ALTER TABLE game_assessment_results
  DROP PRIMARY KEY,
  DROP COLUMN assessment_date,
  DROP COLUMN completed_at,
  DROP COLUMN result_data,
  MODIFY COLUMN id CHAR(36) NOT NULL,
  MODIFY COLUMN result_payload JSON NOT NULL,
  MODIFY COLUMN played_at DATETIME(3) NOT NULL,
  MODIFY COLUMN updated_at DATETIME(3) NOT NULL,
  ADD PRIMARY KEY (id),
  ADD UNIQUE KEY uq_game_assessment_results_record (assessment_record_id),
  DROP KEY idx_game_assessment_results_type_date,
  ADD KEY idx_game_assessment_results_type_played (game_type, played_at);
