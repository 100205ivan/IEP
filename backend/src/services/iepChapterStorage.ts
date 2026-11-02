import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { chapterJsonValue, iepChapterTables, remainingIepContent } from '../db/iepChapterTables.js'

export type IepContentRow = { id: string; content: string | Record<string, unknown> }

export function parseIepContent(value: IepContentRow['content']): Record<string, unknown> {
  return typeof value === 'string' ? JSON.parse(value) as Record<string, unknown> : value
}

// The caller owns the transaction, covering the parent IEP and every chapter.
export async function writeIepChapters(connection: PoolConnection, iepId: string, content: Record<string, unknown>) {
  for (const chapter of iepChapterTables) {
    const columns = chapter.fields.map(([, column]) => column)
    await connection.execute(
      `INSERT INTO ${chapter.table} (iep_id, ${columns.join(', ')})
       VALUES (${Array(columns.length + 1).fill('?').join(', ')})
       ON DUPLICATE KEY UPDATE ${columns.map(column => `${column} = VALUES(${column})`).join(', ')}`,
      [iepId, ...chapter.fields.map(([key]) => chapterJsonValue(content, key))],
    )
  }
}

// Fetch all requested IEPs together, avoiding one chapter query per IEP/year.
export async function readIepContents(connection: PoolConnection, rows: IepContentRow[]): Promise<Map<string, Record<string, unknown>>> {
  const contents = new Map(rows.map(row => [row.id, remainingIepContent(parseIepContent(row.content))]))
  if (rows.length === 0) return contents
  const placeholders = rows.map(() => '?').join(', ')
  for (const chapter of iepChapterTables) {
    // CAST also keeps JSON scalar strings distinct from already-parsed objects.
    const columns = chapter.fields.map(([, column]) => `CAST(${column} AS CHAR CHARACTER SET utf8mb4) AS ${column}`)
    const [stored] = await connection.execute<RowDataPacket[]>(`SELECT iep_id, ${columns.join(', ')} FROM ${chapter.table} WHERE iep_id IN (${placeholders})`, rows.map(row => row.id))
    for (const row of stored) {
      const content = contents.get(row.iep_id)
      if (!content) continue
      for (const [key, column] of chapter.fields) if (row[column] !== null) content[key] = JSON.parse(row[column])
    }
  }
  return contents
}
