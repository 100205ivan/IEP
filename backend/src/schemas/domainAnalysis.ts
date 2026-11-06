import { z } from 'zod'

export const domainKeys = ['sensory', 'perceptualMotor', 'selfCare', 'cognitive', 'communication', 'socialEmotional', 'academicLearning'] as const
export const domainKeySchema = z.enum(domainKeys)
export type DomainKey = z.infer<typeof domainKeySchema>

const questionOptionSchema = z.object({ id: z.string().trim().min(1).max(80), label: z.string().trim().min(1).max(200), semanticValue: z.string().trim().min(1).max(80) }).strict()
export const supplementalQuestionSchema = z.object({
  id: z.string().trim().min(1).max(100), category: z.enum(['context', 'observableBehavior', 'performance', 'frequency', 'duration', 'support', 'impact']),
  question: z.string().trim().min(1).max(500), reason: z.string().trim().min(1).max(500), type: z.enum(['single', 'multiple']),
  options: z.array(questionOptionSchema).min(2).max(12), allowOther: z.boolean(), required: z.boolean(),
}).strict()

const referencesSchema = z.array(z.object({ source: z.enum(['document', 'monkey', 'cpt', 'manual']), text: z.string().trim().min(1).max(5000) }).strict()).max(30)
export const domainAnalysisRequestSchema = z.object({
  domain: domainKeySchema,
  domainLabel: z.string().trim().min(1).max(80),
  selections: z.record(z.string(), z.array(z.string().trim().min(1).max(200))).default({}),
  details: z.record(z.string(), z.string().max(5000)).default({}),
  references: referencesSchema.default([]),
  supplementalAnswers: z.array(z.object({ questionId: z.string().trim().min(1).max(100), selectedOptionIds: z.array(z.string().trim().min(1).max(80)).max(12), otherText: z.string().max(1000).optional(), skipped: z.boolean().optional() }).strict()).max(5).default([]),
}).strict()
export type DomainAnalysisRequest = z.infer<typeof domainAnalysisRequestSchema>

const smartDraftSchema = z.object({ baseline: z.string().nullable(), expectedChange: z.string().nullable(), condition: z.string().nullable(), timeframe: z.string().nullable(), incomplete: z.boolean() }).strict()
export const domainAnalysisResponseSchema = z.object({
  domain: domainKeySchema,
  completeness: z.object({ sufficient: z.boolean(), missingItems: z.array(z.string().trim().min(1)).max(10), reasons: z.array(z.string().trim().min(1)).max(10) }).strict(),
  questions: z.array(supplementalQuestionSchema).max(5),
  professionalCurrentStatus: z.string().trim().min(1).nullable(),
  classAdaptationImpact: z.string().trim().min(1).nullable(),
  educationNeeds: z.string().trim().min(1).nullable(),
  evidence: z.array(z.object({ source: z.enum(['teacher_observation', 'assessment_reference', 'supplemental_answer']), statement: z.string().trim().min(1).max(1000) }).strict()).max(30),
  warnings: z.array(z.string().trim().min(1).max(500)).max(10),
  smartGoalDraft: smartDraftSchema.nullable(),
}).strict()
export type DomainAnalysisResponse = z.infer<typeof domainAnalysisResponseSchema>

export const domainAnalysisJsonSchema = {
  type: 'object', additionalProperties: false,
  required: ['domain', 'completeness', 'questions', 'professionalCurrentStatus', 'classAdaptationImpact', 'educationNeeds', 'evidence', 'warnings', 'smartGoalDraft'],
  properties: {
    domain: { type: 'string', enum: [...domainKeys] },
    completeness: { type: 'object', additionalProperties: false, required: ['sufficient', 'missingItems', 'reasons'], properties: { sufficient: { type: 'boolean' }, missingItems: { type: 'array', items: { type: 'string' } }, reasons: { type: 'array', items: { type: 'string' } } } },
    // Keep Gemini's transport schema structurally simple. Zod remains the authority
    // for collection limits and string constraints after Gemini responds.
    questions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'category', 'question', 'reason', 'type', 'options', 'allowOther', 'required'], properties: { id: { type: 'string' }, category: { type: 'string', enum: ['context', 'observableBehavior', 'performance', 'frequency', 'duration', 'support', 'impact'] }, question: { type: 'string' }, reason: { type: 'string' }, type: { type: 'string', enum: ['single', 'multiple'] }, options: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'label', 'semanticValue'], properties: { id: { type: 'string' }, label: { type: 'string' }, semanticValue: { type: 'string' } } } }, allowOther: { type: 'boolean' }, required: { type: 'boolean' } } } },
    professionalCurrentStatus: { type: ['string', 'null'] }, classAdaptationImpact: { type: ['string', 'null'] }, educationNeeds: { type: ['string', 'null'] },
    evidence: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['source', 'statement'], properties: { source: { type: 'string', enum: ['teacher_observation', 'assessment_reference', 'supplemental_answer'] }, statement: { type: 'string' } } } },
    warnings: { type: 'array', items: { type: 'string' } },
    smartGoalDraft: { anyOf: [
      { type: 'null' },
      { type: 'object', additionalProperties: false, required: ['baseline', 'expectedChange', 'condition', 'timeframe', 'incomplete'], properties: { baseline: { type: ['string', 'null'] }, expectedChange: { type: ['string', 'null'] }, condition: { type: ['string', 'null'] }, timeframe: { type: ['string', 'null'] }, incomplete: { type: 'boolean' } } },
    ] },
  },
} as const
