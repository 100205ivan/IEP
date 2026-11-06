import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attentionReportSchema, createGameAssessmentSchema } from '../schemas/assessmentRecord.js'

const durations = { durationMs: 1000, forwardMs: 500, turnedMs: 200, unknownMs: 300 }
const attention = {
  ...durations, version: 1, model: 'mediapipe-face-landmarker', modelVersion: '0.10.32',
  startedAt: '2026-11-03T00:00:00.000Z', calibrated: true, yawThresholdDegrees: 25, pitchThresholdDegrees: 20,
  phases: { cpt: durations },
}
test('camera observations validate durations and preserve optional reports in both game payloads', () => {
  assert.equal(attentionReportSchema.safeParse(attention).success, true)
  assert.equal(attentionReportSchema.safeParse({ ...attention, forwardMs: 999 }).success, false)
  assert.equal(attentionReportSchema.safeParse({ ...attention, phases: {} }).success, false)
  assert.equal(attentionReportSchema.safeParse({ ...attention, calibrated: false }).success, false)
  assert.equal(attentionReportSchema.safeParse({ ...attention, durationMs: Infinity }).success, false)
  const prototypes = { model: 'eyeep-vision-prototypes-v1', available: true, sampleCount: 2,
    expressionCounts: { angry: 0, disgust: 0, fear: 0, happy: 1, sad: 0, surprise: 0, neutral: 0, contempt: 0, uncertain: 1 } }
  assert.equal(attentionReportSchema.safeParse({ ...attention, prototypes }).success, true)
  assert.equal(attentionReportSchema.safeParse({ ...attention, prototypes: { ...prototypes, sampleCount: 10 } }).success, false)
  // Reports saved while the engagement classifier existed stay valid.
  assert.equal(attentionReportSchema.safeParse({ ...attention, prototypes: { ...prototypes, engagementCounts: { engaged: 1, disengaged: 0, uncertain: 1 } } }).success, true)
  const base = { resultId: '7f0c15ee-0709-4ab7-b911-d81a3c45264c', assessmentDate: '2026-11-03', completedAt: '2026-11-03T00:01:00.000Z', summary: '測試資料', age: 8 }
  const games = [
    { gameType: 'monkey', result: { totalScore: 1, correctPositions: 1, totalPositions: 1, levelScores: [1], questionResults: [] } },
    { gameType: 'cpt', result: { testStartedAt: 0, testFinishedAt: 1000, durationMs: 1000, metrics: { hitRate: 1, omissionCount: 0, omissionRate: 0, commissionCount: 0, commissionRate: 0, meanReactionTime: 200, reactionTimeSD: 0 }, trials: [] } },
  ]
  for (const game of games) {
    const old = createGameAssessmentSchema.parse({ ...base, ...game })
    assert.equal(old.result.attention, undefined)
    const saved = createGameAssessmentSchema.parse({ ...base, ...game, result: { ...game.result, attention } })
    assert.deepEqual(saved.result.attention, attention)
  }
})
