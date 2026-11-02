import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createConnection, createPool, type RowDataPacket } from 'mysql2/promise'
import '../config/environment.js'
import { chapterJsonValue, chapterTableSql, iepChapterTables, remainingIepContent } from '../db/iepChapterTables.js'
import { removeUnusedColumns, unusedColumnMigrationVersion } from '../db/migrations/unusedColumnMigration.js'
import { readIepContents, writeIepChapters } from '../services/iepChapterStorage.js'

test('unused column cleanup preserves data, checks history and resumes partial DDL', async t => {
  const databaseName = `eyeep_cleanup_test_${randomUUID().replaceAll('-', '')}`
  const settings = { host: process.env.DB_HOST ?? '127.0.0.1', port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER ?? 'root', password: process.env.DB_PASSWORD ?? '' }
  const admin = await createConnection(settings)
  await admin.query('CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [databaseName])
  const pool = createPool({ ...settings, database: databaseName, dateStrings: true })
  const connection = await pool.getConnection()
  t.after(async () => {
    connection.release()
    await pool.end()
    assert.match(databaseName, /^eyeep_cleanup_test_[a-f0-9]{32}$/)
    try { await admin.query('DROP DATABASE ??', [databaseName]) } finally { await admin.end() }
  })
  for (const file of ['001_initial.sql', '002_assessment_records.sql', '004_game_assessment_results.sql', '005_game_assessment_result_shape.sql']) {
    const sql = await readFile(new URL(`../db/migrations/${file}`, import.meta.url), 'utf8')
    for (const statement of sql.split(';').filter(value => value.trim())) await connection.query(statement)
  }
  await connection.query('CREATE TABLE schema_migrations (version VARCHAR(32) NOT NULL PRIMARY KEY, applied_at DATETIME(3) NOT NULL) ENGINE=InnoDB')
  await connection.execute('INSERT INTO schema_migrations VALUES (?, CURRENT_TIMESTAMP(3))', ['006_iep_chapter_tables'])
  const studentId = randomUUID(), iepId = randomUUID(), assessmentId = randomUUID(), gameId = randomUUID()
  const timestamp = '2026-11-02 08:00:00.123'
  const content: Record<string, unknown> = Object.fromEntries(iepChapterTables.flatMap(chapter => chapter.fields.map(([key]) => [key, { synthetic: key } ])))
  content.learningNotes = '合成說明\n第二行'
  content.basicInfoReviewNotice = { inheritedFromAcademicYear: 114, requiresReview: true }
  await connection.execute('INSERT INTO students (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [studentId, '王曉明', timestamp, timestamp])
  await connection.execute('INSERT INTO ieps (id, student_id, academic_year, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [iepId, studentId, 115, JSON.stringify(remainingIepContent(content)), timestamp, timestamp])
  for (const chapter of iepChapterTables) {
    await connection.query(chapterTableSql(chapter))
    const columns = chapter.fields.map(([, column]) => column)
    await connection.execute(`INSERT INTO ${chapter.table} (iep_id, ${columns.join(', ')}, created_at, updated_at) VALUES (${Array(columns.length + 3).fill('?').join(', ')})`, [iepId, ...chapter.fields.map(([key]) => chapterJsonValue(content, key)), timestamp, timestamp])
  }
  await connection.execute('INSERT INTO assessment_records (id, student_id, iep_id, source, assessment_date, assessment_type, assessment_tool, evaluator, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [assessmentId, studentId, iepId, 'monkey', '2026-11-02', '認知遊戲評量', '合成工具', '測試人員', '合成摘要', timestamp, timestamp])
  const gamePayload = { age: 10, result: { totalScore: 100, questionResults: [] } }
  await connection.execute('INSERT INTO game_assessment_results (id, assessment_record_id, result_id, game_type, result_summary, result_payload, played_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [gameId, assessmentId, randomUUID(), 'monkey', '合成摘要', JSON.stringify(gamePayload), timestamp, timestamp, timestamp])
  const read = async () => {
    const [rows] = await connection.query<(RowDataPacket & { id: string; content: string })[]>('SELECT id, content FROM ieps')
    return (await readIepContents(connection, rows)).get(iepId)
  }
  const remainingColumns = async () => {
    const [rows] = await connection.query<RowDataPacket[]>('SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()')
    return rows.filter(row => (iepChapterTables.some(chapter => chapter.table === row.TABLE_NAME) && ['created_at', 'updated_at'].includes(row.COLUMN_NAME)) || (row.TABLE_NAME === 'game_assessment_results' && row.COLUMN_NAME === 'updated_at'))
  }
  assert.equal((await remainingColumns()).length, 13)
  await t.test('distinct chapter timestamps stop cleanup before any table changes', async () => {
    await connection.execute('UPDATE iep_meetings SET updated_at = ? WHERE iep_id = ?', ['2026-11-03 08:00:00.123', iepId])
    await assert.rejects(removeUnusedColumns(connection), /Distinct timestamps/)
    assert.equal((await remainingColumns()).length, 13)
    assert.deepEqual(await read(), content)
    await connection.execute('UPDATE iep_meetings SET updated_at = ? WHERE iep_id = ?', [timestamp, iepId])
  })
  await t.test('distinct game update history also stops all chapter alterations', async () => {
    await connection.execute('UPDATE game_assessment_results SET updated_at = ? WHERE id = ?', ['2026-11-03 08:00:00.123', gameId])
    await assert.rejects(removeUnusedColumns(connection), /Distinct game update timestamps/)
    assert.equal((await remainingColumns()).length, 13)
    await connection.execute('UPDATE game_assessment_results SET updated_at = ? WHERE id = ?', [timestamp, gameId])
  })
  await t.test('partial cleanup resumes and removes only the thirteen redundant columns', async () => {
    await connection.query('ALTER TABLE iep_assessments DROP COLUMN created_at')
    await removeUnusedColumns(connection)
    assert.deepEqual(await remainingColumns(), [])
    assert.deepEqual(await read(), content)
    const [parents] = await connection.execute<RowDataPacket[]>('SELECT created_at, updated_at, content FROM ieps WHERE id = ?', [iepId])
    assert.equal(parents[0].created_at, timestamp)
    assert.equal(parents[0].updated_at, timestamp)
    assert.deepEqual(JSON.parse(parents[0].content), remainingIepContent(content))
    const [games] = await connection.execute<RowDataPacket[]>('SELECT * FROM game_assessment_results WHERE id = ?', [gameId])
    assert.equal(games[0].created_at, timestamp)
    assert.equal(games[0].played_at, timestamp)
    assert.deepEqual(JSON.parse(games[0].result_payload), gamePayload)
    assert.equal(games[0].assessment_record_id, assessmentId)
    const [keys] = await connection.query<RowDataPacket[]>("SELECT TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'ieps'")
    for (const chapter of iepChapterTables) assert.ok(keys.some(row => row.TABLE_NAME === chapter.table))
  })
  await t.test('re-running completed cleanup leaves one migration version and all data intact', async () => {
    await removeUnusedColumns(connection)
    const [versions] = await connection.execute<RowDataPacket[]>('SELECT version FROM schema_migrations WHERE version = ?', [unusedColumnMigrationVersion])
    assert.equal(versions.length, 1)
    assert.deepEqual(await read(), content)
  })
  await t.test('chapter writer works after timestamp removal without changing the API content', async () => {
    await connection.beginTransaction()
    try {
      const changed = { ...content, learningNotes: '清理後修改' }
      await writeIepChapters(connection, iepId, changed)
      assert.deepEqual(await read(), changed)
    } finally { await connection.rollback() }
    assert.deepEqual(await read(), content)
  })
})
