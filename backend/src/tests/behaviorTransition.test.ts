import assert from 'node:assert/strict'
import { test } from 'node:test'
import { behaviorInterventionSchema, transitionSupportSchema } from '../schemas/behaviorTransition.js'
import { createStudentIepSchema, createAnnualIepSchema, updateIepSchema } from '../schemas/studentIep.js'

const choice = { selected: ['其他'], other: '測試補充欄位' }
const pair = { caregiver: choice, student: choice }
const behavior = {
  needStatus: '有需求', planStatus: '建立新的行為功能介入方案', planPeriod: { startDate: '2026-11-02', endDate: '2027-01-31' },
  behaviorAssessment: { definition: '測試行為界定\n第二行', time: '測試時間', location: '測試地點', triggers: '測試因素', frequency: '測試頻率', duration: '測試期間' },
  behaviorFunctions: { selected: ['其他'], notes: { 其他: '測試功能文字' } }, interventionGoal: '介入目標欄位測試',
  antecedentStrategies: { environment: choice, curriculum: choice, interaction: choice, notes: '前事說明' },
  teachingStrategies: { ...choice, notes: '教導說明' }, consequenceStrategies: { increase: choice, reduce: choice, notes: '後果說明' },
  individualFactors: '背景欄位測試', administrativeSupports: choice, implementers: choice,
  outcomeEvaluation: { date: '2026-11-02', methods: choice, result: '其他', resultOther: '成效欄位測試', recommendation: '其他', recommendationOther: '後續欄位測試', notes: '成效說明' },
}
const service = { needStatus: '有需求', options: choice, needsDescription: '需求說明', startDate: '2026-11-02', endDate: '2027-06-30', provider: '測試單位', progress: '執行情況' }
const follow = { id: 'follow-1', date: '2026-11-02', methods: ['電話', '社群平台', '其他'], socialPlatform: '測試平台', otherMethod: '其他方式', focusAreas: ['學習輔導', '其他'], otherFocus: '其他重點', summary: '追蹤摘要\n第二行', serviceDisposition: '須轉介', dispositionDetails: '測試處理說明', receivingUnitContact: '測試聯繫欄位', specialNotes: '特殊記載' }
const transition = {
  noTransitionNeed: false, transitionReasons: choice, transitionFocus: choice, generalServiceContent: '服務內容', receivingUnit: '測試受理單位', specialNotes: '特殊事項',
  crossStagePlan: { enabled: true, educationStage: '國小', grade: '四年級', elementaryPlan: pair, juniorHighPlan: { furtherEducation: pair, employment: pair, otherPlan: '國中階段欄位' }, seniorHighPlan: { furtherEducation: pair, employment: pair, otherPlan: '高中階段欄位' }, otherStageNotes: '其他階段欄位' },
  services: { education: service, dailyLiving: service, employment: service, psychological: service, welfare: service, professional: service },
  followUp: { enabled: true, records: [follow] },
}
const content = { behaviorIntervention: behavior, transitionSupport: transition, futureChapter: { keep: true } }
const valid = (value: unknown) => updateIepSchema.safeParse({ content: value }).success

test('all behavior and transition fields survive all three IEP write entry points', () => {
  const requests = [createStudentIepSchema.parse({ student: { name: '欄位驗證' }, academicYear: 115, content }), createAnnualIepSchema.parse({ academicYear: 116, content }), updateIepSchema.parse({ content })]
  for (const request of requests) assert.deepEqual(request.content, content)
})

test('backend defaults match the existing frontend form defaults at every nested level', async () => {
  const moduleUrl = new URL('../../../frontend/src/components/iep/iepInitialValues.ts', import.meta.url).href
  const { initialBehaviorIntervention, initialTransitionSupport } = await import(moduleUrl)
  assert.deepEqual(behaviorInterventionSchema.parse({}), initialBehaviorIntervention)
  assert.deepEqual(transitionSupportSchema.parse({}), initialTransitionSupport)
  const partial = transitionSupportSchema.parse({ services: { education: { needsDescription: '草稿' } }, followUp: { records: [{ id: 'draft' }] } })
  assert.equal(partial.services.education.needStatus, '無需求')
  assert.equal(partial.services.education.needsDescription, '草稿')
  assert.equal(partial.services.professional.startDate, '')
  assert.equal(partial.followUp.records[0].serviceDisposition, '適應良好')
  assert.deepEqual(partial.crossStagePlan.elementaryPlan.caregiver.selected, [])
})

test('behavior dates, need/status and every strategy group reject invalid values', () => {
  for (const value of [
    { ...behavior, needStatus: '無效需求' }, { ...behavior, planStatus: '無效狀態' },
    { ...behavior, planPeriod: { startDate: '2026-02-30', endDate: '' } },
    { ...behavior, planPeriod: { startDate: '2027-06-30', endDate: '2026-11-02' } },
    { ...behavior, behaviorFunctions: { selected: ['無效功能'], notes: {} } },
    { ...behavior, antecedentStrategies: { ...behavior.antecedentStrategies, environment: { selected: ['調整份量'] } } },
    { ...behavior, teachingStrategies: { selected: ['無效教導'] } },
    { ...behavior, consequenceStrategies: { ...behavior.consequenceStrategies, increase: { selected: ['無效後果'] } } },
    { ...behavior, administrativeSupports: { selected: ['無效支援'] } },
    { ...behavior, outcomeEvaluation: { ...behavior.outcomeEvaluation, date: '2025-02-29' } },
  ]) assert.equal(valid({ ...content, behaviorIntervention: value }), false)
})

test('all six transition services check their own options and active date ranges', () => {
  for (const key of ['education', 'dailyLiving', 'employment', 'psychological', 'welfare', 'professional']) {
    for (const invalid of [{ ...service, options: { selected: ['不存在的服務'] } }, { ...service, startDate: '2026-02-30' }, { ...service, startDate: '2027-07-01' }]) {
      assert.equal(valid({ ...content, transitionSupport: { ...transition, services: { ...transition.services, [key]: invalid } } }), false)
    }
  }
  assert.equal(valid({ ...content, transitionSupport: { ...transition, noTransitionNeed: 'false' } }), false)
  assert.equal(valid({ ...content, transitionSupport: { ...transition, crossStagePlan: { ...transition.crossStagePlan, educationStage: '無效階段' } } }), false)
})

test('inactive plans and services retain their draft contents without active-period ordering errors', () => {
  const inactive = { ...behavior, needStatus: '暫無需求', planPeriod: { startDate: '2027-06-30', endDate: '2026-11-02' } }
  assert.equal(valid({ ...content, behaviorIntervention: inactive }), true)
  const noNeed = { ...transition, noTransitionNeed: true, services: { ...transition.services, education: { ...service, startDate: '2027-07-01' } } }
  assert.deepEqual(updateIepSchema.parse({ content: { transitionSupport: noNeed } }).content.transitionSupport, noNeed)
  const inactiveService = { ...transition, services: { ...transition.services, education: { ...service, needStatus: '無需求', startDate: '2027-07-01' } } }
  assert.equal(valid({ transitionSupport: inactiveService }), true)
})

test('follow-up records validate dates, methods, disposition and unique IDs even when hidden', () => {
  for (const records of [
    [follow, follow], [{ ...follow, id: '' }], [{ ...follow, date: '2026-02-30' }],
    [{ ...follow, methods: ['無效方式'] }], [{ ...follow, focusAreas: ['無效重點'] }], [{ ...follow, serviceDisposition: '無效處理' }],
  ]) assert.equal(valid({ ...content, transitionSupport: { ...transition, followUp: { enabled: false, records } } }), false)
})

test('editing, removing records and switching stages preserve future fields and previous chapters', () => {
  for (const educationStage of ['國小', '國中', '高中', '其他']) {
    const changed = { ...transition, crossStagePlan: { ...transition.crossStagePlan, educationStage }, followUp: { enabled: false, records: [{ ...follow, summary: '修改後', futureField: '保留' }] }, futurePlanField: '保留' }
    assert.deepEqual(updateIepSchema.parse({ content: { ...content, transitionSupport: changed } }).content.transitionSupport, changed)
  }
  const cleared = { ...transition, followUp: { enabled: true, records: [] } }
  assert.deepEqual(updateIepSchema.parse({ content: { ...content, transitionSupport: cleared } }).content, { ...content, transitionSupport: cleared })
})

test('frontend deeply hydrates partial legacy data and preserves follow-up objects and future fields', async () => {
  const moduleUrl = new URL('../../../frontend/src/services/behaviorTransitionNormalization.ts', import.meta.url).href
  const { normalizeBehaviorIntervention, normalizeTransitionSupport } = await import(moduleUrl)
  const behaviorDraft = normalizeBehaviorIntervention({ behaviorAssessment: { definition: '舊資料' }, antecedentStrategies: { environment: { selected: null } }, behaviorFunctions: { notes: { 其他: '保留', invalid: 123 } } })
  assert.equal(behaviorDraft.behaviorAssessment.definition, '舊資料')
  assert.equal(behaviorDraft.behaviorAssessment.time, '')
  assert.deepEqual(behaviorDraft.antecedentStrategies.environment.selected, [])
  assert.deepEqual(behaviorDraft.behaviorFunctions.notes, { 其他: '保留' })
  const transitionDraft = normalizeTransitionSupport({ crossStagePlan: { juniorHighPlan: { otherPlan: '舊規劃' } }, services: { education: { provider: '舊單位' } }, followUp: { records: [{ id: follow.id, summary: '舊追蹤', futureField: '保留' }] } })
  assert.equal(transitionDraft.crossStagePlan.juniorHighPlan.otherPlan, '舊規劃')
  assert.deepEqual(transitionDraft.crossStagePlan.juniorHighPlan.employment.student.selected, [])
  assert.equal(transitionDraft.services.education.provider, '舊單位')
  assert.equal(transitionDraft.followUp.records[0].summary, '舊追蹤')
  assert.equal(transitionDraft.followUp.records[0].futureField, '保留')
  assert.deepEqual(transitionDraft.followUp.records[0].methods, [])
  transitionDraft.services.education.options.selected.push('其他')
  assert.deepEqual(normalizeTransitionSupport(undefined).services.education.options.selected, [])
  assert.equal(normalizeBehaviorIntervention(undefined).needStatus, '暫無需求')
  assert.deepEqual(normalizeTransitionSupport(undefined).followUp.records, [])
})
