import { z } from 'zod'
import { iepContentSchema } from './studentIep.js'
import { iepPdfOptionsSchema } from './iepPdfOptions.js'
export { iepPdfOptionsSchema, type PdfOptions } from './iepPdfOptions.js'

export const iepPdfExportSchema = z.object({
  iepId: z.string().uuid().optional(), studentId: z.string().uuid().optional(),
  academicYear: z.number().int().min(1).max(999),
  content: iepContentSchema,
  options: iepPdfOptionsSchema.optional(),
}).transform(input => ({ ...input, options: input.options ?? input.content.pdfExportOptions ?? iepPdfOptionsSchema.parse({}) }))

export type IepPdfRequest = z.infer<typeof iepPdfExportSchema>
