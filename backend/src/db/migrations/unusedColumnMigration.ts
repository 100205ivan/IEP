import { createHash } from 'node:crypto'
import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { iepChapterTables } from '../iepChapterTables.js'

export const unusedColumnMigrationVersion = '007_unused_columns'

export async function removeUnusedColumns(connection: PoolConnection) {
  const [databases] = await connection.query<RowDataPacket[]>('SELECT DATABASE() AS name')
  const lockName = `eyeep_cleanup_${createHash('sha256').update(databases[0].name).digest('hex').slice(0, 40)}`
  const [locks] = await connection.execute<RowDataPacket[]>('SELECT GET_LOCK(?, 30) AS acquired', [lockName])
  if (Number(locks[0].acquired) !== 1) throw new Error('Could not acquire the unused column migration lock.')
  try {
    const [applied] = await connection.execute<RowDataPacket[]>('SELECT version FROM schema_migrations WHERE version = ?', [unusedColumnMigrationVersion])
    if (applied.length) return
    const [prerequisite] = await connection.execute<RowDataPacket[]>('SELECT version FROM schema_migrations WHERE version = ?', ['006_iep_chapter_tables'])
    if (!prerequisite.length) throw new Error('Chapter migration 006 must complete before unused columns are removed.')
    const tables = [...iepChapterTables.map(chapter => chapter.table), 'game_assessment_results']
    const [columns] = await connection.execute<RowDataPacket[]>(`SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${tables.map(() => '?').join(', ')})`, tables)
    const has = (table: string, column: string) => columns.some(row => row.TABLE_NAME === table && row.COLUMN_NAME === column)
    const alterations: string[] = []

    // Check every candidate before any DDL. Unique historical timestamps are
    // not unused data and must never be silently discarded by this cleanup.
    for (const chapter of iepChapterTables) {
      const redundant = ['created_at', 'updated_at'].filter(column => has(chapter.table, column))
      if (!redundant.length) continue
      const differences = redundant.map(column => `NOT(c.${column} <=> p.${column})`).join(' OR ')
      const [rows] = await connection.query<RowDataPacket[]>(`SELECT c.iep_id FROM ${chapter.table} c INNER JOIN ieps p ON p.id = c.iep_id WHERE ${differences} LIMIT 1`)
      if (rows.length) throw new Error(`Distinct timestamps found in ${chapter.table}; cleanup stopped before changing any table.`)
      alterations.push(`ALTER TABLE ${chapter.table} ${redundant.map(column => `DROP COLUMN ${column}`).join(', ')}`)
    }
    if (has('game_assessment_results', 'updated_at')) {
      const [rows] = await connection.query<RowDataPacket[]>('SELECT id FROM game_assessment_results WHERE NOT(updated_at <=> created_at) LIMIT 1')
      if (rows.length) throw new Error('Distinct game update timestamps found; cleanup stopped before changing any table.')
      alterations.push('ALTER TABLE game_assessment_results DROP COLUMN updated_at')
    }
    // MariaDB DDL commits implicitly. Inspecting which columns remain makes a
    // partially completed cleanup safely resumable after a process failure.
    for (const sql of alterations) await connection.query(sql)
    await connection.execute('INSERT INTO schema_migrations (version, applied_at) VALUES (?, CURRENT_TIMESTAMP(3))', [unusedColumnMigrationVersion])
  } finally {
    await connection.execute('SELECT RELEASE_LOCK(?)', [lockName])
  }
}
