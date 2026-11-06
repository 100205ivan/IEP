import { z } from 'zod'

const levels = ['better', 'typical', 'watch', 'concern', 'reference'] as const

/** One parameter of a game result against its norm (already judged by the page). */
const rowSchema = z.object({
  label: z.string().trim().min(1).max(60),
  value: z.string().trim().min(1).max(40),
  reference: z.string().trim().min(1).max(60),
  z: z.number().finite().nullable(),
  level: z.enum(levels),
}).strict()

/** De-identified: age and the per-parameter comparison only, no names or IDs. */
export const cptCommentRequestSchema = z.object({
  age: z.number().int().min(5).max(12),
  rows: z.array(rowSchema).min(1).max(12),
}).strict()

/** De-identified: school grade and the comparison only. */
export const monkeyCommentRequestSchema = z.object({
  grade: z.number().int().min(1).max(6),
  rows: z.array(rowSchema).min(1).max(8),
}).strict()

export const cptCommentSchema = z.object({ comment: z.string().trim().min(20).max(600) }).strict()

export const cptCommentJsonSchema = {
  type: 'object',
  properties: { comment: { type: 'string', description: '給老師看的一小段繁體中文評語，約 100 至 200 字。' } },
  required: ['comment'],
  additionalProperties: false,
}

export type CptCommentRequest = z.infer<typeof cptCommentRequestSchema>
export type MonkeyCommentRequest = z.infer<typeof monkeyCommentRequestSchema>
