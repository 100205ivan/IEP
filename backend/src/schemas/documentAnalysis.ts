import { randomUUID } from 'node:crypto'
import { z } from 'zod'

export const abilityDomainKeys = [
  'sensory',
  'perceptualMotor',
  'selfCare',
  'cognitive',
  'communication',
  'socialEmotional',
  'academicLearning',
] as const

export type AbilityDomain = typeof abilityDomainKeys[number]

export const documentAnalysisRequestSchema = z.object({
  deidentifiedText: z.string().trim().min(1, '去識別化文字不可空白。').max(60_000, '去識別化文字不可超過 60,000 字。'),
}).strict()

const geminiEvidenceSchema = z.object({
  content: z.string().trim().min(1),
}).strict()

const geminiDomainAnalysisSchema = z.object({
  domain: z.enum(abilityDomainKeys),
  hasEvidence: z.boolean(),
  summary: z.string().trim().min(1).nullable(),
  evidence: z.array(geminiEvidenceSchema),
}).strict().superRefine((analysis, context) => {
  if (!analysis.hasEvidence && analysis.summary !== null) context.addIssue({ code: 'custom', message: '無證據向度的 summary 必須是 null。', path: ['summary'] })
  if (!analysis.hasEvidence && analysis.evidence.length !== 0) context.addIssue({ code: 'custom', message: '無證據向度的 evidence 必須是空陣列。', path: ['evidence'] })
  if (analysis.hasEvidence && analysis.summary === null) context.addIssue({ code: 'custom', message: '有證據向度必須有摘要。', path: ['summary'] })
  if (analysis.hasEvidence && analysis.evidence.length === 0) context.addIssue({ code: 'custom', message: '有證據向度至少需要一筆 evidence。', path: ['evidence'] })
})

export const geminiDocumentAnalysisSchema = z.object({
  documentInfo: z.object({
    documentType: z.string().trim().min(1).nullable(),
    assessmentDate: z.string().trim().min(1).nullable(),
    assessmentTools: z.array(z.string().trim().min(1)),
    evaluator: z.string().trim().min(1).nullable(),
  }).strict(),
  overallSummary: z.string().trim().min(1),
  domains: z.object({
    sensory: geminiDomainAnalysisSchema,
    perceptualMotor: geminiDomainAnalysisSchema,
    selfCare: geminiDomainAnalysisSchema,
    cognitive: geminiDomainAnalysisSchema,
    communication: geminiDomainAnalysisSchema,
    socialEmotional: geminiDomainAnalysisSchema,
    academicLearning: geminiDomainAnalysisSchema,
  }).strict(),
  warnings: z.array(z.string().trim().min(1)),
}).strict().superRefine((analysis, context) => {
  for (const domain of abilityDomainKeys) {
    if (analysis.domains[domain].domain !== domain) context.addIssue({ code: 'custom', message: `domains.${domain}.domain 必須是 ${domain}。`, path: ['domains', domain, 'domain'] })
  }
})

const documentEvidenceSchema = z.object({
  id: z.string().uuid(),
  content: z.string().trim().min(1),
}).strict()

const domainAnalysisSchema = z.object({
  domain: z.enum(abilityDomainKeys),
  hasEvidence: z.boolean(),
  summary: z.string().trim().min(1).nullable(),
  evidence: z.array(documentEvidenceSchema),
}).strict()

export const documentAnalysisResultSchema = z.object({
  id: z.string().uuid(),
  documentInfo: geminiDocumentAnalysisSchema.shape.documentInfo,
  overallSummary: z.string().trim().min(1),
  domains: z.object({
    sensory: domainAnalysisSchema,
    perceptualMotor: domainAnalysisSchema,
    selfCare: domainAnalysisSchema,
    cognitive: domainAnalysisSchema,
    communication: domainAnalysisSchema,
    socialEmotional: domainAnalysisSchema,
    academicLearning: domainAnalysisSchema,
  }).strict(),
  warnings: z.array(z.string().trim().min(1)),
}).strict().superRefine((analysis, context) => {
  for (const domain of abilityDomainKeys) {
    const domainAnalysis = analysis.domains[domain]
    if (domainAnalysis.domain !== domain) context.addIssue({ code: 'custom', message: `domains.${domain}.domain 必須是 ${domain}。`, path: ['domains', domain, 'domain'] })
    if (!domainAnalysis.hasEvidence && (domainAnalysis.summary !== null || domainAnalysis.evidence.length !== 0)) context.addIssue({ code: 'custom', message: '無證據向度不得帶有摘要或 evidence。', path: ['domains', domain] })
    if (domainAnalysis.hasEvidence && (domainAnalysis.summary === null || domainAnalysis.evidence.length === 0)) context.addIssue({ code: 'custom', message: '有證據向度必須有摘要及 evidence。', path: ['domains', domain] })
  }
})

export type DocumentAnalysisResult = z.infer<typeof documentAnalysisResultSchema>

/** IDs are generated only after Gemini's output has passed all validation. */
export function assignDocumentAnalysisIds(analysis: z.infer<typeof geminiDocumentAnalysisSchema>): DocumentAnalysisResult {
  const result = {
    id: randomUUID(),
    ...analysis,
    domains: Object.fromEntries(abilityDomainKeys.map(domain => {
      const domainAnalysis = analysis.domains[domain]
      return [domain, { ...domainAnalysis, evidence: domainAnalysis.evidence.map(evidence => ({ id: randomUUID(), ...evidence })) }]
    })) as DocumentAnalysisResult['domains'],
  }
  return documentAnalysisResultSchema.parse(result)
}

export const geminiDocumentAnalysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['documentInfo', 'overallSummary', 'domains', 'warnings'],
  properties: {
    documentInfo: {
      type: 'object', additionalProperties: false,
      required: ['documentType', 'assessmentDate', 'assessmentTools', 'evaluator'],
      properties: {
        documentType: { type: ['string', 'null'] },
        assessmentDate: { type: ['string', 'null'] },
        assessmentTools: { type: 'array', items: { type: 'string' } },
        evaluator: { type: ['string', 'null'] },
      },
    },
    overallSummary: { type: 'string' },
    domains: {
      type: 'object', additionalProperties: false,
      required: abilityDomainKeys,
      properties: Object.fromEntries(abilityDomainKeys.map(domain => [domain, {
        type: 'object', additionalProperties: false,
        required: ['domain', 'hasEvidence', 'summary', 'evidence'],
        properties: {
          domain: { type: 'string', enum: [domain] },
          hasEvidence: { type: 'boolean' },
          summary: { type: ['string', 'null'] },
          evidence: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['content'], properties: { content: { type: 'string' } } } },
        },
      }])),
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
} as const
