import { z } from 'zod'
import { iepContentSchema } from './studentIep.js'

const text = z.string().trim().max(200).default('')
const date = z.union([z.literal(''), z.iso.date()]).default('')
export const iepPdfOptionsSchema = z.object({
  schoolName: text, caseManager: text, caseManagerTitle: text,
  studentStatus: z.enum(['', '新生', '轉學生', '舊生']).default(''),
  draftedDate: date, committeeApprovalDate: date, curriculumApprovalDate: date,
  newStudentReviewDate: date, firstReviewDate: date, secondReviewDate: date,
  weeklyScheduleSemester: z.enum(['第一學期', '第二學期']).default('第一學期'),
}).prefault({})

export const iepPdfExportSchema = z.object({
  iepId: z.string().uuid().optional(), studentId: z.string().uuid().optional(),
  academicYear: z.number().int().min(1).max(999),
  content: iepContentSchema,
  options: iepPdfOptionsSchema,
})

export type IepPdfRequest = z.infer<typeof iepPdfExportSchema>
export type PdfOptions = z.infer<typeof iepPdfOptionsSchema>
