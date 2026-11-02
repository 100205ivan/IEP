import { z } from 'zod'
import { teamMembersSchema } from './referenceForms.js'

const text = z.string().trim().max(200, '封面欄位不可超過 200 字。').default('')
const date = z.union([z.literal(''), z.iso.date({ error: '請填寫有效的封面日期。' })]).default('')

// Per-IEP export metadata, saved on ieps.content alongside the academic year.
// Keep this schema independent of the IEP schema to avoid a circular import.
export const iepPdfOptionsSchema = z.object({
  teamMembers: teamMembersSchema.optional(),
  schoolName: text, caseManager: text, caseManagerTitle: text,
  studentStatus: z.enum(['', '新生', '轉學生', '舊生'], { error: '請選擇有效的學生身分。' }).default(''),
  draftedDate: date, committeeApprovalDate: date, curriculumApprovalDate: date,
  newStudentReviewDate: date, firstReviewDate: date, secondReviewDate: date,
  weeklyScheduleSemester: z.enum(['第一學期', '第二學期'], { error: '請選擇有效的課表學期。' }).default('第一學期'),
}).passthrough()

export type PdfOptions = z.infer<typeof iepPdfOptionsSchema>
