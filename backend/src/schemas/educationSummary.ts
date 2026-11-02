import { z } from 'zod'

export const educationSummaryRequestSchema = z.object({
  deidentifiedText: z.string().trim().min(1, '請先填寫能力現況或優弱勢資料。').max(40_000, '摘要參考資料不可超過 40,000 字。'),
}).strict()

export const educationSummarySchema = z.object({
  strengthNotes: z.string().trim().min(1).max(5000),
  weaknessNotes: z.string().trim().min(1).max(5000),
  overallNeeds: z.string().trim().min(1).max(5000),
  warnings: z.array(z.string().trim().min(1).max(500)).max(10),
}).strict()

export const educationSummaryJsonSchema = {
  type: 'object',
  properties: {
    strengthNotes: { type: 'string', description: '有資料依據的優勢能力補充說明；資料不足時明確說明。' },
    weaknessNotes: { type: 'string', description: '有資料依據的弱勢能力補充說明；資料不足時明確說明。' },
    overallNeeds: { type: 'string', description: '適合填入 IEP 的整體教育需求摘要。' },
    warnings: { type: 'array', items: { type: 'string' }, description: '資料不足、矛盾或需教師核對之處；無則空陣列。' },
  },
  required: ['strengthNotes', 'weaknessNotes', 'overallNeeds', 'warnings'],
  additionalProperties: false,
}

export type EducationSummary = z.infer<typeof educationSummarySchema>
