-- DDL reference: application migration first checks that chapter timestamps
-- match ieps and immutable game updated_at matches created_at. Start the
-- backend to run those checks and resume partial migrations automatically.
ALTER TABLE iep_assessments DROP COLUMN created_at, DROP COLUMN updated_at;
ALTER TABLE iep_services DROP COLUMN created_at, DROP COLUMN updated_at;
ALTER TABLE iep_goals DROP COLUMN created_at, DROP COLUMN updated_at;
ALTER TABLE iep_behavior_interventions DROP COLUMN created_at, DROP COLUMN updated_at;
ALTER TABLE iep_transitions DROP COLUMN created_at, DROP COLUMN updated_at;
ALTER TABLE iep_meetings DROP COLUMN created_at, DROP COLUMN updated_at;
ALTER TABLE game_assessment_results DROP COLUMN updated_at;
