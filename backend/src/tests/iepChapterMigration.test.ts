import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createConnection, createPool, type RowDataPacket } from 'mysql2/promise'
import '../config/environment.js'
import { chapterJsonValue, iepChapterTables, remainingIepContent } from '../db/iepChapterTables.js'
import { iepChapterMigrationVersion, migrateIepChapterTables } from '../db/migrations/iepChapterMigration.js'
import { readIepContents, writeIepChapters } from '../services/iepChapterStorage.js'

test('chapter migration preserves legacy IEPs and is retryable without touching the configured database', async t => {
  const databaseName = `eyeep_chapter_migration_test_${randomUUID().replaceAll('-', '')}`
  const settings = { host: process.env.DB_HOST ?? '127.0.0.1', port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER ?? 'root', password: process.env.DB_PASSWORD ?? '' }
  const admin = await createConnection(settings)
  await admin.query('CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [databaseName])
  const pool = createPool({ ...settings, database: databaseName, dateStrings: true, connectionLimit: 2 })
  const connection = await pool.getConnection()
  t.after(async () => {
    connection.release()
    await pool.end()
    assert.match(databaseName, /^eyeep_chapter_migration_test_[a-f0-9]{32}$/)
    try { await admin.query('DROP DATABASE ??', [databaseName]) } finally { await admin.end() }
  })
  const initialSql = await readFile(new URL('../db/migrations/001_initial.sql', import.meta.url), 'utf8')
  for (const statement of initialSql.split(';').filter(value => value.trim())) await connection.query(statement)
  await connection.query('CREATE TABLE schema_migrations (version VARCHAR(32) NOT NULL PRIMARY KEY, applied_at DATETIME(3) NOT NULL) ENGINE=InnoDB')
  const studentId = randomUUID(), iepId = randomUUID(), emptyIepId = randomUUID()
  const timestamp = '2026-11-02 08:00:00.123'
  await connection.execute('INSERT INTO students (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [studentId, '王曉明', timestamp, timestamp])
  const original: Record<string, unknown> = Object.fromEntries(iepChapterTables.flatMap(chapter => chapter.fields.map(([key]) => [key, { test: key, nested: ['合成資料', false, null] }])))
  original.learningNotes = '學習說明\n第二行'
  original.assessmentDetails = null
  original.meetingRecords = []
  original.basicInfoReviewNotice = { inheritedFromAcademicYear: 114 }
  original.futureChapter = { keep: true }
  for (const [id, year, content] of [[iepId, 115, original], [emptyIepId, 116, {}]] as const) {
    await connection.execute('INSERT INTO ieps (id, student_id, academic_year, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, studentId, year, JSON.stringify(content), timestamp, timestamp])
  }
  const read = async () => {
    const [rows] = await connection.query<(RowDataPacket & { id: string; content: string })[]>('SELECT id, content FROM ieps')
    return readIepContents(connection, rows)
  }

  await t.test('all chapter fields move losslessly and metadata stays on the parent', async () => {
    await migrateIepChapterTables(connection)
    const content = await read()
    assert.deepEqual(content.get(iepId), original)
    assert.deepEqual(content.get(emptyIepId), {})
    const [parents] = await connection.execute<RowDataPacket[]>('SELECT content, created_at, updated_at FROM ieps WHERE id = ?', [iepId])
    assert.deepEqual(JSON.parse(parents[0].content), remainingIepContent(original))
    assert.equal(parents[0].created_at, timestamp)
    assert.equal(parents[0].updated_at, timestamp)
    for (const chapter of iepChapterTables) {
      const [rows] = await connection.execute<RowDataPacket[]>(`SELECT * FROM ${chapter.table} WHERE iep_id = ?`, [iepId])
      assert.equal(rows.length, 1)
      assert.equal(rows[0].created_at, timestamp)
      for (const [key, column] of chapter.fields) assert.equal(rows[0][column], chapterJsonValue(original, key))
    }
  })
  await t.test('re-running migration never overwrites current chapter data', async () => {
    const updated = { ...original, learningNotes: '搬移後修改' }
    await writeIepChapters(connection, iepId, updated, timestamp)
    await migrateIepChapterTables(connection)
    assert.deepEqual((await read()).get(iepId), updated)
    await writeIepChapters(connection, iepId, original, timestamp)
  })
  await t.test('clearing fields distinguishes absent properties, JSON null and empty arrays', async () => {
    const changed = { learningNotes: '', studentFamilyForm: null, meetingRecords: [], futureChapter: { keep: true } }
    await connection.beginTransaction()
    try {
      await writeIepChapters(connection, iepId, changed, timestamp)
      await connection.execute('UPDATE ieps SET content = ? WHERE id = ?', [JSON.stringify(remainingIepContent(changed)), iepId])
      assert.deepEqual((await read()).get(iepId), changed)
    } finally { await connection.rollback() }
    assert.deepEqual((await read()).get(iepId), original)
  })
  await t.test('IEP deletion cascades only to its own six chapter rows', async () => {
    await connection.beginTransaction()
    try {
      await connection.execute('DELETE FROM ieps WHERE id = ?', [emptyIepId])
      for (const chapter of iepChapterTables) {
        const [rows] = await connection.query<RowDataPacket[]>(`SELECT iep_id FROM ${chapter.table}`)
        assert.deepEqual(rows.map(row => row.iep_id), [iepId])
      }
    } finally { await connection.rollback() }
  })
  await t.test('a failure in a late chapter rolls back every moved field and can be retried', async () => {
    // Recreate the pre-migration state in this isolated test database.
    for (const chapter of iepChapterTables) await connection.query(`DELETE FROM ${chapter.table}`)
    await connection.execute('UPDATE ieps SET content = ? WHERE id = ?', [JSON.stringify(original), iepId])
    await connection.execute('DELETE FROM schema_migrations WHERE version = ?', [iepChapterMigrationVersion])
    await connection.query("CREATE TRIGGER fail_chapter_migration BEFORE INSERT ON iep_meetings FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Injected migration failure'")
    await assert.rejects(migrateIepChapterTables(connection), /Injected migration failure/)
    const [parents] = await connection.execute<RowDataPacket[]>('SELECT content FROM ieps WHERE id = ?', [iepId])
    assert.deepEqual(JSON.parse(parents[0].content), original)
    for (const chapter of iepChapterTables) {
      const [rows] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM ${chapter.table}`)
      assert.equal(rows[0].count, 0)
    }
    const [versions] = await connection.execute<RowDataPacket[]>('SELECT version FROM schema_migrations WHERE version = ?', [iepChapterMigrationVersion])
    assert.equal(versions.length, 0)
    await connection.query('DROP TRIGGER fail_chapter_migration')
    await migrateIepChapterTables(connection)
    assert.deepEqual((await read()).get(iepId), original)
  })
})
