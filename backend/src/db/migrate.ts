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
  } finally {
    connection.release()
  }
}
