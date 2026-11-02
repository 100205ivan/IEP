import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import express from 'express'
import { createConnection, type Pool, type RowDataPacket } from 'mysql2/promise'
import '../config/environment.js'
import { iepChapterTables, remainingIepContent } from '../db/iepChapterTables.js'
import { iepContentSchema } from '../schemas/studentIep.js'

test('IEP API stores and assembles six chapter tables atomically', async t => {
  const databaseName = `eyeep_chapter_api_test_${randomUUID().replaceAll('-', '')}`
  const previousDatabase = process.env.DB_NAME
  const admin = await createConnection({ host: process.env.DB_HOST ?? '127.0.0.1', port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER ?? 'root', password: process.env.DB_PASSWORD ?? '' })
  let pool: Pool | undefined, server: Server | undefined, created = false
  t.after(async () => {
    try {
      if (server) {
        const closed = new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
        server.closeAllConnections()
        await closed
      }
    } finally {
      try { await pool?.end() } finally {
        try {
          assert.match(databaseName, /^eyeep_chapter_api_test_[a-f0-9]{32}$/)
          if (created) await admin.query('DROP DATABASE ??', [databaseName])
        } finally {
          await admin.end()
          if (previousDatabase === undefined) delete process.env.DB_NAME
          else process.env.DB_NAME = previousDatabase
        }
      }
    }
  })
  await admin.query('CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [databaseName])
  created = true
  process.env.DB_NAME = databaseName
  const database = await import('../config/database.js')
  pool = database.pool
  assert.equal(database.databaseConfig.database, databaseName)
  const { runMigrations } = await import('../db/migrate.js')
  await runMigrations()
  const { studentIepRouter } = await import('../routes/studentIep.js')
  const { assessmentRecordRouter } = await import('../routes/assessmentRecord.js')
  const app = express()
  app.use(express.json(), studentIepRouter, assessmentRecordRouter)
  app.use(((_error, _request, response, _next) => response.status(500).json({ ok: false })) satisfies express.ErrorRequestHandler)
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => { server!.once('listening', resolve); server!.once('error', reject) })
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  async function request(method: string, path: string, body?: unknown, status = 200): Promise<any> {
    const response = await fetch(`${url}${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const payload = await response.json()
    assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(payload)}`)
    return payload.data
  }
  const content = iepContentSchema.parse({
    studentFamilyForm: { values: { studentName: '王曉明', gender: '', birthDate: '', nationalId: '', studentId: '', grade: '四年級' }, checks: { sameAddress: true }, medications: [] },
    assessmentSelections: { leftEar: ['正常'] }, assessmentDetails: { 'sensory-needsAssessment': '合成需求欄位' },
    strengthWeaknessSummary: { strengths: [], weaknesses: [], strengthNotes: '', weaknessNotes: '', overallNeeds: '合成摘要' },
    specialEducationSupport: {}, inclusiveEducationPlan: {}, curriculumAdjustment: {}, coursePlanItems: [], weeklySchedule: [],
    goalDomains: [], semesterGoals: [], learningNotes: '原始學習說明', behaviorIntervention: {}, transitionSupport: {}, meetingRecords: [],
    futureChapter: { keep: '保留未來欄位' },
  })
  const student = { name: '王曉明', gender: '', birthDate: null, nationalId: null, studentNumber: '' }
  const current = await request('POST', '/students', { student, academicYear: 115, content }, 201)
  const read = () => request('GET', `/ieps/${current.iepId}`)
  const sqlSnapshot = async () => {
    const result: Record<string, unknown> = {}
    for (const table of ['ieps', ...iepChapterTables.map(chapter => chapter.table)]) {
      const key = table === 'ieps' ? 'id' : 'iep_id'
      const [rows] = await pool!.execute<RowDataPacket[]>(`SELECT * FROM ${table} WHERE ${key} = ?`, [current.iepId])
      result[table] = rows
    }
    return result
  }
  await t.test('new student writes every chapter table while both IEP read routes retain the public shape', async () => {
    assert.deepEqual((await read()).content, content)
    assert.deepEqual((await request('GET', `/students/${current.studentId}/ieps`))[0].content, content)
    const [parents] = await pool!.execute<RowDataPacket[]>('SELECT content FROM ieps WHERE id = ?', [current.iepId])
    assert.deepEqual(JSON.parse(parents[0].content), remainingIepContent(content))
    for (const chapter of iepChapterTables) {
      const [rows]: [RowDataPacket[], unknown] = await pool!.execute<RowDataPacket[]>(`SELECT * FROM ${chapter.table} WHERE iep_id = ?`, [current.iepId])
      assert.equal(rows.length, 1)
      for (const [key, column] of chapter.fields) assert.deepEqual(JSON.parse(rows[0][column]), content[key])
    }
  })
  const blank = await request('POST', `/students/${current.studentId}/ieps`, { academicYear: 116, mode: 'blank' }, 201)
  const copied = await request('POST', `/students/${current.studentId}/ieps`, { academicYear: 117, mode: 'copy-basic', copyFromIepId: current.iepId }, 201)
  await t.test('blank and copy-basic annual IEPs read the source family table and remain independent', async () => {
    assert.deepEqual(blank.content, {})
    assert.deepEqual(copied.content.studentFamilyForm, content.studentFamilyForm)
    assert.equal(copied.content.basicInfoReviewNotice.inheritedFromAcademicYear, 115)
    assert.equal(copied.content.specialEducationSupport, undefined)
    await request('PUT', `/ieps/${blank.id}`, { content: { learningNotes: '另一學年度' } })
    assert.equal((await read()).content.learningNotes, content.learningNotes)
    const records = await request('GET', `/students/${current.studentId}/ieps`)
    assert.deepEqual(records.map((record: { academicYear: number }) => record.academicYear), [117, 116, 115])
    await request('GET', `/students/${randomUUID()}/ieps`, undefined, 200)
    await request('POST', `/students/${randomUUID()}/ieps`, { academicYear: 115 }, 404)
  })
  await t.test('updates, clearing sections, JSON null and future metadata survive new reads', async () => {
    const changed = { learningNotes: '', assessmentDetails: null, goalDomains: [], semesterGoals: [], meetingRecords: [], futureChapter: { keep: '修改後' } }
    await request('PUT', `/ieps/${current.iepId}`, { content: changed })
    assert.deepEqual((await read()).content, changed)
    const [rows] = await pool!.execute<RowDataPacket[]>('SELECT student_family_form, assessment_details FROM iep_assessments WHERE iep_id = ?', [current.iepId])
    assert.equal(rows[0].student_family_form, null)
    assert.equal(rows[0].assessment_details, 'null')
    await request('PUT', `/ieps/${current.iepId}`, { content })
  })
  await t.test('case-insensitive IEP URLs use the stored ID for chapter writes and responses', async () => {
    await pool!.execute('DELETE FROM iep_transitions WHERE iep_id = ?', [current.iepId])
    const saved = await request('PUT', `/ieps/${current.iepId.toUpperCase()}`, { content })
    assert.equal(saved.id, current.iepId)
    assert.deepEqual(saved.content, content)
    const [rows] = await pool!.execute<RowDataPacket[]>('SELECT iep_id FROM iep_transitions WHERE iep_id = ?', [current.iepId])
    assert.equal(rows[0].iep_id, current.iepId)
    assert.deepEqual((await read()).content, content)
  })
  await t.test('a failure in the last table rolls back earlier chapters, year and student changes', async () => {
    const before = await sqlSnapshot()
    await pool!.query("CREATE TRIGGER fail_chapter_write BEFORE UPDATE ON iep_meetings FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Injected chapter write failure'")
    try {
      await request('PUT', `/ieps/${current.iepId}`, { content: { ...content, learningNotes: '不可留下的修改' }, student: { ...student, studentNumber: 'rollback-test' }, academicYear: 120 }, 500)
      assert.deepEqual(await sqlSnapshot(), before)
      assert.equal((await request('GET', `/students/${current.studentId}`)).studentNumber, '')
    } finally { await pool!.query('DROP TRIGGER fail_chapter_write') }
    await request('PUT', `/ieps/${current.iepId}`, { content: { ...content, transitionSupport: { noTransitionNeed: 'invalid' } } }, 400)
    assert.deepEqual(await sqlSnapshot(), before)
  })
  await t.test('chapter tables are authoritative and migration reruns do not replace saved changes', async () => {
    const behavior = { ...content.behaviorIntervention, interventionGoal: '直接從章節資料表讀取' }
    await pool!.execute('UPDATE iep_behavior_interventions SET behavior_intervention = ? WHERE iep_id = ?', [JSON.stringify(behavior), current.iepId])
    await runMigrations()
    assert.deepEqual((await read()).content.behaviorIntervention, behavior)
    await request('PUT', `/ieps/${current.iepId}`, { content })
  })
  await t.test('concurrent saves and reads return complete versions across all six tables', async () => {
    const coherent = (token: string) => iepContentSchema.parse({
      ...content,
      studentFamilyForm: { ...content.studentFamilyForm as object, values: { testVersion: token } },
      specialEducationSupport: { ...content.specialEducationSupport, otherSupportNotes: token },
      learningNotes: token, behaviorIntervention: { ...content.behaviorIntervention, interventionGoal: token },
      transitionSupport: { ...content.transitionSupport, generalServiceContent: token },
      meetingRecords: [{ id: 'version-meeting', date: '2026-11-02', location: token }],
    })
    await request('PUT', `/ieps/${current.iepId}`, { content: coherent('initial') })
    const assertVersion = (record: any) => {
      const value = record.content
      const token = value.learningNotes
      assert.equal(value.studentFamilyForm.values.testVersion, token)
      assert.equal(value.specialEducationSupport.otherSupportNotes, token)
      assert.equal(value.behaviorIntervention.interventionGoal, token)
      assert.equal(value.transitionSupport.generalServiceContent, token)
      assert.equal(value.meetingRecords[0].location, token)
    }
    await Promise.all([
      ...['one', 'two', 'three'].map(token => request('PUT', `/ieps/${current.iepId}`, { content: coherent(token) }).then(assertVersion)),
      ...Array.from({ length: 4 }, () => read().then(assertVersion)),
    ])
    await request('PUT', `/ieps/${current.iepId}`, { content })
  })
  await t.test('IEP deletion cascades to its own chapters while preserving assessment deletion protection', async () => {
    for (const id of [blank.id, copied.id]) await request('DELETE', `/ieps/${id}`, { confirmation: '刪除' })
    const manual = await request('POST', `/ieps/${current.iepId}/assessments`, { assessmentDate: '2026-11-02', assessmentType: '課堂觀察', assessmentTool: '合成欄位', evaluator: '測試人員', summary: '合成摘要' }, 201)
    await request('DELETE', `/ieps/${current.iepId}`, { confirmation: '刪除' }, 409)
    assert.deepEqual((await read()).content, content)
    await request('DELETE', `/assessments/${manual.id}`, { iepId: current.iepId })
    await request('DELETE', `/ieps/${current.iepId}`, { confirmation: '刪除' })
    await request('GET', `/ieps/${current.iepId}`, undefined, 404)
    for (const chapter of iepChapterTables) {
      const [rows]: [RowDataPacket[], unknown] = await pool!.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM ${chapter.table}`)
      assert.equal(rows[0].count, 0)
    }
    assert.equal((await request('GET', '/students')).length, 1)
  })
})
