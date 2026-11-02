import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import express from 'express'
import { createConnection, type Pool, type RowDataPacket } from 'mysql2/promise'
import '../config/environment.js'

test('special education support persists through the IEP API', async (t) => {
  const databaseName = `eyeep_support_test_${randomUUID().replaceAll('-', '')}`
  const originalDatabase = process.env.DB_NAME
  const admin = await createConnection({ host: process.env.DB_HOST ?? '127.0.0.1', port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER ?? 'root', password: process.env.DB_PASSWORD ?? '' })
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
          assert.match(databaseName, /^eyeep_support_test_[a-f0-9]{32}$/)
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
  const app = express()
  app.use(express.json({ limit: '512kb' }), studentIepRouter)
  app.use(((_error, _request, response, _next) => { response.status(500).json({ ok: false }) }) satisfies express.ErrorRequestHandler)
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => { server!.once('listening', resolve); server!.once('error', reject) })
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  async function request<T>(method: string, path: string, body?: unknown, status = 200): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const payload = await response.json() as { ok: boolean; data: T }
    assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(payload)}`)
    assert.equal(payload.ok, status < 400)
    return payload.data
  }
  type Scope = { studentId: string; iepId: string }
  type SavedIep = { id: string; content: Record<string, unknown> }
  const services = ['語言治療', '職能治療', '物理治療', '心理服務', '社會工作服務', '其他']
  const support = {
    specialEducation: ['資源班', '其他'], specialOther: '合成特殊教育服務', specialFrequency: '其他', specialFrequencyOther: '每週三節', specialNotes: '測試服務說明\n保留換行',
    professional: services,
    professionalDetails: Object.fromEntries(services.map(service => [service, { provider: `${service}測試單位`, frequency: '其他', otherFrequency: '每學期三次', startDate: '2026-11-02', endDate: '2027-06-30', notes: `${service}測試說明`, serviceName: service === '其他' ? '其他測試專業服務' : '' }])),
    familySupport: ['親職教育', '其他'], familyOther: '合成家庭服務', familyNotes: '家庭支持說明',
    staffSupport: ['特教學生助理人員', '其他'], staffHours: '3.5', staffOther: '其他人力',
    administrativeSupport: ['輔具', '無障礙環境', '其他'], administrativeOther: '其他設備',
    transportSupport: ['交通服務', '教育補助', '其他'], transportOther: '其他交通支持', otherSupportNotes: '其他支持說明',
  }
  const otherChapters = { studentFamilyForm: { values: { studentName: '合成測試學生' }, checks: {}, medications: [] }, goalDomains: [{ id: 'keep-domain', domainType: '部定／校訂課程領域', domainName: '保留原本教育目標', teacher: '', specialEducationTeacher: '', coreCompetencies: '', learningPerformance: '', learningContent: '', integratedIssues: '', annualGoals: [] }], futureChapter: { value: '保留未知章節' } }
  const studentPayload = { student: { name: '支持服務後端測試學生', gender: '', birthDate: null }, academicYear: 115 }
  const current = await request<Scope>('POST', '/students', { ...studentPayload, content: { ...otherChapters, specialEducationSupport: support } }, 201)
  const read = () => request<SavedIep>('GET', `/ieps/${current.iepId}`)

  await t.test('all service groups and all six professional details survive a new HTTP read and SQL read', async () => {
    assert.deepEqual((await read()).content, { ...otherChapters, specialEducationSupport: support })
    const [rows] = await pool!.execute<RowDataPacket[]>('SELECT content FROM ieps WHERE id = ?', [current.iepId])
    const content = typeof rows[0].content === 'string' ? JSON.parse(rows[0].content) : rows[0].content
    assert.deepEqual(content.specialEducationSupport, support)
  })
  await t.test('edits and clearing selections persist while other chapters remain intact', async () => {
    const nextSupport = { ...support, specialNotes: '修改後的服務說明', staffHours: '0', professional: [], professionalDetails: {}, familySupport: [], familyOther: '', familyNotes: '' }
    await request('PUT', `/ieps/${current.iepId}`, { content: { ...otherChapters, specialEducationSupport: nextSupport } })
    assert.deepEqual((await read()).content, { ...otherChapters, specialEducationSupport: nextSupport })
    await request('PUT', `/ieps/${current.iepId}`, { content: { ...otherChapters, specialEducationSupport: support } })
  })
  await t.test('another student and another academic year have independent service plans', async () => {
    const other = await request<Scope>('POST', '/students', { ...studentPayload, content: {} }, 201)
    const nextYear = await request<SavedIep>('POST', `/students/${current.studentId}/ieps`, { academicYear: 116, mode: 'copy-basic', copyFromIepId: current.iepId }, 201)
    assert.equal(nextYear.content.specialEducationSupport, undefined)
    await request('PUT', `/ieps/${other.iepId}`, { content: { specialEducationSupport: { specialNotes: '另一位學生' } } })
    await request('PUT', `/ieps/${nextYear.id}`, { content: { ...nextYear.content, specialEducationSupport: { specialNotes: '另一學年度' } } })
    assert.deepEqual((await read()).content.specialEducationSupport, support)
    assert.equal(((await request<SavedIep>('GET', `/ieps/${other.iepId}`)).content.specialEducationSupport as Record<string, unknown>).specialNotes, '另一位學生')
    assert.equal(((await request<SavedIep>('GET', `/ieps/${nextYear.id}`)).content.specialEducationSupport as Record<string, unknown>).specialNotes, '另一學年度')
  })
  await t.test('partial drafts receive defaults and future fields are preserved', async () => {
    const partial = { professional: ['語言治療'], professionalDetails: { 語言治療: { provider: '測試單位' } }, futureSupportField: '保留未來欄位' }
    await request('PUT', `/ieps/${current.iepId}`, { content: { ...otherChapters, specialEducationSupport: partial } })
    const saved = (await read()).content.specialEducationSupport as typeof support & { futureSupportField: string }
    assert.deepEqual(saved.specialEducation, [])
    assert.equal(saved.specialFrequency, '請選擇')
    assert.equal(saved.staffHours, '')
    assert.equal(saved.professionalDetails['語言治療'].provider, '測試單位')
    assert.equal(saved.professionalDetails['語言治療'].frequency, '請選擇')
    assert.equal(saved.professionalDetails['語言治療'].startDate, '')
    assert.equal(saved.futureSupportField, partial.futureSupportField)
  })
  await t.test('invalid service values return 400 on create, annual IEP creation and update without overwriting saved data', async () => {
    const before = (await read()).content
    const invalidSupports = [
      { ...support, staffHours: '-1' }, { ...support, staffHours: 'Infinity' }, { ...support, staffHours: '不是數字' },
      { ...support, specialEducation: '資源班' }, { ...support, professional: ['不存在的服務'] },
      { ...support, professionalDetails: { 語言治療: { startDate: '2026-02-30' } } },
      { ...support, professionalDetails: { 語言治療: { startDate: '2027-06-30', endDate: '2026-11-02' } } },
    ]
    for (const invalid of invalidSupports) {
      const content = { ...otherChapters, specialEducationSupport: invalid }
      await request('POST', '/students', { ...studentPayload, content }, 400)
      await request('POST', `/students/${current.studentId}/ieps`, { academicYear: 117, content }, 400)
      await request('PUT', `/ieps/${current.iepId}`, { content }, 400)
      assert.deepEqual((await read()).content, before)
    }
    await request('PUT', `/ieps/${randomUUID()}`, { content: {} }, 404)
  })
  await t.test('frontend hydration resets missing legacy sections and fills incomplete professional details', async () => {
    const moduleUrl = new URL('../../../frontend/src/components/iep/iepInitialValues.ts', import.meta.url).href
    const { normalizeSpecialEducationSupport, initialSpecialEducationSupport } = await import(moduleUrl)
    const restored = normalizeSpecialEducationSupport({ specialNotes: '舊資料', professional: ['語言治療'], professionalDetails: { 語言治療: { provider: '舊服務單位' } } })
    assert.equal(restored.specialNotes, '舊資料')
    assert.deepEqual(restored.staffSupport, [])
    assert.equal(restored.professionalDetails['語言治療'].frequency, '請選擇')
    assert.equal(restored.professionalDetails['語言治療'].notes, '')
    assert.deepEqual(normalizeSpecialEducationSupport(), initialSpecialEducationSupport)
  })
  await t.test('deselected services retain their drafts without blocking other service changes', async () => {
    const draft = { professional: [], professionalDetails: { 語言治療: { startDate: '2027-06-30', endDate: '2026-11-02' } } }
    await request('PUT', `/ieps/${current.iepId}`, { content: { specialEducationSupport: draft } })
    const saved = (await read()).content.specialEducationSupport as typeof support
    assert.deepEqual(saved.professional, [])
    assert.equal(saved.professionalDetails['語言治療'].startDate, '2027-06-30')
    await request('PUT', `/ieps/${current.iepId}`, { content: { specialEducationSupport: { ...draft, professional: ['語言治療'] } } }, 400)
  })
})
