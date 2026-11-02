import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import express from 'express'
import { createConnection, type Pool, type RowDataPacket } from 'mysql2/promise'
import '../config/environment.js'

// Use a fresh, disposable database and an ephemeral HTTP port. Never write test
// students or assessment records to the database selected in backend/.env.
test('assessment API persists records in MariaDB and isolates IEPs', async (t) => {
  const databaseName = `eyeep_assessment_test_${randomUUID().replaceAll('-', '')}`
  const originalDatabase = process.env.DB_NAME
  const admin = await createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
  })
  let created = false
  let pool: Pool | undefined
  let server: Server | undefined
  t.after(async () => {
    try {
      if (server) {
        const closing = new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
        server.closeAllConnections()
        await closing
      }
    } finally {
      try { await pool?.end() } finally {
        try {
          assert.match(databaseName, /^eyeep_assessment_test_[a-f0-9]{32}$/)
          if (created) await admin.query('DROP DATABASE ??', [databaseName])
        } finally {
          await admin.end()
          if (originalDatabase === undefined) delete process.env.DB_NAME
          else process.env.DB_NAME = originalDatabase
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
  app.use(express.json({ limit: '512kb' }))
  app.use('/api', studentIepRouter, assessmentRecordRouter)
  app.use(((_error, _request, response, _next) => {
    response.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR' } })
  }) satisfies express.ErrorRequestHandler)
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => { server!.once('listening', resolve); server!.once('error', reject) })
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
  async function request<T = Record<string, unknown>>(method: string, path: string, body?: unknown, status = 200): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      method, headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const payload = await response.json() as { ok: boolean; data: T }
    assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(payload)}`)
    assert.equal(payload.ok, status < 400)
    return payload.data
  }

  type Scope = { studentId: string; iepId: string }
  type RecordResult = { id: string; studentId: string; iepId: string; source: string; summary: string; assessmentDate: string; otherAssessmentType: string }
  const createStudent = () => request<Scope>('POST', '/students', {
    student: { name: '後端串接測試學生', gender: '', birthDate: null, nationalId: null, studentNumber: '' },
    academicYear: 115, content: {},
  }, 201)
  const current = await createStudent()
  const otherStudent = await createStudent()
  const otherYear = await request<{ id: string }>('POST', `/students/${current.studentId}/ieps`, { academicYear: 116, mode: 'blank', content: {} }, 201)
  const foreignIeps = [otherStudent.iepId, otherYear.id]
  const manual = { assessmentDate: '2026-11-02', assessmentType: '其他', otherAssessmentType: '教室觀察', assessmentTool: '觀察紀錄', evaluator: '測試教師', summary: '測試摘要' }
  const createdManual = await request<RecordResult>('POST', `/ieps/${current.iepId}/assessments`, manual, 201)

  await t.test('manual records survive fresh reads, edits and retain the student/IEP link', async () => {
    let rows = await request<RecordResult[]>('GET', `/ieps/${current.iepId}/assessments`)
    assert.equal(rows[0].id, createdManual.id)
    assert.equal(rows[0].studentId, current.studentId)
    assert.equal(rows[0].iepId, current.iepId)
    assert.equal(rows[0].otherAssessmentType, '教室觀察')
    await request('PUT', `/assessments/${createdManual.id}`, { ...manual, iepId: current.iepId, summary: '修改後的摘要' })
    rows = await request<RecordResult[]>('GET', `/ieps/${current.iepId}/assessments`)
    assert.equal(rows[0].summary, '修改後的摘要')
    const [stored] = await pool!.execute<RowDataPacket[]>('SELECT summary FROM assessment_records WHERE id = ?', [createdManual.id])
    assert.equal(stored[0].summary, '修改後的摘要')
    for (const iepId of foreignIeps) {
      assert.deepEqual(await request('GET', `/ieps/${iepId}/assessments`), [])
      await request('PUT', `/assessments/${createdManual.id}`, { ...manual, iepId }, 409)
      await request('DELETE', `/assessments/${createdManual.id}`, { iepId }, 409)
    }
  })

  await t.test('invalid calendar dates and missing manual fields return 400', async () => {
    for (const assessmentDate of ['2026-02-30', '2026-13-01', '2025-02-29', '0000-01-01']) {
      await request('POST', `/ieps/${current.iepId}/assessments`, { ...manual, assessmentDate }, 400)
      await request('PUT', `/assessments/${createdManual.id}`, { ...manual, assessmentDate, iepId: current.iepId }, 400)
    }
    await request('POST', `/ieps/${current.iepId}/assessments`, { ...manual, summary: ' ' }, 400)
    await request('POST', `/ieps/${current.iepId}/assessments`, { ...manual, otherAssessmentType: '' }, 400)
    const leapDay = await request<RecordResult>('POST', `/ieps/${current.iepId}/assessments`, { ...manual, assessmentDate: '2024-02-29' }, 201)
    await request('DELETE', `/assessments/${leapDay.id}`, { iepId: current.iepId })
  })

  const domains = ['sensory', 'perceptualMotor', 'selfCare', 'cognitive', 'communication', 'socialEmotional', 'academicLearning']
  const analysis = {
    id: randomUUID(), documentInfo: { documentType: '測試報告', assessmentDate: '2026-11-01', assessmentTools: ['測試工具'], evaluator: '測試評量者' },
    overallSummary: '合成文件分析結果，未呼叫 AI。', warnings: [],
    domains: Object.fromEntries(domains.map(domain => [domain, { domain, hasEvidence: domain === 'cognitive', summary: domain === 'cognitive' ? '認知觀察' : null, evidence: domain === 'cognitive' ? [{ id: randomUUID(), content: '合成觀察證據' }] : [] }])),
  }
  const document = await request<{ record: RecordResult; analysis: unknown }>('POST', `/ieps/${current.iepId}/document-analyses`, analysis, 201)
  await t.test('document results persist and require the matching IEP for retrieval', async () => {
    const stored = await request<{ domains: unknown }>('GET', `/assessments/${document.record.id}/document-analysis?iepId=${current.iepId}`)
    assert.deepEqual(stored.domains, analysis.domains)
    for (const iepId of foreignIeps) {
      await request('GET', `/assessments/${document.record.id}/document-analysis?iepId=${iepId}`, undefined, 404)
      await request('DELETE', `/assessments/${document.record.id}/document-analysis`, { iepId }, 409)
    }
    await request('GET', `/assessments/${document.record.id}/document-analysis`, undefined, 400)
    await request('POST', `/ieps/${current.iepId}/document-analyses`, analysis, 409)
    await request('PUT', `/assessments/${document.record.id}`, { ...manual, iepId: current.iepId }, 409)
    await request('DELETE', `/assessments/${document.record.id}`, { iepId: current.iepId }, 409)
  })
  await t.test('unusable document dates fall back without corrupting the analysis', async () => {
    const invalidDate = { ...analysis, id: randomUUID(), documentInfo: { ...analysis.documentInfo, assessmentDate: '2026-02-30' } }
    const saved = await request<{ record: RecordResult }>('POST', `/ieps/${current.iepId}/document-analyses`, invalidDate, 201)
    assert.equal(saved.record.assessmentDate, new Date().toISOString().slice(0, 10))
    await request('DELETE', `/assessments/${saved.record.id}/document-analysis`, { iepId: current.iepId })
  })

  const games = [
    { gameType: 'monkey', result: { totalScore: 100, correctPositions: 1, totalPositions: 1, levelScores: [100], questionResults: [{ id: 1, level: 1, sequence: ['貓'], correctAnswer: ['貓'], playerAnswer: ['貓'], correctPositions: 1, totalPositions: 1, score: 100 }] } },
    { gameType: 'cpt', result: { testStartedAt: 1000, testFinishedAt: 2000, durationMs: 1000, metrics: { hitRate: 1, omissionCount: 0, omissionRate: 0, commissionCount: 0, commissionRate: 0, meanReactionTime: 300, reactionTimeSD: 0 }, trials: [{ trialIndex: 0, stimulus: 1, isTarget: true, responded: true, hit: true, omission: false, commission: false, reactionTime: 300, startTime: 1000 }] } },
  ]
  for (const game of games) {
    await t.test(`${game.gameType} results persist, reject duplicates and stay within their IEP`, async () => {
      const input = { ...game, resultId: randomUUID(), assessmentDate: '2026-10-31', completedAt: '2026-10-31T08:00:00.000Z', summary: '合成遊戲測試結果', age: 10 }
      const saved = await request<{ record: RecordResult }>('POST', `/ieps/${current.iepId}/game-results`, input, 201)
      const stored = await request<{ result: unknown; age: number }>('GET', `/assessments/${saved.record.id}/game-result?iepId=${current.iepId}`)
      assert.deepEqual(stored.result, game.result)
      assert.equal(stored.age, 10)
      for (const iepId of foreignIeps) {
        await request('GET', `/assessments/${saved.record.id}/game-result?iepId=${iepId}`, undefined, 404)
        await request('DELETE', `/assessments/${saved.record.id}/game-result`, { iepId }, 409)
      }
      await request('POST', `/ieps/${current.iepId}/game-results`, input, 409)
      await request('POST', `/ieps/${current.iepId}/game-results`, { ...input, resultId: randomUUID(), assessmentDate: '2026-02-30' }, 400)
      await request('DELETE', `/assessments/${saved.record.id}`, { iepId: current.iepId }, 409)
      await request('DELETE', `/assessments/${saved.record.id}/game-result`, { iepId: current.iepId })
      await request('GET', `/assessments/${saved.record.id}/game-result?iepId=${current.iepId}`, undefined, 404)
    })
  }
  await t.test('delete removes both the assessment index and its detail rows', async () => {
    await request('DELETE', `/assessments/${document.record.id}/document-analysis`, { iepId: current.iepId })
    await request('GET', `/assessments/${document.record.id}/document-analysis?iepId=${current.iepId}`, undefined, 404)
    await request('DELETE', `/assessments/${createdManual.id}`, { iepId: current.iepId })
    for (const table of ['assessment_document_analyses', 'game_assessment_results']) {
      const [rows]: [RowDataPacket[], unknown] = await pool!.query<RowDataPacket[]>('SELECT COUNT(*) AS count FROM ??', [table])
      assert.equal(rows[0].count, 0)
    }
    assert.deepEqual(await request('GET', `/ieps/${current.iepId}/assessments`), [])
  })
})
