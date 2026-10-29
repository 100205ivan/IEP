import { z } from 'zod'
import { documentAnalysisResultSchema } from './documentAnalysis.js'

const manualFields = z.object({
  assessmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '請填寫有效的評量日期。'),
  assessmentType: z.string().trim().min(1, '請選擇評量類型。').max(80),
  otherAssessmentType: z.string().trim().max(120).default(''),
  assessmentTool: z.string().trim().min(1, '請填寫評量工具／方式。').max(255),
  evaluator: z.string().trim().min(1, '請填寫評量者。').max(120),
  summary: z.string().trim().min(1, '請填寫評量摘要。').max(20_000),
})

function validateOtherAssessmentType(value: { assessmentType: string; otherAssessmentType: string }, context: z.RefinementCtx) {
  if (value.assessmentType === '其他' && !value.otherAssessmentType) context.addIssue({ code: 'custom', path: ['otherAssessmentType'], message: '請填寫其他評量類型。' })
}

export const createManualAssessmentSchema = manualFields.superRefine(validateOtherAssessmentType)
export const updateManualAssessmentSchema = manualFields.extend({ iepId: z.string().uuid() }).superRefine(validateOtherAssessmentType)
export const deleteManualAssessmentSchema = z.object({ iepId: z.string().uuid() })
export const createDocumentAnalysisSchema = documentAnalysisResultSchema
const monkeyResultSchema = z.object({
  totalScore: z.number().finite(),
  correctPositions: z.number().int().nonnegative(),
  totalPositions: z.number().int().nonnegative(),
  levelScores: z.array(z.number().finite()),
  questionResults: z.array(z.object({
    id: z.number().int(), level: z.number().int(), sequence: z.array(z.string()), correctAnswer: z.array(z.string()), playerAnswer: z.array(z.string()), correctPositions: z.number().int().nonnegative(), totalPositions: z.number().int().nonnegative(), score: z.number().finite(),
  })),
})
const cptResultSchema = z.object({
  testStartedAt: z.number().finite(), testFinishedAt: z.number().finite(), durationMs: z.number().finite().nonnegative(),
  metrics: z.object({ hitRate: z.number().finite(), omissionCount: z.number().int().nonnegative(), omissionRate: z.number().finite(), commissionCount: z.number().int().nonnegative(), commissionRate: z.number().finite(), meanReactionTime: z.number().finite(), reactionTimeSD: z.number().finite() }),
  trials: z.array(z.object({ trialIndex: z.number().int(), stimulus: z.number().int(), isTarget: z.boolean(), responded: z.boolean(), hit: z.boolean(), omission: z.boolean(), commission: z.boolean(), reactionTime: z.number().finite().nullable(), startTime: z.number().finite() })),
})
export const createGameAssessmentSchema = z.discriminatedUnion('gameType', [
  z.object({ resultId: z.string().uuid(), gameType: z.literal('monkey'), assessmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '請提供有效的評量日期。'), completedAt: z.string().datetime(), summary: z.string().trim().min(1).max(20_000), age: z.number().int().min(5).max(18), result: monkeyResultSchema }),
  z.object({ resultId: z.string().uuid(), gameType: z.literal('cpt'), assessmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '請提供有效的評量日期。'), completedAt: z.string().datetime(), summary: z.string().trim().min(1).max(20_000), age: z.number().int().min(5).max(18), result: cptResultSchema }),
])
export type ManualAssessmentFields = z.infer<typeof manualFields>
export type DocumentAnalysisFields = z.infer<typeof createDocumentAnalysisSchema>
export type GameAssessmentFields = z.infer<typeof createGameAssessmentSchema>
