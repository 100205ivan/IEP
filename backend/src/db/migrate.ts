import { pool } from '../config/database.js'
import type { RowDataPacket } from 'mysql2'

const initialMigration = `
CREATE TABLE IF NOT EXISTS students (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  gender VARCHAR(20) NOT NULL DEFAULT '',
  birth_date DATE NULL,
  national_id VARCHAR(32) NULL,
  student_number VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_students_national_id (national_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`

const iepMigration = `
CREATE TABLE IF NOT EXISTS ieps (
  id CHAR(36) NOT NULL PRIMARY KEY,
  student_id CHAR(36) NOT NULL,
  academic_year SMALLINT UNSIGNED NOT NULL,
  content JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_ieps_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE KEY uq_ieps_student_year (student_id, academic_year),
  KEY idx_ieps_student (student_id),
  KEY idx_ieps_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`

const assessmentRecordMigration = `
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
`

const assessmentDocumentAnalysisMigration = `
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
`

const gameAssessmentResultMigration = `
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
`

export async function runMigrations() {
  const connection = await pool.getConnection()
  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(32) NOT NULL PRIMARY KEY, applied_at DATETIME(3) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
    const [rows] = await connection.query<(RowDataPacket & { version: string })[]>('SELECT version FROM schema_migrations')
    const applied = new Set(rows.map((row) => row.version))
    if (!applied.has('001_initial')) {
      await connection.beginTransaction()
      try {
        await connection.query(initialMigration)
        await connection.query(iepMigration)
        await connection.query('INSERT INTO schema_migrations (version, applied_at) VALUES (?, CURRENT_TIMESTAMP(3))', ['001_initial'])
        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      }
    }
    if (!applied.has('002_assessment_records')) {
      await connection.beginTransaction()
      try {
        await connection.query(assessmentRecordMigration)
        await connection.query('INSERT INTO schema_migrations (version, applied_at) VALUES (?, CURRENT_TIMESTAMP(3))', ['002_assessment_records'])
        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      }
    }
    if (!applied.has('003_assessment_document_analyses')) {
      await connection.beginTransaction()
      try {
        await connection.query(assessmentDocumentAnalysisMigration)
        await connection.query('INSERT INTO schema_migrations (version, applied_at) VALUES (?, CURRENT_TIMESTAMP(3))', ['003_assessment_document_analyses'])
        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      }
    }
    if (!applied.has('004_game_assessment_results')) {
      await connection.beginTransaction()
      try {
        await connection.query(gameAssessmentResultMigration)
        await connection.query('INSERT INTO schema_migrations (version, applied_at) VALUES (?, CURRENT_TIMESTAMP(3))', ['004_game_assessment_results'])
        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      }
    }
  } finally {
    connection.release()
  }
}
