import { z } from 'zod'
import { specialEducationSupportSchema } from './specialEducationSupport.js'
import { inclusiveEducationPlanSchema } from './inclusiveEducationPlan.js'
import { curriculumAdjustmentSchema, coursePlanItemSchema, weeklyScheduleEntrySchema } from './curriculumPlan.js'
import { goalDomainSchema, semesterGoalSchema, validateEducationGoalLinks } from './educationGoals.js'
import { behaviorInterventionSchema, transitionSupportSchema } from './behaviorTransition.js'
import { iepMeetingRecordsSchema } from './iepMeetingRecords.js'
import { iepPdfOptionsSchema } from './iepPdfOptions.js'

// Validate connected chapters without stripping data belonging to other chapters.
export const iepContentSchema = z.object({
  pdfExportOptions: iepPdfOptionsSchema.optional(),
  specialEducationSupport: specialEducationSupportSchema.optional(),
  inclusiveEducationPlan: inclusiveEducationPlanSchema.optional(),
  curriculumAdjustment: curriculumAdjustmentSchema.optional(),
  coursePlanItems: z.array(coursePlanItemSchema).optional(),
  weeklySchedule: z.array(weeklyScheduleEntrySchema).optional(),
  goalDomains: z.array(goalDomainSchema).optional(),
  semesterGoals: z.array(semesterGoalSchema).optional(),
  learningNotes: z.string().max(20_000, '學生學習狀況說明不可超過 20,000 字。').optional(),
  behaviorIntervention: behaviorInterventionSchema.optional(),
  transitionSupport: transitionSupportSchema.optional(),
  meetingRecords: iepMeetingRecordsSchema.optional(),
}).catchall(z.unknown()).superRefine((content, context) => {
  const courseIds = new Set<string>()
  for (const [index, course] of (content.coursePlanItems ?? []).entries()) {
    if (courseIds.has(course.id)) context.addIssue({ code: 'custom', path: ['coursePlanItems', index, 'id'], message: '課程識別碼不可重複。' })
    courseIds.add(course.id)
  }
  const occupiedSlots = new Set<string>()
  for (const [index, entry] of (content.weeklySchedule ?? []).entries()) {
    if (!courseIds.has(entry.courseId)) context.addIssue({ code: 'custom', path: ['weeklySchedule', index, 'courseId'], message: '課表只能安排目前 IEP 課程規劃中的課程。' })
    const slot = `${entry.semester ?? content.pdfExportOptions?.weeklyScheduleSemester ?? '第一學期'}/${entry.day}/${entry.period}`
    if (occupiedSlots.has(slot)) context.addIssue({ code: 'custom', path: ['weeklySchedule', index], message: '同一天的同一節次只能安排一筆課程。' })
    occupiedSlots.add(slot)
  }
  validateEducationGoalLinks(content, context)
})

const nullableString = z.string().trim().nullable().optional()

export const studentFieldsSchema = z.object({
  name: z.string().trim().min(1, '請輸入學生姓名。').max(120),
  gender: z.string().trim().max(20).default(''),
  birthDate: nullableString,
  nationalId: z.string().trim().max(32).nullable().optional(),
  studentNumber: z.string().trim().max(64).default(''),
})

export const createStudentIepSchema = z.object({
  student: studentFieldsSchema,
  academicYear: z.number().int().min(1).max(999),
  content: iepContentSchema.default({}),
})

export const createAnnualIepSchema = z.object({
  academicYear: z.number().int().min(1, '請輸入有效的學年度。').max(999, '請輸入有效的學年度。'),
  mode: z.enum(['blank', 'copy-basic']).default('blank'),
  copyFromIepId: z.string().uuid().optional(),
  content: iepContentSchema.default({}),
})

export const updateIepSchema = z.object({
  student: studentFieldsSchema.optional(),
  academicYear: z.number().int().min(1).max(999).optional(),
  content: iepContentSchema,
})

export const deleteIepSchema = z.object({
  confirmation: z.string().refine((value) => value === '刪除', { message: '請輸入「刪除」以確認。' }),
})

export type StudentFields = z.infer<typeof studentFieldsSchema>
