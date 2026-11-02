import { createHash } from 'node:crypto'
import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { chapterTableSql, iepChapterTables, remainingIepContent } from '../iepChapterTables.js'
import { parseIepContent, writeIepChapters } from '../../services/iepChapterStorage.js'

export const iepChapterMigrationVersion = '006_iep_chapter_tables'

export async function migrateIepChapterTables(connection: PoolConnection) {
  const [databases] = await connection.query<RowDataPacket[]>('SELECT DATABASE() AS name')
  const lockName = `eyeep_chapters_${createHash('sha256').update(databases[0].name).digest('hex').slice(0, 40)}`
  const [locks] = await connection.execute<RowDataPacket[]>('SELECT GET_LOCK(?, 30) AS acquired', [lockName])
  if (Number(locks[0].acquired) !== 1) throw new Error('Could not acquire the IEP chapter migration lock.')
  try {
    const [applied] = await connection.execute<RowDataPacket[]>('SELECT version FROM schema_migrations WHERE version = ?', [iepChapterMigrationVersion])
    if (applied.length) return
    // MariaDB DDL commits implicitly. Create retryable empty tables first, then
    // move all data and record the version together in a separate transaction.
    for (const chapter of iepChapterTables) {
      await connection.query(chapterTableSql(chapter))
      const [existing] = await connection.query<RowDataPacket[]>(`SELECT iep_id FROM ${chapter.table} LIMIT 1`)
      if (existing.length) throw new Error(`Unversioned data found in ${chapter.table}; migration stopped without overwriting it.`)
    }
    await connection.beginTransaction()
    try {
      const [rows] = await connection.query<(RowDataPacket & { id: string; content: string; created_at: string; updated_at: string })[]>('SELECT id, content, created_at, updated_at FROM ieps FOR UPDATE')
      for (const row of rows) {
        const content = parseIepContent(row.content)
        await writeIepChapters(connection, row.id, content, row.created_at, row.updated_at)
        await connection.execute('UPDATE ieps SET content = ? WHERE id = ?', [JSON.stringify(remainingIepContent(content)), row.id])
      }
      await connection.execute('INSERT INTO schema_migrations (version, applied_at) VALUES (?, CURRENT_TIMESTAMP(3))', [iepChapterMigrationVersion])
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    }
  } finally {
    await connection.execute('SELECT RELEASE_LOCK(?)', [lockName])
  }
}
