import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createStudentIepSchema, createAnnualIepSchema, updateIepSchema } from '../schemas/studentIep.js'
import { curriculumAdjustmentSchema } from '../schemas/curriculumPlan.js'

const group = (strategy: string) => ({ selectedStrategies: [strategy, '其他'], otherStrategy: '補充策略', applicableSubjects: ['國語', '其他'], otherSubject: '補充領域', description: '調整說明\n保留換行' })
const adjustment = { environment: group('座位調整'), content: group('教材內容簡化'), process: group('分段指令'), assessment: group('延長評量時間') }
const course = { id: 'course-original', courseName: '課程驗證', courseType: '普通教育課程', otherCourseType: '', teachingMethod: '原班上課', otherTeachingMethod: '', teacher: '測試教師', location: '原班教室', otherLocation: '', weeklyPeriods: 2, notes: '課程備註\n第二行' }
const content = { curriculumAdjustment: adjustment, coursePlanItems: [course], weeklySchedule: [{ day: '星期一', period: '第一節', courseId: course.id }], otherChapter: { keep: true } }
const parse = (input: unknown) => updateIepSchema.parse({ content: input }).content
const valid = (input: unknown) => updateIepSchema.safeParse({ content: input }).success

test('all adjustment, course and schedule fields survive all three IEP write entry points', () => {
  const requests = [
    createStudentIepSchema.parse({ student: { name: '欄位驗證' }, academicYear: 115, content }),
    createAnnualIepSchema.parse({ academicYear: 116, content }), updateIepSchema.parse({ content }),
  ]
  for (const request of requests) assert.deepEqual(request.content, content)
})

test('partial adjustment drafts receive complete nested defaults and retain future fields', () => {
  const saved = curriculumAdjustmentSchema.parse({ environment: { description: '尚未填完', futureGroupField: '保留' }, futureField: '保留' })
  assert.equal(saved.environment.description, '尚未填完')
  assert.deepEqual(saved.environment.selectedStrategies, [])
  assert.equal(saved.content.description, '')
  assert.deepEqual(saved.assessment.applicableSubjects, [])
  assert.equal(saved.environment.futureGroupField, '保留')
  assert.equal(saved.futureField, '保留')
  assert.equal(curriculumAdjustmentSchema.safeParse({ environment: { applicableSubjects: ['全部課程', '數學'] } }).success, false)
  assert.equal(curriculumAdjustmentSchema.safeParse({ environment: { selectedStrategies: ['口語評量'] } }).success, false)
  assert.equal(curriculumAdjustmentSchema.safeParse({ content: { applicableSubjects: ['不存在的課程'] } }).success, false)
})

test('course names, options, numeric counts and IDs are validated before persistence', () => {
  for (const invalid of [
    { ...course, id: '' }, { ...course, courseName: ' ' }, { ...course, courseType: '無效類型' },
    { ...course, teachingMethod: '無效方式' }, { ...course, location: '無效地點' },
    { ...course, weeklyPeriods: -1 }, { ...course, weeklyPeriods: Infinity }, { ...course, weeklyPeriods: '2' },
  ]) assert.equal(valid({ ...content, coursePlanItems: [invalid] }), false)
  assert.equal(valid({ ...content, coursePlanItems: [course, { ...course }] }), false)
  assert.equal(valid({ coursePlanItems: [{ ...course, weeklyPeriods: 0 }], weeklySchedule: [] }), true)
  assert.equal(valid({ coursePlanItems: [{ ...course, weeklyPeriods: 1.5 }], weeklySchedule: [] }), true)
})

test('schedule rejects unknown courses, invalid weekdays/periods and duplicate time slots', () => {
  for (const entry of [
    { day: '星期一', period: '第一節', courseId: 'missing-course' },
    { day: '星期六', period: '第一節', courseId: course.id },
    { day: '星期一', period: '第九節', courseId: course.id },
  ]) assert.equal(valid({ ...content, weeklySchedule: [entry] }), false)
  assert.equal(valid({ ...content, weeklySchedule: [...content.weeklySchedule, ...content.weeklySchedule] }), false)
  assert.equal(valid({ weeklySchedule: content.weeklySchedule }), false)
})

test('deleting a course requires removing its schedule and clearing both lists is valid', () => {
  assert.equal(valid({ ...content, coursePlanItems: [] }), false)
  assert.deepEqual(parse({ ...content, coursePlanItems: [], weeklySchedule: [] }), { ...content, coursePlanItems: [], weeklySchedule: [] })
  assert.equal(valid({ ...content, coursePlanItems: [{ ...course, weeklyPeriods: 0 }], weeklySchedule: content.weeklySchedule }), true, 'scheduled-count warnings remain advisory, matching the UI')
})

test('editing course details retains stable schedule references and earlier chapters', () => {
  const input = { ...content, coursePlanItems: [{ ...course, courseName: '修改後的課程', teacher: '修改後的測試教師', futureCourseField: '保留' }], specialEducationSupport: { staffHours: '4.5' }, inclusiveEducationPlan: { grade: '四年級' } }
  const saved = parse(input)
  assert.equal(saved.weeklySchedule?.[0].courseId, course.id)
  assert.equal(saved.coursePlanItems?.[0].teacher, '修改後的測試教師')
  assert.equal(saved.coursePlanItems?.[0].futureCourseField, '保留')
  assert.equal(saved.specialEducationSupport?.staffHours, '4.5')
  assert.equal(saved.inclusiveEducationPlan?.grade, '四年級')
  assert.deepEqual(saved.otherChapter, content.otherChapter)
})

test('frontend normalizes partial legacy data and starts missing sections empty', async () => {
  const moduleUrl = new URL('../../../frontend/src/services/curriculumPlanNormalization.ts', import.meta.url).href
  const { normalizeCurriculumAdjustment, normalizeCoursePlanItems, normalizeWeeklySchedule } = await import(moduleUrl)
  const empty = normalizeCurriculumAdjustment(undefined)
  assert.equal(empty.content.description, '')
  assert.deepEqual(empty.process.selectedStrategies, [])
  const partial = normalizeCurriculumAdjustment({ environment: { selectedStrategies: null, description: '舊資料' } })
  assert.deepEqual(partial.environment.selectedStrategies, [])
  assert.equal(partial.environment.description, '舊資料')
  const courses = normalizeCoursePlanItems([{ id: course.id, courseName: course.courseName, weeklyPeriods: '2' }])
  assert.equal(courses[0].weeklyPeriods, 2)
  assert.equal(courses[0].notes, '')
  assert.deepEqual(normalizeCoursePlanItems(undefined), [])
  assert.deepEqual(normalizeWeeklySchedule(undefined, courses), [])
  empty.environment.selectedStrategies.push('座位調整')
  assert.deepEqual(normalizeCurriculumAdjustment(undefined).environment.selectedStrategies, [])
})

test('legacy schedule cleanup mirrors the UI: retain one valid slot and remove deleted courses', async () => {
  const moduleUrl = new URL('../../../frontend/src/services/curriculumPlanNormalization.ts', import.meta.url).href
  const { normalizeWeeklySchedule } = await import(moduleUrl)
  const entry = content.weeklySchedule[0]
  const schedule = [entry, { ...entry }, { ...entry, day: '星期六' }, { ...entry, period: '第八節' }, { ...entry, courseId: 'deleted-course' }]
  assert.deepEqual(normalizeWeeklySchedule(schedule, [course]), [entry, { ...entry, period: '第八節' }])
  assert.deepEqual(normalizeWeeklySchedule(schedule, []), [])
})
