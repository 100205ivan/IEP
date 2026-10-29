import { z } from 'zod'

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
  content: z.record(z.string(), z.unknown()).default({}),
})

export const createAnnualIepSchema = z.object({
  academicYear: z.number().int().min(1, '請輸入有效的學年度。').max(999, '請輸入有效的學年度。'),
  mode: z.enum(['blank', 'copy-basic']).default('blank'),
  copyFromIepId: z.string().uuid().optional(),
  content: z.record(z.string(), z.unknown()).default({}),
})

export const updateIepSchema = z.object({
  student: studentFieldsSchema.optional(),
  academicYear: z.number().int().min(1).max(999).optional(),
  content: z.record(z.string(), z.unknown()),
})

export const deleteIepSchema = z.object({
  confirmation: z.string().refine((value) => value === '刪除', { message: '請輸入「刪除」以確認。' }),
})

export type StudentFields = z.infer<typeof studentFieldsSchema>
