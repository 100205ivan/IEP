import { z } from 'zod'
import { documentAnalysisResultSchema } from './documentAnalysis.js'

export const assessmentDateSchema = z.iso.date({ error: '請填寫有效的評量日期。' })
  .refine(value => value >= '1000-01-01', '評量日期須介於西元 1000 至 9999 年。')

const manualFields = z.object({
  assessmentDate: assessmentDateSchema,
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
const observationDurations = z.object({
  durationMs: z.number().finite().nonnegative(), forwardMs: z.number().finite().nonnegative(),
  turnedMs: z.number().finite().nonnegative(), unknownMs: z.number().finite().nonnegative(),
}).refine(row => Math.abs(row.durationMs - row.forwardMs - row.turnedMs - row.unknownMs) < 1, '觀察時間合計不一致。')
const prototypeReportSchema = z.object({
  model: z.literal('eyeep-vision-prototypes-v1'), available: z.boolean(), sampleCount: z.number().int().nonnegative(),
  modelIds: z.object({ emotion: z.string().regex(/^[a-f0-9]{64}$/), engagement: z.string().regex(/^[a-f0-9]{64}$/).optional() }).optional(),
  expressionCounts: z.record(z.enum(['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral', 'contempt', 'uncertain']), z.number().int().nonnegative()),
  // Legacy: reports saved before the engagement classifier was removed still carry it.
  engagementCounts: z.record(z.enum(['disengaged', 'engaged', 'uncertain']), z.number().int().nonnegative()).optional(),
}).refine(report => [report.expressionCounts, report.engagementCounts ?? report.expressionCounts].every(counts => Object.values(counts).reduce((a, b) => a + b, 0) === report.sampleCount), '模型分類次數合計不一致。')
export const attentionReportSchema = observationDurations.safeExtend({
  prototypes: prototypeReportSchema.optional(),
  version: z.literal(1), model: z.literal('mediapipe-face-landmarker'), modelVersion: z.string().max(30),
  startedAt: z.string().datetime(), calibrated: z.boolean(),
  yawThresholdDegrees: z.number().positive().max(180), pitchThresholdDegrees: z.number().positive().max(90),
  phases: z.object({ listening: observationDurations.optional(), answering: observationDurations.optional(), cpt: observationDurations.optional() }),
}).superRefine((report, context) => {
  for (const key of ['durationMs', 'forwardMs', 'turnedMs', 'unknownMs'] as const) {
    const sum = Object.values(report.phases).reduce((total, row) => total + (row?.[key] ?? 0), 0)
    if (Math.abs(report[key] - sum) >= 1) context.addIssue({ code: 'custom', path: [key], message: '階段時間合計不一致。' })
  }
  if (!report.calibrated && report.forwardMs + report.turnedMs > 0) context.addIssue({ code: 'custom', path: ['calibrated'], message: '未校準時不能判定朝向。' })
})
const monkeyResultSchema = z.object({
  attention: attentionReportSchema.optional(),
  totalScore: z.number().finite(),
  correctPositions: z.number().int().nonnegative(),
  totalPositions: z.number().int().nonnegative(),
  levelScores: z.array(z.number().finite()),
  questionResults: z.array(z.object({
    id: z.number().int(), level: z.number().int(), sequence: z.array(z.string()), correctAnswer: z.array(z.string()), playerAnswer: z.array(z.string()), correctPositions: z.number().int().nonnegative(), totalPositions: z.number().int().nonnegative(), score: z.number().finite(),
  })),
})
const cptResultSchema = z.object({
  attention: attentionReportSchema.optional(),
  testStartedAt: z.number().finite(), testFinishedAt: z.number().finite(), durationMs: z.number().finite().nonnegative(),
  metrics: z.object({ hitRate: z.number().finite(), omissionCount: z.number().int().nonnegative(), omissionRate: z.number().finite(), commissionCount: z.number().int().nonnegative(), commissionRate: z.number().finite(), meanReactionTime: z.number().finite(), reactionTimeSD: z.number().finite() }),
  trials: z.array(z.object({ trialIndex: z.number().int(), stimulus: z.number().int(), isTarget: z.boolean(), responded: z.boolean(), hit: z.boolean(), omission: z.boolean(), commission: z.boolean(), reactionTime: z.number().finite().nullable(), startTime: z.number().finite() })),
})
export const createGameAssessmentSchema = z.discriminatedUnion('gameType', [
  z.object({ resultId: z.string().uuid(), gameType: z.literal('monkey'), assessmentDate: assessmentDateSchema, completedAt: z.string().datetime(), summary: z.string().trim().min(1).max(20_000), age: z.number().int().min(5).max(18), result: monkeyResultSchema }),
  z.object({ resultId: z.string().uuid(), gameType: z.literal('cpt'), assessmentDate: assessmentDateSchema, completedAt: z.string().datetime(), summary: z.string().trim().min(1).max(20_000), age: z.number().int().min(5).max(18), result: cptResultSchema }),
])
export type ManualAssessmentFields = z.infer<typeof manualFields>
export type DocumentAnalysisFields = z.infer<typeof createDocumentAnalysisSchema>
export type GameAssessmentFields = z.infer<typeof createGameAssessmentSchema>
