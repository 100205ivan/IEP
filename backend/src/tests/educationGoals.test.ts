import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createStudentIepSchema, createAnnualIepSchema, updateIepSchema } from '../schemas/studentIep.js'
import { goalDomainSchema, semesterGoalSchema } from '../schemas/educationGoals.js'

const domain = { id: 'domain-1', domainType: '部定／校訂課程領域', domainName: '國語文', teacher: '測試教師', specialEducationTeacher: '測試特教教師', coreCompetencies: '核心素養', learningPerformance: '學習表現', learningContent: '學習內容', integratedIssues: '議題', annualGoals: [{ id: 'annual-1', content: '學年目標欄位驗證' }] }
const criteria = [{ type: '次數／機會', total: '5', successful: '4' }, { type: '百分比', percentage: '80' }, { type: '等級', passingLevel: '3' }, { type: '自訂', text: '自訂達成標準\n第二行' }]
const goal = { id: 'semester-1', domainId: domain.id, annualGoalId: 'annual-1', semester: '第一學期', content: '學期目標欄位驗證', startDate: '2026-09-01', endDate: '2027-01-31', assessmentMethods: ['觀察', '其他'], otherAssessmentMethod: '測試評量方式', assessmentSupport: '部分協助', achievementCriterion: criteria[0], evaluationRecords: [{ id: 'evaluation-1', date: '2026-11-02', result: '4 / 5', notes: '評量備註\n第二行' }], teachingDecision: '通過', teachingDecisionNotes: '教學決定說明' }
const content = { goalDomains: [domain], semesterGoals: [goal], learningNotes: '學習狀況\n第二行', futureChapter: { keep: true } }
const parse = (value: unknown) => updateIepSchema.parse({ content: value }).content
const valid = (value: unknown) => updateIepSchema.safeParse({ content: value }).success

test('nested goals, evaluations and learning notes survive all IEP write entry points', () => {
  for (const criterion of criteria) {
    const input = { ...content, semesterGoals: [{ ...goal, achievementCriterion: criterion }] }
    const requests = [createStudentIepSchema.parse({ student: { name: '欄位驗證' }, academicYear: 115, content: input }), createAnnualIepSchema.parse({ academicYear: 116, content: input }), updateIepSchema.parse({ content: input })]
    for (const request of requests) assert.deepEqual(request.content, input)
  }
})

test('partial drafts get defaults without requiring dates, criteria or evaluation results', () => {
  const partialDomain = goalDomainSchema.parse({ id: domain.id, domainName: domain.domainName, annualGoals: domain.annualGoals })
  assert.equal(partialDomain.teacher, '')
  assert.equal(partialDomain.coreCompetencies, '')
  const partialGoal = semesterGoalSchema.parse({ id: goal.id, domainId: goal.domainId, annualGoalId: goal.annualGoalId, content: goal.content, evaluationRecords: [{ id: 'draft-record' }] })
  assert.deepEqual(partialGoal.achievementCriterion, { type: '次數／機會', total: '', successful: '' })
  assert.equal(partialGoal.teachingDecision, '尚未決定')
  assert.deepEqual(partialGoal.evaluationRecords[0], { id: 'draft-record', date: '', result: '', notes: '' })
  assert.equal(valid({ goalDomains: [partialDomain], semesterGoals: [partialGoal] }), true)
})

test('invalid fields and impossible dates are rejected before storage', () => {
  for (const invalid of [
    { ...goal, content: ' ' }, { ...goal, semester: '第三學期' }, { ...goal, assessmentMethods: ['無效方式'] },
    { ...goal, assessmentSupport: '無效支持' }, { ...goal, teachingDecision: '無效決定' },
    { ...goal, startDate: '2026-02-30' }, { ...goal, startDate: '2027-02-01' },
    { ...goal, evaluationRecords: [{ ...goal.evaluationRecords[0], date: '2025-02-29' }] },
  ]) assert.equal(valid({ ...content, semesterGoals: [invalid] }), false)
  assert.equal(valid({ ...content, goalDomains: [{ ...domain, domainName: '' }] }), false)
  assert.equal(valid({ ...content, goalDomains: [{ ...domain, annualGoals: [{ id: 'annual-1', content: '' }] }] }), false)
  assert.equal(valid({ ...content, learningNotes: '字'.repeat(20_001) }), false)
})

test('criterion bounds are enforced while incomplete criteria remain valid drafts', () => {
  for (const invalid of [
    { type: '次數／機會', total: '5', successful: '6' }, { type: '次數／機會', total: '-1', successful: '0' },
    { type: '次數／機會', total: '2.5', successful: '1' }, { type: '百分比', percentage: '101' },
    { type: '百分比', percentage: '-1' }, { type: '百分比', percentage: 'Infinity' }, { type: '等級', passingLevel: '6' },
  ]) assert.equal(valid({ ...content, semesterGoals: [{ ...goal, achievementCriterion: invalid }] }), false)
  for (const criterion of [{ type: '次數／機會', total: '', successful: '' }, { type: '百分比', percentage: '' }, { type: '百分比', percentage: '0' }, { type: '百分比', percentage: '100' }, { type: '自訂', text: '' }]) {
    assert.equal(valid({ ...content, semesterGoals: [{ ...goal, achievementCriterion: criterion }] }), true)
  }
})

test('IDs are unique and semester goals must link to the correct annual goal and domain', () => {
  const otherDomain = { ...domain, id: 'domain-2', annualGoals: [{ id: 'annual-2', content: '另一領域目標' }] }
  for (const invalid of [
    { ...content, goalDomains: [domain, domain] },
    { ...content, goalDomains: [domain, { ...otherDomain, annualGoals: domain.annualGoals }] },
    { ...content, semesterGoals: [goal, goal] },
    { ...content, semesterGoals: [{ ...goal, evaluationRecords: [goal.evaluationRecords[0], goal.evaluationRecords[0]] }] },
    { ...content, semesterGoals: [{ ...goal, domainId: 'missing-domain' }] },
    { ...content, goalDomains: [domain, otherDomain], semesterGoals: [{ ...goal, annualGoalId: 'annual-2' }] },
    { ...content, semesterGoals: [{ ...goal, annualGoalId: 'missing-annual' }] },
  ]) assert.equal(valid(invalid), false)
})

test('deleting parents requires removing linked children; clearing goals keeps other chapters', () => {
  assert.equal(valid({ ...content, goalDomains: [] }), false)
  assert.equal(valid({ ...content, goalDomains: [{ ...domain, annualGoals: [] }] }), false)
  assert.deepEqual(parse({ ...content, goalDomains: [], semesterGoals: [], learningNotes: '' }), { ...content, goalDomains: [], semesterGoals: [], learningNotes: '' })
})

test('evaluation edits and teaching decisions preserve parent links and future fields', () => {
  const edited = { ...goal, evaluationRecords: [{ ...goal.evaluationRecords[0], result: '5 / 5', futureRecordField: '保留' }], teachingDecision: '繼續', teachingDecisionNotes: '修改後說明', futureGoalField: '保留' }
  const saved = parse({ ...content, semesterGoals: [edited] })
  assert.deepEqual(saved.semesterGoals?.[0], edited)
  assert.deepEqual(saved.goalDomains, [domain])
  assert.deepEqual(saved.futureChapter, content.futureChapter)
})

test('frontend hydrates partial goals, clears missing sections and excludes broken parent links', async () => {
  const moduleUrl = new URL('../../../frontend/src/services/educationGoalsNormalization.ts', import.meta.url).href
  const { normalizeGoalDomains, normalizeSemesterGoals } = await import(moduleUrl)
  assert.deepEqual(normalizeGoalDomains(undefined), [])
  const domains = normalizeGoalDomains([{ id: domain.id, domainName: domain.domainName, annualGoals: domain.annualGoals }])
  assert.equal(domains[0].teacher, '')
  assert.equal(domains[0].domainType, '部定／校訂課程領域')
  const partial = { id: goal.id, domainId: goal.domainId, annualGoalId: goal.annualGoalId, content: goal.content, futureGoalField: '保留' }
  const goals = normalizeSemesterGoals([partial, { ...partial, domainId: 'missing' }, { ...partial, annualGoalId: 'missing' }], domains)
  assert.equal(goals.length, 1)
  assert.deepEqual(goals[0].achievementCriterion, { type: '次數／機會', total: '', successful: '' })
  assert.deepEqual(goals[0].evaluationRecords, [])
  assert.equal(goals[0].futureGoalField, '保留')
  assert.deepEqual(normalizeSemesterGoals(undefined, domains), [])
  assert.deepEqual(normalizeSemesterGoals([goal], []), [])
  for (const criterion of criteria) assert.deepEqual(normalizeSemesterGoals([{ ...goal, achievementCriterion: criterion }], domains)[0].achievementCriterion, criterion)
})
