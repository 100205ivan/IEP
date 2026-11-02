import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { updateIepSchema } from '../schemas/studentIep.js'
import { maximumAttachmentBytes, validateAttachment } from '../services/iepAttachmentService.js'
import { referenceOptions } from '../schemas/referenceForms.js'

const course = { id: 'course', courseName: '測試課程', courseType: '特殊需求領域課程', weeklyPeriods: 2, placement: '外加', teachingMethod: '個別教學', referenceCategory: '高中：彈性學習時間', startDate: '2026-09-01', endDate: '2027-01-20' }
const row = { item: '班級性融合', selected: true, execution: '合作閱讀', startDate: '2026-09-01', endDate: '2027-01-20', frequency: '每週', responsible: '導師' }
const parse = (content: unknown) => updateIepSchema.parse({ content }).content
test('new reference fields survive validation and frontend hydration without adding them to legacy IEPs', async () => {
  const input = { specialEducationSupport: { referenceDetails: { curriculumNeed: '有需求', supportNeed: '有需求', groups: { aids: { status: '有需求', selected: ['溝通輔具'], notes: { 溝通輔具: '平板' }, description: '上課使用' } } } }, inclusiveEducationPlan: { referenceRows: [row] }, curriculumAdjustment: { subjectDetails: { 國語: { teacher: '教師甲', content: '須調整', process: '無須調整', environment: '', assessment: '須調整' } } }, coursePlanItems: [course], weeklySchedule: ['第一學期', '第二學期'].map(semester => ({ semester, day: '星期一', period: '第八節', courseId: course.id })), behaviorIntervention: { executionDetails: { antecedent: { executionMethod: '每日提醒', implementers: '導師', progress: '持續執行' } } }, transitionSupport: { crossStagePlan: { employmentDetails: { 國中: { caregiverWorkplace: '社區職場', studentWorkplace: '圖書館', caregiverHome: '', studentHome: '' } } } }, pdfExportOptions: { teamMembers: [{ id: 'member', role: '班級導師', name: '教師甲', title: '導師' }] } }
  const saved = parse(input)
  assert.deepEqual(saved.inclusiveEducationPlan?.referenceRows, input.inclusiveEducationPlan.referenceRows)
  assert.deepEqual(saved.specialEducationSupport?.referenceDetails, input.specialEducationSupport.referenceDetails)
  assert.deepEqual(saved.curriculumAdjustment?.subjectDetails, input.curriculumAdjustment.subjectDetails)
  assert.deepEqual(saved.behaviorIntervention?.executionDetails, input.behaviorIntervention.executionDetails)
  assert.deepEqual(saved.transitionSupport?.crossStagePlan.employmentDetails, input.transitionSupport.crossStagePlan.employmentDetails)
  assert.deepEqual(saved.weeklySchedule, input.weeklySchedule)
  assert.deepEqual(saved.pdfExportOptions?.teamMembers, input.pdfExportOptions.teamMembers)
  const legacy = parse({ specialEducationSupport: {}, inclusiveEducationPlan: {}, curriculumAdjustment: {}, behaviorIntervention: {}, transitionSupport: {} })
  assert.equal(legacy.specialEducationSupport?.referenceDetails, undefined)
  assert.equal(legacy.inclusiveEducationPlan?.referenceRows, undefined)
  assert.equal(legacy.behaviorIntervention?.needStatus, '')
  assert.equal(legacy.transitionSupport?.services.education.needStatus, '')
  const { normalizeCurriculumAdjustment, normalizeWeeklySchedule } = await import(new URL('../../../frontend/src/services/curriculumPlanNormalization.ts', import.meta.url).href)
  assert.deepEqual(normalizeCurriculumAdjustment(saved.curriculumAdjustment).subjectDetails, input.curriculumAdjustment.subjectDetails)
  assert.deepEqual(normalizeWeeklySchedule(saved.weeklySchedule, saved.coursePlanItems), input.weeklySchedule)
  const legacySlot = { day: '星期一', period: '第八節', courseId: course.id }
  assert.deepEqual(normalizeWeeklySchedule([legacySlot, { ...legacySlot, semester: '第一學期' }], saved.coursePlanItems, '第二學期'), [legacySlot, { ...legacySlot, semester: '第一學期' }], 'legacy second-semester entries must not discard explicit first-semester entries')
})
test('invalid reference choices, reversed dates and duplicate entries fail before saving', () => {
  for (const content of [
    { inclusiveEducationPlan: { referenceRows: [row, row] } },
    { inclusiveEducationPlan: { referenceRows: [{ ...row, endDate: '2026-08-31' }] } },
    { specialEducationSupport: { referenceDetails: { groups: { aids: { selected: ['不存在'] } } } } },
    { curriculumAdjustment: { subjectDetails: { 國語: { content: '錯誤選項' } } } },
    { coursePlanItems: [{ ...course, endDate: '2026-01-01' }] },
    { coursePlanItems: [{ ...course, placement: '個別教學' }] },
    { coursePlanItems: [course], weeklySchedule: [1, 2].map(() => ({ semester: '第一學期', day: '星期一', period: '第八節', courseId: course.id })) },
    { pdfExportOptions: { teamMembers: [{ id: 'a', role: '不存在', name: '甲' }] } },
  ]) assert.equal(updateIepSchema.safeParse({ content }).success, false)
})
test('frontend and backend reference options remain identical', async () => {
  const client = JSON.parse(await readFile(new URL('../../../frontend/src/models/referenceFormOptions.json', import.meta.url), 'utf8'))
  assert.deepEqual(client, referenceOptions)
})
test('certificate upload accepts real images and rejects mismatched, damaged, oversized and huge PNG headers', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=', 'base64')
  await validateAttachment(png, 'image/png')
  await assert.rejects(validateAttachment(png, 'image/jpeg'))
  await assert.rejects(validateAttachment(Buffer.from('<svg/>'), 'image/png'))
  await assert.rejects(validateAttachment(Buffer.alloc(maximumAttachmentBytes + 1), 'image/png'))
  const huge = Buffer.from(png); huge.writeUInt32BE(100_000, 16); huge.writeUInt32BE(100_000, 20)
  await assert.rejects(validateAttachment(huge, 'image/png'))
})
