import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createStudentIepSchema, createAnnualIepSchema, updateIepSchema } from '../schemas/studentIep.js'
import { inclusiveEducationPlanSchema } from '../schemas/inclusiveEducationPlan.js'

const plan = {
  grade: '四年級', className: '2 班', participation: '部分時間抽離',
  withdrawalSubjects: ['國語', '數學', '其他'], withdrawalOther: '測試用溝通練習',
  otherParticipationNotes: '保留其他方式的草稿', participationNotes: '融合教育欄位驗證。\n第二行。',
  activities: ['班級活動', '校外教學', '其他'], activityOther: '測試用閱讀活動', activityNotes: '活動前提供流程提示。',
  strategies: ['同儕協助', '視覺提示', '其他'], strategyOther: '測試用提示卡', strategyNotes: '保留文字、標點與換行。\n第二行。',
}

test('all thirteen inclusive education fields survive IEP request validation', () => {
  const content = { inclusiveEducationPlan: plan, studentFamilyForm: { values: { studentName: '欄位驗證' } }, goalDomains: [], futureChapter: { keep: true } }
  const requests = [
    createStudentIepSchema.parse({ student: { name: '欄位驗證' }, academicYear: 115, content }),
    createAnnualIepSchema.parse({ academicYear: 116, content }),
    updateIepSchema.parse({ content }),
  ]
  for (const request of requests) assert.deepEqual(request.content, content)
})

test('empty and partial plans remain saveable drafts with complete defaults', () => {
  const empty = inclusiveEducationPlanSchema.parse({})
  assert.equal(Object.keys(empty).length, 13)
  assert.equal(empty.grade, '')
  assert.equal(empty.participation, '')
  assert.deepEqual(empty.activities, [])
  assert.deepEqual(empty.strategies, [])
  const partial = inclusiveEducationPlanSchema.parse({ participationNotes: '尚未完成的草稿' })
  assert.equal(partial.participationNotes, '尚未完成的草稿')
  assert.deepEqual(partial.withdrawalSubjects, [])
  assert.deepEqual(updateIepSchema.parse({ content: {} }).content, {})
})

test('invalid choices, field types and excessive text are rejected by all write entry points', () => {
  const invalidPlans = [
    { ...plan, grade: '十年級' }, { ...plan, className: '不存在的班級' },
    { ...plan, participation: '無效方式' }, { ...plan, withdrawalSubjects: ['無效課程'] },
    { ...plan, activities: ['無效活動'] }, { ...plan, strategies: ['無效策略'] },
    { ...plan, activities: '班級活動' }, { ...plan, grade: 4 },
    { ...plan, activityOther: '字'.repeat(2_001) }, { ...plan, participationNotes: '字'.repeat(20_001) },
  ]
  for (const invalid of invalidPlans) {
    const content = { inclusiveEducationPlan: invalid }
    assert.equal(createStudentIepSchema.safeParse({ student: { name: '欄位驗證' }, academicYear: 115, content }).success, false)
    assert.equal(createAnnualIepSchema.safeParse({ academicYear: 116, content }).success, false)
    assert.equal(updateIepSchema.safeParse({ content }).success, false)
  }
})

test('participation changes and cleared selections preserve hidden drafts and future fields', () => {
  for (const participation of ['全時參與普通班', '部分時間抽離', '其他方式']) {
    const input = { ...plan, participation, activities: [], strategies: [], futurePlanField: '保留未來欄位' }
    assert.deepEqual(inclusiveEducationPlanSchema.parse(input), input)
  }
})

test('support service validation still applies alongside the inclusive education plan', () => {
  const request = updateIepSchema.parse({ content: { inclusiveEducationPlan: plan, specialEducationSupport: { staffHours: '4.5' } } })
  assert.equal(request.content.specialEducationSupport?.staffHours, '4.5')
  assert.deepEqual(request.content.inclusiveEducationPlan, plan)
  assert.equal(updateIepSchema.safeParse({ content: { inclusiveEducationPlan: plan, specialEducationSupport: { staffHours: '-1' } } }).success, false)
})

test('frontend restores legacy partial plans and resets a missing section without sharing array state', async () => {
  const moduleUrl = new URL('../../../frontend/src/components/iep/iepInitialValues.ts', import.meta.url).href
  const { normalizeInclusiveEducationPlan, initialInclusiveEducationPlan } = await import(moduleUrl)
  for (const value of [undefined, null, [], 'invalid']) assert.deepEqual(normalizeInclusiveEducationPlan(value), initialInclusiveEducationPlan)
  const partial = normalizeInclusiveEducationPlan({ participationNotes: '舊資料', activities: null, strategies: ['同儕協助', null], futurePlanField: '保留' })
  assert.equal(partial.participationNotes, '舊資料')
  assert.deepEqual(partial.activities, [])
  assert.deepEqual(partial.strategies, ['同儕協助'])
  assert.equal(partial.futurePlanField, '保留')
  const first = normalizeInclusiveEducationPlan(undefined)
  first.activities.push('班級活動')
  assert.deepEqual(normalizeInclusiveEducationPlan(undefined).activities, [])
})
